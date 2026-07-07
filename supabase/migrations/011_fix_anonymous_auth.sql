-- 011_fix_anonymous_auth.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- UNBLOCK COACH MODE (companion app) — two server-side fixes in one pass.
--
-- Problem 1: `coach_annotations` was never created in prod (migration 010 not
--            applied) → annotation SAVE returns 404 and shot_events may not be
--            in the realtime publication (no coach popup).
-- Problem 2: anonymous sign-in is broken — `POST /auth/v1/signup {}` → 500
--            "Database error creating anonymous user". A trigger on auth.users
--            (added outside tracked migrations) errors on null-email / anonymous
--            rows. This also breaks the app's guest / DEV-ACCESS login, so coaches
--            cannot SAVE without a full account.
--
-- HOW TO RUN (Supabase SQL editor, project eoowagimooxsqcrrihbw):
--   1. Run STEP 1 (diagnostics) ALONE. Paste the output back to the agent.
--   2. Run STEP 2 (idempotent re-assert of migration 010) — always safe.
--   3. Complete + run STEP 3 (anon-auth fix) using the function name from STEP 1.
--
-- Nothing here drops data. STEP 3's destructive option (dropping a trigger) is
-- commented out — prefer the non-destructive "make the function anon-safe" path.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1 — DIAGNOSTICS (run first; paste the results back, change nothing yet)
-- ───────────────────────────────────────────────────────────────────────────

-- D1. User-defined triggers on auth.users + the FULL source of each function.
--     This is the smoking gun: one of these functions errors on a null-email /
--     anonymous insert. Note the trigger name, the function (schema.name), and
--     read its body for where it touches `new.email` / inserts into a profiles
--     table with a NOT NULL or UNIQUE constraint.
select t.tgname                                   as trigger_name,
       case t.tgtype & 2 when 2 then 'BEFORE' else 'AFTER' end as timing,
       n.nspname || '.' || p.proname              as function,
       pg_get_functiondef(p.oid)                  as function_source
from pg_trigger t
join pg_proc p      on p.oid = t.tgfoid
join pg_namespace n on n.oid = p.pronamespace
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
order by t.tgname;

-- D2. Confirm GoTrue's anonymous-user column exists (modern projects have it).
select column_name
from information_schema.columns
where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous';

-- D3. Is shot_events (and coach_annotations) already in the realtime publication?
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('shot_events', 'coach_annotations');

-- D4. Does coach_annotations exist yet?
select to_regclass('public.coach_annotations') as coach_annotations_table;


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2 — RE-ASSERT MIGRATION 010 (idempotent; safe to run even if partial)
--          Mirror of 010_coach_annotations.sql so running THIS file alone is
--          enough to stand up Coach Mode's storage + realtime.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists coach_annotations (
    id              uuid primary key default gen_random_uuid(),
    game_code       text not null,
    shot_event_id   uuid references shot_events(id) on delete cascade,
    coach_id        uuid not null,
    coach_team      text not null check (coach_team in ('A','B')),
    team_side       text not null check (team_side in ('A','B')),
    points          int,
    zone            text,
    x               numeric,
    y               numeric,
    attributes      jsonb not null default '[]'::jsonb,
    player_id       text,
    player_name     text,
    period          int,
    game_clock_sec  int,
    skipped         boolean not null default false,
    created_at      timestamptz not null default now()
);

create index if not exists idx_coach_ann_game_coach on coach_annotations (game_code, coach_id);
create index if not exists idx_coach_ann_shot       on coach_annotations (shot_event_id);

alter table coach_annotations enable row level security;

drop policy if exists coach_ann_insert on coach_annotations;
create policy coach_ann_insert on coach_annotations for insert with check (auth.uid() = coach_id);

drop policy if exists coach_ann_select on coach_annotations;
create policy coach_ann_select on coach_annotations for select using (auth.uid() = coach_id);

drop policy if exists coach_ann_update on coach_annotations;
create policy coach_ann_update on coach_annotations for update using (auth.uid() = coach_id);

drop policy if exists coach_ann_delete on coach_annotations;
create policy coach_ann_delete on coach_annotations for delete using (auth.uid() = coach_id);

-- shot_events must be in the realtime publication for the coach popup
-- (postgres_changes INSERT/DELETE). Idempotent.
do $$ begin
    alter publication supabase_realtime add table shot_events;
exception when duplicate_object then null; end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3 — FIX THE ANONYMOUS-AUTH TRIGGER
--          Complete this from STEP 1 (D1) output, then run. Two options:
--          OPTION A (PREFERRED, non-destructive) — make the offending function
--          anon-safe. OPTION B (last resort) — drop a purely-spurious guard.
-- ───────────────────────────────────────────────────────────────────────────

-- ── OPTION A — make the trigger function tolerant of anonymous / null-email ──
-- The common culprit is a SECURITY DEFINER function (often public.handle_new_user)
-- on `after insert on auth.users` that copies new.email into a profiles row and
-- chokes when email is null (anonymous users). Re-create that function with an
-- early guard at the TOP of its body, KEEPING the rest of its logic verbatim from
-- D1's `function_source`:
--
--   create or replace function <schema>.<function_name>()
--   returns trigger
--   language plpgsql
--   security definer set search_path = public, auth   -- match the original
--   as $fn$
--   begin
--     -- Skip profile/side-effect creation for guest / anonymous sign-ins.
--     if coalesce(new.is_anonymous, false) or new.email is null then
--       return new;
--     end if;
--
--     -- ↓↓↓ PASTE THE ORIGINAL FUNCTION BODY (from D1.function_source) BELOW ↓↓↓
--
--     return new;
--   end;
--   $fn$;
--
-- No trigger re-create needed — CREATE OR REPLACE swaps the body in place.
-- (If D2 returned no row, the project predates is_anonymous; use just
--  `if new.email is null then return new; end if;`.)


-- ── OPTION B — drop a spurious guard trigger (use ONLY if D1 shows a trigger
--    whose sole job is `raise exception … when email is null` with no other
--    purpose). Replace the names from D1. Destructive to that trigger only: ──
--
--   -- drop trigger <trigger_name> on auth.users;
--   -- drop function if exists <schema>.<function_name>();   -- only if unused elsewhere


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 4 — VERIFY (run after STEP 3)
-- ───────────────────────────────────────────────────────────────────────────
-- a) Anonymous signup should now succeed (run from a shell, anon key):
--      curl -X POST "https://eoowagimooxsqcrrihbw.supabase.co/auth/v1/signup" \
--        -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" -d '{}'
--    → expect 200 with an access_token (NOT 500).
-- b) coach_annotations exists with RLS:
--      select to_regclass('public.coach_annotations');           -- not null
--      select count(*) from pg_policies where tablename='coach_annotations';  -- = 4
-- c) shot_events is published:
--      select 1 from pg_publication_tables
--      where pubname='supabase_realtime' and tablename='shot_events';          -- 1 row
