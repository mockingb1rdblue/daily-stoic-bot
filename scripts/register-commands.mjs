#!/usr/bin/env node

/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Register Discord slash commands for Daily Stoic Bot.
 *
 * Usage:
 *   node scripts/register-commands.mjs development
 *   node scripts/register-commands.mjs production
 *
 * Environment variables (optional overrides):
 *   DISCORD_APP_ID, DISCORD_BOT_TOKEN, GUILD_ID
 */

import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

const STOIC_COMMAND = {
    name: 'stoic',
    description: 'Daily Stoic - philosophy for everyday life',
    options: [
        {
            name: 'obstacle',
            description: 'Get a Stoic reframe for something you\'re wrestling with',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: 'situation',
                    description: 'Describe what you\'re dealing with (or leave blank for a form)',
                    type: 3, // STRING
                    required: false,
                    max_length: 2000
                }
            ]
        },
        {
            name: 'context',
            description: 'Set your personal context for more relevant reflections',
            type: 1,
            options: [
                {
                    name: 'situation',
                    description: 'Your context: "I\'m a nurse", "going through a divorce", etc.',
                    type: 3,
                    required: true,
                    max_length: 500
                }
            ]
        },
        {
            name: 'letter',
            description: 'Write an unsent letter using today\'s Stoic entry as a lens',
            type: 1
        },
        {
            name: 'voice',
            description: 'Choose which Stoic philosopher\'s voice resonates with you',
            type: 1,
            options: [
                {
                    name: 'philosopher',
                    description: 'Which voice to use for Socratic questions',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'Epictetus — blunt, working-class', value: 'epictetus' },
                        { name: 'Seneca — eloquent, political', value: 'seneca' },
                        { name: 'Marcus Aurelius — introspective, imperial', value: 'marcus_aurelius' }
                    ]
                }
            ]
        },
        {
            name: 'setup',
            description: 'Set up Daily Stoic channels in this server (admin only)',
            type: 1,
            options: [
                {
                    name: 'timezone',
                    description: 'Your server\'s timezone (defaults to US/Mountain)',
                    type: 3,
                    required: false,
                    choices: [
                        { name: 'US/Eastern (UTC-5)', value: 'US/Eastern (UTC-5)' },
                        { name: 'US/Central (UTC-6)', value: 'US/Central (UTC-6)' },
                        { name: 'US/Mountain (UTC-7)', value: 'US/Mountain (UTC-7)' },
                        { name: 'US/Pacific (UTC-8)', value: 'US/Pacific (UTC-8)' },
                        { name: 'US/Alaska (UTC-9)', value: 'US/Alaska (UTC-9)' },
                        { name: 'US/Hawaii (UTC-10)', value: 'US/Hawaii (UTC-10)' },
                        { name: 'UK/London (UTC+0)', value: 'UK/London (UTC+0)' },
                        { name: 'EU/Central (UTC+1)', value: 'EU/Central (UTC+1)' },
                        { name: 'EU/Eastern (UTC+2)', value: 'EU/Eastern (UTC+2)' },
                        { name: 'Asia/India (UTC+5:30)', value: 'Asia/India (UTC+5:30)' },
                        { name: 'Asia/Tokyo (UTC+9)', value: 'Asia/Tokyo (UTC+9)' },
                        { name: 'AU/Sydney (UTC+11)', value: 'AU/Sydney (UTC+11)' }
                    ]
                }
            ]
        },
        {
            name: 'cleanup',
            description: 'Remove all Daily Stoic channels from this server (admin only)',
            type: 1
        },
        {
            name: 'schedule',
            description: 'Change posting times for this server (admin only)',
            type: 1,
            options: [
                {
                    name: 'timezone',
                    description: 'Your server\'s timezone',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'US/Eastern (UTC-5)', value: 'US/Eastern (UTC-5)' },
                        { name: 'US/Central (UTC-6)', value: 'US/Central (UTC-6)' },
                        { name: 'US/Mountain (UTC-7)', value: 'US/Mountain (UTC-7)' },
                        { name: 'US/Pacific (UTC-8)', value: 'US/Pacific (UTC-8)' },
                        { name: 'US/Alaska (UTC-9)', value: 'US/Alaska (UTC-9)' },
                        { name: 'US/Hawaii (UTC-10)', value: 'US/Hawaii (UTC-10)' },
                        { name: 'UK/London (UTC+0)', value: 'UK/London (UTC+0)' },
                        { name: 'EU/Central (UTC+1)', value: 'EU/Central (UTC+1)' },
                        { name: 'EU/Eastern (UTC+2)', value: 'EU/Eastern (UTC+2)' },
                        { name: 'Asia/India (UTC+5:30)', value: 'Asia/India (UTC+5:30)' },
                        { name: 'Asia/Tokyo (UTC+9)', value: 'Asia/Tokyo (UTC+9)' },
                        { name: 'AU/Sydney (UTC+11)', value: 'AU/Sydney (UTC+11)' }
                    ]
                },
                {
                    name: 'morning',
                    description: 'Morning post hour in your local time (0-23, default 7)',
                    type: 4, // INTEGER
                    required: false,
                    min_value: 0,
                    max_value: 23
                },
                {
                    name: 'evening',
                    description: 'Evening exam hour in your local time (0-23, default 20)',
                    type: 4,
                    required: false,
                    min_value: 0,
                    max_value: 23
                }
            ]
        },
        {
            name: 'trigger',
            description: 'Manually fire a scheduled event now (admin only)',
            type: 1,
            options: [
                {
                    name: 'event',
                    description: 'Which event to trigger',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'Morning post', value: 'morning' },
                        { name: 'Evening examination', value: 'evening' },
                        { name: 'Virtue poll', value: 'poll' },
                        { name: 'Then vs. Now', value: 'then-vs-now' },
                        { name: 'Commonplace thread', value: 'commonplace' },
                        { name: 'Poll reactions', value: 'reactions' },
                        { name: 'Quiet user check-in', value: 'checkin' }
                    ]
                }
            ]
        },
        {
            name: 'help',
            description: 'Show all commands and how the bot works',
            type: 1
        }
    ]
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KV_NAMESPACE_ID = 'YOUR_KV_NAMESPACE_ID';
// Set this to the path of the project that owns the KV namespace:
const KV_PROJECT_DIR = '/path/to/your/kv-project';

