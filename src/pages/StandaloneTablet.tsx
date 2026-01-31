// src/pages/StandaloneTablet.tsx (V2 - PRODUCTION READY)
/**
 * STANDALONE TABLET PAGE - PRODUCTION VERSION
 * 
 * FIXES APPLIED:
 * ✅ Auto-resume last active game
 * ✅ Better offline indicators
 * ✅ Improved UX flow
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Play, Cloud, Settings, Download } from 'lucide-react';
import { BootSequence } from '../features/tablet/BootSequence';
import { getLocalGameLibrary, getStorageStats, type LocalGameMetadata } from '../services/localGameService';
import { getSyncStatus, triggerManualSync } from '../services/syncService';
import { getLastActiveGame } from '../hooks/useLocalGame';
import { auth } from '../services/firebase';
import { usePWAInstall } from '../hooks/usePWAInstall';
import '../styles/hardware.css';

export const StandaloneTablet: React.FC = () => {
  const navigate = useNavigate();
  
  const { prompt, triggerInstall, isInstalled } = usePWAInstall();
  
  const [isBooting, setIsBooting] = useState(true);
  const [localGames, setLocalGames] = useState<LocalGameMetadata[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [lastGame, setLastGame] = useState<{ id: string; timestamp: number } | null>(null);
  const [storageInfo, setStorageInfo] = useState(getStorageStats());

  const refreshGames = () => {
    const library = getLocalGameLibrary();
    setLocalGames(library.games.sort((a, b) => b.lastModified - a.lastModified));
    setStorageInfo(getStorageStats());
  };

  useEffect(() => {
    refreshGames();
    
    // ADDED: Check for last active game
    const last = getLastActiveGame();
    if (last) {
      setLastGame(last);
      
      // Show resume prompt if game was active recently (within 24 hours)
      const hoursSinceActive = (Date.now() - last.timestamp) / (1000 * 60 * 60);
      if (hoursSinceActive < 24) {
        setShowResumePrompt(true);
      }
    }
  }, []);

  const handleBootComplete = () => {
    setIsBooting(false);
  };

  const handleResumeGame = (gameId: string) => {
    navigate(`/tablet/${gameId}`);
  };

  const handleResumeLastGame = () => {
    if (lastGame) {
      navigate(`/tablet/${lastGame.id}`);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (isBooting) {
    return <BootSequence onComplete={handleBootComplete} />;
  }

  return (
    <div className="hardware-container h-screen w-screen overflow-hidden flex flex-col">
      <div className="crt-overlay"></div>

      {/* Header */}
      <div className="bg-zinc-950 border-b-2 border-zinc-900 p-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`led-indicator ${navigator.onLine ? 'led-on-green' : 'led-on-red'}`}></div>
            <div>
              <h1 className="text-3xl font-black italic tracking-tight text-white">
                THE BOX
              </h1>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                {navigator.onLine ? 'Online Mode' : 'Offline Mode'}
              </p>
            </div>
          </div>

          <div className="metal-panel px-4 py-2">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Storage: {storageInfo.totalGames}/{storageInfo.maxGames}
            </div>
          </div>
        </div>
      </div>

      {/* Resume Last Game Prompt */}
      {showResumePrompt && lastGame && (
        <div className="bg-gradient-to-r from-blue-900/20 to-transparent border-b-2 border-blue-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
              <div>
                <div className="text-white font-bold text-sm">Resume last game?</div>
                <div className="text-zinc-500 text-xs">
                  Last active {formatDate(lastGame.timestamp)}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResumePrompt(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-bold uppercase rounded transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={handleResumeLastGame}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase rounded transition-colors flex items-center gap-2"
              >
                <Play size={14} />
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto bg-black/20">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Create New Game */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="metal-panel p-8 flex flex-col items-center justify-center gap-4 hover:border-green-500 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-green-900/20 flex items-center justify-center group-hover:bg-green-900/40 transition-all">
                <Play size={32} className="text-green-500" />
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-white uppercase">Start New Game</div>
                <div className="text-xs text-zinc-500 mt-1">Quick Setup</div>
              </div>
            </button>

            {/* PWA Install */}
            <button
              onClick={prompt ? triggerInstall : undefined}
              disabled={!prompt}
              className={`metal-panel p-8 flex flex-col items-center justify-center gap-4 transition-all group relative
                ${prompt 
                  ? 'border-dashed border-blue-500/50 hover:border-blue-400 cursor-pointer animate-pulse' 
                  : 'opacity-30 grayscale cursor-not-allowed border-transparent bg-zinc-900/10'
                }`}
            >
               {!prompt && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-black/80 px-2 py-1 rounded border border-zinc-800">
                    {isInstalled ? "Already Installed" : "Browser Restriction"}
                  </span>
                </div>
              )}

              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all 
                ${prompt ? 'bg-blue-900/20 group-hover:bg-blue-900/40' : 'bg-zinc-800/20'}`}>
                <Download size={32} className={prompt ? 'text-blue-400' : 'text-zinc-600'} />
              </div>
              <div className="text-center">
                <div className={`text-lg font-black uppercase ${prompt ? 'text-white' : 'text-zinc-600'}`}>
                  Install App
                </div>
                <div className="text-xs text-zinc-500 mt-1">Offline Access</div>
              </div>
            </button>

            {/* Sync to Cloud */}
            <button
              onClick={() => setShowSyncModal(true)}
              className="metal-panel p-8 flex flex-col items-center justify-center gap-4 hover:border-blue-500 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-900/40 transition-all">
                <Cloud size={32} className="text-blue-500" />
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-white uppercase">Sync to Cloud</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {auth.currentUser ? 'Backup Games' : 'Sign In Required'}
                </div>
              </div>
            </button>

            {/* Settings */}
            <button
              onClick={() => navigate('/dashboard')}
              className="metal-panel p-8 flex flex-col items-center justify-center gap-4 hover:border-amber-500 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-amber-900/20 flex items-center justify-center group-hover:bg-amber-900/40 transition-all">
                <Settings size={32} className="text-amber-500" />
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-white uppercase">Dashboard</div>
                <div className="text-xs text-zinc-500 mt-1">Full Controls</div>
              </div>
            </button>
          </div>

          {/* Saved Games */}
          <div className="metal-panel p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="embossed-label text-lg">SAVED GAMES ({localGames.length})</h2>
              <button
                onClick={refreshGames}
                className="text-xs text-zinc-500 hover:text-white transition-colors uppercase tracking-wider"
              >
                Refresh
              </button>
            </div>

            {localGames.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded">
                <Users size={48} className="text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-600 text-xs uppercase tracking-wider">
                  No saved games. Create your first game above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {localGames.map((gameMetadata) => (
                  <button
                    key={gameMetadata.id}
                    onClick={() => handleResumeGame(gameMetadata.id)}
                    className="w-full bg-black border border-zinc-800 hover:border-zinc-600 p-4 transition-all group text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-black text-white group-hover:text-green-400 transition-colors">
                            {gameMetadata.game.settings.gameName}
                          </h3>
                          {!gameMetadata.synced && (
                            <div className="flex items-center gap-1">
                              <div className="led-indicator led-on-amber"></div>
                              <span className="text-xs text-amber-500 font-bold">OFFLINE</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span className="font-mono">{gameMetadata.id}</span>
                          <span>•</span>
                          <span>Q{gameMetadata.game.gameState.period}</span>
                          <span>•</span>
                          <span>{formatDate(gameMetadata.lastModified)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-2xl font-mono font-bold text-white">
                            {gameMetadata.game.teamA.score}
                          </div>
                          <div className="text-xs text-zinc-600">
                            {gameMetadata.game.teamA.name}
                          </div>
                        </div>
                        <div className="text-zinc-700 font-bold">-</div>
                        <div className="text-center">
                          <div className="text-2xl font-mono font-bold text-white">
                            {gameMetadata.game.teamB.score}
                          </div>
                          <div className="text-xs text-zinc-600">
                            {gameMetadata.game.teamB.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Game Modal */}
      {showCreateModal && (
        <CreateGameModal
          onClose={() => setShowCreateModal(false)}
          onGameCreated={(gameId) => {
            setShowCreateModal(false);
            navigate(`/tablet/${gameId}`);
          }}
        />
      )}

      {/* Sync Modal */}
      {showSyncModal && (
        <SyncModal
          onClose={() => {
            setShowSyncModal(false);
            refreshGames();
          }}
        />
      )}
    </div>
  );
};

// ============================================
// CREATE GAME MODAL (NO CHANGES)
// ============================================
interface CreateGameModalProps {
  onClose: () => void;
  onGameCreated: (gameId: string) => void;
}

const CreateGameModal: React.FC<CreateGameModalProps> = ({ onClose, onGameCreated }) => {
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [periodDuration, setPeriodDuration] = useState(10);
  const [shotClock, setShotClock] = useState(24);

  const handleCreate = async () => {
    const localGameService = await import('../services/localGameService');
    const metadata = localGameService.createLocalGame(
      teamAName || 'HOME',
      teamBName || 'AWAY',
      periodDuration,
      shotClock
    );

    if (metadata) {
      onGameCreated(metadata.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="metal-panel p-8 w-full max-w-md">
        <h2 className="text-2xl font-black italic text-white mb-6 uppercase">
          Quick Setup
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="embossed-label mb-2 block">Home Team</label>
            <input
              type="text"
              value={teamAName}
              onChange={(e) => setTeamAName(e.target.value)}
              placeholder="Warriors"
              className="w-full bg-black border border-zinc-700 p-3 text-white uppercase"
              autoFocus
            />
          </div>

          <div>
            <label className="embossed-label mb-2 block">Away Team</label>
            <input
              type="text"
              value={teamBName}
              onChange={(e) => setTeamBName(e.target.value)}
              placeholder="Titans"
              className="w-full bg-black border border-zinc-700 p-3 text-white uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="embossed-label mb-2 block">Period (min)</label>
              <input
                type="number"
                value={periodDuration}
                onChange={(e) => setPeriodDuration(Number(e.target.value))}
                className="w-full bg-black border border-zinc-700 p-3 text-white text-center font-mono"
              />
            </div>
            <div>
              <label className="embossed-label mb-2 block">Shot Clock (sec)</label>
              <input
                type="number"
                value={shotClock}
                onChange={(e) => setShotClock(Number(e.target.value))}
                className="w-full bg-black border border-zinc-700 p-3 text-white text-center font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 hw-button"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 hw-button hw-button-green"
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SYNC MODAL (NO CHANGES)
// ============================================
interface SyncModalProps {
  onClose: () => void;
}

const SyncModal: React.FC<SyncModalProps> = ({ onClose }) => {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const syncStatus = getSyncStatus();

  const handleSync = async () => {
    setSyncing(true);
    const syncResult = await triggerManualSync();
    setResult(syncResult);
    setSyncing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="metal-panel p-8 w-full max-w-md">
        <h2 className="text-2xl font-black italic text-white mb-6 uppercase">
          Cloud Sync
        </h2>

        {!auth.currentUser ? (
          <div className="text-center py-8">
            <Cloud size={64} className="text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm mb-4">
              Sign in to backup your games to the cloud
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="hw-button hw-button-blue"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Pending:</span>
                <span className="text-white font-mono">{syncStatus.pendingCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Last Sync:</span>
                <span className="text-white font-mono">
                  {syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>

            {result && (
              <div className="mb-6 p-4 bg-black border border-zinc-800">
                <p className="text-xs text-zinc-400 mb-2">
                  ✅ Synced: {result.syncedGames.length}
                </p>
                {result.failedGames.length > 0 && (
                  <p className="text-xs text-red-500">
                    ❌ Failed: {result.failedGames.length}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 hw-button">
                Close
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 hw-button hw-button-green"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};