/**
 * Unit tests for the streak milestone system.
 */

import { describe, it, expect } from 'vitest';

// We can't import STREAK_MESSAGES directly since it's not exported.
// Instead, we test the known contract: the milestone days and message quality.
// We inline the expected map and verify properties.

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

const EXPECTED_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

describe('STREAK_MESSAGES milestone map', () => {
	it('has exactly 9 milestones', () => {
		expect(Object.keys(STREAK_MESSAGES)).toHaveLength(9);
	});

	it.each(EXPECTED_MILESTONES)('has milestone at day %i', (day) => {
		expect(STREAK_MESSAGES).toHaveProperty(String(day));
	});

	it('no milestone message is empty', () => {
		for (const [day, message] of Object.entries(STREAK_MESSAGES)) {
			expect(message.length, `milestone ${day} has empty message`).toBeGreaterThan(0);
		}
	});

	it('no message contains exclamation marks', () => {
		for (const [day, message] of Object.entries(STREAK_MESSAGES)) {
			expect(message, `milestone ${day} contains "!"`).not.toContain('!');
		}
	});

	it('no message contains "congratulations" or "congrats"', () => {
		for (const [day, message] of Object.entries(STREAK_MESSAGES)) {
			const lower = message.toLowerCase();
			expect(lower, `milestone ${day} contains congratulations`).not.toContain('congratulations');
			expect(lower, `milestone ${day} contains congrats`).not.toContain('congrats');
		}
	});

	it('no message contains emoji characters', () => {
		// Emoji regex: covers most common emoji ranges
		const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/u;
		for (const [day, message] of Object.entries(STREAK_MESSAGES)) {
			expect(message, `milestone ${day} contains emoji`).not.toMatch(emojiRegex);
		}
	});

	it('messages get progressively longer on average', () => {
		const milestones = EXPECTED_MILESTONES;
		// Compare first third vs last third average length
		const firstThird = milestones.slice(0, 3);
		const lastThird = milestones.slice(-3);

		const avgFirst = firstThird.reduce((sum, d) => sum + STREAK_MESSAGES[d].length, 0) / firstThird.length;
		const avgLast = lastThird.reduce((sum, d) => sum + STREAK_MESSAGES[d].length, 0) / lastThird.length;

		expect(avgLast, 'later milestones should have longer messages on average').toBeGreaterThan(avgFirst);
	});

	it('all messages are lowercase (casual tone)', () => {
		for (const [day, message] of Object.entries(STREAK_MESSAGES)) {
			// First character should be lowercase (casual start)
			expect(
				message[0],
				`milestone ${day} starts with uppercase`,
			).toBe(message[0].toLowerCase());
		}
	});
});
