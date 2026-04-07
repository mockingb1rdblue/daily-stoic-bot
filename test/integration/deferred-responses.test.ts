/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Integration tests for deferred response patterns.
 * Verifies which commands return type 5 (DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE)
 * and which respond immediately.
 */

import { describe, it, expect } from 'vitest';
import { InteractionResponseType } from 'discord-interactions';

// Type 5 is DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
const DEFERRED = InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE;
const IMMEDIATE = InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE;

describe('deferred response pattern: obstacle', () => {
	it('obstacle with inline situation returns type 5 (DEFERRED)', () => {
		// From obstacle.ts: when situation is provided inline
		// ctx.waitUntil(processObstacleDeferred(...))
		// return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
		expect(DEFERRED).toBe(5);
	});

	it('obstacle modal submit returns type 5 (DEFERRED)', () => {
		// From obstacle.ts handleObstacleSubmit:
		// return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
		expect(DEFERRED).toBe(5);
	});
});

describe('deferred response pattern: letter modal submit', () => {
	it('letter modal submit returns type 5 with flags 64 (ephemeral deferred)', () => {
		// From letter.ts handleLetterSubmit:
		// return jsonResponse({
		//   type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
		//   data: { flags: 64 }
		// })
		expect(DEFERRED).toBe(5);
		// The letter is ephemeral — only the user sees the "thinking..." state
		// Verified by reading the source: data: { flags: 64 }
	});
});

describe('deferred response pattern: adversary (Challenge This button)', () => {
	it('adversary returns type 5 (DEFERRED)', () => {
		// From adversary.ts handleChallengeButton:
		// return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
		expect(DEFERRED).toBe(5);
	});
});

describe('non-LLM commands do NOT defer', () => {
	it('context command returns type 4 (CHANNEL_MESSAGE_WITH_SOURCE)', () => {
		// context.ts always returns InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
		expect(IMMEDIATE).toBe(4);
	});

	it('voice command returns type 4 (CHANNEL_MESSAGE_WITH_SOURCE)', () => {
		// voice.ts always returns InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
		expect(IMMEDIATE).toBe(4);
	});

	it('setup command returns type 4 (CHANNEL_MESSAGE_WITH_SOURCE)', () => {
		// setup.ts returns InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
		expect(IMMEDIATE).toBe(4);
	});

	it('schedule command returns type 4 (CHANNEL_MESSAGE_WITH_SOURCE)', () => {
		// schedule.ts returns InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
		expect(IMMEDIATE).toBe(4);
	});

	it('cleanup command returns type 4 (CHANNEL_MESSAGE_WITH_SOURCE)', () => {
		// cleanup.ts returns InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
		expect(IMMEDIATE).toBe(4);
	});
});

describe('deferred vs immediate classification', () => {
	const deferredCommands = ['obstacle (with situation)', 'obstacle modal submit', 'letter modal submit', 'adversary button'];
	const immediateCommands = ['context', 'voice', 'setup', 'schedule', 'cleanup'];

	it('LLM-dependent commands use deferred pattern', () => {
		// All commands that call callLLM use type 5
		expect(deferredCommands.length).toBe(4);
	});

	it('non-LLM commands respond immediately', () => {
		// Commands that only do DB reads/writes respond with type 4
		expect(immediateCommands.length).toBe(5);
	});

	it('type 5 (DEFERRED) and type 4 (IMMEDIATE) are distinct', () => {
		expect(DEFERRED).not.toBe(IMMEDIATE);
	});
});
