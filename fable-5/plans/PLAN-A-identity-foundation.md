# PLAN A — Identity Foundation (one human = one account)

> Fable 5, 2026-07-07. Implements master context §7. Read that section first — it holds the
> reasoning; this file holds the execution. **Everything server-side here must be tested on a
> Supabase branch (or at minimum dry-read against prod) before touching the live project —
> three shipped apps share this database.**

## Phase 0 — Reconnaissance (no writes; BLOCKS everything else)

1. Refresh `SUPABASE_ACCESS_TOKEN` (supabase.com/dashboard → account → tokens); confirm MCP
   works with `list_tables`.
2. Run the STEP 1 diagnostics of `supabase/migrations/011_fix_anonymous_auth.sql` (D1–D4) in
   the SQL editor. Paste D1's `function_source` output into the session — the anon-fix in
   Phase 1 must preserve that exact body.
3. Record which migrations are actually applied (BOX 001–012, Courtside 001–005) and update
   master context §6.4 with the findings.
4. Dashboard checks (Auth → Providers/Settings): phone provider + SMS sender configured? ·
   manual identity linking enabled? · email confirmation required? · anonymous sign-ins
   enabled? Record all four answers in this file.

**Stop condition:** if D1 shows a trigger that is NOT a recognizable profile-creation function
(something unexpected touching auth.users), stop and show Shrujal before changing it.

## Phase 1 — Apply 011 (unblocks Coach Mode + guest login everywhere)

Run 011 STEP 2 (idempotent coach_annotations + realtime publication), then STEP 3 OPTION A
using the real function body from Phase 0, then STEP 4 verification (anonymous signup curl
must return 200). Update COMPANION-APP.md §7 and master context §4.4/§11 to mark blockers
cleared.

## Phase 2 — Migration 013_identity_bridge (draft below; adapt to Phase-0 findings, then apply)

Create `supabase/migrations/013_identity_bridge.sql` in BOXV2 from the draft below. Review
points for the executor: (a) confirm `auth.users.phone` is the canonical phone column in this
project (D2-era GoTrue: yes); (b) confirm `player_profiles.phone_number` storage format and
align `normalize_phone` with what the Player Passport form actually saves; (c) run on a branch
first if branching is available.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 013_identity_bridge.sql — one human = one auth.users row (master context §7)
-- Drafted by Fable 5 2026-07-07. ADAPT TO PHASE-0 FINDINGS BEFORE APPLYING.
-- Additive only: no drops, no data mutation (merge tool mutates, but only when
-- explicitly invoked with service_role).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. One account ⇄ at most one passport ───────────────────────────────────
create unique index if not exists player_profiles_auth_user_uniq
  on player_profiles (auth_user_id) where auth_user_id is not null;

