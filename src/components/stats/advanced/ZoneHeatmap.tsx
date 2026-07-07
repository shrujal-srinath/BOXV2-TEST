// src/components/stats/advanced/ZoneHeatmap.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Zone shooting heatmap (ref: zone-% grid). The court is sampled on a grid and
// each cell coloured by its zone's FG% — consistent with classifyZone boundaries,
// rendered as vector SVG (print-perfect). Falls back to shot-VOLUME shading when
// the game has essentially no misses (e.g. Pi-captured, makes-only).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import type { ShotEvent } from '../../shotchart/types/shotTypes';
import type { GameBoxScore, TeamSide } from '../types';
import { aggregateZones } from '../../../services/statsEngine';
import { classifyZone } from '../../shotchart/courtZones';
import { StatsCourt } from './StatsCourt';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { cx } from '../ui/cx';

interface Props {
  box: GameBoxScore;
  shots: ShotEvent[];
}

const DEPTH = 64;
const STEP = 2; // grid cell size in court units

// FG% → red(cold) / amber / green(hot), classic efficiency scale.
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const colorForPct = (pct: number): string => {
  const stops = [
    { p: 25, c: [239, 68, 68] },
    { p: 45, c: [245, 158, 11] },
    { p: 62, c: [34, 197, 94] },
  ];
  if (pct <= stops[0].p) return `rgb(${stops[0].c.join(',')})`;
  if (pct >= stops[2].p) return `rgb(${stops[2].c.join(',')})`;
  const [lo, hi] = pct < stops[1].p ? [stops[0], stops[1]] : [stops[1], stops[2]];
  const t = (pct - lo.p) / (hi.p - lo.p);
  return `rgb(${lerp(lo.c[0], hi.c[0], t)},${lerp(lo.c[1], hi.c[1], t)},${lerp(lo.c[2], hi.c[2], t)})`;
};

export const ZoneHeatmap = ({ box, shots }: Props) => {
  const [side, setSide] = useState<TeamSide>('A');
  const volumeMode = !box.capabilities.hasMisses;

  const zones = useMemo(() => aggregateZones(shots, side), [shots, side]);
  const zoneMap = useMemo(() => new Map(zones.map(z => [z.zone, z])), [zones]);
  const maxAtt = useMemo(() => Math.max(1, ...zones.map(z => z.fga)), [zones]);
  const teamColor = (side === 'A' ? box.teamA.color : box.teamB.color) || '#dc2626';

  // Sample the court into coloured cells by zone.
  const cells = useMemo(() => {
    const out: Array<{ x: number; y: number; fill: string; opacity: number }> = [];
    for (let x = 0; x < 100; x += STEP) {
      for (let y = 0; y < DEPTH; y += STEP) {
        const z = classifyZone(x + STEP / 2, y + STEP / 2);
        const agg = zoneMap.get(z);
        if (!agg || agg.fga === 0) continue;
        if (volumeMode) {
          out.push({ x, y, fill: teamColor, opacity: 0.15 + 0.75 * (agg.fga / maxAtt) });
        } else {
          out.push({ x, y, fill: colorForPct(agg.fgPct), opacity: 0.78 });
        }
      }
    }
    return out;
  }, [zoneMap, volumeMode, teamColor, maxAtt]);

  // Labels at zone centroids.
  const labels = zones.filter(z => z.fga > 0 && z.cy <= DEPTH - 3);

  return (
    <div>
      <SectionHeader
        title={volumeMode ? 'Shot Zones (volume)' : 'Zone Shooting %'}
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
        {volumeMode && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-3 font-medium">
            No missed shots were logged for this game — showing shot volume (where points came from) instead of FG%.
          </p>
        )}
        <div className="max-w-md mx-auto">
          <StatsCourt
            depth={DEPTH}
            background={
              <g>
                {cells.map((c, i) => (
                  <rect key={i} x={c.x} y={c.y} width={STEP} height={STEP} fill={c.fill} opacity={c.opacity} />
                ))}
              </g>
            }
          >
            {labels.map(z => (
              <g key={z.zone}>
                <text
                  x={z.cx} y={z.cy - 0.3}
                  textAnchor="middle"
                  fontSize={3}
                  fontWeight={800}
                  fill="#ffffff"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={0.15}
                  paintOrder="stroke"
                >
                  {volumeMode ? z.fgm : `${z.fgPct.toFixed(0)}%`}
                </text>
                <text
                  x={z.cx} y={z.cy + 2.6}
                  textAnchor="middle"
                  fontSize={2.2}
                  fontWeight={600}
                  fill="#ffffff"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={0.12}
                  paintOrder="stroke"
                >
                  {z.fgm}/{z.fga}
                </text>
              </g>
            ))}
          </StatsCourt>
        </div>

        {/* Legend */}
        {!volumeMode && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Cold</span>
            <span className="h-2 w-40 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(239,68,68), rgb(245,158,11), rgb(34,197,94))' }} />
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Hot</span>
          </div>
        )}
      </Card>
    </div>
  );
};
