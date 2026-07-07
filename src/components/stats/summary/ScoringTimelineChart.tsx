// src/components/stats/summary/ScoringTimelineChart.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Cumulative score over the game for both teams (ref: scoring-over-time).
// Recharts line chart, theme-aware axes, period gridlines, team colours.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { ScoreTimelinePoint, GameBoxScore } from '../types';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { useTheme } from '../../../contexts/ThemeContext';

interface Props {
  box: GameBoxScore;
  timeline: ScoreTimelinePoint[];
  periodDurationSec: number;
  periodType?: 'quarter' | 'half';
  periods?: number;
}

export const ScoringTimelineChart = ({
  box, timeline, periodDurationSec, periodType = 'quarter', periods = 4,
}: Props) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const grid = dark ? '#27272a' : '#e2e8f0';
  const axis = dark ? '#a1a1aa' : '#64748b';
  const colorA = box.teamA.color || '#dc2626';
  const colorB = box.teamB.color || '#2563eb';

  // Period boundary lines on the X axis.
  const periodMarks = useMemo(
    () => Array.from({ length: Math.max(0, periods - 1) }, (_, i) => (i + 1) * periodDurationSec),
    [periods, periodDurationSec]
  );

  const fmtX = (s: number) => {
    const p = Math.floor(s / periodDurationSec) + 1;
    return `${periodType === 'half' ? 'H' : 'Q'}${Math.min(p, periods)}`;
  };

  if (timeline.length <= 1) {
    return (
      <div>
        <SectionHeader title="Scoring Timeline" />
        <Card padded>
          <div className="h-48 flex items-center justify-center text-sm text-slate-400 dark:text-zinc-500">
            Not enough scoring data to chart a timeline.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Scoring Timeline" />
      <Card padded>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={timeline} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis
              dataKey="elapsedSec"
              type="number"
              domain={[0, periods * periodDurationSec]}
              ticks={Array.from({ length: periods + 1 }, (_, i) => i * periodDurationSec)}
              tickFormatter={fmtX}
              tick={{ fill: axis, fontSize: 11 }}
              stroke={grid}
            />
            <YAxis tick={{ fill: axis, fontSize: 11 }} stroke={grid} allowDecimals={false} width={36} />
            <Tooltip
              contentStyle={{
                backgroundColor: dark ? '#18181b' : '#ffffff',
                border: `1px solid ${grid}`,
                borderRadius: 12,
                fontSize: 12,
              }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.clockLabel ?? ''}
              formatter={(value: any, name: string) => [value, name === 'scoreA' ? box.teamA.name : box.teamB.name]}
            />
            {periodMarks.map(m => (
              <ReferenceLine key={m} x={m} stroke={grid} strokeDasharray="2 4" />
            ))}
            <Line type="stepAfter" dataKey="scoreA" stroke={colorA} strokeWidth={2.5} dot={false} name="scoreA" isAnimationActive />
            <Line type="stepAfter" dataKey="scoreB" stroke={colorB} strokeWidth={2.5} dot={false} name="scoreB" isAnimationActive />
          </LineChart>
        </ResponsiveContainer>

        <div className="flex items-center justify-center gap-6 mt-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: colorA }} /> {box.teamA.name}
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: colorB }} /> {box.teamB.name}
          </span>
        </div>
      </Card>
    </div>
  );
};
