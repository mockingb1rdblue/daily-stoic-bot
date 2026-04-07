/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Unit tests for engagement streak calculation logic.
 * Tests the pure algorithm extracted from getUserStreak — consecutive day counting
 * from a descending-sorted list of engagement days.
 */

import { describe, it, expect } from 'vitest';

/**
 * Pure function equivalent of the getUserStreak algorithm.
 * Given an array of entry_day numbers in descending order, returns the streak count.
 */
function calculateStreak(daysDescending: number[]): number {
	if (daysDescending.length === 0) return 0;

	let streak = 1;
	for (let i = 1; i < daysDescending.length; i++) {
		if (daysDescending[i - 1] - daysDescending[i] === 1) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
}

describe('streak calculation algorithm', () => {
	it('returns 0 for empty engagement', () => {
		expect(calculateStreak([])).toBe(0);
	});

	it('returns 1 for a single day', () => {
		expect(calculateStreak([42])).toBe(1);
	});

	it('returns correct streak for consecutive days', () => {
		// Days 10, 9, 8, 7 in descending order = streak of 4
		expect(calculateStreak([10, 9, 8, 7])).toBe(4);
	});

	it('breaks on gap — day 5, 3 = streak of 1, not 2', () => {
		// Most recent is day 5, then day 3 (gap of 2) — streak is only 1
		expect(calculateStreak([5, 3])).toBe(1);
	});

	it('counts only from most recent — ignores earlier consecutive runs', () => {
		// Days: 20, 18, 17, 16 — most recent is 20, then gap to 18
		// Streak should be 1 (only day 20 is in the streak)
		expect(calculateStreak([20, 18, 17, 16])).toBe(1);
	});

	it('handles a long streak', () => {
		// 30 consecutive days from day 60 down to day 31
		const days = Array.from({ length: 30 }, (_, i) => 60 - i);
		expect(calculateStreak(days)).toBe(30);
	});

	it('handles streak broken in the middle', () => {
		// Days: 10, 9, 8, 6, 5, 4 — streak of 3 (10, 9, 8), then gap before 6
		expect(calculateStreak([10, 9, 8, 6, 5, 4])).toBe(3);
	});

	it('handles two consecutive days', () => {
		expect(calculateStreak([100, 99])).toBe(2);
	});

	it('handles gap of exactly 2 (not consecutive)', () => {
		// 10 and 8 — gap of 2, not consecutive
		expect(calculateStreak([10, 8])).toBe(1);
	});

	it('handles duplicate days (same day engaged twice)', () => {
		// If the same day appears twice, the diff is 0, not 1 — breaks streak
		expect(calculateStreak([5, 5, 4, 3])).toBe(1);
	});

	it('handles year-boundary wrap (day 1 after day 365)', () => {
		// The algorithm uses raw day numbers, so 1 after 365 has diff of 364, not 1
		// This is expected behavior — streaks don't cross year boundaries in this impl
		expect(calculateStreak([1, 365])).toBe(1);
	});
});
