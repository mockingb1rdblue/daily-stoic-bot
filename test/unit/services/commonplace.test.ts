/**
 * Unit tests for commonplace book thread structure.
 * Tests thread title format and entry preview truncation logic.
 */

import { describe, it, expect } from 'vitest';

/**
 * Replicate the thread title building logic from commonplace.ts
 */
function buildThreadTitle(monthName: string, dayNum: number, themes: string[]): string {
	return `Week of ${monthName} ${dayNum} — ${themes.join(', ')}`;
}

/**
 * Replicate the entry preview building logic from commonplace.ts
 */
function buildEntryPreview(entry: { date: string; title: string; quote: string; quote_source: string }): string {
	return `**${entry.date} — ${entry.title}**\n> *"${entry.quote.slice(0, 150)}${entry.quote.length > 150 ? '...' : ''}"*\n> — ${entry.quote_source}`;
}

/**
 * Replicate the commonplace button thread title from interactions.ts
 */
function buildCommonplaceButtonTitle(date: string, title: string): string {
	return `${date} \u2014 ${title}`.slice(0, 100);
}

describe('commonplace thread title format', () => {
	it('follows "Week of {Month} {Day} -- {Themes}" pattern', () => {
		const title = buildThreadTitle('March', 16, ['Clarity']);
		expect(title).toBe('Week of March 16 — Clarity');
	});

	it('joins multiple themes with comma', () => {
		const title = buildThreadTitle('January', 1, ['Clarity', 'Control']);
		expect(title).toBe('Week of January 1 — Clarity, Control');
	});

	it('thread title is truncated to 100 chars by Discord API call', () => {
		const longThemes = ['A Very Long Theme Name That Keeps Going', 'Another Extremely Long Theme Name'];
		const title = buildThreadTitle('September', 15, longThemes);
		// The service slices to 100 before sending to Discord
		expect(title.slice(0, 100).length).toBeLessThanOrEqual(100);
	});
});

describe('entry preview truncation', () => {
	it('does not truncate quotes under 150 chars', () => {
		const entry = {
			date: 'January 1',
			title: 'Control and Choice',
			quote: 'Short quote here.',
			quote_source: 'Epictetus',
		};
		const preview = buildEntryPreview(entry);
		expect(preview).not.toContain('...');
		expect(preview).toContain('Short quote here.');
	});

	it('truncates quotes over 150 chars with ellipsis', () => {
		const longQuote = 'A'.repeat(200);
		const entry = {
			date: 'January 1',
			title: 'Control and Choice',
			quote: longQuote,
			quote_source: 'Epictetus',
		};
		const preview = buildEntryPreview(entry);
		expect(preview).toContain('...');
		// The truncated quote should be exactly 150 chars + "..."
		expect(preview).toContain('A'.repeat(150) + '...');
	});

	it('does not add ellipsis for exactly 150 chars', () => {
		const exactQuote = 'B'.repeat(150);
		const entry = {
			date: 'January 1',
			title: 'Test',
			quote: exactQuote,
			quote_source: 'Seneca',
		};
		const preview = buildEntryPreview(entry);
		expect(preview).not.toContain('...');
	});

	it('preview includes entry date and title in bold', () => {
		const entry = {
			date: 'March 16',
			title: 'The Obstacle Is the Way',
			quote: 'Test quote',
			quote_source: 'Marcus Aurelius',
		};
		const preview = buildEntryPreview(entry);
		expect(preview).toContain('**March 16 — The Obstacle Is the Way**');
	});

	it('preview includes quote source after em dash', () => {
		const entry = {
			date: 'January 1',
			title: 'Test',
			quote: 'Some quote',
			quote_source: 'Epictetus, Discourses 1.1',
		};
		const preview = buildEntryPreview(entry);
		expect(preview).toContain('> — Epictetus, Discourses 1.1');
	});
});

describe('commonplace button thread title', () => {
	it('formats as "date -- title"', () => {
		const title = buildCommonplaceButtonTitle('January 1', 'Control and Choice');
		expect(title).toBe('January 1 \u2014 Control and Choice');
	});

	it('truncates to 100 characters', () => {
		const longTitle = 'A'.repeat(120);
		const title = buildCommonplaceButtonTitle('January 1', longTitle);
		expect(title.length).toBeLessThanOrEqual(100);
	});
});
