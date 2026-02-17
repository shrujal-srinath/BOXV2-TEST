// src/services/gameService.ts
/**
 * GAME SERVICE - HYBRID ARCHITECTURE (Firestore + RTDB)
 * * RESPONSIBILITIES:
 * 1. Firestore: Durable storage (Settings, Rosters, Logs, Final Results)
 * 2. RTDB: Initialization & Cleanup of Hot Data (Clock/Score)
 * * NOTE: Live clock/score signaling is handled by 'rtdbClockService.ts'.
 * This service handles the setup, persistence, and teardown.
 */

import { doc, setDoc, updateDoc, getDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
import { db, rtdb } from './firebase';
import type { BasketballGame, GameSettings, TeamData, GameState, Player } from '../types';

// ============================================
// FIREBASE FIRESTORE OPERATIONS (COLD DATA)
// ============================================

/**
 * Subscribe to the "Cold" game data (Rosters, Fouls, Logs)
 */
export const subscribeToGame = (
  code: string,
  callback: (game: BasketballGame | null) => void
): (() => void) => {
  if (!code) {
    callback(null);
    return () => { };
  }
  const gameRef = doc(db, 'games', code);
  return onSnapshot(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as BasketballGame);
    } else {
      callback(null);
    }
  });
};

/**
 * Subscribe to the global feed of live games.
 * Filters out games that haven't been updated in 24 hours.
 */
export const subscribeToLiveGames = (
  callback: (games: BasketballGame[]) => void
): (() => void) => {
  const gamesQuery = query(collection(db, 'games'), where('status', '==', 'live'));

  return onSnapshot(gamesQuery, (snapshot) => {
    const games: BasketballGame[] = [];
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    snapshot.forEach((doc) => {
      const data = doc.data() as BasketballGame;
      // Filter out zombie games > 24h old
      if (data.lastUpdate && (now - data.lastUpdate < ONE_DAY_MS)) {
        games.push(data);
      }
    });
    // Sort by newest update first
    games.sort((a, b) => b.lastUpdate - a.lastUpdate);
    callback(games);
  });
};

/**
 * Update a specific field in Firestore (e.g., Team Name, Player stats)
 */
export const updateGameField = async (gameId: string, fieldPath: string, value: any) => {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, { [fieldPath]: value, lastUpdate: Date.now() });
};

/**
 * Update multiple fields in one batch
 */
export const batchUpdateGame = async (gameId: string, updates: Record<string, any>) => {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, { ...updates, lastUpdate: Date.now() });
};

/**
 * Finish a game (Mark as completed)
 * This removes it from the Live Feed and clears RTDB bandwidth.
 */
export const finishGame = async (gameId: string) => {
  await updateDoc(doc(db, 'games', gameId), { status: 'completed', lastUpdate: Date.now() });
  // Clear RTDB hot data to stop broadcasting
  if (rtdb) await set(ref(rtdb, `games/${gameId}`), null);
}

/**
 * Delete a game from BOTH Firestore and RTDB
 */
export const deleteGame = async (code: string): Promise<void> => {
  if (!code) return;

  // 1. Delete from Firestore
  await deleteDoc(doc(db, 'games', code));

  // 2. Delete from RTDB (if configured)
  if (rtdb) {
    await set(ref(rtdb, `games/${code}`), null);
  }
};

// ============================================
// GAME CREATION
// ============================================

const generateGameCode = (): string => Math.floor(100000 + Math.random() * 900000).toString();

const createDefaultPlayer = (id: string): Player => ({
  id, name: '', number: '', position: '', points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0, disqualified: false, fieldGoalsMade: 0, fieldGoalsAttempted: 0, threePointsMade: 0, threePointsAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0,
});

const createDefaultTeam = (name: string, color: string): TeamData => ({
  name, color, score: 0, timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3, fouls: 0, foulsThisQuarter: 0, players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
});

/**
 * Initialize a new game
 * Sets up the Firestore document AND the initial RTDB structure.
 */
export const initializeNewGame = async (
  settings: GameSettings,
  teamA: Partial<TeamData> & { name: string; color: string },
  teamB: Partial<TeamData> & { name: string; color: string },
  isOnline: boolean,
  sport: string,
  hostId: string
): Promise<string> => {

  const gameCode = generateGameCode();

  // 1. Setup Firestore (Cold Data)
  const initialGameState: GameState = {
    period: 1,
    gameTime: { minutes: settings.periodDuration, seconds: 0, tenths: 0 },
    shotClock: settings.shotClockDuration,
    gameRunning: false,
    shotClockRunning: false,
    possession: 'A'
  };

  const newGame: BasketballGame = {
    code: gameCode,
    hostId,
    sport,
    status: 'live',
    gameType: isOnline ? 'online' : 'local',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    settings,
    gameState: initialGameState,
    teamA: { ...createDefaultTeam(teamA.name, teamA.color), ...teamA },
    teamB: { ...createDefaultTeam(teamB.name, teamB.color), ...teamB }
  };

  await setDoc(doc(db, 'games', gameCode), newGame);

  // 2. Setup RTDB (Hot Data)
  // We initialize the specific node for this game to avoid "undefined" reads on the client.
  // Note: We use 'clock' and 'score' to match rtdbClockService.ts structure.
  if (rtdb) {
    const initialRTDBState = {
      clock: {
        gameRunning: false,
        shotClockRunning: false,
        minutes: settings.periodDuration,
        seconds: 0,
        shotClock: settings.shotClockDuration,
        period: 1,
        startedAt: null,
        shotClockStartedAt: null
      },
      score: {
        teamA: 0,
        teamB: 0,
        foulsA: 0,
        foulsB: 0,
        timeoutsA: 2,
        timeoutsB: 2,
        possession: 'A'
      }
    };

    await set(ref(rtdb, `games/${gameCode}`), initialRTDBState);
  }

  return gameCode;
};

// Aliases for compatibility
export const getGameByCode = async (code: string) => {
  const snap = await getDoc(doc(db, 'games', code));
  return snap.exists() ? snap.data() as BasketballGame : null;
};
export const getGame = getGameByCode;
export const getGamesByHost = async (hostId: string) => {
  const q = query(collection(db, 'games'), where('hostId', '==', hostId), where('status', '==', 'live'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as BasketballGame);
};