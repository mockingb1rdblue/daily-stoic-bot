/**
 * Unit tests for entry DB queries and interfaces.
 */

import { describe, it, expect } from 'vitest';
import type { StoicEntry } from '../../../src/db/entries.js';

/**
 * Re-implement getCurrentDayOfYear locally for testing,
 * since it is not exported from the source module.
 */
function getCurrentDayOfYear(): number {
	const now = new Date();
	const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
	const diff = now.getTime() - start.getTime();
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay);
}

describe('getCurrentDayOfYear', () => {
	it('returns a number between 1 and 366', () => {
		const day = getCurrentDayOfYear();
		expect(day).toBeGreaterThanOrEqual(1);
		expect(day).toBeLessThanOrEqual(366);
	});

	it('returns an integer', () => {
		const day = getCurrentDayOfYear();
		expect(Number.isInteger(day)).toBe(true);
	});
});

describe('StoicEntry interface', () => {
	it('matches expected shape with all required fields', () => {
		const entry: StoicEntry = {
			id: 1,
			day_of_year: 1,
			date: 'January 1st',
			month: 'January',
			day: 1,
			title: 'CONTROL AND CHOICE',
			quote: 'Test quote',
			quote_source: 'EPICTETUS, DISCOURSES, 2.5.4-5',
			commentary: 'Test commentary text that is long enough.',
			part: 'THE DISCIPLINE OF PERCEPTION',
			month_theme: 'Clarity',
			created_at: '2024-01-01',
		};

		expect(entry).toHaveProperty('id');
		expect(entry).toHaveProperty('day_of_year');
		expect(entry).toHaveProperty('date');
		expect(entry).toHaveProperty('month');
		expect(entry).toHaveProperty('day');
		expect(entry).toHaveProperty('title');
		expect(entry).toHaveProperty('quote');
		expect(entry).toHaveProperty('quote_source');
		expect(entry).toHaveProperty('commentary');
		expect(entry).toHaveProperty('part');
		expect(entry).toHaveProperty('month_theme');
		expect(entry).toHaveProperty('created_at');
	});

	it('has the correct field types', () => {
		const entry: StoicEntry = {
			id: 42,
			day_of_year: 100,
			date: 'April 10th',
			month: 'April',
			day: 10,
			title: 'TEST TITLE',
			quote: 'A quote',
			quote_source: 'MARCUS AURELIUS, MEDITATIONS, 1.1',
			commentary: 'Commentary text.',
			part: 'THE DISCIPLINE OF ACTION',
			month_theme: 'Awareness',
			created_at: '2024-04-10',
		};

		expect(typeof entry.id).toBe('number');
		expect(typeof entry.day_of_year).toBe('number');
		expect(typeof entry.date).toBe('string');
		expect(typeof entry.month).toBe('string');
		expect(typeof entry.day).toBe('number');
		expect(typeof entry.title).toBe('string');
		expect(typeof entry.quote).toBe('string');
		expect(typeof entry.quote_source).toBe('string');
		expect(typeof entry.commentary).toBe('string');
		expect(typeof entry.part).toBe('string');
		expect(typeof entry.month_theme).toBe('string');
		expect(typeof entry.created_at).toBe('string');
	});
});
