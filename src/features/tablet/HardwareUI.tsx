// src/features/tablet/HardwareUI.tsx (V3 - PRODUCTION READY)
/**
 * HARDWARE UI - PRODUCTION TABLET INTERFACE
 * 
 * Optimized for iPad 7.9" - 12.9"
 * Landscape orientation required
 * 
 * FEATURES:
 * ✅ Large touch targets (60px+)
 * ✅ Clear visual hierarchy
 * ✅ Team color coding
 * ✅ Haptic feedback
 * ✅ Score change animations
 * ✅ Responsive sizing
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  const [showShotClockMenu, setShowShotClockMenu] = useState(false);

  // Vibrate helper
  const vibrate = useCallback((pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  // Flash score on change
  const handleScoreAction = useCallback((team: 'A' | 'B', value: number) => {
    onAction(team, 'points', value);
    setFlashingTeam(team);
    vibrate(value > 0 ? [30, 10, 30] : [50]);
    setTimeout(() => setFlashingTeam(null), 300);
  }, [onAction, vibrate]);

  // Format time display
  const formatTime = (minutes: number, seconds: number): string => {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format shot clock
  const formatShotClock = (seconds: number): string => {
    return seconds.toString();
  };

  return (
    <div className="flex-1 flex flex-col bg-black">
      
      {/* ============================================
          MAIN GAME AREA - 3 COLUMNS
          ============================================ */}
      <div className="flex-1 flex gap-4 p-4">
        
        {/* ============================================
            LEFT COLUMN - TEAM A CONTROLS
            ============================================ */}
        <div className="flex-1 flex flex-col gap-4">
          
          {/* Team A Header */}
          <div className="metal-panel p-4">
            <div className="embossed-label mb-2">TEAM A - HOME</div>
            <div className="text-2xl font-black text-blue-400 uppercase truncate">
              {game.teamA.name}
            </div>
          </div>

          {/* Team A Score Display */}
          <div className={`metal-panel-inset flex-1 flex items-center justify-center ${
            flashingTeam === 'A' ? 'animate-score-flash' : ''
          }`}>
            <div className="digital-display digital-display-team-a digital-display-large">
              {game.teamA.score}
            </div>
          </div>

          {/* Team A Score Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleScoreAction('A', 3)}
              className="hw-button hw-button-xl hw-button-blue"
              style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' }}
            >
              +3
            </button>
            <button
              onClick={() => handleScoreAction('A', 2)}
              className="hw-button hw-button-xl hw-button-blue"
              style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' }}
            >
              +2
            </button>
            <button
              onClick={() => handleScoreAction('A', 1)}
              className="hw-button hw-button-lg"
              style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
            >
              +1
            </button>
            <button
              onClick={() => handleScoreAction('A', -1)}
              className="hw-button hw-button-lg"
              style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
            >
              -1
            </button>
          </div>

          {/* Team A Stats */}
          <div className="metal-panel p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Fouls */}
              <div>
                <div className="embossed-label mb-2">FOULS</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onAction('A', 'foul', -1);
                      vibrate(30);
                    }}
                    className="hw-button hw-button-sm"
                    disabled={game.teamA.fouls === 0}
                  >
                    -
                  </button>
                  <div className="digital-display digital-display-small flex-1 text-center">
                    {game.teamA.fouls}
                  </div>
                  <button
                    onClick={() => {
                      onAction('A', 'foul', 1);
                      vibrate([30, 20, 30]);
                    }}
                    className="hw-button hw-button-sm hw-button-amber"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Timeouts */}
              <div>
                <div className="embossed-label mb-2">TIMEOUTS</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onAction('A', 'timeout', -1);
                      vibrate(30);
                    }}
                    className="hw-button hw-button-sm"
                    disabled={game.teamA.timeouts === 0}
                  >
                    -
                  </button>
                  <div className="digital-display digital-display-small flex-1 text-center">
                    {game.teamA.timeouts}
                  </div>
                  <button
                    onClick={() => {
                      onAction('A', 'timeout', 1);
                      vibrate([40, 20, 40, 20, 40]);
                    }}
                    className="hw-button hw-button-sm hw-button-blue"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================
            CENTER COLUMN - GAME CONTROLS
            ============================================ */}
        <div className="w-[400px] flex flex-col gap-4">
          
          {/* Period Display */}
          <div className="metal-panel p-4 text-center">
            <div className="embossed-label mb-2">PERIOD</div>
            <div className="digital-display digital-display-medium">
              Q{game.gameState.period}
            </div>
          </div>

          {/* Game Clock */}
          <div className="metal-panel-inset flex-1 flex flex-col items-center justify-center p-6">
            <div className="embossed-label mb-3">GAME CLOCK</div>
            <div className="digital-display digital-display-large mb-6">
              {formatTime(game.gameState.gameTime.minutes, game.gameState.gameTime.seconds)}
            </div>
            
            {/* Clock Control */}
            <button
              onClick={() => {
                onToggleClock();
                vibrate(50);
              }}
              className={`hw-button hw-button-lg w-full ${
                game.gameState.gameRunning ? 'hw-button-red' : 'hw-button-green'
              }`}
            >
              {game.gameState.gameRunning ? '⏸ STOP' : '▶ START'}
            </button>
          </div>

          {/* Shot Clock */}
          <div className="metal-panel-inset p-6 relative">
            <div className="embossed-label mb-3 text-center">SHOT CLOCK</div>
            <div className={`digital-display digital-display-medium text-center mb-4 ${
              game.gameState.shotClock <= 5 && game.gameState.shotClock > 0 ? 'animate-pulse text-red-500' : ''
            }`}>
              {formatShotClock(game.gameState.shotClock)}
            </div>
            
            {/* Shot Clock Quick Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onResetShotClock(24);
                  vibrate(30);
                }}
                className="hw-button hw-button-sm"
              >
                24
              </button>
              <button
                onClick={() => {
                  onResetShotClock(14);
                  vibrate(30);
                }}
                className="hw-button hw-button-sm"
              >
                14
              </button>
              <button
                onClick={() => setShowShotClockMenu(true)}
                className="hw-button hw-button-sm hw-button-amber"
              >
                ⚙
              </button>
            </div>
          </div>

          {/* Possession Indicator */}
          <div className="metal-panel p-4">
            <div className="embossed-label mb-3 text-center">POSSESSION</div>
            <button
              onClick={() => {
                onTogglePossession();
                vibrate(40);
              }}
              className="w-full hw-button hw-button-lg"
            >
              {game.gameState.possession === 'A' ? (
                <span className="text-blue-400">◀ {game.teamA.name}</span>
              ) : (
                <span className="text-red-400">{game.teamB.name} ▶</span>
              )}
            </button>
          </div>

          {/* Period Control */}
          <button
            onClick={() => {
              if (confirm(`End Q${game.gameState.period} and start Q${game.gameState.period + 1}?`)) {
                onNextPeriod();
                vibrate([100, 50, 100]);
              }
            }}
            className="hw-button hw-button-lg hw-button-amber"
          >
            ⏭ NEXT PERIOD
          </button>
        </div>

        {/* ============================================
            RIGHT COLUMN - TEAM B CONTROLS
            ============================================ */}
        <div className="flex-1 flex flex-col gap-4">
          
          {/* Team B Header */}
          <div className="metal-panel p-4">
            <div className="embossed-label mb-2">TEAM B - AWAY</div>
            <div className="text-2xl font-black text-red-400 uppercase truncate">
              {game.teamB.name}
            </div>
          </div>

          {/* Team B Score Display */}
          <div className={`metal-panel-inset flex-1 flex items-center justify-center ${
            flashingTeam === 'B' ? 'animate-score-flash' : ''
          }`}>
            <div className="digital-display digital-display-team-b digital-display-large">
              {game.teamB.score}
            </div>
          </div>

          {/* Team B Score Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleScoreAction('B', 3)}
              className="hw-button hw-button-xl hw-button-red"
              style={{ background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' }}
            >
              +3
            </button>
            <button
              onClick={() => handleScoreAction('B', 2)}
              className="hw-button hw-button-xl hw-button-red"
              style={{ background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' }}
            >
              +2
            </button>
            <button
              onClick={() => handleScoreAction('B', 1)}
              className="hw-button hw-button-lg"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              +1
            </button>
            <button
              onClick={() => handleScoreAction('B', -1)}
              className="hw-button hw-button-lg"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              -1
            </button>
          </div>

          {/* Team B Stats */}
          <div className="metal-panel p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Fouls */}
              <div>
                <div className="embossed-label mb-2">FOULS</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onAction('B', 'foul', -1);
                      vibrate(30);
                    }}
                    className="hw-button hw-button-sm"
                    disabled={game.teamB.fouls === 0}
                  >
                    -
                  </button>
                  <div className="digital-display digital-display-small flex-1 text-center">
                    {game.teamB.fouls}
                  </div>
                  <button
                    onClick={() => {
                      onAction('B', 'foul', 1);
                      vibrate([30, 20, 30]);
                    }}
                    className="hw-button hw-button-sm hw-button-amber"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Timeouts */}
              <div>
                <div className="embossed-label mb-2">TIMEOUTS</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onAction('B', 'timeout', -1);
                      vibrate(30);
                    }}
                    className="hw-button hw-button-sm"
                    disabled={game.teamB.timeouts === 0}
                  >
                    -
                  </button>
                  <div className="digital-display digital-display-small flex-1 text-center">
                    {game.teamB.timeouts}
                  </div>
                  <button
                    onClick={() => {
                      onAction('B', 'timeout', 1);
                      vibrate([40, 20, 40, 20, 40]);
                    }}
                    className="hw-button hw-button-sm hw-button-red"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
          BOTTOM CONTROLS - UNDO/REDO
          ============================================ */}
      <div className="bg-zinc-950 border-t-2 border-zinc-900 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          
          {/* Undo/Redo */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                onUndo();
                vibrate([60, 30, 60]);
              }}
              disabled={!canUndo}
              className="hw-button hw-button-lg"
              style={{ minWidth: '140px' }}
            >
              ↶ UNDO
            </button>
            <button
              onClick={() => {
                onRedo();
                vibrate([60, 30, 60]);
              }}
              disabled={!canRedo}
              className="hw-button hw-button-lg"
              style={{ minWidth: '140px' }}
            >
              ↷ REDO
            </button>
          </div>

          {/* Offline Queue Indicator */}
          {offlineQueue.length > 0 && (
            <div className="flex items-center gap-3 metal-panel px-6 py-3">
              <div className="led-indicator led-on-amber animate-pulse"></div>
              <div className="text-amber-500 font-bold text-sm">
                {offlineQueue.length} ACTION{offlineQueue.length > 1 ? 'S' : ''} PENDING SYNC
              </div>
            </div>
          )}

          {/* Shake to Undo Hint */}
          <div className="text-zinc-600 text-sm font-mono">
            💡 Shake device to undo
          </div>
        </div>
      </div>

      {/* ============================================
          SHOT CLOCK MENU MODAL
          ============================================ */}
      {showShotClockMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8">
          <div className="metal-panel p-8 max-w-md w-full">
            <h3 className="text-2xl font-black text-white mb-6">SHOT CLOCK</h3>
            
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[30, 24, 20, 18, 14, 10, 8, 5, 0].map(seconds => (
                <button
                  key={seconds}
                  onClick={() => {
                    onResetShotClock(seconds);
                    setShowShotClockMenu(false);
                    vibrate(30);
                  }}
                  className="hw-button hw-button-lg"
                >
                  {seconds}s
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowShotClockMenu(false)}
              className="hw-button hw-button-red w-full"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};