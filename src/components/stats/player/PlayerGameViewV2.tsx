// src/components/stats/player/PlayerGameViewV2.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Individual player's game performance, rebuilt to THE BOX design system
// (light + dark). Reuses the stats engine + SVG court. Replaces the old dark
// PlayerGameView.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { useGameStats } from '../useGameStats';
import {
  plotShots, aggregateZones, distanceBands, playerPeriodScoring,
} from '../../../services/statsEngine';
import type { TeamBoxScore } from '../types';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { StatsCourt } from '../advanced/StatsCourt';
import { ShareComposer } from '../share/ShareComposer';
import { cx } from '../ui/cx';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-dvh bg-[#F0EEE9] dark:bg-zinc-950">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">{children}</div>
  </div>
);

const KeyStat = ({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) => (
  <div className="flex-1 min-w-[72px] text-center">
    <div className={cx('text-3xl font-black tabular-nums leading-none', accent ? 'text-red-600 dark:text-red-500' : 'text-slate-900 dark:text-white')}>
      {value}
    </div>
    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mt-1.5">{label}</div>
  </div>
);

const SplitLine = ({ label, made, att, pct }: { label: string; made: number; att: number; pct: number }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800 last:border-0">
    <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">{label}</span>
    <span className="text-sm tabular-nums text-slate-700 dark:text-zinc-200">
      <span className="font-bold text-slate-900 dark:text-white">{made}-{att}</span>
      <span className="ml-2 text-slate-400 dark:text-zinc-500">{att > 0 ? `${pct.toFixed(1)}%` : '—'}</span>
    </span>
  </div>
);

interface Props {
  gameCode: string;
  playerId: string;
  onBack?: () => void;
  onViewGame?: () => void;
}

export const PlayerGameViewV2 = ({ gameCode, playerId, onBack, onViewGame }: Props) => {
  const data = useGameStats(gameCode);

  const settings: any = data.gameData?.settings ?? {};
  const periodType: 'quarter' | 'half' = settings.periodType === 'half' ? 'half' : 'quarter';
  const periods: number = settings.periods ?? (periodType === 'half' ? 2 : 4);

  // ── All hooks run unconditionally (before any early return) ──
  const found = useMemo(() => {
    if (!data.box) return null;
    for (const team of [data.box.teamA, data.box.teamB] as TeamBoxScore[]) {
      const row = team.rows.find(r => r.playerId === playerId);
      if (row) return { row, team };
    }
    return null;
  }, [data.box, playerId]);

  const playerShots = useMemo(
    () => data.shots.filter(s => s.playerId === playerId),
    [data.shots, playerId]
  );
  const periodScores = useMemo(
    () => playerPeriodScoring(playerShots, playerId, periods),
    [playerShots, playerId, periods]
  );
  const plotted = useMemo(
    () => plotShots(playerShots, data.rosterIndex, periodType, undefined),
    [playerShots, data.rosterIndex, periodType]
  );
  const zones = useMemo(() => aggregateZones(playerShots), [playerShots]);
  const bands = useMemo(() => distanceBands(playerShots), [playerShots]);

  if (data.loading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-2xl bg-white/60 dark:bg-zinc-900" />
          <div className="h-64 rounded-2xl bg-white/60 dark:bg-zinc-900" />
        </div>
      </Shell>
    );
  }

  if (data.notFound || !data.box || !found) {
    return (
      <Shell>
        <Card padded className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-slate-600 dark:text-zinc-400">Player not found in this game.</p>
          {onBack && (
            <button onClick={onBack} className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">← Back</button>
          )}
        </Card>
      </Shell>
    );
  }

  const { row, team } = found;
  const caps = data.box.capabilities;
  const teamColor = team.color || '#dc2626';
  const maxPeriodPts = Math.max(1, ...periodScores.map(p => p.pts));
  const hasPeriodData = playerShots.length > 0;
  const showShotCharts = caps.hasShotLocations &&
    playerShots.some(s => s.shotType !== 'free_throw' && s.x != null && s.zone !== 'unlocated');

  return (
    <Shell>
      {/* Nav */}
      <div className="flex justify-between items-center mb-4">
        {onBack && (
          <button onClick={onBack} className="text-sm font-semibold text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">← Back</button>
        )}
        {onViewGame && (
          <button onClick={onViewGame} className="text-sm font-semibold text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">Full game stats →</button>
        )}
      </div>

      {/* Header */}
      <Card padded className="mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-black text-white" style={{ backgroundColor: teamColor }}>
            {row.number || '–'}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white truncate">{row.name}</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
              {row.position ? `${row.position} · ` : ''}{team.name}
              {row.disqualified && <span className="ml-2 text-red-500 font-bold">DQ</span>}
            </p>
          </div>
        </div>

        {/* Key stats */}
        <div className="flex flex-wrap gap-y-4 border-t border-slate-100 dark:border-zinc-800 pt-5">
          <KeyStat label="PTS" value={row.pts} accent />
          {caps.hasRebounds && <KeyStat label="REB" value={row.reb} />}
          {caps.hasAssists && <KeyStat label="AST" value={row.ast} />}
          {caps.hasSteals && <KeyStat label="STL" value={row.stl} />}
          {caps.hasBlocks && <KeyStat label="BLK" value={row.blk} />}
          <KeyStat label="FG%" value={row.fga > 0 ? `${row.fgPct.toFixed(0)}` : '—'} />
          <KeyStat label="TS%" value={row.fga + row.fta > 0 ? `${row.tsPct.toFixed(0)}` : '—'} />
        </div>
      </Card>

      {/* Shooting splits + quarter scoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <SectionHeader title="Shooting Splits" />
          <Card padded>
            <SplitLine label="Field Goals" made={row.fgm} att={row.fga} pct={row.fgPct} />
            {caps.hasThrees && <SplitLine label="3-Pointers" made={row.tpm} att={row.tpa} pct={row.tpPct} />}
            {caps.hasFreeThrows && <SplitLine label="Free Throws" made={row.ftm} att={row.fta} pct={row.ftPct} />}
            <div className="flex items-center justify-between py-2 mt-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Effective FG%</span>
              <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{row.fga > 0 ? `${row.efgPct.toFixed(1)}%` : '—'}</span>
            </div>
          </Card>
        </div>

        {hasPeriodData && (
          <div>
            <SectionHeader title="Scoring by Period" />
            <Card padded>
              <div className="space-y-3">
                {periodScores.map(p => (
                  <div key={p.period}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="font-semibold text-slate-600 dark:text-zinc-300">{periodType === 'half' ? 'H' : 'Q'}{p.period}</span>
                      <span className="tabular-nums text-slate-500 dark:text-zinc-400">
                        <span className="font-bold text-slate-900 dark:text-white">{p.pts}</span> pts · {p.fgm}/{p.fga} FG
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(p.pts / maxPeriodPts) * 100}%`, backgroundColor: teamColor }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Advanced: shot chart + zones + distance */}
      {showShotCharts && (
        <>
          <SectionHeader title="Shot Locations" />
          <Card padded className="mb-6">
            <div className="max-w-md mx-auto">
              <StatsCourt depth={64}>
                {plotted.map(s => (
                  s.made ? (
                    <circle key={s.id} cx={s.x} cy={s.y} r={1.15} fill={teamColor} stroke="#ffffff" strokeWidth={0.25}>
                      <title>{`${s.clockLabel} · ${s.distanceFt.toFixed(0)} ft · MADE`}</title>
                    </circle>
                  ) : (
                    <g key={s.id}>
                      <title>{`${s.clockLabel} · ${s.distanceFt.toFixed(0)} ft · MISS`}</title>
                      <line x1={s.x - 1} y1={s.y - 1} x2={s.x + 1} y2={s.y + 1} stroke="#ef4444" strokeWidth={0.4} />
                      <line x1={s.x - 1} y1={s.y + 1} x2={s.x + 1} y2={s.y - 1} stroke="#ef4444" strokeWidth={0.4} />
                    </g>
                  )
                ))}
              </StatsCourt>
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamColor }} /> Made</span>
              <span className="inline-flex items-center gap-1.5"><span className="text-red-500 font-black">✕</span> Missed</span>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <SectionHeader title="By Zone" />
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                      <th className="text-left px-4 py-2.5 font-bold">Zone</th>
                      <th className="text-center px-3 py-2.5 font-bold">FG</th>
                      <th className="text-center px-3 py-2.5 font-bold">FG%</th>
                      <th className="text-center px-3 py-2.5 font-bold">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.length === 0 ? (
                      <tr><td colSpan={4} className="text-center px-4 py-6 text-slate-400 dark:text-zinc-500">No located shots.</td></tr>
                    ) : zones.map(z => (
                      <tr key={z.zone} className="border-t border-slate-100 dark:border-zinc-800">
                        <td className="text-left px-4 py-2.5 font-semibold text-slate-900 dark:text-zinc-100">{z.label}</td>
                        <td className="text-center px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-300">{z.fgm}-{z.fga}</td>
                        <td className="text-center px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-300">{z.fgPct.toFixed(0)}%</td>
                        <td className="text-center px-3 py-2.5 tabular-nums font-bold text-slate-900 dark:text-white">{z.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            <div>
              <SectionHeader title="By Distance" />
              <Card padded>
                <div className="space-y-3">
                  {bands.every(b => b.fga === 0) ? (
                    <p className="text-sm text-slate-400 dark:text-zinc-500 text-center py-6">No located shots.</p>
                  ) : bands.map(b => (
                    <div key={b.label}>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="font-semibold text-slate-600 dark:text-zinc-300">{b.label}</span>
                        <span className="tabular-nums text-slate-500 dark:text-zinc-400">
                          <span className="font-bold text-slate-900 dark:text-white">{b.fgPct.toFixed(0)}%</span> · {b.fgm}/{b.fga}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, b.fgPct)}%`, backgroundColor: teamColor }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
};
