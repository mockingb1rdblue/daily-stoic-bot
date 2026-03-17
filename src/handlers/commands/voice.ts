/**
 * /stoic voice command handler.
 * Sets the user's preferred philosopher voice for all interactions.
 */

import { InteractionResponseType } from 'discord-interactions';
import { getVoice, VOICES } from '../../services/voices.js';

export async function handleVoice(
	interaction: Record<string, unknown>,
	env: Env,
): Promise<Response> {
	const subcommandOptions = (interaction.data as Record<string, unknown>)
		.options as Array<Record<string, unknown>>;
	const voiceCmd = subcommandOptions?.find(
		(o) => o.name === 'voice',
	) as Record<string, unknown> | undefined;
	const cmdOptions = (voiceCmd?.options as Array<{ name: string; value: string }>) ?? [];
	const voiceName = cmdOptions.find((o) => o.name === 'philosopher')?.value;

	const userId = ((interaction.member as Record<string, unknown>)?.user as Record<string, unknown>)
		?.id as string ?? (interaction.user as Record<string, unknown>)?.id as string;

	if (!userId) {
		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: 'Unable to identify user.',
					flags: 64,
				},
			}),
			{ headers: { 'Content-Type': 'application/json' } },
		);
	}

	if (!voiceName || !(voiceName in VOICES)) {
		const available = Object.values(VOICES)
			.map((v) => `- **${v.displayName}**: ${v.systemPrompt.slice(0, 80)}...`)
			.join('\n');

		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: `**Available philosopher voices:**\n${available}\n\nUse \`/stoic voice philosopher:<name>\` to select one.`,
					flags: 64,
				},
			}),
			{ headers: { 'Content-Type': 'application/json' } },
		);
	}

	try {
		await env.DB.prepare(
			`INSERT INTO user_contexts (user_id, preferred_voice, context_text, updated_at)
			 VALUES (?, ?, '', datetime('now'))
			 ON CONFLICT(user_id) DO UPDATE SET
			   preferred_voice = excluded.preferred_voice,
			   updated_at = excluded.updated_at`,
		)
			.bind(userId, voiceName)
			.run();

		const voice = getVoice(voiceName);

		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: `Your philosopher voice has been set to **${voice.displayName}**.\n\nAll future reflections will be delivered in their voice.`,
					flags: 64, // Ephemeral
				},
			}),
			{ headers: { 'Content-Type': 'application/json' } },
		);
	} catch (error: unknown) {
		console.error({
			event: 'voice_command_error',
			component: 'commands.voice',
			message: error instanceof Error ? error.message : 'Unknown error',
		});

		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: 'Failed to update your voice preference. Please try again.',
					flags: 64,
				},
			}),
			{ headers: { 'Content-Type': 'application/json' } },
		);
	}
}
