/**
 * Unit tests for trigger name routing.
 * Validates the set of known trigger names and ensures unknown triggers are rejected.
 */

import { describe, it, expect } from 'vitest';

const VALID_TRIGGER_NAMES = [
	'morning',
	'evening',
	'poll',
	'then-vs-now',
	'commonplace',
	'reactions',
	'checkin',
];

// Replicate the trigger routing logic (switch statement) as a validator
function isValidTrigger(name: string): boolean {
	return VALID_TRIGGER_NAMES.includes(name);
}

describe('trigger names', () => {
	it('has exactly 7 valid triggers', () => {
		expect(VALID_TRIGGER_NAMES).toHaveLength(7);
	});

	it.each(VALID_TRIGGER_NAMES)('"%s" is a valid trigger', (name) => {
		expect(isValidTrigger(name)).toBe(true);
	});

	it('unknown trigger "daily" is not valid', () => {
		expect(isValidTrigger('daily')).toBe(false);
	});

	it('unknown trigger "weekly" is not valid', () => {
		expect(isValidTrigger('weekly')).toBe(false);
	});

	it('unknown trigger "" (empty string) is not valid', () => {
		expect(isValidTrigger('')).toBe(false);
	});

	it('trigger names are all lowercase', () => {
		for (const name of VALID_TRIGGER_NAMES) {
			expect(name).toBe(name.toLowerCase());
		}
	});

	it('trigger names contain no spaces', () => {
		for (const name of VALID_TRIGGER_NAMES) {
			expect(name).not.toContain(' ');
		}
	});

	it('includes morning (daily post)', () => {
		expect(VALID_TRIGGER_NAMES).toContain('morning');
	});

	it('includes evening (examination)', () => {
		expect(VALID_TRIGGER_NAMES).toContain('evening');
	});

	it('includes poll (virtue poll)', () => {
		expect(VALID_TRIGGER_NAMES).toContain('poll');
	});

	it('includes then-vs-now', () => {
		expect(VALID_TRIGGER_NAMES).toContain('then-vs-now');
	});

	it('includes commonplace (weekly thread)', () => {
		expect(VALID_TRIGGER_NAMES).toContain('commonplace');
	});

	it('includes reactions (reaction poller)', () => {
		expect(VALID_TRIGGER_NAMES).toContain('reactions');
	});

	it('includes checkin (quiet user check-in)', () => {
		expect(VALID_TRIGGER_NAMES).toContain('checkin');
	});
});
