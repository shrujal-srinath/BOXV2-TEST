import { BasketballGame, TeamData, Player } from '../types';

export let gamesDatabase: { [key: string]: BasketballGame } = {};
// New storage for archived games (older than 48h)
export let archivedGamesDatabase: { [key: string]: BasketballGame } = {};

let liveGamesListeners: { [key: string]: ((games: BasketballGame[]) => void)[] } = {};

const ARCHIVE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 Hours

export const generateGameCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// --- INTERNAL HELPERS ---
const notifyLiveListListeners = () => {
  const liveGames = Object.values(gamesDatabase).filter(g => g.status === 'live');
  Object.values(liveGamesListeners).forEach(listeners => {
    listeners.forEach(callback => callback(liveGames));
  });
};

// Move a game from Active to Archive
const archiveGame = (code: string) => {
  const game = gamesDatabase[code];
  if (game) {
    console.log(`[System] Archiving game ${code} due to age.`);
    archivedGamesDatabase[code] = { ...game, status: 'finished' };
    delete gamesDatabase[code];
    notifyLiveListListeners();
  }
};

// --- SUBSCRIPTIONS ---

export const subscribeToGame = (code: string, callback: (game: BasketballGame | null) => void): (() => void) => {
  const interval = setInterval(() => {
    if (gamesDatabase[code]) callback(gamesDatabase[code]);
  }, 1000);

  if (gamesDatabase[code]) callback(gamesDatabase[code]);
  return () => clearInterval(interval);
};

export const subscribeToLiveGames = (callback: (games: BasketballGame[]) => void): (() => void) => {
  const id = Math.random().toString();
  if (!liveGamesListeners[id]) liveGamesListeners[id] = [];
  liveGamesListeners[id].push(callback);

  // Initial call
  callback(Object.values(gamesDatabase).filter(g => g.status === 'live'));

  const interval = setInterval(() => {
    const now = Date.now();

    // 1. Check for games to Auto-Archive (Older than 48h)
    Object.values(gamesDatabase).forEach(game => {
      if (now - game.createdAt > ARCHIVE_THRESHOLD_MS) {
        archiveGame(game.code);
      }
    });

    // 2. Broadcast updates
    callback(Object.values(gamesDatabase).filter(g => g.status === 'live'));
  }, 2000);

  return () => {
    clearInterval(interval);
    delete liveGamesListeners[id];
  };
};

// --- UPDATES ---
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
};

// --- CREATION ---

export const createGame = (code: string, gameType: 'local' | 'online', hostId: string = 'anonymous'): BasketballGame => {
  const createDefaultPlayer = (id: string): Player => ({
    id, name: '', number: '', position: '', points: 0, assists: 0, rebounds: 0,
    steals: 0, blocks: 0, turnovers: 0, fouls: 0, disqualified: false,
    fieldGoalsMade: 0, fieldGoalsAttempted: 0, threePointsMade: 0,
    threePointsAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0,
  });

  const createDefaultTeam = (name: string, color: string): TeamData => ({
    name, color, score: 0, timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3,
    fouls: 0, foulsThisQuarter: 0,
    players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
  });

  const newGame: BasketballGame = {
    code,
    hostId,
    teamA: createDefaultTeam('HOME', '#DC2626'),
    teamB: createDefaultTeam('AWAY', '#2563EB'),
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
    gameType,
    createdAt: Date.now(),
    lastUpdate: Date.now(),
  };

  gamesDatabase[code] = newGame;
  notifyLiveListListeners();
  return newGame;
};

export const initializeNewGame = async (
  settings: any,
  teamA: any,
  teamB: any,
  trackStats: boolean,
  sportType: string,
  hostId: string = 'anonymous'
): Promise<string> => {
  const code = generateGameCode();
  const game = createGame(code, 'online', hostId);

  game.settings = { ...game.settings, ...settings };
  game.gameState.gameTime.minutes = settings.periodDuration;
  game.gameState.shotClock = settings.shotClockDuration;

  if (teamA.name) game.teamA.name = teamA.name;
  if (teamA.color) game.teamA.color = teamA.color;
  if (teamA.players) game.teamA.players = teamA.players;

  if (teamB.name) game.teamB.name = teamB.name;
  if (teamB.color) game.teamB.color = teamB.color;
  if (teamB.players) game.teamB.players = teamB.players;

  game.sport = sportType;

  gamesDatabase[code] = game;
  notifyLiveListListeners();
  return code;
};

// --- FILTERS ---

export const getUserActiveGames = (userId: string): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(
    game => game.hostId === userId && game.status === 'live'
  );
};

export const getOtherUsersLiveGames = (userId: string): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(
    game => game.hostId !== userId && game.status === 'live'
  );
};

export const isGameOwner = (code: string, userId: string): boolean => {
  const game = gamesDatabase[code];
  return game ? game.hostId === userId : false;
};

export const getGame = (code: string) => gamesDatabase[code] || null;
export const joinGame = async (code: string) => gamesDatabase[code] || null;

// Manually delete a game
export const deleteGame = (code: string) => {
  if (gamesDatabase[code]) {
    delete gamesDatabase[code];
    notifyLiveListListeners();
  }
};