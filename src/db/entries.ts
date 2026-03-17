/**
 * Database queries for stoic entries.
 * Entries are keyed by day_of_year (1-366) for daily rotation.
 */

export interface StoicEntry {
	id: number;
	day_of_year: number;
	date: string;
	month: string;
	day: number;
	title: string;
	quote: string;
	quote_source: string;
	commentary: string;
	part: string;
	month_theme: string;
	created_at: string;
}

/**
 * Get the current day of year (1-366) in UTC.
 */
function getCurrentDayOfYear(): number {
	const now = new Date();
	const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); // Jan 1
	const diff = now.getTime() - start.getTime();
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay) + 1; // 1-indexed: Jan 1 = day 1
}

/**
 * Get today's entry based on the current UTC day of year.
 */
export async function getTodaysEntry(db: D1Database): Promise<StoicEntry | null> {
	const dayOfYear = getCurrentDayOfYear();
	return getEntryByDayOfYear(db, dayOfYear);
}

/**
 * Get a specific entry by day of year.
 */
export async function getEntryByDayOfYear(
	db: D1Database,
	dayOfYear: number,
): Promise<StoicEntry | null> {
	const result = await db
		.prepare('SELECT * FROM entries WHERE day_of_year = ?')
		.bind(dayOfYear)
		.first<StoicEntry>();

	return result ?? null;
}

/**
 * Get a random entry for Then vs. Now comparisons.
 */
export async function getRandomEntry(db: D1Database): Promise<StoicEntry | null> {
	const result = await db
		.prepare('SELECT * FROM entries ORDER BY RANDOM() LIMIT 1')
		.first<StoicEntry>();

	return result ?? null;
}

/**
 * Get all entries from the current week (Monday through Sunday).
 * Used for weekly virtue poll synthesis.
 */
export async function getEntriesForWeek(db: D1Database): Promise<StoicEntry[]> {
	const now = new Date();
	const dayOfWeek = now.getUTCDay(); // 0 = Sunday
	const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

	const monday = new Date(now);
	monday.setUTCDate(now.getUTCDate() - mondayOffset);
	monday.setUTCHours(0, 0, 0, 0);

	const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
	const oneDay = 1000 * 60 * 60 * 24;
	const mondayDoy = Math.floor((monday.getTime() - startOfYear.getTime()) / oneDay);
	const sundayDoy = mondayDoy + 6;

	const result = await db
		.prepare('SELECT * FROM entries WHERE day_of_year BETWEEN ? AND ? ORDER BY day_of_year')
		.bind(mondayDoy, sundayDoy)
		.all<StoicEntry>();

	return result.results ?? [];
}
