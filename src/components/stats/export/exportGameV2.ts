// src/components/stats/export/exportGameV2.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mode-aware export: CSV (box-score grid + shot-level), JSON (full structured),
// and a branded print document used for BOTH native print (vector-crisp) and
// one-click PDF (html2pdf). Quick games are never exported.
// ─────────────────────────────────────────────────────────────────────────────

import type { GameStatsData } from '../useGameStats';
import type { TeamBoxScore, StatCapabilities } from '../types';
import type { ShotEvent } from '../../shotchart/types/shotTypes';
import { printGraphicsCss, comparisonBarsHTML, timelineSvg } from './printGraphics';
import {
  attributeSplits, specialPoints, leadFlow, clutchStats,
  assistNetwork, possessionHistogram, shotQuality,
} from '../../../services/statsEngine';
import { buildHexbins } from '../../../services/hexbinEngine';

// ── small helpers ────────────────────────────────────────────────────────────

const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const rowCsv = (cells: unknown[]) => cells.map(csvEscape).join(',');

const download = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const slug = (s: string) => (s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── CSV: box score grid (both teams) ─────────────────────────────────────────

const boxTeamCsvRows = (team: TeamBoxScore, caps: StatCapabilities): string[] => {
  const head = ['Player', '#', 'PTS', 'FGM', 'FGA', 'FG%'];
  if (caps.hasThrees) head.push('3PM', '3PA', '3P%');
  if (caps.hasFreeThrows) head.push('FTM', 'FTA', 'FT%');
  if (caps.hasRebounds) head.push('REB');
  if (caps.hasAssists) head.push('AST');
  if (caps.hasSteals) head.push('STL');
  if (caps.hasBlocks) head.push('BLK');
  if (caps.hasTurnovers) head.push('TO');
  if (caps.hasFouls) head.push('PF');
  head.push('TS%');

  const line = (r: any) => {
    const c: unknown[] = [r.name, r.number, r.pts, r.fgm, r.fga, r.fgPct.toFixed(1)];
    if (caps.hasThrees) c.push(r.tpm, r.tpa, r.tpPct.toFixed(1));
    if (caps.hasFreeThrows) c.push(r.ftm, r.fta, r.ftPct.toFixed(1));
    if (caps.hasRebounds) c.push(r.reb);
    if (caps.hasAssists) c.push(r.ast);
    if (caps.hasSteals) c.push(r.stl);
    if (caps.hasBlocks) c.push(r.blk);
    if (caps.hasTurnovers) c.push(r.tov);
    if (caps.hasFouls) c.push(r.pf);
    c.push(r.tsPct.toFixed(1));
    return rowCsv(c);
  };

  const t = team.totals;
  const totalLine = () => {
    const c: unknown[] = ['TEAM TOTALS', '', t.pts, t.fgm, t.fga, t.fgPct.toFixed(1)];
    if (caps.hasThrees) c.push(t.tpm, t.tpa, t.tpPct.toFixed(1));
    if (caps.hasFreeThrows) c.push(t.ftm, t.fta, t.ftPct.toFixed(1));
    if (caps.hasRebounds) c.push(t.reb);
    if (caps.hasAssists) c.push(t.ast);
    if (caps.hasSteals) c.push(t.stl);
    if (caps.hasBlocks) c.push(t.blk);
    if (caps.hasTurnovers) c.push(t.tov);
    if (caps.hasFouls) c.push(t.pf);
    c.push(t.tsPct.toFixed(1));
    return rowCsv(c);
  };

  return [
    csvEscape(`${team.name} (${team.score})`),
    rowCsv(head),
    ...team.rows.map(line),
    totalLine(),
  ];
};

export const exportBoxScoreCSV = (data: GameStatsData) => {
  const { box } = data;
  if (!box) return;
  const lines = [
    ...boxTeamCsvRows(box.teamA, box.capabilities),
    '',
    ...boxTeamCsvRows(box.teamB, box.capabilities),
  ];
  download(lines.join('\n'), `${slug(data.gameData?.settings?.gameName ?? data.gameCode)}-boxscore.csv`, 'text/csv');
};

// ── CSV: shot-level (advanced) ───────────────────────────────────────────────

export const exportShotsCSV = (data: GameStatsData) => {
  const head = ['Team', 'Player', '#', 'Period', 'Clock', 'Made', 'Points', 'ShotType', 'Zone', 'X', 'Y'];
  const lines = [rowCsv(head)];
  for (const s of data.shots as ShotEvent[]) {
    const p = s.playerId ? data.rosterIndex.get(s.playerId) : undefined;
    lines.push(rowCsv([
      s.teamSide, p?.name ?? '', p?.number ?? '', s.period,
      s.gameClockSec != null ? `${Math.floor(s.gameClockSec / 60)}:${String(s.gameClockSec % 60).padStart(2, '0')}` : '',
      s.made ? 'Y' : 'N', s.points, s.shotType, s.zone,
      s.x?.toFixed(1) ?? '', s.y?.toFixed(1) ?? '',
    ]));
  }
  download(lines.join('\n'), `${slug(data.gameData?.settings?.gameName ?? data.gameCode)}-shots.csv`, 'text/csv');
};

// ── JSON (full structured) ───────────────────────────────────────────────────

export const exportJSON = (data: GameStatsData) => {
  const payload = {
    game: {
      code: data.gameCode,
      name: data.gameData?.settings?.gameName,
      mode: data.mode,
      date: data.gameData?.createdAt ? new Date(data.gameData.createdAt).toISOString() : undefined,
    },
    boxScore: data.box,
    timeline: data.timeline,
    runs: data.runs,
    leads: data.leads,
    comparison: data.comparison,
    shots: data.mode === 'advanced' ? data.shots : undefined,
    // Advanced analytics (2026-07-07): everything below derives from data the
    // pipeline already persists — attributes, assisted_by, shot/game clocks.
    analytics: {
      specialPoints: { teamA: specialPoints(data.shots, 'A'), teamB: specialPoints(data.shots, 'B') },
      attributeSplits: { teamA: attributeSplits(data.shots, 'A'), teamB: attributeSplits(data.shots, 'B') },
      leadFlow: leadFlow(data.timeline),
      clutch: clutchStats(data.shots, { totalPeriods: data.gameData?.settings?.periods ?? 4 }),
      assists: { teamA: assistNetwork(data.shots, 'A'), teamB: assistNetwork(data.shots, 'B') },
      shotClockUsage: {
        teamA: possessionHistogram(data.shots, {}, 'A'),
        teamB: possessionHistogram(data.shots, {}, 'B'),
      },
      shotQuality: { teamA: shotQuality(data.shots, 'A'), teamB: shotQuality(data.shots, 'B') },
      hexbins: data.mode === 'advanced'
        ? { teamA: buildHexbins(data.shots, { side: 'A' }), teamB: buildHexbins(data.shots, { side: 'B' }) }
        : undefined,
    },
  };
  download(JSON.stringify(payload, null, 2), `${slug(data.gameData?.settings?.gameName ?? data.gameCode)}-stats.json`, 'application/json');
};

// ── Branded print HTML (shared by native print + html2pdf) ───────────────────

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

const boxTableHTML = (team: TeamBoxScore, caps: StatCapabilities): string => {
  const cols: Array<[string, (r: any) => string | number]> = [
    ['PTS', r => r.pts], ['FG', r => `${r.fgm}-${r.fga}`], ['FG%', r => r.fgPct.toFixed(1)],
  ];
  if (caps.hasThrees) cols.push(['3PT', r => `${r.tpm}-${r.tpa}`]);
  if (caps.hasFreeThrows) cols.push(['FT', r => `${r.ftm}-${r.fta}`]);
  if (caps.hasRebounds) cols.push(['REB', r => r.reb]);
  if (caps.hasAssists) cols.push(['AST', r => r.ast]);
  if (caps.hasSteals) cols.push(['STL', r => r.stl]);
  if (caps.hasBlocks) cols.push(['BLK', r => r.blk]);
  if (caps.hasTurnovers) cols.push(['TO', r => r.tov]);
  if (caps.hasFouls) cols.push(['PF', r => r.pf]);

  const th = ['Player', ...cols.map(c => c[0])].map(h => `<th>${esc(h)}</th>`).join('');
  const body = team.rows.filter(r => !r.dnp).map(r =>
    `<tr><td class="pl">${esc(r.number ? `#${r.number} ` : '')}${esc(r.name)}</td>${cols.map(c => `<td>${esc(c[1](r))}</td>`).join('')}</tr>`
  ).join('');
  const t = team.totals;
  const totals = `<tr class="tot"><td class="pl">Team Totals</td>${cols.map(c => `<td>${esc(c[1](t))}</td>`).join('')}</tr>`;

  return `<h2><span class="sw"></span>${esc(team.name)} — ${team.score}</h2>
    <table><thead><tr>${th}</tr></thead><tbody>${body}${totals}</tbody></table>`;
};

/** Serialize on-page court SVGs (shot map / heatmap) for detailed exports. */
const courtSVGsHTML = (): string => {
  const nodes = Array.from(document.querySelectorAll('svg[data-stats-court="1"]')) as SVGElement[];
  if (!nodes.length) return '';
  const svgs = nodes.slice(0, 2).map(n => `<div class="court">${n.outerHTML}</div>`).join('');
  return `<h2><span class="sw"></span>Shot Charts</h2><div class="courts">${svgs}</div>`;
};

export const buildPrintHTML = (data: GameStatsData, opts: { detailed: boolean }): string => {
  const { box } = data;
  if (!box) return '';
  const name = data.gameData?.settings?.gameName ?? `Game ${data.gameCode}`;
  const dateLabel = data.gameData?.createdAt
    ? new Date(data.gameData.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const aWin = box.teamA.score > box.teamB.score;
  const bWin = box.teamB.score > box.teamA.score;
  const settings: any = data.gameData?.settings ?? {};
  const periods: number = settings.periods ?? (settings.periodType === 'half' ? 2 : 4);
  const periodDurationSec: number = (settings.periodDuration ?? 10) * 60;
  const timeline = timelineSvg(data, periods, periodDurationSec);

  const css = `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Inter, Arial, sans-serif; color: #0f172a; margin: 0; padding: 28px; }
    .wm { font-size: 11px; font-weight: 800; letter-spacing: .18em; color: #dc2626; text-transform: uppercase; }
    .sub { font-size: 11px; color: #64748b; margin-bottom: 18px; }
    .score { display: flex; align-items: center; gap: 18px; margin: 8px 0 22px; }
    .score .tm { flex: 1; font-size: 18px; font-weight: 800; text-transform: uppercase; }
    .score .tm.r { text-align: right; }
    .score .pt { font-size: 40px; font-weight: 900; font-variant-numeric: tabular-nums; }
    .dimpt { color: #94a3b8; }
    h2 { font-size: 13px; font-weight: 800; margin: 22px 0 8px; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: .03em; }
    h2 .sw { width: 4px; height: 14px; background: #dc2626; border-radius: 2px; display: inline-block; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { padding: 5px 7px; text-align: center; border-bottom: 1px solid #e2e8f0; font-variant-numeric: tabular-nums; }
    th { background: #f8fafc; color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
    td.pl, th:first-child { text-align: left; font-weight: 600; }
    tr.tot td { font-weight: 800; background: #f8fafc; border-top: 2px solid #cbd5e1; }
    table.cmp td { font-size: 12px; }
    table.cmp .mid { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
    table.cmp .ra { text-align: right; font-weight: 800; } table.cmp .rb { text-align: left; font-weight: 800; }
    .dim { color: #94a3b8; font-weight: 500; font-size: 10px; }
    .courts { display: flex; gap: 14px; } .court { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; }
    .foot { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; }
    @page { margin: 14mm; }
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(name)} — Stats</title><style>${css}${printGraphicsCss}</style></head>
  <body>
    <div class="wm">THE BOX</div>
    <div class="sub">${esc(name)}${dateLabel ? ` · ${esc(dateLabel)}` : ''}</div>
    <div class="score">
      <div class="tm">${esc(box.teamA.name)}</div>
      <div class="pt ${aWin ? '' : 'dimpt'}">${box.teamA.score}</div>
      <div style="color:#cbd5e1;font-weight:900">–</div>
      <div class="pt ${bWin ? '' : 'dimpt'}">${box.teamB.score}</div>
      <div class="tm r">${esc(box.teamB.name)}</div>
    </div>
    <h2><span class="sw"></span>Team Comparison</h2>
    ${comparisonBarsHTML(data)}
    ${timeline ? `<h2><span class="sw"></span>Scoring Timeline</h2>${timeline}` : ''}
    ${boxTableHTML(box.teamA, box.capabilities)}
    ${boxTableHTML(box.teamB, box.capabilities)}
    ${opts.detailed ? courtSVGsHTML() : ''}
    <div class="foot">Generated by THE BOX · ${new Date().toLocaleString()}</div>
  </body></html>`;
};

// ── PDF + print drivers ──────────────────────────────────────────────────────

export const printGame = (data: GameStatsData, detailed = false) => {
  const html = buildPrintHTML(data, { detailed });
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) { alert('Pop-up blocked. Allow pop-ups to print/save PDF.'); return; }
  w.document.write(html);
  w.document.close();
  // Give the new document a tick to lay out (incl. embedded SVGs) before printing.
  setTimeout(() => { w.focus(); w.print(); }, 350);
};

export const downloadPDF = async (data: GameStatsData, detailed = false) => {
  try {
    const html2pdf = (await import('html2pdf.js')).default as any;
    const html = buildPrintHTML(data, { detailed });
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    await html2pdf().set({
      margin: 8,
      filename: `${slug(data.gameData?.settings?.gameName ?? data.gameCode)}-stats.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    }).from(host).save();
    document.body.removeChild(host);
  } catch (e) {
    console.error('[exportGameV2] PDF failed, falling back to print', e);
    printGame(data, detailed);
  }
};
