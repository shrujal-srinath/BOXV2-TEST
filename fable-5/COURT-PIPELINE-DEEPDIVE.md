# Court & Stats Pipeline — Implementation-Grade Deep Dive

> Fable 5, 2026-07-07 (final night). The precise map of how a shot travels from a finger on a
> court to an exported stat sheet — every hop, every shape, every semantic trap. Written so
> Opus 4.8 can build on this pipeline WITHOUT re-deriving it. Companion to
> `ADVANCED-STATS-MASTERPLAN.md` (product plan) — this is the engineering truth underneath it.
> Everything here was verified against code on 2026-07-07; golden tests pin the load-bearing
> behavior (`courtZones.test.ts`, `CourtGeometry.test.ts`, `statsEngine.test.ts`,
> `hexbinEngine.test.ts` — 109 tests).

## 0. The one-paragraph mental model

Every shot is persisted in **portrait half-court space**: `x` = width 0–100, `y` = depth 0–94
from the shooting team's OWN basket (basket at 50, 10.5; 1 unit = 0.15 m). Capture surfaces
(the Pi's landscape court, the web's portrait/full court) convert INTO this space at commit
time; analytics and rendering convert OUT of it. The zone (`ShotZoneId`, 17 values) is always
**derivable** from x/y via `classifyZone` — stored zone is a cache, not truth, EXCEPT for
`unlocated` rows where the stored zone is the only truth and x/y are fake centroids. Clocks
count DOWN: `game_clock_sec` = seconds remaining in the period, `shot_clock_sec` = seconds
left on the shot clock. Ref UNDO = row DELETE.

## 1. The coordinate spine (files + guarantees)

| Layer | File | Space | Guarantee (tested) |
|---|---|---|---|
| Zone law | `src/components/shotchart/courtZones.ts` | portrait 100×94 | FIBA constants hand-verified; every `ZONES[*]` centroid self-classifies (fixed 2026-07-07 — 4 had drifted); `classifyZone` goldens |
| Pi mapping | `src/components/refereebox/court/CourtGeometry.ts` | landscape 188×100, A=left basket, B=right | `portraitToLandscape`/`landscapeToPortrait` round-trip identity both teams; `classifyLandscape ≡ classifyZone`; quick-spots classify to declared zones; `isBeyondArc ≡ zone.startsWith('three_')` |
| Flutter port | `the_box_app/lib/models/shot_models.dart` | portrait | must stay behaviorally identical to courtZones — any zone-law change is a 2-repo change |
| Stats space | everything under `src/services/stats*` + `src/components/stats/**` | portrait | zones re-derived from x/y when located |

**Trap:** the landscape→portrait direction (`landscapeToPortrait`) infers depth from the
NEARER basket (`min(lx, 188−lx)`) — it doesn't know the team. That's correct on capture
(the ref taps the half the team attacks, enforced by zone-lock + dimming), but rendering
persisted shots back onto a full court REQUIRES the team-aware `portraitToLandscape(x, y,
side)`. Never "round-trip" through the team-less direction for team B data.

## 2. Capture → persist, per surface (exact behavior today)

### 2.1 Pi referee (advanced mode) — the canonical path
`Pico button → daemon emits score_pending → RefereeScreen mounts PiAdvancedShotFlow (keyed
remount — queue fix pending, masterplan A1) → PiHexCourt`:
- Tap/drag on `HexLayer` → commit on pointer-up with **RAW landscape coords** (hex cell is
  visual-only) → `PiHexCourt.handleSelect`: `zone = classifyLandscape(lx,ly)` (rim-snap if rim
  cell), `{portX, portY} = landscapeToPortrait(lx,ly)` → flow stores zone + portrait x/y.
- Quick-spot chips persist the spot's authoritative coords (mirrored for team B).
- Player step (12 s → unattributed) → optional context step (9 s; **pref-gated OFF by
  default** — `getShotTypeSelection()`), then `onAttribute({team, points, made, playerId,
  playerName, zone, x, y, period, gameClockSec: ceil(gameMs/1000), attributes[]})`.
- `useRefereeBox.attributeShot` → Socket.io `shot_attributed` → daemon
  `supabaseSync.writeShotEvent` → INSERT with x/y passed through (null-safe), `made` from
  event (daemon buttons only ever send made:true today — masterplan A2 adds MISS).
- Free throws (points===1): court step skipped, `zone:'free_throw'`, x/y undefined.

### 2.2 Web console (AdvancedConsole)
- **Pending flow** (score-button-first): score applied immediately → court armed → tap →
  `AdvancedCourtHex` commits **raw tap** (fixed 2026-07-07 — was hex-center-snapped; full-court
  taps mirror `rawY > 94 → 188−rawY`) → `handleCourtTap → finalize(x, y, classifyZone(x,y))`
  → `onShotRecorded` → (HostConsole wiring) `shotService.createShotEvent`. 10 s timer →
  auto-finalize as `unlocated`.
- **Deferred flow** (tap-court-first): KNOWN-BROKEN semantics (team guessed from tap side,
  made-only, no attrs) — being replaced by the shared machine (masterplan A1).
