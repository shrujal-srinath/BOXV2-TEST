import { BasketballGame, TeamData, Player } from '../types';

// Mock Firebase for local development - replace with actual Firebase in production
let gamesDatabase: { [key: string]: BasketballGame } = {};
let liveGamesListeners: { [key: string]: ((games: BasketballGame[]) => void)[] } = {};

// Initialize a new game with FIBA-compliant defaults
export const createGame = (gameCode: string, gameType: 'local' | 'online'): BasketballGame => {
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
    disqualified: false, // NEW: Initialize disqualification
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
    timeouts: 2, // FIBA: 2 timeouts for first half
    timeoutsFirstHalf: 2, // NEW: Track first half allocation
    timeoutsSecondHalf: 3, // NEW: Track second half allocation
    fouls: 0,
    foulsThisQuarter: 0, // NEW: Track quarter fouls
    players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
  });

  const newGame: BasketballGame = {
    gameCode,
    teamA: createDefaultTeam('Team A', '#FF0000'),
    teamB: createDefaultTeam('Team B', '#0000FF'),
    gameState: {
      period: 1,
      gameTime: { minutes: 10, seconds: 0, tenths: 0 }, // FIBA: 10-minute quarters
      shotClock: 24,
      gameRunning: false,
      shotClockRunning: false,
    },
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    gameType,
  };

  gamesDatabase[gameCode] = newGame;

  // Notify live games listeners
  notifyLiveGamesListeners();

  return newGame;
};

// Create an online game with Firebase (or mock)
export const createOnlineGame = async (gameCode: string): Promise<BasketballGame> => {
  const game = createGame(gameCode, 'online');

  // In production, save to Firebase
  // await setDoc(doc(db, 'games', gameCode), game);

  return game;
};

// Get a game by code
export const getGame = (gameCode: string): BasketballGame | null => {
  return gamesDatabase[gameCode] || null;
};

// Get all live games
export const getLiveGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(game => game.gameType === 'online');
};

// Get user's active games (local and online)
export const getUserActiveGames = (): BasketballGame[] => {
  // Return all games from the database
  // In production, this would filter by user ID
  return Object.values(gamesDatabase);
};

// Get user's local games only
export const getUserLocalGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(game => game.gameType === 'local');
};

// Get user's online games only
export const getUserOnlineGames = (): BasketballGame[] => {
  return Object.values(gamesDatabase).filter(game => game.gameType === 'online');
};

// Subscribe to live games list
export const subscribeToLiveGames = (callback: (games: BasketballGame[]) => void): (() => void) => {
  // Add callback to listeners
  const listenerId = Math.random().toString(36);
  if (!liveGamesListeners[listenerId]) {
    liveGamesListeners[listenerId] = [];
  }
  liveGamesListeners[listenerId].push(callback);

  // Immediately call with current games
  callback(getLiveGames());

  // Set up polling for changes (in production, use Firebase realtime updates)
  const interval = setInterval(() => {
    callback(getLiveGames());
  }, 2000);

  // Return unsubscribe function
  return () => {
    clearInterval(interval);
    delete liveGamesListeners[listenerId];
  };
};

// Subscribe to user's active games
export const subscribeToUserGames = (callback: (games: BasketballGame[]) => void): (() => void) => {
  // Immediately call with current games
  callback(getUserActiveGames());

  // Set up polling for changes
  const interval = setInterval(() => {
    callback(getUserActiveGames());
  }, 2000);

  // Return unsubscribe function
  return () => {
    clearInterval(interval);
  };
};

// Notify all live games listeners
const notifyLiveGamesListeners = () => {
  const liveGames = getLiveGames();
  Object.values(liveGamesListeners).forEach(listeners => {
    listeners.forEach(callback => callback(liveGames));
  });
};

// Join an existing game
export const joinGame = async (gameCode: string): Promise<BasketballGame | null> => {
  const game = getGame(gameCode);
  if (game) {
    return game;
  }

  // In production, fetch from Firebase
  // const docRef = doc(db, 'games', gameCode);
  // const docSnap = await getDoc(docRef);
  // if (docSnap.exists()) {
  //   const gameData = docSnap.data() as BasketballGame;
  //   gamesDatabase[gameCode] = gameData;
  //   return gameData;
  // }

  return null;
};

