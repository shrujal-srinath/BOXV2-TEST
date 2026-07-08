-- 014_stats_persistence.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- THE AFTER-GAME STATS ENGINE'S STORAGE (PLAN-U P3, designed 2026-07-08).
--
-- Decision (Shrujal, 2026-07-08): SAVE ALL NOW, LINK WHEN KNOWN — every
-- game's full per-player package persists immediately, keyed by the per-game
-- roster id; player_profile_id is NULLABLE and fills when rosters are linked
-- to passports (GameSetup search / retro-claim, PLAN-A §7 + master ctx §8).
-- Teams become a real entity (quick-create in GameSetup later; name-only rows
-- keep team_id NULL). Rows are written by persistGameReport()
-- (src/services/statsPersistService.ts) — idempotent upserts, triggered
-- lazily from the stats surfaces (web hub + Pi match report).
--
-- RLS posture matches shot_events: public SELECT, anon+authenticated writes
-- (web hosts can be anonymous guests). Tightening is PLAN-A territory.
-- Additive only; legacy player_game_log/player_sport_stats untouched.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. teams ────────────────────────────────────────────────────────────────
create table if not exists teams (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    short_code  text,
    color       text,
    logo_url    text,
    created_by  uuid references auth.users(id) on delete set null,
    created_at  timestamptz not null default now(),
    unique (created_by, name)
);

-- ── 2. game_player_stats — one row per player per game ─────────────────────
create table if not exists game_player_stats (
    id                 uuid primary key default gen_random_uuid(),
    game_code          text not null,
    sport_id           text not null default 'basketball',
    roster_player_id   text not null,                -- per-game roster id (always known)
    player_profile_id  uuid references player_profiles(id) on delete set null,
    player_name        text,
    player_number      text,
    team_side          text check (team_side in ('A','B')),
    team_id            uuid references teams(id) on delete set null,
    team_name          text,
    line               jsonb not null,               -- BoxScoreRow + gameScore + pie
    zones              jsonb,                        -- ZoneAggregate[] (advanced)
    quality            jsonb,                        -- ShotQualitySummary
    attributes         jsonb,                        -- AttributeSplit[]
    periods            jsonb,                        -- PeriodScore[]
    computed_at        timestamptz not null default now(),
    unique (game_code, roster_player_id)
);
create index if not exists gps_profile_idx on game_player_stats (player_profile_id) where player_profile_id is not null;
create index if not exists gps_game_idx    on game_player_stats (game_code);

-- ── 3. game_team_stats — one row per side per game ─────────────────────────
create table if not exists game_team_stats (
    id            uuid primary key default gen_random_uuid(),
    game_code     text not null,
    sport_id      text not null default 'basketball',
    team_side     text not null check (team_side in ('A','B')),
    team_id       uuid references teams(id) on delete set null,
    team_name     text,
    totals        jsonb not null,                    -- TeamBoxScore.totals
    special       jsonb,                             -- SpecialPoints
    four_factors  jsonb,                             -- FourFactors (null for quick)
    ratings       jsonb,                             -- TeamRatings
    result        jsonb not null,                    -- {ptsFor, ptsAgainst, won, opponentName}
    computed_at   timestamptz not null default now(),
    unique (game_code, team_side)
);
create index if not exists gts_team_idx on game_team_stats (team_id) where team_id is not null;

-- ── 4. backfill marker on games ─────────────────────────────────────────────
alter table games add column if not exists stats_generated_at timestamptz;

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
alter table teams enable row level security;
alter table game_player_stats enable row level security;
alter table game_team_stats enable row level security;

drop policy if exists teams_select on teams;
create policy teams_select on teams for select using (true);
drop policy if exists teams_insert on teams;
create policy teams_insert on teams for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists gps_select on game_player_stats;
create policy gps_select on game_player_stats for select using (true);
drop policy if exists gps_write on game_player_stats;
create policy gps_write on game_player_stats for insert to anon, authenticated with check (true);
drop policy if exists gps_update on game_player_stats;
create policy gps_update on game_player_stats for update to anon, authenticated using (true);

drop policy if exists gts_select on game_team_stats;
create policy gts_select on game_team_stats for select using (true);
drop policy if exists gts_write on game_team_stats;
create policy gts_write on game_team_stats for insert to anon, authenticated with check (true);
drop policy if exists gts_update on game_team_stats;
create policy gts_update on game_team_stats for update to anon, authenticated using (true);

-- ── 6. Career views (computed on read — correct by construction) ───────────
create or replace view v_player_career as
select
    p.player_profile_id,
    p.sport_id,
    count(*)                                            as games_played,
    sum((p.line->>'pts')::numeric)                      as total_pts,
    avg((p.line->>'pts')::numeric)                      as ppg,
    avg((p.line->>'reb')::numeric)                      as rpg,
    avg((p.line->>'ast')::numeric)                      as apg,
    sum((p.line->>'fgm')::numeric)                      as fgm,
    sum((p.line->>'fga')::numeric)                      as fga,
    sum((p.line->>'tpm')::numeric)                      as tpm,
    sum((p.line->>'tpa')::numeric)                      as tpa,
    sum((p.line->>'ftm')::numeric)                      as ftm,
    sum((p.line->>'fta')::numeric)                      as fta,
    max((p.line->>'pts')::numeric)                      as career_high_pts,
    avg((p.line->>'gameScore')::numeric)                as avg_game_score,
    max(p.computed_at)                                  as last_played_at
from game_player_stats p
where p.player_profile_id is not null
group by p.player_profile_id, p.sport_id;

create or replace view v_team_career as
select
    t.team_id,
    t.sport_id,
    count(*)                                            as games_played,
    sum(case when (t.result->>'won')::boolean then 1 else 0 end) as wins,
    avg((t.result->>'ptsFor')::numeric)                 as avg_pts_for,
    avg((t.result->>'ptsAgainst')::numeric)             as avg_pts_against,
    max(t.computed_at)                                  as last_played_at
from game_team_stats t
where t.team_id is not null
group by t.team_id, t.sport_id;

-- Verify:
--   select to_regclass('public.game_player_stats');  -- not null
--   select count(*) from pg_policies where tablename in ('teams','game_player_stats','game_team_stats');  -- 8
