# THE BOX — Full Codebase Restructure & Cleanup Plan

## Context

BOXV2-TEST-main was built incrementally ("vibe coded") over months by various models. A three-agent
deep review (2026-07-07, evidence-based import tracing) found: **~6,300 lines of confirmed-dead code**
(28 pages/components + 2 services + 3 hooks, zero importers), **four parallel game-engine
implementations** serving different surfaces, the realtime **wire contract independently hardcoded in
~19 files**, an **840-line pi-daemon monolith**, 39 pages flat in one folder with device surfaces
intermixed, ~3.3 MB of tracked build artifacts, **a live Supabase anon key hardcoded in tracked
firmware** (`esp32-firmware/esp.ino`), 15 of 17 sports being no-op stubs, and zero tests/CI.

Owner decisions (locked this session): rotate the leaked key (no history scrub) · **engine
unification IS in scope** (staged, never big-bang) · keep only basketball + badminton, with a clean
add-a-sport template · CI + smoke tests land **before** risky phases.

Goal: a clean, surface-organized, deduplicated codebase with one engine direction, a single wire-
contract module, a modular daemon, and a safety net — executed in independently shippable phases
(site is LIVE at theboxbybmsce.in; Vercel auto-deploys `main`; a physical Pi runs the repo via
`git pull` + `start_box.sh`).

**Constraints (frozen throughout):** no route/URL changes · no wire string-value changes (channel/
event/payload names are consumed by the Flutter app + pi-daemon + old QR codes) · `games.data` JSONB
persistence shape stays stable (other repos read it) · `pi-daemon/` dir name + `start_box.sh` root
location stay (Pi has absolute paths) · no npm-workspace conversion · no dependency upgrades.

## Target structure (decided: light-touch surface regroup, NOT monorepo, NOT feature-folders)

Rationale: one Vite SPA serves all surfaces (pi/tablet/tv are routes); the Pi deploys the repo
directly (workspaces would change install topology on a physical device); surface = "which device
breaks if I touch this" is the most useful navigation signal.

```
docs/                    ← all loose root .md files + readme-files/ + memory/
firmware/{esp32,pico,c3-dongle}/   ← consolidated firmware (key scrubbed)
scripts/                 ← check-wire-sync.mjs, helpers (start_box.sh STAYS at root)
pi-daemon/
  index.js               ← ~80-line composition root after split
  wire.js                ← hand-maintained mirror of src/shared/wire (CI-verified)
  lib/{rules,state,persistence,gpio,clock,serial,server,lifecycle}.js
src/
  app/                   ← App.tsx, main.tsx, contexts/ (update index.html entry path)
  pages/
    web/                 ← Landing, Home, Dashboard, GameSetup, Watch, Spectator,
                           ShotChartView, stats pages, PlayerPassport, Arena, Cast, CourtHex
    tournament/          ← TournamentDashboard/Setup/Manager/Viewer, TournamentWallView, VolunteerConsole
    scoring/             ← ScorerHost, HostConsole, MobileScorer, LanControlPage
    pi/                  ← PiLauncher, PiConsole, PiDisplay, PiLocalDisplay, PiReceiverSetup, RefereeScreen
    tablet/              ← StandaloneTablet, TabletController
    tv/                  ← TvKiosk, WallView
    dev/                 ← UiAuditFixture
  shared/wire/           ← channels.ts, events.ts, payloads.ts, index.ts (THE wire contract)
  components/            ← existing subfolders kept; dead files deleted; NOT re-nested
  services/ hooks/       ← flat (fine at post-deletion size), minus dead + merged files
  core/ sports/ adapters/ lib/ utils/ types.ts  ← locations unchanged; contents evolve in Stage 2
```

**Path alias:** introduce `@/ → src/` in `vite.config.ts` (`resolve.alias`) + `tsconfig.app.json`
(`baseUrl`+`paths`) in one isolated commit BEFORE moves. Rule: imports on lines you touch during a
move become `@/...`; untouched imports stay relative. No repo-wide rewrite commit.

**Engine target (decided):** the generic manifest engine — `Game<TState,TRules>` +
`core/engine/useGameEngine` + sport manifests — wins. Sports-as-manifests is the product direction
and matches the add-sports-one-by-one goal. The legacy `BasketballGame` JSONB shape remains the
persistence/wire format (via `adapters/basketballAdapter`) until a separately-planned cross-repo
migration.

