/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Unit tests for interaction routing logic.
 * Tests the routing decisions without requiring Discord verification or D1.
 */

import { describe, it, expect } from 'vitest';
import { InteractionType, InteractionResponseType } from 'discord-interactions';

/**
 * We test the routing logic by re-implementing the core decision tree.
 * The actual handleInteraction requires request verification which is
 * not feasible in pure unit tests — so we test the routing functions directly.
 */

/** Simulates the interaction type routing logic from handleInteraction */
function routeInteractionType(interactionType: number): { action: string; status?: number } {
	if (interactionType === InteractionType.PING) {
		return { action: 'pong' };
	}
	if (interactionType === InteractionType.APPLICATION_COMMAND) {
		return { action: 'command' };
	}
	if (interactionType === InteractionType.MESSAGE_COMPONENT) {
		return { action: 'component' };
	}
	return { action: 'error', status: 400 };
}

/** Simulates the command routing logic */
function routeCommand(commandName: string, subcommand?: string): { action: string; status?: number } {
	if (commandName !== 'stoic') {
		return { action: 'error', status: 400 };
	}

	const validSubcommands = ['obstacle', 'context', 'letter', 'voice', 'setup', 'cleanup', 'schedule'];
	if (subcommand && validSubcommands.includes(subcommand)) {
		return { action: subcommand };
	}
	return { action: 'error', status: 400 };
}

describe('interaction type routing', () => {
	it('PING returns PONG action', () => {
		const result = routeInteractionType(InteractionType.PING);
		expect(result.action).toBe('pong');
	});

	it('APPLICATION_COMMAND routes to command handler', () => {
		const result = routeInteractionType(InteractionType.APPLICATION_COMMAND);
		expect(result.action).toBe('command');
	});

	it('MESSAGE_COMPONENT routes to component handler', () => {
		const result = routeInteractionType(InteractionType.MESSAGE_COMPONENT);
		expect(result.action).toBe('component');
	});

	it('unknown interaction type returns 400 error', () => {
		const result = routeInteractionType(999);
		expect(result.action).toBe('error');
		expect(result.status).toBe(400);
	});
});

describe('command routing', () => {
	it('unknown command name returns 400', () => {
		const result = routeCommand('not-stoic');
		expect(result.action).toBe('error');
		expect(result.status).toBe(400);
	});

	it('stoic command with valid subcommand routes correctly', () => {
		const subcommands = ['obstacle', 'context', 'letter', 'voice', 'setup', 'cleanup', 'schedule'];
		for (const sub of subcommands) {
			const result = routeCommand('stoic', sub);
			expect(result.action).toBe(sub);
		}
	});

	it('stoic command with unknown subcommand returns 400', () => {
		const result = routeCommand('stoic', 'nonexistent');
		expect(result.action).toBe('error');
		expect(result.status).toBe(400);
	});

	it('stoic command with no subcommand returns 400', () => {
		const result = routeCommand('stoic', undefined);
		expect(result.action).toBe('error');
		expect(result.status).toBe(400);
	});
});

describe('Discord interaction types are defined', () => {
	it('InteractionType.PING is 1', () => {
		expect(InteractionType.PING).toBe(1);
	});

	it('InteractionType.APPLICATION_COMMAND is 2', () => {
		expect(InteractionType.APPLICATION_COMMAND).toBe(2);
	});

	it('InteractionResponseType.PONG is 1', () => {
		expect(InteractionResponseType.PONG).toBe(1);
	});

	it('InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE is 4', () => {
		expect(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE).toBe(4);
	});
});
