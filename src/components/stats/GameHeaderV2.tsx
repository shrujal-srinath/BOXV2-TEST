// src/components/stats/GameHeaderV2.tsx
// Design-system game header: scoreline, team colours, date, mode badge.

import type { GameBoxScore, GameMode } from './types';
import { Card } from './ui/Card';
import { cx } from './ui/cx';

const MODE_BADGE: Record<GameMode, { label: string; cls: string }> = {
  quick:    { label: 'Quick Game',         cls: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300' },
  stats:    { label: 'Box Score',          cls: 'bg-red-50 text-red-600 dark:bg-red-600/15 dark:text-red-400' },
  advanced: { label: 'Advanced Analytics', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
};

interface Props {
  box: GameBoxScore;
  mode: GameMode;
  gameName?: string;
  dateLabel?: string;
}

const TeamSide = ({ name, color, score, win, align }: {
  name: string; color: string; score: number; win: boolean; align: 'left' | 'right';
}) => (
  <div className={cx('flex-1 min-w-0', align === 'right' && 'text-right')}>
    <div className={cx('flex items-center gap-2 mb-1', align === 'right' && 'justify-end')}>
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 truncate uppercase tracking-tight">
        {name}
      </span>
    </div>
    <div className={cx(
      'text-4xl sm:text-5xl font-black tabular-nums',
      win ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'
    )}>
      {score}
    </div>
  </div>
);

export const GameHeaderV2 = ({ box, mode, gameName, dateLabel }: Props) => {
  const a = box.teamA, b = box.teamB;
  const aWin = a.score > b.score, bWin = b.score > a.score;
  const badge = MODE_BADGE[mode];

  return (
    <Card padded className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          {gameName && (
            <h1 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate uppercase tracking-tight">{gameName}</h1>
          )}
          {dateLabel && <p className="text-xs text-slate-400 dark:text-zinc-500">{dateLabel}</p>}
        </div>
        <span className={cx('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0', badge.cls)}>
          {badge.label}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <TeamSide name={a.name} color={a.color || '#dc2626'} score={a.score} win={aWin} align="left" />
        <div className="flex flex-col items-center px-2">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Final</span>
          <span className="text-slate-300 dark:text-zinc-600 text-lg font-black">–</span>
        </div>
        <TeamSide name={b.name} color={b.color || '#2563eb'} score={b.score} win={bWin} align="right" />
      </div>
    </Card>
  );
};
