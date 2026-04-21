-- ============================================================
-- THE BOX — Migration 004: live_games_view
-- Additive only.
--
-- A flat, queryable view over the JSONB `games.data` column
-- for the most common display fields.
--
-- Consumers:
--   - WatchPage sidebar (sport, team names, scores, period)
--   - TV ticker bottom bar
--   - ArenaView multi-court display
--   - TvKiosk game discovery
--
-- These pages currently parse JSONB on the client side.
-- The view pushes that work to Postgres and allows simple
-- SELECT * queries without JSONB operators in client code.
-- ============================================================

CREATE OR REPLACE VIEW live_games_view AS
SELECT
  g.code,
  g.last_update,

  -- Sport
  (g.data->>'sportId')                         AS sport_id,
  (g.data->>'status')                          AS status,
  (g.data->>'hostId')                          AS host_id,
  (g.data->>'gameName')                        AS game_name,

  -- Team A
  (g.data->'teamA'->>'name')                   AS team_a_name,
  (g.data->'teamA'->>'color')                  AS team_a_color,
  ((g.data->'teamA'->>'score')::int)           AS team_a_score,

  -- Team B
  (g.data->'teamB'->>'name')                   AS team_b_name,
  (g.data->'teamB'->>'color')                  AS team_b_color,
  ((g.data->'teamB'->>'score')::int)           AS team_b_score,

  -- Clock / Period
  ((g.data->'gameState'->>'period')::int)      AS period,
  (g.data->'gameState'->>'gameRunning')::bool  AS game_running,

  -- Settings
  ((g.data->'settings'->>'courtNumber'))       AS court_number,
  ((g.data->'settings'->>'tournamentId'))      AS tournament_id

FROM games g
WHERE (g.data->>'status') = 'live';

-- Grant read access (same as games table policy)
GRANT SELECT ON live_games_view TO authenticated, anon;
