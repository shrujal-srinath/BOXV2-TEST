# OPUS — Start Here Tomorrow (handoff from Fable 5, 2026-07-07 evening)

> Fable's plan access ends today. This file is the ordered work queue + everything Fable
> verified/fixed in its final session so you don't re-derive it. Boot ritual: `/boot`, read
> `00-MASTER-CONTEXT.md` §10–11 + this file, then start at item 1 below.
> Rules of the road: `OPUS-GUIDANCE.md`. Master sequence: `plans/PLAN-R-restructure.md`.

---

## 1. State of the world tonight (all verified)

- **PLAN-R approved and started.** Phase 0 DONE: the 3-week dirty tree is committed in 4
  slices (`de05ec1..6a494b0`) and pushed; Vercel deploy green; live site spot-checked.
- **Court-map/advanced-stats pipeline audited end-to-end by Fable** (see §3) — three real
  defects found and FIXED, one defect found and LEFT FOR YOU (§2 item 2), 91 golden tests
  added and passing (`npm test`), commit `e7d827b`, pushed.
- Supabase MCP token was still expired at last check. Migrations 010/011/012 still NOT
  applied to prod.
- the_box_app repo has ~10 dirty files needing the same slicing treatment (small).

> **Added later on 2026-07-07:** the advanced-stats/shot-UX program now has its own master plan
> — `ADVANCED-STATS-MASTERPLAN.md` (S1–S8) + `DESIGN-BRIEF-shot-experience.md` (Claude Design
> handoff). Its S1 phase SUBSUMES queue item 2 below (the deferred-shot team bug) — if Shrujal
> asks for shot-UX/stats work, follow that plan instead of improvising.
>
> **Final-night addition:** Fable BUILT the hard analytics engine (`d379db5` — attribute
> splits, clutch, lead flow, assist network, possession histogram, xPPA shot quality, hexbin
> engine, exportJSON analytics block; 109 golden tests). **`COURT-PIPELINE-DEEPDIVE.md` is now
> the engineering truth for the whole capture→export pipeline** — read it before touching any
> shot/stats code. S4/S5 remaining work is UI-only consumption of these engines.

## 2. Your ordered queue (each item ≈ one session unless noted)

1. **PLAN-R Phase 1 — security + hygiene.** The leaked Supabase anon key in
   `esp32-firmware/esp.ino` is the most urgent item in the ecosystem. Shrujal must be present
   for the dashboard rotation click; you drive the checklist (Vercel env + root/.env +
   pi-daemon/.env on the device + the_box_app/.env + courtside/.env + ESP32 reflash note).
   Also: untrack `dev-dist/`, `uiaudit/out/`, `supabase/.temp/`, `__pycache__`; delete the
   three stray files; AGENTS.md → pointer. Full spec in PLAN-R Phase 1.
