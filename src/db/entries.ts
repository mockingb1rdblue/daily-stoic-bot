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
/**
 * Get the book's day_of_year for today's date.
 * The Daily Stoic has 366 entries (includes Feb 29).
 * In non-leap years, we skip the Feb 29 entry (day 60) so that
 * March 1 always maps to day 61 regardless of leap year.
 */
function getCurrentDayOfYear(): number {
	const now = new Date();
	const month = now.getUTCMonth(); // 0-indexed
	const day = now.getUTCDate();
	const year = now.getUTCFullYear();
	const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

	// Use actual calendar month lengths
	const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	let bookDay = day;
	for (let i = 0; i < month; i++) {
		bookDay += daysInMonth[i];
	}

	// Non-leap years: skip book's Feb 29 (day 60) — after Feb 28 (day 59), jump to day 61
	if (!isLeapYear && bookDay > 59) {
		bookDay += 1;
	}

	return Math.min(bookDay, 366);
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
