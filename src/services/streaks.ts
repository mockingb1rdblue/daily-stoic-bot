/**
 * Private streak acknowledgment service.
 * Sends casual DMs at milestone streaks. Never public, never guilt-tripping.
 * Tone: friend noticing you've been consistent, not an app congratulating you.
 */

import { sendDM } from '../utils/discord.js';

const STREAK_MESSAGES: Record<number, string> = {
	3: "3 days in a row. not bad for a philosophy practice that's 2000 years old.",
	7: "week one down. epictetus would be quietly impressed. (he'd never say it though.)",
	14: "two weeks. at this point you've read more stoic philosophy than most philosophy majors.",
	21: "three weeks. this is past the 'novelty' phase. this is just... who you are now apparently.",
	30: "a month of daily stoic practice. marcus aurelius did this for decades and ran an empire. you're doing it and also have to deal with slack notifications, which is arguably harder.",
	60: "60 days. seneca would write you a letter about this. it would be 4000 words long and somehow also about death.",
	90: "quarter of a year. at this point you're not 'trying stoicism.' you're practicing it.",
	180: "half a year. the obstacle became the way, or whatever. seriously though — this is rare consistency.",
	365: "one full year. you've read every entry. the book is done but the practice isn't. respect.",
};

/**
 * Check if a user just hit a streak milestone and send a DM if so.
 * Called after recording engagement.
 */
export async function checkStreakMilestone(
	env: Env,
	userId: string,
	guildId: string,
	streak: number,
): Promise<void> {
	const message = STREAK_MESSAGES[streak];
	if (!message) return;

	// Check cooldown — don't re-send the same milestone
	const key = `STOIC_STREAK_${userId}_${streak}`;
	const alreadySent = await env.BIFROST_KV.get(key);
	if (alreadySent) return;

	try {
		await sendDM(env, userId, message);
		// Mark as sent (no expiry — milestone is permanent)
		await env.BIFROST_KV.put(key, 'sent');
	} catch {
		// User has DMs off — that's fine
	}
}
