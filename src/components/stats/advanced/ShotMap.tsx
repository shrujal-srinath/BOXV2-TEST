// src/components/stats/advanced/ShotMap.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Exact make/miss shot locations on the SVG half-court, with filters
// (team, player, period, shot value, made/missed). Read-only on shot_events.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import type { ShotEvent } from '../../shotchart/types/shotTypes';
import type { GameBoxScore, TeamSide } from '../types';
import { plotShots } from '../../../services/statsEngine';
import { StatsCourt } from './StatsCourt';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { cx } from '../ui/cx';

interface Props {
  box: GameBoxScore;
  shots: ShotEvent[];
  rosterIndex: Map<string, { name: string; number: string }>;
  periodType?: 'quarter' | 'half';
  periods?: number;
}

type MadeFilter = 'all' | 'made' | 'missed';
type ValueFilter = 'all' | '2' | '3';

const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={cx(
      'px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
      active
        ? 'bg-red-600 text-white'
        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
    )}
  >
    {children}
  </button>
);

export const ShotMap = ({ box, shots, rosterIndex, periodType = 'quarter', periods = 4 }: Props) => {
  const [side, setSide] = useState<TeamSide>('A');
  const [playerId, setPlayerId] = useState<string>('all');
  const [period, setPeriod] = useState<number | 'all'>('all');
  const [madeFilter, setMadeFilter] = useState<MadeFilter>('all');
  const [valueFilter, setValueFilter] = useState<ValueFilter>('all');

  const team = side === 'A' ? box.teamA : box.teamB;
  const teamColor = team.color || (side === 'A' ? '#dc2626' : '#2563eb');

  const plotted = useMemo(
    () => plotShots(shots, rosterIndex, periodType, side),
    [shots, rosterIndex, periodType, side]
  );

  const filtered = useMemo(
    () => plotted.filter(s =>
      (playerId === 'all' || s.playerId === playerId) &&
      (period === 'all' || s.period === period) &&
      (madeFilter === 'all' || (madeFilter === 'made' ? s.made : !s.made)) &&
      (valueFilter === 'all' || s.points === Number(valueFilter))
    ),
    [plotted, playerId, period, madeFilter, valueFilter]
  );

  const made = filtered.filter(s => s.made).length;
  const total = filtered.length;
  const pct = total > 0 ? ((made / total) * 100).toFixed(1) : '—';

  const players = team.rows.filter(r => !r.dnp);

  return (
    <div>
      <SectionHeader title="Shot Locations" />
      <Card padded>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-1.5">
            <Pill active={side === 'A'} onClick={() => { setSide('A'); setPlayerId('all'); }}>{box.teamA.name}</Pill>
            <Pill active={side === 'B'} onClick={() => { setSide('B'); setPlayerId('all'); }}>{box.teamB.name}</Pill>
          </div>
          <span className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1" />
          <select
            value={playerId}
            onChange={e => setPlayerId(e.target.value)}
            aria-label="Filter shots by player"
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 outline-none"
          >
            <option value="all">All players</option>
            {players.map(p => (
              <option key={p.playerId} value={p.playerId}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            aria-label="Filter shots by period"
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 outline-none"
          >
            <option value="all">All periods</option>
            {Array.from({ length: periods }, (_, i) => i + 1).map(p => (
              <option key={p} value={p}>{periodType === 'half' ? 'H' : 'Q'}{p}</option>
            ))}
          </select>
          <span className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1" />
          <div className="flex gap-1.5">
            <Pill active={madeFilter === 'all'} onClick={() => setMadeFilter('all')}>All</Pill>
            <Pill active={madeFilter === 'made'} onClick={() => setMadeFilter('made')}>Made</Pill>
            <Pill active={madeFilter === 'missed'} onClick={() => setMadeFilter('missed')}>Missed</Pill>
          </div>
          <div className="flex gap-1.5">
            <Pill active={valueFilter === 'all'} onClick={() => setValueFilter('all')}>All</Pill>
            <Pill active={valueFilter === '2'} onClick={() => setValueFilter('2')}>2PT</Pill>
            <Pill active={valueFilter === '3'} onClick={() => setValueFilter('3')}>3PT</Pill>
          </div>
        </div>

        {/* Court + dots */}
        <div className="max-w-md mx-auto">
          <StatsCourt depth={64}>
            {filtered.map(s => (
              s.made ? (
                <circle
                  key={s.id}
                  cx={s.x}
                  cy={s.y}
                  r={1.15}
                  fill={teamColor}
                  stroke="#ffffff"
                  strokeWidth={0.25}
                >
                  <title>{`${s.playerName ?? 'Team'} · ${s.clockLabel} · ${s.distanceFt.toFixed(0)} ft · MADE`}</title>
                </circle>
              ) : (
                <g key={s.id}>
                  <title>{`${s.playerName ?? 'Team'} · ${s.clockLabel} · ${s.distanceFt.toFixed(0)} ft · MISS`}</title>
                  <line x1={s.x - 1} y1={s.y - 1} x2={s.x + 1} y2={s.y + 1} stroke="#ef4444" strokeWidth={0.4} />
                  <line x1={s.x - 1} y1={s.y + 1} x2={s.x + 1} y2={s.y - 1} stroke="#ef4444" strokeWidth={0.4} />
                </g>
              )
            ))}
          </StatsCourt>
        </div>

        {/* Summary + legend */}
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            {made}/{total} <span className="text-slate-400 dark:text-zinc-500 font-medium">FG</span>
            <span className="ml-2 text-red-600 dark:text-red-400">{pct}%</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamColor }} /> Made
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-red-500 font-black">✕</span> Missed
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
