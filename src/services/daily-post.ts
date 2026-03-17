/**
 * Morning daily post service.
 * Posts today's Stoic entry to every configured guild's reflections channel.
 */

import { getTodaysEntry, type StoicEntry } from '../db/entries.js';
import { type GuildConfig } from '../db/guilds.js';
import { callBifrost } from '../utils/bifrost.js';
import { addReaction, postMessage } from '../utils/discord.js';

interface HookResult {
	text: string;
	provider?: string;
	modelId?: string;
}

/**
 * Generate a casual one-line hook for today's entry via Bifrost LLM.
 * Tone: smart friend who read ahead and wants to get your attention.
 * Returns the hook text plus model metadata for Grimoire reward tracking.
 */
async function generateHook(env: Env, entry: StoicEntry): Promise<HookResult> {
	try {
		const response = await callBifrost(env, {
			prompt: `You're texting a friend about a philosophy passage you just read. Write ONE casual sentence that makes them want to read it too. No hashtags, no emojis, no self-help speak.

The passage is about: "${entry.title}"
The quote is: "${entry.quote}" — ${entry.quote_source}

Examples of the right tone:
- "marcus really said 'stop being a baby about things you can't control' in the most eloquent way possible"
- "this one's about how we waste entire days being pissed about stuff that literally doesn't matter"
- "seneca basically predicted doomscrolling 2000 years ago"
- "today's entry is going to personally attack at least 3 of us"

Write ONLY the one-liner. No quotes around it. No preamble.`,
			taskType: 'research',
			temperature: 0.95,
			maxOutputTokens: 100,
			thinkingBudget: 0,
		});
		return {
			text: response.result.trim(),
			provider: response.provider,
			modelId: response.modelId,
		};
	} catch (error: unknown) {
		console.error({
			event: 'hook_generation_failed',
			component: 'services.daily-post',
			message: error instanceof Error ? error.message : 'Unknown error',
		});
		// Fallback — just use a clean version of the title
		return { text: entry.title.toLowerCase() };
	}
}

/**
 * Post the daily Stoic reflection to the provided guilds.
 * Called by the hourly cron with only guilds whose morning_hour_utc matches.
 */
export async function postDailyEntry(env: Env, guilds: GuildConfig[]): Promise<void> {
	const entry = await getTodaysEntry(env.DB);
	if (!entry) {
		console.error({
			event: 'daily_post_no_entry',
			component: 'services.daily-post',
			message: 'No entry found for today',
		});
		return;
	}

	const hookResult = await generateHook(env, entry);

	// Truncate to stay within Discord's 4096 char embed description limit
	const quote = entry.quote.length > 1500 ? entry.quote.slice(0, 1497) + '...' : entry.quote;
	const commentary = entry.commentary.length > 2000 ? entry.commentary.slice(0, 1997) + '...' : entry.commentary;

	const embed = {
		author: {
			name: `${entry.date} — Day ${entry.day_of_year}`,
		},
		description: [
			`## ${entry.title}\n`,
			`*${hookResult.text}*\n`,
			`*"${quote}"*`,
			`*— ${entry.quote_source}*\n`,
			commentary,
		].join('\n'),
		color: 0x8b7355,
		fields: [
			{ name: 'Discipline', value: entry.part.replace('THE DISCIPLINE OF ', ''), inline: true },
			{ name: 'Theme', value: entry.month_theme, inline: true },
		],
		footer: {
			text: 'Tap 🏛️ to mark that you showed up',
		},
		timestamp: new Date().toISOString(),
	};

	const components = [
		{
			type: 1, // Action Row
			components: [
				{
					type: 2, // Button
					style: 2, // Secondary (grey)
					label: 'Challenge This',
					custom_id: `challenge_${entry.day_of_year}`,
					emoji: { name: '\u2694\ufe0f' },
				},
				{
					type: 2, // Button
					style: 2, // Secondary (grey)
					label: 'Reflect',
					custom_id: `reflect_${entry.day_of_year}`,
					emoji: { name: '\ud83d\udcad' },
				},
				{
					type: 2, // Button
					style: 2, // Secondary (grey)
					label: 'Save to Commonplace',
					custom_id: `commonplace_${entry.day_of_year}`,
					emoji: { name: '\ud83d\udcd6' },
				},
			],
		},
	];

	let successCount = 0;
	let errorCount = 0;

	for (const guild of guilds) {
		try {
			const message = await postMessage(env, guild.channel_reflections, {
				embeds: [embed],
				components,
			});

			// Store the daily message ID per guild in KV for evening exam + Grimoire reward tracking
			await env.BIFROST_KV.put(
				`STOIC_DAILY_MSG_${guild.guild_id}`,
				JSON.stringify({
					messageId: message.id,
					channelId: guild.channel_reflections,
					provider: hookResult.provider,
					modelId: hookResult.modelId,
					dayOfYear: entry.day_of_year,
				}),
				{ expirationTtl: 86400 },
			);

			// Add resonance reaction — users tap this to say "I showed up"
			try {
				await addReaction(env, guild.channel_reflections, message.id, '🏛️');
			} catch { /* non-critical */ }

			successCount++;
		} catch (error: unknown) {
			errorCount++;
			console.error({
				event: 'daily_post_guild_error',
				component: 'services.daily-post',
				message: `Failed for guild ${guild.guild_id}: ${error instanceof Error ? error.message : 'Unknown'}`,
			});
		}
	}

	console.log({
		event: 'daily_post_complete',
		component: 'services.daily-post',
		message: `Posted to ${successCount} guilds, ${errorCount} errors`,
	});
}
