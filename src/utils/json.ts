/**
 * JSON response utilities for Cloudflare Workers.
 * Follows the CarPiggy pattern for consistent API responses.
 */

export function safeJsonParse<T = unknown>(text: string | null | undefined, fallback: T): T {
	if (!text) return fallback;
	try {
		return JSON.parse(text) as T;
	} catch {
		return fallback;
	}
}

export const jsonResponse = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...headers },
	});

export const errorResponse = (message: string, status = 500) =>
	jsonResponse({ error: message, status }, status);
