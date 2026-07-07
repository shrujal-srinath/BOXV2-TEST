# THE BOX — Game Stats & Analytics v2 (Breakthrough Feature)

**Version**: 2.0
**Date**: June 17, 2026
**Scope**: STATS 1 — *Game Stats* (per-game, exportable post-game). STATS 2 (player career profiles) is a separate later effort.
**Decisions locked**: Light + dark (THE BOX design system) · Box score built first.

---

## 0. Research Findings (current system)

| Area | Finding | Implication |
|------|---------|-------------|
| Game modes | `GameSettings.gameMode = 'quick' \| 'stats' \| 'advanced'` set in `GameSetup.tsx` (Quick = score only, Stats = +players, Advanced = +shot chart) | All stats UI must branch on mode |
| Shot data | `shot_events` (basketball-only) already stores float `x,y` on a **0–100 × 0–94** grid + `zone`, `made`, `points`, `game_clock_sec`, `attributes`, `assisted_by`, `rebounded_by`, `rebound_type`, `blocked_by` | Exact location is *supported* by the schema |
| **Capture precision** | `HalfCourtCanvas` **snaps each tap to the nearest hex-grid center** (`findHex → HEX_CENTERS[idx]`) before saving | Must store the **raw tapped point** for true pinpoint dots (Phase 4) |
| Score-at-shot | **Not stored**, but fully **reconstructable** by replaying `shot_events` chronologically (all scoring incl. free throws flows through this table) | No schema change needed for scoring timeline |
| Possession time | Shot-clock value at shot **not stored** | Add `shot_clock_sec` column (Phase 4, additive) |
| Non-shot stats | `game_actions` holds `rebound/steal/turnover/block/assist/foul` | Box score "only-tracked columns" sourced here |
| Post-game surfaces | `GameReviewScreen` (referee) knows `gameMode`; `ShotChartView` is the legacy shot page | Entry points to wire the new hub |
| Existing v1 stats | `src/components/stats/**` — dark-only, mode-agnostic, basic | Rebuild to design system + mode-aware |

**Design system** (CLAUDE.md): light-first — page `#F0EEE9`, white cards w/ soft shadow, `red-600` accents, section headers with `border-l-4 border-red-600`; full dark-mode (`zinc-950/900`) variants. Targets ESPN / NBA.com / Sofascore.

---

## 1. What each mode exports

### Quick (`quick`)
- **No stats, no export.** Hub shows final score + "Stats not tracked for Quick games" empty state. All export entry points hidden.

### Stats (`stats`)
- **Box score** (NBA-style, ref 1): per-player MIN, PTS, FG, 3PT, FT, REB, AST, STL, BLK, TO, PF, +/- with team totals. Only columns that have tracked data are shown.
- **Scoring timeline** (ref 4): cumulative score by game clock for both teams + lead tracker / runs.
- **Team vs Team** (ref 3): Sofascore-style bidirectional bars — FG made/att, 3PT, FT, REB, AST, TO, fouls.
- **Shot timeline / play-by-play**: who scored, when (game clock), running score after.
- Export: Box Score (CSV / PDF / JSON) + summary graphics PDF.

### Advanced (`advanced`)
- Everything in Stats, **plus**:
- **Exact shot locations**: makes/misses as precise dots on the court.
- **Zone shooting %% heatmap** (ref 2): court split into zones, each tile shows `%` + `made/att`, colour-scaled by efficiency.
- **Shot distance** breakdown (by ft band), optional **possession / shot-clock** analytics.
- Export choice: **Box Score** *or* **Detailed Analytics (with heatmaps)**.

---

## 2. Architecture

```
src/services/
  statsEngine.ts        ← NEW single source of truth (box score, timeline, team compare, zones, distance)
  gameMode.ts           ← NEW mode resolver + capability flags (what data exists)
  exportService.ts      ← v2 (mode-aware, pro PDF/CSV/JSON, print)

src/components/stats/
  StatsHub.tsx          ← NEW mode-aware router (quick/stats/advanced)
  boxscore/BoxScoreTable.tsx, TeamTotalsRow.tsx
  summary/ScoringTimelineChart.tsx, TeamComparison.tsx, LeadRunStrip.tsx
  advanced/ShotMap.tsx (exact dots), ZoneHeatmap.tsx, DistanceBreakdown.tsx, PossessionPanel.tsx
  shared/  (rebuilt to design system: Card, SectionHeader, StatBar, Pill, Toggle, ExportMenu, Skeletons)

src/components/shotchart/
  HalfCourtCanvas.tsx   ← Phase 4: store raw tapped point (exact), keep hex as visual only
```

