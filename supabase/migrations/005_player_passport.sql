CREATE TABLE IF NOT EXISTS players (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT,
  name          TEXT        NOT NULL,
  display_name  TEXT,
  jersey_number TEXT,
  photo_url     TEXT,
  bio           TEXT,
  sport_ids     TEXT[]      DEFAULT '{}',
  registered_by TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_user_id     ON players (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_name_search ON players USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_players_sport_ids   ON players USING gin(sport_ids);

CREATE TABLE IF NOT EXISTS player_sport_stats (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id      UUID    REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  sport_id       TEXT    NOT NULL,
  games_played   INTEGER DEFAULT 0 NOT NULL,
  total_score    INTEGER DEFAULT 0 NOT NULL,
  stats          JSONB   DEFAULT '{}' NOT NULL,
  last_played_at TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(player_id, sport_id)
);

CREATE INDEX IF NOT EXISTS idx_player_sport_stats_player ON player_sport_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_player_sport_stats_sport  ON player_sport_stats (sport_id, total_score DESC);

ALTER TABLE players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sport_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY players_public_read
  ON players FOR SELECT USING (true);

CREATE POLICY player_sport_stats_public_read
  ON player_sport_stats FOR SELECT USING (true);

CREATE POLICY players_auth_insert
  ON players FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND registered_by = auth.uid()::text);

CREATE POLICY players_update
  ON players FOR UPDATE
  USING (registered_by = auth.uid()::text OR user_id = auth.uid()::text);

CREATE POLICY player_stats_insert
  ON player_sport_stats FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY player_stats_update
  ON player_sport_stats FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION get_player_leaderboard(
  p_sport_id TEXT    DEFAULT NULL,
  p_limit    INTEGER DEFAULT 20
)
RETURNS TABLE (
  player_id     UUID,
  name          TEXT,
  display_name  TEXT,
  jersey_number TEXT,
  sport_ids     TEXT[],
  sport_id      TEXT,
  games_played  INTEGER,
  total_score   INTEGER,
  stats         JSONB
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    p.id, p.name, p.display_name, p.jersey_number, p.sport_ids,
    pss.sport_id, pss.games_played, pss.total_score, pss.stats
  FROM players p
  JOIN player_sport_stats pss ON pss.player_id = p.id
  WHERE (p_sport_id IS NULL OR pss.sport_id = p_sport_id)
  ORDER BY pss.total_score DESC, pss.games_played DESC
  LIMIT LEAST(p_limit, 100);
$$;

CREATE OR REPLACE FUNCTION upsert_player_sport_stats(
  p_player_id   UUID,
  p_sport_id    TEXT,
  p_score_delta INTEGER DEFAULT 0,
  p_stats_patch JSONB   DEFAULT '{}'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO player_sport_stats (player_id, sport_id, games_played, total_score, stats, last_played_at)
  VALUES (p_player_id, p_sport_id, 1, p_score_delta, p_stats_patch, NOW())
  ON CONFLICT (player_id, sport_id) DO UPDATE
  SET
    games_played   = player_sport_stats.games_played + 1,
    total_score    = player_sport_stats.total_score + p_score_delta,
    stats          = player_sport_stats.stats || p_stats_patch,
    last_played_at = NOW(),
    updated_at     = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION get_player_leaderboard(TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION upsert_player_sport_stats(UUID, TEXT, INTEGER, JSONB) TO authenticated;
