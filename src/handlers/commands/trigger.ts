/**
 * /stoic trigger — Manually fire any scheduled event.
 * Admin only. Deferred response since events take time.
 */

import { InteractionResponseType } from 'discord-interactions';
import { jsonResponse } from '../../utils/json.js';
import { editOriginalResponse } from '../../utils/discord.js';
import { postDailyEntry } from '../../services/daily-post.js';
import { runEveningExamination } from '../../services/evening-exam.js';
import { postVirtuePoll } from '../../services/virtue-poll.js';
import { postThenVsNow } from '../../services/then-vs-now.js';
import { createWeeklyCommonplaceThread } from '../../services/commonplace.js';
import { pollYesterdayReactions } from '../../services/reaction-poller.js';
import { checkInWithQuietUsers } from '../../services/engagement.js';
import { getGuildConfig } from '../../db/guilds.js';
import { getTodaysEntry } from '../../db/entries.js';

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
	morning: 'Daily morning post',
	evening: 'Evening examination threads',
	poll: 'Weekly virtue poll',
	'then-vs-now': 'Then vs. Now modern adaptation',
	commonplace: 'Weekly commonplace forum thread',
	reactions: 'Poll yesterday\'s reactions + streak check',
	checkin: 'Gentle check-in with quiet users',
};

export function handleTrigger(
	interaction: Record<string, unknown>,
	env: Env,
	ctx: ExecutionContext,
): Response {
	const member = interaction.member as Record<string, unknown>;
	const permissions = parseInt(member?.permissions as string, 10);

	if (!(permissions & 0x20)) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: 'You need **Manage Server** permission to trigger events.',
				flags: 64,
			},
		});
	}

	// Defer — events take time
	ctx.waitUntil(processTrigger(interaction, env));
	return jsonResponse({
		type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
		data: { flags: 64 }, // Ephemeral — admin only
	});
}

async function processTrigger(interaction: Record<string, unknown>, env: Env): Promise<void> {
	const token = interaction.token as string;
	const appId = env.DISCORD_APP_ID;
	const guildId = interaction.guild_id as string;

	const data = interaction.data as Record<string, unknown>;
	const parentOptions = data.options as Array<Record<string, unknown>>;
	const subOptions = parentOptions?.[0]?.options as Array<Record<string, unknown>> | undefined;
	const eventName = subOptions?.find((o) => o.name === 'event')?.value as string;

	if (!eventName || !TRIGGER_DESCRIPTIONS[eventName]) {
		await editOriginalResponse(appId, token, {
			content: `Unknown event. Available: ${Object.keys(TRIGGER_DESCRIPTIONS).join(', ')}`,
			flags: 64,
		});
		return;
	}

	const config = await getGuildConfig(env.DB, guildId);
	if (!config) {
		await editOriginalResponse(appId, token, {
			content: 'Run `/stoic setup` first.',
			flags: 64,
		});
		return;
	}

	const guilds = [config]; // Only fire for the current guild

	try {
		switch (eventName) {
			case 'morning':
				await postDailyEntry(env, guilds);
				break;
			case 'evening':
				await runEveningExamination(env, guilds);
				break;
			case 'poll':
				await postVirtuePoll(env, guilds);
				break;
			case 'then-vs-now':
				await postThenVsNow(env, guilds);
				break;
			case 'commonplace':
				await createWeeklyCommonplaceThread(env, guilds);
				break;
			case 'reactions':
				await pollYesterdayReactions(env, guilds);
				break;
			case 'checkin': {
				const entry = await getTodaysEntry(env.DB);
				if (!entry) {
					await editOriginalResponse(appId, token, {
						content: 'No entry found for today.',
						flags: 64,
					});
					return;
				}
				await checkInWithQuietUsers(env, config, entry.day_of_year);
				break;
			}
		}

		await editOriginalResponse(appId, token, {
			content: `**${TRIGGER_DESCRIPTIONS[eventName]}** triggered for this server.`,
			flags: 64,
		});

		console.log({
			event: 'manual_trigger',
			component: 'commands.trigger',
			guildId,
			triggerName: eventName,
		});
	} catch (error: unknown) {
		await editOriginalResponse(appId, token, {
			content: `Trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			flags: 64,
		});
	}
}
