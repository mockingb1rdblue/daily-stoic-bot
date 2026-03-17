/**
 * The Adversary service — "Challenge This" button handler.
 * Generates the strongest possible philosophical objection to the daily entry.
 * Uses deferred response pattern to avoid Discord's 3-second interaction timeout on LLM calls.
 */

import { InteractionResponseType } from 'discord-interactions';
import { callBifrost } from '../utils/bifrost.js';
import { getEntryByDayOfYear } from '../db/entries.js';
import { editOriginalResponse } from '../utils/discord.js';
import { jsonResponse } from '../utils/json.js';

/**
 * Handle the "Challenge This" button click.
 * Defers immediately, then generates the challenge in the background.
 */
export function handleChallengeButton(
	interaction: Record<string, unknown>,
	env: Env,
	ctx: ExecutionContext,
): Response {
	ctx.waitUntil(processChallengeDeferred(interaction, env));
	return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
}

/**
 * Background processing: generate the philosophical challenge and edit the deferred response.
 */
async function processChallengeDeferred(
	interaction: Record<string, unknown>,
	env: Env,
): Promise<void> {
	const token = interaction.token as string;
	const appId = env.DISCORD_APP_ID;
	const customId = ((interaction.data as Record<string, unknown>)?.custom_id as string) ?? '';
	const dayOfYearStr = customId.replace('challenge_', '');
	const dayOfYear = parseInt(dayOfYearStr, 10);

	if (isNaN(dayOfYear)) {
		console.error({
			event: 'adversary_invalid_day',
			component: 'services.adversary',
			message: `Invalid day_of_year from custom_id: ${customId}`,
		});
		await editOriginalResponse(appId, token, {
			content: 'The Adversary is confused. Invalid reference.',
		});
		return;
	}

	try {
		const entry = await getEntryByDayOfYear(env.DB, dayOfYear);

		if (!entry) {
			await editOriginalResponse(appId, token, {
				content: 'Entry not found for this day.',
			});
			return;
		}

		const prompt = `You are The Adversary — a brilliant philosophical critic who stress-tests ideas to strengthen them. You are NOT anti-Stoic; you believe that ideas worth holding must survive challenge.

Today's Stoic entry:
Title: ${entry.title}
Quote: "${entry.quote}" — ${entry.quote_source}
Commentary: ${entry.commentary}

Your task:
1. Present the STRONGEST possible philosophical objection to this idea. Draw from Epicurean, Existentialist, Buddhist, or modern psychological perspectives.
2. Identify a real-world scenario where following this Stoic advice could genuinely backfire.
3. End with ONE question that forces defenders of this entry to deepen their understanding.

Rules:
- Be intellectually honest, not contrarian for its own sake
- Acknowledge what the Stoics get right before attacking
- Keep your response under 250 words
- Use Markdown formatting for Discord`;

		const response = await callBifrost(env, {
			prompt,
			taskType: 'research',
			temperature: 0.9,
			maxOutputTokens: 1024,
			thinkingBudget: 512,
		});

		const embed = {
			author: {
				name: '⚔️ The Adversary',
			},
			description: response.result,
			color: 0x8b2500, // Deep rust red
			fields: [
				{ name: 'Challenging', value: entry.title, inline: true },
			],
			footer: {
				text: 'Ideas worth holding survive challenge.',
			},
			timestamp: new Date().toISOString(),
		};

		await editOriginalResponse(appId, token, { embeds: [embed] });
	} catch (error: unknown) {
		const errMsg = error instanceof Error ? error.message : String(error);
		const errStack = error instanceof Error ? error.stack : undefined;
		console.error({
			event: 'adversary_error',
			component: 'services.adversary',
			message: errMsg,
			stack: errStack,
			appId,
			dayOfYear,
		});

		try {
			await editOriginalResponse(appId, token, {
				content: `The Adversary stumbled: ${errMsg.slice(0, 200)}`,
			});
		} catch {
			// Follow-up also failed — interaction token may have expired
		}
	}
}
