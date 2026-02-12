// src/services/gameService.ts (FIXED - REAL FIREBASE)
/**
 * GAME SERVICE - FIREBASE IMPLEMENTATION
 * 
 * This replaces the mock in-memory database with actual Firebase operations
 */

import { doc, setDoc, updateDoc, getDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { BasketballGame, GameSettings, TeamData, GameState, Player } from '../types';

// ============================================
// FIREBASE OPERATIONS
// ============================================

/**
 * Subscribe to a specific game (real-time updates)
 */
export const subscribeToGame = (
  code: string,
  callback: (game: BasketballGame | null) => void
): (() => void) => {
  if (!code) {
    console.warn('[GameService] No game code provided');
    callback(null);
    return () => { };
  }

  const gameRef = doc(db, 'games', code);

  const unsubscribe = onSnapshot(
    gameRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const gameData = snapshot.data() as BasketballGame;
        callback(gameData);
      } else {
        console.warn(`[GameService] Game ${code} not found`);
        callback(null);
      }
    },
    (error) => {
      console.error('[GameService] Subscription error:', error);
      callback(null);
    }
  );

  return unsubscribe;
};

/**
 * Subscribe to all live games
 */
export const subscribeToLiveGames = (
  callback: (games: BasketballGame[]) => void
): (() => void) => {
  const gamesQuery = query(
    collection(db, 'games'),
    where('status', '==', 'live')
  );

  const unsubscribe = onSnapshot(
    gamesQuery,
    (snapshot) => {
      const games: BasketballGame[] = [];
      snapshot.forEach((doc) => {
        games.push(doc.data() as BasketballGame);
      });
      callback(games);
    },
    (error) => {
      console.error('[GameService] Live games subscription error:', error);
      callback([]);
    }
  );

  return unsubscribe;
};

/**
 * Update a specific field in Firebase (CRITICAL FIX)
 */
export const updateGameField = async (gameId: string, fieldPath: string, value: any) => {
  // This was failing because 'gameId' didn't match the Document ID
  const gameRef = doc(db, 'games', gameId);
  try {
    await updateDoc(gameRef, {
      [fieldPath]: value,
      lastUpdate: Date.now()
    });
  } catch (error) {
    console.error(`[GameService] ❌ Failed to update ${fieldPath}:`, error);
    throw error;
  }
};

/**
 * Delete a game
 */
export const deleteGame = async (code: string): Promise<void> => {
  if (!code) return;

  try {
    const gameRef = doc(db, 'games', code);
    await deleteDoc(gameRef);
    console.log(`[GameService] ✅ Deleted game ${code}`);
  } catch (error) {
    console.error('[GameService] Failed to delete game:', error);
    throw error;
  }
};

// ============================================
// GAME CREATION
// ============================================

const generateGameCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const createDefaultPlayer = (id: string): Player => ({
  id,
  name: '',
  number: '',
  position: '',
  points: 0,
  assists: 0,
  rebounds: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  disqualified: false,
  fieldGoalsMade: 0,
  fieldGoalsAttempted: 0,
  threePointsMade: 0,
  threePointsAttempted: 0,
  freeThrowsMade: 0,
  freeThrowsAttempted: 0,
});

const createDefaultTeam = (name: string, color: string): TeamData => ({
  name,
  color,
  score: 0,
  timeouts: 2,
  timeoutsFirstHalf: 2,
  timeoutsSecondHalf: 3,
  fouls: 0,
  foulsThisQuarter: 0,
  players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
});

/**
 * Initialize a new game in Firebase
 */
export const initializeNewGame = async (
  settings: GameSettings,
  teamA: Partial<TeamData> & { name: string; color: string },
  teamB: Partial<TeamData> & { name: string; color: string },
  isOnline: boolean,
  sport: string,
  hostId: string
): Promise<string> => {

  // 1. Generate the Code
  let gameCode = generateGameCode();

  // 2. Ensure Uniqueness (Optional but good)
  // while ((await getDoc(doc(db, 'games', gameCode))).exists()) {
  //    gameCode = generateGameCode();
  // }

  // 3. Define Initial State
  const initialGameState: GameState = {
    period: 1,
    gameTime: { minutes: settings.periodDuration, seconds: 0, tenths: 0 },
    shotClock: settings.shotClockDuration,
    gameRunning: false,
    shotClockRunning: false,
    possession: 'A'
  };

  // 4. Merge partial team data with defaults
  const fullTeamA: TeamData = {
    ...createDefaultTeam(teamA.name, teamA.color),
    ...teamA
  };

  const fullTeamB: TeamData = {
    ...createDefaultTeam(teamB.name, teamB.color),
    ...teamB
  };

  const newGame: BasketballGame = {
    code: gameCode,
    hostId: hostId,
    sport: sport,
    status: 'live',
    gameType: isOnline ? 'online' : 'local',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    settings: settings,
    gameState: initialGameState,
    teamA: fullTeamA,
    teamB: fullTeamB
  };

  // 5. CRITICAL FIX: Use setDoc with the gameCode as the ID
  // DO NOT use addDoc(collection(db, 'games'), newGame)
  await setDoc(doc(db, 'games', gameCode), newGame);

  return gameCode;
};

/**
 * Get a game by code (one-time fetch)
 */
export const getGameByCode = async (code: string): Promise<BasketballGame | null> => {
  if (!code) return null;

  try {
    const gameRef = doc(db, 'games', code);
    const snapshot = await getDoc(gameRef);

    if (snapshot.exists()) {
      return snapshot.data() as BasketballGame;
    }

    return null;
  } catch (error) {
    console.error('[GameService] Failed to get game:', error);
    return null;
  }
};

/**
 * Get all games for a specific host
 */
export const getGamesByHost = async (hostId: string): Promise<BasketballGame[]> => {
  if (!hostId) return [];

  try {
    const gamesQuery = query(
      collection(db, 'games'),
      where('hostId', '==', hostId),
      where('status', '==', 'live')
    );

    const snapshot = await getDocs(gamesQuery);
    const games: BasketballGame[] = [];

    snapshot.forEach((doc) => {
      games.push(doc.data() as BasketballGame);
    });

    return games;
  } catch (error) {
    console.error('[GameService] Failed to get games by host:', error);
    return [];
  }
};

// ============================================
// BACKWARDS COMPATIBILITY ALIASES
// ============================================

/**
 * Alias for getGameByCode (for backwards compatibility)
 */
export const getGame = getGameByCode;