/**
 * Read a value from KV via wrangler CLI.
 * Returns null when the key is missing or wrangler is unavailable.
 *
 * Note: execSync is used intentionally here with hardcoded key names (no user
 * input), so there is no command injection risk. This is a local dev script,
 * not part of the Worker runtime.
 */
function getKVSecret(key) {
    try {
        return execSync(
            `cd ${KV_PROJECT_DIR} && npx wrangler kv key get --namespace-id "${KV_NAMESPACE_ID}" "${key}" --remote 2>/dev/null`,
            { encoding: 'utf8' }
        ).trim();
    } catch {
        return null;
    }
}

/**
 * Resolve a config value: prefer env var, fall back to KV lookup.
 */
function resolveSecret(envName, kvKey) {
    const envVal = process.env[envName];
    if (envVal) return envVal;

    console.log(`  ${envName} not in env, trying KV key "${kvKey}"...`);
    const kvVal = getKVSecret(kvKey);
    if (kvVal) {
        console.log(`  -> found in KV`);
        return kvVal;
    }

    return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const environment = process.argv[2] ?? 'development';

    if (!['development', 'production'].includes(environment)) {
        console.error('Usage: node scripts/register-commands.mjs [development|production]');
        process.exit(1);
    }

    console.log(`\nRegistering commands for environment: ${environment}\n`);

    // Resolve required secrets
    const appId = resolveSecret('DISCORD_APP_ID', 'STOIC_DISCORD_APP_ID');
    const botToken = resolveSecret('DISCORD_BOT_TOKEN', 'STOIC_DISCORD_BOT_TOKEN');

    if (!appId || !botToken) {
        console.error('Missing required credentials:');
        if (!appId) console.error('  - DISCORD_APP_ID');
        if (!botToken) console.error('  - DISCORD_BOT_TOKEN');
        console.error('\nProvide them as env vars or ensure they exist in KV.');
        process.exit(1);
    }

    // Determine registration URL
    let url;

    if (environment === 'development') {
        // Guild commands update instantly — ideal for development
        const guildId = resolveSecret('GUILD_ID', 'STOIC_DISCORD_GUILD_ID');
        if (!guildId) {
            console.error('Missing GUILD_ID — required for guild-scoped (development) registration.');
            console.error('Provide it as an env var or store it in KV as STOIC_DISCORD_GUILD_ID.');
            process.exit(1);
        }
        url = `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`;
        console.log(`Registering GUILD commands (guild: ${guildId})`);
    } else {
        // Global commands can take up to an hour to propagate
        url = `https://discord.com/api/v10/applications/${appId}/commands`;
        console.log('Registering GLOBAL commands (may take up to 1 hour to propagate)');
    }

    console.log(`  PUT ${url}\n`);

    // Register commands (bulk overwrite)
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${botToken}`
        },
        body: JSON.stringify([STOIC_COMMAND])
    });

    const body = await response.json();

    if (!response.ok) {
        console.error(`Discord API error (${response.status}):`);
        console.error(JSON.stringify(body, null, 2));
        process.exit(1);
    }

    console.log(`Successfully registered ${body.length} command(s):\n`);
    for (const cmd of body) {
        console.log(`  /${cmd.name}  (id: ${cmd.id})`);
        if (cmd.options) {
            for (const opt of cmd.options) {
                console.log(`    - ${cmd.name} ${opt.name}: ${opt.description}`);
            }
        }
    }
    console.log('\nDone.');
}

main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
