-- ============================================================
-- THE BOX — Migration 003: Multi-Sport RPC Functions
-- Additive only. Does not modify any existing RPC.
--
-- New functions:
--   1. get_live_games          — Filtered live games (indexed)
--   2. record_sport_event      — Validated event insert
--   3. finalize_game_with_result — Atomic game end + bracket advance
--   4. get_game_summary        — Post-game stats JSONB
-- ============================================================

-- ============================================================
-- 1. get_live_games
--    Returns live games with optional sport filter.
--    Used by WatchPage, TV ticker, Arena displays.
--    Hits idx_games_sport_status composite index.
-- ============================================================
CREATE OR REPLACE FUNCTION get_live_games(
  p_sport_id  TEXT    DEFAULT NULL,
  p_limit     INTEGER DEFAULT 20
)
RETURNS SETOF games
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT *
  FROM games
  WHERE
    (data->>'status') = 'live'
    AND (
      p_sport_id IS NULL
      OR (data->>'sportId') = p_sport_id
    )
    AND (data->>'createdAt')::bigint >
        (EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000)::bigint
  ORDER BY last_update DESC
  LIMIT LEAST(p_limit, 100);  -- Hard cap at 100 to prevent abuse
$$;


-- ============================================================
-- 2. record_sport_event
--    Validates caller owns the game, then inserts into sport_events.
--    All non-basketball sports use this instead of direct inserts.
--    SECURITY DEFINER so RLS check runs as function owner.
-- ============================================================
CREATE OR REPLACE FUNCTION record_sport_event(
  p_game_code   TEXT,
  p_sport_id    TEXT,
  p_event_type  TEXT,
  p_team_side   CHAR    DEFAULT NULL,
  p_player_id   TEXT    DEFAULT NULL,
  p_player_name TEXT    DEFAULT NULL,
  p_period      INTEGER DEFAULT 1,
  p_clock_sec   INTEGER DEFAULT NULL,
  p_value       INTEGER DEFAULT 0,
  p_payload     JSONB   DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_host_id  TEXT;
BEGIN
  -- Ownership check: only the game host may record events
  SELECT (data->>'hostId')
  INTO   v_host_id
  FROM   games
  WHERE  code = p_game_code;

  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Game not found: %', p_game_code
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_host_id != auth.uid()::text THEN
    RAISE EXCEPTION 'Not authorized to record events for game %', p_game_code
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Validated insert
  INSERT INTO sport_events (
    game_code,    sport_id,     event_type,
    team_side,    player_id,    player_name,
    period,       clock_sec,    value,        payload
  ) VALUES (
    p_game_code,  p_sport_id,   p_event_type,
    p_team_side,  p_player_id,  p_player_name,
    p_period,     p_clock_sec,  p_value,      p_payload
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;


-- ============================================================
-- 3. finalize_game_with_result
--    Single atomic transaction replacing the current pattern of:
--      finishGame() + fixture update + winner propagation (3 client calls)
--
--    Steps:
--      a) Mark game 'completed' in games table
--      b) Mark tournament_fixtures row 'completed' with winnerSide
--      c) Propagate winner name to nextMatchId fixture
--    All in one transaction → no partial state on network failure.
-- ============================================================
CREATE OR REPLACE FUNCTION finalize_game_with_result(
  p_game_code    TEXT,
  p_final_data   JSONB,
  p_fixture_id   UUID  DEFAULT NULL,
  p_winner_side  CHAR  DEFAULT NULL   -- 'A' or 'B'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_host_id         TEXT;
  v_next_match_id   UUID;
  v_bracket_parent  TEXT;
  v_winner_name     TEXT;
  v_team_a          TEXT;
  v_team_b          TEXT;
BEGIN
  -- Ownership check
  SELECT (data->>'hostId')
  INTO   v_host_id
  FROM   games
  WHERE  code = p_game_code;

  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Game not found: %', p_game_code;
  END IF;

  IF v_host_id != auth.uid()::text THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- a) Complete the game
  UPDATE games
  SET
    data        = p_final_data || '{"status":"completed"}'::jsonb,
    last_update = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
  WHERE code = p_game_code;

  -- b+c) Bracket advancement (only when fixture + winner are provided)
  IF p_fixture_id IS NOT NULL AND p_winner_side IN ('A', 'B') THEN

    -- Fetch fixture info needed for propagation
    SELECT
      "nextMatchId",
      "bracketParent",
      "teamA",
      "teamB"
    INTO
      v_next_match_id,
      v_bracket_parent,
      v_team_a,
      v_team_b
    FROM tournament_fixtures
    WHERE id = p_fixture_id;

    -- Determine the winner's team name
    v_winner_name := CASE
      WHEN p_winner_side = 'A' THEN v_team_a
      ELSE v_team_b
    END;

    -- Mark this fixture complete
    UPDATE tournament_fixtures
    SET
      status      = 'completed',
      "winnerSide" = p_winner_side
    WHERE id = p_fixture_id;

    -- Advance winner to the next bracket slot
    IF v_next_match_id IS NOT NULL AND v_winner_name IS NOT NULL THEN
      IF v_bracket_parent = 'A' THEN
        UPDATE tournament_fixtures
        SET "teamA" = v_winner_name
        WHERE id = v_next_match_id;
      ELSE
        UPDATE tournament_fixtures
        SET "teamB" = v_winner_name
        WHERE id = v_next_match_id;
      END IF;
    END IF;

  END IF;
END;
$$;


-- ============================================================
-- 4. get_game_summary
--    Returns a JSONB blob with:
--      - Full game data
--      - Sport event counts by type
--      - Basketball shot stats (if applicable)
--    Used by SpectatorView post-game panel and stats pages.
-- ============================================================
CREATE OR REPLACE FUNCTION get_game_summary(p_game_code TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'game', g.data,
    'sport_events', (
      SELECT COALESCE(
        jsonb_object_agg(event_type, cnt),
        '{}'::jsonb
      )
      FROM (
        SELECT event_type, COUNT(*) AS cnt
        FROM   sport_events
        WHERE  game_code = p_game_code
        GROUP  BY event_type
      ) evt
    ),
    'shot_stats', (
      SELECT jsonb_build_object(
        'total',      COUNT(*),
        'made',       COUNT(*) FILTER (WHERE made = TRUE),
        'missed',     COUNT(*) FILTER (WHERE made = FALSE),
        'total_pts',  COALESCE(SUM(points), 0),
        'fg_pct',     ROUND(
                        100.0 * COUNT(*) FILTER (WHERE made = TRUE AND points <> 1)
                        / NULLIF(COUNT(*) FILTER (WHERE points <> 1), 0),
                        1
                      )
      )
      FROM shot_events
      WHERE game_code = p_game_code
    )
  )
  FROM games g
  WHERE g.code = p_game_code;
$$;


-- ============================================================
-- Grant execute permissions to authenticated users
-- ============================================================
GRANT EXECUTE ON FUNCTION get_live_games(TEXT, INTEGER)     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_sport_event(TEXT, TEXT, TEXT, CHAR, TEXT, TEXT, INTEGER, INTEGER, INTEGER, JSONB)
                                                             TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_game_with_result(TEXT, JSONB, UUID, CHAR)
                                                             TO authenticated;
GRANT EXECUTE ON FUNCTION get_game_summary(TEXT)             TO authenticated, anon;
