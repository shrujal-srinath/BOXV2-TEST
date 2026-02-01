// src/services/gameService.ts - FIXED VERSION
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import type { BasketballGame, TeamData } from '../types';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a random 6-digit game code
 */
export const generateGameCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================
// CREATE GAME
// ============================================

/**
 * Create a new game in Firebase
 */
export const createGame = async (
  teamAData: { name: string; color: string },
  teamBData: { name: string; color: string },
  hostId: string,
  settings: {
    gameName: string;
    periodDuration: number;
    shotClockDuration: number;
    periodType: 'quarter' | 'half';
  }
): Promise<string> => {
  const gameCode = generateGameCode();
  const now = Date.now();

  // Create TeamData objects with all required properties
  const teamA: TeamData = {
    name: teamAData.name,
    color: teamAData.color,
    score: 0,
    timeouts: 2,
    timeoutsFirstHalf: 2,
    timeoutsSecondHalf: 3,
    fouls: 0,
    foulsThisQuarter: 0,
    players: []
  };

  const teamB: TeamData = {
    name: teamBData.name,
    color: teamBData.color,
    score: 0,
    timeouts: 2,
    timeoutsFirstHalf: 2,
    timeoutsSecondHalf: 3,
    fouls: 0,
    foulsThisQuarter: 0,
    players: []
  };

  const newGame: BasketballGame = {
    code: gameCode,
    hostId,
    teamA,
    teamB,
    gameState: {
      period: 1,
      gameTime: {
        minutes: settings.periodDuration,
        seconds: 0,
        tenths: 0
      },
      shotClock: settings.shotClockDuration,
      gameRunning: false,
      shotClockRunning: false,
      possession: 'A'
    },
    settings,
    sport: 'basketball',
    status: 'live',
    createdAt: now,
    lastUpdate: now,
    gameType: 'pro'
  };

  // Save to Firebase
  const gameRef = doc(db, 'games', gameCode);
  await setDoc(gameRef, newGame);

  console.log(`[GameService] Created game: ${gameCode}`);
  return gameCode;
};

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get a game by code
 */
export const getGame = async (code: string): Promise<BasketballGame | null> => {
  try {
    const gameRef = doc(db, 'games', code);
    const gameSnap = await getDoc(gameRef);

    if (gameSnap.exists()) {
      return gameSnap.data() as BasketballGame;
    }

    return null;
  } catch (error) {
    console.error('[GameService] Error getting game:', error);
    return null;
  }
};

/**
 * Subscribe to real-time updates for a game
 */
export const subscribeToGame = (
  code: string,
  callback: (game: BasketballGame | null) => void
): Unsubscribe => {
  const gameRef = doc(db, 'games', code);

  return onSnapshot(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as BasketballGame);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('[GameService] Subscription error:', error);
    callback(null);
  });
};

/**
 * Get all games created by a specific user
 * @deprecated Use subscribeToUserGames instead for real-time updates
 */
export const getUserActiveGames = (userId: string): BasketballGame[] => {
  // This is a synchronous function that returns from cache
  // For real-time updates, use subscribeToUserGames instead
  console.warn('[GameService] getUserActiveGames is deprecated. Use subscribeToUserGames instead.');
  return [];
};

/**
 * Subscribe to user's active games
 */
export const subscribeToUserGames = (
  userId: string,
  callback: (games: BasketballGame[]) => void
): Unsubscribe => {
  const gamesRef = collection(db, 'games');
  const q = query(
    gamesRef,
    where('hostId', '==', userId),
    where('status', '==', 'live')
  );

  return onSnapshot(q, (snapshot) => {
    const games = snapshot.docs.map(doc => doc.data() as BasketballGame);
    callback(games);
  }, (error) => {
    console.error('[GameService] Error subscribing to user games:', error);
    callback([]);
  });
};

/**
 * Subscribe to all live games
 */
export const subscribeToLiveGames = (
  callback: (games: BasketballGame[]) => void
): Unsubscribe => {
  const gamesRef = collection(db, 'games');
  const q = query(gamesRef, where('status', '==', 'live'));

  return onSnapshot(q, (snapshot) => {
    const games = snapshot.docs.map(doc => doc.data() as BasketballGame);
    callback(games);
  }, (error) => {
    console.error('[GameService] Error subscribing to live games:', error);
    callback([]);
  });
};

/**
 * Get all live games EXCEPT the ones created by a specific user
 * @deprecated Use subscribeToOtherUsersGames instead for real-time updates
 */
