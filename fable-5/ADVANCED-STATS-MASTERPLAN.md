# Advanced Stats & Shot Experience — Master Plan

> Fable 5, 2026-07-07 (late session). Product owner: Shrujal. This is the continuation file for
> the "advanced scoring court popup + stats/share" program — read it whole before touching any
> of these surfaces. Companion file: `DESIGN-BRIEF-shot-experience.md` (paste into Claude Design).
> Evidence: two deep code audits (Pi flow + web console + stats/export layer, file:line cited
> throughout) + market research (FIBA LiveStats/Genius Sports, Easy Stats, HomeCourt,
> Goldsberry hexbins, Gipper/Kickly share templates).

## 0. Decisions locked 2026-07-07 (Shrujal)

1. **Pi referee touchscreen is operator-only.** Full-screen attribution takeover stays; we
   polish its choreography instead of rebuilding as an overlay.
2. **Miss capture = on-screen MISS button** entering the SAME advanced flow with `made:false`.
   No hardware change now (physical miss button = future consideration).
3. **Pi flow is the canonical implementation.** Website converges onto a shared headless
   engine; only the court renderer + layout differ per surface.
4. **Share cards: build ALL four** (player heatmap, MVP, momentum/run, quarter strip) **plus**
   Goldsberry-style multi-parameter hexbin charts. Stats must exist on a full two-axis matrix:
   **{player, team} × {single game, career/all-time}** — with per-context curation (some stats
   are game-stats, some only make sense over a career). Shrujal will supply reference
   screenshots on request — ASK for them before designing the hexbin visuals.

---

## 1. Current state — what the audits found (2026-07-07)

### 1.1 Pi advanced flow (`PiAdvancedShotFlow` + `PiHexCourt` + `court/*`) — the good base

