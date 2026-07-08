// src/components/stats/advanced/HexShotChart.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Hexbin Shot Chart (the advanced-stats court showpiece)
//
// Goldsberry-style hexmap over the real half-court: hex SIZE = shot volume,
// hex COLOUR = efficiency (FG%), shot-making vs expectation (VS EXP), or team
// colour intensity (VOLUME — auto-selected for makes-only games).
//
// Interaction design (every beat intentional):
//   • entrance — hexes bloom radially outward from the rim, each delayed by its
//     distance from the basket; replayed on every filter change (team / player /
//     metric / sample). Overshoot ease, disabled under prefers-reduced-motion.
//   • hover / tap — the active hex lifts with a ring; every other hex recedes.
//     A tooltip surfaces the zone name, M/A, FG%, PPA and Δ vs expected.
//   • filters — team pills in live team colours, a jersey-chip player rail,
//     metric + min-sample segmented controls. State never resets on refetch.
//
// Data: hexbinEngine.buildHexbins (pure, golden-tested). Court: StatsCourt so
// bins land in exactly the persisted coordinate space.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, useCallback } from 'react';
import type { GameBoxScore, TeamSide } from '../types';
import type { ShotEvent, ShotZoneId } from '../../shotchart/types/shotTypes';
import { buildHexbins, hexPath, type HexBin } from '../../../services/hexbinEngine';
import { classifyZone, ZONES, COURT } from '../../shotchart/courtZones';
import { StatsCourt } from './StatsCourt';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { cx } from '../ui/cx';

// ── colour scales ────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const mix = (c1: number[], c2: number[], t: number) =>
  `rgb(${lerp(c1[0], c2[0], t)},${lerp(c1[1], c2[1], t)},${lerp(c1[2], c2[2], t)})`;

/** FG% scale — same stops as ZoneHeatmap so “hot” reads identically product-wide. */
const fgPctColor = (pct: number): string => {
  const stops = [
    { p: 25, c: [239, 68, 68] },    // cold — red-500
    { p: 45, c: [245, 158, 11] },   // warm — amber-500
    { p: 62, c: [34, 197, 94] },    // hot  — green-500
  ];
  if (pct <= stops[0].p) return mix(stops[0].c, stops[0].c, 0);
  if (pct >= stops[2].p) return mix(stops[2].c, stops[2].c, 0);
  const [lo, hi] = pct < stops[1].p ? [stops[0], stops[1]] : [stops[1], stops[2]];
  return mix(lo.c, hi.c, (pct - lo.p) / (hi.p - lo.p));
};

/** Δ vs expected — diverging: ice blue (below the looks) → slate → red-600 (above). */
const deltaColor = (delta: number): string => {
  const t = Math.max(-0.5, Math.min(0.5, delta)) / 0.5;   // −1..1
  return t < 0
    ? mix([100, 116, 139], [59, 130, 246], -t)             // slate-500 → blue-500
    : mix([100, 116, 139], [220, 38, 38], t);              // slate-500 → red-600
};

type Metric = 'fgPct' | 'delta' | 'volume';

const binFill = (bin: HexBin, metric: Metric, teamColor: string): { fill: string; opacity: number } => {
  if (metric === 'volume') return { fill: teamColor, opacity: 0.25 + 0.65 * bin.sizeT };
  if (metric === 'delta') return { fill: deltaColor(bin.delta), opacity: 0.92 };
  return { fill: fgPctColor(bin.fgPct), opacity: 0.92 };
};

// ── component ────────────────────────────────────────────────────────────────

const DEPTH = 70;           // court units shown (three-point action + top of key)
const BASE_R = 3;           // bin radius in court units (matches engine default)

interface Props {
  box: GameBoxScore;
  shots: ShotEvent[];
  rosterIndex: Map<string, { name: string; number: string }>;
}

