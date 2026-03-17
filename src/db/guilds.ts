/**
 * Guild configuration queries.
 * Manages per-guild channel setup and schedule for dynamic provisioning.
 */

export interface GuildConfig {
	guild_id: string;
	category_id: string;
	channel_reflections: string;
	channel_discussion: string;
	channel_commonplace: string;
	morning_hour_utc: number;
	evening_hour_utc: number;
	poll_hour_utc: number;
	timezone_label: string;
	setup_by: string;
}

/** Get guild config, returns null if bot hasn't been set up in this guild */
export async function getGuildConfig(db: D1Database, guildId: string): Promise<GuildConfig | null> {
	return db
		.prepare('SELECT * FROM guild_config WHERE guild_id = ?')
		.bind(guildId)
		.first<GuildConfig>();
}

/** Save guild config after /stoic setup creates channels */
export async function saveGuildConfig(db: D1Database, config: GuildConfig): Promise<void> {
	await db
		.prepare(
			`INSERT OR REPLACE INTO guild_config
			 (guild_id, category_id, channel_reflections, channel_discussion, channel_commonplace,
			  morning_hour_utc, evening_hour_utc, poll_hour_utc, timezone_label, setup_by, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
		)
		.bind(
			config.guild_id,
			config.category_id,
			config.channel_reflections,
			config.channel_discussion,
			config.channel_commonplace,
			config.morning_hour_utc,
			config.evening_hour_utc,
			config.poll_hour_utc,
			config.timezone_label,
			config.setup_by,
		)
		.run();
}

/** Update just the schedule fields */
export async function updateGuildSchedule(
	db: D1Database,
	guildId: string,
	morningHour: number,
	eveningHour: number,
	pollHour: number,
	timezoneLabel: string,
): Promise<void> {
	await db
		.prepare(
			`UPDATE guild_config
			 SET morning_hour_utc = ?, evening_hour_utc = ?, poll_hour_utc = ?, timezone_label = ?, updated_at = unixepoch()
			 WHERE guild_id = ?`,
		)
		.bind(morningHour, eveningHour, pollHour, timezoneLabel, guildId)
		.run();
}

/** Delete guild config (used by /stoic cleanup) */
export async function deleteGuildConfig(db: D1Database, guildId: string): Promise<void> {
	await db.prepare('DELETE FROM guild_config WHERE guild_id = ?').bind(guildId).run();
}

/** Get all configured guilds (used by manual trigger endpoints) */
export async function getAllGuildConfigs(db: D1Database): Promise<GuildConfig[]> {
	const result = await db.prepare('SELECT * FROM guild_config').all<GuildConfig>();
	return result.results ?? [];
}

/** Get guilds whose morning post is due at the given UTC hour */
export async function getGuildsByMorningHour(db: D1Database, hour: number): Promise<GuildConfig[]> {
	const result = await db
		.prepare('SELECT * FROM guild_config WHERE morning_hour_utc = ?')
		.bind(hour)
		.all<GuildConfig>();
	return result.results ?? [];
}

/** Get guilds whose evening exam is due at the given UTC hour */
export async function getGuildsByEveningHour(db: D1Database, hour: number): Promise<GuildConfig[]> {
	const result = await db
		.prepare('SELECT * FROM guild_config WHERE evening_hour_utc = ?')
		.bind(hour)
		.all<GuildConfig>();
	return result.results ?? [];
}

/** Get guilds whose poll is due at the given UTC hour (Fridays only) */
export async function getGuildsByPollHour(db: D1Database, hour: number): Promise<GuildConfig[]> {
	const result = await db
		.prepare('SELECT * FROM guild_config WHERE poll_hour_utc = ?')
		.bind(hour)
		.all<GuildConfig>();
	return result.results ?? [];
}