-- ── 2. Phone normalization (India-default; keep in sync with client forms) ──
create or replace function normalize_phone(p text)
returns text language sql immutable as $$
  select case
    when p is null or btrim(p) = '' then null
    -- already E.164
    when regexp_replace(p, '[^0-9+]', '', 'g') ~ '^\+[0-9]{8,15}$'
      then regexp_replace(p, '[^0-9+]', '', 'g')
    -- bare 10-digit Indian mobile → +91
    when regexp_replace(p, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'
      then '+91' || regexp_replace(p, '[^0-9]', '', 'g')
    -- 0- or 91-prefixed Indian numbers
    when regexp_replace(p, '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$'
      then '+91' || right(regexp_replace(p, '[^0-9]', '', 'g'), 10)
    when regexp_replace(p, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$'
      then '+' || regexp_replace(p, '[^0-9]', '', 'g')
    else nullif(regexp_replace(p, '[^0-9+]', '', 'g'), '')
  end;
$$;

-- NOTE: auth.users.phone stores digits WITHOUT '+' (GoTrue convention, e.g.
-- '919876543210'). All comparisons below strip '+' for the auth side. VERIFY
-- against a real row in Phase 0 and adjust if this project differs.

-- ── 3. resolve_identity — called by every signup/login screen BEFORE creating
--       anything. Callable pre-auth (anon). Returns masked hints only. ────────
create or replace function resolve_identity(p_email text default null,
                                            p_phone text default null)
returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_phone   text := normalize_phone(p_phone);
  v_email   text := lower(nullif(btrim(p_email), ''));
  v_user    auth.users%rowtype;
  v_methods text[];
  v_pp      record;
begin
  -- 3a. Existing account by email?
  if v_email is not null then
    select * into v_user from auth.users
     where lower(email) = v_email
       and coalesce(is_anonymous, false) = false
     limit 1;
  end if;

  -- 3b. Existing account by phone (auth-side, '+'-stripped)?
  if v_user.id is null and v_phone is not null then
    select * into v_user from auth.users
     where phone = ltrim(v_phone, '+')
       and coalesce(is_anonymous, false) = false
     limit 1;
  end if;

  if v_user.id is not null then
    select coalesce(array_agg(distinct provider), '{}') into v_methods
      from auth.identities where user_id = v_user.id;
    return jsonb_build_object(
      'status',  'existing_account',
      'methods', to_jsonb(v_methods),
      -- masked hints only — never raw PII to a pre-auth caller
      'email_hint', case when v_user.email is null then null
        else regexp_replace(v_user.email, '^(.).*(@.*)$', '\1***\2') end,
      'phone_hint', case when v_user.phone is null then null
        else '••••••' || right(v_user.phone, 4) end
    );
  end if;

  -- 3c. Unclaimed passport by phone (host-registered player)?
  if v_phone is not null then
    select id, player_code into v_pp from player_profiles
     where normalize_phone(phone_number) = v_phone
       and auth_user_id is null
     limit 1;
    if v_pp.id is not null then
      return jsonb_build_object('status', 'unclaimed_passport',
                                'player_code', v_pp.player_code);
    end if;
  end if;

  return jsonb_build_object('status', 'new');
end;
$$;
revoke all on function resolve_identity(text, text) from public;
grant execute on function resolve_identity(text, text) to anon, authenticated;

-- ── 4. claim_player_profile — proof-of-possession claim of a passport ───────
create or replace function claim_player_profile()
returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_uid   uuid := auth.uid();
  v_user  auth.users%rowtype;
  v_id    uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_user from auth.users where id = v_uid;
  if coalesce(v_user.is_anonymous, false) then
    raise exception 'guests cannot claim a passport';
  end if;

  -- match by VERIFIED phone first, then verified email
  update player_profiles set auth_user_id = v_uid, is_claimed = true,
         updated_at = now()
   where auth_user_id is null
     and id = (
       select id from player_profiles
        where auth_user_id is null
          and (
            (v_user.phone is not null and v_user.phone_confirmed_at is not null
              and normalize_phone(phone_number) = '+' || v_user.phone)
            or
            (v_user.email is not null and v_user.email_confirmed_at is not null
              and lower(email) = lower(v_user.email))
          )
        limit 1)
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('status', 'no_match');
  end if;
  return jsonb_build_object('status', 'claimed', 'player_profile_id', v_id);
end;
$$;
revoke all on function claim_player_profile() from public;
grant execute on function claim_player_profile() to authenticated;

-- ── 5. merge_users — admin repair tool for pre-existing duplicates ──────────
-- service_role ONLY. Repoints every FK to auth.users from dup → primary,
-- special-casing 1:1 profile tables (delete dup's row, keep primary's), then
-- deletes the dup auth user. Run inside a transaction; test on a branch first.
create or replace function merge_users(p_primary uuid, p_dup uuid)
returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare
  r record;
  v_moved jsonb := '[]'::jsonb;
  v_n int;
begin
  if p_primary = p_dup then raise exception 'primary = dup'; end if;
  perform 1 from auth.users where id = p_primary;
  if not found then raise exception 'primary user not found'; end if;

  -- 1:1 tables keyed BY auth id: keep primary's row, drop dup's.
  delete from user_profiles where id = p_dup
     and exists (select 1 from user_profiles where id = p_primary);
  update user_profiles set id = p_primary where id = p_dup;  -- dup-only case

  -- passport: if both users hold one, keep primary's (unique index protects us)
  update player_profiles set auth_user_id = p_primary
   where auth_user_id = p_dup
     and not exists (select 1 from player_profiles where auth_user_id = p_primary);
  update player_profiles set auth_user_id = null, is_claimed = false
   where auth_user_id = p_dup;  -- primary already had one → orphan the dup's

  -- every other FK column in public referencing auth.users: repoint dynamically
  for r in
    select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name
       and kcu.table_schema = tc.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
     where tc.constraint_type = 'FOREIGN KEY'
       and tc.table_schema = 'public'
       and ccu.table_schema = 'auth' and ccu.table_name = 'users'
       and tc.table_name not in ('user_profiles', 'player_profiles')
  loop
    execute format('update public.%I set %I = $1 where %I = $2',
                   r.table_name, r.column_name, r.column_name)
      using p_primary, p_dup;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_moved := v_moved || jsonb_build_object('table', r.table_name,
                              'column', r.column_name, 'rows', v_n);
    end if;
  end loop;

  -- games.hostId lives in a text/uuid column WITHOUT an FK — handle explicitly.
  -- VERIFY column name + type in Phase 0 (games table predates conventions):
  -- execute 'update public.games set "hostId" = $1 where "hostId" = $2' ...

  delete from auth.users where id = p_dup;
  return jsonb_build_object('status', 'merged', 'moved', v_moved);
end;
$$;
revoke all on function merge_users(uuid, uuid) from public, anon, authenticated;
```

**Verify after applying:** `select resolve_identity(null,'9876543210')` → `{"status":"new"}` ·
seed a fake unclaimed passport + confirm `unclaimed_passport` comes back · confirm anon role can
execute resolve_identity but NOT merge_users.

## Phase 3 — Client flows (Courtside first, then website + box app)

1. **Courtside** `phone_auth_screen.dart` + `login_screen.dart`: before any signup path, call
   `supabase.rpc('resolve_identity', params)` → route on status: `existing_account` → "You
   already have an account (g***@gmail.com) — continue with Google / send OTP to log in" (log
   into the EXISTING account; never create) · `unclaimed_passport` → proceed with signup, then
   immediately call `claim_player_profile()` and show "your BOX passport BOX-XXX was linked" ·
   `new` → normal signup.
2. **Courtside onboarding**: for Google/email users, add a required "verify your phone" step —
   `supabase.auth.updateUser(UserAttributes(phone: e164))` + `verifyOTP(type: phoneChange)`.
   This is the single change that prevents future phone/email splits (Case A).
3. **BOX website + the_box_app**: after any successful non-anonymous login, call
   `claim_player_profile()` once (idempotent — `no_match` is fine); on `claimed`, toast the
   passport link.
4. Keep guest flows untouched — anonymous users skip all of this.

## Phase 4 — Duplicate audit + merge

SQL to find candidates: group non-anonymous `auth.users` by `lower(email)` and by `phone`
having count>1; plus phone strings appearing in both `player_profiles.phone_number`
(normalized) and a different user's auth phone. Present the list to Shrujal — **he confirms
each pair by hand** — then `merge_users` one at a time, checking app behavior after the first.

## Test matrix (all must pass before calling PLAN A done — use throwaway test humans)

| # | Scenario | Expected |
|---|---|---|
| 1 | Google first → later phone-OTP entry with linked phone | resolves to SAME user, no second account |
| 2 | Google first, phone never linked → phone-OTP entry | resolve_identity returns existing_account (only if phone known via passport) or clean new-account UX — never a silent split for a linked user |
| 3 | email+password signup → Google login, same address | ONE auth user (verify project's auto-linking; record behavior in master context §7.5) |
| 4 | Host registers passport w/ phone → that human signs up by phone | signup proceeds; claim fires; passport linked + is_claimed |
| 5 | Guest session → upgrade to real account | no orphan profile rows; profile created on upgrade only |
| 6 | merge_users on a seeded dup pair | all FK rows follow primary; dup gone; apps behave |
