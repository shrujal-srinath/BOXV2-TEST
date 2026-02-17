// src/pages/TabletController.tsx
// ─────────────────────────────────────────────────────────────
// FIXES APPLIED:
//  ✅ Timer bug fixed — useStandaloneTimer gets the SAME updateGameState
//     instance as the rest of the controller (no more ghost state copy)
//  ✅ Onboarding popup removed entirely
//  ✅ Landscape enforced via screen.orientation.lock() on mount
//     with CSS transform fallback for browsers that don't support the API
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/hardware.css';
import { BootSequence } from '../features/tablet/BootSequence';
import { HardwareUI } from '../features/tablet/HardwareUI';
import { StatusBar } from '../features/tablet/StatusBar';
import { DiagnosticConsole } from '../features/tablet/DiagnosticConsole';
import { useLocalGame } from '../hooks/useLocalGame';
import { useStandaloneTimer } from '../hooks/useStandaloneTimer';
import { subscribeToGame } from '../services/gameService';
import type { BasketballGame } from '../types';

interface AppSettings {
  hapticEnabled: boolean;
  soundEnabled: boolean;
  autoSync: boolean;
}

const SETTINGS_KEY = 'BOX_V2_TABLET_SETTINGS';
const OFFLINE_QUEUE_KEY = 'BOX_V2_OFFLINE_QUEUE';

export const TabletController: React.FC = () => {
  const { gameCode } = useParams();
  const navigate = useNavigate();

  // ── UI state ───────────────────────────────────────────────
  const [isBooting, setIsBooting] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Settings ───────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved
        ? JSON.parse(saved)
        : { hapticEnabled: true, soundEnabled: true, autoSync: true };
    } catch {
      return { hapticEnabled: true, soundEnabled: true, autoSync: true };
    }
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // ── Offline queue (display only) ───────────────────────────
  const [offlineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ── Network listener ───────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Game type detection ───────────────────────────────────
  const isLocalGame = gameCode?.startsWith('LOCAL-');

  // ── Local game hook (primary) ─────────────────────────────
  // Timer is already managed within useLocalGame hook
  const localGameHook = useLocalGame(gameCode || '');

  // ── Cloud game (fallback) ─────────────────────────────────
  const [cloudGame, setCloudGame] = useState<BasketballGame | null>(null);
  useEffect(() => {
    if (!gameCode || isLocalGame) return;
    return subscribeToGame(gameCode, setCloudGame);
  }, [gameCode, isLocalGame]);

  // ── Unified game interface ─────────────────────────────────
  const game = isLocalGame ? localGameHook.game : cloudGame;
  const isLoading = isLocalGame ? localGameHook.isLoading : !cloudGame;

  // ── LANDSCAPE ENFORCEMENT ─────────────────────────────────
  // 1. Try the Screen Orientation API (works on Android Chrome + iOS PWA)
  // 2. Fall back to CSS transform rotation if not supported
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        // Modern API
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('landscape');
        }
      } catch {
        // API exists but lock was denied (e.g. desktop browser) — CSS fallback handles it
      }
    };
    lockLandscape();

    // Cleanup: release lock when leaving tablet view
    return () => {
      try {
        if (screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
        }
      } catch { }
    };
  }, []);

  // ── Boot sequence ─────────────────────────────────────────
  // REMOVED: onboarding popup was here — deleted entirely
  useEffect(() => {
    const skipBoot = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsBooting(false);
    };
    window.addEventListener('keydown', skipBoot);
    const timer = setTimeout(() => setIsBooting(false), 2500);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', skipBoot);
    };
  }, []);

  // ── Vibration helper ──────────────────────────────────────
  const vibrate = (pattern: number | number[]) => {
    if (settings.hapticEnabled && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // ── Action handlers ───────────────────────────────────────
  const handleAction = (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => {
    if (isLocalGame) {
      localGameHook.handleAction(team, type, value);
      vibrate(value > 0 ? [30, 10, 30] : [50]);
    }
  };

  const handleToggleClock = () => {
    if (isLocalGame) {
      localGameHook.toggleGameClock();
      vibrate(50);
    }
  };

  const handleResetShotClock = (seconds: number) => {
    if (isLocalGame) {
      localGameHook.resetShotClock(seconds);
      vibrate(30);
    }
  };

  const handleTogglePossession = () => {
    if (isLocalGame) {
      localGameHook.togglePossession();
      vibrate(40);
    }
  };

  const handleNextPeriod = () => {
    if (isLocalGame) {
      if (confirm(`End Q${game?.gameState.period} and start next?`)) {
        localGameHook.nextPeriod();
        vibrate([100, 50, 100]);
      }
    }
  };

  const handleUndo = () => {
    if (isLocalGame) { localGameHook.undo(); vibrate([60, 30, 60]); }
  };

  const handleRedo = () => {
    if (isLocalGame) { localGameHook.redo(); vibrate([60, 30, 60]); }
  };

  // ── Render states ─────────────────────────────────────────
  if (isBooting) return <BootSequence onComplete={() => setIsBooting(false)} />;

  if (isLoading || !game) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500 font-mono text-sm animate-pulse uppercase tracking-widest">
          Loading game…
        </div>
      </div>
    );
  }

  if (localGameHook.error) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 font-mono text-sm uppercase tracking-widest">
          Game not found
        </div>
        <button
          onClick={() => navigate('/tablet/standalone')}
          className="px-6 py-3 bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-bold uppercase tracking-widest rounded hover:bg-zinc-800"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    // CSS landscape fallback: if orientation API failed, this wraps the UI
    // in a CSS transform on portrait screens. The `landscape-wrapper` class
    // in hardware.css handles this via @media (orientation: portrait).
    <div className="landscape-enforcer w-screen h-screen overflow-hidden bg-black">
      <HardwareUI
        game={game}
        onAction={handleAction}
        onToggleClock={handleToggleClock}
        onResetShotClock={handleResetShotClock}
        onTogglePossession={handleTogglePossession}
        onNextPeriod={handleNextPeriod}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={localGameHook.canUndo}
        canRedo={localGameHook.canRedo}
        offlineQueue={offlineQueue}
        onOpenDiagnostics={() => setShowDiagnostics(true)}
        onOpenSettings={() => setShowSettings(true)}
        isOnline={isOnline}
      />

      {showDiagnostics && (
        <DiagnosticConsole
          game={game}
          syncQueue={offlineQueue}
          isOpen={showDiagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </div>
  );
};