**World-class already (keep, don't regress):** unified pointer pipeline with drag-to-adjust +
commit-on-release; 2.4× magnifier loupe (floor + lines + nearby markers + crosshair, team-tinted
bezel); rim snap; ±2/3-point zone lock with educational reject toast + wrong-half dim; quick-spot
chips mirrored per team; basket beacon; selection ring with pulsing halo; real haptics
(`navigator.vibrate` — down 10ms, reject [0,14], commit [0,8,40,12]); raw-tap persistence (hex is
visual-only); reduced-motion support; per-step countdown rings (player 12s → unattributed,
context 9s).

**The 15 ranked weaknesses (full detail with file:line in the audit — top items):**
1. No success/confirmation moment — `finalize()` unmounts instantly, zero receipt.
2. ~~Full-screen takeover~~ — accepted (operator-only screen). Polish, don't rebuild.
3. **Made/miss not captured in-popup** — `made = event.made ?? true`; misses live on a separate
   screen. → Decision 2 fixes this.
4. **Second score mid-flow silently wipes in-progress attribution** — RefereeScreen keys the
   flow by `team-points-scoreA-scoreB` → hard remount, no queue, no warning
   (`RefereeScreen.tsx:672-690`, duplicated verbatim at `775-790`).
5. Abrupt mount + opacity-only step fades — ironically `PiStatsPlayerPicker` (the stats-mode
   picker) has BETTER choreography (scale-in modal, sliding header, FUI corner brackets) —
   cannibalize its motion patterns.
6. Silent timeout expiry — countdown hits 0 and vanishes; no 3-2-1 escalation.
7. **Flow chrome hardcoded dark while the court supports light/dark themes** — visible mismatch.
8. No assist/rebound second-player chaining (attributes are flat tags only).
9. **`CourtToolbar` (HEAT/RINGS/FLIP/theme/size) fully built but never mounted** — dead code;
   settings only reachable via a separate panel (`PiHexCourt.tsx:81-92` reads localStorage).
10. Context step OFF by default (`getShotTypeSelection()` default false) — the attribute step
    most demos rely on is hidden behind a pref.
11. Haptics stop at the court — none on player select/attr toggle/finalize.
12. Three overlapping exits (SKIP LOCATION / UNATTRIBUTED / ✕) with fuzzy semantics.
13-15. Hand-rolled buttons with imperative `.style` mutation, no disabled/loading states;
    minimal player-tile feedback; empty-roster message is dead text, not a button.

**Code quality blockers for any redesign:** 100% inline styles, zero tokens; `RM`/`OSW` font
constants + made/miss colors redeclared per file; magic numbers everywhere (header 96, banner 44,
footer 58, loupe R=15/K=2.4/LIFT=24); only design hooks are `teamAColor/teamBColor` +
`useReducedMotion`; duplicated team-column and retained-chip blobs; `hxRecentPulse` declared but
unused.

### 1.2 Website console (`AdvancedConsole` 1181 lines + `AdvancedCourtHex`) — the rough one

Two mutually exclusive flows: **pending** (score button → court armed → tap finalizes, 10s
auto-`unlocated`) and **deferred** (tap court first → `TimedPlayerPopup` 8s "Who scored?").
Top defects (file:line in audit):
1. **Deferred flow records ONLY made shots and drops all attributes** (`made:true`,
   `attributes:[]` hardcoded at `AdvancedConsole.tsx:986,991`).
2. **Deferred team attribution guesses from tap side** (`x < 50 ? 'A' : 'B'` at `:287` — x is
   court WIDTH; wrong team can get points; no correction UI). Already queued as
   OPUS-TOMORROW item 2.
3. **`TimedPlayerPopup` violates every design language in the repo** — yellow `#facc15` border,
   Barlow Condensed, emoji 🚩 button; its header literally says "Copy this file… INTEGRATION
   INSTRUCTIONS". A bolted-on prototype.
4. **Two silent data-loss timers** (10s pending → unlocated; 8s popup → unattributed made).
5. **Free throws persist a fake location** (`x:50, y:paintTop, zone:'mid_top'` at `:261,281`) —
   misleading rows; should persist `zone:'free_throw'`, x/y null.
6. Cramped touch targets (fontSize:8, 3×8px padding control bar; 50px range slider).
7. Undo desyncs the play-by-play feed (event log keeps reverted events); no undo feedback.
8. Jump ball + substitutions are `console.log` stubs (`:1003, :1015`).
9. Score applied before location/attribution — undo mid-flow leaves score/log ambiguity.
10. Bespoke "arcade dark" theme ignoring both the CLAUDE.md web system and the Pi language.

### 1.3 Duplication verdict — the unified engine (Decision 3)

Both surfaces independently implement the same state machine (pending/step state, FT court-skip,
court tap → classifyZone, player select, attribute toggle, auto-timeout, finalize). Shared
imports already: `SHOT_ATTRIBUTES`, `courtZones`, raw-tap persistence with identical comments.
**Build `useShotAttribution()` — a headless hook** (see §3.1); web + Pi become renderers.

### 1.4 Stats/export/share layer

**Computed today** (statsEngine): box rows (pts/fg/3p/ft/oreb/dreb/reb/ast/stl/blk/tov/pf/TS%/
eFG%), team totals, score timeline + runs (min 6-0) + biggest leads, team comparison, zone
aggregation, distance bands (zone-binned 3s after `e7d827b`), possession Early/Mid/Late (needs
mig 012 `shotClockSec`), per-player period scoring, plotted shots, **xPPA Bayesian shot quality
(`lib/xppa.ts`, k=8 shrinkage) — computed live in console HUD, then thrown away post-game**.

**Buried treasure — persisted but consumed by NOTHING:**
- **`shot_events.attributes`** (fastbreak, second_chance, off_turnover, contested, uncontested,
  catch_and_shoot, pull_up, off_screen, post_up) — written by both surfaces, read into models,
  zero consumers. The single biggest unlocked asset.
- `oreb/dreb` computed but no UI column; `blockedBy` only summed; `minutes`/`plusMinus`
  hardcoded null (never tracked — needs substitution tracking, see §4.4).

**Export:** CSV box + CSV shot-level + JSON + branded print/PDF (A4 stat sheet, utilitarian) —
plus a REDUNDANT legacy `exportService.ts` path to merge/delete (PLAN-R Phase 10 adjacency).

**Share:** genuinely strong engine — pure SVG → deterministic 1080px PNG, dark gradient, team
glows, THE BOX wordmark; 1:1 + 9:16 story formats; 3 templates (gameCard, playerCard,
shotArtCard). Gaps are content, not rendering.

---

## 2. Research — what the pros do (applies throughout)

- **FIBA LiveStats / Genius Sports** (the scorekeeping gold standard): operator+caller two-person
  model; shot entry area initiates most actions; expanded shot-type taxonomy (euro step, reverse
  layup, alley-oop dunk vs layup, tip-in); fast edit/delete of recent events from the main form.
  → Lessons: our attribute taxonomy is competitive; our missing piece is **fast in-flow
  correction of the last few events** (their edit-recent pattern beats our all-or-nothing UNDO).
- **Easy Stats / Basketball Stats PRO / consumer apps**: "2 fast touches to record any stat";
  landscape tablet, high-frequency controls on BOTH thumb edges; opponent tracked team-level
  only to halve workload. → Lessons: our Pi flow is already 2-3 touches (good); keep edge
  placement in any redesign; consider "lite opponent mode" for solo scorers.
- **Goldsberry hexbins**: hex SIZE = volume, hex COLOR = efficiency vs league/па baseline —
  4 dimensions per mark; MINIMUM SAMPLE filtering is essential (tiny samples lie). → Blueprint
  for §4.3; our xPPA priors give us the "vs expected" color axis for free.
- **Gipper/Kickly/Canva sports templates**: the shareable-card anatomy = huge numerals, athlete
  cutout/photo slot, team colors, bold diagonal/gradient background, minimal stat count (3-5 max
  per card), consistent brand footer. Our `renderCard` shell already matches; content cards to
  spec in §5.

---

## 3. WORKSTREAM A — The shot-input experience

### A1. Shared headless engine (backend of the UX)

`src/services/shotAttribution.ts` (or hooks/) — `useShotAttribution(config)`:
- State: `steps[] / stepIndex / made / points / team / zone / rawXY / player / attrs / deadline`
- Config: `{ hasCourt, showContext, timeouts: {player, context}, entryOrder }`
- Actions: `tapCourt(lx,ly) / selectPlayer(p) / toggleAttr(a) / markUnattributed() / skip() /
  back() / finalize() / cancel()`
- Emits ONE canonical payload (identical to today's `shot_attributed` shape — wire-frozen).
- **Pi order is canonical** (court → player → context, attribute-then-commit). Web keeps its
  score-first UX but routes through the same machine; the deferred flow inherits made/miss +
  attributes + team-toggle for free (kills web defects 1, 2, 4 in §1.2).
- **Event queue, not remount**: incoming `score_pending` while a flow is active → enqueue +
  show "1 PENDING" chip; current attribution survives. Replaces the destructive remount keying
  (fixes Pi weakness 4). RefereeScreen's two duplicated mount blocks collapse to one.

### A2. Miss capture (Decision 2)

- Referee touchscreen: MISS button (per team) beside the score cluster → fabricates the same
  pending event with `made:false, points: attempted value (2/3 picker or zone-inferred)` →
  same flow. Web console already has miss buttons — they just need to route into the machine.
- Daemon: `shot_attributed` already carries `made`; verify `writeShotEvent` passes it through
  (it does — `supabaseSync.js:412-423`) and that score is NOT changed for misses.
- Unlocks: real FG% heatmaps (ZoneHeatmap auto-switches off volume-mode via existing
  `hasMisses` capability flag), true TS%/eFG%, xPPA vs actual.

### A3. Experience polish (the "broadcast feel" — full spec in DESIGN-BRIEF)

Priority order: (1) finalize receipt moment — "SHOT LOGGED · #23 · CORNER 3" flash w/ court
thumbnail + commit haptic, ~600ms, then exit; (2) entrance/step choreography — adopt
PiStatsPlayerPicker's scale-in + directional step slides; (3) timeout escalation — ring pulses
+ color shift + tick haptics at 3-2-1; (4) theme unification — flow chrome joins COURT_THEMES
(light+dark), tokens extracted; (5) haptics extended to player/attr/finalize; (6) mount
CourtToolbar (or fold its controls into the court header) — heat/rings/flip in-flow;
(7) exit-affordance cleanup (one BACK, one SKIP semantics, one ✕); (8) context step ON by
default; (9) button system (`<PressButton>` variants w/ disabled/pending states); (10) assist
chaining = one optional "+ ASSIST" chip on the receipt moment → single-tap second-player pick
(FIBA-style, skippable, 4s).

### A4. Code-health prerequisites (do WITH the redesign, not before)

Tokens module for the flow (colors/spacing/fonts/timings); dedupe RefereeScreen mount blocks;
CSS classes replacing imperative `.style` writes; shared `RM/OSW/MADE/MISS` constants;
`TimedPlayerPopup` deleted and rebuilt in-system. Respect PLAN-R: no wire renames; these files
also move in Phase 6 — sequence UI work AFTER the pages regroup or accept the rebase.

---

## 4. WORKSTREAM B — The stats matrix (Decision 4)

### B1. The two-axis model

|  | **Single game** | **Career / all-time** |
|---|---|---|
| **Player** | box line, shot chart, zone %, xPPA vs actual, quarter scoring, attribute splits (fastbreak/2nd-chance/contested), clutch line | per-game averages, career highs, hexbin shot profile (volume+efficiency), zone tendencies, form trend (last 5), badges/milestones |
| **Team** | comparison bars, runs/lead changes, points in paint / off TO / 2nd chance / fastbreak, possession tempo | W-L record, avg margins, team hexbin, pace trends, head-to-head history |

**Curation rule:** game view = what happened (counting + timeline); career view = who you are
(rates, tendencies, highs, badges). Never show a 3-shot sample as a percentage (Goldsberry
minimum-sample rule — gate on attempts ≥ N, else show volume only).

### B2. New computations (all from EXISTING data — statsEngine additions)

1. `attributeSplits(shots, side?, playerId?)` → fastbreak pts, 2nd-chance pts, pts off TO,
   contested vs uncontested FG%, C&S vs pull-up split. (Unlocks the buried attributes.)
2. `leadChanges(timeline)` → lead changes + times tied.
3. `clutchLine(shots, actions, {lastNSec: 300})` → last-5-min player/team splits.
4. `aggregateZones(..., playerId?)` → per-player zone heat (one param).
5. `assistNetwork(shots)` → passer→scorer pairs, top duo.
6. `pointsInPaint(shots, side)` — zone-derived.
7. Possession: continuous `shotClockSec` histogram (not just 3 buckets).
8. Post-game xPPA: shots vs expected (`xppa.ts` already computes; surface in StatsHub + cards).
9. Surface computed-but-hidden oreb/dreb columns.

### B3. Hexbin engine (the Goldsberry ask)

`buildHexbins(shots, {radius, minAttempts})` → hexes with {volume, fgPct, xPPA delta, points}.
Rendering encodes **size = volume, color = efficiency (or vs-expected)**; tooltip/legend carries
the rest. One engine, four consumers: StatsHub player tab, career profile, share cards, and the
existing court components (reuse `CourtGeometry.buildHexGrid` — do NOT write a second hex math;
PLAN-R already flags hex fragmentation). **Ask Shrujal for his reference screenshots before
designing the visual** — he has specific multi-parameter examples in mind.

### B4. Career layer (needs backend work — coordinate with PLAN-A/§8 of master context)

- Game-over aggregation: on `end_game`, upsert into `player_game_log` / `player_sport_stats`
  (tables exist, mig 006). Career queries then read aggregates + on-demand shot_events scans.
- **Career hexbins need all-time shot_events per player** — fine at current scale; add
  `(player_id)` index if missing.
- **Minutes / plus-minus / starters:** requires substitution tracking (the stubbed
  SubstitutionPanel). This is its own sub-project: lineup state machine in the engine +
  `game_actions` sub events → minutes, +/-, lineup analytics. Phase it LAST; don't fake it.
- Identity dependency: career views only make sense once roster players link to
  `player_profiles` (master context §8.2). Game-level stats don't wait for this.

## 5. WORKSTREAM C — Share & export program

All on the existing SVG→PNG engine (`share/cards/*` + `renderCard` shell), 1:1 + 9:16 each:
1. **Player heatmap card** — per-player zone/hexbin heat + stat trio + name/number chip.
2. **Game MVP card** — hero numerals, player-passport photo slot, WON badge.
3. **Momentum card** — full-bleed timeline step-path + run annotations ("12-0 RUN · Q3").
4. **Quarter strip card** — 4-bar per-quarter scoring story.
5. **Career card** — averages + highs + hexbin thumbnail + games-played badge (after B4).
6. Composer upgrades: per-card stat picker (bounded choices, keep cards 3-5 stats max),
   milestone badge auto-suggest ("SEASON HIGH", "FIRST 30-PT GAME" — needs career layer).
Export cleanup: merge legacy `exportService.ts` into V2 (already queued in PLAN-R Phase 10);
add per-player PDF sheet w/ shot chart; keep A4 print path (coaches like it).

## 6. Phasing (each ≈ one Opus session; respect PLAN-R sequencing)

> **2026-07-07 late-session update (Fable):** the ENGINE halves of S4 and S5 are **BUILT,
> TESTED (109 goldens), and COMMITTED** (`d379db5`): attributeSplits, specialPoints, leadFlow,
> clutchStats, assistNetwork, possessionHistogram, shotQuality, per-player aggregateZones,
> and `hexbinEngine.buildHexbins` — plus the full `analytics` block in exportJSON. What
> remains of S4/S5 is pure UI consumption. Implementation truth for all of it:
> **`COURT-PIPELINE-DEEPDIVE.md`** (same folder) — §5 has the upgraded per-phase specs.
>
> **2026-07-08 update (Fable, final session):** four more pieces BUILT + COMMITTED
> (`27c1bd3`, `4ceb3a6` — 143 goldens green):
> 1. **S1 core** — `src/services/shotAttribution.ts` headless machine + `useShotAttribution`
>    hook: canonical court→player→context, FT skip, prefill (web deferred entry), MISS events,
>    TICK timers with Pi-parity expiry, and the mid-flow score QUEUE (overflow auto-flushes
>    oldest queued unattributed). 22 tests are the flow contract. **Remaining S1 work: wire
>    the Pi flow + web console as RENDERERS of this machine** (delete their local state logic).
> 2. **FT honesty** — free throws persist `zone:'free_throw'`, x/y NULL (shotService
>    normalizes; 4 console call sites cleaned; `PersistedZone` type). Migration
>    `013_free_throw_zone_cleanup.sql` written, NOT applied to prod.
> 3. **The post-game engine** — `src/services/gameReport.ts` `buildGameReport()`: the
>    run-after-each-game package (everything + per-player packages + weight-ordered
>    HIGHLIGHTS: game high / double-double / biggest run / clutch star / best duo / hot hand /
>    wire-to-wire). exportJSON emits it. **S6 share cards and S7 career persistence should
>    consume THIS, not re-derive.**
> 4. **S5 UI** — `stats/advanced/HexShotChart.tsx` hexmap SHIPPED as the Shot Charts hero
>    (radial bloom entrance, hover lift + recede, zone tooltip w/ Δ-vs-exp chip, team pills,
>    jersey player rail, FG%/VS-EXP/VOLUME metrics, min-sample control, reduced-motion).
>    Restyle freely when Shrujal's reference screenshots arrive — the engine API is stable.

| Phase | What | Depends on |
|---|---|---|
| S1 | Headless `useShotAttribution` + event queue + web deferred-flow fix (team toggle, made/miss, attrs) + FT fake-location fix (incl. one-line data migration — deep-dive §6.1) | none (but coordinate with PLAN-R Phase 6 file moves) |
| S2 | Miss button (Pi + web) + `hasMisses` verification end-to-end | S1 |
| S3 | Pi experience polish pass 1 (receipt moment, choreography, timeout escalation, haptics, theme tokens) — from DESIGN-BRIEF + Claude Design outputs | S1; design brief iterated with Shrujal |
| S4 | ~~engine~~ ✅ built (`d379db5`) → **remaining: StatsHub UI surfacing** (specialPoints/leadFlow/clutch strip, attribute bars, assist network w/ roster names, possession histogram, shotQuality panel gated on hasMisses, oreb/dreb columns) — spec: deep-dive §5.1 | engine done |
| S5 | ~~hexbin engine~~ ✅ built → **remaining: `HexShotChart` component** (size/color encodings, legend, minAttempts + player filters) (**get screenshots from Shrujal first**) — spec: deep-dive §5.2 | S4 engine |
| S6 | Share cards 1-4 + composer stat picker (hexbin card plugs `buildHexbins`+`hexPath` into `courtGroupSvg`) | engine done |
| S7 | Career aggregation pipeline + career views + career/milestone cards | S4; identity plan §8 for full value |
| S8 | Substitution tracking → minutes/+‑/lineups (own design pass) | S1 |

## 7. Open items / asks for Shrujal

- **Reference screenshots** of the hexbin/multi-parameter stat visuals you have in mind (S5
  blocks on these) — also any stat sheets you admire (NBA.com player pages? Sofascore?).
- Attribute taxonomy: FIBA adds shot TYPES (euro step, tip-in, alley-oop…). Expand ours or
  keep the current 9? (Cheap to add — same chips.)
- 2/3-point value for misses: picker on the MISS button, or infer from tapped zone? (Plan
  assumes zone-inferred with an override chip.)