Design tokens (shared): `pageBg #F0EEE9 / dark:zinc-950`, `card bg-white / dark:zinc-900` + soft shadow, accent `red-600`, made `emerald-500`, miss `red-500`, neutral `slate`. Both themes everywhere.

---

## 3. Phase plan

### Phase 1 — Data foundation & mode-aware engine  ← (build order: foundation)
- `statsEngine.ts`: `buildBoxScore(shots, actions, roster)`, `reconstructScoreTimeline(shots)`, `buildTeamComparison(...)`, `aggregateZones(shots)`, `distanceBands(shots)`. Strong types in `src/components/stats/types.ts`.
- `gameMode.ts`: resolve mode from game record + `capabilities` (hasPlayers, hasShotLocations, hasRebounds, …) derived from actual data so we only render tracked columns.
- Dedup rules: assists ← `shot_events.assisted_by`; reb/stl/blk/to/pf ← `game_actions`; FT ← `shot_events.shot_type='free_throw'`.

### Phase 2 — Pro Box Score (Stats + Advanced)  ← **FIRST visual per decision**
- `BoxScoreTable` (ref 1): sortable, sticky first col, team totals, only-tracked columns, light+dark, responsive (priority columns on mobile). Rebuilt shared `Card`/`SectionHeader`.

### Phase 3 — Game summary graphics (Stats + Advanced)
- `ScoringTimelineChart` (ref 4, Recharts area/line, dual team, lead shading).
- `TeamComparison` (ref 3, bidirectional bars).
- `LeadRunStrip` (biggest lead / longest run).

### Phase 4 — Court precision (Advanced capture)
- `HalfCourtCanvas`: store exact `canvasToApp(mx,my)` raw point; hex used only for the live heat preview. Capture `shot_clock_sec`. Additive migration `012_shot_events_advanced.sql` (`shot_clock_sec INTEGER`).

### Phase 5 — Advanced analytics (Advanced mode)
- `ShotMap` exact make/miss dots (filter by player/period/type).
- `ZoneHeatmap` (ref 2) zone %% tiles, colour-scaled.
- `DistanceBreakdown` (ft bands) + `PossessionPanel` (shot-clock usage) when data present.

### Phase 6 — Export v2 & StatsHub wiring
- `StatsHub` branches by mode; Advanced offers Box Score vs Detailed. Pro PDF (print layout), CSV (box score grid), JSON (full structured object). Quick = no export.

### Phase 7 — Polish & integration
- Entry points from `GameReviewScreen`, Dashboard game cards, completed-game lists. Responsive, empty/loading/error states, a11y, light/dark parity.

---

## 3b. Build progress

- ✅ **Phase 1** — `statsEngine.ts`, `gameMode.ts` (data-driven capabilities incl. `hasMisses`), `types.ts`, `useGameStats.ts`.
- ✅ **Phase 2** — `boxscore/BoxScoreTable.tsx` (sortable, sticky col, totals, DNP, capability-gated, light+dark).
- ✅ **Phase 3** — `summary/TeamComparison.tsx`, `ScoringTimelineChart.tsx`, `LeadRunStrip.tsx`; `GameHeaderV2`, mode-aware `StatsHub` wired to `/game/:code/stats`.
- ✅ **Phase 5** — `advanced/StatsCourt.tsx` (SVG half-court), `ShotMap.tsx` (exact dots + filters), `ZoneHeatmap.tsx` (FG% grid via `classifyZone` sampling, auto volume-fallback when no misses), `DistanceBreakdown.tsx`.
- ✅ **Phase 6** — `export/exportGameV2.ts` (CSV box + shots, JSON full, branded print HTML → native print + html2pdf), `export/ExportMenu.tsx` (mode-aware; Advanced adds detailed + shot CSV).
- ✅ **Phase 7 (entry points)** — Dashboard card "Game Stats →", SpectatorView "View Stats →", ShotChartView "Full Stats →".
- ✅ **Phase 4** — (1) exact-point capture in `HalfCourtCanvas` (court-bounds guard, no hex-snap); (2) migration `012_shot_events_advanced.sql` (`shot_clock_sec`) + capture plumbing in `HostConsole`/`PiConsole` + `PossessionPanel` (gated on `hasShotClock`); (3) Pi miss-logging — daemon `writeShotEvent` honours `made`+`shot_clock_sec`, `shot_attributed` forwards them, `PiAdvancedShotFlow` emits `made`, `useRefereeBox.requestMiss`, "LOG MISS" trigger on both touch decks (standard + minimal).
  - ⚠️ **Action required:** apply `supabase/migrations/012_shot_events_advanced.sql` to the DB (Supabase MCP was unauthorized in-session).
