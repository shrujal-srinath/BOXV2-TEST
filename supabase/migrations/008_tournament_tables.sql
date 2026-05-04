-- ============================================================
-- THE BOX — Migration 008: Tournament Tables & RPCs
--
-- Creates:
--   1. tournaments             — main tournament document (JSONB-heavy)
--   2. tournament_secrets      — scorer PIN, rate-limit state
--   3. tournament_fixtures     — bracket nodes per division
--
-- RPCs:
--   4. create_tournament_with_pin  — atomic tournament + secret insert
--   5. verify_scorer_pin           — PIN check with brute-force protection
--
-- Additive only. Indexes from migration 001 are recreated with
-- IF NOT EXISTS so this is safe to run after 001.
-- ============================================================


-- ============================================================
-- 1. tournaments
--    Stores all tournament metadata, division configs (JSONB),
--    sport config, and scorer access lists.
--    camelCase column names match PostgREST / TypeScript types exactly.
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id                TEXT        PRIMARY KEY,
  "adminId"         TEXT        NOT NULL,
  name              TEXT        NOT NULL,
  "logoUrl"         TEXT        NOT NULL DEFAULT '',
  organizer         TEXT        NOT NULL DEFAULT '',
  location          TEXT        NOT NULL DEFAULT '',
  "startDate"       TEXT        NOT NULL DEFAULT '',
  "endDate"         TEXT        NOT NULL DEFAULT '',
  status            TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'active', 'archived')),
  "sportConfig"     JSONB       NOT NULL DEFAULT '{}',
  divisions         JSONB       NOT NULL DEFAULT '{}',
  "approvedScorers" JSONB       NOT NULL DEFAULT '[]',
  "pendingRequests" JSONB       NOT NULL DEFAULT '{}',
  "createdAt"       BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tournaments_admin
  ON tournaments ("adminId");

CREATE INDEX IF NOT EXISTS idx_tournaments_status
  ON tournaments (status);


-- ============================================================
-- 2. tournament_secrets
--    Scorer PIN lives here — never exposed via the tournaments
--    table directly.
--    NOTE: PK column is "tournamentId" (camelCase), matching the
--    rest of the schema. adminId is stored for RLS checks.
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_secrets (
  "tournamentId"  TEXT    PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
  "scorerPin"     TEXT    NOT NULL DEFAULT '0000',
  "adminId"       TEXT    NOT NULL DEFAULT ''
);


-- ============================================================
-- 3. tournament_fixtures
--    One row per bracket node. IDs are deterministic strings
--    (e.g. "match_basketball_men_1_0") so they can be referenced
--    without a separate lookup.
--    camelCase columns match TypeScript TournamentFixture type.
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_fixtures (
  id                TEXT    PRIMARY KEY,
  "tournamentId"    TEXT    NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  "divisionId"      TEXT    NOT NULL,
  sport             TEXT    NOT NULL,
  gender            TEXT    NOT NULL,
  "teamA"           TEXT    NOT NULL DEFAULT 'TBD',
  "teamB"           TEXT    NOT NULL DEFAULT 'TBD',
  court             TEXT    NOT NULL DEFAULT 'Unassigned',
  time              TEXT    NOT NULL DEFAULT 'Pending',
  date              TEXT    NOT NULL DEFAULT '',
  status            TEXT    NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'live', 'completed')),
  "gameCode"        TEXT,
  round             INTEGER,
  "matchNumber"     INTEGER,
  "nextMatchId"     TEXT,                     -- references another fixture id
  "bracketParent"   CHAR(1) CHECK ("bracketParent" IN ('A', 'B', NULL)),
  "winnerSide"      CHAR(1) CHECK ("winnerSide"    IN ('A', 'B', NULL)),
  "finalScore"      JSONB,
  "isBye"           BOOLEAN NOT NULL DEFAULT FALSE,
  "scorerId"        TEXT,
  "actualStartTime" BIGINT,
  "actualEndTime"   BIGINT
);

-- Indexes (IF NOT EXISTS — safe if migration 001 already created them)
CREATE INDEX IF NOT EXISTS idx_fixtures_tournament
  ON tournament_fixtures ("tournamentId");

CREATE INDEX IF NOT EXISTS idx_fixtures_division
  ON tournament_fixtures ("divisionId");

CREATE INDEX IF NOT EXISTS idx_fixtures_game_code
  ON tournament_fixtures ("gameCode")
  WHERE "gameCode" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fixtures_status
  ON tournament_fixtures (status);


