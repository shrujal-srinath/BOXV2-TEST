// src/components/stats/share/cards/shared.ts
// ─────────────────────────────────────────────────────────────────────────────
// Toolkit for the pure-SVG shareable cards: format dims, text helpers, the
// branded card frame (background + wordmark + footer), and an SVG-string mini
// half-court so cards can embed shot charts. All output is a self-contained SVG
// string that both previews inline and rasterizes to PNG via shareImage.svgToPng.
// ─────────────────────────────────────────────────────────────────────────────

import { COURT } from '../../../shotchart/courtZones';

export type CardFormat = 'square' | 'story';
export const FORMAT_DIMS: Record<CardFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

export const FONT = "Inter, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** Truncate to a max char length with an ellipsis. */
export const fit = (s: unknown, max: number) => {
  const t = String(s ?? '');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export interface CardDot { x: number; y: number; made: boolean; points: 1 | 2 | 3 }

/**
 * SVG-string half-court scaled into a box at (x,y) with width w. Returns the
 * `<g>` markup and its rendered height so callers can lay out content below it.
 */
export const courtGroupSvg = (
  dots: CardDot[],
  opts: { x: number; y: number; w: number; depth?: number; line: string; made: string }
): { svg: string; height: number } => {
  const depth = opts.depth ?? 60;
  const s = opts.w / 100;
  const { basketX: bx, basketY: by, paintLeft, paintRight, paintTop, ftCircleRadius, restrictedRadius, threePointRadius, threeCornerX, threeCornerMaxY, backboardY } = COURT;
  const rc = 100 - threeCornerX;
  const three = `M ${threeCornerX} 0 V ${threeCornerMaxY} A ${threePointRadius} ${threePointRadius} 0 0 0 ${rc} ${threeCornerMaxY} V 0`;

  const lines =
    `<rect x="0.3" y="0.3" width="99.4" height="${depth - 0.6}" fill="none" stroke="${opts.line}" stroke-width="0.5"/>` +
    `<rect x="${paintLeft}" y="0" width="${paintRight - paintLeft}" height="${paintTop}" fill="none" stroke="${opts.line}" stroke-width="0.5"/>` +
    `<circle cx="${bx}" cy="${paintTop}" r="${ftCircleRadius}" fill="none" stroke="${opts.line}" stroke-width="0.5"/>` +
    `<path d="M ${bx - restrictedRadius} ${by} A ${restrictedRadius} ${restrictedRadius} 0 0 0 ${bx + restrictedRadius} ${by}" fill="none" stroke="${opts.line}" stroke-width="0.5"/>` +
    `<line x1="${bx - 6}" y1="${backboardY}" x2="${bx + 6}" y2="${backboardY}" stroke="${opts.line}" stroke-width="0.7"/>` +
    `<circle cx="${bx}" cy="${by}" r="1.4" fill="none" stroke="${opts.line}" stroke-width="0.5"/>` +
    `<path d="${three}" fill="none" stroke="${opts.line}" stroke-width="0.5"/>`;

  const marks = dots.map(d =>
    d.made
      ? `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="1.25" fill="${opts.made}" stroke="#ffffff" stroke-width="0.25"/>`
      : `<g stroke="#ef4444" stroke-width="0.45"><line x1="${(d.x - 1.1).toFixed(1)}" y1="${(d.y - 1.1).toFixed(1)}" x2="${(d.x + 1.1).toFixed(1)}" y2="${(d.y + 1.1).toFixed(1)}"/><line x1="${(d.x - 1.1).toFixed(1)}" y1="${(d.y + 1.1).toFixed(1)}" x2="${(d.x + 1.1).toFixed(1)}" y2="${(d.y - 1.1).toFixed(1)}"/></g>`
  ).join('');

  return {
    svg: `<g transform="translate(${opts.x},${opts.y}) scale(${s})">${lines}${marks}</g>`,
    height: depth * s,
  };
};

/**
 * Wrap card body markup in the branded frame (dark gradient bg + team-colour
 * glow + THE BOX wordmark + footer). `body` is SVG markup in absolute coords.
 */
export const renderCard = (
  format: CardFormat,
  opts: { accentA: string; accentB: string; label: string; footer: string; body: string }
): string => {
  const { w, h } = FORMAT_DIMS[format];
  const pad = 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0c111b"/><stop offset="1" stop-color="#05070c"/>
      </linearGradient>
      <radialGradient id="glowA" cx="0.12" cy="0.05" r="0.55">
        <stop offset="0" stop-color="${opts.accentA}" stop-opacity="0.28"/><stop offset="1" stop-color="${opts.accentA}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glowB" cx="0.9" cy="0.95" r="0.55">
        <stop offset="0" stop-color="${opts.accentB}" stop-opacity="0.22"/><stop offset="1" stop-color="${opts.accentB}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#glowA)"/>
    <rect width="${w}" height="${h}" fill="url(#glowB)"/>

    <!-- wordmark -->
    <g transform="translate(${pad},${pad})">
      <rect x="0" y="-30" width="8" height="40" rx="2" fill="#dc2626"/>
      <text x="22" y="2" font-size="30" font-weight="900" letter-spacing="6" fill="#ffffff">THE BOX</text>
      <text x="22" y="34" font-size="20" font-weight="700" letter-spacing="3" fill="#64748b">${esc(opts.label.toUpperCase())}</text>
    </g>

    ${opts.body}

    <!-- footer -->
    <text x="${pad}" y="${h - pad + 8}" font-size="22" font-weight="600" fill="#475569">${esc(opts.footer)}</text>
    <text x="${w - pad}" y="${h - pad + 8}" text-anchor="end" font-size="22" font-weight="800" letter-spacing="2" fill="#dc2626">THEBOX.APP</text>
  </svg>`;
};

/** A big stat block: huge number + label. Returns markup centered at (cx, y). */
export const bigStat = (cx: number, y: number, value: string | number, label: string, color = '#ffffff') =>
  `<text x="${cx}" y="${y}" text-anchor="middle" font-size="116" font-weight="900" fill="${color}" font-variant-numeric="tabular-nums">${esc(value)}</text>
   <text x="${cx}" y="${y + 44}" text-anchor="middle" font-size="26" font-weight="700" letter-spacing="3" fill="#64748b">${esc(label.toUpperCase())}</text>`;
