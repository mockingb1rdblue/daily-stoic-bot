/**
 * /stoic setup — Provisions the Daily Stoic category and channels in the current guild.
 * Creates: category, text channels (reflections, discussion), forum channel (commonplace).
 * Forum gets Stoic-themed tags and guidelines.
 * Only usable by server administrators.
 */

import { InteractionResponseType } from 'discord-interactions';
import { jsonResponse } from '../../utils/json.js';
import {
	createCategory,
	createTextChannel,
	discordApi,
} from '../../utils/discord.js';
import { getGuildConfig, saveGuildConfig } from '../../db/guilds.js';

/** UTC offsets for timezone choices — same as schedule.ts */
const TIMEZONE_OFFSETS: Record<string, number> = {
	'US/Eastern (UTC-5)': -5,
	'US/Central (UTC-6)': -6,
	'US/Mountain (UTC-7)': -7,
	'US/Pacific (UTC-8)': -8,
	'US/Alaska (UTC-9)': -9,
	'US/Hawaii (UTC-10)': -10,
	'UK/London (UTC+0)': 0,
	'EU/Central (UTC+1)': 1,
	'EU/Eastern (UTC+2)': 2,
	'Asia/India (UTC+5:30)': 5,
	'Asia/Tokyo (UTC+9)': 9,
	'AU/Sydney (UTC+11)': 11,
};

function localToUtc(localHour: number, utcOffset: number): number {
	return ((localHour - utcOffset) % 24 + 24) % 24;
}

/** Discord channel types */
const CHANNEL_TYPE_FORUM = 15;

/** Stoic-themed forum tags for the commonplace book */
const FORUM_TAGS = [
	{ name: 'Perception', emoji_name: '👁️' },
	{ name: 'Action', emoji_name: '⚡' },
	{ name: 'Will', emoji_name: '🔥' },
	{ name: 'Courage', emoji_name: '🛡️' },
	{ name: 'Wisdom', emoji_name: '🧠' },
	{ name: 'Justice', emoji_name: '⚖️' },
	{ name: 'Temperance', emoji_name: '🌿' },
	{ name: 'Mortality', emoji_name: '⏳' },
	{ name: 'Personal', emoji_name: '📝' },
	{ name: 'Life Update', emoji_name: '🔄' },
];

const FORUM_GUIDELINES = `Welcome to the Stoic Commonplace Book.

This is a living document — a place to connect the daily Stoic entries to your own life. There's no pressure to post, no streak to maintain, and no wrong way to use it.

**How to use this channel:**
• Each week, the bot opens a thread for that week's entries
• Drop a line whenever something resonates — today, next week, or months later
• Use tags to categorize: the three disciplines (Perception, Action, Will), the four virtues, or Personal/Life Update for your own reflections

**Guidelines:**
• Be honest over impressive
• One genuine sentence beats ten performative ones
• This is reflection, not debate — save challenges for #stoic-discussion
• What's shared here stays here — respect the vulnerability`;

