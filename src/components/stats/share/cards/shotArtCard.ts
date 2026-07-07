// src/components/stats/share/cards/shotArtCard.ts
// Shareable shot-chart art card (square / story), pure SVG.

import type { GameStatsData } from '../../useGameStats';
import type { TeamSide } from '../../types';
import { renderCard, courtGroupSvg, esc, fit, FORMAT_DIMS, type CardFormat, type CardDot } from './shared';

export interface ShotArtOpts {
  format: CardFormat;
  blocks: Set<string>; // 'misses' | 'splits'
}

export const SHOTART_BLOCKS = [
  { id: 'misses', label: 'Show misses' },
  { id: 'splits', label: '2PT / 3PT split' },
];

export const buildShotArtCard = (data: GameStatsData, side: TeamSide, opts: ShotArtOpts): string => {
  const { format, blocks } = opts;
  const { w } = FORMAT_DIMS[format];
  const story = format === 'story';
  const pad = 72;
  if (!data.box) return '';
  const team = side === 'A' ? data.box.teamA : data.box.teamB;
  const other = side === 'A' ? data.box.teamB : data.box.teamA;
  const color = team.color || '#dc2626';

  const allFg = data.shots.filter(s => s.teamSide === side && s.shotType !== 'free_throw' && s.x != null && s.y != null && s.zone !== 'unlocated');
  const showMiss = blocks.has('misses');
  const dots: CardDot[] = allFg
    .filter(s => showMiss || s.made)
    .map(s => ({ x: s.x!, y: s.y!, made: s.made, points: s.points }));

  const fgm = allFg.filter(s => s.made).length;
  const fga = allFg.length;
  const fgPct = fga > 0 ? (fgm / fga) * 100 : 0;
  const tpa = allFg.filter(s => s.points === 3).length;
  const tpm = allFg.filter(s => s.points === 3 && s.made).length;
  const twoA = fga - tpa, twoM = fgm - tpm;

  let body = '';
  let y = story ? 250 : 210;

  // Title
  body += `
    <text x="${pad}" y="${y}" font-size="52" font-weight="900" fill="#ffffff">${esc(fit(team.name, 18).toUpperCase())}</text>
    <text x="${pad}" y="${y + 40}" font-size="24" font-weight="700" letter-spacing="2" fill="#94a3b8">SHOT CHART · vs ${esc(fit(other.name, 16).toUpperCase())}</text>
    <text x="${w - pad}" y="${y}" text-anchor="end" font-size="64" font-weight="900" fill="${color}" font-variant-numeric="tabular-nums">${fgPct.toFixed(0)}%</text>
    <text x="${w - pad}" y="${y + 38}" text-anchor="end" font-size="26" font-weight="700" fill="#94a3b8">${fgm}/${fga} FG</text>`;
  y += story ? 110 : 90;

  // Court (the art)
  const cw = story ? 940 : 900;
  if (dots.length || fga === 0) {
    const court = courtGroupSvg(dots, { x: (w - cw) / 2, y, w: cw, depth: 60, line: 'rgba(255,255,255,0.22)', made: color });
    body += court.svg;
    y += court.height + (story ? 40 : 24);
  }

  if (fga === 0) {
    body += `<text x="${w / 2}" y="${y + 20}" text-anchor="middle" font-size="26" fill="#64748b">No located shots for this team.</text>`;
  }

  // 2PT / 3PT split
  if (blocks.has('splits') && fga > 0) {
    const twoPct = twoA > 0 ? (twoM / twoA) * 100 : 0;
    const threePct = tpa > 0 ? (tpm / tpa) * 100 : 0;
    const cwh = (w - pad * 2) / 2;
    body += `<g transform="translate(${pad},${y})">
      <rect x="0" y="0" width="${w - pad * 2}" height="118" rx="20" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.08"/>
      ${[['2-POINT', `${twoM}-${twoA}`, twoPct], ['3-POINT', `${tpm}-${tpa}`, threePct]].map(([lbl, ma, pct], i) => {
        const cx = cwh * i + cwh / 2;
        return `<text x="${cx}" y="40" text-anchor="middle" font-size="22" font-weight="700" letter-spacing="2" fill="#64748b">${lbl}</text>
                <text x="${cx}" y="86" text-anchor="middle" font-size="44" font-weight="900" fill="#ffffff">${(pct as number).toFixed(0)}%</text>
                <text x="${cx}" y="110" text-anchor="middle" font-size="20" font-weight="600" fill="#94a3b8">${esc(ma)}</text>`;
      }).join('')}
    </g>`;
    y += 140;
  }

  const dateLabel = data.gameData?.createdAt
    ? new Date(data.gameData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return renderCard(format, {
    accentA: color, accentB: other.color || '#2563eb',
    label: 'Shot Chart',
    footer: `${fit(data.gameData?.settings?.gameName ?? '', 30)}${dateLabel ? ` · ${dateLabel}` : ''}`,
    body,
  });
};
