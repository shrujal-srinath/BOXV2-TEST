// src/hooks/useLocalGame.ts
/**
 * USE LOCAL GAME HOOK
 * React hook for managing local game state
 * Provides clean API for components to interact with offline games
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BasketballGame } from '../types';
import {
  getLocalGame,
  updateLocalGame,
  setActiveLocalGame,
  getActiveLocalGame,
  type LocalGameMetadata,
} from '../services/localGameService';
import { addToSyncQueue } from '../services/syncService';

// ============================================
// TYPES
// ============================================

export interface UseLocalGameReturn {
  // State
  game: BasketballGame | null;
  metadata: LocalGameMetadata | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  updateScore: (team: 'A' | 'B', points: number) => void;
  updateFouls: (team: 'A' | 'B', change: number) => void;
  updateTimeouts: (team: 'A' | 'B', change: number) => void;
  toggleClock: () => void;
  resetShotClock: (seconds: number) => void;
  togglePossession: () => void;
  nextPeriod: () => void;
  setGameTime: (minutes: number, seconds: number, shotClock: number) => void;

  // Advanced
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

  // Use ref to track latest game state (prevents stale closures)
  const gameRef = useRef<BasketballGame | null>(null);

  // ============================================
  // LOAD GAME
  // ============================================

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
      
      // Set as active game
      setActiveLocalGame(gameId);

    } catch (err: any) {
      console.error('[useLocalGame] Load error:', err);
      setError(err.message || 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // Load on mount and when gameId changes
  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // ============================================
  // UPDATE HELPER
  // ============================================

  /**
   * Generic game updater with automatic save and sync
   */
  const updateGameState = useCallback((updater: (game: BasketballGame) => void) => {
    if (!gameRef.current) {
      console.error('[useLocalGame] No game loaded');
      return;
    }

    // Clone current game
    const updatedGame = JSON.parse(JSON.stringify(gameRef.current)) as BasketballGame;

    // Apply updates
    updater(updatedGame);

    // Update timestamp
    updatedGame.lastUpdate = Date.now();

    // Save to state
    setGame(updatedGame);
    gameRef.current = updatedGame;

    // Save to localStorage
    const success = updateLocalGame(gameId, updatedGame);

    if (success) {
      // Add to sync queue (will sync when user logs in / goes online)
      addToSyncQueue(gameId, updatedGame);
    } else {
      console.error('[useLocalGame] Failed to save game');
    }
  }, [gameId]);

  // ============================================
  // GAME ACTIONS
  // ============================================

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

  // ============================================
  // ADVANCED ACTIONS
  // ============================================

  const forceSync = useCallback(() => {
    if (gameRef.current) {
      addToSyncQueue(gameId, gameRef.current);
      console.log('[useLocalGame] Game queued for sync');
    }
  }, [gameId]);

  const reload = useCallback(() => {
    loadGame();
  }, [loadGame]);

  // ============================================
  // RETURN API
  // ============================================

  return {
    // State
    game,
    metadata,
    isLoading,
    error,

    // Actions
    updateScore,
    updateFouls,
    updateTimeouts,
    toggleClock,
    resetShotClock,
    togglePossession,
    nextPeriod,
    setGameTime,

    // Advanced
    updateGameState,
    forceSync,
    reload,
  };
};

// ============================================
// TIMER HOOK (Optional Enhancement)
// ============================================

/**
 * Separate hook for handling game timer
 * Manages the clock countdown loop
 */
export const useLocalGameTimer = (gameId: string) => {
  const { game, updateGameState } = useLocalGame(gameId);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!game || !game.gameState.gameRunning) {
      // Clear timer if game stopped
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Start timer
    timerRef.current = window.setInterval(() => {
      updateGameState((g) => {
        const totalSec = g.gameState.gameTime.minutes * 60 + g.gameState.gameTime.seconds;

        if (totalSec > 0) {
          const newTotal = totalSec - 1;
          g.gameState.gameTime.minutes = Math.floor(newTotal / 60);
          g.gameState.gameTime.seconds = newTotal % 60;

          // Shot clock countdown
          if (g.gameState.shotClock > 0) {
            g.gameState.shotClock = Math.max(0, g.gameState.shotClock - 1);
          }
        } else {
          // Time expired
          g.gameState.gameRunning = false;
          g.gameState.gameTime.minutes = 0;
          g.gameState.gameTime.seconds = 0;

          // Trigger buzzer
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
// GAME LIBRARY HOOK
// ============================================

/**
 * Hook for accessing all local games
 * Useful for game selection / library screens
 */
export const useLocalGameLibrary = () => {
  const [games, setGames] = useState<LocalGameMetadata[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const localGameService = require('../services/localGameService');
    const library = localGameService.getLocalGameLibrary();
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
// EXPORTS
// ============================================

export default useLocalGame;