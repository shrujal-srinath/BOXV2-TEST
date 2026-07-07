// src/components/stats/boxscore/BoxScoreTable.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Production box score (NBA.com style), light + dark.
// Columns are gated by data-driven capabilities; sortable; sticky player column;
// team totals footer; DNP players collapsed at the bottom.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, type KeyboardEvent } from 'react';
import type { TeamBoxScore, StatCapabilities, BoxScoreRow } from '../types';
import { Card } from '../ui/Card';
import { cx } from '../ui/cx';

interface ColumnDef {
  key: string;
  label: string;
  /** display value */
  get: (r: BoxScoreRow) => string | number;
  /** numeric value for sorting */
  sort: (r: BoxScoreRow) => number;
  /** total-row display value */
  total: (t: TeamBoxScore['totals']) => string | number;
  align?: 'left' | 'center' | 'right';
  /** show on small screens */
  primary?: boolean;
  /** subtle vertical separator before this column (group start) */
  groupStart?: boolean;
}

const md = (m: number, a: number) => `${m}-${a}`;
const pctStr = (n: number) => (n > 0 ? `${n.toFixed(1)}` : '—');

// Master column list; filtered by capabilities below.
const ALL_COLUMNS: Record<string, ColumnDef> = {
  pts:  { key: 'pts',  label: 'PTS', get: r => r.pts, sort: r => r.pts, total: t => t.pts, align: 'center', primary: true },
  fg:   { key: 'fg',   label: 'FG',  get: r => md(r.fgm, r.fga), sort: r => r.fga, total: t => md(t.fgm, t.fga), align: 'center', primary: true, groupStart: true },
  fgp:  { key: 'fgp',  label: 'FG%', get: r => pctStr(r.fgPct), sort: r => r.fgPct, total: t => pctStr(t.fgPct), align: 'center' },
  tp:   { key: 'tp',   label: '3PT', get: r => md(r.tpm, r.tpa), sort: r => r.tpa, total: t => md(t.tpm, t.tpa), align: 'center', groupStart: true },
  tpp:  { key: 'tpp',  label: '3P%', get: r => pctStr(r.tpPct), sort: r => r.tpPct, total: t => pctStr(t.tpPct), align: 'center' },
  ft:   { key: 'ft',   label: 'FT',  get: r => md(r.ftm, r.fta), sort: r => r.fta, total: t => md(t.ftm, t.fta), align: 'center', groupStart: true },
  reb:  { key: 'reb',  label: 'REB', get: r => r.reb, sort: r => r.reb, total: t => t.reb, align: 'center', primary: true, groupStart: true },
  ast:  { key: 'ast',  label: 'AST', get: r => r.ast, sort: r => r.ast, total: t => t.ast, align: 'center', primary: true },
  stl:  { key: 'stl',  label: 'STL', get: r => r.stl, sort: r => r.stl, total: t => t.stl, align: 'center' },
  blk:  { key: 'blk',  label: 'BLK', get: r => r.blk, sort: r => r.blk, total: t => t.blk, align: 'center' },
  tov:  { key: 'tov',  label: 'TO',  get: r => r.tov, sort: r => r.tov, total: t => t.tov, align: 'center' },
  pf:   { key: 'pf',   label: 'PF',  get: r => r.pf,  sort: r => r.pf,  total: t => t.pf,  align: 'center' },
};

const columnsForCaps = (caps: StatCapabilities): ColumnDef[] => {
  const keys: string[] = ['pts', 'fg', 'fgp'];
  if (caps.hasThrees) keys.push('tp', 'tpp');
  if (caps.hasFreeThrows) keys.push('ft');
  if (caps.hasRebounds) keys.push('reb');
  if (caps.hasAssists) keys.push('ast');
  if (caps.hasSteals) keys.push('stl');
  if (caps.hasBlocks) keys.push('blk');
  if (caps.hasTurnovers) keys.push('tov');
  if (caps.hasFouls) keys.push('pf');
  return keys.map(k => ALL_COLUMNS[k]);
};

