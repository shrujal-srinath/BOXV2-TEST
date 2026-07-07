// src/services/statsEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Game Stats Engine v2 (single source of truth)
//
// Pure, framework-agnostic functions that turn a persisted game (games.data JSONB)
// + shot_events + game_actions into the view-model shapes in
// src/components/stats/types.ts. No React, no I/O — fully unit-testable.
//
// Source-of-truth policy:
//   • Shooting (PTS/FG/3PT/FT): event log (shot_events) when a player has shots;
//     otherwise fall back to the roster Player counters maintained by the console.
//   • REB/AST/STL/BLK/TOV/PF: attributed game_actions (+ shot_events.assistedBy
//     for assists), else roster counters.
//   • Running score timeline: reconstructed from shot_events chronologically — all
//     basketball scoring (incl. free throws) flows through shot_events.
// ─────────────────────────────────────────────────────────────────────────────

import type { ShotEvent, GameAction } from '../components/shotchart/types/shotTypes';
import { ZONES, classifyZone, COURT } from '../components/shotchart/courtZones';
import type { Player } from '../types';
import type {
  TeamSide,
  BoxScoreRow,
  TeamBoxScore,
  GameBoxScore,
  ScoreTimelinePoint,
  ScoringRun,
  TeamComparisonRow,
  ZoneAggregate,
  DistanceBand,
  PossessionBucket,
  PeriodScore,
  PlottedShot,
} from '../components/stats/types';
import { resolveGameMode, deriveCapabilities } from './gameMode';

// ── geometry helpers ─────────────────────────────────────────────────────────

const UNIT_M = 0.15;            // 1 court unit = 0.15 m (see courtZones.ts)
const M_TO_FT = 3.28084;

/** Straight-line distance from the basket, in feet, for a court-space point. */
export const shotDistanceFt = (x: number, y: number): number => {
  const dx = x - COURT.basketX;
  const dy = y - COURT.basketY;
  return Math.sqrt(dx * dx + dy * dy) * UNIT_M * M_TO_FT;
};

// ── clock helpers ────────────────────────────────────────────────────────────

const periodLabel = (period: number, periodType: 'quarter' | 'half' = 'quarter'): string =>
  periodType === 'half' ? `H${period}` : `Q${period}`;

const clockLabel = (period: number, clockSec: number | null, periodType: 'quarter' | 'half' = 'quarter'): string => {
  if (clockSec == null) return periodLabel(period, periodType);
  const m = Math.floor(clockSec / 60);
  const s = clockSec % 60;
  return `${periodLabel(period, periodType)} ${m}:${s.toString().padStart(2, '0')}`;
};

const pct = (made: number, att: number): number => (att > 0 ? (made / att) * 100 : 0);

// True Shooting % = PTS / (2 * (FGA + 0.44 * FTA))
const trueShooting = (pts: number, fga: number, fta: number): number =>
  fga + fta > 0 ? (pts / (2 * (fga + 0.44 * fta))) * 100 : 0;

// Effective FG% = (FGM + 0.5 * 3PM) / FGA
const effectiveFg = (fgm: number, tpm: number, fga: number): number =>
  fga > 0 ? ((fgm + 0.5 * tpm) / fga) * 100 : 0;

// ── per-player box-score line ────────────────────────────────────────────────

interface PlayerEventTotals {
  pts: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
  oreb: number; dreb: number; reb: number; ast: number; stl: number; blk: number; tov: number; pf: number;
  hasShootingEvents: boolean;
  hasAnyEvent: boolean;
}

const emptyTotals = (): PlayerEventTotals => ({
  pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
  oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
  hasShootingEvents: false, hasAnyEvent: false,
});

