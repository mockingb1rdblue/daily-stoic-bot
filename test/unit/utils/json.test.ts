/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Unit tests for JSON response utilities.
 */

import { describe, it, expect } from 'vitest';
import { jsonResponse, errorResponse, safeJsonParse } from '../../../src/utils/json.js';

describe('jsonResponse', () => {
	it('returns a Response with application/json Content-Type', () => {
		const res = jsonResponse({ hello: 'world' });
		expect(res.headers.get('Content-Type')).toBe('application/json');
	});

	it('defaults to 200 status', () => {
		const res = jsonResponse({ ok: true });
		expect(res.status).toBe(200);
	});

	it('allows custom status codes', () => {
		const res = jsonResponse({ created: true }, 201);
		expect(res.status).toBe(201);
	});

	it('serializes the data as JSON body', async () => {
		const data = { type: 1, data: { content: 'test' } };
		const res = jsonResponse(data);
		const body = await res.json();
		expect(body).toEqual(data);
	});

	it('allows additional headers', () => {
		const res = jsonResponse({}, 200, { 'X-Custom': 'value' });
		expect(res.headers.get('X-Custom')).toBe('value');
		expect(res.headers.get('Content-Type')).toBe('application/json');
	});
});

describe('errorResponse', () => {
	it('returns error structure with message and status', async () => {
		const res = errorResponse('Something went wrong', 500);
		const body = (await res.json()) as { error: string; status: number };
		expect(body.error).toBe('Something went wrong');
		expect(body.status).toBe(500);
	});

	it('defaults to 500 status', () => {
		const res = errorResponse('Internal error');
		expect(res.status).toBe(500);
	});

	it('returns 401 for auth errors', () => {
		const res = errorResponse('Unauthorized', 401);
		expect(res.status).toBe(401);
	});

	it('returns 400 for bad request', async () => {
		const res = errorResponse('Bad request', 400);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string; status: number };
		expect(body.error).toBe('Bad request');
		expect(body.status).toBe(400);
	});

	it('has application/json Content-Type', () => {
		const res = errorResponse('Error');
		expect(res.headers.get('Content-Type')).toBe('application/json');
	});
});

describe('safeJsonParse', () => {
	it('parses valid JSON', () => {
		const result = safeJsonParse('{"key": "value"}', {});
		expect(result).toEqual({ key: 'value' });
	});

	it('returns fallback for invalid JSON', () => {
		const fallback = { default: true };
		const result = safeJsonParse('not json{', fallback);
		expect(result).toEqual(fallback);
	});

	it('returns fallback for null input', () => {
		const fallback = { empty: true };
		const result = safeJsonParse(null, fallback);
		expect(result).toEqual(fallback);
	});

	it('returns fallback for undefined input', () => {
		const fallback = 'default';
		const result = safeJsonParse(undefined, fallback);
		expect(result).toBe(fallback);
	});

	it('returns fallback for empty string', () => {
		const fallback = [] as unknown[];
		const result = safeJsonParse('', fallback);
		expect(result).toEqual(fallback);
	});

	it('parses arrays correctly', () => {
		const result = safeJsonParse('[1, 2, 3]', []);
		expect(result).toEqual([1, 2, 3]);
	});

	it('parses primitive values', () => {
		expect(safeJsonParse('42', 0)).toBe(42);
		expect(safeJsonParse('"hello"', '')).toBe('hello');
		expect(safeJsonParse('true', false)).toBe(true);
	});
});