interface Props {
  team: TeamBoxScore;
  capabilities: StatCapabilities;
  onPlayerClick?: (playerId: string) => void;
}

export const BoxScoreTable = ({ team, capabilities, onPlayerClick }: Props) => {
  const columns = useMemo(() => columnsForCaps(capabilities), [capabilities]);
  const [sortKey, setSortKey] = useState<string>('pts');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { active, dnp } = useMemo(() => {
    const a = team.rows.filter(r => !r.dnp);
    const d = team.rows.filter(r => r.dnp);
    const col = columns.find(c => c.key === sortKey) ?? ALL_COLUMNS.pts;
    a.sort((x, y) => (sortDir === 'desc' ? col.sort(y) - col.sort(x) : col.sort(x) - col.sort(y)));
    return { active: a, dnp: d };
  }, [team.rows, columns, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (key === sortKey) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const alignClass = (a?: string) => (a === 'left' ? 'text-left' : a === 'right' ? 'text-right' : 'text-center');

  return (
    <Card className="overflow-hidden">
      {/* Team header bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate uppercase tracking-tight">
            {team.name}
          </h3>
        </div>
        <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{team.score}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-800/50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-800/50 text-left px-3 sm:px-4 py-2.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide"
              >
                Player
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  role="button"
                  tabIndex={0}
                  aria-sort={sortKey === col.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  aria-label={`Sort by ${col.label}`}
                  onClick={() => toggleSort(col.key)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(col.key); } }}
                  className={cx(
                    'px-2 sm:px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap',
                    'text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40',
                    alignClass(col.align),
                    !col.primary && 'hidden sm:table-cell',
                    col.groupStart && 'border-l border-slate-100 dark:border-zinc-800'
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-red-600 dark:text-red-400" aria-hidden="true">{sortDir === 'desc' ? '▾' : '▴'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {active.map(row => (
              <tr
                key={row.playerId}
                onClick={() => onPlayerClick?.(row.playerId)}
                {...(onPlayerClick && {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `View ${row.name}'s game stats`,
                  onKeyDown: (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlayerClick(row.playerId); }
                  },
                })}
                className={cx(
                  'border-t border-slate-100 dark:border-zinc-800 transition-colors',
                  onPlayerClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/40'
                )}
              >
                <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 sm:px-4 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-slate-600 dark:text-zinc-300 tabular-nums">
                      {row.number || '–'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate leading-tight">
                        {row.name}
                        {row.disqualified && <span className="ml-1.5 text-[9px] font-bold text-red-500 align-middle">DQ</span>}
                      </div>
                      {row.position && (
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide leading-tight">
                          {row.position}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={cx(
                      'px-2 sm:px-3 py-2.5 tabular-nums whitespace-nowrap',
                      alignClass(col.align),
                      col.key === 'pts'
                        ? 'font-black text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-zinc-300',
                      !col.primary && 'hidden sm:table-cell',
                      col.groupStart && 'border-l border-slate-100 dark:border-zinc-800'
                    )}
                  >
                    {col.get(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40">
              <td className="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-800/40 px-3 sm:px-4 py-2.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
                Team Totals
              </td>
              {columns.map(col => (
                <td
                  key={col.key}
                  className={cx(
                    'px-2 sm:px-3 py-2.5 tabular-nums font-bold whitespace-nowrap',
                    alignClass(col.align),
                    col.key === 'pts' ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-zinc-200',
                    !col.primary && 'hidden sm:table-cell',
                    col.groupStart && 'border-l border-slate-200 dark:border-zinc-700'
                  )}
                >
                  {col.total(team.totals)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* DNP players */}
      {dnp.length > 0 && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-zinc-800">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">DNP: </span>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400">
            {dnp.map(d => `${d.name}${d.number ? ` (#${d.number})` : ''}`).join(', ')}
          </span>
        </div>
      )}
    </Card>
  );
};