export async function handleSetup(
	interaction: Record<string, unknown>,
	env: Env,
): Promise<Response> {
	const guildId = interaction.guild_id as string;
	const member = interaction.member as Record<string, unknown>;
	const userId = (member?.user as Record<string, unknown>)?.id as string;
	const permissions = parseInt(member?.permissions as string, 10);

	if (!(permissions & 0x20)) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: 'You need **Manage Server** permission to set up the Daily Stoic bot.',
				flags: 64,
			},
		});
	}

	const existing = await getGuildConfig(env.DB, guildId);
	if (existing) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content:
					`Daily Stoic is already set up in this server.\n` +
					`Channels: <#${existing.channel_reflections}> <#${existing.channel_discussion}> <#${existing.channel_commonplace}>\n` +
					`Use \`/stoic cleanup\` first if you want to reconfigure.`,
				flags: 64,
			},
		});
	}

	// Parse timezone option
	const data = interaction.data as Record<string, unknown>;
	const parentOptions = data.options as Array<Record<string, unknown>>;
	const subOptions = parentOptions?.[0]?.options as Array<Record<string, unknown>> | undefined;
	const timezoneChoice = (subOptions?.find((o) => o.name === 'timezone')?.value as string) ?? 'US/Mountain (UTC-7)';
	const offset = TIMEZONE_OFFSETS[timezoneChoice] ?? -7;

	const morningUtc = localToUtc(7, offset);
	const eveningUtc = localToUtc(20, offset);
	const pollUtc = localToUtc(17, offset);

	try {
		// Create category
		const category = await createCategory(env, guildId, 'Daily Stoic');

		// Create text channels
		const reflections = await createTextChannel(
			env,
			guildId,
			'stoic-reflections',
			category.id,
			'Daily Stoic entries and evening examination threads',
		);
		const discussion = await createTextChannel(
			env,
			guildId,
			'stoic-discussion',
			category.id,
			'Philosophical debates, challenges, and weekly virtue polls',
		);

		// Create forum channel with tags, guidelines, gallery layout, and default reaction
		const commonplace = (await discordApi(env, `/guilds/${guildId}/channels`, 'POST', {
			name: 'stoic-commonplace',
			type: CHANNEL_TYPE_FORUM,
			parent_id: category.id,
			topic: FORUM_GUIDELINES,
			default_forum_layout: 1, // Gallery view
			default_sort_order: 1, // Latest activity
			default_reaction_emoji: { emoji_name: '🏛️' }, // Classical pillar — Stoic aesthetic
			available_tags: FORUM_TAGS.map((t) => ({
				name: t.name,
				emoji_name: t.emoji_name,
				moderated: false,
			})),
		})) as { id: string; available_tags?: Array<{ id: string; name: string }> };

		// Create the first forum post — a welcome thread
		const welcomeTag = commonplace.available_tags?.find((t) => t.name === 'Personal');
		await discordApi(env, `/channels/${commonplace.id}/threads`, 'POST', {
			name: 'Welcome to the Commonplace Book',
			auto_archive_duration: 10080, // 7 days
			applied_tags: welcomeTag ? [welcomeTag.id] : [],
			message: {
				content: [
					'**Welcome to the Stoic Commonplace Book.**\n',
					'A commonplace book is an ancient practice — Marcus Aurelius kept one, Seneca referenced his constantly. ',
					'It\'s a place to collect passages, reflections, and connections between what you read and what you live.\n',
					'**How this works:**',
					'- Each week, new threads appear for that week\'s daily entries',
					'- Drop in whenever something connects — today, next month, or a year from now',
					'- Use the tags to categorize: the three disciplines (Perception, Action, Will), the four cardinal virtues, or Personal for your own reflections',
					'- There\'s no pressure to post. One honest line beats ten performative ones.\n',
					'**Start here:** What brought you to Stoic philosophy? What are you carrying right now that you hope it helps with?',
					'\n*"Waste no more time arguing about what a good person should be. Be one." — Marcus Aurelius*',
				].join('\n'),
			},
		});

		// Save config with schedule
		await saveGuildConfig(env.DB, {
			guild_id: guildId,
			category_id: category.id,
			channel_reflections: reflections.id,
			channel_discussion: discussion.id,
			channel_commonplace: commonplace.id,
			morning_hour_utc: morningUtc,
			evening_hour_utc: eveningUtc,
			poll_hour_utc: pollUtc,
			timezone_label: timezoneChoice,
			setup_by: userId,
		});

		const formatHour = (h: number) => {
			const period = h >= 12 ? 'PM' : 'AM';
			const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
			return `${display}:00 ${period}`;
		};

		console.log({
			event: 'guild_setup_complete',
			component: 'commands.setup',
			guildId,
			categoryId: category.id,
			timezone: timezoneChoice,
			morningUtc,
			eveningUtc,
		});

		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content:
					`**Daily Stoic is ready!** Created:\n\n` +
					`<#${reflections.id}> — Daily entries + evening reflections\n` +
					`<#${discussion.id}> — Debates, challenges, virtue polls\n` +
					`<#${commonplace.id}> — Evergreen commonplace book (with Stoic tags)\n\n` +
					`**Schedule** (${timezoneChoice}):\n` +
					`Morning post: **${formatHour(7)}** local\n` +
					`Evening exam: **${formatHour(20)}** local\n` +
					`Friday poll: **${formatHour(17)}** local\n\n` +
					`Use \`/stoic schedule\` to change times, or \`/stoic context\` to set your personal lens.`,
			},
		});
	} catch (error: unknown) {
		console.error({
			event: 'guild_setup_error',
			component: 'commands.setup',
			message: error instanceof Error ? error.message : 'Unknown error',
			guildId,
		});

		// Attempt to clean up any channels created before the failure
		// This prevents orphaned channels on partial setup failures
		try {
			const guildChannels = (await discordApi(env, `/guilds/${guildId}/channels`, 'GET')) as Array<{ id: string; name: string; parent_id?: string }>;
			const stoicCategory = guildChannels.find((c) => c.name === 'Daily Stoic' && !c.parent_id);
			if (stoicCategory) {
				const children = guildChannels.filter((c) => c.parent_id === stoicCategory.id);
				for (const child of children) {
					await discordApi(env, `/channels/${child.id}`, 'DELETE').catch(() => {});
				}
				await discordApi(env, `/channels/${stoicCategory.id}`, 'DELETE').catch(() => {});
				console.log({ event: 'guild_setup_rollback', component: 'commands.setup', guildId, cleaned: children.length + 1 });
			}
		} catch {
			// Rollback failed — orphaned channels may exist, user can delete manually
		}

		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content:
					'Setup failed. Make sure the bot has **Manage Channels** permission and try again.\n' +
					`Error: ${error instanceof Error ? error.message : 'Unknown'}`,
				flags: 64,
			},
		});
	}
}
