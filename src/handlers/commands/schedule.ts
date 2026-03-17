/**
 * /stoic schedule — Change the bot's posting schedule for this server.
 * Only usable by server administrators.
 */

import { InteractionResponseType } from 'discord-interactions';
import { jsonResponse } from '../../utils/json.js';
import { getGuildConfig, updateGuildSchedule } from '../../db/guilds.js';

/** Common UTC offsets for the timezone choice */
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

/**
 * Convert a local hour (0-23) to UTC given an offset.
 * e.g., 7am local with offset -7 (MST) = 14 UTC
 */
function localToUtc(localHour: number, utcOffset: number): number {
	return ((localHour - utcOffset) % 24 + 24) % 24;
}

/**
 * Convert a UTC hour to local given an offset.
 */
function utcToLocal(utcHour: number, utcOffset: number): number {
	return ((utcHour + utcOffset) % 24 + 24) % 24;
}

export async function handleSchedule(
	interaction: Record<string, unknown>,
	env: Env,
): Promise<Response> {
	const guildId = interaction.guild_id as string;
	const member = interaction.member as Record<string, unknown>;
	const permissions = parseInt(member?.permissions as string, 10);

	if (!(permissions & 0x20)) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: 'You need **Manage Server** permission to change the schedule.',
				flags: 64,
			},
		});
	}

	const config = await getGuildConfig(env.DB, guildId);
	if (!config) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: 'Daily Stoic is not set up yet. Run `/stoic setup` first.',
				flags: 64,
			},
		});
	}

	// Parse options
	const data = interaction.data as Record<string, unknown>;
	const parentOptions = data.options as Array<Record<string, unknown>>;
	const subOptions = parentOptions?.[0]?.options as Array<Record<string, unknown>> | undefined;

	const timezoneChoice = subOptions?.find((o) => o.name === 'timezone')?.value as string | undefined;
	const morningHour = subOptions?.find((o) => o.name === 'morning')?.value as number | undefined;
	const eveningHour = subOptions?.find((o) => o.name === 'evening')?.value as number | undefined;

	if (!timezoneChoice) {
		// Show current schedule
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content:
					`**Current Schedule** (${config.timezone_label}):\n` +
					`Morning post: ${config.morning_hour_utc}:00 UTC\n` +
					`Evening exam: ${config.evening_hour_utc}:00 UTC\n` +
					`Friday poll: ${config.poll_hour_utc}:00 UTC\n\n` +
					"Use `/stoic schedule` with timezone, morning, and evening options to change.",
				flags: 64,
			},
		});
	}

	const offset = TIMEZONE_OFFSETS[timezoneChoice];
	if (offset === undefined) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: { content: 'Invalid timezone selection.', flags: 64 },
		});
	}

	const localMorning = morningHour ?? 7;
	const localEvening = eveningHour ?? 20;

	const utcMorning = localToUtc(localMorning, offset);
	const utcEvening = localToUtc(localEvening, offset);
	const utcPoll = localToUtc(17, offset); // Friday poll at 5pm local

	await updateGuildSchedule(env.DB, guildId, utcMorning, utcEvening, utcPoll, timezoneChoice);

	const formatHour = (h: number) => {
		const period = h >= 12 ? 'PM' : 'AM';
		const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
		return `${display}:00 ${period}`;
	};

	console.log({
		event: 'schedule_updated',
		component: 'commands.schedule',
		guildId,
		utcMorning,
		utcEvening,
		utcPoll,
		timezone: timezoneChoice,
	});

	return jsonResponse({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content:
				`**Schedule updated!** (${timezoneChoice})\n\n` +
				`Morning post: **${formatHour(localMorning)}** local (${utcMorning}:00 UTC)\n` +
				`Evening exam: **${formatHour(localEvening)}** local (${utcEvening}:00 UTC)\n` +
				`Friday poll: **5:00 PM** local (${utcPoll}:00 UTC)`,
		},
	});
}