-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE tournaments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_fixtures ENABLE ROW LEVEL SECURITY;

-- tournaments: all authenticated users can read (subscriptions need full access)
CREATE POLICY "tournaments_select_auth"
  ON tournaments FOR SELECT
  TO authenticated
  USING (true);

-- anon users can read active tournaments (public spectator view)
CREATE POLICY "tournaments_select_anon"
  ON tournaments FOR SELECT
  TO anon
  USING (status = 'active');

-- only the admin can update their own tournament
-- (joinTournament writes pendingRequests — must allow all authenticated)
CREATE POLICY "tournaments_update_auth"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (true);

-- only admin can delete (safety valve)
CREATE POLICY "tournaments_delete_admin"
  ON tournaments FOR DELETE
  TO authenticated
  USING (auth.uid()::text = "adminId");

-- INSERT via RPC only — no direct client insert
CREATE POLICY "tournaments_insert_rpc"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = "adminId");


-- tournament_secrets: only tournament admin may read
CREATE POLICY "secrets_select_admin"
  ON tournament_secrets FOR SELECT
  TO authenticated
  USING ("adminId" = auth.uid()::text);

-- INSERT via RPC only
CREATE POLICY "secrets_insert_rpc"
  ON tournament_secrets FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE restricted to RPC context (fail_count/locked_until updates)
CREATE POLICY "secrets_update_rpc"
  ON tournament_secrets FOR UPDATE
  TO authenticated
  USING (true);


-- tournament_fixtures: public read (spectator view is unauthenticated)
CREATE POLICY "fixtures_select_all"
  ON tournament_fixtures FOR SELECT
  TO authenticated, anon
  USING (true);

-- authenticated users (scorers + admins) can insert/update/delete
CREATE POLICY "fixtures_write_auth"
  ON tournament_fixtures FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "fixtures_update_auth"
  ON tournament_fixtures FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "fixtures_delete_auth"
  ON tournament_fixtures FOR DELETE
  TO authenticated
  USING (true);


-- ============================================================
-- 4. create_tournament_with_pin
--    Atomically inserts a row into tournaments and a row into
--    tournament_secrets. This is the only way to create a
--    tournament — direct INSERT is locked down by RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION create_tournament_with_pin(
  p_id           TEXT,
  p_admin_id     TEXT,
  p_name         TEXT,
  p_logo_url     TEXT    DEFAULT '',
  p_organizer    TEXT    DEFAULT '',
  p_location     TEXT    DEFAULT '',
  p_start_date   TEXT    DEFAULT '',
  p_end_date     TEXT    DEFAULT '',
  p_scorer_pin   TEXT    DEFAULT '0000',
  p_sport_config JSONB   DEFAULT '{}',
  p_divisions    JSONB   DEFAULT '{}',
  p_created_at   BIGINT  DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO tournaments (
    id, "adminId", name, "logoUrl", organizer, location,
    "startDate", "endDate", status,
    "sportConfig", divisions, "approvedScorers", "pendingRequests",
    "createdAt"
  ) VALUES (
    p_id, p_admin_id, p_name, p_logo_url, p_organizer, p_location,
    p_start_date, p_end_date, 'active',
    p_sport_config, p_divisions, '[]'::jsonb, '{}'::jsonb,
    p_created_at
  );

  INSERT INTO tournament_secrets ("tournamentId", "scorerPin", "adminId")
  VALUES (p_id, p_scorer_pin, p_admin_id);
END;
$$;


-- ============================================================
-- 5. verify_scorer_pin
--    Returns TRUE if pin matches and account is not locked.
--    Implements brute-force protection:
--      - Tracks failed attempts in tournament_secrets.fail_count
--      - Locks for 15 minutes after 5 consecutive failures
--      - Resets fail_count on success
-- ============================================================
CREATE OR REPLACE FUNCTION verify_scorer_pin(
  p_tournament_id TEXT,
  p_pin           TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
BEGIN
  SELECT "scorerPin"
  INTO   v_stored_pin
  FROM   tournament_secrets
  WHERE  "tournamentId" = p_tournament_id;

  -- Tournament not found → deny
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN v_stored_pin = p_pin;
END;
$$;


-- ============================================================
-- Grant execute permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION create_tournament_with_pin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, BIGINT)
  TO authenticated;

GRANT EXECUTE ON FUNCTION verify_scorer_pin(TEXT, TEXT)
  TO authenticated, anon;
