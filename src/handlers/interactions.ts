/**
 * Discord interaction handler.
 * Routes incoming Discord interactions to appropriate command or component handlers.
 */

import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { verifyDiscordRequest } from '../utils/verify.js';
import { errorResponse, jsonResponse } from '../utils/json.js';
import { handleObstacle, handleObstacleSubmit } from './commands/obstacle.js';
import { handleContext } from './commands/context.js';
import { handleLetter, handleLetterSubmit } from './commands/letter.js';
import { handleVoice } from './commands/voice.js';
import { handleSetup } from './commands/setup.js';
import { handleCleanup } from './commands/cleanup.js';
import { handleHelp } from './commands/help.js';
import { handleSchedule } from './commands/schedule.js';
import { handleTrigger } from './commands/trigger.js';
import { handleChallengeButton } from '../services/adversary.js';
import { getGuildConfig } from '../db/guilds.js';
import { getEntryByDayOfYear } from '../db/entries.js';
import { discordApi } from '../utils/discord.js';

/**
 * Handle an incoming Discord interaction request.
 * Verifies the signature, then routes by interaction type.
 */
export async function handleInteraction(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const { isValid, interaction } = await verifyDiscordRequest(request, env);

	if (!isValid || !interaction) {
		return errorResponse('Invalid request signature', 401);
	}

	const interactionType = interaction.type as number;

	// Handle PING (type 1) — Discord verification handshake
	if (interactionType === InteractionType.PING) {
		return jsonResponse({ type: InteractionResponseType.PONG });
	}

	// Handle APPLICATION_COMMAND (type 2)
	if (interactionType === InteractionType.APPLICATION_COMMAND) {
		return handleCommand(interaction, env, ctx);
	}

	// Handle MESSAGE_COMPONENT (type 3) — button clicks, select menus
	if (interactionType === InteractionType.MESSAGE_COMPONENT) {
		return handleComponent(interaction, env, ctx);
	}

	// Handle MODAL_SUBMIT (type 5) — modal form submissions
	if (interactionType === InteractionType.MODAL_SUBMIT) {
		return handleModalSubmit(interaction, env, ctx);
	}

	console.error({
		event: 'unknown_interaction_type',
		component: 'handlers.interactions',
		message: `Unhandled interaction type: ${interactionType}`,
	});

	return errorResponse('Unknown interaction type', 400);
}

/**
 * Route application commands to their handlers.
 * All commands are under the "stoic" command group.
 */
async function handleCommand(
	interaction: Record<string, unknown>,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const data = interaction.data as Record<string, unknown>;
	const commandName = data.name as string;

	if (commandName !== 'stoic') {
		return errorResponse(`Unknown command: ${commandName}`, 400);
	}

	// The "stoic" command has subcommands — find which one was used
	const options = data.options as Array<Record<string, unknown>> | undefined;
	const subcommand = options?.[0]?.name as string | undefined;

	switch (subcommand) {
		case 'obstacle':
			return handleObstacle(interaction, env, ctx);
		case 'context':
			return handleContext(interaction, env);
		case 'letter':
			return handleLetter(interaction, env, ctx);
		case 'voice':
			return handleVoice(interaction, env);
		case 'setup':
			return handleSetup(interaction, env);
		case 'cleanup':
			return handleCleanup(interaction, env);
		case 'schedule':
			return handleSchedule(interaction, env);
		case 'trigger':
			return handleTrigger(interaction, env, ctx);
		case 'help':
			return handleHelp(interaction, env);
		default:
			console.error({
				event: 'unknown_subcommand',
				component: 'handlers.interactions',
				message: `Unknown subcommand: ${subcommand}`,
			});
			return errorResponse(`Unknown subcommand: ${subcommand}`, 400);
	}
}

/**
 * Route message component interactions (buttons, selects).
 */
async function handleComponent(
	interaction: Record<string, unknown>,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const data = interaction.data as Record<string, unknown>;
	const customId = data.custom_id as string;

	// "Challenge This" button: custom_id format is "challenge_{day_of_year}"
	if (customId.startsWith('challenge_')) {
		return handleChallengeButton(interaction, env, ctx);
	}

	// "Reflect" button: opens a modal for quick reflection
	if (customId.startsWith('reflect_')) {
		return handleReflectButton(interaction);
	}

	// "Save to Commonplace" button: creates a forum thread
	if (customId.startsWith('commonplace_')) {
		return handleCommonplaceButton(interaction, env);
	}

	console.error({
		event: 'unknown_component',
		component: 'handlers.interactions',
		message: `Unhandled component custom_id: ${customId}`,
	});

	return errorResponse(`Unknown component: ${customId}`, 400);
}

/**
 * Handle the "Reflect" button click.
 * Opens a modal with a text input for quick reflection.
 */
function handleReflectButton(interaction: Record<string, unknown>): Response {
	const data = interaction.data as Record<string, unknown>;
	const customId = data.custom_id as string;
	const dayOfYear = parseInt(customId.replace('reflect_', ''), 10);

	return jsonResponse({
		type: InteractionResponseType.MODAL,
		data: {
			custom_id: `modal_reflect_${dayOfYear}`,
			title: 'Quick Reflection',
			components: [
				{
					type: 1, // Action Row
					components: [
						{
							type: 4, // Text Input
							custom_id: 'reflection',
							label: 'What landed for you today?',
							style: 2, // Paragraph
							placeholder: 'A sentence or two is plenty...',
							required: true,
							max_length: 1000,
						},
					],
				},
			],
		},
	});
}

