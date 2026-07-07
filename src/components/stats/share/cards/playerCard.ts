// src/components/stats/share/cards/playerCard.ts
// Shareable "my game" player card (square / story), pure SVG.

import type { GameStatsData } from '../../useGameStats';
import type { TeamBoxScore } from '../../types';
import { renderCard, courtGroupSvg, bigStat, esc, fit, FORMAT_DIMS, type CardFormat, type CardDot } from './shared';

export interface PlayerCardOpts {
  format: CardFormat;
  blocks: Set<string>; // 'splits' | 'shotchart' | 'result'
}

export const PLAYER_BLOCKS = [
  { id: 'splits', label: 'Shooting splits' },
  { id: 'shotchart', label: 'Shot chart' },
  { id: 'result', label: 'Game result' },
];

export const buildPlayerCard = (data: GameStatsData, playerId: string, opts: PlayerCardOpts): string => {
  const { format, blocks } = opts;
  const { w } = FORMAT_DIMS[format];
  const story = format === 'story';
  const pad = 72;

  if (!data.box) return '';
  let team: TeamBoxScore | null = null;
  let row = null as TeamBoxScore['rows'][number] | null;
  for (const t of [data.box.teamA, data.box.teamB]) {
    const r = t.rows.find(rr => rr.playerId === playerId);
    if (r) { team = t; row = r; break; }
  }
  if (!team || !row) return '';
  const other = team.side === 'A' ? data.box.teamB : data.box.teamA;
  const color = team.color || '#dc2626';

  const dots: CardDot[] = data.shots
    .filter(s => s.playerId === playerId && s.shotType !== 'free_throw' && s.x != null && s.y != null && s.zone !== 'unlocated')
    .map(s => ({ x: s.x!, y: s.y!, made: s.made, points: s.points }));

  let body = '';
  let y = story ? 250 : 210;

  // ── Identity ──
  body += `
    <g transform="translate(${pad},${y})">
      <rect x="0" y="0" width="84" height="84" rx="20" fill="${color}"/>
      <text x="42" y="60" text-anchor="middle" font-size="44" font-weight="900" fill="#ffffff">${esc(row.number || '–')}</text>
      <text x="104" y="38" font-size="${row.name.length > 14 ? 44 : 56}" font-weight="900" fill="#ffffff">${esc(fit(row.name, 18))}</text>
      <text x="104" y="72" font-size="24" font-weight="700" letter-spacing="2" fill="#94a3b8">${esc(fit(team.name, 22).toUpperCase())}${row.position ? ` · ${esc(row.position)}` : ''}</text>
    </g>`;
  y += story ? 200 : 170;

  // ── Stat trio ──
  body += bigStat(w * 0.22, y, row.pts, 'PTS', '#ffffff');
  body += bigStat(w * 0.5, y, data.box.capabilities.hasRebounds ? row.reb : row.ast, data.box.capabilities.hasRebounds ? 'REB' : 'AST', '#ffffff');
  body += bigStat(w * 0.78, y, data.box.capabilities.hasAssists ? row.ast : Math.round(row.tsPct), data.box.capabilities.hasAssists ? 'AST' : 'TS%', '#ffffff');
  y += story ? 200 : 170;

  // ── Shooting splits ──
  if (blocks.has('splits')) {
    const cols: Array<[string, string, string]> = [['FG', `${row.fgm}-${row.fga}`, `${row.fgPct.toFixed(0)}%`]];
    if (data.box.capabilities.hasThrees) cols.push(['3PT', `${row.tpm}-${row.tpa}`, `${row.tpPct.toFixed(0)}%`]);
    if (data.box.capabilities.hasFreeThrows) cols.push(['FT', `${row.ftm}-${row.fta}`, `${row.ftPct.toFixed(0)}%`]);
    const cw = (w - pad * 2) / cols.length;
    body += `<g transform="translate(${pad},${y})">
      <rect x="0" y="-10" width="${w - pad * 2}" height="118" rx="20" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.08"/>
      ${cols.map(([lbl, ma, pct], i) => {
        const cx = cw * i + cw / 2;
        return `<text x="${cx}" y="34" text-anchor="middle" font-size="22" font-weight="700" letter-spacing="2" fill="#64748b">${lbl}</text>
                <text x="${cx}" y="78" text-anchor="middle" font-size="40" font-weight="900" fill="#ffffff">${esc(pct)}</text>
                <text x="${cx}" y="104" text-anchor="middle" font-size="20" font-weight="600" fill="#94a3b8">${esc(ma)}</text>`;
      }).join('')}
    </g>`;
    y += story ? 180 : 150;
  }

  // ── Shot chart ──
  if (blocks.has('shotchart') && dots.length && data.box.capabilities.hasShotLocations) {
    const cw = story ? 700 : 460;
    const court = courtGroupSvg(dots, { x: (w - cw) / 2, y, w: cw, line: 'rgba(255,255,255,0.22)', made: color });
    body += court.svg;
    y += court.height + 24;
  }

  // ── Game result ──
  if (blocks.has('result')) {
    const won = team.score > other.score;
    body += `<text x="${w / 2}" y="${y + 30}" text-anchor="middle" font-size="26" font-weight="800" letter-spacing="1" fill="${won ? '#22c55e' : '#94a3b8'}">
      ${won ? 'WON' : team.score < other.score ? 'LOST' : 'TIED'} ${team.score}–${other.score} vs ${esc(fit(other.name, 16).toUpperCase())}
    </text>`;
  }

  const dateLabel = data.gameData?.createdAt
    ? new Date(data.gameData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return renderCard(format, {
    accentA: color,
    accentB: other.color || '#2563eb',
    label: 'Player Game',
    footer: `${fit(data.gameData?.settings?.gameName ?? '', 30)}${dateLabel ? ` · ${dateLabel}` : ''}`,
    body,
  });
};
