// src/components/stats/summary/TeamComparison.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Sofascore-style head-to-head comparison: centered label, value on each side,
// two bars meeting in the middle. Pure CSS (print-friendly), light + dark.
// ─────────────────────────────────────────────────────────────────────────────

import type { TeamComparisonRow, GameBoxScore } from '../types';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { cx } from '../ui/cx';

interface Props {
  box: GameBoxScore;
  rows: TeamComparisonRow[];
}

export const TeamComparison = ({ box, rows }: Props) => {
  const colorA = box.teamA.color || '#dc2626';
  const colorB = box.teamB.color || '#2563eb';

  return (
    <div>
      <SectionHeader title="Team Comparison" />
      <Card padded>
        {/* Team headers */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colorA }} />
            <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate uppercase tracking-tight">
              {box.teamA.name}
            </span>
          </div>
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate uppercase tracking-tight text-right">
              {box.teamB.name}
            </span>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colorB }} />
          </div>
        </div>

        <div className="space-y-4">
          {rows.map(row => {
            const total = row.a + row.b;
            const aShare = total > 0 ? (row.a / total) * 100 : 50;
            const bShare = total > 0 ? (row.b / total) * 100 : 50;
            const aWins = row.a > row.b;
            const bWins = row.b > row.a;

            return (
              <div key={row.category + row.label}>
                {/* Values + label */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={cx(
                    'text-sm font-black tabular-nums w-16',
                    aWins ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'
                  )}>
                    {row.isPct ? `${row.a.toFixed(1)}%` : row.a}
                    {row.aDetail && (
                      <span className="block text-[10px] font-medium text-slate-400 dark:text-zinc-500">{row.aDetail}</span>
                    )}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide text-center">
                    {row.label}
                  </span>
                  <span className={cx(
                    'text-sm font-black tabular-nums w-16 text-right',
                    bWins ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'
                  )}>
                    {row.isPct ? `${row.b.toFixed(1)}%` : row.b}
                    {row.bDetail && (
                      <span className="block text-[10px] font-medium text-slate-400 dark:text-zinc-500">{row.bDetail}</span>
                    )}
                  </span>
                </div>

                {/* Mirrored bars */}
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded-l-full overflow-hidden flex justify-end">
                    <div
                      className="h-full rounded-l-full transition-all"
                      style={{ width: `${aShare}%`, backgroundColor: colorA, opacity: aWins ? 1 : 0.45 }}
                    />
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded-r-full overflow-hidden">
                    <div
                      className="h-full rounded-r-full transition-all"
                      style={{ width: `${bShare}%`, backgroundColor: colorB, opacity: bWins ? 1 : 0.45 }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