/** Tally event-log totals per playerId from shots + actions. */
const tallyEvents = (shots: ShotEvent[], actions: GameAction[]): Map<string, PlayerEventTotals> => {
  const map = new Map<string, PlayerEventTotals>();
  const get = (id: string) => {
    let t = map.get(id);
    if (!t) { t = emptyTotals(); map.set(id, t); }
    return t;
  };

  for (const s of shots) {
    if (!s.playerId) continue;
    const t = get(s.playerId);
    t.hasAnyEvent = true;
    t.hasShootingEvents = true;
    const isFt = s.shotType === 'free_throw';
    if (isFt) {
      t.fta += 1;
      if (s.made) { t.ftm += 1; t.pts += 1; }
    } else {
      t.fga += 1;
      if (s.made) {
        t.fgm += 1;
        t.pts += s.points;
        if (s.points === 3) t.tpm += 1;
      }
      if (s.points === 3) t.tpa += 1;
    }
    // Assist credit travels on the made shot.
    if (s.made && s.assistedBy) {
      const a = get(s.assistedBy);
      a.hasAnyEvent = true;
      a.ast += 1;
    }
    // Rebound credit on a missed shot.
    if (s.reboundedBy) {
      const r = get(s.reboundedBy);
      r.hasAnyEvent = true;
      r.reb += 1;
      if (s.reboundType === 'offensive') r.oreb += 1;
      else if (s.reboundType === 'defensive') r.dreb += 1;
    }
    if (s.blockedBy) {
      const b = get(s.blockedBy);
      b.hasAnyEvent = true;
      b.blk += 1;
    }
  }

  for (const a of actions) {
    if (!a.playerId) continue;
    const t = get(a.playerId);
    t.hasAnyEvent = true;
    switch (a.actionType) {
      case 'rebound':
        t.reb += 1;
        if (a.subtype === 'offensive') t.oreb += 1;
        else if (a.subtype === 'defensive') t.dreb += 1;
        break;
      case 'assist': t.ast += 1; break;
      case 'steal': t.stl += 1; break;
      case 'block': t.blk += 1; break;
      case 'turnover': t.tov += 1; break;
      case 'foul': t.pf += 1; break;
      default: break;
    }
  }

  return map;
};

const rowFromPlayer = (p: Player, ev: PlayerEventTotals | undefined): BoxScoreRow => {
  // Prefer event-log values when the player has events; otherwise roster counters.
  const useEvents = !!ev && ev.hasAnyEvent;
  const fgm = useEvents && ev!.hasShootingEvents ? ev!.fgm : p.fieldGoalsMade;
  const fga = useEvents && ev!.hasShootingEvents ? ev!.fga : p.fieldGoalsAttempted;
  const tpm = useEvents && ev!.hasShootingEvents ? ev!.tpm : p.threePointsMade;
  const tpa = useEvents && ev!.hasShootingEvents ? ev!.tpa : p.threePointsAttempted;
  const ftm = useEvents && ev!.hasShootingEvents ? ev!.ftm : p.freeThrowsMade;
  const fta = useEvents && ev!.hasShootingEvents ? ev!.fta : p.freeThrowsAttempted;
  const pts = useEvents && ev!.hasShootingEvents ? ev!.pts : p.points;

  const reb = useEvents && ev!.reb > 0 ? ev!.reb : p.rebounds;
  const oreb = useEvents ? ev!.oreb : 0;
  const dreb = useEvents ? ev!.dreb : 0;
  const ast = useEvents && ev!.ast > 0 ? ev!.ast : p.assists;
  const stl = useEvents && ev!.stl > 0 ? ev!.stl : p.steals;
  const blk = useEvents && ev!.blk > 0 ? ev!.blk : p.blocks;
  const tov = useEvents && ev!.tov > 0 ? ev!.tov : p.turnovers;
  const pf = useEvents && ev!.pf > 0 ? ev!.pf : p.fouls;

  const dnp = pts === 0 && fga === 0 && fta === 0 && reb === 0 && ast === 0 &&
    stl === 0 && blk === 0 && tov === 0 && pf === 0 && !(ev?.hasAnyEvent);

  return {
    playerId: p.id,
    name: p.name,
    number: p.number,
    position: p.position,
    minutes: null,
    pts,
    fgm, fga, fgPct: pct(fgm, fga),
    tpm, tpa, tpPct: pct(tpm, tpa),
    ftm, fta, ftPct: pct(ftm, fta),
    oreb, dreb, reb,
    ast, stl, blk, tov, pf,
    plusMinus: null,
    tsPct: trueShooting(pts, fga, fta),
    efgPct: effectiveFg(fgm, tpm, fga),
    disqualified: p.disqualified,
    dnp,
  };
};

