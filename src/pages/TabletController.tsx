// src/pages/TabletController.tsx (V5 - FIXED FOR NEW HOOK API)
/**
 * TABLET CONTROLLER V5 - USES UPDATED useLocalGame HOOK
 * 
 * CHANGES:
 * ✅ Uses handleAction from hook (unified interface)
 * ✅ Uses undo/redo from hook
 * ✅ Uses toggleGameClock instead of toggleClock
 * ✅ Removed duplicate undo/redo logic
 * ✅ Simplified offline queue (hook handles sync)
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/hardware.css';
import { BootSequence } from '../features/tablet/BootSequence';
import { HardwareUI } from '../features/tablet/HardwareUI';
import { StatusBar } from '../features/tablet/StatusBar';
import { DiagnosticConsole } from '../features/tablet/DiagnosticConsole';

// Hooks
import { useLocalGame, useLocalGameTimer } from '../hooks/useLocalGame';

// Cloud imports (for cloud games)
import { subscribeToGame } from '../services/gameService';

// Types
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
  
  // ============================================
  // UI STATE
  // ============================================
  const [isBooting, setIsBooting] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOnline] = useState(navigator.onLine);
  const [lastSyncTime] = useState<number>(Date.now());

  // ============================================
  // SETTINGS STATE
  // ============================================
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) : {
        hapticEnabled: true,
        soundEnabled: true,
        autoSync: true
      };
    } catch {
      return { hapticEnabled: true, soundEnabled: true, autoSync: true };
    }
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // ============================================
  // OFFLINE QUEUE (READ-ONLY FOR DISPLAY)
  // ============================================
  const [offlineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ============================================
  // GAME TYPE DETECTION
  // ============================================
  const isLocalGame = gameCode?.startsWith('LOCAL-');

  // ============================================
  // LOCAL GAME MODE (PRIMARY)
  // ============================================
  const localGameHook = useLocalGame(gameCode || '');
  useLocalGameTimer(gameCode || ''); // Handles timer

  // ============================================
  // CLOUD GAME MODE (FALLBACK)
  // ============================================
  const [cloudGame, setCloudGame] = useState<BasketballGame | null>(null);

  useEffect(() => {
    if (!gameCode || isLocalGame) return;

    const unsubscribe = subscribeToGame(gameCode, (cloudData) => {
      setCloudGame(cloudData);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [gameCode, isLocalGame]);

  // ============================================
  // UNIFIED GAME INTERFACE
  // ============================================
  const game = isLocalGame ? localGameHook.game : cloudGame;
  const isLoading = isLocalGame ? localGameHook.isLoading : !cloudGame;
  const error = isLocalGame ? localGameHook.error : null;

  // ============================================
  // VIBRATION HELPER
  // ============================================
  const vibrate = (pattern: number | number[]) => {
    if (settings.hapticEnabled && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // ============================================
  // ACTION HANDLERS (FORWARD TO HOOK)
  // ============================================
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
      if (confirm(`End period ${game?.gameState.period} and start next period?`)) {
        localGameHook.nextPeriod();
        vibrate([100, 50, 100]);
      }
    }
  };

  const handleUndo = () => {
    if (isLocalGame) {
      localGameHook.undo();
      vibrate([60, 30, 60]);
    }
  };

  const handleRedo = () => {
    if (isLocalGame) {
      localGameHook.redo();
      vibrate([60, 30, 60]);
    }
  };

  // ============================================
  // EXPORT FUNCTIONALITY
  // ============================================
  const handleExportGame = () => {
    if (!game) return;

    const exportData = {
      game,
      actionHistory: isLocalGame ? localGameHook.actionHistory : [],
      exportDate: new Date().toISOString(),
      version: '5.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-${game.code}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    vibrate([50, 30, 50]);
  };

  // ============================================
  // BOOT SEQUENCE
  // ============================================
  useEffect(() => {
    const skipBoot = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsBooting(false);
    };
    window.addEventListener('keydown', skipBoot);

    const timer = setTimeout(() => {
      setIsBooting(false);
      
      const hasUsedBefore = localStorage.getItem('BOX_V2_HAS_USED');
      if (!hasUsedBefore) {
        setShowOnboarding(true);
        localStorage.setItem('BOX_V2_HAS_USED', 'true');
      }
    }, 3000);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', skipBoot);
    };
  }, []);

  // ============================================
  // RENDER: LOADING STATES
  // ============================================
  if (isBooting) {
    return <BootSequence onComplete={() => setIsBooting(false)} />;
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

  // ============================================
  // RENDER: MAIN UI
  // ============================================
  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* Portrait Warning */}
      <div className="portrait-warning">
        <div className="portrait-warning-icon">📱→🔄</div>
        <div className="portrait-warning-text">ROTATE TO LANDSCAPE</div>
        <div className="portrait-warning-hint">Please rotate your device to use THE BOX</div>
      </div>

      <StatusBar 
        gameCode={gameCode || ''} 
        isOnline={isOnline}
        lastSync={lastSyncTime}
        offlineQueueCount={offlineQueue.length}
        onOpenSettings={() => setShowSettings(true)}
      />

      <HardwareUI
        game={game}
        onAction={handleAction}
        onToggleClock={handleToggleClock}
        onResetShotClock={handleResetShotClock}
        onTogglePossession={handleTogglePossession}
        onNextPeriod={handleNextPeriod}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={isLocalGame ? localGameHook.canUndo : false}
        canRedo={isLocalGame ? localGameHook.canRedo : false}
        offlineQueue={offlineQueue}
      />

      {/* SETTINGS MODAL */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
          onExportGame={handleExportGame}
          onOpenDiagnostics={() => {
            setShowSettings(false);
            setShowDiagnostics(true);
          }}
          actionHistory={isLocalGame ? localGameHook.actionHistory : []}
          offlineQueue={offlineQueue}
          gameMode={isLocalGame ? 'LOCAL' : 'CLOUD'}
        />
      )}

      {/* ONBOARDING */}
      {showOnboarding && (
        <OnboardingOverlay onClose={() => setShowOnboarding(false)} />
      )}

      {/* DIAGNOSTICS */}
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

