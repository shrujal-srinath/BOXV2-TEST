// src/features/tablet/HardwareUI.tsx (ULTRA-COMPACT - NO SCROLL VERSION)
/**
 * ULTRA-COMPACT HARDWARE UI
 * Fits EVERYTHING on one screen (no scrolling required)
 * Optimized for landscape tablets
 */

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
  offlineQueue
}) => {
  const [flashingTeam, setFlashingTeam] = useState<'A' | 'B' | null>(null);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  const handleScoreAction = useCallback((team: 'A' | 'B', value: number) => {
    onAction(team, 'points', value);
    setFlashingTeam(team);
    vibrate(value > 0 ? [30, 10, 30] : [50]);
    setTimeout(() => setFlashingTeam(null), 300);
  }, [onAction, vibrate]);

  const formatTime = (minutes: number, seconds: number): string => {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden">
      
      {/* ULTRA-COMPACT 2-ROW LAYOUT */}
      <div className="flex-1 grid grid-rows-2 gap-2 p-2">
        
        {/* ============================================
            ROW 1: SCORES + CLOCK + CONTROLS
            ============================================ */}
        <div className="grid grid-cols-12 gap-2">
          
          {/* LEFT: TEAM A SCORE */}
          <div className="col-span-3 flex flex-col gap-1">
            <div className="metal-panel p-2">
              <div className="text-xs font-bold text-blue-400 uppercase truncate mb-1">{game.teamA.name}</div>
              <div className={`digital-display digital-display-team-a text-5xl text-center py-2 ${
                flashingTeam === 'A' ? 'animate-score-flash' : ''
              }`}>
                {game.teamA.score}
              </div>
              <div className="flex gap-1 mt-1 text-xs">
                <div className="flex-1 text-center">
                  <div className="text-zinc-600">F</div>
                  <div className="text-white font-mono">{game.teamA.fouls}</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-zinc-600">TO</div>
                  <div className="text-white font-mono">{game.teamA.timeouts}</div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: CLOCKS */}
          <div className="col-span-6 flex flex-col gap-1">
            {/* Game Clock */}
            <div className="flex-1 metal-panel-inset flex flex-col items-center justify-center p-2">
              <div className="text-xs text-zinc-500 font-bold mb-1">PERIOD {game.gameState.period}</div>
              <div className={`digital-display text-6xl mb-2 ${
                game.gameState.gameRunning ? 'text-green-500' : 'text-zinc-600'
              }`}>
                {formatTime(game.gameState.gameTime.minutes, game.gameState.gameTime.seconds)}
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={onToggleClock}
                  className={`flex-1 hw-button py-2 text-sm ${
                    game.gameState.gameRunning ? 'hw-button-red' : 'hw-button-green'
                  }`}
                >
                  {game.gameState.gameRunning ? '⏸ STOP' : '▶ START'}
                </button>
              </div>
            </div>

            {/* Shot Clock */}
            <div className="metal-panel-inset p-2 flex items-center justify-between">
              <div className="flex-1 text-center">
                <div className="text-xs text-zinc-500 font-bold mb-1">SHOT</div>
                <div className={`digital-display text-4xl ${
                  game.gameState.shotClock <= 5 && game.gameState.shotClock > 0 ? 'text-red-500 animate-pulse' : 'text-amber-500'
                }`}>
                  {game.gameState.shotClock}
                </div>
              </div>
              <div className="flex flex-col gap-1 ml-2">
                <button onClick={() => onResetShotClock(24)} className="hw-button hw-button-sm px-3 py-1">24</button>
                <button onClick={() => onResetShotClock(14)} className="hw-button hw-button-sm px-3 py-1">14</button>
              </div>
            </div>
          </div>

          {/* RIGHT: TEAM B SCORE */}
          <div className="col-span-3 flex flex-col gap-1">
            <div className="metal-panel p-2">
              <div className="text-xs font-bold text-red-400 uppercase truncate mb-1 text-right">{game.teamB.name}</div>
              <div className={`digital-display digital-display-team-b text-5xl text-center py-2 ${
                flashingTeam === 'B' ? 'animate-score-flash' : ''
              }`}>
                {game.teamB.score}
              </div>
              <div className="flex gap-1 mt-1 text-xs">
                <div className="flex-1 text-center">
                  <div className="text-zinc-600">F</div>
                  <div className="text-white font-mono">{game.teamB.fouls}</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-zinc-600">TO</div>
                  <div className="text-white font-mono">{game.teamB.timeouts}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================
            ROW 2: ACTION BUTTONS
            ============================================ */}
        <div className="grid grid-cols-12 gap-2">
          
          {/* TEAM A ACTIONS */}
          <div className="col-span-3 grid grid-cols-2 gap-1">
            <button onClick={() => handleScoreAction('A', 3)} className="hw-button hw-button-blue text-2xl font-black">+3</button>
            <button onClick={() => handleScoreAction('A', 2)} className="hw-button hw-button-blue text-2xl font-black">+2</button>
            <button onClick={() => handleScoreAction('A', 1)} className="hw-button text-lg" style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>+1</button>
            <button onClick={() => handleScoreAction('A', -1)} className="hw-button text-lg" style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>-1</button>
            <button onClick={() => onAction('A', 'foul', 1)} className="hw-button hw-button-amber text-xs">FOUL</button>
            <button onClick={() => onAction('A', 'timeout', -1)} className="hw-button hw-button-amber text-xs">T.O.</button>
          </div>

          {/* CENTER CONTROLS */}
          <div className="col-span-6 grid grid-cols-4 gap-1">
            {/* Undo/Redo */}
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="hw-button text-xs col-span-1"
            >
              ↶<br/>UNDO
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="hw-button text-xs col-span-1"
            >
              ↷<br/>REDO
            </button>

            {/* Possession */}
            <button
              onClick={onTogglePossession}
              className="hw-button text-xs col-span-1"
            >
              {game.gameState.possession === 'A' ? '◀' : '▶'}<br/>POSS
            </button>

            {/* Next Period */}
            <button
              onClick={() => {
                if (confirm(`End Q${game.gameState.period} and start Q${game.gameState.period + 1}?`)) {
                  onNextPeriod();
                  vibrate([100, 50, 100]);
                }
              }}
              className="hw-button hw-button-amber text-xs col-span-1"
            >
              ⏭<br/>NEXT Q
            </button>
          </div>

          {/* TEAM B ACTIONS */}
          <div className="col-span-3 grid grid-cols-2 gap-1">
            <button onClick={() => handleScoreAction('B', 3)} className="hw-button hw-button-red text-2xl font-black">+3</button>
            <button onClick={() => handleScoreAction('B', 2)} className="hw-button hw-button-red text-2xl font-black">+2</button>
            <button onClick={() => handleScoreAction('B', 1)} className="hw-button text-lg" style={{ borderColor: '#ef4444', color: '#ef4444' }}>+1</button>
            <button onClick={() => handleScoreAction('B', -1)} className="hw-button text-lg" style={{ borderColor: '#ef4444', color: '#ef4444' }}>-1</button>
            <button onClick={() => onAction('B', 'foul', 1)} className="hw-button hw-button-amber text-xs">FOUL</button>
            <button onClick={() => onAction('B', 'timeout', -1)} className="hw-button hw-button-amber text-xs">T.O.</button>
          </div>
        </div>
      </div>

      {/* OFFLINE QUEUE INDICATOR (COMPACT) */}
      {offlineQueue.length > 0 && (
        <div className="bg-amber-900/20 border-t border-amber-900/50 px-4 py-1 flex items-center justify-center gap-2">
          <div className="led-indicator led-on-amber w-2 h-2 animate-pulse"></div>
          <span className="text-amber-500 font-bold text-xs">
            {offlineQueue.length} ACTION{offlineQueue.length > 1 ? 'S' : ''} PENDING SYNC
          </span>
        </div>
      )}
    </div>
  );
};