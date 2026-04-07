/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Data quality evaluation for entries.json.
 * Validates completeness, consistency, and correctness of all 366 daily entries.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface EntryData {
	date: string;
	month: string;
	day: number;
	day_of_year: number;
	title: string;
	quote: string;
	quote_source: string;
	commentary: string;
	part: string;
	month_theme: string;
}

const entriesPath = resolve(__dirname, '../../data/entries.json');
const entries: EntryData[] = JSON.parse(readFileSync(entriesPath, 'utf-8'));

const REQUIRED_FIELDS: (keyof EntryData)[] = [
	'title',
	'quote',
	'quote_source',
	'commentary',
	'month',
	'day',
	'day_of_year',
	'part',
	'month_theme',
];

const KNOWN_PHILOSOPHERS = [
	'EPICTETUS',
	'SENECA',
	'MARCUS AURELIUS',
	'MUSONIUS RUFUS',
	'ZENO',
	'CLEANTHES',
	'CHRYSIPPUS',
	'CATO',
	'POSIDONIUS',
	'HECATO',
	'HIEROCLES',
	'CICERO',
	'PLUTARCH',
	'DIOGENES',
	'HERACLITUS',
	'EPICURUS',
	'SHAKESPEARE',
];

const MONTHS_IN_ORDER = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

const DAYS_PER_MONTH: Record<string, number> = {
	January: 31,
	February: 29, // Leap year support (366 entries)
	March: 31,
	April: 30,
	May: 31,
	June: 30,
	July: 31,
	August: 31,
	September: 30,
	October: 31,
	November: 30,
	December: 31,
};

const EXPECTED_MONTH_THEMES: Record<string, string> = {
	January: 'Clarity',
	February: 'Passions and Emotions',
	March: 'Awareness',
	April: 'Unbiased Thought',
	May: 'Right Action',
	June: 'Problem Solving',
	July: 'Duty',
	August: 'Pragmatism',
	September: 'Fortitude and Resilience',
	October: 'Virtue and Kindness',
	November: 'Acceptance / Amor Fati',
	December: 'Meditation on Mortality',
};

describe('entry count', () => {
	it('has exactly 366 entries', () => {
		expect(entries).toHaveLength(366);
	});
});

describe('required fields', () => {
	it('every entry has all required fields', () => {
		for (const entry of entries) {
			for (const field of REQUIRED_FIELDS) {
				expect(entry, `Entry ${entry.day_of_year} missing ${field}`).toHaveProperty(field);
			}
		}
	});
});

describe('day_of_year sequencing', () => {
	it('day_of_year is sequential 1-366', () => {
		for (let i = 0; i < entries.length; i++) {
			expect(entries[i].day_of_year, `Entry at index ${i}`).toBe(i + 1);
		}
	});
});

describe('no empty strings', () => {
	it('no entry has empty string values in required fields', () => {
		for (const entry of entries) {
			for (const field of REQUIRED_FIELDS) {
				if (typeof entry[field] === 'string') {
					expect(
						(entry[field] as string).trim().length,
						`Entry ${entry.day_of_year} has empty ${field}`,
					).toBeGreaterThan(0);
				}
			}
		}
	});
});

describe('month coverage', () => {
	it('all 12 months are represented', () => {
		const monthsPresent = new Set(entries.map((e) => e.month));
		for (const month of MONTHS_IN_ORDER) {
			expect(monthsPresent.has(month), `Missing month: ${month}`).toBe(true);
		}
	});

	it('each month has the correct number of days', () => {
		for (const month of MONTHS_IN_ORDER) {
			const monthEntries = entries.filter((e) => e.month === month);
			const expected = DAYS_PER_MONTH[month];
			expect(monthEntries.length, `${month} should have ${expected} entries`).toBe(expected);
		}
	});

	it('day numbers within each month are sequential', () => {
		for (const month of MONTHS_IN_ORDER) {
			const monthEntries = entries.filter((e) => e.month === month).sort((a, b) => a.day - b.day);
			for (let i = 0; i < monthEntries.length; i++) {
				expect(monthEntries[i].day, `${month} day ${i + 1}`).toBe(i + 1);
			}
		}
	});
});

describe('quote_source contains known philosopher', () => {
	it('every quote_source references a known philosopher or source', () => {
		for (const entry of entries) {
			const source = entry.quote_source.toUpperCase();
			const hasKnown = KNOWN_PHILOSOPHERS.some((p) => source.includes(p));
			expect(hasKnown, `Entry ${entry.day_of_year} quote_source "${entry.quote_source}" has no known philosopher`).toBe(true);
		}
	});
});

describe('month themes', () => {
	it('each month has the correct month_theme', () => {
		for (const entry of entries) {
			const expectedTheme = EXPECTED_MONTH_THEMES[entry.month];
			expect(
				entry.month_theme,
				`Entry ${entry.day_of_year} (${entry.month}) theme mismatch`,
			).toBe(expectedTheme);
		}
	});
});

describe('commentary quality', () => {
	it('commentary is at least 50 characters for every entry', () => {
		for (const entry of entries) {
			expect(
				entry.commentary.length,
				`Entry ${entry.day_of_year} commentary too short (${entry.commentary.length} chars)`,
			).toBeGreaterThanOrEqual(50);
		}
	});
});

describe('no duplicate titles', () => {
	it('all titles are unique', () => {
		const titles = entries.map((e) => e.title);
		const uniqueTitles = new Set(titles);
		expect(uniqueTitles.size, `Found ${titles.length - uniqueTitles.size} duplicate titles`).toBe(titles.length);
	});
});