const sumTotals = (rows: BoxScoreRow[]): TeamBoxScore['totals'] => {
  const acc = rows.reduce(
    (a, r) => {
      a.pts += r.pts; a.fgm += r.fgm; a.fga += r.fga; a.tpm += r.tpm; a.tpa += r.tpa;
      a.ftm += r.ftm; a.fta += r.fta; a.oreb += r.oreb; a.dreb += r.dreb; a.reb += r.reb;
      a.ast += r.ast; a.stl += r.stl; a.blk += r.blk; a.tov += r.tov; a.pf += r.pf;
      return a;
    },
    { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }
  );
  return {
    ...acc,
    fgPct: pct(acc.fgm, acc.fga),
    tpPct: pct(acc.tpm, acc.tpa),
    ftPct: pct(acc.ftm, acc.fta),
    tsPct: trueShooting(acc.pts, acc.fga, acc.fta),
    efgPct: effectiveFg(acc.fgm, acc.tpm, acc.fga),
    minutes: null,
    plusMinus: null,
  };
};

const buildTeamBox = (
  side: TeamSide,
  team: { name: string; color: string; score: number; players?: Player[] },
  events: Map<string, PlayerEventTotals>
): TeamBoxScore => {
  const players = team.players ?? [];
  const rows = players.map(p => rowFromPlayer(p, events.get(p.id)));
  return {
    side,
    name: team.name,
    color: team.color,
    score: team.score ?? rows.reduce((s, r) => s + r.pts, 0),
    rows,
    totals: sumTotals(rows),
  };
};

/** Build the full game box score from persisted game data + event log. */
export const buildGameBoxScore = (
  gameData: any,
  shots: ShotEvent[],
  actions: GameAction[]
): GameBoxScore => {
  const events = tallyEvents(shots, actions);
  const teamA = buildTeamBox('A', gameData?.teamA ?? { name: 'Team A', color: '#dc2626', score: 0, players: [] }, events);
  const teamB = buildTeamBox('B', gameData?.teamB ?? { name: 'Team B', color: '#2563eb', score: 0, players: [] }, events);
  const mode = resolveGameMode(gameData);
  const box: GameBoxScore = { teamA, teamB, capabilities: deriveCapabilities(mode, null, shots, actions) };
  // Recompute capabilities now that we have the box (column gating needs the rows).
  box.capabilities = deriveCapabilities(mode, box, shots, actions);
  return box;
};

// ── scoring-over-time timeline ───────────────────────────────────────────────

/**
 * Reconstruct cumulative score over the game from shot_events.
 * elapsedSec is period-aware so the X axis is monotonic across periods.
 */
export const reconstructScoreTimeline = (
  shots: ShotEvent[],
  opts: { periodDurationSec: number; periodType?: 'quarter' | 'half' } = { periodDurationSec: 600 }
): ScoreTimelinePoint[] => {
  const periodType = opts.periodType ?? 'quarter';
  const made = shots.filter(s => s.made);
  // Chronological: by period asc, then by clock descending (clock counts down).
  const sorted = [...made].sort((p, q) => {
    if (p.period !== q.period) return p.period - q.period;
    const pc = p.gameClockSec ?? 0;
    const qc = q.gameClockSec ?? 0;
    return qc - pc;
  });

  const points: ScoreTimelinePoint[] = [{
    elapsedSec: 0, period: 1, clockLabel: clockLabel(1, opts.periodDurationSec, periodType),
    scoreA: 0, scoreB: 0, lead: 0,
  }];

  let a = 0, b = 0;
  for (const s of sorted) {
    if (s.teamSide === 'A') a += s.points; else b += s.points;
    const clock = s.gameClockSec ?? 0;
    const elapsedSec = (s.period - 1) * opts.periodDurationSec + (opts.periodDurationSec - clock);
    points.push({
      elapsedSec,
      period: s.period,
      clockLabel: clockLabel(s.period, clock, periodType),
      scoreA: a,
      scoreB: b,
      lead: a - b,
    });
  }
  return points;
};

/** Detect scoring runs (consecutive points by one team) for the lead/run strip. */
export const detectScoringRuns = (timeline: ScoreTimelinePoint[], minRun = 6): ScoringRun[] => {
  const runs: ScoringRun[] = [];
  let side: TeamSide | null = null;
  let runPts = 0;
  let startLabel = '';
  let lastLabel = '';

  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const cur = timeline[i];
    const da = cur.scoreA - prev.scoreA;
    const db = cur.scoreB - prev.scoreB;
    const scorer: TeamSide = da > 0 ? 'A' : 'B';
    const pts = da > 0 ? da : db;

    if (scorer === side) {
      runPts += pts;
    } else {
      if (side && runPts >= minRun) runs.push({ side, points: runPts, startLabel, endLabel: lastLabel });
      side = scorer;
      runPts = pts;
      startLabel = prev.clockLabel;
    }
    lastLabel = cur.clockLabel;
  }
  if (side && runPts >= minRun) runs.push({ side, points: runPts, startLabel, endLabel: lastLabel });
  return runs;
};

