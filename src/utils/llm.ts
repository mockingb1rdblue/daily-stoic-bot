/**
 * LLM client — works with any OpenAI-compatible API.
 *
 * Supports: OpenRouter, OpenAI, Anthropic (via proxy), Bifrost Bridge,
 * Ollama, or any endpoint accepting /v1/chat/completions format.
 *
 * Configure via:
 *   ROUTER_URL env var — base URL of your LLM provider
 *   PROXY_API_KEY in KV — bearer token for auth
 *   LLM_ENDPOINT in KV (optional) — override the path (default: /v1/chat/completions)
 *   LLM_MODEL in KV (optional) — force a specific model
 */

export interface LLMRequest {
	prompt: string;
	model?: string;
	taskType?: string;
	temperature?: number;
	maxOutputTokens?: number;
	thinkingBudget?: number;
}

export interface LLMResponse {
	result: string;
	tokensUsed: number;
	provider: string;
	modelId: string;
}

/** Standard OpenAI chat completion response */
interface OpenAIResponse {
	choices: Array<{ message: { content: string } }>;
	usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
	model: string;
}

/** Alternative LLM response format (e.g. Bifrost Bridge) */
interface AlternativeLLMResponse {
	content: string;
	usage: { promptTokens: number; completionTokens: number; totalTokens: number };
	model: string;
	provider: string;
}

const LLM_TIMEOUT_MS = 60_000;

/**
 * Detect whether a response is an alternative format or standard OpenAI format.
 */
function isAlternativeResponse(data: unknown): data is AlternativeLLMResponse {
	return typeof data === 'object' && data !== null && 'content' in data && !('choices' in data);
}

/**
 * Call the configured LLM provider.
 * Automatically detects alternative vs OpenAI response format.
 */
export async function callLLM(env: Env, request: LLMRequest): Promise<LLMResponse> {
	const apiKey = await env.SECRETS_KV.get('PROXY_API_KEY');
	if (!apiKey) {
		throw new Error('PROXY_API_KEY not found in KV');
	}

	// Allow overriding the endpoint path and model via KV
	const endpointOverride = await env.SECRETS_KV.get('LLM_ENDPOINT');
	const modelOverride = await env.SECRETS_KV.get('LLM_MODEL');

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

	const model = request.model ?? modelOverride ?? undefined;

	const requestBody = JSON.stringify({
		messages: [{ role: 'user', content: request.prompt }],
		model,
		// OpenAI-compatible fields
		max_tokens: request.maxOutputTokens ?? 2048,
		temperature: request.temperature ?? 0.7,
		// Extended fields (ignored by standard OpenAI endpoints)
		taskType: request.taskType ?? 'research',
		maxOutputTokens: request.maxOutputTokens ?? 2048,
		thinkingBudget: request.thinkingBudget,
	});

	const requestInit: RequestInit = {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: requestBody,
		signal: controller.signal,
	};

	// Default endpoint paths
	const altPath = '/v1/llm/chat';
	const openaiPath = '/v1/chat/completions';
	const endpoint = endpointOverride ?? altPath;

	try {
		// Use Service Binding if available (Worker-to-Worker, zero network hop)
		// Otherwise use HTTP fetch to ROUTER_URL
		const response = env.LLM_ROUTER
			? await env.LLM_ROUTER.fetch(`https://internal${endpoint}`, requestInit)
			: await fetch(`${env.ROUTER_URL || ''}${endpoint}`, requestInit);

		if (!response.ok) {
			// If alternative endpoint failed, try OpenAI-compatible path as fallback
			if (endpoint === altPath && !env.LLM_ROUTER) {
				const fallbackResponse = await fetch(
					`${env.ROUTER_URL || ''}${openaiPath}`,
					requestInit,
				);
				if (fallbackResponse.ok) {
					return parseResponse(await fallbackResponse.json());
				}
			}

			const errorText = await response.text();
			console.error({
				event: 'llm_api_error',
				component: 'llm',
				message: `LLM API failed: ${response.status}`,
				detail: errorText,
			});
			throw new Error(`LLM API error ${response.status}: ${errorText}`);
		}

		return parseResponse(await response.json());
	} catch (error: unknown) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error(`LLM request timed out after ${LLM_TIMEOUT_MS}ms`);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Parse LLM response — handles both alternative and OpenAI formats.
 */
function parseResponse(raw: unknown): LLMResponse {
	if (isAlternativeResponse(raw)) {
		return {
			result: raw.content,
			tokensUsed: raw.usage?.totalTokens ?? 0,
			provider: raw.provider ?? 'unknown',
			modelId: raw.model ?? 'unknown',
		};
	}

	// Standard OpenAI format
	const openai = raw as OpenAIResponse;
	return {
		result: openai.choices?.[0]?.message?.content ?? '',
		tokensUsed: openai.usage?.total_tokens ?? 0,
		provider: 'openai-compatible',
		modelId: openai.model ?? 'unknown',
	};
}

// Re-export with original name for backward compatibility
export { callLLM as callBifrost };
export type BifrostRequest = LLMRequest;
export type { LLMResponse as BifrostResponse };
