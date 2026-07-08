// src/components/stats/share/cards/reportCards.ts
// ─────────────────────────────────────────────────────────────────────────────
// The four gameReport-powered share cards (2026-07-08):
//   • buildHeatmapCard  — a player's hexbin heat over the court (THE share)
//   • buildMvpCard      — player-of-the-game hero with jersey watermark
//   • buildMomentumCard — full-bleed scoring timeline with run annotation
//   • buildQuartersCard — quarter-by-quarter scoring strip
// Pure SVG strings on the shared branded frame; deterministic; both formats.
// Everything derives from ONE buildGameReport() result — no local re-math.
// ─────────────────────────────────────────────────────────────────────────────

import type { GameReport } from '../../../../services/gameReport';
import { buildHexbins, hexPath } from '../../../../services/hexbinEngine';
import type { ShotEvent } from '../../../shotchart/types/shotTypes';
import { renderCard, esc, fit, FORMAT_DIMS, type CardFormat } from './shared';
import { COURT } from '../../../shotchart/courtZones';

// ── small shared bits ────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const mix = (c1: number[], c2: number[], t: number) =>
  `rgb(${lerp(c1[0], c2[0], t)},${lerp(c1[1], c2[1], t)},${lerp(c1[2], c2[2], t)})`;

/** Same FG% stops as the in-app hexmap so “hot” reads identically everywhere. */
const heatColor = (pct: number): string => {
  const S = [
    { p: 25, c: [239, 68, 68] },
    { p: 45, c: [245, 158, 11] },
    { p: 62, c: [34, 197, 94] },
  ];
  if (pct <= S[0].p) return mix(S[0].c, S[0].c, 0);
  if (pct >= S[2].p) return mix(S[2].c, S[2].c, 0);
  const [lo, hi] = pct < S[1].p ? [S[0], S[1]] : [S[1], S[2]];
  return mix(lo.c, hi.c, (pct - lo.p) / (hi.p - lo.p));
};

/** Court lines only (no dots) scaled into a box — mirrors shared.courtGroupSvg. */
const courtLines = (x: number, y: number, w: number, depth: number, line: string): string => {
  const s = w / 100;
  const { basketX: bx, basketY: by, paintLeft, paintRight, paintTop, ftCircleRadius, restrictedRadius, threePointRadius, threeCornerX, threeCornerMaxY, backboardY } = COURT;
  const rc = 100 - threeCornerX;
  const three = `M ${threeCornerX} 0 V ${threeCornerMaxY} A ${threePointRadius} ${threePointRadius} 0 0 0 ${rc} ${threeCornerMaxY} V 0`;
  return `<g transform="translate(${x},${y}) scale(${s})" fill="none" stroke="${line}" stroke-width="0.5">
    <rect x="0.3" y="0.3" width="99.4" height="${depth - 0.6}"/>
    <rect x="${paintLeft}" y="0" width="${paintRight - paintLeft}" height="${paintTop}"/>
    <circle cx="${bx}" cy="${paintTop}" r="${ftCircleRadius}"/>
    <path d="M ${bx - restrictedRadius} ${by} A ${restrictedRadius} ${restrictedRadius} 0 0 0 ${bx + restrictedRadius} ${by}"/>
    <line x1="${bx - 6}" y1="${backboardY}" x2="${bx + 6}" y2="${backboardY}" stroke-width="0.7"/>
    <circle cx="${bx}" cy="${by}" r="1.4"/>
    <path d="${three}"/>
  </g>`;
};

