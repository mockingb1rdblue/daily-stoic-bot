# Daily Stoic Bot

A Discord bot that posts daily Stoic philosophy entries and facilitates reflection through AI-powered Socratic dialogue. Built on Cloudflare Workers with Bifrost LLM routing.

## Prerequisites

- Node.js 25.x with npm
- Wrangler CLI (`npm i -g wrangler` or use npx)
- Authenticated Wrangler (`wrangler login`)
- A Discord server you own or admin

## Setup (step by step)

### 1. Install dependencies

```bash
npm install
```

### 2. Create Discord Application

Go to https://discord.com/developers/applications

1. **New Application** > name it "Daily Stoic" > Create
2. Copy `APPLICATION ID` and `PUBLIC KEY` from General Information
3. Go to **Bot** tab > Reset Token > copy the `BOT TOKEN`
4. Enable these intents on the Bot page:
   - Server Members Intent: ON
   - Message Content Intent: ON
5. Go to **OAuth2** > URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: Send Messages, Send Messages in Threads, Create Public Threads, Create Private Threads, Embed Links, Read Message History, Use Slash Commands, Manage Threads, Add Reactions, Use External Emojis
6. Copy the generated URL, open it, and add the bot to your server

### 3. Set up Discord server channels

Create these channels:

| Channel | Type | Purpose |
|---------|------|---------|
| `#stoic-reflections` | Text | Daily posts + evening exam threads |
| `#stoic-discussion` | Text | Adversary debates, virtue polls |
| `#stoic-commonplace` | Forum | Evergreen entry discussions |

### 4. Collect your IDs

Enable Discord Developer Mode: User Settings > App Settings > Advanced > Developer Mode ON

Then right-click to copy:
- **Server ID** (right-click server icon)
- **Channel IDs** (right-click each channel)

### 5. Create D1 databases

```bash
# Development
wrangler d1 create stoic-db-dev

# Production
wrangler d1 create stoic-db
```

Copy the `database_id` values from each output.

### 6. Update wrangler.toml

Replace the placeholder database IDs:

```toml
# Dev (top-level)
[[d1_databases]]
binding = "DB"
database_name = "stoic-db-dev"
database_id = "<YOUR_DEV_DB_ID>"    # <-- paste dev ID here

# Production
[[env.production.d1_databases]]
binding = "DB"
database_name = "stoic-db"
database_id = "<YOUR_PROD_DB_ID>"   # <-- paste prod ID here
```

### 7. Store secrets in Bifrost KV

All secrets are stored in the shared Bifrost KV namespace. Run these from the bifrost-bridge project directory:

```bash
cd ~/AntiGH/bifrost-bridge

# Discord secrets (prefix with STOIC_)
npx wrangler kv key put --namespace-id "be16781ec93e4adc8048ba1edee3d10c" \
  "STOIC_DISCORD_APP_ID" "<YOUR_APP_ID>" --remote

npx wrangler kv key put --namespace-id "be16781ec93e4adc8048ba1edee3d10c" \
  "STOIC_DISCORD_PUBLIC_KEY" "<YOUR_PUBLIC_KEY>" --remote

npx wrangler kv key put --namespace-id "be16781ec93e4adc8048ba1edee3d10c" \
  "STOIC_DISCORD_BOT_TOKEN" "<YOUR_BOT_TOKEN>" --remote

npx wrangler kv key put --namespace-id "be16781ec93e4adc8048ba1edee3d10c" \
  "STOIC_DISCORD_GUILD_ID" "<YOUR_SERVER_ID>" --remote

# Channel IDs
npx wrangler kv key put --namespace-id "be16781ec93e4adc8048ba1edee3d10c" \
  "STOIC_CHANNEL_REFLECTIONS" "<REFLECTIONS_CHANNEL_ID>" --remote

npx wrangler kv key put --namespace-id "be16781ec93e4adc8048ba1edee3d10c" \
  "STOIC_CHANNEL_DISCUSSION" "<DISCUSSION_CHANNEL_ID>" --remote

npx wrangler kv key put --namespace-id "be16781ec93e4adc8048ba1edee3d10c" \
  "STOIC_CHANNEL_COMMONPLACE" "<COMMONPLACE_CHANNEL_ID>" --remote

cd ~/AntiGH/daily-stoic-bot
```

> **Note:** PROXY_API_KEY is already in Bifrost KV from bifrost-bridge setup — no need to add it.

### 8. Set Wrangler secrets

The Worker also needs the Discord public key and app ID as Worker secrets (for signature verification on the hot path):

