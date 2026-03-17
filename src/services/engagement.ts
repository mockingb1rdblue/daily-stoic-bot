/**
 * Engagement tracking service.
 * Tracks reaction taps on daily posts and manages private streak acknowledgments.
 * Never public, never guilt-tripping.
 */

import { sendDM } from '../utils/discord.js';
import { type GuildConfig } from '../db/guilds.js';

/** Record a user's engagement (called when reaction is detected) */
export async function recordEngagement(
	db: D1Database,
	userId: string,
	guildId: string,
	entryDay: number,
): Promise<void> {
	await db.prepare(
		`INSERT OR IGNORE INTO engagement_log (user_id, guild_id, entry_day) VALUES (?, ?, ?)`
	).bind(userId, guildId, entryDay).run();
}

/** Get a user's current streak (consecutive days of engagement) */
export async function getUserStreak(db: D1Database, userId: string, guildId: string): Promise<number> {
	// Get all engagement days for this user, ordered descending
	const result = await db.prepare(
		`SELECT entry_day FROM engagement_log WHERE user_id = ? AND guild_id = ? ORDER BY entry_day DESC LIMIT 60`
	).bind(userId, guildId).all<{ entry_day: number }>();

	const days = result.results?.map(r => r.entry_day) ?? [];
	if (days.length === 0) return 0;

	// Count consecutive days from most recent
	let streak = 1;
	for (let i = 1; i < days.length; i++) {
		if (days[i - 1] - days[i] === 1) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
}

/**
 * Check for users who haven't engaged in 3+ days and send a gentle ping.
 * Called by the cron system. Not a guilt trip — just a door left open.
 */
export async function checkInWithQuietUsers(
	env: Env,
	guild: GuildConfig,
	todaysDayOfYear: number,
): Promise<void> {
	// Find users who have context (opted in) but haven't tapped in 3+ days
	const result = await env.DB.prepare(`
		SELECT uc.user_id, MAX(el.entry_day) as last_day
		FROM user_contexts uc
		LEFT JOIN engagement_log el ON uc.user_id = el.user_id AND el.guild_id = ?
		GROUP BY uc.user_id
		HAVING last_day IS NULL OR (? - last_day) >= 3
	`).bind(guild.guild_id, todaysDayOfYear).all<{ user_id: string; last_day: number | null }>();

	const quietUsers = result.results ?? [];

	for (const user of quietUsers) {
		const daysMissed = user.last_day ? todaysDayOfYear - user.last_day : null;

		// Only send once per 7-day window (check KV for cooldown)
		const cooldownKey = `STOIC_CHECKIN_${user.user_id}_${guild.guild_id}`;
		const lastCheckin = await env.SECRETS_KV.get(cooldownKey);
		if (lastCheckin) continue;

		try {
			const message = daysMissed
				? `hey — no pressure, just leaving the door open. today's entry might be worth 30 seconds if you have them.`
				: `hey — looks like you haven't jumped in yet. whenever you're ready, the daily entries are rolling. no rush.`;

			await sendDM(env, user.user_id, message);

			// Set 7-day cooldown
			await env.SECRETS_KV.put(cooldownKey, 'sent', { expirationTtl: 604800 });
		} catch {
			// User may have DMs off — that's fine
		}
	}
}
