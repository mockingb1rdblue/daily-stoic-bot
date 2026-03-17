/**
 * Bifrost LLM routing client.
 * Routes prompts through Bifrost Bridge for multi-provider LLM access.
 */

export interface BifrostRequest {
	prompt: string;
	model?: string;
	taskType?: string;
	temperature?: number;
	maxOutputTokens?: number;
	thinkingBudget?: number;
}

interface BifrostRawResponse {
	content: string;
	usage: { promptTokens: number; completionTokens: number; totalTokens: number };
	model: string;
	provider: string;
}

export interface BifrostResponse {
	result: string;
	tokensUsed: number;
	provider: string;
	modelId: string;
}

const BIFROST_TIMEOUT_MS = 60_000;

/**
 * Call the Bifrost LLM router.
 * Uses AbortController for 60-second timeout.
 */
export async function callBifrost(env: Env, request: BifrostRequest): Promise<BifrostResponse> {
	const apiKey = await env.BIFROST_KV.get('PROXY_API_KEY');
	if (!apiKey) {
		throw new Error('PROXY_API_KEY not found in KV');
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), BIFROST_TIMEOUT_MS);

	const routerUrl = env.ROUTER_URL || 'https://crypt-core.mock1ng.workers.dev';

	try {
		const response = await fetch(`${routerUrl}/v1/llm/chat`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				messages: [{ role: 'user', content: request.prompt }],
				model: request.model,
				taskType: request.taskType ?? 'research',
				temperature: request.temperature ?? 0.7,
				maxOutputTokens: request.maxOutputTokens ?? 2048,
				thinkingBudget: request.thinkingBudget,
			}),
			signal: controller.signal,
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error({
				event: 'bifrost_api_error',
				component: 'bifrost',
				message: `Bifrost API failed: ${response.status}`,
				detail: errorText,
			});
			throw new Error(`Bifrost API error ${response.status}: ${errorText}`);
		}

		const raw = (await response.json()) as BifrostRawResponse;

		const data: BifrostResponse = {
			result: raw.content,
			tokensUsed: raw.usage?.totalTokens ?? 0,
			provider: raw.provider,
			modelId: raw.model,
		};

		console.log({
			event: 'bifrost_call_complete',
			component: 'bifrost',
			message: `LLM call succeeded via ${data.provider}/${data.modelId}`,
			tokensUsed: data.tokensUsed,
		});

		return data;
	} catch (error: unknown) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error(`Bifrost request timed out after ${BIFROST_TIMEOUT_MS}ms`);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}