// Update a specific field in the game using dot notation
export const updateGameField = (gameCode: string, path: string, value: any): void => {
  const game = gamesDatabase[gameCode];
  if (!game) {
    console.error(`Game ${gameCode} not found`);
    return;
  }

  // Handle nested path updates (e.g., 'teamA.score' or 'gameState.period')
  const keys = path.split('.');
  let current: any = game;

  // Navigate to the parent object
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  // Set the final value
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;

  // Update timestamp
  game.lastUpdated = Date.now();

  // Notify listeners
  notifyLiveGamesListeners();

  // In production, this would sync to Firebase
  if (game.gameType === 'online') {
    // TODO: Push to Firebase
    // await updateDoc(doc(db, 'games', gameCode), { [path]: value, lastUpdated: Date.now() });
    console.log(`[FIREBASE] Update ${gameCode}:${path} = ${JSON.stringify(value)}`);
  }

  // Save local games to localStorage
  if (game.gameType === 'local') {
    saveGameToLocal(game);
  }
};

// Subscribe to game updates (for online games)
export const subscribeToGame = (
  gameCode: string,
  callback: (game: BasketballGame | null) => void
): (() => void) => {
  // In production, this would use Firebase onSnapshot
  // const unsubscribe = onSnapshot(doc(db, 'games', gameCode), (doc) => {
  //   if (doc.exists()) {
  //     callback(doc.data() as BasketballGame);
  //   }
  // });

  const game = gamesDatabase[gameCode];
  if (game) {
    callback(game);
  }

  // Set up polling for changes (in production, use Firebase realtime updates)
  const interval = setInterval(() => {
    const updatedGame = gamesDatabase[gameCode];
    if (updatedGame) {
      callback(updatedGame);
    }
  }, 1000);

  // Return unsubscribe function
  return () => {
    clearInterval(interval);
  };
};

// Delete a game
export const deleteGame = (gameCode: string): void => {
  const game = gamesDatabase[gameCode];
  if (game) {
    // Remove from memory
    delete gamesDatabase[gameCode];

    // Remove from localStorage
    try {
      localStorage.removeItem(`game_${gameCode}`);
    } catch (error) {
      console.error('Failed to delete from localStorage:', error);
    }

    // Notify listeners
    notifyLiveGamesListeners();

    // In production, delete from Firebase
    // await deleteDoc(doc(db, 'games', gameCode));
  }
};

// Save game to local storage
export const saveGameToLocal = (game: BasketballGame): void => {
  try {
    localStorage.setItem(`game_${game.gameCode}`, JSON.stringify(game));
  } catch (error) {
    console.error('Failed to save game to local storage:', error);
  }
};

// Load game from local storage
export const loadGameFromLocal = (gameCode: string): BasketballGame | null => {
  try {
    const saved = localStorage.getItem(`game_${gameCode}`);
    if (saved) {
      const game = JSON.parse(saved);
      gamesDatabase[gameCode] = game;
      return game;
    }
  } catch (error) {
    console.error('Failed to load game from local storage:', error);
  }
  return null;
};

// Load all games from local storage
export const loadAllGamesFromLocal = (): BasketballGame[] => {
  const games: BasketballGame[] = [];
  try {
    // Get all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('game_')) {
        const gameData = localStorage.getItem(key);
        if (gameData) {
          const game = JSON.parse(gameData);
          gamesDatabase[game.gameCode] = game;
          games.push(game);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load games from local storage:', error);
  }
  return games;
};

// Reset shot clock (convenience function)
export const resetShotClock = (gameCode: string, value: number = 24): void => {
  updateGameField(gameCode, 'gameState.shotClock', value);
};

// Helper: Check if player is disqualified
export const isPlayerDisqualified = (player: Player): boolean => {
  return player.disqualified || player.fouls >= 5;
};

// Helper: Get available timeouts for current period
export const getAvailableTimeouts = (team: TeamData, period: number): number => {
  if (period <= 2) {
    return team.timeoutsFirstHalf;
  } else if (period <= 4) {
    return team.timeoutsSecondHalf;
  } else {
    return 1; // Overtime: 1 timeout
  }
};

// Helper: Check if team is in bonus
export const isTeamInBonus = (team: TeamData): boolean => {
  return team.foulsThisQuarter >= 4;
};

// Generate random game code
export const generateGameCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Check if game code exists
export const gameCodeExists = (gameCode: string): boolean => {
  return gamesDatabase[gameCode] !== undefined;
};

// Export for use in components
export { gamesDatabase };