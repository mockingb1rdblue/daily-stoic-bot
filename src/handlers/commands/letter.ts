/**
 * /stoic letter command handler.
 * Shows a modal for optional letter context, then creates a self-contained
 * ephemeral letter-writing exercise based on today's entry.
 * Includes a Bifrost-generated Socratic question so the exercise is complete
 * without needing gateway events for follow-up.
 */

import { InteractionResponseType } from 'discord-interactions';
import { getTodaysEntry } from '../../db/entries.js';
import { getUserContext } from '../../db/users.js';
import { callBifrost } from '../../utils/bifrost.js';
import { editOriginalResponse } from '../../utils/discord.js';
import { jsonResponse } from '../../utils/json.js';

/**
 * Generate a Socratic reflective question tailored to the entry and user context.
 */
async function generateReflectiveQuestion(
	env: Env,
	entryTitle: string,
	quote: string,
	quoteSource: string,
	userContextText: string | null,
	recipient: string | null,
	letterContent: string | null,
): Promise<string> {
	const contextClause = userContextText
		? `The user has shared this about themselves: "${userContextText}". Use this to make the question more personally relevant.`
		: 'You have no personal context about this user — keep the question universal but pointed.';

	const recipientClause = recipient
		? `They are writing a letter to: "${recipient}".`
		: '';

	const contentClause = letterContent
		? `They shared this about what they want to say: "${letterContent}".`
		: '';

	const response = await callBifrost(env, {
		prompt: `You are a Socratic philosophy companion. Based on this Stoic meditation, write ONE reflective question that cuts through surface-level thinking. The question should be uncomfortable in a productive way — the kind that stays with someone all day.

Entry: "${entryTitle}"
Quote: "${quote}" — ${quoteSource}
${contextClause}
${recipientClause}
${contentClause}

Rules:
- ONE question only, no preamble, no follow-up
- Don't ask "how does this make you feel" — ask something that demands honest self-examination
- Tone: direct, warm, zero self-help fluff
- Under 200 characters

Examples of the right tone:
- "What would you do differently today if you genuinely believed that worry was optional?"
- "Who are you performing your frustration for, and what would happen if you stopped?"
- "If you already know the right thing to do, what exactly are you waiting for?"`,
		taskType: 'context-analysis',
		temperature: 0.9,
		maxOutputTokens: 100,
		thinkingBudget: 512,
	});

	return response.result.trim();
}

/**
 * Handle /stoic letter command.
 * Returns a modal so the user can optionally provide a recipient and context.
 */
export function handleLetter(
	_interaction: Record<string, unknown>,
	_env: Env,
	_ctx: ExecutionContext,
): Response {
	return jsonResponse({
		type: 9, // MODAL
		data: {
			custom_id: 'modal_letter',
			title: 'The Unsent Letter',
			components: [
				{
					type: 1, // Action Row
					components: [{
						type: 4, // Text Input
						custom_id: 'recipient',
						label: 'Who is this letter to?',
						style: 1, // Short (single-line)
						placeholder: 'Your past self, a parent, a friend, fear itself...',
						required: true,
						max_length: 200,
					}],
				},
				{
					type: 1, // Action Row
					components: [{
						type: 4, // Text Input
						custom_id: 'content',
						label: 'What do you need to say?',
						style: 2, // Paragraph (multi-line)
						placeholder: 'Leave blank if you just want the writing prompt...',
						required: false,
						max_length: 2000,
					}],
				},
			],
		},
	});
}

/**
 * Handle modal submission for letter.
 * Defers immediately (ephemeral), then processes the LLM call in the background.
 */
export function handleLetterSubmit(
	interaction: Record<string, unknown>,
	env: Env,
	ctx: ExecutionContext,
	recipient: string,
	letterContent: string,
): Response {
	ctx.waitUntil(processLetterDeferred(interaction, env, recipient, letterContent));
	return jsonResponse({
		type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
		data: { flags: 64 }, // Ephemeral deferred — only user sees "thinking..."
	});
}

/**
 * Background processing: generate the letter exercise and edit the deferred response.
 */
async function processLetterDeferred(
	interaction: Record<string, unknown>,
	env: Env,
	recipient: string,
	letterContent: string,
): Promise<void> {
	const token = interaction.token as string;
	const appId = env.DISCORD_APP_ID;
	const userId = ((interaction.member as Record<string, unknown>)?.user as Record<string, unknown>)
		?.id as string ?? (interaction.user as Record<string, unknown>)?.id as string;

	try {
		const [entry, userContext] = await Promise.all([
			getTodaysEntry(env.DB),
			userId ? getUserContext(env.DB, userId) : null,
		]);

		if (!entry) {
			await editOriginalResponse(appId, token, {
				content: 'No entry found for today. The archive may need updating.',
				flags: 64,
			});
			return;
		}

		// Generate a reflective question via Bifrost (with fallback)
		let reflectiveQuestion: string;
		try {
			reflectiveQuestion = await generateReflectiveQuestion(
				env,
				entry.title,
				entry.quote,
				entry.quote_source,
				userContext?.context_text ?? null,
				recipient,
				letterContent || null,
			);
		} catch (error: unknown) {
			console.error({
				event: 'letter_question_generation_failed',
				component: 'commands.letter',
				message: error instanceof Error ? error.message : 'Unknown error',
			});
			reflectiveQuestion = 'What would change about today if you actually believed what you just read?';
		}

		// Build the self-contained exercise prompt
		let prompt = `**Today's Letter-Writing Exercise**\n\n`;
		prompt += `> *"${entry.quote}"*\n> — ${entry.quote_source}\n\n`;
		prompt += `**Theme:** ${entry.title}\n\n`;
		prompt += `You're writing a letter to **${recipient}**. `;
		prompt += `Using this meditation as a lens, write what needs to be said — `;
		prompt += `whether it's to your past self, your future self, or someone who shaped you.\n\n`;

		if (letterContent) {
			prompt += `*You mentioned: "${letterContent}"*\n\n`;
		}

		if (userContext) {
			prompt += `*Consider how this connects to what you've shared about yourself: ${userContext.context_text}*\n\n`;
		}

		prompt += `**Before you write, sit with this question:**\n`;
		prompt += `> *${reflectiveQuestion}*\n\n`;

		prompt += `**Instructions:**\n`;
		prompt += `1. Open your notes app, journal, or just think\n`;
		prompt += `2. Take at least 5 minutes — don't rush\n`;
		prompt += `3. Be honest with yourself; only you can see this\n`;
		prompt += `4. Let the question guide your letter, not constrain it\n\n`;
		prompt += `*This exercise is yours alone. No one else sees this prompt.*`;

		// Store the exercise in unsent_letters for the user's history
		try {
			await env.DB.prepare(
				`INSERT INTO unsent_letters (user_id, entry_id, letter_text, reflection_question) VALUES (?, ?, ?, ?)`,
			).bind(userId, entry.id, letterContent || '', reflectiveQuestion).run();
		} catch (error: unknown) {
			// Non-critical — don't fail the command if storage fails
			console.error({
				event: 'letter_storage_error',
				component: 'commands.letter',
				message: error instanceof Error ? error.message : 'Unknown error',
			});
		}

		await editOriginalResponse(appId, token, {
			content: prompt,
			flags: 64, // Ephemeral
		});
	} catch (error: unknown) {
		console.error({
			event: 'letter_command_error',
			component: 'commands.letter',
			message: error instanceof Error ? error.message : 'Unknown error',
		});

		await editOriginalResponse(appId, token, {
			content: 'Failed to prepare the letter exercise. Please try again.',
			flags: 64,
		});
	}
}
