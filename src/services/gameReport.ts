// src/services/gameReport.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Post-Game Report Engine
//
// ONE call turns a finished game (games.data JSONB + shot_events + game_actions)
// into the complete stats package: box score, timeline, momentum, advanced
// analytics, hexbins, per-player packages, and auto-derived HIGHLIGHTS — the
// narrative facts ("18 PTS game high", "12-0 run in Q3", "clutch: 7 PTS in the
// last 5:00") that share cards and the stats hub lead with.
//
// This is the "engine that creates stats after each game": run it on end_game
// (or lazily on first stats view), feed StatsHub / exports / share cards from
// its output, and (S7) persist its per-player packages into player_game_log
// for careers. Pure + deterministic — see gameReport.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { ShotEvent, GameAction } from '../components/shotchart/types/shotTypes';
import type {
  TeamSide,
  GameBoxScore,
  BoxScoreRow,
  ScoreTimelinePoint,
  ScoringRun,
  TeamComparisonRow,
  ZoneAggregate,
  PeriodScore,
  AttributeSplit,
  SpecialPoints,
  LeadFlow,
  ClutchStats,
  AssistNetwork,
  ShotClockBin,
  ShotQualitySummary,
} from '../components/stats/types';
import {
  buildGameBoxScore,
  reconstructScoreTimeline,
  detectScoringRuns,
  biggestLeads,
  buildTeamComparison,
  aggregateZones,
  attributeSplits,
  specialPoints,
  leadFlow,
  clutchStats,
  assistNetwork,
  possessionHistogram,
  shotQuality,
  playerPeriodScoring,
  buildRosterIndex,
  gameScore,
  playerPIE,
  fourFactors,
  teamRatings,
  type FourFactors,
  type TeamRatings,
} from './statsEngine';
import { buildHexbins, type HexbinResult } from './hexbinEngine';

// ── types ────────────────────────────────────────────────────────────────────

export type HighlightKind =
  | 'game_high'          // top scorer in the game
  | 'double_double'
  | 'triple_double'
  | 'biggest_run'
  | 'clutch_star'
  | 'best_duo'
  | 'hot_hand'           // best eFG% at volume
  | 'perfect_line'       // 100% FG at volume
  | 'wire_to_wire';      // winner never trailed

export interface GameHighlight {
  kind: HighlightKind;
  /** Short display line, e.g. "GAME HIGH — 24 PTS". */
  label: string;
  /** Supporting line, e.g. "#7 Ananya · 9/12 FG". */
  detail: string;
  side?: TeamSide;
  playerId?: string;
  /** Bigger = shown first. Stable ordering across recomputes. */
  weight: number;
}

export interface PlayerReport {
  playerId: string;
  name: string;
  number: string;
  side: TeamSide;
  row: BoxScoreRow;
  zones: ZoneAggregate[];
  periods: PeriodScore[];
  quality: ShotQualitySummary;
  attributes: AttributeSplit[];
  gameScore: number;   // Hollinger
  pie: number;         // Player Impact Estimate, % of game
}

export interface TeamPair<T> { teamA: T; teamB: T }

export interface GameReport {
  header: {
    gameCode: string | null;
    name: string | null;
    dateISO: string | null;
    mode: GameBoxScore['capabilities']['mode'];
    periods: number;
    periodDurationSec: number;
    periodType: 'quarter' | 'half';
    teamA: { name: string; color: string; score: number };
    teamB: { name: string; color: string; score: number };
    winner: TeamSide | 'tie';
  };
  box: GameBoxScore;
  timeline: ScoreTimelinePoint[];
  runs: ScoringRun[];
  leads: { a: number; b: number };
  leadFlow: LeadFlow;
  comparison: TeamComparisonRow[];
  special: TeamPair<SpecialPoints>;
  attributes: TeamPair<AttributeSplit[]>;
  clutch: ClutchStats;
  assists: TeamPair<AssistNetwork>;
  shotClockUsage: TeamPair<ShotClockBin[]> | null;   // null when untracked
  quality: TeamPair<ShotQualitySummary>;
  /** Established advanced metrics; null when the mode tracked too little
   *  (Four Factors need rebounds/turnovers — quick games have neither). */
  advanced: TeamPair<{ fourFactors: FourFactors; ratings: TeamRatings }> | null;
  hexbins: TeamPair<HexbinResult> | null;            // null unless located shots exist
  players: PlayerReport[];                            // sorted PTS desc
  highlights: GameHighlight[];                        // sorted weight desc
}

// ── highlight derivation ─────────────────────────────────────────────────────

const num = (r: BoxScoreRow) => (r.number ? `#${r.number} ` : '');

