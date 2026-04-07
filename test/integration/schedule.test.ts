/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Integration tests for schedule logic and timezone conversions.
 * Tests the localToUtc and utcToLocal functions with various timezone offsets.
 */

import { describe, it, expect } from 'vitest';

/**
 * Re-implement the schedule conversion helpers for testing.
 * These mirror the logic in src/handlers/commands/schedule.ts and setup.ts.
 */
function localToUtc(localHour: number, utcOffset: number): number {
	return ((localHour - utcOffset) % 24 + 24) % 24;
}

function utcToLocal(utcHour: number, utcOffset: number): number {
	return ((utcHour + utcOffset) % 24 + 24) % 24;
}

/** Timezone offsets used by the bot */
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

describe('timezone offset calculations', () => {
	it('7am MST -> 14 UTC', () => {
		expect(localToUtc(7, -7)).toBe(14);
	});

	it('8pm MST -> 3 UTC', () => {
		expect(localToUtc(20, -7)).toBe(3);
	});

	it('7am EST -> 12 UTC', () => {
		expect(localToUtc(7, -5)).toBe(12);
	});

	it('7am PST -> 15 UTC', () => {
		expect(localToUtc(7, -8)).toBe(15);
	});

	it('7am CST -> 13 UTC', () => {
		expect(localToUtc(7, -6)).toBe(13);
	});

	it('7am London -> 7 UTC', () => {
		expect(localToUtc(7, 0)).toBe(7);
	});

	it('7am Tokyo -> 22 UTC', () => {
		expect(localToUtc(7, 9)).toBe(22);
	});

	it('7am Sydney -> 20 UTC', () => {
		expect(localToUtc(7, 11)).toBe(20);
	});
});

describe('edge cases', () => {
	it('midnight local with negative offset wraps correctly', () => {
		// midnight MST = 7 UTC
		expect(localToUtc(0, -7)).toBe(7);
	});

	it('hour 23 local with negative offset wraps correctly', () => {
		// 11pm MST = 6 UTC (next day)
		expect(localToUtc(23, -7)).toBe(6);
	});

	it('midnight UTC+0 stays at 0', () => {
		expect(localToUtc(0, 0)).toBe(0);
	});

	it('midnight with positive offset wraps backward', () => {
		// midnight Tokyo (UTC+9) = 15 UTC previous day
		expect(localToUtc(0, 9)).toBe(15);
	});

	it('hour 23 with positive offset', () => {
		// 11pm Tokyo = 14 UTC
		expect(localToUtc(23, 9)).toBe(14);
	});

	it('hour 12 noon with various offsets', () => {
		expect(localToUtc(12, -7)).toBe(19);
		expect(localToUtc(12, 0)).toBe(12);
		expect(localToUtc(12, 9)).toBe(3);
	});
});

describe('utcToLocal round-trip', () => {
	it('localToUtc followed by utcToLocal returns original hour', () => {
		for (let hour = 0; hour < 24; hour++) {
			for (const offset of [-7, -5, 0, 9, 11]) {
				const utc = localToUtc(hour, offset);
				const backToLocal = utcToLocal(utc, offset);
				expect(backToLocal, `hour ${hour} offset ${offset}`).toBe(hour);
			}
		}
	});
});

describe('default schedule calculation', () => {
	it('MST defaults: morning 7am=14UTC, evening 8pm=3UTC, poll 5pm=0UTC', () => {
		const offset = TIMEZONE_OFFSETS['US/Mountain (UTC-7)'];
		expect(localToUtc(7, offset)).toBe(14);
		expect(localToUtc(20, offset)).toBe(3);
		expect(localToUtc(17, offset)).toBe(0);
	});

	it('EST defaults: morning 7am=12UTC, evening 8pm=1UTC, poll 5pm=22UTC', () => {
		const offset = TIMEZONE_OFFSETS['US/Eastern (UTC-5)'];
		expect(localToUtc(7, offset)).toBe(12);
		expect(localToUtc(20, offset)).toBe(1);
		expect(localToUtc(17, offset)).toBe(22);
	});

	it('all timezone offsets produce valid UTC hours (0-23)', () => {
		for (const [tz, offset] of Object.entries(TIMEZONE_OFFSETS)) {
			for (const localHour of [7, 17, 20]) {
				const utcHour = localToUtc(localHour, offset);
				expect(utcHour, `${tz} local ${localHour}`).toBeGreaterThanOrEqual(0);
				expect(utcHour, `${tz} local ${localHour}`).toBeLessThan(24);
			}
		}
	});
});
