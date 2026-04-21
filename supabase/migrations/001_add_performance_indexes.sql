-- ============================================================
-- THE BOX — Migration 001: Performance Indexes
-- Additive only. No table changes.
--
-- Problem: games table has a JSONB `data` column with zero
-- expression indexes. Every live-game query (WatchPage, TV ticker,
-- sport manifests) does a full sequential scan.
--
-- Solution: GIN-style expression indexes on the most-queried
-- JSONB fields + composite indexes on tournament_fixtures.
-- ============================================================

-- ── games ───────────────────────────────────────────────────
-- Filtered by sport (multi-sport WatchPage, sport manifests)
CREATE INDEX IF NOT EXISTS idx_games_sport_id
  ON games ((data->>'sportId'));

-- Filtered by status ('live' / 'completed' / 'archived')
CREATE INDEX IF NOT EXISTS idx_games_status
  ON games ((data->>'status'));

-- Filtered by host (Dashboard "My Games" section)
CREATE INDEX IF NOT EXISTS idx_games_host_id
  ON games ((data->>'hostId'));

-- Ordered by recency (live games feed, recent history)
CREATE INDEX IF NOT EXISTS idx_games_last_update
  ON games (last_update DESC);

-- Composite: live games per sport (most common WatchPage query)
CREATE INDEX IF NOT EXISTS idx_games_sport_status
  ON games ((data->>'sportId'), (data->>'status'));

-- ── shot_events ─────────────────────────────────────────────
-- Per-game period filtering (ShotChart period selector)
CREATE INDEX IF NOT EXISTS idx_shot_events_game_period
  ON shot_events (game_code, period);

-- Per-player filtering (player shot summary)
CREATE INDEX IF NOT EXISTS idx_shot_events_player
  ON shot_events (player_id)
  WHERE player_id IS NOT NULL;

-- ── tournament_fixtures ─────────────────────────────────────
-- Bracket queries by tournament (full bracket load)
CREATE INDEX IF NOT EXISTS idx_fixtures_tournament
  ON tournament_fixtures ("tournamentId");

-- Bracket queries by division (single division bracket)
CREATE INDEX IF NOT EXISTS idx_fixtures_division
  ON tournament_fixtures ("divisionId");

-- Live fixture lookup (HostConsole linking game → fixture)
CREATE INDEX IF NOT EXISTS idx_fixtures_game_code
  ON tournament_fixtures ("gameCode")
  WHERE "gameCode" IS NOT NULL;

-- Fixture status filtering (active/scheduled/completed views)
CREATE INDEX IF NOT EXISTS idx_fixtures_status
  ON tournament_fixtures (status);
