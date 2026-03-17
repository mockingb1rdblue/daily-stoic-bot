/**
 * Manual trigger endpoints for firing scheduled events on demand.
 * Authenticated via PROXY_API_KEY Bearer token from Bifrost KV.
 */

import { jsonResponse, errorResponse } from '../utils/json.js';
import { postDailyEntry } from '../services/daily-post.js';
import { runEveningExamination } from '../services/evening-exam.js';
import { postVirtuePoll } from '../services/virtue-poll.js';
import { postThenVsNow } from '../services/then-vs-now.js';
import { createWeeklyCommonplaceThread } from '../services/commonplace.js';
import { pollYesterdayReactions } from '../services/reaction-poller.js';
import { checkInWithQuietUsers } from '../services/engagement.js';
import { getAllGuildConfigs } from '../db/guilds.js';
import { getTodaysEntry } from '../db/entries.js';

async function verifyTriggerAuth(request: Request, env: Env): Promise<boolean> {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) return false;
	const token = authHeader.slice(7);
	const apiKey = await env.BIFROST_KV.get('PROXY_API_KEY');
	return token === apiKey;
}

export async function handleTrigger(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	triggerName: string,
): Promise<Response> {
	if (!await verifyTriggerAuth(request, env)) {
		return errorResponse('Unauthorized', 401);
	}

	const guilds = await getAllGuildConfigs(env.DB);
	if (guilds.length === 0) {
		return errorResponse('No guilds configured. Run /stoic setup first.', 404);
	}

	const wrap = (p: Promise<unknown>) => p.catch((err) => {
		console.error({ event: 'trigger_error', component: 'triggers', trigger: triggerName, message: err instanceof Error ? err.message : 'Unknown' });
	});

	switch (triggerName) {
		case 'morning': {
			ctx.waitUntil(wrap(postDailyEntry(env, guilds)));
			return jsonResponse({ triggered: 'morning', guilds: guilds.length });
		}
		case 'evening': {
			ctx.waitUntil(wrap(runEveningExamination(env, guilds)));
			return jsonResponse({ triggered: 'evening', guilds: guilds.length });
		}
		case 'poll': {
			ctx.waitUntil(wrap(postVirtuePoll(env, guilds)));
			return jsonResponse({ triggered: 'poll', guilds: guilds.length });
		}
		case 'then-vs-now': {
			ctx.waitUntil(wrap(postThenVsNow(env, guilds)));
			return jsonResponse({ triggered: 'then-vs-now', guilds: guilds.length });
		}
		case 'commonplace': {
			ctx.waitUntil(wrap(createWeeklyCommonplaceThread(env, guilds)));
			return jsonResponse({ triggered: 'commonplace', guilds: guilds.length });
		}
		case 'reactions': {
			ctx.waitUntil(wrap(pollYesterdayReactions(env, guilds)));
			return jsonResponse({ triggered: 'reactions', guilds: guilds.length });
		}
		case 'checkin': {
			const entry = await getTodaysEntry(env.DB);
			if (!entry) return errorResponse('No entry for today', 404);
			for (const guild of guilds) {
				ctx.waitUntil(wrap(checkInWithQuietUsers(env, guild, entry.day_of_year)));
			}
			return jsonResponse({ triggered: 'checkin', guilds: guilds.length });
		}
		default:
			return errorResponse(`Unknown trigger: ${triggerName}. Available: morning, evening, poll, then-vs-now, commonplace, reactions, checkin`, 400);
	}
}
