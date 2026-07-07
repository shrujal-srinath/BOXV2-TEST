// src/components/stats/share/cards/gameCard.ts
// Shareable game-result card (square / story), pure SVG.

import type { GameStatsData } from '../../useGameStats';
import { renderCard, esc, fit, FORMAT_DIMS, type CardFormat } from './shared';

export interface GameCardOpts {
  format: CardFormat;
  blocks: Set<string>; // 'comparison' | 'leaders' | 'timeline'
}

export const GAME_BLOCKS = [
  { id: 'comparison', label: 'Team comparison' },
  { id: 'leaders', label: 'Top performers' },
  { id: 'timeline', label: 'Scoring timeline' },
];

export const buildGameCard = (data: GameStatsData, opts: GameCardOpts): string => {
  const { format, blocks } = opts;
  const { w, h } = FORMAT_DIMS[format];
  const story = format === 'story';
  const pad = 72;
  if (!data.box) return '';
  const A = data.box.teamA, B = data.box.teamB;
  const colorA = A.color || '#dc2626', colorB = B.color || '#2563eb';
  const aWin = A.score > B.score, bWin = B.score > A.score;

  let body = '';
  let y = story ? 280 : 230;

  // ── Scoreline ──
  body += `
    <g transform="translate(0,${y})">
      <text x="${pad}" y="0" font-size="34" font-weight="900" letter-spacing="1" fill="${aWin ? '#ffffff' : '#94a3b8'}">${esc(fit(A.name, 16).toUpperCase())}</text>
      <text x="${w - pad}" y="0" text-anchor="end" font-size="34" font-weight="900" letter-spacing="1" fill="${bWin ? '#ffffff' : '#94a3b8'}">${esc(fit(B.name, 16).toUpperCase())}</text>
      <text x="${pad}" y="120" font-size="150" font-weight="900" fill="${aWin ? '#ffffff' : '#94a3b8'}" font-variant-numeric="tabular-nums">${A.score}</text>
      <text x="${w / 2}" y="108" text-anchor="middle" font-size="48" font-weight="900" fill="#334155">–</text>
      <text x="${w - pad}" y="120" text-anchor="end" font-size="150" font-weight="900" fill="${bWin ? '#ffffff' : '#94a3b8'}" font-variant-numeric="tabular-nums">${B.score}</text>
      <rect x="${pad}" y="92" width="48" height="8" rx="4" fill="${colorA}"/>
      <rect x="${w - pad - 48}" y="92" width="48" height="8" rx="4" fill="${colorB}"/>
    </g>`;
  y += story ? 230 : 200;

  // ── Comparison bars ──
  if (blocks.has('comparison')) {
    const rows = data.comparison.slice(0, story ? 8 : 6);
    const cx = w / 2, gap = 8, half = (w - pad * 2) / 2 - gap;
    body += rows.map(r => {
      const total = r.a + r.b;
      const aShare = total > 0 ? r.a / total : 0.5;
      const bShare = total > 0 ? r.b / total : 0.5;
      const aw = r.a > r.b, bw = r.b > r.a;
      const av = r.isPct ? `${r.a.toFixed(1)}%` : r.a;
      const bv = r.isPct ? `${r.b.toFixed(1)}%` : r.b;
      const block = `
        <text x="${pad}" y="${y}" font-size="30" font-weight="900" fill="${aw ? '#ffffff' : '#64748b'}" font-variant-numeric="tabular-nums">${esc(av)}</text>
        <text x="${cx}" y="${y}" text-anchor="middle" font-size="20" font-weight="700" letter-spacing="2" fill="#64748b">${esc(r.label.toUpperCase())}</text>
        <text x="${w - pad}" y="${y}" text-anchor="end" font-size="30" font-weight="900" fill="${bw ? '#ffffff' : '#64748b'}" font-variant-numeric="tabular-nums">${esc(bv)}</text>
        <rect x="${pad}" y="${y + 14}" width="${half}" height="10" rx="5" fill="#ffffff" fill-opacity="0.06"/>
        <rect x="${pad + half * (1 - aShare)}" y="${y + 14}" width="${half * aShare}" height="10" rx="5" fill="${colorA}" fill-opacity="${aw ? 1 : 0.5}"/>
        <rect x="${cx + gap}" y="${y + 14}" width="${half}" height="10" rx="5" fill="#ffffff" fill-opacity="0.06"/>
        <rect x="${cx + gap}" y="${y + 14}" width="${half * bShare}" height="10" rx="5" fill="${colorB}" fill-opacity="${bw ? 1 : 0.5}"/>`;
      y += story ? 96 : 84;
      return block;
    }).join('');
    y += 12;
  }

  // ── Top performers ──
  if (blocks.has('leaders')) {
    const lead = (t: typeof A) => t.rows.filter(r => !r.dnp).sort((p, q) => q.pts - p.pts)[0];
    const la = lead(A), lb = lead(B);
    const line = (x: number, anchor: 'start' | 'end', r: typeof la, color: string) => r ? `
      <text x="${x}" y="${y}" text-anchor="${anchor}" font-size="22" font-weight="700" letter-spacing="1" fill="${color}">TOP SCORER</text>
      <text x="${x}" y="${y + 38}" text-anchor="${anchor}" font-size="36" font-weight="900" fill="#ffffff">${esc(fit(r.name, 14))}</text>
      <text x="${x}" y="${y + 74}" text-anchor="${anchor}" font-size="24" font-weight="700" fill="#94a3b8">${r.pts} PTS · ${r.reb} REB · ${r.ast} AST</text>` : '';
    body += line(pad, 'start', la, colorA) + line(w - pad, 'end', lb, colorB);
    y += 110;
  }

  // ── Mini scoring timeline ──
  if (blocks.has('timeline') && data.timeline.length > 1) {
    const settings: any = data.gameData?.settings ?? {};
    const periods: number = settings.periods ?? (settings.periodType === 'half' ? 2 : 4);
    const totalSec = Math.max(1, periods * (settings.periodDuration ?? 10) * 60);
    const maxS = Math.max(A.score, B.score, 1);
    const cw = w - pad * 2, ch = 150, ox = pad, oy = y;
    const X = (s: number) => ox + Math.min(1, s / totalSec) * cw;
    const Y = (sc: number) => oy + ch - (sc / maxS) * ch;
    const path = (key: 'scoreA' | 'scoreB') => {
      const p = data.timeline;
      let d = `M ${X(p[0].elapsedSec).toFixed(1)} ${Y(p[0][key]).toFixed(1)}`;
      for (let i = 1; i < p.length; i++) {
        const x = X(p[i].elapsedSec).toFixed(1);
        d += ` L ${x} ${Y(p[i - 1][key]).toFixed(1)} L ${x} ${Y(p[i][key]).toFixed(1)}`;
      }
      return d;
    };
    body += `
      <line x1="${ox}" y1="${oy + ch}" x2="${ox + cw}" y2="${oy + ch}" stroke="#334155" stroke-width="1.5"/>
      <path d="${path('scoreA')}" fill="none" stroke="${colorA}" stroke-width="4"/>
      <path d="${path('scoreB')}" fill="none" stroke="${colorB}" stroke-width="4"/>`;
    y += ch + 20;
  }

  const dateLabel = data.gameData?.createdAt
    ? new Date(data.gameData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return renderCard(format, {
    accentA: colorA, accentB: colorB,
    label: 'Final',
    footer: `${fit(data.gameData?.settings?.gameName ?? '', 30)}${dateLabel ? ` · ${dateLabel}` : ''}`,
    body,
  });
};