/** Biggest lead for each team across the timeline. */
export const biggestLeads = (timeline: ScoreTimelinePoint[]): { a: number; b: number } => {
  let a = 0, b = 0;
  for (const p of timeline) {
    if (p.lead > a) a = p.lead;
    if (-p.lead > b) b = -p.lead;
  }
  return { a, b };
};

// ── team vs team comparison (Sofascore-style) ────────────────────────────────

export const buildTeamComparison = (box: GameBoxScore): TeamComparisonRow[] => {
  const A = box.teamA.totals;
  const B = box.teamB.totals;
  const caps = box.capabilities;
  const rows: TeamComparisonRow[] = [];

  rows.push({ label: 'Points', category: 'pts', a: A.pts, b: B.pts });
  rows.push({
    label: 'Field Goals', category: 'fg', a: A.fgPct, b: B.fgPct, isPct: true,
    aDetail: `${A.fgm}/${A.fga}`, bDetail: `${B.fgm}/${B.fga}`,
  });
  if (caps.hasThrees) rows.push({
    label: '3-Pointers', category: 'tp', a: A.tpPct, b: B.tpPct, isPct: true,
    aDetail: `${A.tpm}/${A.tpa}`, bDetail: `${B.tpm}/${B.tpa}`,
  });
  if (caps.hasFreeThrows) rows.push({
    label: 'Free Throws', category: 'ft', a: A.ftPct, b: B.ftPct, isPct: true,
    aDetail: `${A.ftm}/${A.fta}`, bDetail: `${B.ftm}/${B.fta}`,
  });
  if (caps.hasRebounds) rows.push({ label: 'Rebounds', category: 'reb', a: A.reb, b: B.reb });
  if (caps.hasAssists) rows.push({ label: 'Assists', category: 'ast', a: A.ast, b: B.ast });
  if (caps.hasSteals) rows.push({ label: 'Steals', category: 'stl', a: A.stl, b: B.stl });
  if (caps.hasBlocks) rows.push({ label: 'Blocks', category: 'blk', a: A.blk, b: B.blk });
  if (caps.hasTurnovers) rows.push({ label: 'Turnovers', category: 'tov', a: A.tov, b: B.tov });
  if (caps.hasFouls) rows.push({ label: 'Fouls', category: 'pf', a: A.pf, b: B.pf });

  return rows;
};

// ── advanced: zone aggregation + distance bands + plotted shots ───────────────

export const aggregateZones = (shots: ShotEvent[], side?: TeamSide): ZoneAggregate[] => {
  const fgs = shots.filter(s => s.shotType !== 'free_throw' && (!side || s.teamSide === side));
  const byZone = new Map<string, { fgm: number; fga: number; pts: number }>();

  for (const s of fgs) {
    const zone = s.x != null && s.y != null && s.zone !== 'unlocated' ? classifyZone(s.x, s.y) : s.zone;
    const cur = byZone.get(zone) ?? { fgm: 0, fga: 0, pts: 0 };
    cur.fga += 1;
    if (s.made) { cur.fgm += 1; cur.pts += s.points; }
    byZone.set(zone, cur);
  }

  return Array.from(byZone.entries())
    .map(([zone, v]) => {
      const def = (ZONES as any)[zone];
      return {
        zone,
        label: def?.label ?? zone,
        fgm: v.fgm,
        fga: v.fga,
        fgPct: pct(v.fgm, v.fga),
        points: v.pts,
        cx: def?.cx ?? 50,
        cy: def?.cy ?? 47,
      };
    })
    .sort((a, b) => b.fga - a.fga);
};

