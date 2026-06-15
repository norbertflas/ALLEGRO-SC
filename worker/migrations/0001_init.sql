-- ALLEGRO-SC — initial schema for Cloudflare D1
-- Three concerns: configuration (what to scrape), immutable history (for comparison),
-- and a fast "current state" view.

-- What the scraper should collect. Managed from the dashboard.
CREATE TABLE IF NOT EXISTS scraper_targets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type  TEXT    NOT NULL CHECK (target_type IN ('shop', 'keyword')),
    target_value TEXT    NOT NULL,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (target_type, target_value)
);

-- One row per cyclical scrape. The anchor for "Wednesday vs Monday" comparisons.
CREATE TABLE IF NOT EXISTS scrape_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_uid      TEXT    NOT NULL UNIQUE,        -- run_id supplied by the scraper
    started_at   TEXT    NOT NULL,
    finished_at  TEXT,
    status       TEXT    NOT NULL DEFAULT 'running'
                         CHECK (status IN ('running', 'completed', 'failed')),
    offers_count INTEGER NOT NULL DEFAULT 0
);

-- Append-only. Never updated — every run inserts fresh rows so price/position
-- changes over time stay queryable.
CREATE TABLE IF NOT EXISTS offers_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id       INTEGER NOT NULL REFERENCES scrape_runs(id),
    offer_id     TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    price        REAL    NOT NULL,
    is_smart     INTEGER NOT NULL DEFAULT 0,
    seller_name  TEXT,
    source_type  TEXT    NOT NULL CHECK (source_type IN ('shop', 'keyword')),
    source_value TEXT    NOT NULL,
    position     INTEGER,
    scraped_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offers_history_offer
    ON offers_history (offer_id, scraped_at);
CREATE INDEX IF NOT EXISTS idx_offers_history_run
    ON offers_history (run_id);
CREATE INDEX IF NOT EXISTS idx_offers_history_source
    ON offers_history (source_type, source_value, run_id);

-- Latest known state of each offer. UPSERT by offer_id — feeds the "what's live now"
-- view without scanning all of history.
CREATE TABLE IF NOT EXISTS offers_current (
    offer_id     TEXT    PRIMARY KEY,
    title        TEXT    NOT NULL,
    price        REAL    NOT NULL,
    is_smart     INTEGER NOT NULL DEFAULT 0,
    seller_name  TEXT,
    source_type  TEXT    NOT NULL,
    source_value TEXT    NOT NULL,
    position     INTEGER,
    last_run_id  INTEGER NOT NULL REFERENCES scrape_runs(id),
    updated_at   TEXT    NOT NULL
);
