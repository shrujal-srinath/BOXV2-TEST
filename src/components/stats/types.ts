// src/components/stats/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Game Stats & Analytics v2 — shared types
//
// STATS 1 = per-game game stats (this file). Mode-aware (quick/stats/advanced).
// The stats engine (src/services/statsEngine.ts) turns raw game data + shot_events
// + game_actions into these view-model shapes. Components only consume these.
// ─────────────────────────────────────────────────────────────────────────────

export type GameMode = 'quick' | 'stats' | 'advanced';
export type TeamSide = 'A' | 'B';

/** A counting-stat category we may or may not have tracked for a given game. */
export type StatCategory =
  | 'pts' | 'fg' | 'tp' | 'ft'
  | 'reb' | 'oreb' | 'dreb'
  | 'ast' | 'stl' | 'blk' | 'tov' | 'pf'
  | 'min' | 'plusMinus';

/**
 * Data-driven capability flags. We never trust the mode alone — we inspect the
 * actual rows so we only render columns/sections that have real data.
 */
export interface StatCapabilities {
  mode: GameMode;
  exportable: boolean;          // false for quick
  hasPlayers: boolean;          // roster with attributed stats exists
  hasShotLocations: boolean;    // shot_events with real x/y (advanced)
  hasRebounds: boolean;
  hasAssists: boolean;
  hasSteals: boolean;
  hasBlocks: boolean;
  hasTurnovers: boolean;
  hasFouls: boolean;
  hasFreeThrows: boolean;
  hasThrees: boolean;
  hasMisses: boolean;           // any missed field goals logged (drives heatmap mode)
  hasShotClock: boolean;        // possession-time analytics available
  /** Which box-score columns to render, in display order. */
  columns: StatCategory[];
}

/** One player's line in the box score. */
export interface BoxScoreRow {
  playerId: string;
  name: string;
  number: string;
  position?: string;
  minutes: number | null;       // null when not tracked
  pts: number;
  fgm: number; fga: number; fgPct: number;
  tpm: number; tpa: number; tpPct: number;
  ftm: number; fta: number; ftPct: number;
  oreb: number; dreb: number; reb: number;
  ast: number; stl: number; blk: number; tov: number; pf: number;
  plusMinus: number | null;
  tsPct: number;                // true shooting
  efgPct: number;               // effective FG%
  disqualified: boolean;
  dnp: boolean;                 // did not play (no recorded activity)
}

/** Team totals + roster lines. */
export interface TeamBoxScore {
  side: TeamSide;
  name: string;
  color: string;
  score: number;
  rows: BoxScoreRow[];
  totals: Omit<BoxScoreRow, 'playerId' | 'name' | 'number' | 'position' | 'disqualified' | 'dnp' | 'minutes' | 'plusMinus'> & {
    minutes: null;
    plusMinus: null;
  };
}

export interface GameBoxScore {
  teamA: TeamBoxScore;
  teamB: TeamBoxScore;
  capabilities: StatCapabilities;
}

/** Cumulative score at a moment in the game (for the scoring-over-time chart). */
export interface ScoreTimelinePoint {
  /** Absolute seconds elapsed since tip-off (period-aware). */
  elapsedSec: number;
  period: number;
  clockLabel: string;           // "Q2 4:35"
  scoreA: number;
  scoreB: number;
  lead: number;                 // scoreA - scoreB
}

/** A scoring run by one team (used for the lead/run strip). */
export interface ScoringRun {
  side: TeamSide;
  points: number;
  startLabel: string;
  endLabel: string;
}

/** One row in the Sofascore-style team-vs-team comparison. */
export interface TeamComparisonRow {
  label: string;                // "Field Goals", "Rebounds", …
  category: StatCategory;
  a: number;
  b: number;
  /** Optional secondary text, e.g. "27/55" under a FG% bar. */
  aDetail?: string;
  bDetail?: string;
  /** When true, value is a percentage (0–100) for bar scaling. */
  isPct?: boolean;
}

/** Aggregated shooting for one court zone (advanced zone heatmap). */
export interface ZoneAggregate {
  zone: string;
  label: string;
  fgm: number;
  fga: number;
  fgPct: number;
  points: number;
  /** Centroid in 0–100 × 0–94 court space, for placing the tile/label. */
  cx: number;
  cy: number;
}

/** Shooting split by distance band (advanced). */
export interface DistanceBand {
  label: string;                // "0–3 ft", "3–10 ft", …
  minFt: number;
  maxFt: number;
  fgm: number;
  fga: number;
  fgPct: number;
  points: number;
}

/** A player's scoring in a single period (for the quarter-by-quarter strip). */
export interface PeriodScore {
  period: number;
  pts: number;
  fgm: number;
  fga: number;
}

/** Shooting split by where in the shot clock the attempt came (advanced). */
export interface PossessionBucket {
  label: string;                // "Early", "Mid", "Late"
  fgm: number;
  fga: number;
  fgPct: number;
  points: number;
}

/** A single shot positioned for the exact-location shot map (advanced). */
export interface PlottedShot {
  id: string;
  playerId: string | null;
  playerName?: string;
  side: TeamSide;
  x: number;                    // 0–100 court space
  y: number;                    // 0–94 court space
  made: boolean;
  points: 1 | 2 | 3;
  period: number;
  clockLabel: string;
  distanceFt: number;
}
