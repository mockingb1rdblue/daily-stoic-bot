/**
 * Discord REST API helper functions.
 * Bot token is stored in KV for secure secret management.
 */

const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface DiscordApiOptions {
	method?: string;
	body?: unknown;
}

interface DiscordMessage {
	id: string;
	channel_id: string;
	content: string;
	[key: string]: unknown;
}

interface DiscordThread {
	id: string;
	name: string;
	[key: string]: unknown;
}

/**
 * Base function for Discord REST API calls.
 * Reads the bot token from KV on each call.
 */
export async function discordApi(
	env: Env,
	path: string,
	method = 'GET',
	body?: unknown,
): Promise<unknown> {
	const botToken = await env.SECRETS_KV.get('STOIC_DISCORD_BOT_TOKEN');
	if (!botToken) {
		throw new Error('STOIC_DISCORD_BOT_TOKEN not found in KV');
	}

	const options: RequestInit = {
		method,
		headers: {
			Authorization: `Bot ${botToken}`,
			'Content-Type': 'application/json',
		},
	};

	if (body && method !== 'GET') {
		options.body = JSON.stringify(body);
	}

	const response = await fetch(`${DISCORD_API_BASE}${path}`, options);

	if (!response.ok) {
		const errorText = await response.text();
		console.error({
			event: 'discord_api_error',
			component: 'discord',
			message: `Discord API ${method} ${path} failed: ${response.status}`,
			detail: errorText,
		});
		throw new Error(`Discord API error ${response.status}: ${errorText}`);
	}

	// Some endpoints return 204 No Content
	if (response.status === 204) {
		return null;
	}

	return response.json();
}

/**
 * Post a message to a Discord channel.
 */
export async function postMessage(
	env: Env,
	channelId: string,
	content: string | object,
): Promise<DiscordMessage> {
	const body = typeof content === 'string' ? { content } : content;
	return (await discordApi(env, `/channels/${channelId}/messages`, 'POST', body)) as DiscordMessage;
}

/**
 * Create a thread from an existing message.
 */
export async function createThread(
	env: Env,
	channelId: string,
	messageId: string,
	name: string,
): Promise<DiscordThread> {
	return (await discordApi(
		env,
		`/channels/${channelId}/messages/${messageId}/threads`,
		'POST',
		{
			name: name.slice(0, 100), // Discord thread name limit
			auto_archive_duration: 1440, // 24 hours
		},
	)) as DiscordThread;
}

/**
 * Post a message in a thread.
 */
export async function postInThread(
	env: Env,
	threadId: string,
	content: string | object,
): Promise<DiscordMessage> {
	const body = typeof content === 'string' ? { content } : content;
	return (await discordApi(env, `/channels/${threadId}/messages`, 'POST', body)) as DiscordMessage;
}

/**
 * Add a user to a thread.
 */
export async function addThreadMember(
	env: Env,
	threadId: string,
	userId: string,
): Promise<void> {
	await discordApi(env, `/channels/${threadId}/thread-members/${userId}`, 'PUT');
}

/** Discord channel types */
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_CATEGORY = 4;
const CHANNEL_TYPE_FORUM = 15;

/** Create a channel category in a guild */
export async function createCategory(
	env: Env,
	guildId: string,
	name: string,
): Promise<{ id: string }> {
	return (await discordApi(env, `/guilds/${guildId}/channels`, 'POST', {
		name,
		type: CHANNEL_TYPE_CATEGORY,
	})) as { id: string };
}

/** Create a text channel under a category */
export async function createTextChannel(
	env: Env,
	guildId: string,
	name: string,
	categoryId: string,
	topic?: string,
): Promise<{ id: string }> {
	return (await discordApi(env, `/guilds/${guildId}/channels`, 'POST', {
		name,
		type: CHANNEL_TYPE_TEXT,
		parent_id: categoryId,
		topic: topic ?? null,
	})) as { id: string };
}

/** Add a reaction to a message. Emoji must be URL-encoded for custom, or unicode for built-in. */
export async function addReaction(
	env: Env,
	channelId: string,
	messageId: string,
	emoji: string,
): Promise<void> {
	await discordApi(env, `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, 'PUT');
}

/** Send a DM to a user. Creates a DM channel first, then sends the message. */
export async function sendDM(
	env: Env,
	userId: string,
	content: string | object,
): Promise<void> {
	const dmChannel = (await discordApi(env, '/users/@me/channels', 'POST', {
		recipient_id: userId,
	})) as { id: string };
	const body = typeof content === 'string' ? { content } : content;
	await discordApi(env, `/channels/${dmChannel.id}/messages`, 'POST', body);
}

/**
 * Edit the original response to a deferred interaction.
 * Used after returning type 5 (DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE).
 * This endpoint authenticates via the interaction token, not Bot token.
 */
export async function editOriginalResponse(
	appId: string,
	interactionToken: string,
	content: string | object,
): Promise<void> {
	const body = typeof content === 'string' ? { content } : content;
	const url = `${DISCORD_API_BASE}/webhooks/${appId}/${interactionToken}/messages/@original`;

	const response = await fetch(url, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error({
			event: 'edit_original_response_error',
			component: 'discord',
			message: `Failed to edit original response: ${response.status}`,
			detail: errorText,
		});
		throw new Error(`Failed to edit original response: ${response.status} ${errorText}`);
	}
}

/** Delete a channel (used for cleanup) */
export async function deleteChannel(
	env: Env,
	channelId: string,
): Promise<void> {
	await discordApi(env, `/channels/${channelId}`, 'DELETE');
}
