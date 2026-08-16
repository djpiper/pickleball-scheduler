-- Cloudflare D1 (SQLite). Apply with:
--   npm run db:init:local    (local simulated DB, for `wrangler pages dev`)
--   npm run db:init:remote   (the real database)

CREATE TABLE IF NOT EXISTS poll (
  id          TEXT PRIMARY KEY,   -- short random slug, e.g. "k7m2xq"
  title       TEXT NOT NULL,
  dates       TEXT NOT NULL,      -- JSON array of "YYYY-MM-DD"
  start_hour  INTEGER NOT NULL,   -- 0-23, inclusive
  end_hour    INTEGER NOT NULL,   -- 0-23, exclusive; must be > start_hour
  created_at  INTEGER NOT NULL    -- epoch ms
);

CREATE TABLE IF NOT EXISTS participant (
  id          TEXT PRIMARY KEY,   -- client-generated id, held in localStorage
  poll_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  slots       TEXT NOT NULL,      -- JSON array of "YYYY-MM-DD#<minutes-from-midnight>"
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES poll(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_participant_poll ON participant(poll_id);

-- The court directory is site-wide: no poll_id, no owner. Every visitor sees the
-- same list and anyone may edit it.
CREATE TABLE IF NOT EXISTS court (
  id           TEXT PRIMARY KEY,   -- short random slug, same alphabet as poll.id
  name         TEXT NOT NULL,
  area         TEXT NOT NULL,      -- address or neighbourhood; '' when unset
  court_count  INTEGER NOT NULL,   -- 1-40. Not `count` — that's a SQL builtin.
  indoor       INTEGER NOT NULL,   -- 0 outdoor, 1 indoor
  lighted      INTEGER NOT NULL,   -- 0/1
  tennis       INTEGER NOT NULL,   -- 0/1, shares its lines with tennis
  surface      TEXT NOT NULL,      -- '' | concrete | asphalt | tile | wood | other
  notes        TEXT NOT NULL,      -- '' when unset
  created_at   INTEGER NOT NULL,   -- epoch ms
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_court_name ON court(name);
