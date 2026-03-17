/**
 * "Then vs. Now" service.
 * Weekly, generates a modern adaptation of a random Stoic entry.
 * Shows how advice written for a Roman emperor maps to managing teams,
 * raising kids, dealing with a diagnosis, etc.
 *
 * Runs alongside the Friday virtue poll.
 */

import { getRandomEntry } from '../db/entries.js';
import { type GuildConfig } from '../db/guilds.js';
import { callLLM } from '../utils/llm.js';
import { postMessage } from '../utils/discord.js';

export async function postThenVsNow(env: Env, guilds: GuildConfig[]): Promise<void> {
	const entry = await getRandomEntry(env.DB);
	if (!entry) return;

	const response = await callLLM(env, {
		prompt: `You're explaining a piece of ancient Stoic philosophy to a group of smart friends in their mid-30s who work in tech and science. They're not academics — they want to know why this matters on a Tuesday afternoon when their code won't compile, their kid is sick, or their manager just made a terrible decision.

Original entry:
Title: "${entry.title}"
Quote: "${entry.quote}" — ${entry.quote_source}
Commentary: ${entry.commentary}

Write a modern adaptation in two parts:

**THEN:** One paragraph about what this meant in Marcus Aurelius's world — war, plague, political betrayal, the weight of empire. Keep it vivid and specific, not generic.

**NOW:** One paragraph translating this to 2026 — managing a team through layoffs, doomscrolling at 2am, dealing with a parent's decline, the specific texture of modern overwhelm. Be concrete, not abstract.

End with ONE question: "Does the translation hold? What does modern life make harder or easier?"

Keep the whole thing under 300 words. Markdown formatting for Discord. No hashtags, no self-help clichés.`,
		taskType: 'research',
		temperature: 0.85,
		maxOutputTokens: 1024,
		thinkingBudget: 512,
	});

	const embed = {
		author: {
			name: '🔄 Then vs. Now',
		},
		description: `**${entry.title}**\n\n${response.result}`,
		color: 0x4a6741,
		fields: [
			{ name: 'Source', value: entry.quote_source, inline: true },
			{ name: 'Day', value: `${entry.day_of_year}`, inline: true },
		],
		footer: {
			text: 'Does the translation hold?',
		},
		timestamp: new Date().toISOString(),
	};

	let successCount = 0;
	for (const guild of guilds) {
		try {
			await postMessage(env, guild.channel_discussion, { embeds: [embed] });
			successCount++;
		} catch (error: unknown) {
			console.error({
				event: 'then_vs_now_guild_error',
				component: 'services.then-vs-now',
				message: `Failed for guild ${guild.guild_id}: ${error instanceof Error ? error.message : 'Unknown'}`,
			});
		}
	}

	console.log({
		event: 'then_vs_now_complete',
		component: 'services.then-vs-now',
		message: `Posted to ${successCount} guilds`,
		entryTitle: entry.title,
	});
}
