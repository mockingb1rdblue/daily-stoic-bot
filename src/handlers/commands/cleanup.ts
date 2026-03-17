/**
 * /stoic cleanup — Removes all Daily Stoic channels and config from the guild.
 * Only usable by server administrators.
 */

import { InteractionResponseType } from 'discord-interactions';
import { jsonResponse } from '../../utils/json.js';
import { deleteChannel } from '../../utils/discord.js';
import { getGuildConfig, deleteGuildConfig } from '../../db/guilds.js';

export async function handleCleanup(
	interaction: Record<string, unknown>,
	env: Env,
): Promise<Response> {
	const guildId = interaction.guild_id as string;
	const member = interaction.member as Record<string, unknown>;
	const permissions = parseInt(member?.permissions as string, 10);

	// Check MANAGE_GUILD permission
	if (!(permissions & 0x20)) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: 'You need **Manage Server** permission to clean up the Daily Stoic bot.',
				flags: 64,
			},
		});
	}

	const config = await getGuildConfig(env.DB, guildId);
	if (!config) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: 'Daily Stoic is not set up in this server. Nothing to clean up.',
				flags: 64,
			},
		});
	}

	const errors: string[] = [];

	// Delete channels (order: children first, then category)
	for (const channelId of [config.channel_reflections, config.channel_discussion, config.channel_commonplace, config.category_id]) {
		try {
			await deleteChannel(env, channelId);
		} catch (error: unknown) {
			errors.push(channelId);
			console.error({
				event: 'cleanup_channel_error',
				component: 'commands.cleanup',
				message: `Failed to delete channel ${channelId}: ${error instanceof Error ? error.message : 'Unknown'}`,
			});
		}
	}

	// Remove config from DB
	await deleteGuildConfig(env.DB, guildId);

	console.log({
		event: 'guild_cleanup_complete',
		component: 'commands.cleanup',
		message: `Cleanup complete for guild ${guildId}`,
		guildId,
		errors: errors.length,
	});

	if (errors.length > 0) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: `Cleanup mostly done. ${errors.length} channel(s) couldn't be deleted (may have been removed manually). Config has been cleared.`,
				flags: 64,
			},
		});
	}

	return jsonResponse({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content: 'Daily Stoic has been removed from this server. All channels and config deleted. Use `/stoic setup` to start fresh.',
		},
	});
}
