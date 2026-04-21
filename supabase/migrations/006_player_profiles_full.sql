-- ============================================================
-- THE BOX — Migration 006: Full Player Profile System
-- Replaces thin `players` + `player_sport_stats` tables (005)
-- with a rich athlete identity + teams + game log schema.
-- ============================================================

-- Drop old tables from migration 005 (0 rows, safe)
DROP TABLE IF EXISTS player_sport_stats CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- ── 1. player_profiles ────────────────────────────────────────
CREATE TABLE player_profiles (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Identity
  full_name         text        NOT NULL,
  display_name      text,
  date_of_birth     date,
  gender            text        CHECK (gender IN ('male','female','other','prefer_not_to_say')),

  -- Contact
  phone_number      text        UNIQUE,
  email             text,

  -- Academic / Institutional
  usn               text,
  college_name      text,
  college_roll_no   text,

  -- Physical
  height_cm         smallint,
  weight_kg         smallint,
  dominant_hand     text        CHECK (dominant_hand IN ('left','right','ambidextrous')),

  -- Athletic defaults (overridable per team)
  primary_position  text,
  jersey_number     text,

  -- Sports
  sport_ids         text[]      DEFAULT '{}',

  -- Profile
  bio               text        CHECK (char_length(bio) <= 280),
  profile_photo_url text,

  -- Passport identity
  player_code       text        UNIQUE NOT NULL,

  -- Status
  is_verified       boolean     DEFAULT false,
  is_claimed        boolean     DEFAULT false,
  registered_by     uuid        REFERENCES auth.users(id),

  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ── 2. player_teams ───────────────────────────────────────────
CREATE TABLE player_teams (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid        NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  team_type     text        NOT NULL CHECK (team_type IN ('college','club','school','state','national','pickup')),
  team_name     text        NOT NULL,
  jersey_number text,
  position      text,
  role          text        CHECK (role IN ('player','captain','vice_captain','coach')),
  season_from   text,
  season_to     text,
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ── 3. player_sport_stats (aggregate per sport) ───────────────
CREATE TABLE player_sport_stats (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid        NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  sport_id       text        NOT NULL,
  games_played   integer     DEFAULT 0 NOT NULL,
  total_score    integer     DEFAULT 0 NOT NULL,
  stats          jsonb       DEFAULT '{}' NOT NULL,
  last_played_at timestamptz,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE(player_id, sport_id)
);

-- ── 4. player_game_log (per-game record) ──────────────────────
CREATE TABLE player_game_log (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id          uuid        NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  game_code          text        NOT NULL,
  sport_id           text        NOT NULL,
  tournament_id      text,
  team_side          text        CHECK (team_side IN ('A','B')),
  team_name          text,
  score_contribution integer     DEFAULT 0,
  sport_stats        jsonb       DEFAULT '{}',
  input_method       text        DEFAULT 'auto',
  created_at         timestamptz DEFAULT now()
);

-- ── 5. player_follows ─────────────────────────────────────────
CREATE TABLE player_follows (
  follower_id  uuid REFERENCES player_profiles(id) ON DELETE CASCADE,
  following_id uuid REFERENCES player_profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_player_profiles_auth      ON player_profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX idx_player_profiles_code      ON player_profiles(player_code);
CREATE INDEX idx_player_profiles_phone     ON player_profiles(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_player_profiles_college   ON player_profiles(college_name) WHERE college_name IS NOT NULL;
CREATE INDEX idx_player_profiles_name_gin  ON player_profiles USING gin(to_tsvector('simple', full_name));
CREATE INDEX idx_player_profiles_sports    ON player_profiles USING gin(sport_ids);
CREATE INDEX idx_player_teams_player       ON player_teams(player_id);
CREATE INDEX idx_player_teams_active       ON player_teams(player_id) WHERE is_active = true;
CREATE INDEX idx_player_sport_stats_player ON player_sport_stats(player_id);
CREATE INDEX idx_player_sport_stats_board  ON player_sport_stats(sport_id, total_score DESC);
CREATE INDEX idx_player_game_log_player    ON player_game_log(player_id, created_at DESC);
CREATE INDEX idx_player_game_log_game      ON player_game_log(game_code);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE player_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sport_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_follows     ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_public_read  ON player_profiles FOR SELECT USING (true);
CREATE POLICY pp_auth_insert  ON player_profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY pp_owner_update ON player_profiles FOR UPDATE
  USING (auth.uid() = auth_user_id OR auth.uid() = registered_by);
CREATE POLICY pp_owner_delete ON player_profiles FOR DELETE
  USING (auth.uid() = auth_user_id);

CREATE POLICY pt_public_read  ON player_teams FOR SELECT USING (true);
CREATE POLICY pt_auth_insert  ON player_teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY pt_owner_update ON player_teams FOR UPDATE
  USING (auth.uid() = (SELECT auth_user_id FROM player_profiles WHERE id = player_id)
      OR auth.uid() = (SELECT registered_by  FROM player_profiles WHERE id = player_id));
CREATE POLICY pt_owner_delete ON player_teams FOR DELETE
  USING (auth.uid() = (SELECT auth_user_id FROM player_profiles WHERE id = player_id));

CREATE POLICY pss_public_read ON player_sport_stats FOR SELECT USING (true);
CREATE POLICY pss_auth_write  ON player_sport_stats FOR ALL  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY pgl_public_read ON player_game_log FOR SELECT USING (true);
CREATE POLICY pgl_auth_insert ON player_game_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY pf_public_read  ON player_follows FOR SELECT USING (true);
CREATE POLICY pf_owner_insert ON player_follows FOR INSERT
  WITH CHECK (auth.uid() = (SELECT auth_user_id FROM player_profiles WHERE id = follower_id));
CREATE POLICY pf_owner_delete ON player_follows FOR DELETE
  USING (auth.uid() = (SELECT auth_user_id FROM player_profiles WHERE id = follower_id));

-- ── updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_profiles_updated_at
  BEFORE UPDATE ON player_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RPCs ──────────────────────────────────────────────────────

-- 1. Generate BOX-XXX-1234 player code
CREATE OR REPLACE FUNCTION generate_player_code(p_full_name text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  name_part text;
  code      text;
  attempts  int := 0;
BEGIN
  name_part := UPPER(LEFT(REGEXP_REPLACE(p_full_name, '[^A-Za-z]', '', 'g'), 3));
  IF LENGTH(name_part) < 3 THEN
    name_part := RPAD(name_part, 3, 'X');
  END IF;
  LOOP
    code := 'BOX-' || name_part || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM player_profiles WHERE player_code = code);
    attempts := attempts + 1;
    IF attempts > 100 THEN RAISE EXCEPTION 'Could not generate unique player code'; END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- 2. Leaderboard
CREATE OR REPLACE FUNCTION get_player_leaderboard(
  p_sport_id text    DEFAULT NULL,
  p_limit    integer DEFAULT 20
)
RETURNS TABLE (
  player_id         uuid,
  full_name         text,
  display_name      text,
  jersey_number     text,
  player_code       text,
  college_name      text,
  profile_photo_url text,
  sport_ids         text[],
  sport_id          text,
  games_played      integer,
  total_score       integer,
  stats             jsonb
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    p.id, p.full_name, p.display_name, p.jersey_number, p.player_code,
    p.college_name, p.profile_photo_url, p.sport_ids,
    pss.sport_id, pss.games_played, pss.total_score, pss.stats
  FROM player_profiles p
  JOIN player_sport_stats pss ON pss.player_id = p.id
  WHERE (p_sport_id IS NULL OR pss.sport_id = p_sport_id)
  ORDER BY pss.total_score DESC, pss.games_played DESC
  LIMIT LEAST(p_limit, 100);
$$;

-- 3. Upsert sport stats (called at game end)
CREATE OR REPLACE FUNCTION upsert_player_sport_stats(
  p_player_id   uuid,
  p_sport_id    text,
  p_score_delta integer DEFAULT 0,
  p_stats_patch jsonb   DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO player_sport_stats (player_id, sport_id, games_played, total_score, stats, last_played_at)
  VALUES (p_player_id, p_sport_id, 1, p_score_delta, p_stats_patch, now())
  ON CONFLICT (player_id, sport_id) DO UPDATE SET
    games_played   = player_sport_stats.games_played + 1,
    total_score    = player_sport_stats.total_score + p_score_delta,
    stats          = player_sport_stats.stats || p_stats_patch,
    last_played_at = now(),
    updated_at     = now();
END;
$$;

-- 4. Claim a passport (links auth.uid() to an unclaimed profile)
CREATE OR REPLACE FUNCTION claim_player_profile(p_player_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE player_profiles
  SET auth_user_id = auth.uid(),
      is_claimed   = true,
      updated_at   = now()
  WHERE id = p_player_id
    AND auth_user_id IS NULL
    AND auth.uid() IS NOT NULL;
  RETURN FOUND;
END;
$$;

-- 5. Full-text player search
CREATE OR REPLACE FUNCTION search_players(
  p_query    text    DEFAULT NULL,
  p_sport_id text    DEFAULT NULL,
  p_limit    integer DEFAULT 20
)
RETURNS SETOF player_profiles
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT *
  FROM player_profiles
  WHERE
    (p_query IS NULL OR p_query = '' OR (
      full_name    ILIKE '%' || p_query || '%'
      OR college_name ILIKE '%' || p_query || '%'
      OR player_code  ILIKE '%' || p_query || '%'
      OR usn          ILIKE '%' || p_query || '%'
    ))
    AND (p_sport_id IS NULL OR sport_ids @> ARRAY[p_sport_id])
  ORDER BY is_claimed DESC, created_at DESC
  LIMIT LEAST(p_limit, 100);
$$;

-- ── Grants ────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION generate_player_code(text)                         TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_leaderboard(text, integer)              TO authenticated, anon;
GRANT EXECUTE ON FUNCTION upsert_player_sport_stats(uuid, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_player_profile(uuid)                         TO authenticated;
GRANT EXECUTE ON FUNCTION search_players(text, text, integer)                TO authenticated, anon;
