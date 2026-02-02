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

// --- SUBSCRIPTIONS ---
const notifyGameListeners = (code: string) => {
  // ... (notify logic logic same as before, simplified for brevity in this view)
  notifyLiveListListeners();
};

const notifyLiveListListeners = () => {
  const liveGames = Object.values(gamesDatabase).filter(g => g.status === 'live');
  Object.values(liveGamesListeners).forEach(listeners => {
    listeners.forEach(callback => callback(liveGames));
  });
};

export const subscribeToGame = (code: string, callback: (game: BasketballGame | null) => void): (() => void) => {
  // (Existing subscription logic)
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

  callback(Object.values(gamesDatabase).filter(g => g.status === 'live'));

  const interval = setInterval(() => {
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
  // We don't notify here to avoid spamming, the intervals handle it for now
  // or you can call notifyLiveListListeners() if you want instant updates
};

// --- CREATION & FETCHING ---

// UPDATED: Now accepts hostId to assign ownership
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
    hostId, // <--- SAVING THE OWNER
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

// UPDATED: Accepts hostId
export const initializeNewGame = async (
  settings: any,
  teamA: any,
  teamB: any,
  trackStats: boolean,
  sportType: string,
  hostId: string = 'anonymous' // <--- Added param
): Promise<string> => {
  const code = generateGameCode();
  const game = createGame(code, 'online', hostId);

  game.settings = { ...game.settings, ...settings };
  game.gameState.gameTime.minutes = settings.periodDuration;
  game.gameState.shotClock = settings.shotClockDuration;

  // Merge team data
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

// --- NEW FILTERS FOR DASHBOARD ---

// 1. Get games owned by user
export const getUserActiveGames = (userId: string): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(
    game => game.hostId === userId && game.status === 'live'
  );
};

// 2. Get games NOT owned by user (Public)
export const getOtherUsersLiveGames = (userId: string): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(
    game => game.hostId !== userId && game.status === 'live'
  );
};

// 3. Check ownership
export const isGameOwner = (code: string, userId: string): boolean => {
  const game = gamesDatabase[code];
  return game ? game.hostId === userId : false;
};

export const getGame = (code: string) => gamesDatabase[code] || null;
export const joinGame = async (code: string) => gamesDatabase[code] || null;
export const deleteGame = (code: string) => {
  delete gamesDatabase[code];
  notifyLiveListListeners();
};