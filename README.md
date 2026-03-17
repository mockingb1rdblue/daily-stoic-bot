# Daily Stoic Bot

A Discord bot that posts daily Stoic philosophy entries and facilitates reflection through AI-powered Socratic dialogue.

**[Add to your server](https://discord.com/api/oauth2/authorize?client_id=1483271790829764729&permissions=2419724368&scope=bot%20applications.commands)**

> Permissions requested: Manage Channels, Send Messages, Create Threads, Manage Threads, Embed Links, Read Message History, Add Reactions, Use Slash Commands, Use External Emojis

## Slash Commands

| Command | Description |
|---------|-------------|
| `/stoic obstacle` | Describe what you're wrestling with — get a Stoic reframe and a Socratic question |
| `/stoic context` | Set your personal lens ("I'm a nurse", "going through a divorce") for tailored reflections |
| `/stoic letter` | Write an unsent letter to someone using today's entry as a lens (private) |
| `/stoic voice` | Choose your philosopher: Epictetus (blunt), Seneca (eloquent), Marcus Aurelius (introspective) |
| `/stoic help` | Show all commands and current schedule |

## Admin Commands

| Command | Description |
|---------|-------------|
| `/stoic setup` | Create a "Daily Stoic" channel category with all channels, pick your timezone |
| `/stoic cleanup` | Remove all Daily Stoic channels and config from the server |
| `/stoic schedule` | Change morning/evening posting times for your timezone |
| `/stoic trigger` | Manually fire any scheduled event (morning post, evening exam, poll, etc.) |

## Automatic Features

These run on a schedule configured per server via `/stoic setup` and `/stoic schedule`:

| Feature | When | What happens |
|---------|------|--------------|
| Daily Post | Every morning | Posts today's entry with an AI-generated hook, quote, and commentary. Adds a 🏛️ reaction for engagement tracking. |
| Evening Examination | Every evening | Creates private threads with 3 personalized Socratic questions for each active participant |
| Virtue Poll | Every Friday | Posts a poll in #stoic-discussion: Courage, Wisdom, Justice, or Temperance |
| Then vs. Now | Every Friday | AI-generated modern adaptation of a random entry |
| Commonplace Thread | Every Monday | Opens a new forum thread in #stoic-commonplace with the week's entries |
| Engagement Tracking | Every morning | Checks yesterday's reactions, updates private streaks, sends milestone DMs |

Each daily post includes three buttons:
- **Challenge This** — The Adversary generates the strongest philosophical objection
- **Reflect** — Opens a quick form to capture what landed for you
- **Save to Commonplace** — Creates a forum thread for that entry

### What a daily post looks like

> **THE BEAUTY OF CHOICE**
>
> *epictetus basically said your haircut doesn't matter if your decision-making is trash*
>
> *"You are not your body and hair-style, but your capacity for choosing well. If your choices are beautiful, so too will you be."*
> *— EPICTETUS, DISCOURSES, 3.1.39b-40a*
>
> It's that line in the movie Fight Club...

## Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge)
- **AI**: Any OpenAI-compatible API — ships with [Bifrost Bridge](https://github.com/search?q=bifrost-bridge) support but works with OpenRouter, direct OpenAI, Anthropic, local Ollama, or any endpoint that accepts the `/v1/chat/completions` format
- **Discord**: [discord-interactions](https://github.com/discord/discord-interactions-js) (raw REST, no discord.js)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/daily-stoic-bot.git
cd daily-stoic-bot
npm install
```

### 2. Create a Discord Application

See [docs/DISCORD_SETUP.md](docs/DISCORD_SETUP.md) for step-by-step instructions. You'll need:
- Application ID
- Public Key
- Bot Token
- A test server ID

### 3. Create D1 databases

```bash
wrangler d1 create stoic-db-dev
wrangler d1 create stoic-db
```

### 4. Configure wrangler.toml

Update the placeholder values:

```toml
database_id = "YOUR_DEV_DB_ID"           # from step 3
id = "YOUR_BIFROST_KV_NAMESPACE_ID"      # your KV namespace for secrets
ROUTER_URL = "https://your-llm-api.com"  # any OpenAI-compatible endpoint
```

### 5. Configure your LLM provider

The bot works with any API that accepts OpenAI-compatible chat requests. Set `ROUTER_URL` in wrangler.toml and store your API key in KV as `PROXY_API_KEY`.

**Examples:**

| Provider | ROUTER_URL | Notes |
|----------|-----------|-------|
| OpenRouter | `https://openrouter.ai/api` | Multi-model, pay-per-token |
| OpenAI | `https://api.openai.com` | Direct GPT access |
| Anthropic (via proxy) | Your proxy URL | Needs OpenAI-compatible wrapper |
| Bifrost Bridge | Your Bifrost Worker URL | Multi-model bandit routing |
| Ollama (local) | `http://localhost:11434` | Free, local inference |

### 6. Store secrets

```bash
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_APP_ID
wrangler secret put DISCORD_BOT_TOKEN
```

### 7. Apply schema and seed entries

```bash
npm run migrate       # Create tables
npm run seed          # Seed 366 Daily Stoic entries
```

### 8. Deploy and connect

```bash
npm run deploy
```

Then in the [Discord Developer Portal](https://discord.com/developers/applications), set the **Interactions Endpoint URL** to `https://your-worker.workers.dev/interactions`.

### 9. Register commands and go

```bash
export GUILD_ID="your-test-server-id"
npm run register:dev
```

Type `/stoic setup` in your server to create the channels and start.

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
  |     366 entries, user contexts, threads, polls, reflections
  |
  |-- LLM Provider (any OpenAI-compatible API)
  |     Used for: reframes, Socratic questions, adversary, hooks
  |
  |-- KV Store (secrets)
  |     Bot token, API keys
  |
  |-- Discord REST API
        Post messages, create threads, polls

Scheduled (hourly, timezone-aware per server):
  Morning   — Daily entry post to #stoic-reflections
  Evening   — Evening examination (private threads)
  Friday    — Virtue poll + Then vs. Now
  Monday    — Weekly commonplace thread
```

## Project Structure

```
src/
  index.ts                  # Worker entry: fetch + scheduled handlers
  handlers/
    interactions.ts         # Discord interaction router (commands, buttons, modals)
    triggers.ts             # HTTP trigger endpoints for manual firing
    commands/
      obstacle.ts           # /stoic obstacle — AI reframe
      context.ts            # /stoic context — personal lens
      letter.ts             # /stoic letter — unsent letter exercise
      voice.ts              # /stoic voice — philosopher selection
      setup.ts              # /stoic setup — channel provisioning
      cleanup.ts            # /stoic cleanup — teardown
      schedule.ts           # /stoic schedule — timezone config
      trigger.ts            # /stoic trigger — manual event firing
      help.ts               # /stoic help — command reference
  services/
    daily-post.ts           # Morning entry with AI hook + embed
    evening-exam.ts         # Personalized Socratic threads
    virtue-poll.ts          # Weekly virtue poll
    adversary.ts            # "Challenge This" philosophical counter-argument
    then-vs-now.ts          # Weekly modern adaptation
    commonplace.ts          # Monday forum thread creation
    engagement.ts           # Reaction tracking + quiet user check-ins
    reaction-poller.ts      # Polls reactions for streak tracking
    streaks.ts              # Private milestone DMs (3, 7, 14, 21, 30... days)
    voices.ts               # Philosopher voice system prompts
  db/
    entries.ts              # Entry queries + leap year day calculation
    guilds.ts               # Per-server config + schedule queries
    users.ts                # User context + preference queries
  utils/
    bifrost.ts              # LLM client (OpenAI-compatible)
    discord.ts              # Discord REST helpers
    json.ts                 # Response utilities
    verify.ts               # Discord signature verification

schema.sql                  # D1 schema (10 tables)
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

Daily entries from *The Daily Stoic: 366 Meditations on Wisdom, Perseverance, and the Art of Living* by Ryan Holiday and Stephen Hanselman (Portfolio/Penguin, 2016). Visit [DailyStoic.com](https://dailystoic.com/) for more.

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
