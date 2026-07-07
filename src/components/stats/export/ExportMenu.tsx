// src/components/stats/export/ExportMenu.tsx
// Mode-aware export dropdown. Hidden for Quick games. Advanced adds detailed +
// shot-level options. Design-system styled, light + dark.

import { useState, useRef, useEffect } from 'react';
import type { GameStatsData } from '../useGameStats';
import {
  exportBoxScoreCSV, exportShotsCSV, exportJSON, downloadPDF, printGame,
} from './exportGameV2';
import { cx } from '../ui/cx';

const Item = ({ onClick, label, hint }: { onClick: () => void; label: string; hint?: string }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between gap-4"
  >
    <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{label}</span>
    {hint && <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide">{hint}</span>}
  </button>
);

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
    {children}
  </div>
);

export const ExportMenu = ({ data }: { data: GameStatsData }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!data.box?.capabilities.exportable) return null;
  const advanced = data.mode === 'advanced';

  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); setOpen(false); }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export game stats"
        className={cx(
          'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors',
          'bg-red-600 hover:bg-red-700 text-white disabled:opacity-60',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40'
        )}
      >
        {busy ? 'Exporting…' : 'Export'}
        <span className={cx('transition-transform text-[10px]', open && 'rotate-180')} aria-hidden="true">▼</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-20 py-1">
          <GroupLabel>Box Score</GroupLabel>
          <Item label="Download PDF" hint="pdf" onClick={() => run(() => downloadPDF(data, false))} />
          <Item label="Print / Save as PDF" hint="print" onClick={() => run(() => printGame(data, false))} />
          <Item label="Spreadsheet" hint="csv" onClick={() => run(() => exportBoxScoreCSV(data))} />

          {advanced && (
            <>
              <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />
              <GroupLabel>Detailed Analytics</GroupLabel>
              <Item label="Detailed PDF (charts)" hint="pdf" onClick={() => run(() => downloadPDF(data, true))} />
              <Item label="Print detailed report" hint="print" onClick={() => run(() => printGame(data, true))} />
              <Item label="Shot data" hint="csv" onClick={() => run(() => exportShotsCSV(data))} />
            </>
          )}

          <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />
          <Item label="Full data" hint="json" onClick={() => run(() => exportJSON(data))} />
        </div>
      )}
    </div>
  );
};
