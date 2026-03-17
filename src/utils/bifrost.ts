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

	try {
		const response = await fetch(`${env.ROUTER_URL}/v1/llm/chat`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				prompt: request.prompt,
				model: request.model,
				taskType: request.taskType ?? 'stoic-bot',
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

		const data = (await response.json()) as BifrostResponse;

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