// ============================================
// SETTINGS MODAL
// ============================================
interface SettingsModalProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
  onExportGame: () => void;
  onOpenDiagnostics: () => void;
  actionHistory: any[];
  offlineQueue: any[];
  gameMode: 'LOCAL' | 'CLOUD';
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSettingsChange,
  onClose,
  onExportGame,
  onOpenDiagnostics,
  actionHistory,
  offlineQueue,
  gameMode
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8">
      <div className="metal-panel p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white">SETTINGS</h2>
          <button onClick={onClose} className="hw-button hw-button-red">
            CLOSE
          </button>
        </div>

        {/* Haptic Toggle */}
        <div className="mb-6 p-4 bg-black rounded border border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-lg">Haptic Feedback</div>
            <div className="text-zinc-500 text-xs">Vibrate on button press</div>
          </div>
          <button
            onClick={() => onSettingsChange({ ...settings, hapticEnabled: !settings.hapticEnabled })}
            className={`hw-button ${settings.hapticEnabled ? 'hw-button-green' : ''}`}
          >
            {settings.hapticEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Export Game */}
        <button onClick={onExportGame} className="hw-button w-full mb-4">
          📦 EXPORT GAME DATA
        </button>

        {/* Clear Local Data */}
        <button
          onClick={() => {
            if (confirm('Clear all local games? This cannot be undone.')) {
              localStorage.clear();
              window.location.href = '/tablet/standalone';
            }
          }}
          className="hw-button hw-button-red w-full mb-4"
        >
          🗑️ CLEAR ALL LOCAL DATA
        </button>

        {/* Diagnostics */}
        <button onClick={onOpenDiagnostics} className="hw-button w-full">
          🔧 OPEN DIAGNOSTICS
        </button>

        {/* Stats */}
        <div className="mt-8 pt-6 border-t border-zinc-800">
          <div className="embossed-label mb-3">SESSION STATS</div>
          <div className="bg-black p-4 rounded border border-zinc-800 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Actions Recorded:</span>
              <span className="text-white">{actionHistory.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Offline Queue:</span>
              <span className="text-white">{offlineQueue.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Game Mode:</span>
              <span className="text-white">{gameMode}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ONBOARDING OVERLAY
// ============================================
const OnboardingOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to THE BOX',
      description: 'Professional basketball scoring system optimized for tablets',
      icon: '🏀'
    },
    {
      title: 'Large Touch Targets',
      description: 'All buttons are sized for easy tapping during live games',
      icon: '👆'
    },
    {
      title: 'Team Color Coding',
      description: 'Blue for Team A, Red for Team B',
      icon: '🎨'
    },
    {
      title: 'Shake to Undo',
      description: 'Made a mistake? Just shake your device',
      icon: '📱'
    }
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-[100] flex items-center justify-center p-8">
      <div className="metal-panel p-12 max-w-2xl w-full text-center">
        <div className="text-8xl mb-6">{currentStep.icon}</div>
        <h2 className="text-3xl font-black text-white mb-4">{currentStep.title}</h2>
        <p className="text-zinc-400 text-lg mb-8">{currentStep.description}</p>

        <div className="flex gap-2 justify-center mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${i === step ? 'bg-green-500' : 'bg-zinc-700'}`}
            />
          ))}
        </div>

        <div className="flex gap-4">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="hw-button flex-1">
              BACK
            </button>
          )}
          <button
            onClick={() => {
              if (step < steps.length - 1) {
                setStep(step + 1);
              } else {
                onClose();
              }
            }}
            className="hw-button hw-button-green flex-1"
          >
            {step < steps.length - 1 ? 'NEXT' : 'GET STARTED'}
          </button>
        </div>
      </div>
    </div>
  );
};