- Free throws: **persists fake location** `x:50, y:38.67 (paintTop), zone:'mid_top'` — data
  smell; S1 changes this to `zone:'free_throw', x/y null` (see §6 fix list).

### 2.3 `shotService.createShotEvent` (the web write choke-point)
```
finalX = params.x ?? ZONES[zone].cx      ← centroid backfill for zone-only captures
finalY = params.y ?? ZONES[zone].cy        (this is WHY centroids must self-classify)
finalZone = zone !== 'unlocated' && x !== null ? classifyZone(x, y!) : zone
```
- So: located shots get their zone RE-derived on write; zone-only shots get centroid coords;
  `unlocated` keeps fake centroid (50, 70) — **all downstream consumers must exclude
  `zone === 'unlocated'` from spatial math** (plotShots and hexbinEngine do; anything new
  must too).
- `updateShotEvent` re-classifies zone when x AND y change; sets `input_method:
  'post_game_edit'`, `edited_at`.
- **Daemon parallel writer:** `pi-daemon/supabaseSync.js writeShotEvent` inserts the same
  columns but does NOT centroid-backfill (x/y null pass-through) and never re-classifies.
  Two writers, one table — keep their semantics aligned when you touch either.

### 2.4 The row (`shot_events`, camel model in `shotchart/types/shotTypes.ts`)
`id · game_code · player_id (ROSTER id from games.data JSONB — NOT auth/player_profiles id;
identity linking is master-context §8) · team_side A|B · x · y (portrait, nullable) · zone ·
made · points 1|2|3 · shot_type 'field_goal'|'free_throw' · period · game_clock_sec (remaining)
· shot_clock_sec (mig 012, nullable) · attributes jsonb[] · assisted_by · rebounded_by ·
rebound_type · blocked_by · input_method · edited_at · created_at`.
Read-back: `shotService.getShotsForGame` (ordered by created_at) + `subscribeToShots`
(postgres_changes on `shots:{code}` channel → full re-fetch — simple + correct).
`game_actions`: `action_type rebound|assist|steal|block|turnover|foul · subtype
offensive|defensive · player_id · team_side · period · game_clock_sec · related_shot_id`.

## 3. The engine layer (`src/services/statsEngine.ts` — pure, tested)

**Source-of-truth policy** (header comment, honored throughout): shooting from shot_events
when the player has shot rows, else roster counters from `games.data`; REB/AST/STL/BLK/TOV/PF
from game_actions (+ `assistedBy`/`reboundedBy`/`blockedBy` riding on shot rows); score
timeline replayed from made shots sorted (period asc, clock desc).

**Computed today** → view models in `components/stats/types.ts`:
`buildGameBoxScore` (rows + totals + TS%/eFG% + capability flags via `gameMode.ts`) ·
`reconstructScoreTimeline` · `detectScoringRuns` (min 6-0) · `biggestLeads` ·
`buildTeamComparison` · `aggregateZones(shots, side?, playerId?)` · `distanceBands`
(3s binned by ZONE not distance — corner-3 fix `e7d827b`) · `possessionSplit`
(Early/Mid/Late) · `playerPeriodScoring` · `plotShots` · `buildRosterIndex`.

**Built tonight (`d379db5`) — the S4/S5 hard parts, DONE:**
| Function | Returns | Notes |
|---|---|---|
| `attributeSplits(shots, side?, playerId?)` | `AttributeSplit[]` | first consumer of `attributes`; rows overlap by design (multi-tag shots) |
| `specialPoints(shots, side?)` | `{fastbreak, secondChance, offTurnover, inPaint}` | tags for the first three; paint zone-derived (at_rim/restricted/paint_L/R); FG points only — tags aren't captured on FTs |
| `leadFlow(timeline, {totalGameSec?})` | changes/ties/time-in-front | tie-transit counts as ONE change (+→0→− is one flip); tail segment needs totalGameSec |
| `clutchStats(shots, {totalPeriods=4, windowSec=300, marginMax=5})` | team lines + player list | margin evaluated BEFORE each event via chrono score replay; OT counts entirely; FTs in line, not in fga |
| `assistNetwork(shots, side?)` | links + assisted% + topDuo | made FGs with assistedBy; ids are roster ids — resolve names via `buildRosterIndex` |
| `possessionHistogram(shots, {duration=24, binSize=3}, side?)` | 8 `ShotClockBin`s | bins (hi−3, hi], last includes 0 |
| `shotQuality(shots, side?, playerId?)` | expected vs actual PPA | league priors from `lib/xppa.ts` (tuned — never round); **UI must gate on `capabilities.hasMisses`** or makes-only data inflates ppaActual |
| `hexbinEngine.buildHexbins(shots, {radius=3, minAttempts, side?, playerId?})` | `HexbinResult` | portrait-space Goldsberry bins; size=`sizeT`, color=`fgPct` or `delta`; excludes FT/unlocated/null-xy; `hexPath` re-exported for SVG |

`exportJSON` now emits the whole `analytics` block (hexbins advanced-only). CSV/PDF/print and
share cards do NOT consume the new functions yet — that's the S4-UI/S6 work (§5).

