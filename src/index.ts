/**
 * Daily Stoic Bot — Cloudflare Worker entry point.
 * Handles Discord interactions via webhook and hourly cron for per-guild scheduling.
 */

import { handleInteraction } from './handlers/interactions.js';
import { handleTrigger } from './handlers/triggers.js';
import { jsonResponse, errorResponse } from './utils/json.js';
import { postDailyEntry } from './services/daily-post.js';
import { runEveningExamination } from './services/evening-exam.js';
import { postVirtuePoll } from './services/virtue-poll.js';
import { postThenVsNow } from './services/then-vs-now.js';
import { checkInWithQuietUsers } from './services/engagement.js';
import { pollYesterdayReactions } from './services/reaction-poller.js';
import { createWeeklyCommonplaceThread } from './services/commonplace.js';
import { getTodaysEntry } from './db/entries.js';
import { getGuildsByMorningHour, getGuildsByEveningHour, getGuildsByPollHour } from './db/guilds.js';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		try {
			if (url.pathname === '/health' && request.method === 'GET') {
				return jsonResponse({
					status: 'ok',
					environment: env.ENVIRONMENT,
					timestamp: new Date().toISOString(),
				});
			}

			if (url.pathname === '/interactions' && request.method === 'POST') {
				return await handleInteraction(request, env, ctx);
			}

			if (url.pathname.startsWith('/trigger/') && request.method === 'POST') {
				const triggerName = url.pathname.replace('/trigger/', '');
				return await handleTrigger(request, env, ctx, triggerName);
			}

			return errorResponse('Not Found', 404);
		} catch (error: unknown) {
			console.error({
				event: 'fetch_error',
				component: 'index',
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			});
			return errorResponse('Internal Server Error', 500);
		}
	},

	/**
	 * Hourly cron handler.
	 * Checks which guilds have scheduled events for the current UTC hour
	 * and dispatches accordingly. On Fridays, also checks for virtue polls.
	 */
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		const now = new Date(controller.scheduledTime);
		const currentHour = now.getUTCHours();
		const isMonday = now.getUTCDay() === 1;
		const isFriday = now.getUTCDay() === 5;

		console.log({
			event: 'hourly_cron',
			component: 'index',
			hour: currentHour,
			isMonday,
			isFriday,
			scheduledTime: now.toISOString(),
		});

		try {
			// Morning posts — guilds whose morning_hour_utc matches current hour
			const morningGuilds = await getGuildsByMorningHour(env.DB, currentHour);
			if (morningGuilds.length > 0) {
				ctx.waitUntil(
					postDailyEntry(env, morningGuilds).then(() => {
						console.log({
							event: 'morning_post_complete',
							component: 'index',
							guilds: morningGuilds.length,
						});
					}),
				);

				// Also check in with users who've been quiet (non-blocking)
				const todayEntry = await getTodaysEntry(env.DB);
				if (todayEntry) {
					for (const guild of morningGuilds) {
						ctx.waitUntil(
							checkInWithQuietUsers(env, guild, todayEntry.day_of_year).catch((err) => {
								console.error({
									event: 'quiet_checkin_error',
									component: 'index',
									message: err instanceof Error ? err.message : 'Unknown',
								});
							}),
						);
					}
				}

				// Monday: create weekly commonplace forum thread
				if (isMonday) {
					ctx.waitUntil(
						createWeeklyCommonplaceThread(env, morningGuilds).catch((err) => {
							console.error({
								event: 'commonplace_error',
								component: 'index',
								message: err instanceof Error ? err.message : 'Unknown',
							});
						}),
					);
				}

				// Poll yesterday's reactions for engagement tracking
				ctx.waitUntil(
					pollYesterdayReactions(env, morningGuilds).catch((err) => {
						console.error({
							event: 'reaction_poll_error',
							component: 'index',
							message: err instanceof Error ? err.message : 'Unknown',
						});
					}),
				);
			}

			// Evening examinations — guilds whose evening_hour_utc matches
			const eveningGuilds = await getGuildsByEveningHour(env.DB, currentHour);
			if (eveningGuilds.length > 0) {
				ctx.waitUntil(
					runEveningExamination(env, eveningGuilds).then(() => {
						console.log({
							event: 'evening_exam_complete',
							component: 'index',
							guilds: eveningGuilds.length,
						});
					}),
				);
			}

			// Friday virtue polls — guilds whose poll_hour_utc matches
			if (isFriday) {
				const pollGuilds = await getGuildsByPollHour(env.DB, currentHour);
				if (pollGuilds.length > 0) {
					ctx.waitUntil(
						postVirtuePoll(env, pollGuilds).then(() => {
							console.log({
								event: 'virtue_poll_complete',
								component: 'index',
								guilds: pollGuilds.length,
							});
						}),
					);

					// Then vs. Now — weekly modern adaptation
					ctx.waitUntil(
						postThenVsNow(env, pollGuilds).catch((err) => {
							console.error({
								event: 'then_vs_now_error',
								component: 'index',
								message: err instanceof Error ? err.message : 'Unknown',
							});
						}),
					);
				}
			}
		} catch (error: unknown) {
			console.error({
				event: 'scheduled_error',
				component: 'index',
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
				hour: currentHour,
			});
		}
	},
} satisfies ExportedHandler<Env>;
