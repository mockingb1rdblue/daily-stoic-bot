/**
 * Commonplace Book weekly thread service.
 * Creates a new forum post each Monday with the week's entries as conversation starters.
 */

import { getEntriesForWeek } from '../db/entries.js';
import { type GuildConfig } from '../db/guilds.js';
import { discordApi } from '../utils/discord.js';

/**
 * Create a weekly commonplace forum thread for each configured guild.
 * Called on Mondays at each guild's morning hour.
 */
export async function createWeeklyCommonplaceThread(env: Env, guilds: GuildConfig[]): Promise<void> {
	const entries = await getEntriesForWeek(env.DB);
	if (entries.length === 0) return;

	// Build week label
	const now = new Date();
	const monthName = now.toLocaleDateString('en-US', { month: 'long' });
	const dayNum = now.getUTCDate();

	// Get unique themes and parts for the week
	const themes = [...new Set(entries.map((e) => e.month_theme))];
	const parts = [...new Set(entries.map((e) => e.part))];

	const threadTitle = `Week of ${monthName} ${dayNum} — ${themes.join(', ')}`;

	// Build the opening message with entry previews
	const entryPreviews = entries
		.map(
			(e) =>
				`**${e.date} — ${e.title}**\n*"${e.quote.slice(0, 150)}${e.quote.length > 150 ? '...' : ''}"*\n*— ${e.quote_source}*`,
		)
		.join('\n\n');

	const content = [
		`This week's entries for reflection and connection:\n`,
		entryPreviews,
		`\n---\n*Drop a thought on any of these — today, next week, or whenever one connects to something real in your life.*`,
	].join('\n');

	for (const guild of guilds) {
		try {
			// Get the forum channel's available tags to find matching ones
			const channelInfo = (await discordApi(env, `/channels/${guild.channel_commonplace}`, 'GET')) as {
				available_tags?: Array<{ id: string; name: string }>;
			};

			// Match tags based on the week's parts/themes
			const tagMap: Record<string, string> = {};
			for (const tag of channelInfo.available_tags ?? []) {
				tagMap[tag.name] = tag.id;
			}

			const appliedTags: string[] = [];
			// Map parts to tags
			if (parts.includes('THE DISCIPLINE OF PERCEPTION') && tagMap['Perception']) appliedTags.push(tagMap['Perception']);
			if (parts.includes('THE DISCIPLINE OF ACTION') && tagMap['Action']) appliedTags.push(tagMap['Action']);
			if (parts.includes('THE DISCIPLINE OF WILL') && tagMap['Will']) appliedTags.push(tagMap['Will']);

			// Create forum thread
			await discordApi(env, `/channels/${guild.channel_commonplace}/threads`, 'POST', {
				name: threadTitle.slice(0, 100),
				auto_archive_duration: 10080, // 7 days
				applied_tags: appliedTags.slice(0, 5), // Discord max 5 tags
				message: { content },
			});

			console.log({
				event: 'commonplace_thread_created',
				component: 'services.commonplace',
				guildId: guild.guild_id,
				title: threadTitle,
				entries: entries.length,
			});
		} catch (error: unknown) {
			console.error({
				event: 'commonplace_thread_error',
				component: 'services.commonplace',
				message: `Failed for guild ${guild.guild_id}: ${error instanceof Error ? error.message : 'Unknown'}`,
			});
		}
	}
}
