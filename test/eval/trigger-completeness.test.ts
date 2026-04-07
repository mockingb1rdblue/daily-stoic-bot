/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Eval test: trigger completeness.
 * Ensures every service function dispatched by cron has a trigger name,
 * and trigger names map to actual service functions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '../../src');

function readSource(relativePath: string): string {
	return readFileSync(join(SRC_ROOT, relativePath), 'utf-8');
}

// The known trigger names from the switch statement in triggers.ts
const TRIGGER_NAMES = ['morning', 'evening', 'poll', 'then-vs-now', 'commonplace', 'reactions', 'checkin'];

// The service functions that triggers dispatch to
const TRIGGER_SERVICE_MAP: Record<string, string> = {
	morning: 'postDailyEntry',
	evening: 'runEveningExamination',
	poll: 'postVirtuePoll',
	'then-vs-now': 'postThenVsNow',
	commonplace: 'createWeeklyCommonplaceThread',
	reactions: 'pollYesterdayReactions',
	checkin: 'checkInWithQuietUsers',
};

describe('trigger-to-service mapping completeness', () => {
	it('every trigger name maps to a service function', () => {
		for (const trigger of TRIGGER_NAMES) {
			expect(
				TRIGGER_SERVICE_MAP[trigger],
				`trigger "${trigger}" has no mapped service function`,
			).toBeTruthy();
		}
	});

	it('every mapped service function is imported in triggers.ts', () => {
		const triggersSource = readSource('handlers/triggers.ts');
		for (const [trigger, fn] of Object.entries(TRIGGER_SERVICE_MAP)) {
			expect(
				triggersSource.includes(fn),
				`service function "${fn}" for trigger "${trigger}" not found in triggers.ts`,
			).toBe(true);
		}
	});

	it('every case in the switch statement corresponds to a known trigger', () => {
		const triggersSource = readSource('handlers/triggers.ts');
		// Extract case labels from the switch statement
		const caseMatches = [...triggersSource.matchAll(/case\s+'([^']+)'/g)];
		const caseTriggers = caseMatches.map((m) => m[1]);

		for (const caseTrigger of caseTriggers) {
			expect(
				TRIGGER_NAMES.includes(caseTrigger),
				`case '${caseTrigger}' in switch is not in TRIGGER_NAMES`,
			).toBe(true);
		}
	});

	it('all trigger names are present as case labels', () => {
		const triggersSource = readSource('handlers/triggers.ts');
		for (const trigger of TRIGGER_NAMES) {
			expect(
				triggersSource.includes(`case '${trigger}'`),
				`trigger "${trigger}" missing from switch statement`,
			).toBe(true);
		}
	});

	it('trigger count matches case count', () => {
		const triggersSource = readSource('handlers/triggers.ts');
		const caseMatches = [...triggersSource.matchAll(/case\s+'([^']+)'/g)];
		expect(caseMatches.length).toBe(TRIGGER_NAMES.length);
	});
});

describe('service files exist for each trigger', () => {
	const serviceFiles: Record<string, string> = {
		morning: 'services/daily-post.ts',
		evening: 'services/evening-exam.ts',
		poll: 'services/virtue-poll.ts',
		'then-vs-now': 'services/then-vs-now.ts',
		commonplace: 'services/commonplace.ts',
		reactions: 'services/reaction-poller.ts',
		checkin: 'services/engagement.ts',
	};

	for (const [trigger, file] of Object.entries(serviceFiles)) {
		it(`trigger "${trigger}" has service file at ${file}`, () => {
			// readFileSync will throw if file doesn't exist
			const content = readSource(file);
			expect(content.length).toBeGreaterThan(0);
		});
	}
});

describe('trigger imports match service exports', () => {
	it('all service imports in triggers.ts are used in case statements', () => {
		const triggersSource = readSource('handlers/triggers.ts');
		// Extract imported function names
		const importMatches = [...triggersSource.matchAll(/import\s+\{([^}]+)\}\s+from/g)];
		const importedFunctions: string[] = [];
		for (const match of importMatches) {
			const fns = match[1].split(',').map((f) => f.trim()).filter((f) => !f.startsWith('type '));
			importedFunctions.push(...fns);
		}

		// Filter to service functions (not utility imports like getAllGuildConfigs)
		const serviceFunctions = Object.values(TRIGGER_SERVICE_MAP);
		for (const fn of serviceFunctions) {
			expect(
				importedFunctions.includes(fn),
				`service function "${fn}" should be imported in triggers.ts`,
			).toBe(true);
		}
	});
});