---

## STAGE 1 — Safety net + behavior-preserving restructure

Standard verification every phase: `npm run build` clean → `npm run lint` → dev-server click-through
of affected routes → push → Vercel deploy green → spot-check live `/`, `/watch-live`,
`/tablet/standalone`. Standard rollback: each phase = 1–5 commits, `git revert` the range.

### Phase 0 — Commit the uncommitted tree
Execute `fable-5/plans/PLAN-B-stats-v2-commit-and-finish.md` **Step 1** verbatim (slice the ~38
dirty/untracked paths into buildable commits). Blocking precondition for everything below.
Verify: clean `git status`, Vercel green.

### Phase 1 — Security + repo hygiene
1. `esp32-firmware/esp.ino`: replace hardcoded Supabase key + project ref with a `secrets.h`
   include (`secrets.h.example` committed, real one gitignored).
2. **Key rotation (owner does the dashboard click, agent drives the checklist):** generate new anon
   key → update Vercel env vars, root `.env`, `pi-daemon/.env` (on device), Flutter app `.env`,
   courtside `.env` → verify each app connects → old key dies. Never rotate mid-phase. NO history
   scrub / force-push.
3. Untrack + ignore: `dev-dist/`, `uiaudit/out/`, `supabase/.temp/`, `__pycache__/`
   (`git rm -r --cached` + `.gitignore` entries).
4. Delete: `esp32_scoreboard.ino` (empty), `.env.production` (empty), `host_console_error_report.txt`.
   Replace byte-identical `AGENTS.md` with a 3-line pointer to `CLAUDE.md`.
Verify: build; `git ls-files` shows artifacts gone.

### Phase 2 — Safety net (tooling EARLY, per owner decision)
1. **Vitest** + smoke tests that gate everything after: (a) `courtZones.classifyZone` golden cases
   (~10 known x/y→zone pairs); (b) basketball + badminton manifest **reducer golden tests**
   (score/undo/period sequences → expected state); (c) **wire-literal snapshot test** — greps/imports
   the current channel+event strings from `supabaseBroadcastService.ts` and asserts exact values
   (this freezes the wire before Phase 8 touches it); (d) `statsEngine` shooting-math cases;
   (e) registry loads + every routed lazy import resolves (import.meta.glob check).
2. **GitHub Actions CI:** `npm ci && npm run lint && npm run test && npm run build` on PR + push to
   main. Second job: `node --check` every `pi-daemon/**/*.js` + (from Phase 8 on)
   `scripts/check-wire-sync.mjs`.
3. **Prettier: config only** + format-on-touched-files convention. NO repo-wide format commit
   (protect `git blame`).
Verify: CI green on a no-op PR; tests fail if a golden value is deliberately broken.

### Phase 3 — Dead-code deletion (~30 files, ~6,300 lines)
The verified zero-importer list: pages `EngineDemo, OBSOverlay, PlayerCard`; components
`BracketEditor, ControlDeckClassic, CourtPickerModal, FixtureListView, HardwareDeck,
IOSInstallBanner, MomentumFeed, PlayerSelectModal, TeamScoreCard, TimeEditModal,
WinnerSelectionModal, GameClock, ShotClock, Scoreboard, ControllerStatusBar, ScheduleManager,
CreateTournamentModal, pi/PiTouchPreview, refereebox/PiCourtMap, refereebox/court/exportCourtPng,
refereebox/court/CourtHud, shotchart/ActionChain, shotchart/CourtGraphicsModal,
shotchart/HalfCourtCanvas, shotchart/FullCourt`; services `hybridService, HardwareControlOverlay`;
hooks `useBoxSignaling, useClockSync, useGameTimer`.
Guards: re-grep importers per file at execution time (tree moved since analysis); confirm not in
`UiAuditFixture.tsx`. Do NOT delete: `shotchart/HalfCourt.tsx` (live), the `*Minimal` theme variants
(intentional runtime toggles), `/uiaudit`.
Verify: build + full route click-through + tests.

