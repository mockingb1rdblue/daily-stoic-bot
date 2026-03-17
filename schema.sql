-- Daily Stoic Bot — D1 Schema

-- The 366 daily entries from The Daily Stoic
CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_year INTEGER NOT NULL UNIQUE,
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    day INTEGER NOT NULL,
    title TEXT NOT NULL,
    quote TEXT NOT NULL,
    quote_source TEXT NOT NULL,
    commentary TEXT NOT NULL,
    part TEXT NOT NULL,
    month_theme TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_entries_day_of_year ON entries(day_of_year);
CREATE INDEX IF NOT EXISTS idx_entries_month ON entries(month);

-- Per-guild configuration (channels created by /stoic setup)
CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    channel_reflections TEXT NOT NULL,
    channel_discussion TEXT NOT NULL,
    channel_commonplace TEXT NOT NULL,
    morning_hour_utc INTEGER NOT NULL DEFAULT 14,
    evening_hour_utc INTEGER NOT NULL DEFAULT 3,
    poll_hour_utc INTEGER NOT NULL DEFAULT 0,
    timezone_label TEXT NOT NULL DEFAULT 'MST (UTC-7)',
    setup_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- User personal contexts (Personal Lens feature)
CREATE TABLE IF NOT EXISTS user_contexts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    context_text TEXT NOT NULL,
    preferred_voice TEXT DEFAULT 'marcus_aurelius',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_user_contexts_user ON user_contexts(user_id);

-- Evening examination threads and responses
CREATE TABLE IF NOT EXISTS evening_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL DEFAULT '',
    entry_id INTEGER NOT NULL,
    thread_id TEXT,
    message_id TEXT,
    questions_json TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE INDEX IF NOT EXISTS idx_evening_threads_user ON evening_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_evening_threads_date ON evening_threads(created_at);

-- User responses to evening examinations
CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    thread_id INTEGER NOT NULL,
    question_index INTEGER NOT NULL,
    response_text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (thread_id) REFERENCES evening_threads(id)
);

-- Weekly virtue poll results
CREATE TABLE IF NOT EXISTS virtue_polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL DEFAULT '',
    week_start TEXT NOT NULL,
    poll_message_id TEXT,
    results_message_id TEXT,
    courage_votes INTEGER DEFAULT 0,
    wisdom_votes INTEGER DEFAULT 0,
    justice_votes INTEGER DEFAULT 0,
    temperance_votes INTEGER DEFAULT 0,
    synthesis TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_virtue_polls_week ON virtue_polls(week_start);

-- Obstacle reframe history (for context in future reframes)
CREATE TABLE IF NOT EXISTS obstacle_reframes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL DEFAULT '',
    entry_id INTEGER NOT NULL,
    situation TEXT NOT NULL,
    reframe TEXT NOT NULL,
    question TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE INDEX IF NOT EXISTS idx_obstacle_reframes_user ON obstacle_reframes(user_id);

-- Unsent letters (private, between user and bot)
CREATE TABLE IF NOT EXISTS unsent_letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    entry_id INTEGER NOT NULL,
    letter_text TEXT NOT NULL,
    reflection_question TEXT,
    thread_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE INDEX IF NOT EXISTS idx_unsent_letters_user ON unsent_letters(user_id);

-- Engagement tracking (reaction taps on daily posts)
CREATE TABLE IF NOT EXISTS engagement_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    entry_day INTEGER NOT NULL,
    engaged_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_engagement_user ON engagement_log(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_unique ON engagement_log(user_id, guild_id, entry_day);

-- Quick reflections from the daily post "Reflect" button
CREATE TABLE IF NOT EXISTS reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL DEFAULT '',
    day_of_year INTEGER NOT NULL,
    reflection_text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_day ON reflections(day_of_year);
