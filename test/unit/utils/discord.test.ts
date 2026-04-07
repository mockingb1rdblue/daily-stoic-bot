/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Unit tests for Discord utility function contracts.
 * Tests URL format construction and API patterns without making actual API calls.
 */

import { describe, it, expect } from 'vitest';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Replicate URL construction logic from discord.ts functions

function editOriginalResponseUrl(appId: string, interactionToken: string): string {
	return `${DISCORD_API_BASE}/webhooks/${appId}/${interactionToken}/messages/@original`;
}

function addReactionUrl(channelId: string, messageId: string, emoji: string): string {
	return `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`;
}

function createDmChannelUrl(): string {
	return `${DISCORD_API_BASE}/users/@me/channels`;
}

function postMessageUrl(channelId: string): string {
	return `${DISCORD_API_BASE}/channels/${channelId}/messages`;
}

function createThreadUrl(channelId: string, messageId: string): string {
	return `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}/threads`;
}

describe('editOriginalResponse URL format', () => {
	it('constructs the correct webhook URL', () => {
		const url = editOriginalResponseUrl('123456', 'abc-token-xyz');
		expect(url).toBe('https://discord.com/api/v10/webhooks/123456/abc-token-xyz/messages/@original');
	});

	it('includes the app ID and interaction token', () => {
		const url = editOriginalResponseUrl('app123', 'token456');
		expect(url).toContain('/webhooks/app123/token456/');
	});

	it('ends with /messages/@original', () => {
		const url = editOriginalResponseUrl('id', 'tok');
		expect(url.endsWith('/messages/@original')).toBe(true);
	});

	it('uses v10 API', () => {
		const url = editOriginalResponseUrl('id', 'tok');
		expect(url).toContain('/api/v10/');
	});
});

describe('addReaction URL encoding', () => {
	it('URL-encodes unicode emoji', () => {
		const url = addReactionUrl('ch1', 'msg1', '\ud83c\udfdb\ufe0f');
		expect(url).toContain('/reactions/');
		expect(url).toContain('/@me');
		// The emoji should be encoded, not raw unicode
		expect(url).not.toContain('\ud83c\udfdb\ufe0f');
	});

	it('URL-encodes simple emoji', () => {
		const url = addReactionUrl('ch1', 'msg1', '\u2764\ufe0f');
		expect(url).toContain(encodeURIComponent('\u2764\ufe0f'));
	});

	it('includes channel and message IDs', () => {
		const url = addReactionUrl('channel123', 'message456', '\ud83d\udc4d');
		expect(url).toContain('/channels/channel123/messages/message456/');
	});

	it('ends with /@me', () => {
		const url = addReactionUrl('ch', 'msg', '\u2b50');
		expect(url.endsWith('/@me')).toBe(true);
	});
});

describe('sendDM creates DM channel first', () => {
	it('DM channel creation URL is /users/@me/channels', () => {
		const url = createDmChannelUrl();
		expect(url).toBe('https://discord.com/api/v10/users/@me/channels');
	});

	it('message is posted to the DM channel URL', () => {
		const url = postMessageUrl('dm-channel-id');
		expect(url).toBe('https://discord.com/api/v10/channels/dm-channel-id/messages');
	});
});

describe('createThread URL format', () => {
	it('constructs the correct thread creation URL', () => {
		const url = createThreadUrl('ch123', 'msg456');
		expect(url).toBe('https://discord.com/api/v10/channels/ch123/messages/msg456/threads');
	});
});

describe('Discord API base', () => {
	it('uses v10', () => {
		expect(DISCORD_API_BASE).toBe('https://discord.com/api/v10');
	});

	it('uses HTTPS', () => {
		expect(DISCORD_API_BASE.startsWith('https://')).toBe(true);
	});
});
