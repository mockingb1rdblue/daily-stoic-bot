/**
 * Database queries for user context and preferences.
 * Each user can set a personal lens and preferred philosopher voice.
 */

export interface UserContext {
	user_id: string;
	context_text: string;
	preferred_voice: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Get a user's personal context/lens for personalized reflections.
 */
export async function getUserContext(
	db: D1Database,
	userId: string,
): Promise<UserContext | null> {
	const result = await db
		.prepare('SELECT * FROM user_contexts WHERE user_id = ?')
		.bind(userId)
		.first<UserContext>();

	return result ?? null;
}

/**
 * Create or update a user's personal context.
 * Uses INSERT OR REPLACE for upsert behavior.
 */
export async function setUserContext(
	db: D1Database,
	userId: string,
	contextText: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO user_contexts (user_id, context_text, updated_at)
			 VALUES (?, ?, datetime('now'))
			 ON CONFLICT(user_id) DO UPDATE SET
			   context_text = excluded.context_text,
			   updated_at = excluded.updated_at`,
		)
		.bind(userId, contextText)
		.run();

	console.log({
		event: 'user_context_updated',
		component: 'db.users',
		message: `Updated context for user ${userId}`,
	});
}

/**
 * Get a user's preferred philosopher voice.
 */
export async function getUserPreferredVoice(
	db: D1Database,
	userId: string,
): Promise<string | null> {
	const result = await db
		.prepare('SELECT preferred_voice FROM user_contexts WHERE user_id = ?')
		.bind(userId)
		.first<{ preferred_voice: string | null }>();

	return result?.preferred_voice ?? null;
}
