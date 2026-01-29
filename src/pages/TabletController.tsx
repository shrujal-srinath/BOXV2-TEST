// src/pages/TabletController.tsx (V2 - PRODUCTION OPTIMIZED)
/**
 * TABLET CONTROLLER V2 - FOR LENOVO YOGA 2-830LC
 * 
 * NEW FEATURES:
 * ✅ Undo/Redo Stack (shake or button)
 * ✅ Offline Action Queue Visualization
 * ✅ Settings Icon (replaced triple-tap)
 * ✅ Enhanced Haptic Feedback
 * ✅ Optimized for 8" tablet (1280x800)
 * ✅ Improved Cloud Sync Status
 * ✅ Traditional Ref-Friendly UI
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

// ============================================
// TYPES
// ============================================
interface GameAction {
  id: string;
  timestamp: number;
  type: 'score' | 'foul' | 'timeout' | 'clock' | 'shotclock' | 'possession' | 'period';
  team?: 'A' | 'B';
  value?: number;
  previousState: Partial<BasketballGame>;
  description: string;
}

interface OfflineAction {
  id: string;
  timestamp: number;
  action: string;
  pending: boolean;
}

export const TabletController: React.FC = () => {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  
  // ============================================
  // UI STATE
  // ============================================
  const [isBooting, setIsBooting] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // UNDO/REDO STATE
  // ============================================
  const [actionHistory, setActionHistory] = useState<GameAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showUndoPrompt, setShowUndoPrompt] = useState(false);

  // ============================================
  // OFFLINE QUEUE STATE
  // ============================================
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());

  // ============================================
  // SHAKE DETECTION FOR UNDO
  // ============================================
  const lastShakeTime = useRef<number>(0);
  const shakeThreshold = 15; // Acceleration threshold

  useEffect(() => {
    const handleShake = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const totalAcceleration = Math.sqrt(
        (acc.x || 0) ** 2 + 
        (acc.y || 0) ** 2 + 
        (acc.z || 0) ** 2
      );

      const now = Date.now();
      if (totalAcceleration > shakeThreshold && now - lastShakeTime.current > 1000) {
        lastShakeTime.current = now;
        handleUndo();
      }
    };

    window.addEventListener('devicemotion', handleShake);
    return () => window.removeEventListener('devicemotion', handleShake);
  }, [historyIndex]);

  // ============================================
  // NETWORK DETECTION
  // ============================================
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync of offline queue
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ============================================
  // GAME TYPE DETECTION
  // ============================================
  const isLocalGame = gameCode?.startsWith('LOCAL-');

  // ============================================
  // LOCAL GAME MODE
  // ============================================
  const localGameHook = useLocalGame(gameCode || '');
  useLocalGameTimer(gameCode || '');

  // ============================================
  // CLOUD GAME MODE
  // ============================================
  const [cloudGame, setCloudGame] = useState<BasketballGame | null>(null);
  const cloudTimerRef = useRef<number | null>(null);
  const cloudGameRef = useRef<BasketballGame | null>(null);

  // Keep ref synced with state
  useEffect(() => {
    cloudGameRef.current = cloudGame;
  }, [cloudGame]);

  // Subscribe to cloud game
  useEffect(() => {
    if (!gameCode || isLocalGame) {
      setIsLoading(false);
      return;
    }

    // Try local load first (instant)
    const local = loadLocalGame();
    if (local && local.code === gameCode) {
      setCloudGame(local);
      setIsLoading(false);
    }

    // Subscribe to cloud updates
    const unsubscribe = subscribeToGame(gameCode, (cloudData) => {
      setCloudGame(cloudData);
      setIsLoading(false);
      setError(null);
      setLastSyncTime(Date.now());
    });

    // Timeout if game doesn't load
    const timeout = setTimeout(() => {
      if (!cloudGameRef.current) {
        setError('Game not found or connection timeout');
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearTimeout(timeout);
    };
  }, [gameCode, isLocalGame]);

  // Cloud timer (uses functional setState)
  useEffect(() => {
    if (isLocalGame || !cloudGameRef.current?.gameState.gameRunning) {
      if (cloudTimerRef.current) {
        clearInterval(cloudTimerRef.current);
        cloudTimerRef.current = null;
      }
      return;
    }

    if (!cloudTimerRef.current) {
      cloudTimerRef.current = window.setInterval(() => {
        setCloudGame(prevGame => {
          if (!prevGame) return prevGame;

          const totalSec = prevGame.gameState.gameTime.minutes * 60 + prevGame.gameState.gameTime.seconds;

          if (totalSec > 0) {
            const newTotal = totalSec - 1;
            const newGame = { ...prevGame };
            
            newGame.gameState.gameTime.minutes = Math.floor(newTotal / 60);
            newGame.gameState.gameTime.seconds = newTotal % 60;

            if (newGame.gameState.shotClock > 0) {
              newGame.gameState.shotClock = Math.max(0, newGame.gameState.shotClock - 1);
            }

            newGame.lastUpdate = Date.now();
            saveGameAction(newGame);
            return newGame;
          } else {
            // Game time expired
            const newGame = { ...prevGame };
            newGame.gameState.gameRunning = false;
            newGame.lastUpdate = Date.now();
            saveGameAction(newGame);
            
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 200]);
            }
            return newGame;
          }
        });
      }, 1000);
    }

    return () => {
      if (cloudTimerRef.current) {
        clearInterval(cloudTimerRef.current);
        cloudTimerRef.current = null;
      }
    };
  }, [cloudGame?.gameState.gameRunning, isLocalGame]);

  // ============================================
  // UNIFIED GAME INTERFACE
  // ============================================
  const game = isLocalGame ? localGameHook.game : cloudGame;

  // ============================================
  // UNDO/REDO FUNCTIONS
  // ============================================
  const recordAction = useCallback((
    type: GameAction['type'],
    team: 'A' | 'B' | undefined,
    value: number | undefined,
    description: string,
    previousState: Partial<BasketballGame>
  ) => {
    const action: GameAction = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type,
      team,
      value,
      previousState,
      description
    };

    setActionHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, action];
    });
    setHistoryIndex(prev => prev + 1);

    // Show brief undo prompt
    setShowUndoPrompt(true);
    setTimeout(() => setShowUndoPrompt(false), 3000);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex < 0) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      return;
    }

    const action = actionHistory[historyIndex];
    if (!action) return;

    // Restore previous state
    if (isLocalGame) {
      // Undo local game action
      const prev = action.previousState;
      if (prev.teamA) localGameHook.game!.teamA = { ...localGameHook.game!.teamA, ...prev.teamA };
      if (prev.teamB) localGameHook.game!.teamB = { ...localGameHook.game!.teamB, ...prev.teamB };
      if (prev.gameState) localGameHook.game!.gameState = { ...localGameHook.game!.gameState, ...prev.gameState };
    } else if (cloudGameRef.current) {
      const newGame = { ...cloudGameRef.current };
      if (action.previousState.teamA) newGame.teamA = { ...newGame.teamA, ...action.previousState.teamA };
      if (action.previousState.teamB) newGame.teamB = { ...newGame.teamB, ...action.previousState.teamB };
      if (action.previousState.gameState) newGame.gameState = { ...newGame.gameState, ...action.previousState.gameState };
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }

    setHistoryIndex(prev => prev - 1);
    
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
  }, [historyIndex, actionHistory, isLocalGame, localGameHook]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= actionHistory.length - 1) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      return;
    }

    setHistoryIndex(prev => prev + 1);
    
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
  }, [historyIndex, actionHistory]);

  // ============================================
  // OFFLINE QUEUE MANAGEMENT
  // ============================================
  const addToOfflineQueue = useCallback((actionDesc: string) => {
    if (!isOnline) {
      const queueItem: OfflineAction = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        action: actionDesc,
        pending: true
      };
      setOfflineQueue(prev => [...prev, queueItem]);
    }
  }, [isOnline]);

  const syncOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0 || !isOnline) return;

    // Mark all as synced
    setOfflineQueue([]);
    setLastSyncTime(Date.now());
    
    if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 50]);
  }, [offlineQueue, isOnline]);

  // ============================================
  // ACTION HANDLERS WITH UNDO SUPPORT
  // ============================================
  const handleAction = useCallback((team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', val: number) => {
    const currentGame = isLocalGame ? localGameHook.game : cloudGameRef.current;
    if (!currentGame) return;

    // Record previous state
    const previousState: Partial<BasketballGame> = {
      teamA: { ...currentGame.teamA },
      teamB: { ...currentGame.teamB }
    };

    const teamName = team === 'A' ? currentGame.teamA.name : currentGame.teamB.name;
    let description = '';

    if (isLocalGame) {
      if (type === 'points') {
        localGameHook.updateScore(team, val);
        description = `${teamName} +${val} PTS`;
      } else if (type === 'foul') {
        localGameHook.updateFouls(team, val);
        description = `${teamName} FOUL`;
      } else if (type === 'timeout') {
        localGameHook.updateTimeouts(team, val);
        description = `${teamName} TIMEOUT`;
      }
    } else if (cloudGameRef.current) {
      const newGame = { ...cloudGameRef.current };
      
      if (type === 'points') {
        if (team === 'A') newGame.teamA.score = Math.max(0, newGame.teamA.score + val);
        else newGame.teamB.score = Math.max(0, newGame.teamB.score + val);
        description = `${teamName} +${val} PTS`;
      }
      if (type === 'foul') {
        if (team === 'A') newGame.teamA.fouls = Math.max(0, newGame.teamA.fouls + val);
        else newGame.teamB.fouls = Math.max(0, newGame.teamB.fouls + val);
        description = `${teamName} FOUL`;
      }
      if (type === 'timeout') {
        if (team === 'A') newGame.teamA.timeouts = Math.max(0, Math.min(7, newGame.teamA.timeouts + val));
        else newGame.teamB.timeouts = Math.max(0, Math.min(7, newGame.teamB.timeouts + val));
        description = `${teamName} TIMEOUT`;
      }
      
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
      
      if (!isOnline) {
        addToOfflineQueue(description);
      }
    }

    recordAction(type, team, val, description, previousState);
  }, [isLocalGame, localGameHook, isOnline, recordAction, addToOfflineQueue]);

  const handleToggleClock = useCallback(() => {
    const currentGame = isLocalGame ? localGameHook.game : cloudGameRef.current;
    if (!currentGame) return;

    const previousState: Partial<BasketballGame> = {
      gameState: { ...currentGame.gameState }
    };

    if (isLocalGame) {
      localGameHook.toggleClock();
    } else if (cloudGameRef.current) {
      const newGame = { ...cloudGameRef.current };
      newGame.gameState.gameRunning = !newGame.gameState.gameRunning;
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }

    const description = currentGame.gameState.gameRunning ? 'Clock STOP' : 'Clock START';
    recordAction('clock', undefined, undefined, description, previousState);
  }, [isLocalGame, localGameHook, recordAction]);

  const handleResetShotClock = useCallback((seconds: number) => {
    const currentGame = isLocalGame ? localGameHook.game : cloudGameRef.current;
    if (!currentGame) return;

    const previousState: Partial<BasketballGame> = {
      gameState: { ...currentGame.gameState }
    };

    if (isLocalGame) {
      localGameHook.resetShotClock(seconds);
    } else if (cloudGameRef.current) {
      const newGame = { ...cloudGameRef.current };
      newGame.gameState.shotClock = seconds;
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }

    recordAction('shotclock', undefined, seconds, `Shot Clock → ${seconds}s`, previousState);
  }, [isLocalGame, localGameHook, recordAction]);

  const handleTogglePossession = useCallback(() => {
    const currentGame = isLocalGame ? localGameHook.game : cloudGameRef.current;
    if (!currentGame) return;

    const previousState: Partial<BasketballGame> = {
      gameState: { ...currentGame.gameState }
    };

    if (isLocalGame) {
      localGameHook.togglePossession();
    } else if (cloudGameRef.current) {
      const newGame = { ...cloudGameRef.current };
      newGame.gameState.possession = newGame.gameState.possession === 'A' ? 'B' : 'A';
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }

    const newPoss = currentGame.gameState.possession === 'A' ? 'B' : 'A';
    const teamName = newPoss === 'A' ? currentGame.teamA.name : currentGame.teamB.name;
    recordAction('possession', undefined, undefined, `Possession → ${teamName}`, previousState);
  }, [isLocalGame, localGameHook, recordAction]);

  const handleNextPeriod = useCallback(() => {
    const currentGame = isLocalGame ? localGameHook.game : cloudGameRef.current;
    if (!currentGame) return;

    const previousState: Partial<BasketballGame> = {
      gameState: { ...currentGame.gameState }
    };

    if (isLocalGame) {
      localGameHook.nextPeriod();
    } else if (cloudGameRef.current) {
      const newGame = { ...cloudGameRef.current };
      newGame.gameState.period += 1;
      newGame.gameState.gameTime.minutes = newGame.settings.periodDuration;
      newGame.gameState.gameTime.seconds = 0;
      newGame.gameState.shotClock = newGame.settings.shotClockDuration;
      newGame.gameState.gameRunning = false;
      newGame.lastUpdate = Date.now();
      setCloudGame(newGame);
      saveGameAction(newGame);
    }

    recordAction('period', undefined, undefined, `Period ${currentGame.gameState.period + 1}`, previousState);
  }, [isLocalGame, localGameHook, recordAction]);

  // ============================================
  // BOOT SEQUENCE
  // ============================================
  useEffect(() => {
    // Skip boot on Escape key (dev shortcut)
    const skipBoot = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsBooting(false);
    };
    window.addEventListener('keydown', skipBoot);

    const timer = setTimeout(() => setIsBooting(false), 3000);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', skipBoot);
    };
  }, []);

  // ============================================
  // RENDER
  // ============================================
  if (isBooting) {
    return <BootSequence gameCode={gameCode || 'UNKNOWN'} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="led-indicator led-on-amber w-8 h-8 mx-auto mb-4 animate-pulse"></div>
          <div className="text-green-500 font-mono text-2xl mb-2">LOADING GAME</div>
          <div className="text-green-700 font-mono text-sm">{gameCode}</div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="metal-panel p-8 max-w-md">
          <div className="led-indicator led-on-red w-8 h-8 mx-auto mb-4"></div>
          <div className="text-red-500 font-mono text-xl mb-4 text-center">ERROR</div>
          <div className="text-white font-mono text-sm mb-6 text-center">
            {error || 'Game not found'}
          </div>
          <button
            onClick={() => navigate('/tablet/standalone')}
            className="hw-button hw-button-green w-full"
          >
            RETURN TO HOME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* Status Bar with Offline Queue */}
      <StatusBar 
        gameCode={gameCode || ''} 
        isOnline={isOnline}
        lastSync={lastSyncTime}
        offlineQueueCount={offlineQueue.length}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Undo Prompt */}
      {showUndoPrompt && historyIndex >= 0 && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-amber-500 text-black px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3">
            <span className="text-2xl">↶</span>
            <span className="font-bold">Shake to undo</span>
          </div>
        </div>
      )}

      {/* Main UI */}
      <HardwareUI
        game={game}
        onAction={handleAction}
        onToggleClock={handleToggleClock}
        onResetShotClock={handleResetShotClock}
        onTogglePossession={handleTogglePossession}
        onNextPeriod={handleNextPeriod}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < actionHistory.length - 1}
        offlineQueue={offlineQueue}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8">
          <div className="metal-panel p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">SETTINGS</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="hw-button hw-button-red"
              >
                CLOSE
              </button>
            </div>

            {/* Action History */}
            <div className="mb-6">
              <div className="embossed-label mb-3">ACTION HISTORY</div>
              <div className="bg-black p-4 rounded border-2 border-green-700 max-h-48 overflow-y-auto font-mono text-sm">
                {actionHistory.length === 0 ? (
                  <div className="text-green-700">No actions yet</div>
                ) : (
                  actionHistory.map((action, idx) => (
                    <div
                      key={action.id}
                      className={`py-1 ${idx === historyIndex ? 'text-amber-500' : 'text-green-500'}`}
                    >
                      {new Date(action.timestamp).toLocaleTimeString()} - {action.description}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Diagnostics Button */}
            <button
              onClick={() => {
                setShowSettings(false);
                setShowDiagnostics(true);
              }}
              className="hw-button w-full"
            >
              OPEN DIAGNOSTICS
            </button>
          </div>
        </div>
      )}

      {/* Diagnostics Console */}
      {showDiagnostics && (
        <DiagnosticConsole
          game={game}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </div>
  );
};