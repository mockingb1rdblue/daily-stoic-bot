/**
 * Discord request signature verification.
 * Uses discord-interactions library to validate incoming webhook requests.
 */

import { verifyKey } from 'discord-interactions';

interface VerifyResult {
	isValid: boolean;
	interaction: Record<string, unknown> | null;
}

export async function verifyDiscordRequest(request: Request, env: Env): Promise<VerifyResult> {
	const signature = request.headers.get('x-signature-ed25519');
	const timestamp = request.headers.get('x-signature-timestamp');
	const body = await request.text();

	if (!signature || !timestamp) {
		return { isValid: false, interaction: null };
	}

	const isValid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);

	return {
		isValid,
		interaction: isValid ? (JSON.parse(body) as Record<string, unknown>) : null,
	};
}
