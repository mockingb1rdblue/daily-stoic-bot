/**
 * /stoic help — Shows all available commands and how the bot works.
 * Ephemeral so it doesn't clutter the channel.
 */

import { InteractionResponseType } from 'discord-interactions';
import { jsonResponse } from '../../utils/json.js';
import { getGuildConfig } from '../../db/guilds.js';

export async function handleHelp(
	interaction: Record<string, unknown>,
	env: Env,
): Promise<Response> {
	const guildId = interaction.guild_id as string;
	const config = guildId ? await getGuildConfig(env.DB, guildId) : null;

	const statusLine = config
		? `Active — ${config.timezone_label}`
		: '⚠️ Not set up — run `/stoic setup`';

	const embeds = [
		{
			author: { name: 'Daily Stoic Bot' },
			description: '366 days of Stoic philosophy. One entry per day.\nNo streaks, no leaderboards — just honest reflection.',
			color: 0x8b7355,
			fields: [
				{ name: 'Status', value: statusLine, inline: true },
				...(config ? [
					{ name: 'Morning', value: `${config.morning_hour_utc}:00 UTC`, inline: true },
					{ name: 'Evening', value: `${config.evening_hour_utc}:00 UTC`, inline: true },
				] : []),
			],
		},
		{
			description: [
				'## Daily Features',
				'Each morning: Stoic entry with quote + commentary + LLM-generated hook.',
				'Tap 🏛️ on the post to track your streak (private — only you see milestones).\n',
				'**Buttons on each post:**',
				'⚔️ Challenge This — philosophical counter-argument',
				'💭 Reflect — quick modal to capture what landed',
				'📖 Save to Commonplace — creates a forum thread\n',
				'Each evening: 3 personalized Socratic questions in a private thread.',
			].join('\n'),
			color: 0x8b7355,
		},
		{
			description: '## Commands',
			color: 0x8b7355,
			fields: [
				{ name: '`/stoic obstacle`', value: 'Stoic reframe for what you\'re wrestling with', inline: false },
				{ name: '`/stoic context`', value: 'Set your personal lens for tailored reflections', inline: false },
				{ name: '`/stoic letter`', value: 'Write an unsent letter using today\'s entry', inline: false },
				{ name: '`/stoic voice`', value: 'Epictetus (blunt) · Seneca (eloquent) · Marcus (introspective)', inline: false },
			],
		},
		{
			description: '## Admin',
			color: 0x8b7355,
			fields: [
				{ name: '`/stoic setup`', value: 'Create channels + pick timezone', inline: true },
				{ name: '`/stoic cleanup`', value: 'Remove everything', inline: true },
				{ name: '`/stoic schedule`', value: 'Change posting times', inline: true },
				{ name: '`/stoic trigger`', value: 'Fire any event manually', inline: true },
			],
			footer: {
				text: '"Waste no more time arguing about what a good person should be. Be one." — Marcus Aurelius',
			},
		},
	];

	return jsonResponse({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			embeds,
			flags: 64,
		},
	});
}
