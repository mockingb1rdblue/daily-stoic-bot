/**
 * Reaction poller service.
 * Since Workers don't have gateway access, we poll Discord REST API
 * for reactions on the daily post to track engagement.
 * Runs each morning, checking yesterday's post reactions.
 */

import { discordApi } from '../utils/discord.js';
import { recordEngagement, getUserStreak } from './engagement.js';
import { checkStreakMilestone } from './streaks.js';
import { type GuildConfig } from '../db/guilds.js';

interface ReactionUser {
	id: string;
	username: string;
	bot?: boolean;
}

interface StoredMessageInfo {
	messageId: string;
	channelId: string;
	provider?: string;
	modelId?: string;
	dayOfYear?: number;
}

/**
 * Report engagement reward to Bifrost Grimoire for cross-project MAB learning.
 * The bandit uses this to learn which LLM models produce the best Stoic content.
 */
async function reportEngagementToGrimoire(
	env: Env,
	provider: string,
	modelId: string,
	taskType: string,
	engagementRate: number,
): Promise<void> {
	try {
		const apiKey = await env.BIFROST_KV.get('PROXY_API_KEY');
		if (!apiKey) return;

		await fetch(`${env.ROUTER_URL}/v1/grimoire/report`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				project: 'daily-stoic-bot',
				arm: `${provider}/${modelId}`,
				taskType,
				reward: engagementRate,
				metadata: { source: 'reaction-engagement' },
			}),
		});
	} catch {
		// Non-critical — don't fail the poll over telemetry
	}
}

/**
 * Poll reactions from yesterday's daily post and record engagement + check streaks.
 */
export async function pollYesterdayReactions(env: Env, guilds: GuildConfig[]): Promise<void> {
	for (const guild of guilds) {
		try {
			// Get yesterday's daily message from KV
			const msgData = await env.BIFROST_KV.get(`STOIC_DAILY_MSG_${guild.guild_id}`);
			if (!msgData) continue;

			const msgInfo = JSON.parse(msgData) as StoredMessageInfo;
			const { messageId, channelId } = msgInfo;

			// Get users who reacted with 🏛️
			const users = (await discordApi(
				env,
				`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent('🏛️')}?limit=100`,
				'GET',
			)) as ReactionUser[];

			// Calculate yesterday's day_of_year
			const yesterday = new Date();
			yesterday.setUTCDate(yesterday.getUTCDate() - 1);
			const startOfYear = new Date(Date.UTC(yesterday.getUTCFullYear(), 0, 0));
			const dayOfYear = Math.floor((yesterday.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));

			for (const user of users) {
				if (user.bot) continue;

				await recordEngagement(env.DB, user.id, guild.guild_id, dayOfYear);

				// Check streak and send milestone DM if applicable
				const streak = await getUserStreak(env.DB, user.id, guild.guild_id);
				await checkStreakMilestone(env, user.id, guild.guild_id, streak);
			}

			// Report engagement to Grimoire for MAB reward signal
			const nonBotUsers = users.filter(u => !u.bot);
			if (msgInfo.provider && msgInfo.modelId && nonBotUsers.length > 0) {
				// Engagement rate: reactions / estimated guild size (rough proxy)
				// For a small group, even 1 reaction is strong signal
				const engagementRate = Math.min(nonBotUsers.length / 5, 1.0);
				await reportEngagementToGrimoire(
					env,
					msgInfo.provider,
					msgInfo.modelId,
					'stoic-hook',
					engagementRate,
				);
			}

			console.log({
				event: 'reaction_poll_complete',
				component: 'services.reaction-poller',
				guildId: guild.guild_id,
				usersEngaged: nonBotUsers.length,
			});
		} catch (error: unknown) {
			console.error({
				event: 'reaction_poll_error',
				component: 'services.reaction-poller',
				message: `Guild ${guild.guild_id}: ${error instanceof Error ? error.message : 'Unknown'}`,
			});
		}
	}
}
