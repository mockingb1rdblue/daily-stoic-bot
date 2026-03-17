/**
 * /stoic obstacle command handler.
 * Shows a modal for input, then generates a Stoic reframe with a Socratic follow-up question.
 * Uses deferred response pattern to avoid Discord's 3-second interaction timeout on LLM calls.
 */

import { InteractionResponseType } from 'discord-interactions';
import { callBifrost } from '../../utils/bifrost.js';
import { getTodaysEntry } from '../../db/entries.js';
import { getUserContext, getUserPreferredVoice } from '../../db/users.js';
import { getVoice } from '../../services/voices.js';
import { editOriginalResponse } from '../../utils/discord.js';
import { jsonResponse } from '../../utils/json.js';

/**
 * Extract the situation option from inline command invocation (if provided).
 */
function extractSituation(options: Array<{ name: string; value: string }>): string | undefined {
	return options.find((o) => o.name === 'situation')?.value;
}

/**
 * Handle /stoic obstacle command.
 * If no situation option is provided inline, return a modal for richer input.
 * If situation is provided inline, defer and process in the background.
 */
export function handleObstacle(
	interaction: Record<string, unknown>,
	env: Env,
	ctx: ExecutionContext,
): Response {
	const subcommandOptions = (interaction.data as Record<string, unknown>)
		.options as Array<Record<string, unknown>>;
	const obstacleCmd = subcommandOptions?.find(
		(o) => o.name === 'obstacle',
	) as Record<string, unknown> | undefined;
	const inlineOptions = (obstacleCmd?.options as Array<{ name: string; value: string }>) ?? [];
	const situation = extractSituation(inlineOptions);

	// If no inline situation provided, show a modal (no LLM call, responds instantly)
	if (!situation) {
		return jsonResponse({
			type: 9, // MODAL
			data: {
				custom_id: 'modal_obstacle',
				title: 'What are you wrestling with?',
				components: [
					{
						type: 1, // Action Row
						components: [{
							type: 4, // Text Input
							custom_id: 'situation',
							label: 'Describe your situation',
							style: 2, // Paragraph (multi-line)
							placeholder: 'A work conflict, a health scare, something keeping you up at night...',
							required: true,
							max_length: 2000,
						}],
					},
				],
			},
		});
	}

	// Inline situation provided — defer and process in background
	ctx.waitUntil(processObstacleDeferred(interaction, env, situation));
	return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
}

/**
 * Handle modal submission for obstacle.
 * Defers immediately, then processes the LLM call in the background.
 */
export function handleObstacleSubmit(
	interaction: Record<string, unknown>,
	env: Env,
	ctx: ExecutionContext,
	situation: string,
): Response {
	ctx.waitUntil(processObstacleDeferred(interaction, env, situation));
	return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
}

/**
 * Background processing: run the LLM call and edit the deferred response with the result.
 */
async function processObstacleDeferred(
	interaction: Record<string, unknown>,
	env: Env,
	situation: string,
): Promise<void> {
	const token = interaction.token as string;
	const appId = env.DISCORD_APP_ID;
	const userId = ((interaction.member as Record<string, unknown>)?.user as Record<string, unknown>)
		?.id as string ?? (interaction.user as Record<string, unknown>)?.id as string;

	try {
		const [entry, userContext, preferredVoice] = await Promise.all([
			getTodaysEntry(env.DB),
			userId ? getUserContext(env.DB, userId) : null,
			userId ? getUserPreferredVoice(env.DB, userId) : null,
		]);

		const voice = getVoice(preferredVoice);

		let prompt = `${voice.systemPrompt}\n\n`;
		prompt += `A student comes to you with this obstacle:\n"${situation}"\n\n`;

		if (entry) {
			prompt += `Today's meditation is: "${entry.quote}" — ${entry.quote_source}\n`;
			prompt += `The theme is: ${entry.title}\n\n`;
		}

		if (userContext) {
			prompt += `Context about this student: ${userContext.context_text}\n\n`;
		}

		prompt += `Respond with:
1. A Stoic reframe of their situation (2-3 sentences, in your voice)
2. One penetrating Socratic question that challenges their assumptions
3. A brief actionable practice they can try today

Keep the total response under 300 words. Use Markdown formatting for Discord.`;

		const response = await callBifrost(env, {
			prompt,
			taskType: 'context-analysis',
			temperature: 0.8,
			maxOutputTokens: 1024,
			thinkingBudget: 1024,
		});

		// Parse reframe and question from LLM response
		const resultText = response.result as string;
		const lines = resultText.split('\n').filter((l: string) => l.trim().length > 0);
		const reframeText = lines.slice(0, Math.max(1, lines.length - 2)).join('\n');
		const questionText = lines.length > 1 ? lines[lines.length - 2] : lines[0];

		// Store reframe in database
		const guildId = interaction.guild_id as string ?? '';
		if (entry && userId) {
			await env.DB.prepare(
				`INSERT INTO obstacle_reframes (user_id, guild_id, entry_id, situation, reframe, question, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, unixepoch())`,
			)
				.bind(userId, guildId, entry.id, situation, reframeText, questionText)
				.run();
		}

		const embed = {
			author: {
				name: `${voice.displayName} on Your Obstacle`,
			},
			description: response.result,
			color: 0x8b7355,
			...(entry ? {
				fields: [
					{ name: "Today's Theme", value: entry.title, inline: true },
					{ name: 'Source', value: entry.quote_source, inline: true },
				],
			} : {}),
			footer: {
				text: 'The obstacle is the way.',
			},
			timestamp: new Date().toISOString(),
		};

		await editOriginalResponse(appId, token, { embeds: [embed] });
	} catch (error: unknown) {
		console.error({
			event: 'obstacle_command_error',
			component: 'commands.obstacle',
			message: error instanceof Error ? error.message : 'Unknown error',
		});

		await editOriginalResponse(appId, token, {
			content: 'The philosopher is momentarily lost in thought. Please try again shortly.',
		});
	}
}
