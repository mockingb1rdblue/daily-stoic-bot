# Discord Bot Setup — Daily Stoic Bot

Complete E2E instructions for creating and configuring the Discord bot.

## Step 1: Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click **"New Application"**
3. Name it: `Daily Stoic` (or whatever you prefer)
4. Accept the ToS and click **Create**

**Collect from the General Information page:**
- `APPLICATION ID` (also called Client ID) — copy this
- `PUBLIC KEY` — copy this

## Step 2: Create the Bot User

1. In the left sidebar, click **"Bot"**
2. Click **"Reset Token"** to generate a new bot token
3. **Copy the token immediately** — you won't see it again

**Collect:**
- `BOT TOKEN` — the token you just copied

**Configure bot settings:**
- **Public Bot**: OFF (only you can add it to servers)
- **Requires OAuth2 Code Grant**: OFF
- **Presence Intent**: OFF (not needed)
- **Server Members Intent**: ON (needed for thread creation/user lookup)
- **Message Content Intent**: ON (needed to read responses in threads)

## Step 3: Configure OAuth2 & Add to Server

1. In the left sidebar, click **"OAuth2"**
2. Under **OAuth2 URL Generator**, select these scopes:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, select:
   - `Send Messages`
   - `Send Messages in Threads`
   - `Create Public Threads`
   - `Create Private Threads`
   - `Embed Links`
   - `Read Message History`
   - `Use Slash Commands`
   - `Manage Threads`
   - `Add Reactions`
   - `Use External Emojis`
4. Copy the generated URL at the bottom
5. Open it in your browser and select your server

**Permission integer (for reference): `397821215808`**

## Step 4: Set Up Server Channels

Create these channels in your Discord server (or note existing ones):

| Channel | Type | Purpose |
|---------|------|---------|
| `#stoic-reflections` | Text | Daily entry posts + Evening Examination threads |
| `#stoic-discussion` | Text | Adversary posts, Steel Man debates, Then vs. Now |
| `#stoic-commonplace` | Forum | Commonplace Book (evergreen discussion per entry) |

**Get Channel IDs:**
1. Enable Developer Mode: User Settings > App Settings > Advanced > Developer Mode ON
2. Right-click each channel > "Copy Channel ID"

**Collect:**
- `CHANNEL_ID_REFLECTIONS` — the #stoic-reflections channel ID
- `CHANNEL_ID_DISCUSSION` — the #stoic-discussion channel ID
- `CHANNEL_ID_COMMONPLACE` — the #stoic-commonplace forum channel ID

## Step 5: Get Server (Guild) ID

1. Right-click your server icon in the left sidebar
2. Click **"Copy Server ID"**

**Collect:**
- `GUILD_ID` — your server ID

## Step 6: Store These Values

Once you have everything, you'll need these 7 values:

```
DISCORD_APP_ID=<Application ID from Step 1>
DISCORD_PUBLIC_KEY=<Public Key from Step 1>
DISCORD_BOT_TOKEN=<Bot Token from Step 2>
DISCORD_GUILD_ID=<Server ID from Step 5>
CHANNEL_ID_REFLECTIONS=<from Step 4>
CHANNEL_ID_DISCUSSION=<from Step 4>
CHANNEL_ID_COMMONPLACE=<from Step 4>
```

Store them in Bifrost KV (prefixed with `STOIC_`) and as Wrangler secrets. See the main README for details.

## Step 7: Set Interactions Endpoint (after deploy)

After I deploy the worker, you'll need to set the **Interactions Endpoint URL** in the Discord Developer Portal:

1. Go to your application > General Information
2. Set **Interactions Endpoint URL** to: `https://daily-stoic-bot.<your-account>.workers.dev/interactions`
3. Discord will send a verification ping — the worker handles this automatically

---

## Architecture Reference

```
Discord Server
  |
  v
Cloudflare Worker (daily-stoic-bot)
  |-- POST /interactions  <- Discord sends slash commands + button clicks
  |-- scheduled()         <- Cron triggers for daily posts + evening exam
  |
  |--> D1 (entries, user_contexts, responses)
  |--> Bifrost /v1/llm/chat (Sonar/Gemini/Claude for AI features)
  |--> Discord REST API (post messages, create threads)
  |--> Bifrost KV (secrets: bot token, channel IDs)
```

## Quick Test

After deploying, test with:

```bash
curl -X POST "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Daily Stoic Bot test post"}'
```
