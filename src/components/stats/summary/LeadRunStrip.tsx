// src/components/stats/summary/LeadRunStrip.tsx
// Compact game-flow highlights: biggest lead per team + notable scoring runs.

import type { GameBoxScore, ScoringRun } from '../types';
import { Card } from '../ui/Card';

interface Props {
  box: GameBoxScore;
  leads: { a: number; b: number };
  runs: ScoringRun[];
}

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="flex-1 min-w-[120px] px-4 py-3">
    <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">{label}</div>
    <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5">{value}</div>
    {sub && <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{sub}</div>}
  </div>
);

export const LeadRunStrip = ({ box, leads, runs }: Props) => {
  const topRun = runs.slice().sort((a, b) => b.points - a.points)[0];
  const runTeamName = topRun ? (topRun.side === 'A' ? box.teamA.name : box.teamB.name) : '—';

  return (
    <Card className="divide-x divide-slate-100 dark:divide-zinc-800 flex flex-wrap">
      <Stat label={`${box.teamA.name} Biggest Lead`} value={leads.a > 0 ? `+${leads.a}` : '—'} />
      <Stat label={`${box.teamB.name} Biggest Lead`} value={leads.b > 0 ? `+${leads.b}` : '—'} />
      <Stat
        label="Biggest Run"
        value={topRun ? `${topRun.points}–0` : '—'}
        sub={topRun ? `${runTeamName} · ${topRun.startLabel}` : undefined}
      />
    </Card>
  );
};
