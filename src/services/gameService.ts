import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  limit 
} from "firebase/firestore";
import { db, auth } from "./firebase"; // <--- Added auth import
import type { BasketballGame, TeamData } from "../types";

// --- HELPER: DATA SANITIZER ---
// ⚠️ CRITICAL FIX: Removes 'undefined' values which crash Firestore
const sanitize = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  }));
};

// 1. Subscribe to a single game
export const subscribeToGame = (gameId: string, callback: (data: BasketballGame) => void) => {
  if (!gameId || !db) return () => {};
  
  return onSnapshot(doc(db, "games", gameId), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as BasketballGame);
    }
  });
};

// 2. Update a field
export const updateGameField = async (gameId: string, fieldPath: string, value: any) => {
  if (!db) return;
  const gameRef = doc(db, "games", gameId);
  await updateDoc(gameRef, { [fieldPath]: value });
};

// 3. Create a game (Low-level function)
export const createGame = async (gameId: string, initialData: BasketballGame) => {
  if (!db) {
    console.error("FIREBASE ERROR: Database not initialized.");
    throw new Error("Database connection failed. Check API keys.");
  }

  try {
    const gameRef = doc(db, "games", gameId);
    const docSnap = await getDoc(gameRef);

    if (!docSnap.exists()) {
      // ⚠️ FIX: Sanitize data before writing to prevent 'invalid data' errors
      const cleanData = sanitize(initialData);
      console.log("Attempting to write game data:", cleanData);
      await setDoc(gameRef, cleanData);
    } else {
      throw new Error("Game Code already exists. Try again.");
    }
  } catch (error: any) {
    console.error("DETAILED WRITE ERROR:", error);
    throw error;
  }
};

// 4. Initialize New Game (Factory Function)
// ⚠️ FIX: This function is required by your GameSetup page
export const initializeNewGame = async (
  settings: {
    gameName: string;
    periodDuration: number;
    shotClockDuration: number;
    periodType: 'quarter' | 'half';
  }, 
  teamA: Partial<TeamData>, 
  teamB: Partial<TeamData>, 
  trackStats: boolean,
  sportType: string
) => {
  const gameCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hostId = auth.currentUser?.uid || "guest-operator";

  const newGame: BasketballGame = {
    hostId,
    code: gameCode,
    gameType: trackStats ? "pro" : "standard",
    sport: sportType as "basketball",
    status: "live",
    settings: {
      gameName: settings.gameName,
      periodDuration: settings.periodDuration,
      shotClockDuration: settings.shotClockDuration,
      periodType: settings.periodType
    },
    teamA: { 
      name: teamA.name || "TEAM A", 
      color: teamA.color || "#DC2626", 
      score: 0, 
      timeouts: 7, 
      fouls: 0, 
      players: teamA.players || [] 
    } as TeamData,
    teamB: { 
      name: teamB.name || "TEAM B", 
      color: teamB.color || "#2563EB", 
      score: 0, 
      timeouts: 7, 
      fouls: 0, 
      players: teamB.players || [] 
    } as TeamData,
    gameState: {
      period: 1,
      gameTime: { minutes: settings.periodDuration, seconds: 0, tenths: 0 },
      shotClock: settings.shotClockDuration,
      possession: 'A',
      gameRunning: false,
      shotClockRunning: false
    },
    lastUpdate: Date.now()
  };

  await createGame(gameCode, newGame);
  return gameCode;
};

// 5. Live Games Feed
export const subscribeToLiveGames = (callback: (games: BasketballGame[]) => void) => {
  try {
    if (!db) {
      console.warn("Database not initialized");
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, "games"),
      where("status", "==", "live"),
      limit(10)
    );

    return onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => doc.data() as BasketballGame);
      callback(games);
    }, (error) => {
      console.error("Live Feed Error:", error);
      callback([]); 
    });

  } catch (error) {
    console.error("Critical DB Error:", error);
    callback([]);
    return () => {};
  }
};

// 6. Get Active Games for a specific Host
export const getUserActiveGames = (userId: string, callback: (games: BasketballGame[]) => void) => {
  if (!db) return () => {};
  
  const q = query(
    collection(db, "games"),
    where("hostId", "==", userId),
    where("status", "==", "live")
  );

  return onSnapshot(q, (snapshot) => {
    const games = snapshot.docs.map(doc => doc.data() as BasketballGame);
    callback(games);
  });
};