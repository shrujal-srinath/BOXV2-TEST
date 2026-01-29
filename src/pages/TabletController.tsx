// src/pages/TabletController.tsx (UPDATED)
/**
 * TABLET CONTROLLER (UPDATED)
 * Now works with BOTH local games and cloud games seamlessly
 * Auto-detects game type based on ID prefix
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../styles/hardware.css';
import { BootSequence } from '../features/tablet/BootSequence';
import { HardwareUI } from '../features/tablet/HardwareUI';
import { StatusBar } from '../features/tablet/StatusBar';
import { DiagnosticConsole } from '../features/tablet/DiagnosticConsole';

// Cloud imports
import { subscribeToGame } from '../services/gameService';
import { saveGameAction, loadLocalGame } from '../services/hybridService';

// Local imports
import { useLocalGame, useLocalGameTimer } from '../hooks/useLocalGame';
import { getSyncStatus } from '../services/syncService';

import type { BasketballGame } from '../types';

export const TabletController: React.FC = () => {
  const { gameCode } = useParams();
  const [isBooting, setIsBooting] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [tapTimer, setTapTimer] = useState<number | null>(null);

  // ============================================
  // GAME TYPE DETECTION
  // ============================================

  const isLocalGame = gameCode?.startsWith('LOCAL-');

  // ============================================
  // LOCAL GAME MODE
  // ============================================

  const localGameHook = useLocalGame(gameCode || '');
  useLocalGameTimer(gameCode || ''); // Auto-manages timer

  // ============================================
  // CLOUD GAME MODE (Existing)
  // ============================================

  const [cloudGame, setCloudGame] = useState<BasketballGame | null>(null);
  const [cloudTimerRef, setCloudTimerRef] = useState<number | null>(null);

  useEffect(() => {
    if (!gameCode || isLocalGame) return;

    // Try local load first (instant)
    const local = loadLocalGame();
    if (local && local.code === gameCode) {
      setCloudGame(local);
    }

    // Subscribe to cloud updates
    const unsubscribe = subscribeToGame(gameCode, (cloudData) => {
      setCloudGame(cloudData);
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, [gameCode, isLocalGame]);

  // Cloud timer (existing logic)
  useEffect(() => {
    if (isLocalGame || !cloudGame || !cloudGame.gameState.gameRunning) {
      if (cloudTimerRef) {
        clearInterval(cloudTimerRef);
        setCloudTimerRef(null);
      }
      return;
    }

    const interval = window.setInterval(() => {
      const newGame = JSON.parse(JSON.stringify(cloudGame));
      const totalSec = newGame.gameState.gameTime.minutes * 60 + newGame.gameState.gameTime.seconds;

      if (totalSec > 0) {
        const newTotal = totalSec - 1;
        newGame.gameState.gameTime.minutes = Math.floor(newTotal / 60);
        newGame.gameState.gameTime.seconds = newTotal % 60;

        if (newGame.gameState.shotClock > 0) {
          newGame.gameState.shotClock = Math.max(0, newGame.gameState.shotClock - 1);
        }

        setCloudGame(newGame);
        saveGameAction(newGame);
      } else {
        newGame.gameState.gameRunning = false;
        setCloudGame(newGame);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      }
    }, 1000);

    setCloudTimerRef(interval);
    return () => clearInterval(interval);
  }, [cloudGame?.gameState.gameRunning, isLocalGame]);

  // ============================================
  // UNIFIED GAME INTERFACE
  // ============================================

  // Use local or cloud game based on type
  const game = isLocalGame ? localGameHook.game : cloudGame;

  // Unified handlers
  const handleAction = (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', val: number) => {
    if (isLocalGame) {
      if (type === 'points') localGameHook.updateScore(team, val);
      else if (type === 'foul') localGameHook.updateFouls(team, val);
      else if (type === 'timeout') localGameHook.updateTimeouts(team, val);
    } else {
      // Cloud mode (existing logic)
      const newGame = JSON.parse(JSON.stringify(cloudGame));
      if (type === 'points') {
        if (team === 'A') newGame.teamA.score = Math.max(0, newGame.teamA.score + val);
        else newGame.teamB.score = Math.max(0, newGame.teamB.score + val);
      }
      if (type === 'foul') {
        if (team === 'A') newGame.teamA.fouls = Math.max(0, newGame.teamA.fouls + val);
        else newGame.teamB.fouls = Math.max(0, newGame.teamB.fouls + val);
      }
      if (type === 'timeout') {
        if (team === 'A') newGame.teamA.timeouts = Math.max(0, Math.min(7, newGame.teamA.timeouts + val));
        else newGame.teamB.timeouts = Math.max(0, Math.min(7, newGame.teamB.timeouts + val));
      }
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }
  };

  const handleToggleClock = () => {
    if (isLocalGame) {
      localGameHook.toggleClock();
    } else {
      const newGame = JSON.parse(JSON.stringify(cloudGame));
      newGame.gameState.gameRunning = !newGame.gameState.gameRunning;
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }
  };

  const handleResetShotClock = (seconds: number) => {
    if (isLocalGame) {
      localGameHook.resetShotClock(seconds);
    } else {
      const newGame = JSON.parse(JSON.stringify(cloudGame));
      newGame.gameState.shotClock = seconds;
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }
  };

  const handleTogglePossession = () => {
    if (isLocalGame) {
      localGameHook.togglePossession();
    } else {
      const newGame = JSON.parse(JSON.stringify(cloudGame));
      newGame.gameState.possession = newGame.gameState.possession === 'A' ? 'B' : 'A';
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }
  };

  const handleNextPeriod = () => {
    if (isLocalGame) {
      localGameHook.nextPeriod();
    } else {
      const newGame = JSON.parse(JSON.stringify(cloudGame));
      newGame.gameState.period = (newGame.gameState.period % 4) + 1;
      newGame.gameState.gameTime.minutes = newGame.settings.periodDuration;
      newGame.gameState.gameTime.seconds = 0;
      newGame.gameState.shotClock = newGame.settings.shotClockDuration;
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }
  };

  // ============================================
  // TRIPLE-TAP DETECTION
  // ============================================

  const handleTripleTap = () => {
    if (tapTimer) clearTimeout(tapTimer);

    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount === 3) {
      setShowDiagnostics(!showDiagnostics);
      setTapCount(0);
      return;
    }

    const timer = setTimeout(() => {
      setTapCount(0);
    }, 500);
    setTapTimer(timer);
  };

  // ============================================
  // SYNC QUEUE (for status bar)
  // ============================================

  const [syncQueue, setSyncQueue] = useState<any[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const status = getSyncStatus();
      setSyncQueue(Array(status.pendingCount).fill({}));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ============================================
  // LOADING STATE
  // ============================================

  if (!game) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="led-indicator led-on-amber mx-auto mb-4"></div>
          <p className="embossed-label">INITIALIZING HARDWARE INTERFACE...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Boot Sequence */}
      {isBooting && <BootSequence onComplete={() => setIsBooting(false)} />}

      {/* Main UI */}
      {!isBooting && (
        <>
          <StatusBar syncPending={syncQueue.length} lastSyncTime={game.lastUpdate} />

          <div onClick={handleTripleTap}>
            <HardwareUI
              game={game}
              onAction={handleAction}
              onToggleClock={handleToggleClock}
              onResetShotClock={handleResetShotClock}
              onTogglePossession={handleTogglePossession}
              onNextPeriod={handleNextPeriod}
              onOpenDiagnostics={() => setShowDiagnostics(!showDiagnostics)}
            />
          </div>

          {/* Diagnostic Console */}
          {showDiagnostics && (
            <DiagnosticConsole
              game={game}
              syncQueue={syncQueue}
              isOpen={showDiagnostics}
              onClose={() => setShowDiagnostics(false)}
            />
          )}
        </>
      )}
    </>
  );
};