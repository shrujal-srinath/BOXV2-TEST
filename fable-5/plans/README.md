# fable-5/plans — Execution plans (Fable thinks, Opus builds)

Written by Fable 5 on 2026-07-07 (its last day on the plan). These are **execution-grade plans**
for the four locked priorities. The architecture/design decisions inside them are already made —
the executing session's job is to implement, verify, and stop when a stop-condition fires.

## How to use one of these plans (for Opus 4.8 / any executor)

1. Read `../00-MASTER-CONTEXT.md` + `../OPUS-GUIDANCE.md` first (once per session).
2. Read the chosen plan fully before the first edit.
3. Execute steps IN ORDER. Each step says how to verify itself — do the verification before
   moving on, and tell Shrujal what was verified vs assumed.
4. **Stop conditions:** if reality contradicts a plan assumption (a table is missing, prod
   output differs, a file moved, an API behaves differently), STOP that step. Do not improvise
   around a broken assumption — report what you found, propose the smallest plan amendment,
   get Shrujal's go, update the plan file, then continue. (This is the community-tested
   plan/execute discipline: executors follow; when the plan breaks, re-plan, don't wing it.)
5. When a plan (or phase) completes: mark it done in this README's table, update
   `../00-MASTER-CONTEXT.md` §10, commit, re-copy the fable-5 folder to the other repos.

## The plans

| Plan | What | Repo(s) | Status |
|---|---|---|---|
| [PLAN-A](PLAN-A-identity-foundation.md) | Identity foundation: prod reconnaissance → migrations 011 + 013 (drafted inside) → client flows → dup audit | BOXV2 (SQL) + all clients | ⛔ not started |
| [PLAN-B](PLAN-B-stats-v2-commit-and-finish.md) | Commit the at-risk working tree in slices, then finish Stats v2 per spec | BOXV2 | ⛔ not started |
| [PLAN-C](PLAN-C-pi-daemon-fixes.md) | Daemon fixes 1–3: cloud channel alignment, action journal (+undo delete), crash recovery | BOXV2/pi-daemon | ⛔ not started |
| [PLAN-D](PLAN-D-courtside-supabase-wiring.md) | Replace FakeData with Supabase in dependency order | courtside | ⛔ not started |
| [PLAN-R](PLAN-R-restructure.md) | **Full codebase restructure** (approved 2026-07-07): security, tooling net, dead-code purge, surface regroup, wire extraction, daemon split, Stage-2 engine unification (E1–E5). Subsumes PLAN-B step 1 (its Phase 0) and sequences PLAN-C (its Phase 7) | BOXV2 | 🟡 Phase 0 DONE 2026-07-07; CI landed 2026-07-08 (Phase 2 partial) |
| [PLAN-S1-WIRING](PLAN-S1-WIRING.md) | Wire the built attribution machine into the web console (kills the live wrong-team deferred bug, deletes TimedPlayerPopup) then the Pi flow (kills the mid-flow remount wipe) | BOXV2 | 🟡 **Part 1 (web) DONE 2026-07-08 `1ab3fe5`** — wrong-team + silent-cancel bugs dead, popup deleted, queue chip live. Part 2 (Pi) next; needs the manual click-through below |
| [PLAN-U](PLAN-U-UNIFIED-STATS-PROGRAM.md) | **The unified stats program** (2026-07-08): one hex engine w/ web+Pi renderers, auto after-game engine (Game Score/PIE/Four Factors + persist + deliver-to-accounts), export/share at 100/100, migration 014 (teams + game_player_stats save-all-now/link-when-known), career views. P1–P8 | BOXV2 (+bridge to app/courtside) | ⛔ P1/P2/P6 startable now; P3 blocked on Supabase token |

Recommended order: **B step 1 (commit the tree — 30 min, removes data-loss risk) → A phases 0–2
(unblocks Coach Mode + makes every new account clean) → then B/C/D per Shrujal's mood.**
A's client phases (3–4) can interleave with D (they touch the same Courtside auth screens).

**2026-07-07 update:** PLAN-R (restructure) was approved and is now the master sequence for BOXV2
work — it embeds PLAN-B step 1 as its Phase 0 and PLAN-C as its Phase 7. PLAN-B steps 2–3 (finish
stats v2) run between PLAN-R phases 3–4 or after phase 5, never during a move phase. PLAN-A and
PLAN-D are unaffected (different repo/database scope).

**Part 1 manual verification list (Shrujal or next session, dev server):** score-first +2/+3
both teams (pre-selected and not) · court-first tap → team picker → both teams · FG miss flow ·
FT make/miss · tags pre-tap · court 10s and player 8s timeouts · × dismiss records a row ·
two rapid scores → QUEUED chip → both rows land · Escape cancels picker · spectator chart gets
every dot · undo.
