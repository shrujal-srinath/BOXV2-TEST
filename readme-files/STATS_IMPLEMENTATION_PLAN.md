# THE BOX — Player Statistics & Analytics Implementation Plan

**Version**: 1.0  
**Date**: June 16, 2026  
**Focus**: Post-game stats, desktop-first UI, core metrics (scoring, game timing, distributions)  
**Design Inspiration**: NBA.com shot charts, player stat sheets with radar/distribution charts

---

## Table of Contents

1. [Overview](#overview)
2. [Core Stats to Capture & Display](#core-stats-to-capture--display)
3. [Data Schema](#data-schema)
4. [UI/UX Architecture](#uiux-architecture)
5. [Page Designs](#page-designs)
6. [Component Breakdown](#component-breakdown)
7. [Implementation Phases](#implementation-phases)
8. [Execution Checklist](#execution-checklist)

---

## Overview

### Mission
Build a **beautiful, data-rich post-game analytics platform** that displays player performance through shot charts, stat distributions, player stat sheets, and meaningful visualizations — desktop-first, with responsive mobile adaptation.

### Key Principles
- **Desktop-first**: Design for coaches/analysts reviewing games on desktop
- **Post-game only**: No live/real-time complications — purer design
- **Core stats only**: Focus on what's commonly tracked: points, shooting %, game timing
- **Beautiful graphics**: Shot charts, radar charts, distribution plots, sparklines
- **Player context**: Who played when, in which quarter, game situation

### Reference Designs
1. **Shot Chart** (Ref 1): Scatter plot of all shots (made ✓ missed ✗), color-coded, FG% summary
2. **3D Density** (Ref 2): High-density shot region visualization
3. **Player Sheet** (Ref 3): Multi-stat table with player photo, career/game stats, mini charts
4. **Radar Chart** (Ref 4): Stat comparison (PTS, REB, AST, eFG%, +/-) in pentagon shape
5. **Shot Distribution** (Ref 5): Density heatmap showing shot frequency/efficiency by region

---

## Core Stats to Capture & Display

### Tier 1: Essential Stats (Always Display)
```
Counting Stats:
- Points (PTS)
- Field Goals Made (FGM)
- Field Goals Attempted (FGA)
- 3-Pointers Made (3PM)
- 3-Pointers Attempted (3PA)
- Free Throws Made (FTM)
- Free Throws Attempted (FTA)
- Rebounds (REB)
- Assists (AST)
- Turnovers (TO)
- Fouls (PF)
- Steals (STL)
- Blocks (BLK)

Efficiency:
- Field Goal % (FG%)
- 3-Point % (3P%)
- Free Throw % (FT%)
- True Shooting % (TS%) — advanced

Game Timing:
- Minutes Played
- Period played in
- Quarter-by-quarter breakdown
```

### Tier 2: Contextual Stats (If Tracked)
```
- Points per shot (PPS)
- Assisted FG%
- Uncontested vs contested shots
- Paint vs perimeter points
- Fast break points
```

### Tier 3: Advanced (Only If Easy to Compute)
```
- Player Efficiency Rating (PER)
- +/- (plus-minus)
- Usage Rate
- Assist Rate
```

---

## Data Schema

### Existing Tables to Leverage
```sql
-- shot_events (already exists)
SELECT id, game_code, player_id, team_side, 
       x, y, zone, made, points, period, game_clock_sec,
       assisted_by, blocked_by, attributes
FROM shot_events;

-- game_actions (already exists) — rebounds, assists, steals, turnovers, fouls
SELECT id, game_code, player_id, team_side,
       action_type, period, game_clock_sec, related_shot_id
FROM game_actions;

-- player_game_log (already exists) — per-game aggregation
SELECT id, game_code, player_id, team_side, score_contribution, 
       sport_stats (JSONB)
FROM player_game_log;

-- player_profiles (already exists)
SELECT id, name, jersey_number, position, photo_url, team
FROM player_profiles;
```

### New Tables / Schema Changes

```sql
-- Enhancement: Enrich shot_events with distance and defensive context
ALTER TABLE shot_events 
ADD COLUMN IF NOT EXISTS shot_distance_ft FLOAT,
ADD COLUMN IF NOT EXISTS contested BOOLEAN,
ADD COLUMN IF NOT EXISTS shot_type TEXT; -- 'catch_and_shoot', 'pullup', 'post_up'

-- Enhancement: Player game intervals (for quarter/period breakdowns)
CREATE TABLE IF NOT EXISTS player_game_intervals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code TEXT NOT NULL REFERENCES games(code),
  player_id TEXT NOT NULL,
  team_side CHAR(1) NOT NULL,
  period_in SMALLINT NOT NULL,
  clock_in_sec INTEGER NOT NULL,
  period_out SMALLINT,
  clock_out_sec INTEGER,
  created_at TIMESTAMP DEFAULT now(),
  FOREIGN KEY (game_code, player_id, team_side) REFERENCES player_game_log(game_code, player_id, team_side)
);

-- Derived: Player game summary (computed post-game, cached)
CREATE TABLE IF NOT EXISTS player_game_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team_side CHAR(1) NOT NULL,
  -- Counting
  pts INTEGER,
  fgm INTEGER,
  fga INTEGER,
  tpm INTEGER,
  tpa INTEGER,
  ftm INTEGER,
  fta INTEGER,
  reb INTEGER,
  ast INTEGER,
  to INTEGER,
  pf INTEGER,
  stl INTEGER,
  blk INTEGER,
  minutes_played DECIMAL(5,2),
  -- Efficiency
  fg_pct DECIMAL(5,1),
  tp_pct DECIMAL(5,1),
  ft_pct DECIMAL(5,1),
  ts_pct DECIMAL(5,1),
  -- Breakdown
  q1_pts INTEGER, q2_pts INTEGER, q3_pts INTEGER, q4_pts INTEGER,
  q1_fga INTEGER, q2_fga INTEGER, q3_fga INTEGER, q4_fga INTEGER,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(game_code, player_id)
);
```

---

## UI/UX Architecture

### Design System
- **Background**: Dark theme (zinc-950) — easier on eyes for long viewing
- **Cards**: zinc-900 with subtle borders
- **Accent**: Red-600 for key stats, highlights
- **Text**: zinc-50 primary, zinc-400 secondary
- **Charts**: Color-blind friendly palette (blues, oranges, greens for made/missed)

### Page Hierarchy

```
/stats (Hub)
├── /game/:gameCode/stats (Post-Game Stats Page)
│   ├── Game Header (score, teams, date, final)
│   ├── Player Stat Tabs
│   │   ├── Team A Players (table + drill-down)
│   │   └── Team B Players (table + drill-down)
│   └── Export (PDF, JSON, CSV)
│
├── /player/:playerId/game/:gameCode (Individual Player Game View)
│   ├── Hero: Player info + key stats (PTS, AST, REB)
│   ├── Shot Chart (scatter + heatmap)
│   ├── Stat Breakdown (Q1/Q2/Q3/Q4 bars)
│   ├── Shooting Efficiency (zone breakdown table)
│   ├── Radar Chart (comparison to team avg)
│   └── Full Game Log (all actions chronologically)
│
└── /player/:playerId/season (Player Season Stats)
    ├── Career Highs
    ├── Season Averages
    ├── Game-by-Game Table
    └── Trend Charts (PPG, APG over season)
```

---

## Page Designs

### Page 1: Game Stats Hub (`/game/:gameCode/stats`)

**Layout**: Two-column desktop, stacked mobile

**Left Column (60%)**:
```
┌─ GAME HEADER ─────────────────────────┐
│ Team A [Logo] 92 – 87 Team B [Logo]   │
│ June 16, 2026 · Finals Game 2          │
│ Final Score · 4 Quarters (32 min)      │
└───────────────────────────────────────┘

┌─ QUICK GAME STATS PILLS ──────────────┐
│ FG%: 48.5%  |  3P%: 35.2%  |  REB: 42 │
└───────────────────────────────────────┘

┌─ PLAYER STATS TABLE (Team A) ─────────┐
│ Player          PTS  FG%  AST  REB    │
│ ─────────────────────────────────────  │
│ Steph Curry     28   50%  7    4  [→] │ ← Click to drill-down
│ Klay Thompson   18   42%  2    3  [→] │
│ Draymond Green  12   52%  5    8  [→] │
└───────────────────────────────────────┘

┌─ PLAYER STATS TABLE (Team B) ─────────┐
│ [Same structure]                       │
└───────────────────────────────────────┘
```

**Right Column (40%)** — Sticky on desktop:
```
┌─ TEAM STATS ──────────────────────────┐
│ Team A                                 │
│ ├─ FG%: 48.5% (27/55)                 │
│ ├─ 3P%: 35.2% (12/34)                 │
│ ├─ FT%: 82.1% (23/28)                 │
│ ├─ REB: 42 (12 OFF, 30 DEF)          │
│ ├─ AST: 24                             │
│ └─ TO: 12                              │
│                                        │
│ Team B [Same]                         │
└───────────────────────────────────────┘

┌─ EXPORT BUTTONS ──────────────────────┐
│ [PDF Report] [JSON] [CSV]             │
└───────────────────────────────────────┘
```

### Page 2: Individual Player Game View (`/player/:playerId/game/:gameCode`)

**Hero Section** (100% width):
```
┌─────────────────────────────────────────────────────────┐
│ [Avatar] Steph Curry #30 · Golden State Warriors        │
│                                                          │
│ 28 PTS  7 AST  4 REB  |  50% FG  45% 3P  83% FT         │
│ Played 32:15 (4 QTRs) · +12 Plus-Minus                 │
└─────────────────────────────────────────────────────────┘
```

**Three-Column Layout Below** (desktop) / Stacked (mobile):

**Col 1 (33%): Shot Chart**
```
┌─ SHOT CHART ──────────────────────────┐
│  [Basketball Court Visualization]      │
│  • Dots = shots (color = made/missed)  │
│  • Size = distance                     │
│  • Hover for shot details              │
│                                        │
│  FG: 9/18 (50%)  |  3P: 5/11 (45%)   │
│  Paint: 5/8 (62%) | Perimeter: 4/10  │
└───────────────────────────────────────┘
```

**Col 2 (33%): Quarter Breakdown**
```
┌─ SCORING BY QUARTER ──────────────────┐
│  Q1: 8 PTS  │ ████░░                  │
│  Q2: 7 PTS  │ ███░░░                  │
│  Q3: 9 PTS  │ █████░                  │
│  Q4: 4 PTS  │ ██░░░░                  │
│  ─────────────────────────────────────│
│  FG% by Q: 50% | 44% | 56% | 40%     │
└───────────────────────────────────────┘
```

**Col 3 (33%): Stat Radar Chart**
```
┌─ PLAYER COMPARISON ───────────────────┐
│        [Radar Chart - 5-sided]         │
│       PTS (blue) vs Team Avg (gray)   │
│  - PTS: 28 (team avg: 18.5)           │
│  - AST: 7 (team avg: 4.8)             │
│  - REB: 4 (team avg: 5.2)             │
│  - eFG%: 55% (team avg: 48%)          │
│  - +/-: +12 (team avg: +2)            │
└───────────────────────────────────────┘
```

**Row 2 (100% width): Shooting Efficiency by Zone**
```
┌─ ZONE-BY-ZONE BREAKDOWN ──────────────────────────────┐
│ Zone              FGM-FGA  FG%   PTS    Distance      │
│ ─────────────────────────────────────────────────────  │
│ At Rim (0-3 ft)    5-8    62%   10    ████░░░░░░     │
│ Paint (3-15 ft)    2-4    50%   4     ███░░░░░░░     │
│ Mid-Range          1-2    50%   2     ███░░░░░░░     │
│ 3-Point           5-11    45%   15    ████░░░░░░     │
└─────────────────────────────────────────────────────────┘
```

**Row 3 (100% width): Game Timeline / Play-by-Play**
```
┌─ GAME TIMELINE (Expandable) ──────────────────────────┐
│ Q1, 8:30  │ ✓ 3PT (assisted by Draymond)  +3 PTS     │
│ Q1, 7:15  │ ✗ 2PT (pullup, contested)     0 PTS      │
│ Q1, 5:20  │ ✓ FT (free throw)              +1 PTS     │
│ ...                                                    │
│ Q4, 2:00  │ ✓ 3PT (catch & shoot)          +3 PTS     │
└─────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### High-Level Component Tree

```
src/components/stats/
├── shared/
│   ├── StatCard.tsx (displays one stat + sparkline)
│   ├── StatPill.tsx (inline stat badge, e.g., "28 PTS")
│   ├── QuarterBreakdownBar.tsx (Q1/Q2/Q3/Q4 bars)
│   ├── ZoneBreakdownTable.tsx (zone → FG% table)
│   └── ExportButton.tsx (PDF/JSON/CSV dropdown)
│
├── charts/
│   ├── ShotChart.tsx (canvas-based court + shot dots)
│   ├── RadarChart.tsx (5-sided polygon, Recharts)
│   ├── ShotHeatmap.tsx (density overlay on court)
│   ├── QuarterTrendChart.tsx (simple bar chart, Recharts)
│   └── SeasonTrendChart.tsx (line chart PPG/AST/REB over season)
│
├── game/
│   ├── GameStatsHub.tsx (main game stats page)
│   ├── GameHeader.tsx (score, teams, date)
│   ├── PlayerStatsTable.tsx (per-team player rows)
│   └── GameTimelineExpander.tsx (play-by-play)
│
├── player/
│   ├── PlayerGameView.tsx (individual player game page)
│   ├── PlayerGameHero.tsx (name, key stats, +/-)
│   ├── PlayerGameAnalysis.tsx (shot chart + quarter + radar)
│   ├── PlayerSeasonView.tsx (career stats, game-by-game)
│   └── PlayerZoneBreakdown.tsx (zone efficiency table)
│
└── layouts/
    ├── StatsPageLayout.tsx (desktop: 2-col, mobile: 1-col)
    └── PlayerAnalysisLayout.tsx (3-col layout with sticky header)
```

### Key Components to Build (Priority Order)

1. **ShotChart.tsx** — Canvas-based court visualization
2. **StatCard.tsx** — Reusable stat display component
3. **PlayerStatsTable.tsx** — Per-game player table
4. **GameStatsHub.tsx** — Main game stats page wrapper
5. **RadarChart.tsx** — Recharts-based radar/spider chart
6. **QuarterBreakdownBar.tsx** — Stacked bar chart by quarter
7. **PlayerGameView.tsx** — Individual player drill-down page
8. **ZoneBreakdownTable.tsx** — Zone-by-zone shooting efficiency

---

## Implementation Phases

### Phase 1: Foundation & Core Pages (3–4 days)
**Goal**: Functional game stats hub with player table and basic drill-down

**Tasks**:
1. Create folder structure (`src/components/stats/`)
2. Build `StatCard.tsx` + `StatPill.tsx` (reusable components)
3. Build `PlayerStatsTable.tsx` (data-driven table from game_actions + shot_events)
4. Build `GameHeader.tsx` (score, teams, final state)
5. Assemble `GameStatsHub.tsx` (full page)
6. Create route `/game/:gameCode/stats`
7. Test with sample game data

**Deliverable**: Clickable game stats page showing all players and key stats

---

### Phase 2: Visualizations & Player Drill-Down (4–5 days)
**Goal**: Beautiful charts and individual player view

**Tasks**:
1. Setup Recharts library
2. Build `ShotChart.tsx` (scatter on court canvas, made/missed dots)
3. Build `RadarChart.tsx` (5-stat comparison radar)
4. Build `QuarterBreakdownBar.tsx` (Q1/Q2/Q3/Q4 scoring bars)
5. Build `PlayerGameView.tsx` (3-col layout: shot chart, quarter bars, radar)
6. Build `ZoneBreakdownTable.tsx` (zone efficiency breakdown)
7. Add game timeline / play-by-play expander
8. Create route `/player/:playerId/game/:gameCode`

**Deliverable**: Full player game analysis page with charts

---

### Phase 3: Season Stats & Trends (2–3 days)
**Goal**: Player season history, game-by-game log

**Tasks**:
1. Build `SeasonTrendChart.tsx` (PPG, AST, REB line chart)
2. Build `PlayerSeasonView.tsx` (game-by-game table, career highs)
3. Aggregate season data from player_game_log
4. Create route `/player/:playerId/season`
5. Add filters: by opponent, by date range

**Deliverable**: Player season stats page with trends

---

### Phase 4: Export & Sharing (1–2 days)
**Goal**: PDF reports, CSV exports, shareable cards

**Tasks**:
1. Build `ExportButton.tsx` (PDF/CSV/JSON dropdown)
2. Implement PDF generation (html2pdf or jsPDF)
3. Implement CSV export (PapaParse)
4. Implement JSON export (structured stat object)
5. Add export to all three pages

**Deliverable**: Export functionality on game/player/season pages

---

### Phase 5: Mobile Responsiveness & Polish (2 days)
**Goal**: Beautiful on all screen sizes, performance optimized

**Tasks**:
1. Test on iPad (tablet view)
2. Test on iPhone (mobile view)
3. Adjust 3-col layout → 1-col on mobile
4. Add dark mode (already set as default)
5. Performance: memoize expensive computations, virtualize long tables
6. Loading states, error boundaries

**Deliverable**: Production-ready, responsive stats platform

---

## Execution Checklist

### Phase 1 Checklist
- [ ] Create `/src/components/stats/` folder structure
- [ ] Build and style `StatCard.tsx` + `StatPill.tsx`
- [ ] Build `PlayerStatsTable.tsx` (fetches from shot_events + game_actions)
- [ ] Build `GameHeader.tsx` (displays final score, teams, date)
- [ ] Wire up `GameStatsHub.tsx` with data hooks
- [ ] Create `/game/:gameCode/stats` route in React Router
- [ ] Test with real game data from `BOXV2-TEST` database
- [ ] Screenshots for reference

### Phase 2 Checklist
- [ ] Install Recharts (`npm install recharts`)
- [ ] Build `ShotChart.tsx` (canvas court + shot dots)
- [ ] Build `RadarChart.tsx` (5-sided polygon, Recharts)
- [ ] Build `QuarterBreakdownBar.tsx` (stacked bar chart)
- [ ] Build `PlayerGameView.tsx` (3-col layout)
- [ ] Build `ZoneBreakdownTable.tsx` (zone efficiency)
- [ ] Add game timeline (play-by-play expandable)
- [ ] Create `/player/:playerId/game/:gameCode` route
- [ ] Test drill-down from game hub → player view

### Phase 3 Checklist
- [ ] Build `SeasonTrendChart.tsx` (line chart)
- [ ] Build `PlayerSeasonView.tsx` (season stats page)
- [ ] Aggregate season data in data hooks
- [ ] Create `/player/:playerId/season` route
- [ ] Add season filters (by opponent, date range)

### Phase 4 Checklist
- [ ] Build `ExportButton.tsx` (dropdown)
- [ ] Implement PDF generation (html2pdf)
- [ ] Implement CSV export (PapaParse)
- [ ] Implement JSON export
- [ ] Add to game/player/season pages

### Phase 5 Checklist
- [ ] Test on iPad (landscape)
- [ ] Test on iPhone (portrait)
- [ ] Adjust responsive breakpoints
- [ ] Add loading skeletons
- [ ] Performance profiling + optimization
- [ ] Error boundaries for failed data fetches

---

## Key Files to Create/Modify

### New Files
```
src/components/stats/
├── shared/
│   ├── StatCard.tsx
│   ├── StatPill.tsx
│   ├── QuarterBreakdownBar.tsx
│   ├── ZoneBreakdownTable.tsx
│   └── ExportButton.tsx
├── charts/
│   ├── ShotChart.tsx
│   ├── RadarChart.tsx
│   ├── ShotHeatmap.tsx
│   └── QuarterTrendChart.tsx
├── game/
│   ├── GameStatsHub.tsx
│   ├── GameHeader.tsx
│   ├── PlayerStatsTable.tsx
│   └── GameTimelineExpander.tsx
└── player/
    ├── PlayerGameView.tsx
    ├── PlayerGameHero.tsx
    ├── PlayerGameAnalysis.tsx
    ├── PlayerSeasonView.tsx
    └── PlayerZoneBreakdown.tsx

src/services/
├── statsService.ts (compute FG%, TS%, zone breakdowns, etc.)
└── exportService.ts (PDF, CSV, JSON generation)

src/hooks/
├── useGameStats.ts
├── usePlayerStats.ts
└── useZoneBreakdown.ts
```

### Modified Files
```
src/App.tsx (add routes)
src/types.ts (add stat types)
```

---

## Design Tokens & Styling

### Colors
```typescript
const colors = {
  bg: '#0a0a0a',        // zinc-950
  bgCard: '#18181b',    // zinc-900
  border: '#3f3f46',    // zinc-700
  text: '#fafafa',      // zinc-50
  textSecondary: '#a1a1aa', // zinc-400
  
  red: '#dc2626',       // red-600 (highlights)
  green: '#22c55e',     // green-500 (made shots)
  orange: '#f97316',    // orange-500 (missed shots)
  blue: '#3b82f6',      // blue-500
  
  // Shot colors
  madeShotColor: '#22c55e',
  missedShotColor: '#ef4444',
};
```

### Typography
```
Page Title: text-3xl font-black
Section Header: text-lg font-bold
Stat Value: text-2xl font-black
Stat Label: text-xs uppercase text-gray-400
```

---

## Success Criteria

- ✅ Game stats hub displays all players with core stats (PTS, FG%, AST, REB)
- ✅ Click player → beautiful drill-down page with shot chart, radar, quarter breakdown
- ✅ All visualizations render smoothly (no lag on 100+ shots)
- ✅ Responsive on desktop, tablet, and mobile
- ✅ PDF/CSV exports work and are properly formatted
- ✅ Dark theme is default, text is readable
- ✅ Performance < 200ms page load for game stats hub

---

## Notes & Gotchas

1. **Game Clock Conversion**: Convert `game_clock_sec` to MM:SS format for display
2. **Missing Stats**: Only show stats that were actually tracked (don't show BLK if not tracked)
3. **Season Aggregation**: Compute season stats from player_game_log at post-game time
4. **Responsive Images**: Player avatars should be lazy-loaded, 100x100 for tables
5. **Colors for Charts**: Use colorblind-friendly palette (avoid pure red/green combinations)
6. **Accessibility**: Ensure stat tables have proper headers, radar chart has legend

---

## Next Steps

**Start with Phase 1** immediately:
1. Create component folder structure
2. Build `StatCard.tsx` + `StatPill.tsx`
3. Build `PlayerStatsTable.tsx` and wire with data
4. Assemble `GameStatsHub.tsx`
5. Test with sample game

Once Phase 1 is complete and looks good, move to Phase 2 (visualizations).