const DEFAULT_BANDS: Array<Omit<DistanceBand, 'fgm' | 'fga' | 'fgPct' | 'points'>> = [
  { label: '0–3 ft', minFt: 0, maxFt: 3 },
  { label: '3–10 ft', minFt: 3, maxFt: 10 },
  { label: '10–16 ft', minFt: 10, maxFt: 16 },
  { label: '16 ft–3PT', minFt: 16, maxFt: 22 },
  { label: '3-Pointers', minFt: 22, maxFt: 999 },
];

export const distanceBands = (shots: ShotEvent[], side?: TeamSide): DistanceBand[] => {
  const fgs = shots.filter(
    s => s.shotType !== 'free_throw' && s.x != null && s.y != null && (!side || s.teamSide === side)
  );
  return DEFAULT_BANDS.map(band => {
    const inBand = fgs.filter(s => {
      const d = shotDistanceFt(s.x!, s.y!);
      return d >= band.minFt && d < band.maxFt;
    });
    const fgm = inBand.filter(s => s.made).length;
    const fga = inBand.length;
    const pts = inBand.reduce((sum, s) => sum + (s.made ? s.points : 0), 0);
    return { ...band, fgm, fga, fgPct: pct(fgm, fga), points: pts };
  });
};

/**
 * Split field goals by where in the shot clock they came (early/mid/late).
 * Only includes shots that carry a shotClockSec value (migration 012+).
 */
export const possessionSplit = (
  shots: ShotEvent[],
  shotClockDuration = 24,
  side?: TeamSide
): PossessionBucket[] => {
  const fgs = shots.filter(
    s => s.shotType !== 'free_throw' && s.shotClockSec != null && (!side || s.teamSide === side)
  );
  const third = shotClockDuration / 3;
  const defs: Array<{ label: string; test: (sc: number) => boolean }> = [
    { label: 'Early', test: sc => sc > shotClockDuration - third },          // lots of clock left
    { label: 'Mid', test: sc => sc <= shotClockDuration - third && sc > third },
    { label: 'Late', test: sc => sc <= third },                              // shot-clock pressure
  ];
  return defs.map(d => {
    const inBucket = fgs.filter(s => d.test(s.shotClockSec as number));
    const fgm = inBucket.filter(s => s.made).length;
    const fga = inBucket.length;
    const points = inBucket.reduce((sum, s) => sum + (s.made ? s.points : 0), 0);
    return { label: d.label, fgm, fga, fgPct: pct(fgm, fga), points };
  });
};

/** A single player's scoring per period (from shot_events). Empty if no shots logged. */
export const playerPeriodScoring = (
  shots: ShotEvent[],
  playerId: string,
  periods = 4
): PeriodScore[] => {
  const ps = shots.filter(s => s.playerId === playerId);
  return Array.from({ length: periods }, (_, i) => {
    const period = i + 1;
    const inP = ps.filter(s => s.period === period);
    const pts = inP.reduce((a, s) => a + (s.made ? s.points : 0), 0);
    const fga = inP.filter(s => s.shotType !== 'free_throw').length;
    const fgm = inP.filter(s => s.made && s.shotType !== 'free_throw').length;
    return { period, pts, fgm, fga };
  });
};

/** Map shots to plotted dots for the exact-location shot map. */
export const plotShots = (
  shots: ShotEvent[],
  rosterById: Map<string, { name: string; number: string }>,
  periodType: 'quarter' | 'half' = 'quarter',
  side?: TeamSide
): PlottedShot[] =>
  shots
    .filter(s => s.shotType !== 'free_throw' && s.x != null && s.y != null && s.zone !== 'unlocated' && (!side || s.teamSide === side))
    .map(s => ({
      id: s.id,
      playerId: s.playerId,
      playerName: s.playerId ? rosterById.get(s.playerId)?.name : undefined,
      side: s.teamSide,
      x: s.x!,
      y: s.y!,
      made: s.made,
      points: s.points,
      period: s.period,
      clockLabel: clockLabel(s.period, s.gameClockSec, periodType),
      distanceFt: shotDistanceFt(s.x!, s.y!),
    }));

// ── convenience: roster index ────────────────────────────────────────────────

export const buildRosterIndex = (gameData: any): Map<string, { name: string; number: string }> => {
  const map = new Map<string, { name: string; number: string }>();
  for (const team of [gameData?.teamA, gameData?.teamB]) {
    for (const p of team?.players ?? []) {
      map.set(p.id, { name: p.name, number: p.number });
    }
  }
  return map;
};
