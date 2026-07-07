# PLAN C — pi-daemon fixes (the top of the audited backlog)

> Fable 5, 2026-07-07. Source audit: master context §3.3 (2026-06-06 — **re-grep every cited
> behavior before editing; the daemon changed in the LAN work since**). Scope here = fixes
> 1–3, which unbreak cloud spectators and give the daemon a durable event journal + crash
> recovery. Fixes 4+ (FIBA buckets, epoch clock, tail) are follow-ups once these land.

## Ground rules

- The daemon runs on a real Pi at games. Every change must keep the LAN path (Socket.io
  `:3001`, `ui_action`/`state_update`) byte-compatible — the referee UI, LanControlPage, and
  the Flutter LanScorerScreen all speak it.
- Test harness: `dev_pico_message` lets you simulate button presses without hardware (it's
  also bug #14 — while you're in there, gate it behind `NODE_ENV !== 'production'` or an env
  flag).
- No schema invention: `game_actions` already exists and the website's `shotService.ts`
  already writes it — **copy the website's row shape exactly** so the stats engine reads both
  sources identically.

## Fix 1 — Cloud channel + event alignment (unbreaks off-LAN spectators)

Today: daemon broadcasts `clock_sync` on `box-${code}`; every web/app consumer listens on
`game:${code}` for the website vocabulary (master context §6.2).

1. In `pi-daemon/supabaseSync.js`: create/keep ONE channel `game:${currentGameCode}` on
   `setup_game` (fixes the create-race, bug #10), and emit the website vocabulary:
   `clock_tick` (1 Hz while running, `{minutes, seconds, tenths, shotClock, period,
   gameRunning, ts}`), `clock_start`/`clock_stop` on transitions, `score_update`
   (`{teamA, teamB, foulsA, foulsB, timeoutsA, timeoutsB, possession, period, ts}`),
   `period_change`, `shotclock_reset`, and a periodic `game_snapshot`.
2. Keep the exact field names/shapes from §6.2 — pull them from
   `src/services/supabaseBroadcastService.ts` (consumer side) rather than trusting docs.
3. Delete the `box-${code}`/`clock_sync` path once the new one is verified; grep ALL THREE
   repos for `box-` channel usage first (invariant: never a producer-only change).

**Verify:** run daemon locally (`node index.js`), open `theboxbybmsce.in/watch/<CODE>` (or
local SpectatorView) on a phone on cellular — clock must tick and scores land in <1 s.

## Fix 2 — Action journal (`game_actions` writer) + undo integrity

1. Add `writeGameAction(action)` to `supabaseSync.js` mirroring `writeShotEvent`'s offline
   queue/retry; call it from every state transition in `index.js`: scores (also, in addition
   to shot_events), fouls, timeouts, period changes, clock start/stop, possession flips, undo.
   Include `{game_code, action_type, team, payload jsonb, period, game_clock_sec, ts}` —
   match the website's `shotService.ts:writeGameAction` shape exactly.
2. **Undo (bug #5):** when UNDO pops a state snapshot that had inserted a `shot_events` row,
   DELETE that row (keep the returned id on the pending stack at insert time). This matches
   the app/website convention "ref UNDO = row DELETE" and lets coach_annotations CASCADE.
   Also journal the undo itself as an action.
3. `finishGame` (bug #8): flush any throttle-pending persist + queued actions synchronously
   before setting `status='completed'`.

**Verify:** score → undo → check Supabase: no orphan shot_events; game_actions shows both the
score and the undo. Kill the network mid-game → actions queue → restore → queue drains.

## Fix 3 — Crash recovery by replay

1. On `setup_game` with `existingGameCode`: fetch the persisted `games.data` snapshot; if
   `status='live'`, restore state from it instead of `getInitialState(config)` (bug #3).
   The action journal from Fix 2 is the fallback/consistency check — snapshot restore is
   primary (cheaper), journal replay covers a stale snapshot (last persist throttled away).
2. On daemon boot: if a live game exists for this device, offer resume on the referee UI
   (emit a `resume_available` payload in the initial `state_update`; small UI affordance in
   RefereeScreen — keep it minimal, a confirm dialog is enough).

**Verify:** mid-game `kill -9` the daemon → restart → resume → score/clock/period/fouls/
timeouts all survive; spectators recover.

## Follow-ups (separate sessions, in order)

#4 FIBA timeout buckets in daemon (port `fibaTimeouts.ts` logic) → #6 epoch-anchored clock →
#12 possession flip on shot-clock reset · #11 period clamp · #13 OT = 5 min → #7 pico_status
into `useRefereeBox` → #9 periodic shotQueue retry → #15 multi-court daemon (needs a design
pass — don't improvise it) → #16 hygiene. Also queued behind this plan: miss logging (needs a
capture design: long-press? second button? — product conversation with Shrujal first).
