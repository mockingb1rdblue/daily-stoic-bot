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

	const scheduleInfo = config
		? `\n**Schedule** (${config.timezone_label}):\nMorning post: ${config.morning_hour_utc}:00 UTC | Evening exam: ${config.evening_hour_utc}:00 UTC | Friday poll: ${config.poll_hour_utc}:00 UTC`
		: '\n*Not set up yet — run `/stoic setup` to get started.*';

	const embed = {
		title: 'Daily Stoic Bot',
		description: [
			'366 days of Stoic philosophy. One entry per day. No streaks, no leaderboards — just honest reflection.\n',
			'**Daily Features**',
			'Each morning the bot posts the day\'s Stoic entry with a quote and commentary. Tap 🏛️ to mark that you showed up (private streak tracking). Three buttons on each post:\n',
			'> ⚔️ **Challenge This** — The Adversary generates the strongest objection to today\'s teaching',
			'> 💭 **Reflect** — Quick modal to jot down what landed for you',
			'> 📖 **Save to Commonplace** — Creates a discussion thread in the forum\n',
			'Each evening, users with a personal context get 3 Socratic questions in a private thread.\n',
			'**Commands**',
			'`/stoic obstacle` — Describe what you\'re wrestling with. Get a Stoic reframe + one Socratic question.',
			'`/stoic context` — Set your personal lens ("I\'m a nurse", "going through a divorce"). Makes reflections more relevant.',
			'`/stoic letter` — Write an unsent letter to someone using today\'s entry as a lens. Private exercise.',
			'`/stoic voice` — Choose your philosopher: Epictetus (blunt), Seneca (eloquent), Marcus Aurelius (introspective).\n',
			'**Admin Commands**',
			'`/stoic setup` — Create the Daily Stoic channels in this server. Pick your timezone.',
			'`/stoic cleanup` — Remove all Daily Stoic channels and config.',
			'`/stoic schedule` — Change morning/evening posting times.',
			'`/stoic trigger` — Manually fire any scheduled event (morning post, evening exam, poll, etc.).\n',
			'**Weekly**',
			'Fridays: virtue poll (Courage, Wisdom, Justice, Temperance) + "Then vs. Now" modern adaptation.',
			'Mondays: new commonplace book thread with the week\'s entries.',
			scheduleInfo,
		].join('\n'),
		color: 0x8b7355,
		footer: {
			text: '"Waste no more time arguing about what a good person should be. Be one." — Marcus Aurelius',
		},
	};

	return jsonResponse({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			embeds: [embed],
			flags: 64, // Ephemeral
		},
	});
}
