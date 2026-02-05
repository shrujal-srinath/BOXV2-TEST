// src/services/gameService.ts (FIXED - REAL FIREBASE)
/**
 * GAME SERVICE - FIREBASE IMPLEMENTATION
 * 
 * This replaces the mock in-memory database with actual Firebase operations
 */

import { doc, setDoc, updateDoc, getDoc, onSnapshot, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { BasketballGame, Player, TeamData } from '../types';

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
export const updateGameField = async (code: string, path: string, value: any): Promise<void> => {
  if (!code) {
    console.error('[GameService] No game code provided');
    return;
  }

  try {
    const gameRef = doc(db, 'games', code);

    // Update Firebase with the field change
    await updateDoc(gameRef, {
      [path]: value,
      lastUpdate: Date.now()
    });

    console.log(`[GameService] ✅ Updated ${path} in game ${code}`);
  } catch (error) {
    console.error(`[GameService] ❌ Failed to update ${path}:`, error);
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
  settings: any,
  teamA: any,
  teamB: any,
  trackStats: boolean,
  sportType: string,
  hostId: string
): Promise<string> => {
  const code = generateGameCode();

  const newGame: BasketballGame = {
    code,
    hostId,
    sport: sportType,
    status: 'live',
    gameType: 'online',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    settings: {
      gameName: settings.gameName || `${teamA.name} vs ${teamB.name}`,
      periodDuration: settings.periodDuration || 10,
      shotClockDuration: settings.shotClockDuration || 24,
      periodType: settings.periodType || 'quarter',
    },
    gameState: {
      period: 1,
      gameTime: {
        minutes: settings.periodDuration || 10,
        seconds: 0,
        tenths: 0,
      },
      shotClock: settings.shotClockDuration || 24,
      gameRunning: false,
      shotClockRunning: false,
      possession: 'A',
    },
    teamA: {
      ...createDefaultTeam(teamA.name, teamA.color),
      players: trackStats ? teamA.players || [] : [],
    },
    teamB: {
      ...createDefaultTeam(teamB.name, teamB.color),
      players: trackStats ? teamB.players || [] : [],
    },
  };

  // Save to Firebase
  const gameRef = doc(db, 'games', code);
  await setDoc(gameRef, newGame);

  console.log(`[GameService] ✅ Created game ${code}`);
  return code;
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