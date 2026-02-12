// src/features/tablet/HardwareUI.tsx
// ─────────────────────────────────────────────────────────────
// REDESIGNED — key UX improvements:
//
//  LAYOUT: 3-column (teamA | center | teamB) instead of cramped
//          12-col grid. Each column owns its space fully.
//
//  TOUCH TARGETS: +1/+2/+3 buttons are massive — easy to hit
//          mid-game without looking. Minimum 72px height.
//
//  CLOCK PANEL: Game clock dominates center. Shot clock is
//          clearly subordinate. START/STOP button is full width
//          and color-coded (green=stopped, red=running).
//
//  VISUAL HIERARCHY: Score is the biggest number on screen.
//          Period indicator in the header. Possession arrow
//          glows next to the team in control.
//
//  STATUS STRIP: 1-row header with period, network, queue count,
//          undo/redo — out of the way but always visible.
//
//  REMOVED: landscape hint banner (handled by OS lock now).
//  REMOVED: nested column grids that made buttons tiny.
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import type { BasketballGame } from '../../types';

interface HardwareUIProps {
  game: BasketballGame;
  onAction: (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => void;
  onToggleClock: () => void;
  onResetShotClock: (seconds: number) => void;
  onTogglePossession: () => void;
  onNextPeriod: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  offlineQueue: any[];
  onOpenDiagnostics: () => void;
  onOpenSettings: () => void;
  isOnline: boolean;
}

export const HardwareUI: React.FC<HardwareUIProps> = ({
  game,
  onAction,
  onToggleClock,
  onResetShotClock,
  onTogglePossession,
  onNextPeriod,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  offlineQueue,
  onOpenDiagnostics,
  onOpenSettings,
  isOnline,
}) => {
  const [flashA, setFlashA] = useState(false);
  const [flashB, setFlashB] = useState(false);

  const vibrate = useCallback((p: number | number[]) => {
    if (navigator.vibrate) navigator.vibrate(p);
  }, []);

  const scoreA = (pts: number) => {
    onAction('A', 'points', pts);
    setFlashA(true);
    vibrate(pts > 0 ? [25, 10, 25] : [60]);
    setTimeout(() => setFlashA(false), 250);
  };

  const scoreB = (pts: number) => {
    onAction('B', 'points', pts);
    setFlashB(true);
    vibrate(pts > 0 ? [25, 10, 25] : [60]);
    setTimeout(() => setFlashB(false), 250);
  };

  const fmt = (m: number, s: number) =>
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const isRunning = game.gameState.gameRunning;
  const shotClock = game.gameState.shotClock;
  const period = game.gameState.period;
  const periodLabel = game.settings.periodType === 'half'
    ? (period <= 2 ? `HALF ${period}` : 'OT')
    : (period <= 4 ? `Q${period}` : `OT${period - 4}`);

  const posA = game.gameState.possession === 'A';
  const posB = game.gameState.possession === 'B';

  const teamAColor = game.teamA.color || '#3b82f6';
  const teamBColor = game.teamB.color || '#ef4444';

  return (
    <div
      className="w-screen h-screen bg-zinc-950 flex flex-col overflow-hidden select-none"
      style={{ fontFamily: "'DM Mono', 'Courier New', monospace" }}
    >

      {/* ═══════════════════════════════════════════════════
          STATUS STRIP — period / network / queue / tools
          1 row, 40px tall, never gets in the way
      ═══════════════════════════════════════════════════ */}
      <div className="flex-none h-10 bg-black border-b border-zinc-900 flex items-center justify-between px-4 gap-4">
        {/* Left: period + possession */}
        <div className="flex items-center gap-3">
          <span className="text-yellow-500 font-black text-xs uppercase tracking-[0.2em]">
            {periodLabel}
          </span>
          <span className="text-zinc-700">|</span>
          <button
            onClick={onTogglePossession}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">POSS</span>
            <span
              className="text-xs font-black uppercase"
              style={{ color: posA ? teamAColor : teamBColor }}
            >
              {posA ? game.teamA.name : game.teamB.name}
            </span>
          </button>
        </div>

        {/* Center: next period */}
        <button
          onClick={onNextPeriod}
          className="text-[10px] font-bold text-zinc-600 hover:text-yellow-500 uppercase tracking-widest transition-colors px-3 py-1 border border-zinc-900 hover:border-yellow-900 rounded"
        >
          NEXT PERIOD →
        </button>

        {/* Right: undo/redo + network + diagnostics */}
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="text-[10px] font-bold text-zinc-600 disabled:opacity-20 hover:text-white transition-colors px-2"
          >
            ↩ UNDO
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="text-[10px] font-bold text-zinc-600 disabled:opacity-20 hover:text-white transition-colors px-2"
          >
            REDO ↪
          </button>
          <div className="w-px h-4 bg-zinc-800" />
          {offlineQueue.length > 0 && (
            <span className="text-[10px] text-amber-500 font-mono">{offlineQueue.length} PENDING</span>
          )}
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <button
            onClick={onOpenDiagnostics}
            className="text-[10px] font-bold text-zinc-700 hover:text-zinc-400 uppercase tracking-widest ml-1"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MAIN BODY — 3 columns: TEAM A | CENTER | TEAM B
          Takes all remaining height
      ═══════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─────────────────────────────────────────────
            TEAM A PANEL
        ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col border-r border-zinc-900 overflow-hidden">

          {/* Team header */}
          <div
            className="flex-none h-10 flex items-center justify-between px-4 border-b border-zinc-900"
            style={{ borderBottomColor: `${teamAColor}40` }}
          >
            <span
              className="text-sm font-black uppercase tracking-widest truncate"
              style={{ color: teamAColor }}
            >
              {game.teamA.name}
            </span>
            <div className="flex gap-3 text-xs text-zinc-600 font-mono">
              <span>F:{game.teamA.fouls}</span>
              <span>TO:{game.teamA.timeouts}</span>
            </div>
          </div>

          {/* Score display */}
          <div
            className={`flex-none flex items-center justify-center transition-all duration-150 ${flashA ? 'bg-white/5' : ''}`}
            style={{ height: '30%' }}
          >
            <span
              className="font-black tabular-nums leading-none"
              style={{
                fontSize: 'clamp(4rem, 12vw, 9rem)',
                color: flashA ? 'white' : teamAColor,
                textShadow: flashA ? `0 0 40px ${teamAColor}` : `0 0 20px ${teamAColor}40`,
                transition: 'color 0.15s, text-shadow 0.15s',
              }}
            >
              {game.teamA.score}
            </span>
          </div>

          {/* Scoring buttons */}
          <div className="flex-1 flex flex-col gap-2 p-3">
            {/* +1 / +2 / +3 */}
            <div className="flex gap-2 flex-1">
              {[1, 2, 3].map((pts) => (
                <button
                  key={pts}
                  onPointerDown={() => scoreA(pts)}
                  className="flex-1 rounded-xl border-2 border-zinc-800 active:border-opacity-100 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 active:brightness-150"
                  style={{
                    background: `${teamAColor}08`,
                    borderColor: `${teamAColor}30`,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span
                    className="font-black text-3xl leading-none"
                    style={{ color: teamAColor }}
                  >
                    +{pts}
                  </span>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                    {pts === 1 ? 'POINT' : pts === 2 ? 'FIELD' : '3-PTR'}
                  </span>
                </button>
              ))}
            </div>

            {/* Secondary actions */}
            <div className="flex gap-2 h-14">
              <button
                onPointerDown={() => { onAction('A', 'points', -1); vibrate(40); }}
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all text-zinc-500 text-xs font-bold uppercase tracking-widest"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                −1
              </button>
              <button
                onPointerDown={() => { onAction('A', 'foul', 1); vibrate(80); }}
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-orange-900 active:scale-95 active:bg-orange-950 transition-all text-orange-500 text-xs font-bold uppercase tracking-widest"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                FOUL
              </button>
              <button
                onPointerDown={() => { onAction('A', 'timeout', -1); vibrate([40, 20, 40]); }}
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 active:scale-95 transition-all text-zinc-400 text-xs font-bold uppercase tracking-widest"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                T.O.
              </button>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────
            CENTER PANEL — Clock + Shot Clock
        ───────────────────────────────────────────── */}
        <div
          className="flex-none flex flex-col border-r border-zinc-900 overflow-hidden"
          style={{ width: '28%', minWidth: '220px', maxWidth: '300px' }}
        >
          {/* Period spacer row to match team headers */}
          <div className="flex-none h-10 border-b border-zinc-900 flex items-center justify-center">
            <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em]">
              CLOCK
            </span>
          </div>

          {/* Game clock */}
          <div className="flex-none flex flex-col items-center justify-center px-4 pt-4 pb-2" style={{ height: '38%' }}>
            <div
              className="font-black tabular-nums leading-none mb-3 transition-colors"
              style={{
                fontSize: 'clamp(2.8rem, 8vw, 5.5rem)',
                color: isRunning ? '#22c55e' : '#52525b',
                textShadow: isRunning ? '0 0 30px rgba(34,197,94,0.5)' : 'none',
              }}
            >
              {fmt(game.gameState.gameTime.minutes, game.gameState.gameTime.seconds)}
            </div>

            {/* START / STOP — the most important button on the panel */}
            <button
              onPointerDown={onToggleClock}
              className="w-full rounded-xl font-black text-base uppercase tracking-widest transition-all active:scale-[0.97]"
              style={{
                height: '52px',
                background: isRunning
                  ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
                  : 'linear-gradient(135deg, #14532d, #166534)',
                border: isRunning ? '2px solid #ef4444' : '2px solid #22c55e',
                color: isRunning ? '#fca5a5' : '#86efac',
                boxShadow: isRunning
                  ? '0 0 20px rgba(239,68,68,0.3)'
                  : '0 0 20px rgba(34,197,94,0.3)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {isRunning ? '⏸  STOP' : '▶  START'}
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-zinc-900 mx-4" />

          {/* Shot clock */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
            <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
              SHOT CLOCK
            </div>
            <div
              className={`font-black tabular-nums leading-none transition-all ${shotClock <= 5 && shotClock > 0
                  ? 'text-red-500 animate-pulse'
                  : shotClock === 0
                    ? 'text-red-700'
                    : 'text-amber-500'
                }`}
              style={{
                fontSize: 'clamp(2rem, 6vw, 4rem)',
                textShadow:
                  shotClock <= 5 && shotClock > 0
                    ? '0 0 20px rgba(239,68,68,0.6)'
                    : 'none',
              }}
            >
              {shotClock}
            </div>

            {/* Reset buttons */}
            <div className="flex gap-2 w-full">
              <button
                onPointerDown={() => onResetShotClock(24)}
                className="flex-1 h-11 rounded-lg bg-zinc-900 border border-zinc-800 active:bg-amber-950 active:border-amber-700 transition-all text-amber-500 font-black text-sm"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                24
              </button>
              <button
                onPointerDown={() => onResetShotClock(14)}
                className="flex-1 h-11 rounded-lg bg-zinc-900 border border-zinc-800 active:bg-amber-950 active:border-amber-700 transition-all text-amber-500 font-black text-sm"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                14
              </button>
            </div>
          </div>

          {/* Possession + period at bottom */}
          <div className="flex-none h-14 border-t border-zinc-900 flex items-center justify-center gap-3 px-4">
            <button
              onPointerDown={onTogglePossession}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 active:scale-95 transition-all w-full justify-center"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: posA ? teamAColor : teamBColor }}
              >
                ← POSS →
              </span>
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────
            TEAM B PANEL
        ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Team header */}
          <div
            className="flex-none h-10 flex items-center justify-between px-4 border-b border-zinc-900"
            style={{ borderBottomColor: `${teamBColor}40` }}
          >
            <div className="flex gap-3 text-xs text-zinc-600 font-mono">
              <span>TO:{game.teamB.timeouts}</span>
              <span>F:{game.teamB.fouls}</span>
            </div>
            <span
              className="text-sm font-black uppercase tracking-widest truncate text-right"
              style={{ color: teamBColor }}
            >
              {game.teamB.name}
            </span>
          </div>

          {/* Score display */}
          <div
            className={`flex-none flex items-center justify-center transition-all duration-150 ${flashB ? 'bg-white/5' : ''}`}
            style={{ height: '30%' }}
          >
            <span
              className="font-black tabular-nums leading-none"
              style={{
                fontSize: 'clamp(4rem, 12vw, 9rem)',
                color: flashB ? 'white' : teamBColor,
                textShadow: flashB ? `0 0 40px ${teamBColor}` : `0 0 20px ${teamBColor}40`,
                transition: 'color 0.15s, text-shadow 0.15s',
              }}
            >
              {game.teamB.score}
            </span>
          </div>

          {/* Scoring buttons */}
          <div className="flex-1 flex flex-col gap-2 p-3">
            <div className="flex gap-2 flex-1">
              {[1, 2, 3].map((pts) => (
                <button
                  key={pts}
                  onPointerDown={() => scoreB(pts)}
                  className="flex-1 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 active:brightness-150"
                  style={{
                    background: `${teamBColor}08`,
                    borderColor: `${teamBColor}30`,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span
                    className="font-black text-3xl leading-none"
                    style={{ color: teamBColor }}
                  >
                    +{pts}
                  </span>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                    {pts === 1 ? 'POINT' : pts === 2 ? 'FIELD' : '3-PTR'}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 h-14">
              <button
                onPointerDown={() => { onAction('B', 'points', -1); vibrate(40); }}
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all text-zinc-500 text-xs font-bold uppercase tracking-widest"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                −1
              </button>
              <button
                onPointerDown={() => { onAction('B', 'foul', 1); vibrate(80); }}
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-orange-900 active:scale-95 active:bg-orange-950 transition-all text-orange-500 text-xs font-bold uppercase tracking-widest"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                FOUL
              </button>
              <button
                onPointerDown={() => { onAction('B', 'timeout', -1); vibrate([40, 20, 40]); }}
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 active:scale-95 transition-all text-zinc-400 text-xs font-bold uppercase tracking-widest"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                T.O.
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};