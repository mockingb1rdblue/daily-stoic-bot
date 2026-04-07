/**
 * /stoic context command handler.
 * Sets or updates the user's personal lens for personalized reflections.
 */

import { InteractionResponseType } from 'discord-interactions';
import { setUserContext, getUserContext } from '../../db/users.js';

export async function handleContext(
	interaction: Record<string, unknown>,
	env: Env,
): Promise<Response> {
	const subcommandOptions = (interaction.data as Record<string, unknown>)
		.options as Array<Record<string, unknown>>;
	const contextCmd = subcommandOptions?.find(
		(o) => o.name === 'context',
	) as Record<string, unknown> | undefined;
	const cmdOptions = (contextCmd?.options as Array<{ name: string; value: string }>) ?? [];
	const contextText = cmdOptions.find((o) => o.name === 'text')?.value;

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

	try {
		// If no text provided, show current context
		if (!contextText) {
			const existing = await getUserContext(env.DB, userId);
			const embed = existing
				? {
					author: { name: 'Your Personal Lens' },
					description: `> ${existing.context_text}\n\nUse \`/stoic context text:<new context>\` to update it.`,
					color: 0x8b7355,
				}
				: {
					author: { name: 'Personal Lens' },
					description: 'You haven\'t set a personal lens yet.\n\nUse `/stoic context text:<your context>` to set one.\n\n**Example:** `/stoic context text:I\'m a software engineer struggling with work-life balance and imposter syndrome`',
					color: 0x8b7355,
					footer: { text: 'Your context helps the bot personalize reflections.' },
				};

			return new Response(
				JSON.stringify({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						embeds: [embed],
						flags: 64, // Ephemeral
					},
				}),
				{ headers: { 'Content-Type': 'application/json' } },
			);
		}

		await setUserContext(env.DB, userId, contextText);

		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					embeds: [{
						author: { name: 'Lens Updated' },
						description: `Your personal lens has been updated. Future reflections will be tailored to:\n> ${contextText}`,
						color: 0x8b7355,
					}],
					flags: 64, // Ephemeral
				},
			}),
			{ headers: { 'Content-Type': 'application/json' } },
		);
	} catch (error: unknown) {
		console.error({
			event: 'context_command_error',
			component: 'commands.context',
			message: error instanceof Error ? error.message : 'Unknown error',
		});

		return new Response(
			JSON.stringify({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: 'Failed to update your context. Please try again.',
					flags: 64,
				},
			}),
			{ headers: { 'Content-Type': 'application/json' } },
		);
	}
}