```bash
# These are read from env bindings, not KV, for performance
wrangler secret put DISCORD_PUBLIC_KEY
# paste your public key when prompted

wrangler secret put DISCORD_APP_ID
# paste your app ID when prompted

wrangler secret put DISCORD_BOT_TOKEN
# paste your bot token when prompted
```

### 9. Apply database schema and seed entries

```bash
# Apply schema (creates tables)
npm run migrate

# Seed 366 Daily Stoic entries
npm run seed
```

### 10. Deploy

```bash
npm run deploy
```

Note the deployed URL (e.g., `https://daily-stoic-bot-dev.mock1ng.workers.dev`).

### 11. Set Discord Interactions Endpoint

1. Go to https://discord.com/developers/applications > your app > General Information
2. Set **Interactions Endpoint URL** to: `https://daily-stoic-bot-dev.mock1ng.workers.dev/interactions`
3. Click Save — Discord will verify with a PING (the worker handles this automatically)

### 12. Register slash commands

```bash
# Set guild ID for the registration script
export GUILD_ID="<YOUR_SERVER_ID>"

npm run register:dev
```

### 13. Verify

- Type `/stoic obstacle I'm stressed about a deadline` in your Discord server
- Check `https://daily-stoic-bot-dev.mock1ng.workers.dev/health` returns OK

## Production deployment

```bash
# Set prod secrets
wrangler secret put DISCORD_PUBLIC_KEY --env production
wrangler secret put DISCORD_APP_ID --env production
wrangler secret put DISCORD_BOT_TOKEN --env production

# Apply schema + seed to prod DB
npm run migrate:prod
npm run seed:prod

# Deploy
npm run deploy:prod

# Register global commands (takes up to 1 hour to propagate)
npm run register:prod

# Update Interactions Endpoint URL to prod worker URL
```

## Architecture

```
Discord Server
  |
  POST /interactions (slash commands, buttons)
  |
  v
Cloudflare Worker (daily-stoic-bot)
  |
  |-- D1 Database
  |     366 entries, user contexts, evening threads,
  |     responses, virtue polls, obstacle reframes
  |
  |-- Bifrost Router (/v1/llm/chat)
  |     Bandit-selected: Gemini, DeepSeek, Claude, Sonar
  |     Used for: reframes, Socratic questions, adversary
  |
  |-- Bifrost KV (secrets vault)
  |     Bot token, channel IDs, API keys
  |
  |-- Discord REST API
        Post messages, create threads, polls

Scheduled (cron):
  07:00 UTC  — Daily entry post to #stoic-reflections
  21:00 UTC  — Evening examination (private threads)
  17:00 FRI  — Weekly virtue poll in #stoic-discussion
```

## Features

| Feature | Command/Trigger | Description |
|---------|----------------|-------------|
| Daily Post | Cron 7am UTC | Posts today's Stoic entry with quote + commentary |
| Evening Examination | Cron 9pm UTC | 3 personalized Socratic questions in private threads |
| Obstacle Reframe | `/stoic obstacle` | Stoic reframe of your real-life situation |
| Personal Lens | `/stoic context` | Set persistent context for personalized reflections |
| Unsent Letter | `/stoic letter` | Private philosophical letter-writing exercise |
| Philosopher Voice | `/stoic voice` | Choose Epictetus, Seneca, or Marcus Aurelius tone |
| The Adversary | "Challenge This" button | Strongest objection to the day's teaching |
| Virtue Poll | Cron Friday 5pm | Weekly community reflection on practiced virtues |

## Development

```bash
npm run dev          # Local dev server
npm run check        # TypeScript typecheck
npm run build        # Full build (typecheck + wrangler dry-run)
npm run pre-merge    # Lint + test + typecheck + build
```

## Project structure

```
src/
  index.ts                  # Worker entry: fetch + scheduled handlers
  handlers/
    interactions.ts         # Discord interaction router
    commands/
      obstacle.ts           # /stoic obstacle
      context.ts            # /stoic context
      letter.ts             # /stoic letter
      voice.ts              # /stoic voice
  services/
    daily-post.ts           # Morning entry posting
    evening-exam.ts         # Personalized Socratic threads
    virtue-poll.ts          # Weekly virtue poll
    adversary.ts            # "Challenge This" counter-arguments
    voices.ts               # Philosopher voice system prompts
  db/
    entries.ts              # Entry queries
    users.ts                # User context queries
  utils/
    bifrost.ts              # Bifrost LLM client
    discord.ts              # Discord REST helpers
    json.ts                 # Response utilities
    verify.ts               # Discord signature verification

schema.sql                  # D1 schema (7 tables)
migrations/
  001-seed-entries.sql      # 366 Daily Stoic entries
scripts/
  register-commands.mjs     # Discord slash command registration
  parse-entries.py          # Book parser (one-time use)
```
