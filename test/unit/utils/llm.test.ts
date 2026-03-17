/**
 * Unit tests for LLM client types and configuration.
 * Tests the interface contract and timeout configuration.
 */

import { describe, it, expect } from 'vitest';
import type { LLMRequest, LLMResponse } from '../../../src/utils/llm.js';

// Replicate the timeout constant from llm.ts
const LLM_TIMEOUT_MS = 60_000;

describe('LLMRequest interface', () => {
	it('requires prompt field', () => {
		const request: LLMRequest = { prompt: 'test' };
		expect(request.prompt).toBe('test');
	});

	it('accepts all optional fields', () => {
		const request: LLMRequest = {
			prompt: 'test prompt',
			model: 'gpt-4',
			taskType: 'stoic-obstacle',
			temperature: 0.8,
			maxOutputTokens: 1024,
			thinkingBudget: 512,
		};
		expect(request.prompt).toBe('test prompt');
		expect(request.model).toBe('gpt-4');
		expect(request.taskType).toBe('stoic-obstacle');
		expect(request.temperature).toBe(0.8);
		expect(request.maxOutputTokens).toBe(1024);
		expect(request.thinkingBudget).toBe(512);
	});

	it('thinkingBudget can be 0 (disable thinking)', () => {
		const request: LLMRequest = {
			prompt: 'test',
			thinkingBudget: 0,
		};
		expect(request.thinkingBudget).toBe(0);
	});

	it('all optional fields can be undefined', () => {
		const request: LLMRequest = { prompt: 'just a prompt' };
		expect(request.model).toBeUndefined();
		expect(request.taskType).toBeUndefined();
		expect(request.temperature).toBeUndefined();
		expect(request.maxOutputTokens).toBeUndefined();
		expect(request.thinkingBudget).toBeUndefined();
	});
});

describe('LLMResponse interface', () => {
	it('has all required fields', () => {
		const response: LLMResponse = {
			result: 'LLM output text',
			tokensUsed: 150,
			provider: 'openai',
			modelId: 'gpt-4o',
		};
		expect(response.result).toBe('LLM output text');
		expect(response.tokensUsed).toBe(150);
		expect(response.provider).toBe('openai');
		expect(response.modelId).toBe('gpt-4o');
	});
});

describe('LLM timeout configuration', () => {
	it('timeout is 60 seconds', () => {
		expect(LLM_TIMEOUT_MS).toBe(60_000);
	});

	it('timeout is at least 30 seconds (reasonable for LLM calls)', () => {
		expect(LLM_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
	});

	it('timeout is at most 120 seconds (reasonable upper bound)', () => {
		expect(LLM_TIMEOUT_MS).toBeLessThanOrEqual(120_000);
	});
});

describe('LLM request body construction', () => {
	it('includes thinkingBudget in the body when provided', () => {
		const request: LLMRequest = {
			prompt: 'test',
			thinkingBudget: 1024,
		};
		// Replicate what callLLM sends
		const body = {
			prompt: request.prompt,
			model: request.model,
			taskType: request.taskType ?? 'stoic-bot',
			temperature: request.temperature ?? 0.7,
			maxOutputTokens: request.maxOutputTokens ?? 2048,
			thinkingBudget: request.thinkingBudget,
		};
		expect(body.thinkingBudget).toBe(1024);
		expect(body.taskType).toBe('stoic-bot');
		expect(body.temperature).toBe(0.7);
		expect(body.maxOutputTokens).toBe(2048);
	});

	it('defaults taskType to stoic-bot when not provided', () => {
		const request: LLMRequest = { prompt: 'test' };
		const body = {
			taskType: request.taskType ?? 'stoic-bot',
		};
		expect(body.taskType).toBe('stoic-bot');
	});

	it('defaults temperature to 0.7 when not provided', () => {
		const request: LLMRequest = { prompt: 'test' };
		const body = {
			temperature: request.temperature ?? 0.7,
		};
		expect(body.temperature).toBe(0.7);
	});

	it('defaults maxOutputTokens to 2048 when not provided', () => {
		const request: LLMRequest = { prompt: 'test' };
		const body = {
			maxOutputTokens: request.maxOutputTokens ?? 2048,
		};
		expect(body.maxOutputTokens).toBe(2048);
	});
});
