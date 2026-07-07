// src/components/stats/advanced/PossessionPanel.tsx
// Shooting efficiency by shot-clock window (early / mid / late possession).
// Only rendered when the game carries shot-clock data (migration 012+).

import { useMemo, useState } from 'react';
import type { ShotEvent } from '../../shotchart/types/shotTypes';
import type { GameBoxScore, TeamSide } from '../types';
import { possessionSplit } from '../../../services/statsEngine';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { cx } from '../ui/cx';

export const PossessionPanel = ({
  box, shots, shotClockDuration = 24,
}: { box: GameBoxScore; shots: ShotEvent[]; shotClockDuration?: number }) => {
  const [side, setSide] = useState<TeamSide>('A');
  const buckets = useMemo(() => possessionSplit(shots, shotClockDuration, side), [shots, shotClockDuration, side]);
  const accent = (side === 'A' ? box.teamA.color : box.teamB.color) || '#dc2626';

  return (
    <div>
      <SectionHeader
        title="Possession (Shot Clock)"
        action={
          <div className="flex gap-1.5">
            {(['A', 'B'] as TeamSide[]).map(s => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cx(
                  'px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                  side === s ? 'bg-red-600 text-white'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                )}
              >
                {s === 'A' ? box.teamA.name : box.teamB.name}
              </button>
            ))}
          </div>
        }
      />
      <Card padded>
        {buckets.every(b => b.fga === 0) ? (
          <p className="text-sm text-slate-400 dark:text-zinc-500 text-center py-6">No shot-clock data for this team.</p>
        ) : (
          <div className="space-y-3">
            {buckets.map(b => (
              <div key={b.label}>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="font-semibold text-slate-600 dark:text-zinc-300">{b.label} clock</span>
                  <span className="tabular-nums text-slate-500 dark:text-zinc-400">
                    <span className="font-bold text-slate-900 dark:text-zinc-100">{b.fgPct.toFixed(0)}%</span> · {b.fgm}/{b.fga}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, b.fgPct)}%`, backgroundColor: accent }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
