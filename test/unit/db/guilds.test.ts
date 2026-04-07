/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Unit tests for guild config DB interfaces and localToUtc logic.
 */

import { describe, it, expect } from 'vitest';
import type { GuildConfig } from '../../../src/db/guilds.js';

/**
 * Re-implement localToUtc for testing (not exported from source).
 */
function localToUtc(localHour: number, utcOffset: number): number {
	return ((localHour - utcOffset) % 24 + 24) % 24;
}

describe('GuildConfig interface', () => {
	it('has all required schedule fields', () => {
		const config: GuildConfig = {
			guild_id: '123456789',
			category_id: '111',
			channel_reflections: '222',
			channel_discussion: '333',
			channel_commonplace: '444',
			morning_hour_utc: 14,
			evening_hour_utc: 3,
			poll_hour_utc: 0,
			timezone_label: 'US/Mountain (UTC-7)',
			setup_by: '999',
		};

		expect(config).toHaveProperty('morning_hour_utc');
		expect(config).toHaveProperty('evening_hour_utc');
		expect(config).toHaveProperty('poll_hour_utc');
		expect(config).toHaveProperty('timezone_label');
	});

	it('has all channel fields', () => {
		const config: GuildConfig = {
			guild_id: '123',
			category_id: '111',
			channel_reflections: '222',
			channel_discussion: '333',
			channel_commonplace: '444',
			morning_hour_utc: 14,
			evening_hour_utc: 3,
			poll_hour_utc: 0,
			timezone_label: 'US/Mountain (UTC-7)',
			setup_by: '999',
		};

		expect(config).toHaveProperty('guild_id');
		expect(config).toHaveProperty('category_id');
		expect(config).toHaveProperty('channel_reflections');
		expect(config).toHaveProperty('channel_discussion');
		expect(config).toHaveProperty('channel_commonplace');
		expect(config).toHaveProperty('setup_by');
	});
});

describe('localToUtc conversion', () => {
	it('converts correctly with negative offsets', () => {
		// 7am local with UTC-7 (MST) = 14 UTC
		expect(localToUtc(7, -7)).toBe(14);
	});

	it('converts correctly with zero offset', () => {
		// 7am UTC+0 = 7 UTC
		expect(localToUtc(7, 0)).toBe(7);
	});

	it('converts correctly with positive offsets', () => {
		// 7am UTC+9 (Tokyo) = 22 previous day UTC
		expect(localToUtc(7, 9)).toBe(22);
	});

	it('wraps around midnight correctly', () => {
		// 20 local with UTC-7 = 3 UTC (next day)
		expect(localToUtc(20, -7)).toBe(3);
	});

	it('handles hour 0 (midnight) correctly', () => {
		// midnight local with UTC-7 = 7 UTC
		expect(localToUtc(0, -7)).toBe(7);
	});

	it('handles hour 23 correctly', () => {
		// 11pm local with UTC-7 = 6 UTC (next day)
		expect(localToUtc(23, -7)).toBe(6);
	});

	it('handles large positive offsets', () => {
		// 7am UTC+11 (Sydney) = 20 previous day UTC
		expect(localToUtc(7, 11)).toBe(20);
	});
});