### Phase 4 — Sports trim + add-a-sport template (owner decision)
1. Delete 15 stub sports (volleyball, kabaddi, tabletennis, general, cricket, football, hockey,
   khokho, netball, tennis, handball, throwball, chess, carrom, athletics) from `src/sports/` and
   `registry.ts` (imports, `SPORT_REGISTRY`, `CORE_SPORTS`, `EXTENDED_SPORTS`). Registry consumers
   (Dashboard, GameSetup, passport pages) read it dynamically — lists shrink automatically.
2. **Graceful unknown-sport fallback:** old Supabase games may carry deleted sport ids. Audit every
   `SPORT_REGISTRY[id]` lookup (SpectatorView, WallView, HostConsole, MobileScorer, PiConsole,
   GameSetup) — use the existing `isSportSupported` guard to render a "sport no longer supported"
   state instead of crashing.
3. Create `src/sports/_template/` — documented manifest skeleton (types, reducer with golden-test
   file, setup/scoring/spectator component slots) + `docs/adding-a-sport.md` checklist (manifest →
   registry → SchedulableSport type → reducer tests → dashboard card).
Verify: build; dashboard shows only basketball + badminton; a seeded old volleyball game code opens
the fallback, not a crash.

### Phase 5 — Root/docs/firmware consolidation
`docs/` gets: DESIGN-GUIDE, IMPLEMENTATION-CHECKLIST, MIGRATION-GAME-TYPES, COMPANION-APP,
tabletdeployment, esp32readme, readme-files/*, memory/project_overview. `firmware/{esp32,pico,
c3-dongle}` consolidates the three firmware locations. `scripts/` created. `start_box.sh` stays at
root. Update path references in `fable-5/00-MASTER-CONTEXT.md`, `CLAUDE.md`, `.claude/commands/*`.
Verify: build untouched; grep for stale doc paths.

### Phase 6 — Alias + pages regroup by surface
1. Isolated commit: add `@/` alias (vite + tsconfig) + one converted import as proof; build.
2. `git mv` pages into `pages/{web,tournament,scoring,pi,tablet,tv,dev}/` — one surface per commit.
   Rewrite the 31 `lazy()` specifiers in App.tsx **preserving each page's exact
   `.then(m => ({default: m.X}))` export-shape pattern**; rewrite moved files' imports to `@/`.
3. Move `App.tsx`/`main.tsx`/`contexts/` → `src/app/` last; update the `main.tsx` path in
   `index.html`.
Verify (mandatory): visit ALL 31 routes in dev (script it via the existing uiaudit playwright
setup if possible); PWA standalone emulation redirects `/` → `/tablet/standalone`; build; deploy
green. Highest-risk phase: lazy-import typos pass the build but 404 at runtime.

### Phase 7 — pi-daemon behavior fixes (existing PLAN-C), THEN split
1. Execute `fable-5/plans/PLAN-C-pi-daemon-fixes.md` fixes 1–3 as written (cloud channel alignment
   to `game:{code}` website vocab, `game_actions` journal + undo-deletes-shot, crash recovery).
   **Inside Fix 1, create `pi-daemon/wire.js`** (channel builders + event constants used by the
   daemon).
2. Fixes first, split second: PLAN-C is authored against current line regions, the fixes are
   user-facing (cloud spectators broken now), and splitting verified-good code beats fixing
   mid-split code.
Verify: per PLAN-C (real off-LAN spectator sees clock; undo leaves no orphan rows).

### Phase 8 — Wire-contract extraction (web side)
1. Create `src/shared/wire/`: `channels.ts` (builder fns, one per existing string pattern —
   byte-identical output), `events.ts` (`as const` event names seeded from
   `supabaseBroadcastService.ts`), `payloads.ts` (Broadcast* types + the 4+ inline-redeclared
   score/clock shapes), `index.ts` (barrel with the cross-repo warning header).
2. Migrate the ~19 coining sites file-by-file. **Zero string-value changes** — dump all
   `supabase.channel(`/event literals before and after; diff must be empty. The Phase-2 wire
   snapshot test enforces the canonical family.
3. Add `scripts/check-wire-sync.mjs` (diffs `pi-daemon/wire.js` values against
   `src/shared/wire/`); wire into CI.
Verify: literal-dump diff empty; tests green; live spectator smoke.

### Phase 9 — pi-daemon split
Move-only, zero logic edits, one module per commit → `pi-daemon/lib/{rules,state,persistence,gpio,
clock,serial,server,lifecycle}.js`; `index.js` becomes the ~80-line composition root. `pigpio`
require stays lazy/guarded (dev machines). Keep Socket.io `ui_action`/`state_update` byte-compatible.
Verify: `node --check` each file; dev-machine smoke via `dev_pico_message` (score/undo/period/clock
+ a LAN socket client); then a SUPERVISED `git pull` + restart on the physical Pi.

### Phase 10 — Safe dedup merges + Stage-1 close-out
1. `statsService.ts` → `statsEngine.ts` (port unique bits, repoint `PlayerSeasonView`, delete;
   verify PlayerSeasonView numbers match pre-merge for a known game).
2. `AdvancedCourtHex.tsx` `FIBA_SPEC` → import from `courtZones.ts` (screenshot before/after on
   `/court-hex` + stats pages).
3. Docs: write `docs/RESTRUCTURE-CHANGELOG.md` (old→new path map — the other two repos' agents will
   grep old paths); update `fable-5/00-MASTER-CONTEXT.md`, `CLAUDE.md` architecture map,
   `.claude/commands/*`; re-copy fable-5 folder to the other repos. Document (don't fix) the
   cast/TV service trio overlap for Stage 2.

---

## STAGE 2 — Engine unification (owner-mandated; surface-by-surface, never big-bang)

Each phase = one surface migrated, verified against the Phase-2 reducer goldens + manual scoring
session, shippable alone. Target: generic manifest engine everywhere; `games.data` JSONB shape
frozen via the adapter.

- **E1 — Merge the persist engines.** Fold `usePersistEngine` (basketball-specific) into
  `useGenericPersistEngine` by having each manifest declare its score/persist field mapping
  (kills the "guess the score field" heuristic). All three generic-path pages re-verified.
- **E2 — Retire `useBasketballGame`.** Migrate its one surviving consumer (TournamentWallView)
  to the spectator/broadcast data path used by SpectatorView; delete the hook.
- **E3 — Offline/tablet path onto the manifest engine.** Rework `useLocalGame`/`localGameService`
  to run the basketball manifest reducer with a local-storage persistence adapter (offline behavior
  and standalone PWA flow unchanged — this is the riskiest E-phase; verify full offline scoring on
  an actual tablet/PWA install).
- **E4 — Referee surface: honest scoping.** `useRefereeBox` is a Socket.io mirror of the daemon —
  the DAEMON is that surface's engine. Do not force it into the web engine. Instead: align the
  daemon's reducer semantics with the basketball manifest reducer (shared action vocabulary,
  golden-test parity between `pi-daemon/lib/state.js` transitions and the manifest reducer), so
  there is ONE rule-set even if two runtimes.
- **E5 — Type spine cleanup.** With E1–E4 done, page-level readers of legacy `BasketballGame`
  (Dashboard lists, WatchPage, ShotChartView, validation, etc.) move to engine/view-model types;
  `BasketballGame` shrinks to `adapters/` + `services/` persistence boundary only, documented as
  the wire format. Full cross-repo JSONB migration stays out of scope (needs Flutter + daemon
  coordination — future plan).

Write each E-phase's detailed steps as `fable-5/plans/PLAN-E-engine-unification.md` at the end of
Stage 1 (Phase 10), against the then-current clean map.

---

## Risk register (top items)

| Risk | Mitigation |
|---|---|
| `lazy()` path typo: build passes, route 404s at runtime | Phase 6 all-31-routes click-through + Phase 2 lazy-resolve test |
| Vercel/linux case-sensitivity vs macOS on `git mv` | no case-only renames; confirm deploy green per phase before next |
| Physical Pi breaks on `git pull` | `pi-daemon/` + `start_box.sh` frozen; supervised pulls; "run npm ci on Pi" notes when deps change |
| Wire drift vs Flutter repo | zero-string-change rule + snapshot test + check-wire-sync + /wire-check |
| Key rotation breaking 3 apps at once | coordinated cutover checklist, never mid-phase |
| Old games of deleted sports crash viewers | Phase 4 fallback via `isSportSupported` |
| E3 offline regression on tablets | real-device PWA verification before ship |

## Explicitly OUT of scope (anti-scope-creep)

No route/URL changes · no wire string renames · no `games.data` JSONB reshape · no npm workspaces ·
no dependency/React/Vite upgrades · no UI redesigns · no splitting the giant page files
(HostConsole/RefereeScreen/TournamentManager/Dashboard — move yes, refactor no; candidates for a
later plan) · no deleting theme variants or `/uiaudit` · no repo-wide prettier commit · no git
history rewrite · no cast/TV trio consolidation in Stage 1 (documented for Stage 2+) · no Supabase
schema changes beyond what PLAN-B/C already prescribe · no pi-daemon TypeScript conversion.

## Verification summary

- Phase-2 test suite (court math, reducers, wire snapshot, statsEngine, lazy-route resolution) runs
  in CI on every push — the regression net for everything.
- Every phase ends: build + lint + tests + affected-route click-through + Vercel green + live
  spot-check.
- Hardware phases (7, 9) end with dev-machine `dev_pico_message` smoke + supervised on-Pi pull.
- Stage 2 phases each end with a full manual scoring session on the migrated surface (score, undo,
  period, clock, spectator view live).

## Execution notes

- One phase ≈ one AI session. Phases 0→1→2→3 strictly ordered; 4/5 order-flexible; 6 before 8;
  7 before 8's daemon-side and before 9; 10 closes Stage 1; E1–E5 sequential.
- Update `fable-5/plans/README.md` with this plan's phases + status column as work proceeds
  (register it as PLAN-R restructure + PLAN-E engine unification).

---

## Executor addendum (architect verification notes, 2026-07-07)

Ground truths verified against the repo — rely on these, re-verify only if the cited file changed:

1. `npm run build` = `tsc -b && vite build`; tsconfig has `strict: false`, so the compiler catches
   import-path breakage but little else — the Phase-2 Vitest net is the real regression gate.
2. No path aliases exist today (`tsconfig.app.json` has no `paths`; `vite.config.ts` no
   `resolve.alias`). When adding `@/`, configure vite + tsconfig + vitest in ONE commit.
3. The physical Pi runs the repo directly: `start_box.sh` hardcodes
   `PROJECT_DIR=/home/the-box/BOXV2-TEST` and launches `pi-daemon/index.js` + `npm run dev`
   (the VITE DEV SERVER, not a built dist). Any phase touching `package.json` must flag
   "run npm install on the Pi at next pull" in its commit message.
4. PWA `start_url: '/tablet/standalone'` is a route, not a file path — file moves can't break it.
5. All routed pages are `lazy(() => import('./pages/X'))` in App.tsx — each page move touches
   exactly one specifier line there; preserve each page's `.then(m => ({default: m.X}))` shape.
6. `UiAuditFixture` imports exactly 6 refereebox components (LockedScoreboard±Minimal,
   PiTouchScoringScreen±Minimal, PiAdvancedShotFlow, PiStatsPlayerPicker) — none on the dead list.

Refinements adopted from the architect's v2 pass (compatible with the approved phases):

- **Phase 2 test (f):** add a `basketballAdapter` ROUND-TRIP golden test
  (`toBasketballGame(fromBasketballGame(x)) ≡ x` on a real games.data fixture) — this is the
  JSONB-shape freeze that makes Stage 2 safe. Hard CI gate.
- **Ordering option:** Phase 8 (wire extraction) MAY run before Phase 7 (PLAN-C) so that PLAN-C
  Fix 1 consumes `pi-daemon/wire.js` constants instead of re-transcribing strings. Either order is
  valid; pick based on whether a Pi is physically available that session.
- **Stage 2 / E3:** the generic engine has NO undo today; `useLocalGame` has a 50-step history.
  Build a small history wrapper in `src/engine/` as part of E3 (the referee surface gets undo from
  the daemon, so the wrapper is only needed for local-authoritative surfaces). Preserve
  `localGameService`'s localStorage format exactly — deployed iPads have data in it.
- **E1 naming:** basketball's codec = `adapters/basketballAdapter.ts` moved to
  `sports/basketball/codec.ts` byte-identical; a manifest gains optional `toDb/fromDb` members.
- **Stage 2 end-state, stated honestly:** the 4 paths collapse to 2 ROLES by design —
  (1) local-authoritative `useGameEngine` + one persist hook with pluggable drivers
  (Supabase/localStorage); (2) remote-authoritative `useRefereeBox` mirror of the daemon
  (the daemon IS that surface's engine). E4 aligns rule-sets, not runtimes.
