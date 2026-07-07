// src/components/stats/export/printGraphics.ts
// ─────────────────────────────────────────────────────────────────────────────
// Self-contained vector graphics for the printable stat sheet: mirrored
// team-comparison bars + an inline SVG scoring-timeline chart. Pure strings —
// no DOM dependency, vector (print-perfect), independent of the active tab.
// ─────────────────────────────────────────────────────────────────────────────

import type { GameStatsData } from '../useGameStats';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** CSS injected into the print document for these graphics. */
export const printGraphicsCss = `
  .cmp2 { margin: 4px 0 6px; }
  .cmprow { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
  .cmprow .cval { width: 30%; font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; color: #94a3b8; }
  .cmprow .cval.win { color: #0f172a; }
  .cmprow .cval.r { text-align: right; }
  .cmprow .cval .det { font-size: 9px; font-weight: 500; color: #94a3b8; }
  .cmprow .clbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; text-align: center; }
  .cbars { display: flex; gap: 3px; margin-bottom: 9px; }
  .cbars .l, .cbars .r { flex: 1; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; display: flex; }
  .cbars .l { justify-content: flex-end; }
  .cbars .l span, .cbars .r span { height: 100%; display: block; border-radius: 3px; }
  .tlwrap { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; }
  .tllegend { display: flex; gap: 16px; justify-content: center; margin-top: 4px; font-size: 9px; color: #475569; font-weight: 600; }
  .tllegend i { display: inline-block; width: 12px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 5px; }
`;

export const comparisonBarsHTML = (data: GameStatsData): string => {
  if (!data.box) return '';
  const colorA = data.box.teamA.color || '#dc2626';
  const colorB = data.box.teamB.color || '#2563eb';
  const rows = data.comparison.map(r => {
    const total = r.a + r.b;
    const aShare = total > 0 ? (r.a / total) * 100 : 50;
    const bShare = total > 0 ? (r.b / total) * 100 : 50;
    const aWins = r.a > r.b, bWins = r.b > r.a;
    const av = r.isPct ? `${r.a.toFixed(1)}%` : r.a;
    const bv = r.isPct ? `${r.b.toFixed(1)}%` : r.b;
    return `
      <div class="cmprow">
        <div class="cval ${aWins ? 'win' : ''}">${esc(av)}${r.aDetail ? ` <span class="det">(${esc(r.aDetail)})</span>` : ''}</div>
        <div class="clbl">${esc(r.label)}</div>
        <div class="cval r ${bWins ? 'win' : ''}">${esc(bv)}${r.bDetail ? ` <span class="det">(${esc(r.bDetail)})</span>` : ''}</div>
      </div>
      <div class="cbars">
        <div class="l"><span style="width:${aShare}%;background:${colorA};opacity:${aWins ? 1 : 0.45}"></span></div>
        <div class="r"><span style="width:${bShare}%;background:${colorB};opacity:${bWins ? 1 : 0.45}"></span></div>
      </div>`;
  }).join('');
  return `<div class="cmp2">${rows}</div>`;
};

export const timelineSvg = (data: GameStatsData, periods: number, periodDurationSec: number): string => {
  if (!data.box || data.timeline.length <= 1) return '';
  const colorA = data.box.teamA.color || '#dc2626';
  const colorB = data.box.teamB.color || '#2563eb';

  const W = 660, H = 220, padL = 30, padR = 12, padT = 10, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const totalSec = Math.max(1, periods * periodDurationSec);
  const finalMax = Math.max(data.box.teamA.score, data.box.teamB.score, 1);
  const maxScore = Math.ceil(finalMax / 10) * 10 || 10;

  const X = (sec: number) => padL + Math.min(1, sec / totalSec) * plotW;
  const Y = (score: number) => padT + plotH - (score / maxScore) * plotH;

  const stepPath = (key: 'scoreA' | 'scoreB') => {
    const pts = data.timeline;
    let d = `M ${X(pts[0].elapsedSec).toFixed(1)} ${Y(pts[0][key]).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const x = X(pts[i].elapsedSec).toFixed(1);
      d += ` L ${x} ${Y(pts[i - 1][key]).toFixed(1)} L ${x} ${Y(pts[i][key]).toFixed(1)}`;
    }
    return d;
  };

  const periodLines = Array.from({ length: periods - 1 }, (_, i) => {
    const x = X((i + 1) * periodDurationSec).toFixed(1);
    return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#e2e8f0" stroke-dasharray="2 4"/>`;
  }).join('');

  const yTicks = [0, Math.round(maxScore / 2), maxScore].map(v =>
    `<text x="${padL - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#94a3b8">${v}</text>`
  ).join('');

  const xLabels = Array.from({ length: periods }, (_, i) => {
    const x = X((i + 0.5) * periodDurationSec).toFixed(1);
    const lbl = (data.gameData?.settings?.periodType === 'half' ? 'H' : 'Q') + (i + 1);
    return `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#94a3b8">${lbl}</text>`;
  }).join('');

  return `
    <div class="tlwrap">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#cbd5e1"/>
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#cbd5e1"/>
        ${periodLines}${yTicks}${xLabels}
        <path d="${stepPath('scoreA')}" fill="none" stroke="${colorA}" stroke-width="2.5"/>
        <path d="${stepPath('scoreB')}" fill="none" stroke="${colorB}" stroke-width="2.5"/>
      </svg>
      <div class="tllegend">
        <span><i style="background:${colorA}"></i>${esc(data.box.teamA.name)}</span>
        <span><i style="background:${colorB}"></i>${esc(data.box.teamB.name)}</span>
      </div>
    </div>`;
};
