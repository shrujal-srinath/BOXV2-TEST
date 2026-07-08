// src/components/stats/summary/GameStoryPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The coach's read of the game, from the post-game report engine:
//   • Game story — the auto-derived highlight moments, staggered in
//   • Points breakdown — paint / fastbreak / second-chance / off-turnover
//     as bidirectional team bars (only rows with data)
//   • Clutch — late-and-close team lines + the top clutch scorer
//   • Shot profile — contested vs open and catch-and-shoot vs pull-up splits
// Every section self-gates on real data; the whole panel disappears for games
// that tracked none of it. Mounted at the top of the Summary tab.
// ─────────────────────────────────────────────────────────────────────────────

import type { GameReport, GameHighlight } from '../../../services/gameReport';
import type { AttributeSplit } from '../types';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { cx } from '../ui/cx';

const HL_LABEL: Record<GameHighlight['kind'], string> = {
  game_high: 'Game high',
  double_double: 'Double-double',
  triple_double: 'Triple-double',
  biggest_run: 'Run',
  clutch_star: 'Clutch',
  best_duo: 'Duo',
  hot_hand: 'Hot hand',
  perfect_line: 'Perfect',
  wire_to_wire: 'Wire to wire',
};

const sideColor = (report: GameReport, side?: 'A' | 'B') =>
  side === 'A' ? report.header.teamA.color || '#dc2626'
    : side === 'B' ? report.header.teamB.color || '#2563eb'
    : '#dc2626';

// ── bidirectional comparison row (matches TeamComparison's language) ─────────

const VsRow = ({ label, a, b, colorA, colorB }: {
  label: string; a: number; b: number; colorA: string; colorB: string;
}) => {
  const total = a + b;
  const aShare = total > 0 ? a / total : 0.5;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className={cx('text-sm font-black tabular-nums', a >= b ? 'text-slate-900 dark:text-zinc-50' : 'text-slate-400 dark:text-zinc-500')}>{a}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{label}</span>
        <span className={cx('text-sm font-black tabular-nums', b >= a ? 'text-slate-900 dark:text-zinc-50' : 'text-slate-400 dark:text-zinc-500')}>{b}</span>
      </div>
      <div className="flex gap-1 h-1.5">
        <div className="flex-1 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden flex justify-end">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${aShare * 100}%`, backgroundColor: colorA }} />
        </div>
        <div className="flex-1 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${(1 - aShare) * 100}%`, backgroundColor: colorB }} />
        </div>
      </div>
    </div>
  );
};

// ── attribute split pair (e.g. contested vs open) ────────────────────────────

const SplitPair = ({ title, left, right }: {
  title: string; left: AttributeSplit | undefined; right: AttributeSplit | undefined;
}) => {
  if (!left && !right) return null;
  const cell = (s: AttributeSplit | undefined) => (
    <div className="flex-1 rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{s?.label ?? '—'}</div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="text-lg font-black tabular-nums text-slate-900 dark:text-zinc-50">{s ? `${s.fgPct.toFixed(0)}%` : '–'}</span>
        {s && <span className="text-[11px] font-semibold tabular-nums text-slate-400 dark:text-zinc-500">{s.fgm}/{s.fga}</span>}
      </div>
    </div>
  );
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1.5">{title}</p>
      <div className="flex gap-2">{cell(left)}{cell(right)}</div>
    </div>
  );
};

// ── main ─────────────────────────────────────────────────────────────────────

export const GameStoryPanel = ({ report }: { report: GameReport }) => {
  const colorA = report.header.teamA.color || '#dc2626';
  const colorB = report.header.teamB.color || '#2563eb';

  const highlights = report.highlights.slice(0, 6);

  const special = [
    { label: 'Points in paint', a: report.special.teamA.inPaint, b: report.special.teamB.inPaint },
    { label: 'Fastbreak points', a: report.special.teamA.fastbreak, b: report.special.teamB.fastbreak },
    { label: '2nd-chance points', a: report.special.teamA.secondChance, b: report.special.teamB.secondChance },
    { label: 'Points off turnovers', a: report.special.teamA.offTurnover, b: report.special.teamB.offTurnover },
  ].filter(r => r.a + r.b > 0);

  const find = (rows: AttributeSplit[], id: string) => rows.find(r => r.attribute === id);
  const attrA = report.attributes.teamA;
  const attrB = report.attributes.teamB;
  const hasProfile = attrA.length > 0 || attrB.length > 0;

  const clutch = report.clutch;
  const clutchStar = clutch.players[0];
  const starName = clutchStar
    ? report.players.find(p => p.playerId === clutchStar.playerId)?.name ?? 'Unattributed'
    : null;

  if (highlights.length === 0 && special.length === 0 && !clutch.hasClutchTime && !hasProfile) {
    return null;
  }

  return (
    <Card padded>
      <style>{`
        @keyframes storyIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .story-chip { animation: storyIn 0.4s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .story-chip { animation: none; } }
      `}</style>

      <SectionHeader title="Game Story" />

      {/* Highlight moments */}
      {highlights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {highlights.map((hl, i) => (
            <div
              key={`${hl.kind}-${hl.playerId ?? hl.side ?? i}`}
              className="story-chip flex items-center gap-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 px-3.5 py-2.5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: sideColor(report, hl.side) }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">{HL_LABEL[hl.kind]}</span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-zinc-50 truncate">{hl.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{hl.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
        {/* Points breakdown */}
        {special.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Points breakdown</p>
            {special.map(r => (
              <VsRow key={r.label} label={r.label} a={r.a} b={r.b} colorA={colorA} colorB={colorB} />
            ))}
          </div>
        )}

        <div className="space-y-5">
          {/* Clutch */}
          {clutch.hasClutchTime && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1.5">
                Clutch · last {Math.round(clutch.windowSec / 60)}:00, within {clutch.marginMax}
              </p>
              <div className="flex gap-2">
                {([
                  { t: report.header.teamA, line: clutch.teamA, c: colorA },
                  { t: report.header.teamB, line: clutch.teamB, c: colorB },
                ]).map(({ t, line, c }) => (
                  <div key={t.name} className="flex-1 rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 truncate">{t.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-lg font-black tabular-nums text-slate-900 dark:text-zinc-50">{line.pts}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-400 dark:text-zinc-500">PTS · {line.fgm}/{line.fga} FG</span>
                    </div>
                  </div>
                ))}
              </div>
              {clutchStar && clutchStar.pts > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5">
                  <span className="font-bold text-slate-700 dark:text-zinc-200">{starName}</span> led clutch scoring with {clutchStar.pts}
                </p>
              )}
            </div>
          )}

          {/* Shot profile */}
          {hasProfile && (
            <div className="space-y-3">
              <SplitPair title={`${report.header.teamA.name} · shot quality`} left={find(attrA, 'contested')} right={find(attrA, 'uncontested')} />
              <SplitPair title={`${report.header.teamA.name} · shot type`} left={find(attrA, 'catch_and_shoot')} right={find(attrA, 'pull_up')} />
              <SplitPair title={`${report.header.teamB.name} · shot quality`} left={find(attrB, 'contested')} right={find(attrB, 'uncontested')} />
              <SplitPair title={`${report.header.teamB.name} · shot type`} left={find(attrB, 'catch_and_shoot')} right={find(attrB, 'pull_up')} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
