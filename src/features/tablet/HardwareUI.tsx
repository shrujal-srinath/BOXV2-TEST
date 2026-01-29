// src/features/tablet/HardwareUI.tsx (V2 - OPTIMIZED FOR 8" TABLET)
/**
 * HARDWARE UI V2 - FOR LENOVO YOGA 2-830LC
 * 
 * OPTIMIZATIONS:
 * ✅ 8" tablet layout (1280x800)
 * ✅ Larger touch targets (minimum 44px)
 * ✅ Enhanced haptic patterns
 * ✅ Undo/Redo buttons
 * ✅ Offline queue indicator
 * ✅ Traditional referee workflow
 * ✅ Industrial hardware aesthetic
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { BasketballGame } from '../../types';

interface OfflineAction {
  id: string;
  timestamp: number;
  action: string;
  pending: boolean;
}

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
  offlineQueue: OfflineAction[];
}

// ============================================
// ENHANCED HAPTIC PATTERNS
// ============================================
const HAPTIC_PATTERNS = {
  score1: [40] as number[],
  score2: [40, 30, 40] as number[],
  score3: [40, 30, 40, 30, 40] as number[],
  foul: [100] as number[],
  timeout: [60, 40, 60, 40, 60] as number[],
  clock: [70] as number[],
  shotClock: [50] as number[],
  possession: [35] as number[],
  period: [80, 50, 80] as number[],
  undo: [60, 30, 60] as number[],
  buzzer: [200, 100, 200, 100, 200] as number[],
  error: [100, 50, 100] as number[],
} as const;

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
  offlineQueue
}) => {
  const [flashingButton, setFlashingButton] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actionLog]);

  // ============================================
  // HELPERS
  // ============================================
  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  const flashButton = useCallback((id: string) => {
    setFlashingButton(id);
    setTimeout(() => setFlashingButton(null), 200);
  }, []);

  const logAction = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setActionLog(prev => [...prev.slice(-7), `[${timestamp}] ${message}`]);
  }, []);

  const formatTime = useCallback(() => {
    const { minutes, seconds } = game.gameState.gameTime;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [game.gameState.gameTime]);

  // ============================================
  // ACTION HANDLERS
  // ============================================
  const handleScore = useCallback((team: 'A' | 'B', points: number) => {
    const buttonId = `score-${team}-${points}`;
    flashButton(buttonId);
    
    if (points === 1) vibrate(HAPTIC_PATTERNS.score1);
    else if (points === 2) vibrate(HAPTIC_PATTERNS.score2);
    else if (points === 3) vibrate(HAPTIC_PATTERNS.score3);
    
    const teamName = team === 'A' ? game.teamA.name : game.teamB.name;
    logAction(`${teamName} +${points} PTS`);
    onAction(team, 'points', points);
  }, [flashButton, vibrate, logAction, onAction, game.teamA.name, game.teamB.name]);

  const handleFoul = useCallback((team: 'A' | 'B') => {
    flashButton(`foul-${team}`);
    vibrate(HAPTIC_PATTERNS.foul);
    const teamName = team === 'A' ? game.teamA.name : game.teamB.name;
    logAction(`${teamName} FOUL`);
    onAction(team, 'foul', 1);
  }, [flashButton, vibrate, logAction, onAction, game.teamA.name, game.teamB.name]);

  const handleTimeout = useCallback((team: 'A' | 'B') => {
    flashButton(`timeout-${team}`);
    vibrate(HAPTIC_PATTERNS.timeout);
    const teamName = team === 'A' ? game.teamA.name : game.teamB.name;
    logAction(`${teamName} TIMEOUT`);
    onAction(team, 'timeout', -1);
  }, [flashButton, vibrate, logAction, onAction, game.teamA.name, game.teamB.name]);

  const handleClockToggle = useCallback(() => {
    flashButton('clock-toggle');
    vibrate(HAPTIC_PATTERNS.clock);
    logAction(game.gameState.gameRunning ? 'Clock STOP' : 'Clock START');
    onToggleClock();
  }, [flashButton, vibrate, logAction, onToggleClock, game.gameState.gameRunning]);

  const handleShotReset = useCallback((seconds: number) => {
    flashButton(`shot-${seconds}`);
    vibrate(HAPTIC_PATTERNS.shotClock);
    logAction(`Shot Clock → ${seconds}s`);
    onResetShotClock(seconds);
  }, [flashButton, vibrate, logAction, onResetShotClock]);

  const handlePossessionToggle = useCallback(() => {
    flashButton('possession');
    vibrate(HAPTIC_PATTERNS.possession);
    const newPoss = game.gameState.possession === 'A' ? 'B' : 'A';
    const teamName = newPoss === 'A' ? game.teamA.name : game.teamB.name;
    logAction(`Possession → ${teamName}`);
    onTogglePossession();
  }, [flashButton, vibrate, logAction, onTogglePossession, game]);

  const handlePeriodNext = useCallback(() => {
    flashButton('period');
    vibrate(HAPTIC_PATTERNS.period);
    logAction(`Period ${game.gameState.period + 1}`);
    onNextPeriod();
  }, [flashButton, vibrate, logAction, onNextPeriod, game.gameState.period]);

  const handleUndoClick = useCallback(() => {
    if (!canUndo) {
      vibrate(HAPTIC_PATTERNS.error);
      return;
    }
    flashButton('undo');
    vibrate(HAPTIC_PATTERNS.undo);
    logAction('UNDO last action');
    onUndo();
  }, [canUndo, flashButton, vibrate, logAction, onUndo]);

  const handleRedoClick = useCallback(() => {
    if (!canRedo) {
      vibrate(HAPTIC_PATTERNS.error);
      return;
    }
    flashButton('redo');
    vibrate(HAPTIC_PATTERNS.undo);
    logAction('REDO action');
    onRedo();
  }, [canRedo, flashButton, vibrate, logAction, onRedo]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* === SCOREBOARD === */}
      <div className="bg-gradient-to-b from-zinc-900 to-black border-b-4 border-green-700 shadow-2xl">
        <div className="grid grid-cols-3 gap-4 p-4">
          {/* HOME SCORE */}
          <div className="metal-panel p-4">
            <div className="embossed-label mb-2">HOME TEAM</div>
            <div className="flex items-center justify-between mb-3">
              {game.gameState.possession === 'A' && (
                <div className="led-indicator led-on-green animate-pulse"></div>
              )}
              <h3 className="text-xl font-black italic text-white uppercase truncate ml-auto max-w-[70%]">
                {game.teamA.name}
              </h3>
            </div>
            <div className="segment-display text-6xl">
              {game.teamA.score.toString().padStart(3, '0')}
            </div>
            <div className="mt-3 flex justify-between text-xs font-bold text-zinc-400">
              <span className={game.teamA.fouls >= 5 ? 'text-red-500 animate-pulse' : 'text-red-400'}>
                FOULS: {game.teamA.fouls}
              </span>
              <span className="text-amber-500">TO: {game.teamA.timeouts}</span>
            </div>
          </div>

          {/* CLOCK & SHOT CLOCK */}
          <div className="space-y-3">
            <div className="metal-panel p-4 text-center">
              <div className="embossed-label mb-2">GAME TIME</div>
              <div 
                className={`segment-display ${game.gameState.gameRunning ? '' : 'segment-display-amber'}`}
                style={{ fontSize: '56px' }}
              >
                {formatTime()}
              </div>
              <div className="mt-2 embossed-label text-sm">
                PERIOD {game.gameState.period}
              </div>
            </div>

            <div className="metal-panel p-3">
              <div className="embossed-label mb-2 text-center text-xs">SHOT CLOCK</div>
              <div 
                className={`segment-display ${
                  game.gameState.shotClock <= 5 
                    ? 'segment-display-red animate-pulse' 
                    : 'segment-display-amber'
                }`}
                style={{ fontSize: '42px' }}
              >
                {game.gameState.shotClock}
              </div>
            </div>
          </div>

          {/* GUEST SCORE */}
          <div className="metal-panel p-4">
            <div className="embossed-label mb-2">GUEST TEAM</div>
            <div className="flex items-center justify-between mb-3">
              {game.gameState.possession === 'B' && (
                <div className="led-indicator led-on-green animate-pulse"></div>
              )}
              <h3 className="text-xl font-black italic text-white uppercase truncate ml-auto max-w-[70%]">
                {game.teamB.name}
              </h3>
            </div>
            <div className="segment-display text-6xl">
              {game.teamB.score.toString().padStart(3, '0')}
            </div>
            <div className="mt-3 flex justify-between text-xs font-bold text-zinc-400">
              <span className={game.teamB.fouls >= 5 ? 'text-red-500 animate-pulse' : 'text-red-400'}>
                FOULS: {game.teamB.fouls}
              </span>
              <span className="text-amber-500">TO: {game.teamB.timeouts}</span>
            </div>
          </div>
        </div>
      </div>

      {/* === CONTROL PANEL === */}
      <div className="flex-1 grid grid-cols-[300px_1fr_300px] gap-6 p-6 bg-black overflow-hidden">
        {/* LEFT: HOME CONTROLS */}
        <div className="metal-panel p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-3 border-b-2 border-green-700">
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0" 
              style={{ 
                backgroundColor: game.teamA.color, 
                boxShadow: `0 0 12px ${game.teamA.color}` 
              }}
            ></div>
            <h3 className="text-lg font-black italic text-white uppercase truncate">
              {game.teamA.name}
            </h3>
          </div>

          {/* Score Buttons */}
          <div className="space-y-2">
            <div className="embossed-label mb-2 text-xs">SCORING</div>
            <button 
              onClick={() => handleScore('A', 1)}
              className={`hw-button hw-button-green w-full h-14 text-lg ${
                flashingButton === 'score-A-1' ? 'haptic-feedback' : ''
              }`}
            >
              +1 POINT
            </button>
            <button 
              onClick={() => handleScore('A', 2)}
              className={`hw-button hw-button-green w-full h-14 text-lg ${
                flashingButton === 'score-A-2' ? 'haptic-feedback' : ''
              }`}
            >
              +2 POINTS
            </button>
            <button 
              onClick={() => handleScore('A', 3)}
              className={`hw-button hw-button-green w-full h-14 text-lg ${
                flashingButton === 'score-A-3' ? 'haptic-feedback' : ''
              }`}
            >
              +3 POINTS
            </button>
          </div>

          {/* Foul & Timeout */}
          <div className="mt-auto space-y-2">
            <button 
              onClick={() => handleFoul('A')}
              className={`hw-button hw-button-red w-full h-14 text-lg ${
                flashingButton === 'foul-A' ? 'haptic-feedback' : ''
              }`}
            >
              FOUL
            </button>
            <button 
              onClick={() => handleTimeout('A')}
              className={`hw-button hw-button-amber w-full h-14 text-lg ${
                flashingButton === 'timeout-A' ? 'haptic-feedback' : ''
              }`}
              disabled={game.teamA.timeouts === 0}
            >
              TIMEOUT ({game.teamA.timeouts})
            </button>
          </div>
        </div>

        {/* CENTER: MASTER CONTROLS */}
        <div className="flex flex-col gap-4">
          {/* Big Clock Button */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={handleClockToggle}
              className={`w-72 h-72 rounded-full border-8 flex flex-col items-center justify-center shadow-2xl transition-all active:scale-95 ${
                flashingButton === 'clock-toggle' ? 'haptic-feedback' : ''
              } ${
                game.gameState.gameRunning
                  ? 'bg-gradient-to-b from-red-600 to-red-800 border-red-900'
                  : 'bg-gradient-to-b from-green-600 to-green-800 border-green-900'
              }`}
              style={{
                boxShadow: game.gameState.gameRunning
                  ? '0 0 60px rgba(239, 68, 68, 0.6)'
                  : '0 0 60px rgba(34, 197, 94, 0.6)'
              }}
            >
              <div className="text-8xl font-black text-white mb-4">
                {game.gameState.gameRunning ? '■' : '▶'}
              </div>
              <div className="text-3xl font-black uppercase tracking-widest text-white">
                {game.gameState.gameRunning ? 'STOP' : 'START'}
              </div>
            </button>
          </div>

          {/* Bottom Controls Row */}
          <div className="grid grid-cols-4 gap-3">
            {/* Shot Clock */}
            <div className="col-span-2 metal-panel p-3">
              <div className="embossed-label mb-2 text-center text-xs">SHOT CLOCK</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleShotReset(24)}
                  className={`hw-button bg-gradient-to-b from-amber-600 to-amber-800 border-amber-700 text-white text-2xl font-black h-16 ${
                    flashingButton === 'shot-24' ? 'haptic-feedback' : ''
                  }`}
                >
                  24
                </button>
                <button
                  onClick={() => handleShotReset(14)}
                  className={`hw-button bg-gradient-to-b from-amber-600 to-amber-800 border-amber-700 text-white text-2xl font-black h-16 ${
                    flashingButton === 'shot-14' ? 'haptic-feedback' : ''
                  }`}
                >
                  14
                </button>
              </div>
            </div>

            {/* Possession */}
            <button
              onClick={handlePossessionToggle}
              className={`hw-button h-full ${
                flashingButton === 'possession' ? 'haptic-feedback' : ''
              }`}
            >
              <div className="embossed-label mb-1 text-xs">POSS</div>
              <div className="text-2xl">↔️</div>
            </button>

            {/* Next Period */}
            <button
              onClick={handlePeriodNext}
              className={`hw-button h-full ${
                flashingButton === 'period' ? 'haptic-feedback' : ''
              }`}
            >
              <div className="embossed-label mb-1 text-xs">PERIOD</div>
              <div className="text-2xl">→</div>
            </button>
          </div>

          {/* Undo/Redo Bar */}
          <div className="metal-panel p-3 grid grid-cols-2 gap-3">
            <button
              onClick={handleUndoClick}
              disabled={!canUndo}
              className={`hw-button hw-button-amber h-12 text-lg ${
                flashingButton === 'undo' ? 'haptic-feedback' : ''
              } ${!canUndo ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              ↶ UNDO
            </button>
            <button
              onClick={handleRedoClick}
              disabled={!canRedo}
              className={`hw-button hw-button-amber h-12 text-lg ${
                flashingButton === 'redo' ? 'haptic-feedback' : ''
              } ${!canRedo ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              REDO ↷
            </button>
          </div>
        </div>

        {/* RIGHT: GUEST CONTROLS */}
        <div className="metal-panel p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-3 border-b-2 border-green-700">
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0" 
              style={{ 
                backgroundColor: game.teamB.color, 
                boxShadow: `0 0 12px ${game.teamB.color}` 
              }}
            ></div>
            <h3 className="text-lg font-black italic text-white uppercase truncate">
              {game.teamB.name}
            </h3>
          </div>

          {/* Score Buttons */}
          <div className="space-y-2">
            <div className="embossed-label mb-2 text-xs">SCORING</div>
            <button 
              onClick={() => handleScore('B', 1)}
              className={`hw-button hw-button-green w-full h-14 text-lg ${
                flashingButton === 'score-B-1' ? 'haptic-feedback' : ''
              }`}
            >
              +1 POINT
            </button>
            <button 
              onClick={() => handleScore('B', 2)}
              className={`hw-button hw-button-green w-full h-14 text-lg ${
                flashingButton === 'score-B-2' ? 'haptic-feedback' : ''
              }`}
            >
              +2 POINTS
            </button>
            <button 
              onClick={() => handleScore('B', 3)}
              className={`hw-button hw-button-green w-full h-14 text-lg ${
                flashingButton === 'score-B-3' ? 'haptic-feedback' : ''
              }`}
            >
              +3 POINTS
            </button>
          </div>

          {/* Foul & Timeout */}
          <div className="mt-auto space-y-2">
            <button 
              onClick={() => handleFoul('B')}
              className={`hw-button hw-button-red w-full h-14 text-lg ${
                flashingButton === 'foul-B' ? 'haptic-feedback' : ''
              }`}
            >
              FOUL
            </button>
            <button 
              onClick={() => handleTimeout('B')}
              className={`hw-button hw-button-amber w-full h-14 text-lg ${
                flashingButton === 'timeout-B' ? 'haptic-feedback' : ''
              }`}
              disabled={game.teamB.timeouts === 0}
            >
              TIMEOUT ({game.teamB.timeouts})
            </button>
          </div>
        </div>
      </div>

      {/* === ACTION LOG === */}
      <div className="bg-black border-t-2 border-green-700 p-4">
        <div className="metal-panel p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="embossed-label text-xs">ACTION LOG</div>
            {offlineQueue.length > 0 && (
              <div className="flex items-center gap-2 text-amber-500 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-xs font-mono font-bold">
                  {offlineQueue.length} PENDING SYNC
                </span>
              </div>
            )}
          </div>
          <div className="bg-black rounded border border-green-700 p-2 h-16 overflow-y-auto font-mono text-xs">
            {actionLog.length === 0 ? (
              <div className="text-green-700">Ready for action...</div>
            ) : (
              actionLog.map((log, idx) => (
                <div key={idx} className="text-green-500 leading-tight">
                  {log}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};