- ⏳ **Phase 7 (remaining)** — rebuild player drilldown (still old dark page), retire v1 dark stats, a11y/responsive QA; **verify the Pi "LOG MISS" flow on real hardware**.

Decisions: PDF = both native-print (vector) + html2pdf (one-click). Heatmap = FG% with volume fallback. Court precision = last.

## 3c. Feature backlog (to support richer stats — keep growing)

These are capture-side features that unlock more analytics:
- **Pi miss logging** (requested): add a miss path to `PiAdvancedShotFlow`/daemon so Pi-captured advanced games record misses → real FG% heatmaps. (Phase 4)
- **Attributed rebounds/assists/steals/blocks** in the web/Pi consoles (currently often `player_id: null`) → per-player REB/AST columns light up.
- **Offensive/defensive rebound split** at capture → OREB/DREB columns + rebound-rate analytics.
- **Shot-clock / possession capture** (`shot_clock_sec`) → "seconds into possession", early/late-clock efficiency. (Phase 4)
- **Assist linking** (passer → shot) in web flow → assist networks, assisted-FG%.
- **Minutes / lineup tracking** via substitutions → +/- , on/off, lineup net rating.
- **Quarter-by-quarter team scores** persisted → period box (e.g. 24-18-22-19) on the header.
- **Free-throw trip grouping** (and-1, 2-shot, 3-shot) → FT-rate, trips analytics.
- **Turnover types** (live-ball/dead-ball) and **steals→points off TO**.
- **STATS 2** (later): player career profiles aggregating across games.

## 3d. Graphical export + Instagram share (in progress)

**Decisions:** Square (1080×1080) + Story (1080×1920); cards = Player / Game / Shot-art; Strava-style **share composer** (user picks template, format, and which blocks to include); pure-SVG→PNG pipeline (deterministic, crisp, lazy-loaded; no html2canvas).

### A. Print/PDF sheet — real graphs (not tables)
- `buildPrintHTML` upgraded: team-comparison **mirrored bars**, an inline **SVG scoring-timeline** line chart from `data.timeline`, and (detailed) shot-map + zone-heatmap SVGs with an FG% legend. Vector, A4 page-break aware.
- Helpers in `export/printGraphics.ts`: `comparisonBarsHTML`, `timelineSvg`.

### B. Share image infra — `share/shareImage.ts`
- `svgToPng(svg, w, h)` → render SVG string onto a `w×h` canvas → PNG Blob (exact 1080px).
- `downloadBlob` + `shareBlob` (Web Share API with files when available, else download).

### C. Card templates — pure SVG string builders `share/cards/*`
- `playerCard(data, playerId, opts)`, `gameCard(data, opts)`, `shotArtCard(data, side, opts)`.
- `opts = { format: 'square'|'story', blocks: Set<string> }` → Strava-style content toggles.
- Branded "THE BOX", bold sports aesthetic, team colours, big numerics, red accent; same builder used for live preview (inline SVG) and export (svgToPng).

### D. Share composer — `share/ShareComposer.tsx`
- Modal: template picker · format toggle · block toggles · live preview · Download PNG / Share.
- Entry points: "Share" button in `StatsHub` + `PlayerGameViewV2`.

## 4. Success criteria
- Quick → clean "not tracked" state, zero export.
- Stats → accurate box score + timeline + team compare; CSV/PDF/JSON.
- Advanced → exact shot dots + zone heatmap + distance; choose box score vs detailed export.
- Pixel-quality light & dark; mobile-readable; <200ms interactions; reconstructed running score matches final score exactly.
