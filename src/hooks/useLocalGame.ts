// src/hooks/useLocalGame.ts (V2 - PRODUCTION READY)
/**
 * USE LOCAL GAME HOOK - PRODUCTION VERSION
 * 
 * FIXES APPLIED:
 * ✅ Auto-save on every update
 * ✅ Last active game tracking
 * ✅ Better error handling
 * ✅ Sync queue integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BasketballGame } from '../types';
import {
  getLocalGame,
  updateLocalGame,
  setActiveLocalGame,
  getLocalGameLibrary,
  type LocalGameMetadata,
} from '../services/localGameService';
import { addToSyncQueue } from '../services/syncService';

// ============================================
// CONSTANTS
// ============================================
const LAST_GAME_KEY = 'BOX_V2_LAST_ACTIVE_GAME';

// ============================================
// TYPES
// ============================================
export interface UseLocalGameReturn {
  game: BasketballGame | null;
  metadata: LocalGameMetadata | null;
  isLoading: boolean;
  error: string | null;

  updateScore: (team: 'A' | 'B', points: number) => void;
  updateFouls: (team: 'A' | 'B', change: number) => void;
  updateTimeouts: (team: 'A' | 'B', change: number) => void;
  toggleClock: () => void;
  resetShotClock: (seconds: number) => void;
  togglePossession: () => void;
  nextPeriod: () => void;
  setGameTime: (minutes: number, seconds: number, shotClock: number) => void;

  updateGameState: (updater: (game: BasketballGame) => void) => void;
  forceSync: () => void;
  reload: () => void;
}

// ============================================
// MAIN HOOK
// ============================================
export const useLocalGame = (gameId: string): UseLocalGameReturn => {
  const [game, setGame] = useState<BasketballGame | null>(null);
  const [metadata, setMetadata] = useState<LocalGameMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameRef = useRef<BasketballGame | null>(null);

  const loadGame = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const gameMetadata = getLocalGame(gameId);

      if (!gameMetadata) {
        setError(`Game not found: ${gameId}`);
        setGame(null);
        setMetadata(null);
        gameRef.current = null;
        return;
      }

      setGame(gameMetadata.game);
      setMetadata(gameMetadata);
      gameRef.current = gameMetadata.game;
      
      setActiveLocalGame(gameId);

      // ADDED: Track last active game
      try {
        localStorage.setItem(LAST_GAME_KEY, JSON.stringify({
          id: gameId,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.error('[useLocalGame] Failed to save last active game:', e);
      }

    } catch (err: any) {
      console.error('[useLocalGame] Load error:', err);
      setError(err.message || 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // FIXED: Auto-save on every update
  const updateGameState = useCallback((updater: (game: BasketballGame) => void) => {
    if (!gameRef.current) {
      console.error('[useLocalGame] No game loaded');
      return;
    }

    const updatedGame = JSON.parse(JSON.stringify(gameRef.current)) as BasketballGame;
    updater(updatedGame);
    updatedGame.lastUpdate = Date.now();

    setGame(updatedGame);
    gameRef.current = updatedGame;

    const success = updateLocalGame(gameId, updatedGame);

    if (success) {
      // ADDED: Auto-add to sync queue
      addToSyncQueue(gameId, updatedGame);
      
      // ADDED: Update last active timestamp
      try {
        localStorage.setItem(LAST_GAME_KEY, JSON.stringify({
          id: gameId,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.error('[useLocalGame] Failed to update last active game:', e);
      }
    } else {
      console.error('[useLocalGame] Failed to save game');
      setError('Failed to save game state');
    }
  }, [gameId]);

  const updateScore = useCallback((team: 'A' | 'B', points: number) => {
    updateGameState((game) => {
      const teamKey = team === 'A' ? 'teamA' : 'teamB';
      game[teamKey].score = Math.max(0, game[teamKey].score + points);
    });
  }, [updateGameState]);

  const updateFouls = useCallback((team: 'A' | 'B', change: number) => {
    updateGameState((game) => {
      const teamKey = team === 'A' ? 'teamA' : 'teamB';
      game[teamKey].fouls = Math.max(0, game[teamKey].fouls + change);
    });
  }, [updateGameState]);

  const updateTimeouts = useCallback((team: 'A' | 'B', change: number) => {
    updateGameState((game) => {
      const teamKey = team === 'A' ? 'teamA' : 'teamB';
      game[teamKey].timeouts = Math.max(0, Math.min(7, game[teamKey].timeouts + change));
    });
  }, [updateGameState]);

  const toggleClock = useCallback(() => {
    updateGameState((game) => {
      game.gameState.gameRunning = !game.gameState.gameRunning;
      game.gameState.shotClockRunning = game.gameState.gameRunning;
    });
  }, [updateGameState]);

  const resetShotClock = useCallback((seconds: number) => {
    updateGameState((game) => {
      game.gameState.shotClock = seconds;
    });
  }, [updateGameState]);

  const togglePossession = useCallback(() => {
    updateGameState((game) => {
      game.gameState.possession = game.gameState.possession === 'A' ? 'B' : 'A';
    });
  }, [updateGameState]);

  const nextPeriod = useCallback(() => {
    updateGameState((game) => {
      game.gameState.period += 1;
      game.gameState.gameTime.minutes = game.settings.periodDuration;
      game.gameState.gameTime.seconds = 0;
      game.gameState.shotClock = game.settings.shotClockDuration;
      game.gameState.gameRunning = false;
    });
  }, [updateGameState]);

  const setGameTime = useCallback((minutes: number, seconds: number, shotClock: number) => {
    updateGameState((game) => {
      game.gameState.gameTime.minutes = minutes;
      game.gameState.gameTime.seconds = seconds;
      game.gameState.shotClock = shotClock;
    });
  }, [updateGameState]);

  const forceSync = useCallback(() => {
    if (gameRef.current) {
      addToSyncQueue(gameId, gameRef.current);
      console.log('[useLocalGame] Game queued for sync');
    }
  }, [gameId]);

  const reload = useCallback(() => {
    loadGame();
  }, [loadGame]);

  return {
    game,
    metadata,
    isLoading,
    error,
    updateScore,
    updateFouls,
    updateTimeouts,
    toggleClock,
    resetShotClock,
    togglePossession,
    nextPeriod,
    setGameTime,
    updateGameState,
    forceSync,
    reload,
  };
};

// ============================================
// TIMER HOOK (NO CHANGES NEEDED)
// ============================================
export const useLocalGameTimer = (gameId: string) => {
  const { game, updateGameState } = useLocalGame(gameId);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!game || !game.gameState.gameRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      updateGameState((g) => {
        const totalSec = g.gameState.gameTime.minutes * 60 + g.gameState.gameTime.seconds;

        if (totalSec > 0) {
          const newTotal = totalSec - 1;
          g.gameState.gameTime.minutes = Math.floor(newTotal / 60);
          g.gameState.gameTime.seconds = newTotal % 60;

          if (g.gameState.shotClock > 0) {
            g.gameState.shotClock = Math.max(0, g.gameState.shotClock - 1);
          }
        } else {
          g.gameState.gameRunning = false;
          g.gameState.gameTime.minutes = 0;
          g.gameState.gameTime.seconds = 0;

          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
        }
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [game?.gameState.gameRunning, updateGameState]);
};

// ============================================
// GAME LIBRARY HOOK (NO CHANGES)
// ============================================
export const useLocalGameLibrary = () => {
  const [games, setGames] = useState<LocalGameMetadata[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const library = getLocalGameLibrary();
    setGames(library.games);
    setActiveGameId(library.activeGameId);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    games,
    activeGameId,
    refresh,
  };
};

// ============================================
// HELPER: Get last active game
// ============================================
export const getLastActiveGame = (): { id: string; timestamp: number } | null => {
  try {
    const saved = localStorage.getItem(LAST_GAME_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export default useLocalGame;