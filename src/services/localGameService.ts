// src/services/localGameService.ts (Updated createLocalGame)
import type { BasketballGame, AppSettings, LocalGameLibrary, LocalGameMetadata } from '../types';

const STORAGE_KEYS = {
  LOCAL_GAMES: 'BOX_V2_LOCAL_GAMES',
  ACTIVE_GAME: 'BOX_V2_ACTIVE_LOCAL_GAME',
  SYNC_PENDING: 'BOX_V2_SYNC_PENDING',
  APP_SETTINGS: 'BOX_V2_APP_SETTINGS',
} as const;

const MAX_LOCAL_GAMES = 50;

const generateLocalGameId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'LOCAL-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const safeJSONParse = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.error(`[LocalGameService] Failed to parse ${key}:`, error);
    return fallback;
  }
};

const safeJSONSave = (key: string, data: any): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`[LocalGameService] Failed to save ${key}:`, error);
    return false;
  }
};

export const getLocalGameLibrary = (): LocalGameLibrary => {
  return safeJSONParse<LocalGameLibrary>(STORAGE_KEYS.LOCAL_GAMES, {
    games: [],
    activeGameId: null,
  });
};

const saveLocalGameLibrary = (library: LocalGameLibrary): boolean => {
  if (library.games.length > MAX_LOCAL_GAMES) {
    library.games.sort((a, b) => {
      if (a.synced === b.synced) return a.lastModified - b.lastModified;
      return a.synced ? 1 : -1;
    });
    library.games = library.games.slice(-MAX_LOCAL_GAMES);
  }
  return safeJSONSave(STORAGE_KEYS.LOCAL_GAMES, library);
};

export const createLocalGame = (
  teamAName: string,
  teamBName: string,
  periodDuration: number = 10,
  shotClockDuration: number = 24
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
      color: '#DC2626',
      score: 0,
      timeouts: 2,
      timeoutsFirstHalf: 2,
      timeoutsSecondHalf: 3,
      fouls: 0,
      foulsThisQuarter: 0,
      players: [],
    },
    teamB: {
      name: teamBName || 'AWAY',
      color: '#2563EB',
      score: 0,
      timeouts: 2,
      timeoutsFirstHalf: 2,
      timeoutsSecondHalf: 3,
      fouls: 0,
      foulsThisQuarter: 0,
      players: [],
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

export const getLocalGame = (gameId: string): LocalGameMetadata | null => {
  const library = getLocalGameLibrary();
  return library.games.find(g => g.id === gameId) || null;
};

export const updateLocalGame = (gameId: string, updatedGame: BasketballGame): boolean => {
  const library = getLocalGameLibrary();
  const gameIndex = library.games.findIndex(g => g.id === gameId);
  if (gameIndex === -1) return false;

  library.games[gameIndex].game = updatedGame;
  library.games[gameIndex].lastModified = Date.now();
  library.games[gameIndex].synced = false;

  return saveLocalGameLibrary(library);
};

export const deleteLocalGame = (gameId: string): boolean => {
  const library = getLocalGameLibrary();
  const initialLength = library.games.length;
  library.games = library.games.filter(g => g.id !== gameId);
  if (library.activeGameId === gameId) library.activeGameId = null;
  if (library.games.length < initialLength) return saveLocalGameLibrary(library);
  return false;
};

export const setActiveLocalGame = (gameId: string): boolean => {
  const library = getLocalGameLibrary();
  if (!library.games.find(g => g.id === gameId)) return false;
  library.activeGameId = gameId;
  return saveLocalGameLibrary(library);
};

export const getActiveLocalGame = (): LocalGameMetadata | null => {
  const library = getLocalGameLibrary();
  if (!library.activeGameId) return null;
  return library.games.find(g => g.id === library.activeGameId) || null;
};

export const markGameAsSynced = (localGameId: string, cloudGameId: string): boolean => {
  const library = getLocalGameLibrary();
  const game = library.games.find(g => g.id === localGameId);
  if (!game) return false;
  game.synced = true;
  game.cloudId = cloudGameId;
  game.lastModified = Date.now();
  return saveLocalGameLibrary(library);
};

export const getPendingSyncGames = (): LocalGameMetadata[] => {
  const library = getLocalGameLibrary();
  return library.games.filter(g => !g.synced);
};

export const clearSyncedGames = (): boolean => {
  const settings = getAppSettings();
  if (!settings.keepSyncedGames) {
    const library = getLocalGameLibrary();
    library.games = library.games.filter(g => !g.synced);
    return saveLocalGameLibrary(library);
  }
  return false;
};

export const getAppSettings = (): AppSettings => {
  return safeJSONParse<AppSettings>(STORAGE_KEYS.APP_SETTINGS, {
    autoSync: true,
    keepSyncedGames: true,
    vibrationEnabled: true,
    defaultPeriodDuration: 10,
    defaultShotClock: 24,
  });
};

export const updateAppSettings = (settings: Partial<AppSettings>): boolean => {
  const current = getAppSettings();
  const updated = { ...current, ...settings };
  return safeJSONSave(STORAGE_KEYS.APP_SETTINGS, updated);
};

export const getStorageStats = () => {
  const library = getLocalGameLibrary();
  return {
    totalGames: library.games.length,
    syncedGames: library.games.filter(g => g.synced).length,
    pendingGames: library.games.filter(g => !g.synced).length,
    maxGames: MAX_LOCAL_GAMES,
    storageAvailable: MAX_LOCAL_GAMES - library.games.length,
    oldestGame: library.games.length > 0 ? new Date(Math.min(...library.games.map(g => g.createdAt))) : null,
    newestGame: library.games.length > 0 ? new Date(Math.max(...library.games.map(g => g.createdAt))) : null,
  };
};

export const exportLocalGames = (): string => {
  const library = getLocalGameLibrary();
  return JSON.stringify(library, null, 2);
};

export const importLocalGames = (jsonData: string): boolean => {
  try {
    const importedLibrary = JSON.parse(jsonData) as LocalGameLibrary;
    if (!importedLibrary.games || !Array.isArray(importedLibrary.games)) throw new Error('Invalid import format');
    const currentLibrary = getLocalGameLibrary();
    const existingIds = new Set(currentLibrary.games.map(g => g.id));
    const newGames = importedLibrary.games.filter(g => !existingIds.has(g.id));
    currentLibrary.games.push(...newGames);
    return saveLocalGameLibrary(currentLibrary);
  } catch (error) {
    console.error('[LocalGameService] Import failed:', error);
    return false;
  }
};

export const clearAllLocalData = (): boolean => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    return true;
  } catch (error) {
    console.error('[LocalGameService] Clear failed:', error);
    return false;
  }
};

export default {
  createLocalGame,
  getLocalGame,
  updateLocalGame,
  deleteLocalGame,
  getLocalGameLibrary,
  setActiveLocalGame,
  getActiveLocalGame,
  markGameAsSynced,
  getPendingSyncGames,
  clearSyncedGames,
  getAppSettings,
  updateAppSettings,
  getStorageStats,
  exportLocalGames,
  importLocalGames,
  clearAllLocalData,
};