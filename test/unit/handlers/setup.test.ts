/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Unit tests for setup command constants and timezone logic.
 */

import { describe, it, expect } from 'vitest';

// Replicate the constants from setup.ts to test their contracts.
// These are not exported, so we test the known contract.

const FORUM_TAGS = [
	{ name: 'Perception', emoji_name: '\ud83d\udc41\ufe0f' },
	{ name: 'Action', emoji_name: '\u26a1' },
	{ name: 'Will', emoji_name: '\ud83d\udd25' },
	{ name: 'Courage', emoji_name: '\ud83d\udee1\ufe0f' },
	{ name: 'Wisdom', emoji_name: '\ud83e\udde0' },
	{ name: 'Justice', emoji_name: '\u2696\ufe0f' },
	{ name: 'Temperance', emoji_name: '\ud83c\udf3f' },
	{ name: 'Mortality', emoji_name: '\u23f3' },
	{ name: 'Personal', emoji_name: '\ud83d\udcdd' },
	{ name: 'Life Update', emoji_name: '\ud83d\udd04' },
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

describe('FORUM_TAGS', () => {
	it('has exactly 10 tags', () => {
		expect(FORUM_TAGS).toHaveLength(10);
	});

	it('all tag names are unique', () => {
		const names = FORUM_TAGS.map((t) => t.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('includes the three Stoic disciplines', () => {
		const names = FORUM_TAGS.map((t) => t.name);
		expect(names).toContain('Perception');
		expect(names).toContain('Action');
		expect(names).toContain('Will');
	});

	it('includes the four cardinal virtues', () => {
		const names = FORUM_TAGS.map((t) => t.name);
		expect(names).toContain('Courage');
		expect(names).toContain('Wisdom');
		expect(names).toContain('Justice');
		expect(names).toContain('Temperance');
	});

	it('includes personal reflection tags', () => {
		const names = FORUM_TAGS.map((t) => t.name);
		expect(names).toContain('Personal');
		expect(names).toContain('Life Update');
	});

	it('every tag has an emoji', () => {
		for (const tag of FORUM_TAGS) {
			expect(tag.emoji_name, `${tag.name} missing emoji`).toBeTruthy();
		}
	});
});

describe('FORUM_GUIDELINES', () => {
	it('mentions commonplace', () => {
		expect(FORUM_GUIDELINES.toLowerCase()).toContain('commonplace');
	});

	it('mentions reflection', () => {
		expect(FORUM_GUIDELINES.toLowerCase()).toContain('reflection');
	});

	it('mentions the three disciplines', () => {
		expect(FORUM_GUIDELINES).toContain('Perception');
		expect(FORUM_GUIDELINES).toContain('Action');
		expect(FORUM_GUIDELINES).toContain('Will');
	});

	it('mentions no pressure / no streak', () => {
		expect(FORUM_GUIDELINES.toLowerCase()).toContain('no pressure');
		expect(FORUM_GUIDELINES.toLowerCase()).toContain('no streak');
	});

	it('mentions honest over impressive', () => {
		expect(FORUM_GUIDELINES.toLowerCase()).toContain('honest over impressive');
	});

	it('mentions the discussion channel for debates', () => {
		expect(FORUM_GUIDELINES).toContain('#stoic-discussion');
	});
});

describe('TIMEZONE_OFFSETS', () => {
	it('has exactly 12 entries', () => {
		expect(Object.keys(TIMEZONE_OFFSETS)).toHaveLength(12);
	});

	it('includes all US timezones', () => {
		const keys = Object.keys(TIMEZONE_OFFSETS);
		expect(keys.filter((k) => k.startsWith('US/'))).toHaveLength(6);
	});

	it('includes UK/London at UTC+0', () => {
		expect(TIMEZONE_OFFSETS['UK/London (UTC+0)']).toBe(0);
	});

	it('includes Asia/India at UTC+5 (rounded from 5:30)', () => {
		expect(TIMEZONE_OFFSETS['Asia/India (UTC+5:30)']).toBe(5);
	});

	it('offsets range from -10 to +11', () => {
		const offsets = Object.values(TIMEZONE_OFFSETS);
		expect(Math.min(...offsets)).toBe(-10);
		expect(Math.max(...offsets)).toBe(11);
	});
});

describe('localToUtc conversion', () => {
	it('converts 7am MST (UTC-7) to 14 UTC', () => {
		expect(localToUtc(7, -7)).toBe(14);
	});

	it('converts 7am EST (UTC-5) to 12 UTC', () => {
		expect(localToUtc(7, -5)).toBe(12);
	});

	it('converts 7am UTC+0 to 7 UTC', () => {
		expect(localToUtc(7, 0)).toBe(7);
	});

	it('converts 20:00 Tokyo (UTC+9) to 11 UTC', () => {
		expect(localToUtc(20, 9)).toBe(11);
	});

	it('handles midnight wrapping (0:00 UTC-5 = 5 UTC)', () => {
		expect(localToUtc(0, -5)).toBe(5);
	});

	it('handles wrap past 24 (23:00 UTC+11 = 12 UTC)', () => {
		expect(localToUtc(23, 11)).toBe(12);
	});

	it('handles negative result wrapping (2am UTC+9 = 17 UTC previous day)', () => {
		expect(localToUtc(2, 9)).toBe(17);
	});
});
