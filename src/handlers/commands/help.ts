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
			description: '366 days of Stoic philosophy. One entry per day.\nNo leaderboards, no guilt — just show up when you can.',
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
				'## What It Does',
				'Every morning you get a Stoic entry — quote, commentary, and a one-liner to get you to actually read the thing.',
				'Tap 🏛️ on the post if you read it. That\'s it. The bot tracks your streak privately — nobody else sees it.\n',
				'**Buttons on each post:**',
				'⚔️ Challenge This — argue against the entry',
				'💭 Reflect — jot down what stuck with you',
				'📖 Save to Commonplace — saves it to a forum thread for later\n',
				'Each evening: you get 3 questions in a private thread to think about your day.',
			].join('\n'),
			color: 0x8b7355,
		},
		{
			description: '## Commands',
			color: 0x8b7355,
			fields: [
				{ name: '`/stoic obstacle`', value: 'Describe what\'s bugging you — get a different way to look at it', inline: false },
				{ name: '`/stoic context`', value: 'Tell the bot about your life so it can be less generic', inline: false },
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
