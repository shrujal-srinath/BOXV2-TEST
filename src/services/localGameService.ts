// src/services/localGameService.ts
/**
 * LOCAL GAME SERVICE
 * Handles all offline-first game operations without requiring Firebase
 * Storage: localStorage with IndexedDB fallback (future)
 */

import type { BasketballGame } from '../types';

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEYS = {
  LOCAL_GAMES: 'BOX_V2_LOCAL_GAMES',
  ACTIVE_GAME: 'BOX_V2_ACTIVE_LOCAL_GAME',
  SYNC_PENDING: 'BOX_V2_SYNC_PENDING',
  APP_SETTINGS: 'BOX_V2_APP_SETTINGS',
} as const;

const MAX_LOCAL_GAMES = 50; // Storage limit

// ============================================
// TYPES (DEFINED AND EXPORTED HERE)
// ============================================

export interface LocalGameMetadata {
  id: string;                    // LOCAL-ABC123
  createdAt: number;             // Timestamp
  lastModified: number;          // Timestamp
  synced: boolean;               // Has been uploaded to cloud
  cloudId: string | null;        // Firebase game code (if synced)
  game: BasketballGame;          // Full game data
}

export interface LocalGameLibrary {
  games: LocalGameMetadata[];
  activeGameId: string | null;
}

export interface AppSettings {
  autoSync: boolean;
  keepSyncedGames: boolean;
  vibrationEnabled: boolean;
  defaultPeriodDuration: number;
  defaultShotClock: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique local game ID
 * Format: LOCAL-A1B2C3
 */
const generateLocalGameId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'LOCAL-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * Safely parse JSON from localStorage
 */
const safeJSONParse = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.error(`[LocalGameService] Failed to parse ${key}:`, error);
    return fallback;
  }
};

/**
 * Safely stringify and save to localStorage
 */
const safeJSONSave = (key: string, data: any): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`[LocalGameService] Failed to save ${key}:`, error);
    // Handle quota exceeded
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('[LocalGameService] Storage quota exceeded. Consider cleaning old games.');
    }
    return false;
  }
};

// ============================================
// LIBRARY MANAGEMENT
// ============================================

/**
 * Get all local games
 */
export const getLocalGameLibrary = (): LocalGameLibrary => {
  return safeJSONParse<LocalGameLibrary>(STORAGE_KEYS.LOCAL_GAMES, {
    games: [],
    activeGameId: null,
  });
};

/**
 * Save entire library
 */
const saveLocalGameLibrary = (library: LocalGameLibrary): boolean => {
  // Enforce game limit
  if (library.games.length > MAX_LOCAL_GAMES) {
    // Remove oldest unsynced games first, then oldest synced
    library.games.sort((a, b) => {
      if (a.synced === b.synced) return a.lastModified - b.lastModified;
      return a.synced ? 1 : -1; // Unsynced games have priority to keep
    });
    library.games = library.games.slice(-MAX_LOCAL_GAMES);
  }

  return safeJSONSave(STORAGE_KEYS.LOCAL_GAMES, library);
};

// ============================================
// GAME CRUD OPERATIONS
// ============================================

/**
 * Create a new local game
 */
