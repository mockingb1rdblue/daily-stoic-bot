/**
 * Evening examination service.
 * Creates personalized Socratic reflection threads for active participants.
 */

import { getTodaysEntry } from '../db/entries.js';
import { type GuildConfig } from '../db/guilds.js';
import { getUserContext } from '../db/users.js';
import { callBifrost } from '../utils/bifrost.js';
import { createThread, postInThread, addThreadMember } from '../utils/discord.js';
import { getVoice } from './voices.js';

interface ActiveUser {
	user_id: string;
	context_text: string;
	preferred_voice: string | null;
}

/**
 * Run the evening examination for all active participants.
 * Creates a private thread per user off the daily post message with
 * personalized Socratic questions.
 */
export async function runEveningExamination(env: Env, guilds: GuildConfig[]): Promise<void> {
	const entry = await getTodaysEntry(env.DB);
	if (!entry) {
		console.error({
			event: 'evening_exam_no_entry',
			component: 'services.evening-exam',
			message: 'No entry found for today',
		});
		return;
	}

	if (guilds.length === 0) {
		console.log({
			event: 'evening_exam_no_guilds',
			component: 'services.evening-exam',
			message: 'No guilds due for evening exam this hour',
		});
		return;
	}

	// Get all users with a context (active participants)
	const activeUsers = await env.DB.prepare(
		'SELECT user_id, context_text, preferred_voice FROM user_contexts WHERE context_text != ""',
	)
		.all<ActiveUser>();

	const users = activeUsers.results ?? [];

	if (users.length === 0) {
		console.log({
			event: 'evening_exam_no_users',
			component: 'services.evening-exam',
			message: 'No active users with context found',
		});
		return;
	}

	console.log({
		event: 'evening_exam_start',
		component: 'services.evening-exam',
		message: `Running evening examination for ${users.length} users across ${guilds.length} guilds`,
	});

	let successCount = 0;
	let errorCount = 0;

	for (const guild of guilds) {
		const dailyMsgData = await env.BIFROST_KV.get(`STOIC_DAILY_MSG_${guild.guild_id}`);
		if (!dailyMsgData) {
			console.log({
				event: 'evening_exam_no_daily_message',
				component: 'services.evening-exam',
				message: `No daily message found for guild ${guild.guild_id} — skipping`,
			});
			continue;
		}

		const { messageId, channelId } = JSON.parse(dailyMsgData) as { messageId: string; channelId: string };

		for (const user of users) {
			try {
				await processUserExamination(env, user, entry, channelId, messageId, guild.guild_id);
				successCount++;
			} catch (error: unknown) {
				errorCount++;
				console.error({
					event: 'evening_exam_user_error',
					component: 'services.evening-exam',
					message: `Failed for user ${user.user_id} in guild ${guild.guild_id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
				});
			}
		}
	}

	console.log({
		event: 'evening_exam_complete',
		component: 'services.evening-exam',
		message: `Evening examination complete: ${successCount} success, ${errorCount} errors across ${guilds.length} guilds`,
	});
}

async function processUserExamination(
	env: Env,
	user: ActiveUser,
	entry: { id: number; title: string; quote: string; quote_source: string; commentary: string },
	channelId: string,
	messageId: string,
	guildId: string,
): Promise<void> {
	const voice = getVoice(user.preferred_voice);

	const prompt = `${voice.systemPrompt}

You are conducting an evening examination with a student. Today's meditation was:
"${entry.quote}" — ${entry.quote_source}
Theme: ${entry.title}

About this student: ${user.context_text}

Generate exactly 3 personalized Socratic questions for their evening reflection. The questions should:
1. Connect today's theme to their personal situation
2. Challenge them to examine their actions today honestly
3. Point toward tomorrow's practice

Format each question on its own line, numbered 1-3. Keep each question to 1-2 sentences.
Do not add preamble or conclusion — just the 3 questions.`;

	const response = await callBifrost(env, {
		prompt,
		taskType: 'stoic-evening-exam',
		temperature: 0.8,
		maxOutputTokens: 512,
		thinkingBudget: 1024,
	});

	// Create a thread from the daily message
	const threadName = `Evening Reflection — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
	const thread = await createThread(env, channelId, messageId, threadName);

	// Add the user to the thread
	await addThreadMember(env, thread.id, user.user_id);

	// Post the questions
	const content = [
		`<@${user.user_id}> **${voice.displayName}'s Evening Questions:**\n`,
		response.result,
		'\n*Take a moment with each question. There are no wrong answers — only honest ones.*',
	].join('\n');

	await postInThread(env, thread.id, content);

	// Record the thread in the database
	await env.DB.prepare(
		`INSERT INTO evening_threads (user_id, guild_id, entry_id, thread_id, message_id, questions_json, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, unixepoch())`,
	)
		.bind(user.user_id, guildId, entry.id, thread.id, messageId, response.result)
		.run();

	console.log({
		event: 'evening_exam_thread_created',
		component: 'services.evening-exam',
		message: `Thread created for user ${user.user_id}`,
		threadId: thread.id,
	});
}