const statTrio = (
  cx: number, y: number, gap: number,
  items: Array<{ v: string | number; l: string; c?: string }>
): string =>
  items.map((it, i) => {
    const x = cx + (i - (items.length - 1) / 2) * gap;
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="92" font-weight="900" fill="${it.c ?? '#ffffff'}" font-variant-numeric="tabular-nums">${esc(it.v)}</text>
      <text x="${x}" y="${y + 40}" text-anchor="middle" font-size="24" font-weight="700" letter-spacing="3" fill="#64748b">${esc(it.l.toUpperCase())}</text>`;
  }).join('');

const scoreStrip = (report: GameReport, w: number, pad: number, y: number): string => {
  const { teamA: A, teamB: B, winner } = report.header;
  return `<g transform="translate(0,${y})" font-variant-numeric="tabular-nums">
    <text x="${pad}" y="0" font-size="28" font-weight="800" letter-spacing="1" fill="${winner === 'A' ? '#ffffff' : '#64748b'}">${esc(fit(A.name, 14).toUpperCase())}</text>
    <text x="${pad}" y="46" font-size="52" font-weight="900" fill="${winner === 'A' ? '#ffffff' : '#64748b'}">${A.score}</text>
    <text x="${w - pad}" y="0" text-anchor="end" font-size="28" font-weight="800" letter-spacing="1" fill="${winner === 'B' ? '#ffffff' : '#64748b'}">${esc(fit(B.name, 14).toUpperCase())}</text>
    <text x="${w - pad}" y="46" text-anchor="end" font-size="52" font-weight="900" fill="${winner === 'B' ? '#ffffff' : '#64748b'}">${B.score}</text>
  </g>`;
};

const playerOf = (report: GameReport, playerId: string) =>
  report.players.find(p => p.playerId === playerId) ?? null;

// ═════════════════════════════════════════════════════════════════════════════
// 1. PLAYER HEATMAP CARD
// ═════════════════════════════════════════════════════════════════════════════

export const buildHeatmapCard = (
  report: GameReport,
  shots: ShotEvent[],
  playerId: string,
  opts: { format: CardFormat }
): string => {
  const { w } = FORMAT_DIMS[opts.format];
  const story = opts.format === 'story';
  const pad = 72;
  const p = playerOf(report, playerId);
  if (!p) return '';
  const team = p.side === 'A' ? report.header.teamA : report.header.teamB;
  const accent = team.color || '#dc2626';
  const hasMisses = report.box.capabilities.hasMisses;

  const bins = buildHexbins(shots, { side: p.side, playerId, minAttempts: 1 }).bins;
  const depth = 64;
  const courtW = w - pad * 2;
  const s = courtW / 100;
  const courtY = story ? 560 : 470;

  const hexes = bins
    .filter(b => b.cy <= depth - 1)
    .map(b => {
      const r = 3 * (0.45 + 0.55 * Math.sqrt(b.sizeT));
      const fill = hasMisses ? heatColor(b.fgPct) : accent;
      const op = hasMisses ? 0.92 : 0.3 + 0.6 * b.sizeT;
      return `<path d="${hexPath(b.cx, b.cy, r)}" fill="${fill}" fill-opacity="${op}"/>`;
    })
    .join('');

  // Best zone line (min 2 attempts).
  const best = [...p.zones].filter(z => z.fga >= 2).sort((a, b) => b.fgPct - a.fgPct)[0];

  const body = `
    <!-- player identity -->
    <g transform="translate(${pad},${story ? 330 : 260})">
      <rect x="0" y="-56" width="84" height="84" rx="20" fill="${accent}"/>
      <text x="42" y="4" text-anchor="middle" font-size="44" font-weight="900" fill="#ffffff" font-variant-numeric="tabular-nums">${esc(p.number || '–')}</text>
      <text x="108" y="-14" font-size="58" font-weight="900" fill="#ffffff">${esc(fit(p.name, 15).toUpperCase())}</text>
      <text x="108" y="26" font-size="26" font-weight="700" letter-spacing="2" fill="#64748b">${esc(fit(team.name, 22).toUpperCase())} · ${esc(report.header.name ?? 'GAME')}</text>
    </g>

    <!-- court + heat -->
    <rect x="${pad - 16}" y="${courtY - 16}" width="${courtW + 32}" height="${depth * s + 32}" rx="28" fill="#ffffff" fill-opacity="0.03" stroke="#ffffff" stroke-opacity="0.07"/>
    ${courtLines(pad, courtY, courtW, depth, '#334155')}
    <g transform="translate(${pad},${courtY}) scale(${s})">${hexes}</g>

    <!-- stat trio -->
    ${statTrio(w / 2, courtY + depth * s + (story ? 170 : 140), story ? 300 : 280, [
      { v: p.row.pts, l: 'pts', c: accent },
      { v: `${p.row.fgm}/${p.row.fga}`, l: 'field goals' },
      { v: hasMisses ? `${p.row.efgPct.toFixed(0)}%` : `${p.quality.ppaActual.toFixed(2)}`, l: hasMisses ? 'efg%' : 'pts/shot' },
    ])}

    ${best && story ? `<text x="${w / 2}" y="${courtY + depth * s + 300}" text-anchor="middle" font-size="26" font-weight="800" letter-spacing="2" fill="#94a3b8">HOT ZONE · ${esc(best.label.toUpperCase())} — ${best.fgm}/${best.fga}</text>` : ''}
  `;

  return renderCard(opts.format, {
    accentA: accent,
    accentB: accent,
    label: 'shot heat',
    footer: `${team.name} ${report.header.teamA.score}–${report.header.teamB.score} ${p.side === 'A' ? report.header.teamB.name : report.header.teamA.name}`,
    body,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. MVP CARD
// ═════════════════════════════════════════════════════════════════════════════

export const buildMvpCard = (report: GameReport, opts: { format: CardFormat }): string => {
  const { w, h } = FORMAT_DIMS[opts.format];
  const story = opts.format === 'story';
  const pad = 72;
  const mvp = report.players[0];
  if (!mvp) return '';
  const team = mvp.side === 'A' ? report.header.teamA : report.header.teamB;
  const accent = team.color || '#dc2626';
  const won = report.header.winner === mvp.side;

  // The player's own highlight chips (top 2).
  const chips = report.highlights
    .filter(hl => hl.playerId === mvp.playerId)
    .slice(0, 2);

  const centerY = story ? h * 0.42 : h * 0.46;

  const body = `
    <!-- giant jersey watermark -->
    <text x="${w - pad + 20}" y="${centerY + (story ? 340 : 260)}" text-anchor="end"
      font-size="${story ? 620 : 460}" font-weight="900" fill="${accent}" fill-opacity="0.10"
      font-variant-numeric="tabular-nums">${esc(mvp.number || '00')}</text>

    <g transform="translate(${pad},${centerY - (story ? 190 : 150)})">
      <text x="0" y="0" font-size="30" font-weight="800" letter-spacing="6" fill="${accent}">PLAYER OF THE GAME</text>
      <text x="0" y="${story ? 92 : 78}" font-size="${story ? 84 : 68}" font-weight="900" fill="#ffffff">${esc(fit(mvp.name, 14).toUpperCase())}</text>
      <text x="0" y="${story ? 140 : 118}" font-size="28" font-weight="700" letter-spacing="2" fill="#64748b">#${esc(mvp.number || '–')} · ${esc(fit(team.name, 20).toUpperCase())} · ${won ? 'WON' : 'LOST'} ${report.header.teamA.score}–${report.header.teamB.score}</text>
    </g>

    ${statTrio(w / 2, centerY + (story ? 180 : 130), story ? 310 : 280, [
      { v: mvp.row.pts, l: 'pts', c: accent },
      { v: mvp.row.reb, l: 'reb' },
      { v: mvp.row.ast, l: 'ast' },
    ])}

    <!-- highlight ribbons -->
    ${chips.map((c, i) => {
      const cy = centerY + (story ? 320 : 240) + i * 84;
      return `<g transform="translate(${pad},${cy})">
        <rect x="0" y="-34" width="${w - pad * 2}" height="60" rx="16" fill="#ffffff" fill-opacity="0.05" stroke="${accent}" stroke-opacity="0.35"/>
        <circle cx="30" cy="-4" r="6" fill="${accent}"/>
        <text x="56" y="4" font-size="26" font-weight="900" letter-spacing="1" fill="#ffffff">${esc(c.label)}</text>
      </g>`;
    }).join('')}
  `;

  return renderCard(opts.format, {
    accentA: accent,
    accentB: report.header.winner === 'A' ? report.header.teamB.color : report.header.teamA.color,
    label: 'player of the game',
    footer: report.header.name ?? `${report.header.teamA.name} vs ${report.header.teamB.name}`,
    body,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. MOMENTUM CARD
// ═════════════════════════════════════════════════════════════════════════════

export const buildMomentumCard = (report: GameReport, opts: { format: CardFormat }): string => {
  const { w } = FORMAT_DIMS[opts.format];
  const story = opts.format === 'story';
  const pad = 72;
  const A = report.header.teamA, B = report.header.teamB;
  const colorA = A.color || '#dc2626', colorB = B.color || '#2563eb';
  const tl = report.timeline;
  if (tl.length < 2) return '';

  const plotX = pad, plotW = w - pad * 2;
  const plotY = story ? 620 : 470;
  const plotH = story ? 560 : 380;
  const totalSec = Math.max(
    report.header.periods * report.header.periodDurationSec,
    tl[tl.length - 1].elapsedSec
  );
  const maxScore = Math.max(tl[tl.length - 1].scoreA, tl[tl.length - 1].scoreB, 1);
  const px = (sec: number) => plotX + (sec / totalSec) * plotW;
  const py = (score: number) => plotY + plotH - (score / maxScore) * plotH;

  const stepPath = (key: 'scoreA' | 'scoreB'): string => {
    let d = `M ${px(0)} ${py(0)}`;
    for (let i = 1; i < tl.length; i++) {
      d += ` H ${px(tl[i].elapsedSec).toFixed(1)} V ${py(tl[i][key]).toFixed(1)}`;
    }
    d += ` H ${px(totalSec).toFixed(1)}`;
    return d;
  };

  // Quarter gridlines.
  const grid = Array.from({ length: report.header.periods - 1 }, (_, i) => {
    const x = px((i + 1) * report.header.periodDurationSec);
    return `<line x1="${x}" y1="${plotY}" x2="${x}" y2="${plotY + plotH}" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
      <text x="${x}" y="${plotY + plotH + 36}" text-anchor="middle" font-size="22" font-weight="700" fill="#475569">${report.header.periodType === 'half' ? 'H' : 'Q'}${i + 2}</text>`;
  }).join('');

  // Biggest run annotation.
  const bigRun = [...report.runs].sort((x, y) => y.points - x.points)[0];
  const runNote = bigRun
    ? `<g transform="translate(${plotX + plotW / 2},${plotY - 42})">
        <rect x="-150" y="-30" width="300" height="48" rx="24" fill="${bigRun.side === 'A' ? colorA : colorB}"/>
        <text x="0" y="2" text-anchor="middle" font-size="26" font-weight="900" letter-spacing="1" fill="#ffffff">${bigRun.points}–0 RUN · ${esc(bigRun.startLabel)}</text>
      </g>`
    : '';

  const facts = [
    { v: report.leadFlow.leadChanges, l: 'lead changes' },
    { v: report.leadFlow.timesTied, l: 'times tied' },
    { v: `+${Math.max(report.leads.a, report.leads.b)}`, l: 'biggest lead' },
  ];

  const body = `
    ${scoreStrip(report, w, pad, story ? 330 : 260)}

    ${runNote}
    <g>
      ${grid}
      <path d="${stepPath('scoreA')}" fill="none" stroke="${colorA}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${stepPath('scoreB')}" fill="none" stroke="${colorB}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.9"/>
      <line x1="${plotX}" y1="${plotY + plotH}" x2="${plotX + plotW}" y2="${plotY + plotH}" stroke="#334155" stroke-width="2"/>
    </g>

    ${facts.map((f, i) => {
      const x = w / 2 + (i - 1) * (story ? 300 : 280);
      const y = plotY + plotH + (story ? 170 : 130);
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="72" font-weight="900" fill="#ffffff" font-variant-numeric="tabular-nums">${esc(f.v)}</text>
        <text x="${x}" y="${y + 36}" text-anchor="middle" font-size="22" font-weight="700" letter-spacing="3" fill="#64748b">${esc(f.l.toUpperCase())}</text>`;
    }).join('')}
  `;

  return renderCard(opts.format, {
    accentA: colorA,
    accentB: colorB,
    label: 'game flow',
    footer: report.header.name ?? `${A.name} vs ${B.name}`,
    body,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// 4. QUARTERS CARD
// ═════════════════════════════════════════════════════════════════════════════

export const buildQuartersCard = (
  report: GameReport,
  shots: ShotEvent[],
  opts: { format: CardFormat }
): string => {
  const { w } = FORMAT_DIMS[opts.format];
  const story = opts.format === 'story';
  const pad = 72;
  const A = report.header.teamA, B = report.header.teamB;
  const colorA = A.color || '#dc2626', colorB = B.color || '#2563eb';
  const periods = report.header.periods;

  // Per-team points per period from made shots.
  const pts = (side: 'A' | 'B', period: number) =>
    shots.filter(s => s.teamSide === side && s.made && s.period === period)
      .reduce((n, s) => n + (s.shotType === 'free_throw' ? 1 : s.points), 0);
  const rows = Array.from({ length: periods }, (_, i) => ({
    period: i + 1,
    a: pts('A', i + 1),
    b: pts('B', i + 1),
  }));
  const maxPts = Math.max(1, ...rows.flatMap(r => [r.a, r.b]));

  const chartY = story ? 620 : 480;
  const chartH = story ? 620 : 400;
  const groupW = (w - pad * 2) / periods;
  const barW = Math.min(84, groupW * 0.28);

  const bars = rows.map((r, i) => {
    const gx = pad + i * groupW + groupW / 2;
    const ah = Math.max(8, (r.a / maxPts) * chartH);
    const bh = Math.max(8, (r.b / maxPts) * chartH);
    const winA = r.a > r.b, winB = r.b > r.a;
    return `
      <rect x="${gx - barW - 6}" y="${chartY + chartH - ah}" width="${barW}" height="${ah}" rx="14" fill="${colorA}" fill-opacity="${winA ? 1 : 0.45}"/>
      <rect x="${gx + 6}" y="${chartY + chartH - bh}" width="${barW}" height="${bh}" rx="14" fill="${colorB}" fill-opacity="${winB ? 1 : 0.45}"/>
      <text x="${gx - barW / 2 - 6}" y="${chartY + chartH - ah - 14}" text-anchor="middle" font-size="34" font-weight="900" fill="${winA ? '#ffffff' : '#64748b'}" font-variant-numeric="tabular-nums">${r.a}</text>
      <text x="${gx + barW / 2 + 6}" y="${chartY + chartH - bh - 14}" text-anchor="middle" font-size="34" font-weight="900" fill="${winB ? '#ffffff' : '#64748b'}" font-variant-numeric="tabular-nums">${r.b}</text>
      <text x="${gx}" y="${chartY + chartH + 44}" text-anchor="middle" font-size="26" font-weight="800" letter-spacing="2" fill="#475569">${report.header.periodType === 'half' ? 'H' : 'Q'}${r.period}</text>`;
  }).join('');

  const body = `
    ${scoreStrip(report, w, pad, story ? 330 : 260)}
    <line x1="${pad}" y1="${chartY + chartH}" x2="${w - pad}" y2="${chartY + chartH}" stroke="#334155" stroke-width="2"/>
    ${bars}
    <g transform="translate(${pad},${chartY + chartH + (story ? 130 : 100)})">
      <rect x="0" y="-14" width="20" height="20" rx="6" fill="${colorA}"/>
      <text x="32" y="2" font-size="24" font-weight="700" fill="#94a3b8">${esc(fit(A.name, 16))}</text>
      <rect x="${(w - pad * 2) / 2}" y="-14" width="20" height="20" rx="6" fill="${colorB}"/>
      <text x="${(w - pad * 2) / 2 + 32}" y="2" font-size="24" font-weight="700" fill="#94a3b8">${esc(fit(B.name, 16))}</text>
    </g>
  `;

  return renderCard(opts.format, {
    accentA: colorA,
    accentB: colorB,
    label: 'quarter by quarter',
    footer: report.header.name ?? `${A.name} vs ${B.name}`,
    body,
  });
};
