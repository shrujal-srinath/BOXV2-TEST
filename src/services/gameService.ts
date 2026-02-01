import { BasketballGame, Team, GameAction } from './types';

// In-memory database (replace with Firebase in production)
const gamesDatabase: Record<string, BasketballGame> = {};

/**
 * Generate a random 6-digit game code
 */
export const generateGameCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/**
 * Create a new game
 */
export const createGame = (
  homeTeam: Team,
  awayTeam: Team,
  hostId: string,
  hostName: string
): BasketballGame => {
  const code = generateGameCode();
  const now = new Date().toISOString();

  const newGame: BasketballGame = {
    id: code,
    code,
    homeTeam: {
      ...homeTeam,
      score: 0,
      fouls: 0,
      timeouts: 4,
    },
    awayTeam: {
      ...awayTeam,
      score: 0,
      fouls: 0,
      timeouts: 4,
    },
    quarter: 1,
    clock: '10:00',
    status: 'live',
    actions: [],
    createdAt: now,
    updatedAt: now,
    hostId,
    hostName,
  };

  gamesDatabase[code] = newGame;
  return newGame;
};

/**
 * Get a game by code
 */
export const getGame = (code: string): BasketballGame | undefined => {
  return gamesDatabase[code];
};

/**
 * Update a game
 */
export const updateGame = (code: string, updates: Partial<BasketballGame>): BasketballGame | undefined => {
  const game = gamesDatabase[code];
  if (!game) return undefined;

  const updatedGame = {
    ...game,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  gamesDatabase[code] = updatedGame;
  return updatedGame;
};

/**
 * Add an action to a game
 */
export const addGameAction = (code: string, action: GameAction): BasketballGame | undefined => {
  const game = gamesDatabase[code];
  if (!game) return undefined;

  const updatedGame = {
    ...game,
    actions: [...game.actions, action],
    updatedAt: new Date().toISOString(),
  };

  gamesDatabase[code] = updatedGame;
  return updatedGame;
};

/**
 * Get all games created by a specific user (THEIR OWN games only)
 */
export const getUserActiveGames = (userId: string): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(
    game => game.hostId === userId && game.status === 'live'
  );
};

/**
 * Get all live games in the system (for browsing/watching)
 */
export const getAllLiveGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(
    game => game.status === 'live'
  );
};

/**
 * Get all live games EXCEPT the ones created by a specific user
 * (for showing "Other People's Games" section)
 */
export const getOtherUsersLiveGames = (userId: string): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(
    game => game.hostId !== userId && game.status === 'live'
  );
};

/**
 * Check if a user is the owner of a game
 */
export const isGameOwner = (gameCode: string, userId: string): boolean => {
  const game = gamesDatabase[gameCode];
  return game ? game.hostId === userId : false;
};

/**
 * Delete a game
 */
export const deleteGame = (code: string): boolean => {
  if (gamesDatabase[code]) {
    delete gamesDatabase[code];
    return true;
  }
  return false;
};

/**
 * End a game (set status to 'ended')
 */
export const endGame = (code: string): BasketballGame | undefined => {
  return updateGame(code, { status: 'ended' });
};

/**
 * Get all games (for admin purposes)
 */
export const getAllGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase);
};

/**
 * Subscribe to game updates (placeholder for real-time sync)
 */
export const subscribeToGame = (
  code: string,
  callback: (game: BasketballGame) => void
): (() => void) => {
  // In production, this would use Firebase onSnapshot
  const interval = setInterval(() => {
    const game = getGame(code);
    if (game) {
      callback(game);
    }
  }, 1000);

  return () => clearInterval(interval);
};