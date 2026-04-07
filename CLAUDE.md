# Daily Stoic Bot

Discord bot that posts daily Stoic philosophy entries and facilitates reflection through AI-powered Socratic dialogue.

## Credentials & Secrets

All API tokens, keys, and secrets are managed in **Bifrost KV vault**.
Before creating any credential or asking the user to create one, check what already exists:

```bash
curl https://crypt-core.mock1ng.workers.dev/v1/admin/keys/inventory
```

Or via MCP: call the `vault_inventory` tool (available in bifrost MCP).

Common keys: `CF_SECURITY_TOKEN` (WAF), `CF_DNS_TOKEN` (DNS), `CF_WORKERS_TOKEN` (Workers),
`GITHUB_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — see vault for full list.

## Stack
- **Runtime**: Cloudflare Workers
- **Database**: D1 (SQLite)
- **Secrets**: KV store (zero local secrets)
- **LLM**: Any OpenAI-compatible API via configurable router
- **Discord**: discord-interactions library (raw REST, no discord.js)

## Commands
- `npm run dev` — local development
- `npm run deploy` — deploy to dev
- `npm run deploy:prod` — deploy to production
- `npm run migrate` / `npm run migrate:prod` — apply D1 schema
- `npm run seed` / `npm run seed:prod` — seed entries from parsed data
- `npm run register:dev` / `npm run register:prod` — register Discord slash commands
- `npm run pre-merge` — lint + test + typecheck + build

## Architecture
- All LLM calls go through the configured `ROUTER_URL` endpoint (any OpenAI-compatible API)
- Discord secrets stored in KV with `STOIC_` prefix
- One job per file — split by responsibility, not arbitrary line limits
- Structured logging: `{ event, component, message, ... }`
- No floating promises — use `ctx.waitUntil()` for async work

## Conventions
- TypeScript strict mode
- `catch (error: unknown)` — never `catch (e: any)`
- Use `jsonResponse()` / `errorResponse()` helpers — never bare `new Response()`
- Discord types from discord-interactions library
- No console.log in production — use structured logging objects
