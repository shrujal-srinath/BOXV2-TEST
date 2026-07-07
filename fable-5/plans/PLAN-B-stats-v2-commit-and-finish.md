# PLAN B — Commit the working tree, then finish Stats v2

> Fable 5, 2026-07-07. Spec authority: `readme-files/STATS_V2_GAME_ANALYTICS.md`. The tree
> holds ~3 weeks of uncommitted work — Step 1 is urgent and independent of everything else.

## Step 1 — Commit the at-risk tree in reviewed slices (do FIRST, ~30 min)

Slice the dirty tree into coherent commits. Suggested slicing (verify with `git status` +
`git diff --stat`; adjust to reality, keep each commit buildable):

1. `docs: companion-app master map + stats plans` — `COMPANION-APP.md`, `readme-files/`.
2. `feat(lan): direct-link scoring web pieces` — `pi-daemon/index.js` + `supabaseSync.js`
   changes, `PiDirectLink*.tsx`, `LanControlPage.tsx`, related hook edits.
3. `feat(scorer): phone touch deck at /host` — `MobileScorer.tsx`, `ScorerHost.tsx`,
   `App.tsx` routing.
4. `feat(stats): game analytics v2 engine + hub` — `src/services/{statsEngine,gameMode,
   exportService,statsService}.ts`, `src/components/stats/**`, the three new pages, routing.
5. `feat(db): migrations 011 + 012` — the two SQL files.
6. Anything left in referee/shotchart files → its own slice with an honest message.

Before each commit: `npm run build` must pass. Do NOT push slices you haven't built — Vercel
deploys `main` on push. If a slice can't build alone, fold it into the slice it depends on.
After all slices: `git push origin main`, confirm Vercel deploy is green.

**Stop condition:** if `git diff` reveals half-finished code that breaks the build and can't be
completed in-session, commit it behind an unused route/flag rather than deleting work — flag it
to Shrujal.

## Step 2 — Gap analysis against the spec

Open `STATS_V2_GAME_ANALYTICS.md` §1–2 and walk `StatsHub.tsx` + `statsEngine.ts` against it.
Produce a checklist: which of box score / scoring timeline / team comparison / play-by-play /
shot map / zone heatmap / distance breakdown / possession panel / exports are (a) done,
(b) stubbed, (c) missing — and whether mode-gating (quick = nothing, stats = no location
visuals, advanced = everything) actually branches via `gameMode.ts` capability flags on every
surface. Post the checklist before building.

## Step 3 — Finish in spec order

1. Box score correctness first (it's the spine): per-player MIN/PTS/FG/3PT/FT/REB/AST/STL/BLK/
   TO/PF/+- from `shot_events` + `game_actions`; only render columns whose data exists for
   this game's mode. Team totals row.
2. Scoring timeline + lead/run strip (reconstruct score-at-time by replaying `shot_events`
   chronologically — this is designed, don't add a schema column for it).
3. Team-vs-team bidirectional bars.
4. Advanced tab: exact-dot ShotMap + ZoneHeatmap + DistanceBreakdown, advanced-mode-only.
5. Exports: CSV/JSON first (deterministic), PDF/print last. Quick games: every export entry
   point hidden.
6. Apply migration 012 to prod (after PLAN A Phase 0 restores DB access) and make
   `HalfCourtCanvas` persist the RAW tapped point (keep zone classification derived).

## Verification

- Create one test game per mode (quick/stats/advanced) via GameSetup; score a handful of
  events incl. free throws + a non-shot action; open the stats hub for each: quick shows the
  empty state, stats shows tables sans location visuals, advanced shows everything.
- Design compliance: light mode `#F0EEE9` + white cards + red-600 headers, dark variants —
  audit against `fable-5/DESIGN-SYSTEM-WEB.md`.
- `npm run build` clean; commit per Step-1 discipline.

## Out of scope (do not drift into)

Player career profiles (STATS 2) — blocked on PLAN A + master context §8. Miss logging —
needs a daemon capture path (PLAN C territory, and a product design conversation first).
