// src/components/stats/advanced/StatsCourt.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Crisp, themeable SVG half-court drawn from the COURT constants (courtZones.ts).
// viewBox is raw court space (x: 0–100, y: 0–COURT.height) so any child plotted
// at (x, y) lines up exactly with stored shot coordinates. Vector → print-perfect.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';
import { COURT } from '../../shotchart/courtZones';
import { useTheme } from '../../../contexts/ThemeContext';

interface Props {
  /** How deep (in court units) to show. Default shows the scoring half + a margin. */
  depth?: number;
  children?: ReactNode;
  /** Optional layer rendered *behind* the court lines (e.g. heatmap fill). */
  background?: ReactNode;
  className?: string;
}

export const StatsCourt = ({ depth = 64, children, background, className }: Props) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const line = dark ? '#52525b' : '#94a3b8';
  const floor = dark ? '#18181b' : '#ffffff';

  const { basketX: bx, basketY: by, paintLeft, paintRight, paintTop, ftCircleRadius, restrictedRadius, threePointRadius, threeCornerX, threeCornerMaxY, backboardY } = COURT;
  const rightCorner = 100 - threeCornerX;

  // 3-pt path: corner straights up to the tangent points, then the arc.
  const threePath =
    `M ${threeCornerX} 0 V ${threeCornerMaxY} ` +
    `A ${threePointRadius} ${threePointRadius} 0 0 0 ${rightCorner} ${threeCornerMaxY} ` +
    `V 0`;

  return (
    <svg
      viewBox={`0 0 100 ${depth}`}
      className={className}
      data-stats-court="1"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Basketball half-court shot chart"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      preserveAspectRatio="xMidYMin meet"
    >
      {/* floor */}
      <rect x={0} y={0} width={100} height={depth} fill={floor} />

      {background}

      {/* court lines */}
      <g fill="none" stroke={line} strokeWidth={0.4} strokeLinejoin="round">
        {/* boundary */}
        <rect x={0.2} y={0.2} width={99.6} height={depth - 0.4} />
        {/* paint */}
        <rect x={paintLeft} y={0} width={paintRight - paintLeft} height={paintTop} />
        {/* free-throw circle */}
        <circle cx={bx} cy={paintTop} r={ftCircleRadius} />
        {/* restricted area */}
        <path d={`M ${bx - restrictedRadius} ${by} A ${restrictedRadius} ${restrictedRadius} 0 0 0 ${bx + restrictedRadius} ${by}`} />
        {/* backboard + rim */}
        <line x1={bx - 6} y1={backboardY} x2={bx + 6} y2={backboardY} strokeWidth={0.6} />
        <circle cx={bx} cy={by} r={1.4} />
        {/* 3-point line */}
        <path d={threePath} />
      </g>

      {/* foreground plotted content (dots, labels) */}
      {children}
    </svg>
  );
};
