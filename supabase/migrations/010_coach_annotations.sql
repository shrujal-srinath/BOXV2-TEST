-- 010_coach_annotations.sql
-- ═══════════════════════════════════════════════════════════════
-- COACH MODE (companion app) — private per-coach shot enrichment.
--
-- When a referee scores in quick mode, the daemon writes a bare
-- shot_events row (zone='unlocated', player_id=null). A coach linked
-- to the game via the app annotates that shot — WHERE it came from,
-- WHAT kind of shot, WHO took it — into this table. The ref's
-- shot_events row stays authoritative; both teams' coaches annotate
-- the same play independently (one row per coach per shot).
--
-- Ref UNDO deletes the shot_events row → ON DELETE CASCADE removes
-- any annotations hanging off it automatically.
-- ═══════════════════════════════════════════════════════════════

create table if not exists coach_annotations (
    id              uuid primary key default gen_random_uuid(),
    game_code       text not null,
    shot_event_id   uuid references shot_events(id) on delete cascade,
    coach_id        uuid not null,                  -- auth.uid() (anonymous auth works)
    coach_team      text not null check (coach_team in ('A','B')),
    team_side       text not null check (team_side in ('A','B')), -- which team scored
    points          int,
    zone            text,
    x               numeric,
    y               numeric,
    attributes      jsonb not null default '[]'::jsonb,
    player_id       text,                           -- roster ids live in games.data (not a FK)
    player_name     text,
    period          int,
    game_clock_sec  int,
    skipped         boolean not null default false,
    created_at      timestamptz not null default now()
);

create index if not exists idx_coach_ann_game_coach
    on coach_annotations (game_code, coach_id);
create index if not exists idx_coach_ann_shot
    on coach_annotations (shot_event_id);

alter table coach_annotations enable row level security;

-- Coaches own their rows: insert/read/update only as themselves.
drop policy if exists coach_ann_insert on coach_annotations;
create policy coach_ann_insert on coach_annotations
    for insert with check (auth.uid() = coach_id);

drop policy if exists coach_ann_select on coach_annotations;
create policy coach_ann_select on coach_annotations
    for select using (auth.uid() = coach_id);

drop policy if exists coach_ann_update on coach_annotations;
create policy coach_ann_update on coach_annotations
    for update using (auth.uid() = coach_id);

drop policy if exists coach_ann_delete on coach_annotations;
create policy coach_ann_delete on coach_annotations
    for delete using (auth.uid() = coach_id);

-- Realtime: the coach popup trigger subscribes to INSERT/DELETE on
-- shot_events via postgres_changes — the table must be in the
-- supabase_realtime publication. Idempotent.
do $$ begin
    alter publication supabase_realtime add table shot_events;
exception when duplicate_object then null; end $$;
