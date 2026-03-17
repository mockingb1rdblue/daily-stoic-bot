interface Env {
    DB: D1Database;
    SECRETS_KV: KVNamespace;
    LLM_ROUTER: Fetcher;
    ENVIRONMENT: string;
    ROUTER_URL: string;
    DISCORD_PUBLIC_KEY: string;
    DISCORD_APP_ID: string;
    DISCORD_BOT_TOKEN: string;
}