**xPPA relationship:** `lib/xppa.ts` = live console HUD (player-blended, k=8 shrinkage).
`shotQuality`/hexbin `expPpa` use the raw `ZONE_PRIOR` (league prior, deliberately NOT
player-blended — it measures shot-diet quality, not shooter skill). Don't merge them.

## 4. Consumers map (who reads what — check before changing any shape)

- **StatsHub** (`components/stats/StatsHub.tsx` ← `useGameStats`): Summary (LeadRunStrip,
  ScoringTimelineChart, TeamComparison) · Box (BoxScoreTable ×2 — renders `reb` only;
  oreb/dreb computed-not-shown) · Shot Charts advanced-only (ShotMap raw dots, ZoneHeatmap
  4-unit sampling of `aggregateZones`, DistanceBreakdown, PossessionPanel).
- **Exports** (`components/stats/export/exportGameV2.ts`): box CSV · shot-level CSV (advanced)
  · JSON (now w/ analytics) · branded A4 print/PDF. Legacy `services/exportService.ts` is a
  REDUNDANT older path (PlayerSeasonView only) — merge target, PLAN-R Phase 10.
- **Share cards** (`components/stats/share/cards/{gameCard,playerCard,shotArtCard,shared}.ts`
  + `ShareComposer` + `shareImage.svgToPng`): deterministic SVG→1080 PNG, 1:1 + 9:16.
  `courtGroupSvg` in shared.ts draws the half-court + dots — the hexbin card (S6) plugs
  `buildHexbins` + `hexPath` into exactly that slot.
- **Live surfaces**: ShotChartView/HalfCourt (spectator), PiConsole/AdvancedCourtHex (host),
  coach app (Flutter, reads shot_events via postgres_changes).

## 5. What Opus builds next, in order (upgraded S-phase specs)

1. **S4-UI — surface the new analytics in StatsHub** (pure consumption, zero new math):
   a "Team Stats+" strip on Summary (specialPoints + leadFlow + clutch headline), an
   "Attributes" section (attributeSplits bars, gate: rows.length>0), assist network on Box tab
   (topDuo callout + links table w/ roster names), possessionHistogram replacing/augmenting
   PossessionPanel (gate: hasShotClock), shotQuality panel (gate: hasMisses), oreb/dreb
   columns when capabilities include them. Design per DESIGN-SYSTEM-WEB.md; every section
   capability-gated exactly like existing ones.
2. **S5-UI — hexbin chart component**: new `stats/advanced/HexShotChart.tsx` rendering
   `buildHexbins` over `StatsCourt` (size=sizeT×radius, color=fgPct scale or delta diverging
   scale, legend, minAttempts selector 1/2/4, team + player filter). **Get Shrujal's
   reference screenshots FIRST** (he has specific multi-parameter looks in mind).
3. **S6 — share cards** (masterplan §5): player heatmap card = `courtGroupSvg` + hexbins;
   MVP card; momentum card (timeline + runs); quarter strip (playerPeriodScoring). Then the
   composer stat-picker.
4. **S1/S2** (shot-input engine + MISS) and **S3** (Pi polish) per masterplan — S1 also fixes
   the FT fake-location and deferred-flow defects (§6).
5. **S7 career layer**: aggregate on `end_game` into `player_game_log`/`player_sport_stats`;
   career hexbins = `buildHexbins` over all-time shots (add `(player_id)` index check);
   blocked on identity linking for cross-app value (master context §8).

## 6. Known data-quality quirks (decide-with-Shrujal list, restated precisely)

1. FT rows carry fake `zone:'mid_top'` + paint coords (web path only) — S1 fix: persist
   `zone:'free_throw'`, x/y null. Migration of EXISTING rows: `update shot_events set x=null,
   y=null, zone='free_throw' where shot_type='free_throw'` (safe: nothing reads FT locations).
2. `unlocated` rows get centroid (50,70) coords on the web write path — every spatial consumer
   must filter `zone==='unlocated'` (current ones do; tests enforce for hexbins/plots).
3. Daemon never sends misses (until A2) and never backfills coords — quick-mode Pi rows are
   `{x:null, y:null, zone:'unlocated'}`.
4. `points===3` vs zone disagreement is possible on line-foot edits — engine trusts recorded
   `points` for scoring, zone for spatial (documented, correct).
5. `attributes` on FTs: not capturable in either flow (court/context steps skipped or FG-only)
   — `specialPoints` therefore under-counts fastbreak points vs NBA convention (which includes
   FTs earned on the break). Acceptable; revisit with and-one chaining.
6. Two shot_events writers (web shotService / daemon supabaseSync) with different null
   handling — unify semantics when the shared attribution engine lands (S1).

## 7. Invariants for anyone touching this pipeline (the short law)

Portrait 0–100 × 0–94, basket (50, 10.5) · zones re-derivable from coords; centroids must
self-classify (test-enforced) · `unlocated` never enters spatial math · clocks count down ·
UNDO = DELETE (coach_annotations CASCADE) · ZONE_PRIOR values are tuned, never round ·
Flutter `shot_models.dart` mirrors courtZones 1:1 · wire/DB field names frozen (3 repos).
