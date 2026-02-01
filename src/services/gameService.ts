import { BasketballGame, TeamData, Player } from '../types';
import { db } from './firebase'; // Ensure db is imported if you use it, or mock it
// If not using real firebase for creation yet, we mock the database:
import { doc, setDoc } from 'firebase/firestore';

// Mock Database for local state
export let gamesDatabase: { [key: string]: BasketballGame } = {};
let liveGamesListeners: { [key: string]: ((games: BasketballGame[]) => void)[] } = {};

// --- HELPER: Generate Code ---
export const generateGameCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// --- CORE: Initialize New Game (The missing function) ---
export const initializeNewGame = async (
  settings: any,
  teamA: any,
  teamB: any,
  trackStats: boolean,
  sportType: string
): Promise<string> => {
  const code = generateGameCode();

  const newGame: BasketballGame = {
    code,
    hostId: 'current-user', // In prod, get from auth
    teamA: {
      ...teamA,
      score: 0,
      timeouts: 2,
      timeoutsFirstHalf: 2,
      timeoutsSecondHalf: 3,
      fouls: 0,
      foulsThisQuarter: 0,
    },
    teamB: {
      ...teamB,
      score: 0,
      timeouts: 2,
      timeoutsFirstHalf: 2,
      timeoutsSecondHalf: 3,
      fouls: 0,
      foulsThisQuarter: 0,
    },
    gameState: {
      period: 1,
      gameTime: { minutes: settings.periodDuration, seconds: 0, tenths: 0 },
      shotClock: settings.shotClockDuration,
      gameRunning: false,
      shotClockRunning: false,
      possession: 'A',
    },
    settings: {
      gameName: settings.gameName,
      periodDuration: settings.periodDuration,
      shotClockDuration: settings.shotClockDuration,
      periodType: settings.periodType || 'quarter'
    },
    sport: sportType,
    status: 'live',
    gameType: 'online',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
  };

  // Save to Memory (Mock)
  gamesDatabase[code] = newGame;

  // Notify Listeners
  notifyLiveGamesListeners();

  // TODO: In production, save to Firebase here:
  // await setDoc(doc(db, 'games', code), newGame);

  return code;
};

// Create a new game with defaults
export const createGame = (code: string, gameType: 'local' | 'online'): BasketballGame => {
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

  const newGame: BasketballGame = {
    code,
    teamA: createDefaultTeam('Team A', '#FF0000'),
    teamB: createDefaultTeam('Team B', '#0000FF'),
    gameState: {
      period: 1,
      gameTime: { minutes: 10, seconds: 0, tenths: 0 },
      shotClock: 24,
      gameRunning: false,
      shotClockRunning: false,
      possession: 'A',
    },
    settings: {
      gameName: 'New Game',
      periodDuration: 10,
      shotClockDuration: 24,
      periodType: 'quarter'
    },
    sport: 'basketball',
    status: 'live',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    gameType,
  };

  gamesDatabase[code] = newGame;
  notifyLiveGamesListeners();
  return newGame;
};

export const createOnlineGame = async (code: string): Promise<BasketballGame> => {
  return createGame(code, 'online');
};

export const getGame = (code: string): BasketballGame | null => {
  return gamesDatabase[code] || null;
};

export const getLiveGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(game => game.gameType === 'online');
};

export const getUserActiveGames = (userId?: string): BasketballGame[] => {
  return Object.values(gamesDatabase);
};

export const getUserLocalGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(game => game.gameType === 'local');
};

export const getUserOnlineGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(game => game.gameType === 'online');
};

// Subscribe to live games list
export const subscribeToLiveGames = (callback: (games: BasketballGame[]) => void): (() => void) => {
  const listenerId = Math.random().toString(36);
  if (!liveGamesListeners[listenerId]) {
    liveGamesListeners[listenerId] = [];
  }
  liveGamesListeners[listenerId].push(callback);

  callback(getLiveGames());

  const interval = setInterval(() => {
    callback(getLiveGames());
  }, 2000);

  return () => {
    clearInterval(interval);
    delete liveGamesListeners[listenerId];
  };
};

export const subscribeToUserGames = (callback: (games: BasketballGame[]) => void): (() => void) => {
  callback(getUserActiveGames());
  const interval = setInterval(() => {
    callback(getUserActiveGames());
  }, 2000);
  return () => {
    clearInterval(interval);
  };
};

const notifyLiveGamesListeners = () => {
  const liveGames = getLiveGames();
  Object.values(liveGamesListeners).forEach(listeners => {
    listeners.forEach(callback => callback(liveGames));
  });
};

export const joinGame = async (code: string): Promise<BasketballGame | null> => {
  return getGame(code);
};

export const updateGameField = (code: string, path: string, value: any): void => {
  const game = gamesDatabase[code];
  if (!game) {
    console.error(`Game ${code} not found`);
    return;
  }

  const keys = path.split('.');
  let current: any = game;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;

  game.lastUpdate = Date.now();
  notifyLiveGamesListeners();

  if (game.gameType === 'local') {
    saveGameToLocal(game);
  }
};

export const subscribeToGame = (
  code: string,
  callback: (game: BasketballGame | null) => void
): (() => void) => {
  const game = gamesDatabase[code];
  if (game) {
    callback(game);
  }

  const interval = setInterval(() => {
    const updatedGame = gamesDatabase[code];
    if (updatedGame) {
      callback(updatedGame);
    }
  }, 1000);

  return () => {
    clearInterval(interval);
  };
};

export const deleteGame = (code: string): void => {
  if (gamesDatabase[code]) {
    delete gamesDatabase[code];
    try {
      localStorage.removeItem(`game_${code}`);
    } catch (error) {
      console.error('Failed to delete from localStorage:', error);
    }
    notifyLiveGamesListeners();
  }
};

export const saveGameToLocal = (game: BasketballGame): void => {
  try {
    localStorage.setItem(`game_${game.code}`, JSON.stringify(game));
  } catch (error) {
    console.error('Failed to save game to local storage:', error);
  }
};

export const loadGameFromLocal = (code: string): BasketballGame | null => {
  try {
    const saved = localStorage.getItem(`game_${code}`);
    if (saved) {
      const game = JSON.parse(saved);
      gamesDatabase[code] = game;
      return game;
    }
  } catch (error) {
    console.error('Failed to load game from local storage:', error);
  }
  return null;
};

export const loadAllGamesFromLocal = (): BasketballGame[] => {
  const games: BasketballGame[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('game_')) {
        const gameData = localStorage.getItem(key);
        if (gameData) {
          const game = JSON.parse(gameData);
          gamesDatabase[game.code] = game;
          games.push(game);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load games from local storage:', error);
  }
  return games;
};

export const resetShotClock = (code: string, value: number = 24): void => {
  updateGameField(code, 'gameState.shotClock', value);
};

export const isPlayerDisqualified = (player: Player): boolean => {
  return player.disqualified || player.fouls >= 5;
};

export const getAvailableTimeouts = (team: TeamData, period: number): number => {
  if (period <= 2) {
    return team.timeoutsFirstHalf;
  } else if (period <= 4) {
    return team.timeoutsSecondHalf;
  } else {
    return 1;
  }
};

export const isTeamInBonus = (team: TeamData): boolean => {
  return team.foulsThisQuarter >= 4;
};

export const gameCodeExists = (code: string): boolean => {
  return gamesDatabase[code] !== undefined;
};