import { BasketballGame, TeamData, Player } from '../types';

export let gamesDatabase: { [key: string]: BasketballGame } = {};
let liveGamesListeners: { [key: string]: ((games: BasketballGame[]) => void)[] } = {};

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
    hostId: 'current-user',
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

  gamesDatabase[code] = newGame;
  notifyLiveGamesListeners();
  return code;
};

// ... (Rest of existing service code) ...

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

// FIXED: Now accepts arguments (userId) even if using mock data
export const getUserActiveGames = (userId?: string): BasketballGame[] => {
  return Object.values(gamesDatabase);
};

export const getUserLocalGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(game => game.gameType === 'local');
};

export const getUserOnlineGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(game => game.gameType === 'online');
};

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
  if (!game) return;

  const keys = path.split('.');
  let current: any = game;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;

  game.lastUpdate = Date.now();
  notifyLiveGamesListeners();
};

export const subscribeToGame = (code: string, callback: (game: BasketballGame | null) => void): (() => void) => {
  const game = gamesDatabase[code];
  if (game) callback(game);
  const interval = setInterval(() => {
    const updatedGame = gamesDatabase[code];
    if (updatedGame) callback(updatedGame);
  }, 1000);
  return () => clearInterval(interval);
};

export const deleteGame = (code: string): void => {
  if (gamesDatabase[code]) {
    delete gamesDatabase[code];
    notifyLiveGamesListeners();
  }
};