const deriveHighlights = (
  box: GameBoxScore,
  runs: ScoringRun[],
  flow: LeadFlow,
  clutch: ClutchStats,
  assists: TeamPair<AssistNetwork>,
  timeline: ScoreTimelinePoint[],
  rosterIndex: Map<string, { name: string; number: string }>
): GameHighlight[] => {
  const out: GameHighlight[] = [];
  const allRows: Array<BoxScoreRow & { side: TeamSide }> = [
    ...box.teamA.rows.map(r => ({ ...r, side: 'A' as TeamSide })),
    ...box.teamB.rows.map(r => ({ ...r, side: 'B' as TeamSide })),
  ].filter(r => !r.dnp);

  // Game high scorer.
  const top = [...allRows].sort((a, b) => b.pts - a.pts)[0];
  if (top && top.pts > 0) {
    out.push({
      kind: 'game_high',
      label: `GAME HIGH — ${top.pts} PTS`,
      detail: `${num(top)}${top.name} · ${top.fgm}/${top.fga} FG`,
      side: top.side,
      playerId: top.playerId,
      weight: 100,
    });
  }

  // Double/triple doubles (PTS/REB/AST/STL/BLK ≥ 10).
  for (const r of allRows) {
    const cats = [r.pts, r.reb, r.ast, r.stl, r.blk].filter(v => v >= 10).length;
    if (cats >= 3) {
      out.push({
        kind: 'triple_double',
        label: 'TRIPLE-DOUBLE',
        detail: `${num(r)}${r.name} · ${r.pts} PTS / ${r.reb} REB / ${r.ast} AST`,
        side: r.side, playerId: r.playerId, weight: 95,
      });
    } else if (cats === 2) {
      out.push({
        kind: 'double_double',
        label: 'DOUBLE-DOUBLE',
        detail: `${num(r)}${r.name} · ${r.pts} PTS / ${r.reb} REB / ${r.ast} AST`,
        side: r.side, playerId: r.playerId, weight: 80,
      });
    }
  }

  // Biggest run.
  const bigRun = [...runs].sort((a, b) => b.points - a.points)[0];
  if (bigRun && bigRun.points >= 6) {
    const teamName = bigRun.side === 'A' ? box.teamA.name : box.teamB.name;
    out.push({
      kind: 'biggest_run',
      label: `${bigRun.points}-0 RUN`,
      detail: `${teamName} · ${bigRun.startLabel} → ${bigRun.endLabel}`,
      side: bigRun.side,
      weight: 75,
    });
  }

  // Clutch star.
  if (clutch.hasClutchTime && clutch.players[0] && clutch.players[0].pts > 0) {
    const star = clutch.players[0];
    const meta = rosterIndex.get(star.playerId);
    const mins = Math.round(clutch.windowSec / 60);
    out.push({
      kind: 'clutch_star',
      label: `CLUTCH — ${star.pts} PTS in the last ${mins}:00`,
      detail: meta ? `#${meta.number} ${meta.name}` : 'Unattributed',
      side: star.side,
      playerId: star.playerId,
      weight: 85,
    });
  }

  // Best duo (meaningful volume only).
  const duo = [assists.teamA.topDuo, assists.teamB.topDuo]
    .filter((d): d is NonNullable<typeof d> => !!d)
    .sort((a, b) => b.count - a.count)[0];
  if (duo && duo.count >= 3) {
    const from = rosterIndex.get(duo.fromPlayerId);
    const to = rosterIndex.get(duo.toPlayerId);
    if (from && to) {
      out.push({
        kind: 'best_duo',
        label: `DUO — ${duo.count} ASSISTED BUCKETS`,
        detail: `${from.name} → ${to.name} · ${duo.points} PTS created`,
        weight: 60,
      });
    }
  }

  // Hot hand / perfect line (volume-gated: ≥5 FGA — Goldsberry min-sample rule).
  const volume = allRows.filter(r => r.fga >= 5);
  const hot = [...volume].sort((a, b) => b.efgPct - a.efgPct)[0];
  if (hot && hot.efgPct >= 60) {
    const perfect = hot.fgm === hot.fga;
    out.push({
      kind: perfect ? 'perfect_line' : 'hot_hand',
      label: perfect ? `PERFECT — ${hot.fgm}/${hot.fga} FG` : `HOT HAND — ${hot.efgPct.toFixed(0)} eFG%`,
      detail: `${num(hot)}${hot.name} · ${hot.pts} PTS`,
      side: hot.side, playerId: hot.playerId, weight: perfect ? 90 : 70,
    });
  }

  // Wire-to-wire: the winner never trailed (and actually led at the end).
  const last = timeline[timeline.length - 1];
  if (last && last.lead !== 0) {
    const winner: TeamSide = last.lead > 0 ? 'A' : 'B';
    const everTrailed = timeline.some(p => (winner === 'A' ? p.lead < 0 : p.lead > 0));
    if (!everTrailed && flow.leadChanges === 0) {
      out.push({
        kind: 'wire_to_wire',
        label: 'WIRE-TO-WIRE',
        detail: `${winner === 'A' ? box.teamA.name : box.teamB.name} led start to finish`,
        side: winner,
        weight: 55,
      });
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
};

// ── the engine ───────────────────────────────────────────────────────────────

/** Minimal structural view of games.data — the fields the report reads. */
interface GameDataLike {
  code?: string;
  gameCode?: string;
  createdAt?: string | number;
  settings?: {
    gameName?: string;
    gameMode?: string;
    periodDuration?: number;
    periods?: number;
    periodType?: 'quarter' | 'half';
    shotClockDuration?: number;
  };
  teamA?: unknown;
  teamB?: unknown;
}

export const buildGameReport = (
  gameData: GameDataLike,
  shots: ShotEvent[],
  actions: GameAction[]
): GameReport => {
  const settings = gameData?.settings ?? {};
  const periodDurationSec = (settings.periodDuration ?? 10) * 60;
  const periods: number = settings.periods ?? 4;
  const periodType: 'quarter' | 'half' = settings.periodType ?? 'quarter';

  const box = buildGameBoxScore(gameData, shots, actions);
  const rosterIndex = buildRosterIndex(gameData);
  const timeline = reconstructScoreTimeline(shots, { periodDurationSec, periodType });
  const runs = detectScoringRuns(timeline);
  const leads = biggestLeads(timeline);
  const flow = leadFlow(timeline, { totalGameSec: periods * periodDurationSec });
  const comparison = buildTeamComparison(box);
  const clutch = clutchStats(shots, { totalPeriods: periods });
  const assists: TeamPair<AssistNetwork> = {
    teamA: assistNetwork(shots, 'A'),
    teamB: assistNetwork(shots, 'B'),
  };

  const hasShotClock = box.capabilities.hasShotClock;
  const hasLocations = box.capabilities.hasShotLocations;

  // Per-player packages, PTS desc, active players only.
  const players: PlayerReport[] = ([
    ...box.teamA.rows.map(r => ({ r, side: 'A' as TeamSide })),
    ...box.teamB.rows.map(r => ({ r, side: 'B' as TeamSide })),
  ])
    .filter(({ r }) => !r.dnp)
    .map(({ r, side }) => ({
      playerId: r.playerId,
      name: r.name,
      number: r.number,
      side,
      row: r,
      zones: hasLocations ? aggregateZones(shots, side, r.playerId) : [],
      periods: playerPeriodScoring(shots, r.playerId, periods),
      quality: shotQuality(shots, side, r.playerId),
      attributes: attributeSplits(shots, side, r.playerId),
      gameScore: gameScore(r),
      pie: playerPIE(r, box.teamA.totals, box.teamB.totals),
    }))
    .sort((a, b) => b.row.pts - a.row.pts);

  const highlights = deriveHighlights(box, runs, flow, clutch, assists, timeline, rosterIndex);

  // A stored score of 0 alongside a non-empty event log means the JSONB
  // snapshot is stale (e.g. persist raced end_game) — trust the replayed
  // totals over it. Non-zero stored scores win (quick-mode games have no log).
  const scoreA = box.teamA.score || box.teamA.totals.pts;
  const scoreB = box.teamB.score || box.teamB.totals.pts;

  return {
    header: {
      gameCode: gameData?.code ?? gameData?.gameCode ?? null,
      name: settings.gameName ?? null,
      dateISO: gameData?.createdAt ? new Date(gameData.createdAt).toISOString() : null,
      mode: box.capabilities.mode,
      periods,
      periodDurationSec,
      periodType,
      teamA: { name: box.teamA.name, color: box.teamA.color, score: scoreA },
      teamB: { name: box.teamB.name, color: box.teamB.color, score: scoreB },
      winner: scoreA === scoreB ? 'tie' : scoreA > scoreB ? 'A' : 'B',
    },
    box,
    timeline,
    runs,
    leads,
    leadFlow: flow,
    comparison,
    special: { teamA: specialPoints(shots, 'A'), teamB: specialPoints(shots, 'B') },
    attributes: { teamA: attributeSplits(shots, 'A'), teamB: attributeSplits(shots, 'B') },
    clutch,
    assists,
    shotClockUsage: hasShotClock
      ? {
          teamA: possessionHistogram(shots, { shotClockDuration: settings.shotClockDuration ?? 24 }, 'A'),
          teamB: possessionHistogram(shots, { shotClockDuration: settings.shotClockDuration ?? 24 }, 'B'),
        }
      : null,
    quality: { teamA: shotQuality(shots, 'A'), teamB: shotQuality(shots, 'B') },
    advanced: box.capabilities.mode !== 'quick'
      ? {
          teamA: { fourFactors: fourFactors(box.teamA.totals, box.teamB.totals), ratings: teamRatings(box.teamA.totals, box.teamB.totals) },
          teamB: { fourFactors: fourFactors(box.teamB.totals, box.teamA.totals), ratings: teamRatings(box.teamB.totals, box.teamA.totals) },
        }
      : null,
    hexbins: hasLocations
      ? { teamA: buildHexbins(shots, { side: 'A' }), teamB: buildHexbins(shots, { side: 'B' }) }
      : null,
    players,
    highlights,
  };
};