/**
 * Handle the "Save to Commonplace" button click.
 * Creates a forum thread in the guild's commonplace channel for this entry.
 */
async function handleCommonplaceButton(
	interaction: Record<string, unknown>,
	env: Env,
): Promise<Response> {
	const guildId = interaction.guild_id as string;
	if (!guildId) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: { content: 'This button only works in a server.', flags: 64 },
		});
	}

	const config = await getGuildConfig(env.DB, guildId);
	if (!config) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: { content: 'Run `/stoic setup` first.', flags: 64 },
		});
	}

	const data = interaction.data as Record<string, unknown>;
	const customId = data.custom_id as string;
	const dayOfYear = parseInt(customId.replace('commonplace_', ''), 10);

	const entry = await getEntryByDayOfYear(env.DB, dayOfYear);
	if (!entry) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: { content: 'Entry not found.', flags: 64 },
		});
	}

	try {
		await discordApi(env, `/channels/${config.channel_commonplace}/threads`, 'POST', {
			name: `${entry.date} \u2014 ${entry.title}`.slice(0, 100),
			message: {
				content: [
					`*"${entry.quote.slice(0, 300)}${entry.quote.length > 300 ? '...' : ''}"*`,
					`*— ${entry.quote_source}*`,
					'',
					`${entry.commentary.slice(0, 500)}${entry.commentary.length > 500 ? '...' : ''}`,
					'',
					'*What does this connect to in your life?*',
				].join('\n'),
			},
		});
	} catch (error: unknown) {
		console.error({
			event: 'commonplace_thread_error',
			component: 'handlers.interactions',
			message: `Failed to create commonplace thread: ${error instanceof Error ? error.message : 'Unknown error'}`,
		});
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: { content: 'Failed to create a commonplace thread. Check channel permissions.', flags: 64 },
		});
	}

	return jsonResponse({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content: `Created a commonplace thread for "${entry.title}" \u2014 check <#${config.channel_commonplace}>`,
			flags: 64,
		},
	});
}

/**
 * Route modal submissions to their handlers.
 */
async function handleModalSubmit(
	interaction: Record<string, unknown>,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const data = interaction.data as Record<string, unknown>;
	const customId = data.custom_id as string;

	// Extract modal text input values from the components structure
	const modalComponents = data.components as Array<Record<string, unknown>> | undefined;

	if (customId === 'modal_obstacle') {
		const situation = extractModalField(modalComponents, 'situation') ?? '';
		return handleObstacleSubmit(interaction, env, ctx, situation);
	}

	if (customId === 'modal_letter') {
		const recipient = extractModalField(modalComponents, 'recipient') ?? '';
		const letterContent = extractModalField(modalComponents, 'content') ?? '';
		return handleLetterSubmit(interaction, env, ctx, recipient, letterContent);
	}

	if (customId.startsWith('modal_reflect_')) {
		return handleReflectSubmit(interaction, env, customId, modalComponents);
	}

	console.error({
		event: 'unknown_modal_submit',
		component: 'handlers.interactions',
		message: `Unhandled modal custom_id: ${customId}`,
	});

	return errorResponse(`Unknown modal: ${customId}`, 400);
}

/**
 * Extract a field value from Discord modal submission components.
 * Modal components are nested: ActionRow -> TextInput with custom_id and value.
 */
function extractModalField(
	components: Array<Record<string, unknown>> | undefined,
	fieldId: string,
): string | undefined {
	if (!components) return undefined;
	for (const row of components) {
		const rowComponents = row.components as Array<Record<string, unknown>> | undefined;
		if (!rowComponents) continue;
		for (const input of rowComponents) {
			if (input.custom_id === fieldId) {
				return input.value as string;
			}
		}
	}
	return undefined;
}

/**
 * Handle the reflection modal submission.
 * Stores the reflection and responds with confirmation.
 */
async function handleReflectSubmit(
	interaction: Record<string, unknown>,
	env: Env,
	customId: string,
	modalComponents: Array<Record<string, unknown>> | undefined,
): Promise<Response> {
	const dayOfYear = parseInt(customId.replace('modal_reflect_', ''), 10);
	const reflectionText = extractModalField(modalComponents, 'reflection') ?? '';

	const userId = ((interaction.member as Record<string, unknown>)?.user as Record<string, unknown>)
		?.id as string ?? (interaction.user as Record<string, unknown>)?.id as string;
	const guildId = interaction.guild_id as string ?? '';

	try {
		await env.DB.prepare(
			`INSERT INTO reflections (user_id, guild_id, day_of_year, reflection_text, created_at)
			 VALUES (?, ?, ?, ?, unixepoch())`,
		)
			.bind(userId, guildId, dayOfYear, reflectionText)
			.run();
	} catch (error: unknown) {
		// Non-critical — still confirm to user even if storage fails
		console.error({
			event: 'reflection_storage_error',
			component: 'handlers.interactions',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
	}

	return jsonResponse({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content: 'noted. 🤙',
			flags: 64,
		},
	});
}
