/**
 * Weekly virtue poll service.
 * Posts a poll in #stoic-discussion each Friday for the community to vote
 * on the virtue they want to focus on next week.
 */

import { postMessage } from '../utils/discord.js';
import { getEntriesForWeek } from '../db/entries.js';
import { type GuildConfig } from '../db/guilds.js';

const VIRTUES = [
	{ name: 'Courage', emoji: '\ud83e\udee1', description: 'Bravery in the face of fear and adversity' },
	{ name: 'Wisdom', emoji: '\ud83e\udde0', description: 'Sound judgment and knowledge of what matters' },
	{ name: 'Justice', emoji: '\u2696\ufe0f', description: 'Fairness and service to the common good' },
	{ name: 'Temperance', emoji: '\ud83c\udf3f', description: 'Self-control and moderation in all things' },
];

/**
 * Post the weekly virtue poll to #stoic-discussion.
 * Uses Discord's native poll feature.
 */
export async function postVirtuePoll(env: Env, guilds: GuildConfig[]): Promise<void> {
	if (guilds.length === 0) {
		console.log({
			event: 'virtue_poll_no_guilds',
			component: 'services.virtue-poll',
			message: 'No guilds configured — run /stoic setup in a server first',
		});
		return;
	}

	// Get this week's entries for context
	const weekEntries = await getEntriesForWeek(env.DB);
	const weekThemes = weekEntries.map((e) => e.title).join(', ');

	const pollContent = [
		'**Weekly Virtue Focus Poll**\n',
		'This week\'s themes touched on: ' +
			(weekThemes || 'various aspects of Stoic practice') +
			'.\n',
		'Which cardinal virtue do you want our community to focus on next week? ' +
			'The winning virtue will shape our daily reflections and discussion prompts.\n',
		'Vote below:',
	].join('\n');

	// Use Discord poll message format
	const pollMessage = {
		content: pollContent,
		poll: {
			question: {
				text: 'Which virtue should we focus on next week?',
			},
			answers: VIRTUES.map((v) => ({
				poll_media: {
					text: `${v.emoji} ${v.name} — ${v.description}`,
				},
			})),
			duration: 24, // Hours
			allow_multiselect: false,
		},
	};

	let successCount = 0;
	let errorCount = 0;

	for (const guild of guilds) {
		try {
			const message = await postMessage(env, guild.channel_discussion, pollMessage);

			// Save poll to database for tracking
			const now = new Date();
			const dayOfWeek = now.getUTCDay();
			const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
			const weekStart = new Date(now);
			weekStart.setUTCDate(now.getUTCDate() + mondayOffset);
			const weekStartStr = weekStart.toISOString().split('T')[0];

			await env.DB.prepare(
				`INSERT INTO virtue_polls (guild_id, week_start, poll_message_id, created_at)
				 VALUES (?, ?, ?, unixepoch())`,
			)
				.bind(
					guild.guild_id,
					weekStartStr,
					(message as Record<string, unknown>).id as string,
				)
				.run();

			successCount++;
		} catch (error: unknown) {
			errorCount++;
			console.error({
				event: 'virtue_poll_guild_error',
				component: 'services.virtue-poll',
				message: `Failed for guild ${guild.guild_id}: ${error instanceof Error ? error.message : 'Unknown'}`,
			});
		}
	}

	console.log({
		event: 'virtue_poll_complete',
		component: 'services.virtue-poll',
		message: `Virtue poll posted to ${successCount} guilds, ${errorCount} errors`,
	});
}