2. **Fix the deferred-shot team attribution bug (found in Fable's audit, NOT yet fixed).**
   `src/components/shotchart/AdvancedConsole.tsx:287` — in the tap-court-first flow,
   `teamSide = x < 50 ? 'A' : 'B'` guesses the team from which side of the HOOP was tapped
   (x is the court-width axis!). The guess flows into `onScoreChange` (line ~987) with no way
   to correct it: **wrong team can get the points.** Fix: add a team toggle to the deferred
   modal (`DeferredShotModal` usage at lines ~980-992) — default from the current heuristic,
   operator can flip before confirming; the player list and score must follow the toggle.
   Add no new heuristics; the operator decides. Verify with a live game: tap-first on both
   halves, both modes (fullCourt on/off).
3. **PLAN-R Phase 2 — finish the safety net.** Fable already delivered vitest + the three
   hardest golden suites (court zones, court geometry, stats spatial math — 91 tests). You
   add: (a) basketball + badminton manifest REDUCER goldens, (b) the `basketballAdapter`
   round-trip golden (JSONB freeze — hard CI gate), (c) wire-literal snapshot test seeded
   from `supabaseBroadcastService.ts`, (d) lazy-route resolution test, (e) GitHub Actions CI
   (`npm ci && npm run lint && npm test && npm run build` + `node --check pi-daemon/**`),
   (f) Prettier config only. Spec: PLAN-R Phase 2.
4. **PLAN-R Phase 3 — dead-code deletion** (~30 files; re-grep each before deleting; list in
   PLAN-R).
5. **PLAN-R Phase 4 — sports trim + `_template/`** (only basketball + badminton survive;
   graceful unknown-sport fallback for old games).
6. **Then follow PLAN-R order** (docs/firmware → alias+pages regroup → PLAN-C daemon fixes →
   wire extraction → daemon split → dedup merges → PLAN-E engine unification).
7. **Parallel track when Shrujal wants it:** PLAN-A identity foundation (needs fresh
   SUPABASE_ACCESS_TOKEN — also unblocks applying 010/011/012) and PLAN-D Courtside wiring.

## 3. The court-map audit — what Fable verified and fixed (trust this; tests pin it)

**The coordinate system, confirmed correct end-to-end:**
- Persisted shots: portrait half-court, x = width 0–100, y = depth 0–94 from the shooter's
  OWN basket; basket at (50, 10.5). All FIBA constants in `courtZones.ts` hand-recomputed and
  correct (incl. corner-3 tangent 19.93 = 10.5 + √(45²−44²)).
- Pi referee court: landscape 188×100, A attacks LEFT, B RIGHT. `portraitToLandscape` /
  `landscapeToPortrait` round-trip is exact identity for both teams (tested).
- **Pi capture path is CORRECT and precise**: `PiHexCourt.handleSelect` classifies + persists
  the RAW tap (hex cell = visual only). The old "hex-snap data loss" memory is STALE for the
  Pi path. Quick-spots persist authoritative coords and are dev-asserted + now test-asserted.
- `statsEngine` ↔ `ZoneHeatmap` ↔ `aggregateZones` are mutually consistent (zones re-derived
  from x/y everywhere).

**Fixed in `e7d827b` (don't re-fix; tests guard them):**
1. **Zone-centroid drift** — 4 of 17 `ZONES` centroids didn't classify to their own zone
   (restricted→at_rim, both elbows→baseline, both wings→top-3). Because
   `shotService.recordShot` backfills x/y from centroids for zone-only captures and
   `statsEngine` re-classifies from x/y, wing 3s were silently re-binned as top 3s. Centroids
   corrected; test asserts every centroid self-classifies forever.
2. **Corner-3 distance band** — `distanceBands` cut 3PT at ≥22 ft, but a FIBA corner 3 is
   21.66 ft → corner 3s landed in the "16 ft–3PT" long-2 band. Now binned by classified zone.
3. **Website hex-snap loss** — `AdvancedCourtHex` persisted the snapped hex center; now
   persists the raw tap (mirrored to near-half), matching the Pi path.

**Known remaining quirks (documented, deliberately NOT fixed — decide with Shrujal):**
- `shotService.ts:45-46` backfills x/y even for `zone:'unlocated'` → those shots get fake
  coords (50,70) and appear as real dots on ShotMap-style plots. Options: stop backfilling
  for unlocated (check every x/y consumer handles null), or filter unlocated in plot
  components. `statsEngine.aggregateZones` already special-cases unlocated correctly.
- `statsEngine.ts:374` keeps stored zone (no reclassify) when zone is 'unlocated' even if
  x/y present — intentional given the backfill above; revisit only together with it.
- Daemon writes `made: true` only — miss logging still doesn't exist for Pi games; FG%
  visuals stay volume-mode (`hasMisses` capability flag already handles this — keep it).
- Pre-existing lint debt in `AdvancedCourtHex`/`statsEngine`/`courtZones` (13 problems, none
  from Fable's edits) — clean up during PLAN-R phases when those files are touched anyway.

## 4. How to work (the short version of OPUS-GUIDANCE.md)

Execute plans as written; verify each step; STOP and re-plan when reality contradicts a plan
assumption — don't improvise around it. Never rename wire strings or routes. Re-grep before
deleting. Build + test before every push (pushes deploy the live site). Update the fable-5
docs and re-copy the folder to the other two repos when anything here changes. When Shrujal's
prompt is ambiguous on product intent, ask one targeted question; on implementation, decide
and state your assumption in one line.