export const createLocalGame = (
  teamAName: string,
  teamBName: string,
  periodDuration: number = 10,
  shotClockDuration: number = 24,
  teamAColor: string = '#DC2626',
  teamBColor: string = '#2563EB',
  teamARoster: any[] = [],
  teamBRoster: any[] = []
): LocalGameMetadata | null => {
  const gameId = generateLocalGameId();
  const now = Date.now();

  const newGame: BasketballGame = {
    hostId: 'local-user',
    code: gameId,
    gameType: 'local',
    sport: 'basketball',
    status: 'live',
    settings: {
      gameName: `${teamAName} vs ${teamBName}`,
      periodDuration,
      shotClockDuration,
      periodType: 'quarter',
    },
    teamA: {
      name: teamAName || 'HOME',
      color: teamAColor,
      score: 0,
      timeouts: 2,
      timeoutsFirstHalf: 2,
      timeoutsSecondHalf: 3,
      fouls: 0,
      foulsThisQuarter: 0,
      players: teamARoster,
    },
    teamB: {
      name: teamBName || 'AWAY',
      color: teamBColor,
      score: 0,
      timeouts: 2,
      timeoutsFirstHalf: 2,
      timeoutsSecondHalf: 3,
      fouls: 0,
      foulsThisQuarter: 0,
      players: teamBRoster,
    },
    gameState: {
      period: 1,
      gameTime: { minutes: periodDuration, seconds: 0, tenths: 0 },
      shotClock: shotClockDuration,
      possession: 'A',
      gameRunning: false,
      shotClockRunning: false,
    },
    createdAt: now,
    lastUpdate: now,
  };

  const metadata: LocalGameMetadata = {
    id: gameId,
    createdAt: now,
    lastModified: now,
    synced: false,
    cloudId: null,
    game: newGame,
  };

  const library = getLocalGameLibrary();
  library.games.push(metadata);
  library.activeGameId = gameId;

  const success = saveLocalGameLibrary(library);

  if (success) {
    console.log(`[LocalGameService] Created game: ${gameId}`);
    return metadata;
  }

  return null;
};

/**
 * Get a specific game by ID
 */
export const getLocalGame = (gameId: string): LocalGameMetadata | null => {
  const library = getLocalGameLibrary();
  return library.games.find(g => g.id === gameId) || null;
};

/**
 * Update an existing local game
 */
export const updateLocalGame = (gameId: string, updatedGame: BasketballGame): boolean => {
  const library = getLocalGameLibrary();
  const gameIndex = library.games.findIndex(g => g.id === gameId);

  if (gameIndex === -1) {
    console.error(`[LocalGameService] Game not found: ${gameId}`);
    return false;
  }

  // Update the game data
  library.games[gameIndex].game = updatedGame;
  library.games[gameIndex].lastModified = Date.now();
  library.games[gameIndex].synced = false; // Mark as needing sync

  return saveLocalGameLibrary(library);
};

/**
 * Delete a local game
 */
export const deleteLocalGame = (gameId: string): boolean => {
  const library = getLocalGameLibrary();
  const initialLength = library.games.length;

  library.games = library.games.filter(g => g.id !== gameId);

  // If this was the active game, clear it
  if (library.activeGameId === gameId) {
    library.activeGameId = null;
  }

  if (library.games.length < initialLength) {
    console.log(`[LocalGameService] Deleted game: ${gameId}`);
    return saveLocalGameLibrary(library);
  }

  return false;
};

/**
 * Set active game
 */
export const setActiveLocalGame = (gameId: string): boolean => {
  const library = getLocalGameLibrary();

  // Verify game exists
  if (!library.games.find(g => g.id === gameId)) {
    console.error(`[LocalGameService] Cannot set active: Game not found: ${gameId}`);
    return false;
  }

  library.activeGameId = gameId;
  return saveLocalGameLibrary(library);
};

/**
 * Get currently active game
 */
export const getActiveLocalGame = (): LocalGameMetadata | null => {
  const library = getLocalGameLibrary();
  if (!library.activeGameId) return null;
  return library.games.find(g => g.id === library.activeGameId) || null;
};

// ============================================
// SYNC MANAGEMENT
// ============================================

/**
 * Mark a game as synced to cloud
 */
export const markGameAsSynced = (localGameId: string, cloudGameId: string): boolean => {
  const library = getLocalGameLibrary();
  const game = library.games.find(g => g.id === localGameId);

  if (!game) return false;

  game.synced = true;
  game.cloudId = cloudGameId;
  game.lastModified = Date.now();

  return saveLocalGameLibrary(library);
};

/**
 * Get all games pending sync
 */
