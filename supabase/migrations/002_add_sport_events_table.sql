-- ============================================================
-- THE BOX — Migration 002: sport_events Table
-- Additive only. Does not touch shot_events (basketball only).
--
-- Provides a persistent, queryable event log for all 17 sports:
--   badminton, volleyball, kabaddi, tabletennis, cricket,
--   football, hockey, khokho, netball, tennis, handball,
--   throwball, chess, carrom, athletics, general
--
-- basketball keeps using shot_events (richer x/y/zone schema).
-- All other sports write here via the record_sport_event() RPC.
--
-- event_type vocabulary per sport (examples):
--   badminton    → 'point', 'service_fault', 'net_fault', 'set_won', 'game_won'
--   volleyball   → 'point', 'ace', 'block', 'rotation_error', 'set_won'
--   football     → 'goal', 'assist', 'yellow_card', 'red_card', 'corner', 'offside', 'penalty'
--   hockey       → 'goal', 'penalty_corner', 'penalty_stroke', 'sin_bin', 'green_card'
--   kabaddi      → 'raid_point', 'tackle_point', 'bonus_point', 'super_tackle', 'all_out'
--   cricket      → 'run', 'wicket', 'wide', 'no_ball', 'boundary_4', 'boundary_6', 'over_end'
--   tennis       → 'point', 'ace', 'double_fault', 'game_won', 'set_won', 'tiebreak'
--   tabletennis  → 'point', 'service', 'game_won', 'match_won'
--   handball     → 'goal', 'foul', 'yellow_card', 'red_card', '2min_suspension', 'penalty'
--   throwball    → 'point', 'foul', 'set_won'
--   khokho       → 'chase_point', 'turn', 'out', 'bonus'
--   netball      → 'goal', 'foul', 'turnover', 'centre_pass'
--   chess        → 'move', 'check', 'capture', 'castling', 'result'
--   carrom       → 'pocket', 'queen', 'red', 'board_fault', 'set_won'
--   athletics    → 'heat_result', 'final_result', 'foul_attempt', 'disqualification'
--   general      → 'point', 'foul', 'timeout', 'period_end'
-- ============================================================

CREATE TABLE IF NOT EXISTS sport_events (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  game_code    TEXT        NOT NULL REFERENCES games(code) ON DELETE CASCADE,
  sport_id     TEXT        NOT NULL,

  -- What happened
  event_type   TEXT        NOT NULL,
  team_side    CHAR(1)     CHECK (team_side IN ('A', 'B', 'N')),  -- N = neutral/no team
  player_id    TEXT,
  player_name  TEXT,        -- Denormalized: roster can change post-game, name stays fixed

  -- When it happened
  period       INTEGER     DEFAULT 1 CHECK (period >= 1),
  clock_sec    INTEGER     CHECK (clock_sec >= 0),  -- game clock seconds at event time

  -- Scoring weight
  value        INTEGER     DEFAULT 0,  -- points/runs/goals this event scores

  -- Sport-specific extras (e.g., { "card": "yellow", "set_score": [21, 18] })
  payload      JSONB       DEFAULT '{}' NOT NULL,

  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── Indexes ─────────────────────────────────────────────────
-- All events for a game (timeline, replay)
CREATE INDEX IF NOT EXISTS idx_sport_events_game
  ON sport_events (game_code, created_at DESC);

-- Events by type within a game (filter by 'goal', 'wicket', etc.)
CREATE INDEX IF NOT EXISTS idx_sport_events_game_type
  ON sport_events (game_code, event_type);

-- Cross-game analytics by sport
CREATE INDEX IF NOT EXISTS idx_sport_events_sport
  ON sport_events (sport_id, created_at DESC);

-- Per-player history
CREATE INDEX IF NOT EXISTS idx_sport_events_player
  ON sport_events (player_id)
  WHERE player_id IS NOT NULL;

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE sport_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read (spectators, TV displays, public analytics)
CREATE POLICY "sport_events_public_read"
  ON sport_events FOR SELECT
  USING (true);

-- Only the game's host can insert events
CREATE POLICY "sport_events_host_insert"
  ON sport_events FOR INSERT
  WITH CHECK (
    game_code IN (
      SELECT code FROM games
      WHERE (data->>'hostId') = auth.uid()::text
    )
  );

-- Host can delete (undo wrong events)
CREATE POLICY "sport_events_host_delete"
  ON sport_events FOR DELETE
  USING (
    game_code IN (
      SELECT code FROM games
      WHERE (data->>'hostId') = auth.uid()::text
    )
  );
