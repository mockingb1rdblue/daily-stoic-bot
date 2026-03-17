# Daily Stoic Bot

A Discord bot that posts daily Stoic philosophy entries and facilitates reflection through AI-powered Socratic dialogue.

**[Add to your server](https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=2419724368&scope=bot%20applications.commands)** (replace `YOUR_APP_ID` with your Discord Application ID)

## Features

| Feature | Command / Trigger | Description |
|---------|-------------------|-------------|
| Daily Post | Cron (morning) | Posts today's Stoic entry with quote + commentary |
| Evening Examination | Cron (evening) | 3 personalized Socratic questions in private threads |
| Obstacle Reframe | `/stoic obstacle` | AI-powered Stoic reframe of a real-life situation |
| Personal Lens | `/stoic context` | Set persistent context for personalized reflections |
| Unsent Letter | `/stoic letter` | Private philosophical letter-writing exercise |
| Philosopher Voice | `/stoic voice` | Choose Epictetus, Seneca, or Marcus Aurelius tone |
| The Adversary | "Challenge This" button | Strongest objection to the day's teaching |
| Virtue Poll | Cron (weekly) | Community reflection on practiced virtues |
| Server Setup | `/stoic setup` | Auto-create channels and configure posting schedule |

### What a daily post looks like

> **January 1 — Control and Choice**
>
> *"The chief task in life is simply this: to identify and separate matters so that I can say clearly to myself which are externals not under my control, and which have to do with the choices I actually control."*
> — Epictetus, Discourses, 2.5.4-5
>
> [Commentary paragraph from the book]
>
> [Challenge This] [Reflect]

## Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge)
- **LLM Routing**: [Bifrost Bridge](https://github.com/search?q=bifrost-bridge) — bandit-selected multi-model router (Gemini, DeepSeek, Claude, Sonar)
- **Secrets**: Bifrost KV (zero local secrets)
- **Discord**: [discord-interactions](https://github.com/discord/discord-interactions-js) (raw REST, no discord.js)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/daily-stoic-bot.git
cd daily-stoic-bot
npm install
```

### 2. Create a Discord Application

See [docs/DISCORD_SETUP.md](docs/DISCORD_SETUP.md) for detailed instructions. You will need:
- `DISCORD_APP_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `GUILD_ID` (your test server)

### 3. Create D1 databases

```bash
wrangler d1 create stoic-db-dev
wrangler d1 create stoic-db
```

### 4. Configure wrangler.toml

Update the placeholder values in `wrangler.toml`:

```toml
# Dev database
database_id = "YOUR_DEV_DB_ID"

# Production database
database_id = "YOUR_PROD_DB_ID"

# Bifrost KV namespace
id = "YOUR_BIFROST_KV_NAMESPACE_ID"

# Bifrost router URL
ROUTER_URL = "https://your-bifrost-router.workers.dev"
```

### 5. Store secrets

```bash
# As Wrangler secrets (used at runtime for signature verification)
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_APP_ID
wrangler secret put DISCORD_BOT_TOKEN

# In Bifrost KV (used by the bot for channel routing, LLM calls, etc.)
# See the main setup docs for the full list of KV keys
```

### 6. Apply schema and seed entries

```bash
npm run migrate       # Create tables
npm run seed          # Seed 366 Daily Stoic entries
```

### 7. Deploy

```bash
npm run deploy
```

### 8. Set Discord Interactions Endpoint

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Select your application > General Information
2. Set **Interactions Endpoint URL** to: `https://daily-stoic-bot-dev.<your-account>.workers.dev/interactions`
3. Save (Discord will verify with a PING)

### 9. Register slash commands

```bash
export GUILD_ID="<your-test-server-id>"
npm run register:dev
```

### 10. Verify

Type `/stoic obstacle I'm stressed about a deadline` in your Discord server.

## Production

```bash
wrangler secret put DISCORD_PUBLIC_KEY --env production
wrangler secret put DISCORD_APP_ID --env production
wrangler secret put DISCORD_BOT_TOKEN --env production

npm run migrate:prod
npm run seed:prod
npm run deploy:prod
npm run register:prod   # Global commands take up to 1 hour to propagate
```

## Architecture

```
Discord Server
  |
  POST /interactions (slash commands, buttons, modals)
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

Scheduled (cron — hourly, timezone-aware per server):
  Morning   — Daily entry post to #stoic-reflections
  Evening   — Evening examination (private threads)
  Weekly    — Virtue poll in #stoic-discussion
```

## Project Structure

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

## Development

```bash
npm run dev          # Local dev server
npm run check        # TypeScript typecheck
npm run build        # Full build (typecheck + wrangler dry-run)
npm run pre-merge    # Lint + test + typecheck + build
```

## Attribution

Content from *The Daily Stoic* by Ryan Holiday and Stephen Hanselman. Visit [DailyStoic.com](https://dailystoic.com/) for more.

## License

[MIT](LICENSE)