export const HexShotChart = ({ box, shots, rosterIndex }: Props) => {
  const [side, setSide] = useState<TeamSide>('A');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [minAtt, setMinAtt] = useState<1 | 2 | 4>(1);
  const hasMisses = box.capabilities.hasMisses;
  const [metricChoice, setMetricChoice] = useState<'fgPct' | 'delta'>('fgPct');
  const metric: Metric = hasMisses ? metricChoice : 'volume';
  const [active, setActive] = useState<string | null>(null);

  const team = side === 'A' ? box.teamA : box.teamB;
  const teamColor = team.color || '#dc2626';

  // Players on this side with at least one located field goal, by volume.
  const playerRail = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of shots) {
      if (s.teamSide !== side || s.shotType === 'free_throw') continue;
      if (s.x == null || s.y == null || s.zone === 'unlocated') continue;
      if (!s.playerId) continue;
      counts.set(s.playerId, (counts.get(s.playerId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({ id, ...(rosterIndex.get(id) ?? { name: 'Unknown', number: '' }) }));
  }, [shots, side, rosterIndex]);

  const result = useMemo(
    () => buildHexbins(shots, { radius: BASE_R, minAttempts: minAtt, side, playerId: playerId ?? undefined }),
    [shots, minAtt, side, playerId]
  );

  const visibleBins = useMemo(() => result.bins.filter(b => b.cy <= DEPTH - 1), [result]);
  const deepCount = result.bins.length - visibleBins.length;

  // Replay the bloom whenever the data lens changes.
  const bloomKey = `${side}|${playerId ?? 'all'}|${metric}|${minAtt}`;

  const activeBin = active ? visibleBins.find(b => `${b.cx}:${b.cy}` === active) ?? null : null;

  const zoneLabelFor = useCallback((bin: HexBin): string => {
    const z = classifyZone(bin.cx, bin.cy) as ShotZoneId;
    return ZONES[z]?.label ?? z;
  }, []);

  const changeSide = (s: TeamSide) => {
    setSide(s);
    setPlayerId(null);
    setActive(null);
  };

  const seg = (on: boolean) =>
    cx(
      'px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide transition-all duration-150 select-none',
      on
        ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
    );

  return (
    <Card padded>
      <style>{`
        @keyframes hexBloom {
          0%   { transform: scale(0.15); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        .hexbin {
          transform-box: fill-box;
          transform-origin: center;
          animation: hexBloom 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transition: opacity 0.2s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease;
          cursor: pointer;
        }
        .hexbin.is-active { transform: scale(1.14); }
        .hexbin.is-muted  { opacity: 0.38 !important; }
        @keyframes tipIn { from { opacity: 0; transform: translate(-50%, -104%) scale(0.96); }
                           to   { opacity: 1; transform: translate(-50%, -112%) scale(1); } }
        .hex-tip { animation: tipIn 0.14s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .hexbin { animation: none; transition: none; }
          .hex-tip { animation: none; transform: translate(-50%, -112%); }
        }
      `}</style>

      <SectionHeader
        title="Shot Hexmap"
        action={
          <div className="flex gap-1.5">
            {(['A', 'B'] as TeamSide[]).map(s => {
              const t = s === 'A' ? box.teamA : box.teamB;
              const on = side === s;
              return (
                <button
                  key={s}
                  onClick={() => changeSide(s)}
                  aria-pressed={on}
                  className={cx(
                    'px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150',
                    on ? 'text-white shadow-sm scale-[1.03]'
                       : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  )}
                  style={on ? { backgroundColor: t.color || '#dc2626' } : undefined}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        }
      />

      {/* Player rail — jersey chips, volume-ordered */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => { setPlayerId(null); setActive(null); }}
          aria-pressed={playerId === null}
          className={cx(
            'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-150',
            playerId === null
              ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
          )}
        >
          All
        </button>
        {playerRail.map(p => {
          const on = playerId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { setPlayerId(on ? null : p.id); setActive(null); }}
              aria-pressed={on}
              className={cx(
                'shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-150',
                on
                  ? 'text-white shadow-sm scale-[1.03]'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              )}
              style={on ? { backgroundColor: teamColor } : undefined}
            >
              <span
                className={cx(
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black tabular-nums',
                  on ? 'bg-white/25 text-white' : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200'
                )}
              >
                {p.number || '–'}
              </span>
              {p.name.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* The court */}
      <div className="relative" onPointerLeave={() => setActive(null)}>
        {visibleBins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-slate-200 dark:border-zinc-700">
            <svg viewBox="0 0 40 24" className="w-16 h-10 mb-3 opacity-30" fill="none"
              stroke="currentColor" strokeWidth="1.2">
              <rect x="1" y="1" width="38" height="22" rx="2" />
              <path d="M 8 1 A 12 12 0 0 0 32 1" />
              <circle cx="20" cy="4" r="1.6" />
            </svg>
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
              No located shots{playerId ? ' for this player' : ''} yet
            </p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
              Court-tapped attempts appear here as they’re recorded
            </p>
          </div>
        ) : (
          <StatsCourt depth={DEPTH}>
            <g key={bloomKey}>
              {visibleBins.map(bin => {
                const id = `${bin.cx}:${bin.cy}`;
                const isActive = active === id;
                const drawR = BASE_R * (0.42 + 0.58 * Math.sqrt(bin.sizeT));
                const { fill, opacity } = binFill(bin, metric, teamColor);
                const dist = Math.hypot(bin.cx - COURT.basketX, bin.cy - COURT.basketY);
                return (
                  <path
                    key={id}
                    d={hexPath(bin.cx, bin.cy, drawR)}
                    fill={fill}
                    fillOpacity={opacity}
                    stroke={isActive ? (metric === 'volume' ? teamColor : fill) : 'transparent'}
                    strokeWidth={isActive ? 0.55 : 0}
                    className={cx('hexbin', isActive && 'is-active', active && !isActive && 'is-muted')}
                    style={{ animationDelay: `${Math.round(dist * 13)}ms` }}
                    role="img"
                    aria-label={`${zoneLabelFor(bin)}: ${bin.made} of ${bin.attempts}`}
                    onPointerEnter={() => setActive(id)}
                    onClick={() => setActive(isActive ? null : id)}
                  />
                );
              })}
            </g>
          </StatsCourt>
        )}

        {/* Tooltip */}
        {activeBin && (
          <div
            className="hex-tip absolute z-10 pointer-events-none"
            style={{
              left: `${activeBin.cx}%`,
              top: `${(Math.max(activeBin.cy, 9) / DEPTH) * 100}%`,
            }}
          >
            <div className="rounded-xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-sm text-white px-3 py-2 shadow-xl min-w-[132px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                {zoneLabelFor(activeBin)}
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black tabular-nums leading-none">
                  {activeBin.made}/{activeBin.attempts}
                </span>
                {hasMisses && (
                  <span className="text-[11px] font-bold text-white/70 tabular-nums">
                    {activeBin.fgPct.toFixed(0)}%
                  </span>
                )}
              </div>
              {hasMisses && (
                <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold tabular-nums">
                  <span className="text-white/50">{activeBin.ppa.toFixed(2)} PPA</span>
                  <span
                    className={cx(
                      'px-1.5 py-0.5 rounded-full font-bold',
                      activeBin.delta >= 0 ? 'bg-red-500/25 text-red-300' : 'bg-blue-500/25 text-blue-300'
                    )}
                  >
                    {activeBin.delta >= 0 ? '▲' : '▼'} {Math.abs(activeBin.delta).toFixed(2)} vs exp
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-4">
          {/* colour legend */}
          <div className="flex items-center gap-1.5">
            {metric === 'volume' ? (
              <>
                <span className="h-2 w-16 rounded-full"
                  style={{ background: `linear-gradient(to right, ${teamColor}30, ${teamColor})` }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  fewer → more shots
                </span>
              </>
            ) : metric === 'delta' ? (
              <>
                <span className="h-2 w-16 rounded-full bg-gradient-to-r from-blue-500 via-slate-400 to-red-600" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  below exp → above exp
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-16 rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  cold → hot FG%
                </span>
              </>
            )}
          </div>
          {/* size legend */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="flex items-end gap-0.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-slate-300 dark:bg-zinc-600" />
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-zinc-600" />
              <span className="w-3.5 h-3.5 rounded-sm bg-slate-300 dark:bg-zinc-600" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              size = volume
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasMisses && (
            <div className="flex rounded-xl bg-slate-100 dark:bg-zinc-800 p-0.5" role="group" aria-label="Colour metric">
              <button className={seg(metricChoice === 'fgPct')} onClick={() => setMetricChoice('fgPct')} aria-pressed={metricChoice === 'fgPct'}>FG%</button>
              <button className={seg(metricChoice === 'delta')} onClick={() => setMetricChoice('delta')} aria-pressed={metricChoice === 'delta'}>VS EXP</button>
            </div>
          )}
          <div className="flex rounded-xl bg-slate-100 dark:bg-zinc-800 p-0.5" role="group" aria-label="Minimum attempts per hex">
            {([1, 2, 4] as const).map(n => (
              <button key={n} className={seg(minAtt === n)} onClick={() => { setMinAtt(n); setActive(null); }} aria-pressed={minAtt === n}>
                {n}+
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer facts */}
      <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-3">
        {result.totalAttempts} located attempt{result.totalAttempts === 1 ? '' : 's'}
        {playerId && playerRail.length > 0
          ? ` · ${playerRail.find(p => p.id === playerId)?.name ?? ''}`
          : ` · ${team.name}`}
        {minAtt > 1 && ` · hiding hexes under ${minAtt} attempts`}
        {deepCount > 0 && ` · ${deepCount} deep attempt${deepCount === 1 ? '' : 's'} beyond view`}
        {!hasMisses && ' · misses not tracked — showing shot volume'}
      </p>
    </Card>
  );
};
