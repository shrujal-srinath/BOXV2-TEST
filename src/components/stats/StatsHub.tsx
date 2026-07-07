// src/components/stats/StatsHub.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Mode-aware game stats hub.
//   quick    → "not tracked" empty state, no export
//   stats    → Summary + Box Score
//   advanced → Summary + Box Score + Shot Charts (Phase 5)
// Light + dark, design system.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useGameStats } from './useGameStats';
import { GameHeaderV2 } from './GameHeaderV2';
import { BoxScoreTable } from './boxscore/BoxScoreTable';
import { TeamComparison } from './summary/TeamComparison';
import { ScoringTimelineChart } from './summary/ScoringTimelineChart';
import { LeadRunStrip } from './summary/LeadRunStrip';
import { ShotMap } from './advanced/ShotMap';
import { ZoneHeatmap } from './advanced/ZoneHeatmap';
import { DistanceBreakdown } from './advanced/DistanceBreakdown';
import { PossessionPanel } from './advanced/PossessionPanel';
import { ExportMenu } from './export/ExportMenu';
import { ShareComposer } from './share/ShareComposer';
import { Card } from './ui/Card';
import { cx } from './ui/cx';

type Tab = 'summary' | 'boxscore' | 'shots';

interface Props {
  gameCode: string;
  onBack?: () => void;
  onPlayerClick?: (playerId: string) => void;
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-dvh bg-[#F0EEE9] dark:bg-zinc-950">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</div>
  </div>
);

export const StatsHub = ({ gameCode, onBack, onPlayerClick }: Props) => {
  const data = useGameStats(gameCode);
  const [tab, setTab] = useState<Tab>('summary');
  const [shareOpen, setShareOpen] = useState(false);

  if (data.loading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-2xl bg-white/60 dark:bg-zinc-900" />
          <div className="h-10 w-64 rounded-lg bg-white/60 dark:bg-zinc-900" />
          <div className="h-80 rounded-2xl bg-white/60 dark:bg-zinc-900" />
        </div>
      </Shell>
    );
  }

  if (data.notFound || !data.box) {
    return (
      <Shell>
        <Card padded className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-slate-600 dark:text-zinc-400">Game not found.</p>
        </Card>
      </Shell>
    );
  }

  if (data.error) {
    return (
      <Shell>
        <Card padded className="text-center py-16">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-slate-600 dark:text-zinc-400">{data.error}</p>
        </Card>
      </Shell>
    );
  }

  const { box, mode, gameData } = data;
  const settings = gameData?.settings ?? {};
  const gameName = settings.gameName;
  const dateLabel = gameData?.createdAt
    ? new Date(gameData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : undefined;
  const periodDurationSec = (settings.periodDuration ?? 10) * 60;
  const periods = settings.periods ?? (settings.periodType === 'half' ? 2 : 4);

  const BackBtn = onBack && (
    <button
      onClick={onBack}
      className="mb-4 text-sm font-semibold text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
    >
      ← Back
    </button>
  );

  // ── Quick mode: nothing to show ──
  if (mode === 'quick') {
    return (
      <Shell>
        {BackBtn}
        <GameHeaderV2 box={box} mode={mode} gameName={gameName} dateLabel={dateLabel} />
        <Card padded className="text-center py-16">
          <div className="text-4xl mb-3">⏱️</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-1">Stats not tracked</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
            This was a <span className="font-semibold">Quick Game</span> — only the score was recorded.
            Use <span className="font-semibold">Stats</span> or <span className="font-semibold">Advanced</span> mode
            to capture box scores and shot charts.
          </p>
        </Card>
      </Shell>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'boxscore', label: 'Box Score' },
    ...(mode === 'advanced' && box.capabilities.hasShotLocations
      ? [{ id: 'shots' as Tab, label: 'Shot Charts' }]
      : []),
  ];

  return (
    <Shell>
      {BackBtn}
      <GameHeaderV2 box={box} mode={mode} gameName={gameName} dateLabel={dateLabel} />

      {/* Tab bar + export */}
      <div className="flex items-end justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 mb-6">
        <div className="flex gap-1 overflow-x-auto min-w-0" role="tablist" aria-label="Game stats sections">
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'px-4 py-2.5 text-sm font-bold transition-colors -mb-px border-b-2',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 rounded-t',
                tab === t.id
                  ? 'border-red-600 text-slate-900 dark:border-white dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pb-2 flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            Share
          </button>
          <ExportMenu data={data} />
        </div>
      </div>

      {tab === 'summary' && (
        <div className="space-y-6">
          <LeadRunStrip box={box} leads={data.leads} runs={data.runs} />
          <ScoringTimelineChart
            box={box}
            timeline={data.timeline}
            periodDurationSec={periodDurationSec}
            periodType={settings.periodType}
            periods={periods}
          />
          <TeamComparison box={box} rows={data.comparison} />
        </div>
      )}

      {tab === 'boxscore' && (
        <div className="space-y-6">
          <BoxScoreTable team={box.teamA} capabilities={box.capabilities} onPlayerClick={onPlayerClick} />
          <BoxScoreTable team={box.teamB} capabilities={box.capabilities} onPlayerClick={onPlayerClick} />
        </div>
      )}

      {tab === 'shots' && (
        <div className="space-y-6">
          <ShotMap
            box={box}
            shots={data.shots}
            rosterIndex={data.rosterIndex}
            periodType={settings.periodType}
            periods={periods}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ZoneHeatmap box={box} shots={data.shots} />
            <DistanceBreakdown box={box} shots={data.shots} />
          </div>
          {box.capabilities.hasShotClock && (
            <PossessionPanel box={box} shots={data.shots} shotClockDuration={settings.shotClockDuration ?? 24} />
          )}
        </div>
      )}

      {shareOpen && (
        <ShareComposer
          data={data}
          initialTemplate={tab === 'shots' ? 'shotart' : 'game'}
          onClose={() => setShareOpen(false)}
        />
      )}
    </Shell>
  );
};