export const getOtherUsersLiveGames = (userId: string): BasketballGame[] => {
  // This is a synchronous function that returns from cache
  // For real-time updates, use subscribeToOtherUsersGames instead
  console.warn('[GameService] getOtherUsersLiveGames is deprecated. Use subscribeToOtherUsersGames instead.');
  return [];
};

/**
 * Subscribe to other users' live games
 */
export const subscribeToOtherUsersGames = (
  userId: string,
  callback: (games: BasketballGame[]) => void
): Unsubscribe => {
  const gamesRef = collection(db, 'games');
  const q = query(gamesRef, where('status', '==', 'live'));

  return onSnapshot(q, (snapshot) => {
    const games = snapshot.docs
      .map(doc => doc.data() as BasketballGame)
      .filter(game => game.hostId !== userId);
    callback(games);
  }, (error) => {
    console.error('[GameService] Error subscribing to other games:', error);
    callback([]);
  });
};

// ============================================
// UPDATE OPERATIONS
// ============================================

/**
 * Update an entire game
 */
export const updateGame = async (
  code: string,
  updates: Partial<BasketballGame>
): Promise<boolean> => {
  try {
    const gameRef = doc(db, 'games', code);
    await updateDoc(gameRef, {
      ...updates,
      lastUpdate: Date.now()
    });
    return true;
  } catch (error) {
    console.error('[GameService] Error updating game:', error);
    return false;
  }
};

/**
 * Update a specific field in a game using dot notation
 * Example: updateGameField('ABC123', 'teamA.score', 50)
 */
export const updateGameField = async (
  code: string,
  fieldPath: string,
  value: any
): Promise<boolean> => {
  try {
    const gameRef = doc(db, 'games', code);
    await updateDoc(gameRef, {
      [fieldPath]: value,
      lastUpdate: Date.now()
    });
    return true;
  } catch (error) {
    console.error('[GameService] Error updating field:', error);
    return false;
  }
};

// ============================================
// OWNERSHIP & PERMISSIONS
// ============================================

/**
 * Check if a user is the owner of a game
 */
export const isGameOwner = async (gameCode: string, userId: string): Promise<boolean> => {
  const game = await getGame(gameCode);
  return game ? game.hostId === userId : false;
};

// ============================================
// DELETE OPERATIONS
// ============================================

/**
 * End a game (set status to 'final')
 */
export const endGame = async (code: string): Promise<boolean> => {
  return updateGame(code, { status: 'final' });
};

// ============================================
// INITIALIZATION HELPER
// ============================================

/**
 * Initialize a new game with full configuration
 * This is the recommended way to create games from the UI
 */
export const initializeNewGame = async (
  settings: {
    gameName: string;
    periodDuration: number;
    shotClockDuration: number;
    periodType: 'quarter' | 'half';
  },
  teamA: { name: string; color: string; players?: any[] },
  teamB: { name: string; color: string; players?: any[] },
  trackStats: boolean,
  sport: string = 'basketball'
): Promise<string> => {
  // Get current user from auth
  const { auth } = await import('./firebase');
  if (!auth.currentUser) {
    throw new Error('User must be logged in to create a game');
  }

  const gameCode = await createGame(
    { name: teamA.name, color: teamA.color },
    { name: teamB.name, color: teamB.color },
    auth.currentUser.uid,
    settings
  );

  // If tracking stats and players provided, update them
  if (trackStats && (teamA.players || teamB.players)) {
    const updates: Partial<BasketballGame> = {};

    if (teamA.players) {
      updates.teamA = {
        name: teamA.name,
        color: teamA.color,
        score: 0,
        timeouts: 2,
        timeoutsFirstHalf: 2,
        timeoutsSecondHalf: 3,
        fouls: 0,
        foulsThisQuarter: 0,
        players: teamA.players
      };
    }

    if (teamB.players) {
      updates.teamB = {
        name: teamB.name,
        color: teamB.color,
        score: 0,
        timeouts: 2,
        timeoutsFirstHalf: 2,
        timeoutsSecondHalf: 3,
        fouls: 0,
        foulsThisQuarter: 0,
        players: teamB.players
      };
    }

    await updateGame(gameCode, updates);
  }

  return gameCode;
};

// ============================================
// EXPORT
// ============================================

export default {
  generateGameCode,
  createGame,
  getGame,
  subscribeToGame,
  getUserActiveGames,
  subscribeToUserGames,
  subscribeToLiveGames,
  getOtherUsersLiveGames,
  subscribeToOtherUsersGames,
  updateGame,
  updateGameField,
  isGameOwner,
  endGame,
  initializeNewGame
};