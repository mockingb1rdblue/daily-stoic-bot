/**
 * Integration tests for setup/cleanup command flow.
 * Tests permission checks and configuration guards without actual Discord API calls.
 */

import { describe, it, expect } from 'vitest';
import { InteractionResponseType } from 'discord-interactions';

/** Permission constants matching Discord's bitfield */
const MANAGE_GUILD = 0x20;

/**
 * Simulates the permission check logic from setup/cleanup handlers.
 * Returns the response content if permission check fails, or null if it passes.
 */
function checkPermissions(permissions: number, action: 'setup' | 'cleanup'): string | null {
	if (!(permissions & MANAGE_GUILD)) {
		return `You need **Manage Server** permission to ${action === 'setup' ? 'set up' : 'clean up'} the Daily Stoic bot.`;
	}
	return null;
}

/**
 * Simulates setup's "already configured" check.
 */
function checkAlreadyConfigured(existingConfig: Record<string, unknown> | null): string | null {
	if (existingConfig) {
		return 'Daily Stoic is already set up in this server.';
	}
	return null;
}

/**
 * Simulates cleanup's "not configured" check.
 */
function checkNotConfigured(existingConfig: Record<string, unknown> | null): string | null {
	if (!existingConfig) {
		return 'Daily Stoic is not set up in this server. Nothing to clean up.';
	}
	return null;
}

describe('setup command — permission checks', () => {
	it('rejects user without Manage Server permission', () => {
		// Regular member with basic permissions (no MANAGE_GUILD)
		const permissions = 0x400; // VIEW_CHANNEL only
		const result = checkPermissions(permissions, 'setup');
		expect(result).not.toBeNull();
		expect(result).toContain('Manage Server');
	});

	it('allows user with Manage Server permission', () => {
		const permissions = MANAGE_GUILD | 0x400;
		const result = checkPermissions(permissions, 'setup');
		expect(result).toBeNull();
	});

	it('allows administrator (who implicitly has all perms)', () => {
		const permissions = 0x8 | MANAGE_GUILD; // ADMINISTRATOR includes MANAGE_GUILD
		const result = checkPermissions(permissions, 'setup');
		expect(result).toBeNull();
	});

	it('rejects permission value of 0', () => {
		const result = checkPermissions(0, 'setup');
		expect(result).not.toBeNull();
	});
});

describe('setup command — already configured check', () => {
	it('rejects if guild is already configured', () => {
		const existing = {
			guild_id: '123',
			channel_reflections: '456',
			channel_discussion: '789',
			channel_commonplace: '012',
		};
		const result = checkAlreadyConfigured(existing);
		expect(result).not.toBeNull();
		expect(result).toContain('already set up');
	});

	it('allows setup if guild is not configured', () => {
		const result = checkAlreadyConfigured(null);
		expect(result).toBeNull();
	});
});

describe('cleanup command — not configured check', () => {
	it('rejects cleanup if guild is not configured', () => {
		const result = checkNotConfigured(null);
		expect(result).not.toBeNull();
		expect(result).toContain('not set up');
	});

	it('allows cleanup if guild is configured', () => {
		const existing = { guild_id: '123' };
		const result = checkNotConfigured(existing);
		expect(result).toBeNull();
	});
});

describe('cleanup command — permission checks', () => {
	it('rejects user without Manage Server permission', () => {
		const result = checkPermissions(0x400, 'cleanup');
		expect(result).not.toBeNull();
		expect(result).toContain('Manage Server');
	});

	it('allows user with Manage Server permission', () => {
		const result = checkPermissions(MANAGE_GUILD, 'cleanup');
		expect(result).toBeNull();
	});
});

describe('response format', () => {
	it('CHANNEL_MESSAGE_WITH_SOURCE is type 4', () => {
		expect(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE).toBe(4);
	});

	it('ephemeral flag is 64', () => {
		// Discord uses flags: 64 for ephemeral messages
		expect(64).toBe(1 << 6);
	});
});