export const getPendingSyncGames = (): LocalGameMetadata[] => {
  const library = getLocalGameLibrary();
  return library.games.filter(g => !g.synced);
};

/**
 * Clear synced games (optional cleanup)
 */
export const clearSyncedGames = (): boolean => {
  const settings = getAppSettings();
  if (!settings.keepSyncedGames) {
    const library = getLocalGameLibrary();
    const initialCount = library.games.length;

    library.games = library.games.filter(g => !g.synced);

    console.log(`[LocalGameService] Cleared ${initialCount - library.games.length} synced games`);
    return saveLocalGameLibrary(library);
  }
  return false;
};

// ============================================
// SETTINGS MANAGEMENT
// ============================================

/**
 * Get app settings
 */
export const getAppSettings = (): AppSettings => {
  return safeJSONParse<AppSettings>(STORAGE_KEYS.APP_SETTINGS, {
    autoSync: true,
    keepSyncedGames: true,
    vibrationEnabled: true,
    defaultPeriodDuration: 10,
    defaultShotClock: 24,
  });
};

/**
 * Update app settings
 */
export const updateAppSettings = (settings: Partial<AppSettings>): boolean => {
  const current = getAppSettings();
  const updated = { ...current, ...settings };
  return safeJSONSave(STORAGE_KEYS.APP_SETTINGS, updated);
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get storage usage stats
 */
export const getStorageStats = () => {
  const library = getLocalGameLibrary();

  return {
    totalGames: library.games.length,
    syncedGames: library.games.filter(g => g.synced).length,
    pendingGames: library.games.filter(g => !g.synced).length,
    maxGames: MAX_LOCAL_GAMES,
    storageAvailable: MAX_LOCAL_GAMES - library.games.length,
    oldestGame: library.games.length > 0
      ? new Date(Math.min(...library.games.map(g => g.createdAt)))
      : null,
    newestGame: library.games.length > 0
      ? new Date(Math.max(...library.games.map(g => g.createdAt)))
      : null,
  };
};

/**
 * Export all local games as JSON (for backup)
 */
export const exportLocalGames = (): string => {
  const library = getLocalGameLibrary();
  return JSON.stringify(library, null, 2);
};

/**
 * Import games from JSON backup
 */
export const importLocalGames = (jsonData: string): boolean => {
  try {
    const importedLibrary = JSON.parse(jsonData) as LocalGameLibrary;

    // Validate structure
    if (!importedLibrary.games || !Array.isArray(importedLibrary.games)) {
      throw new Error('Invalid import format');
    }

    // Merge with existing games (avoid duplicates)
    const currentLibrary = getLocalGameLibrary();
    const existingIds = new Set(currentLibrary.games.map(g => g.id));

    const newGames = importedLibrary.games.filter(g => !existingIds.has(g.id));

    currentLibrary.games.push(...newGames);

    console.log(`[LocalGameService] Imported ${newGames.length} games`);
    return saveLocalGameLibrary(currentLibrary);

  } catch (error) {
    console.error('[LocalGameService] Import failed:', error);
    return false;
  }
};

/**
 * Clear ALL local data (factory reset)
 */
export const clearAllLocalData = (): boolean => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('[LocalGameService] All local data cleared');
    return true;
  } catch (error) {
    console.error('[LocalGameService] Clear failed:', error);
    return false;
  }
};

// ============================================
// EXPORT DEFAULT API
// ============================================

export default {
  // CRUD
  createLocalGame,
  getLocalGame,
  updateLocalGame,
  deleteLocalGame,

  // Library
  getLocalGameLibrary,
  setActiveLocalGame,
  getActiveLocalGame,

  // Sync
  markGameAsSynced,
  getPendingSyncGames,
  clearSyncedGames,

  // Settings
  getAppSettings,
  updateAppSettings,

  // Utils
  getStorageStats,
  exportLocalGames,
  importLocalGames,
  clearAllLocalData,
};