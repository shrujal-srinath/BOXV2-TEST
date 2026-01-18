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
import { db } from "./firebase";
import type { BasketballGame } from "../types";

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

// 3. Create a game
export const createGame = async (gameId: string, initialData: BasketballGame) => {
  if (!db) return;
  const gameRef = doc(db, "games", gameId);
  const docSnap = await getDoc(gameRef);

  if (!docSnap.exists()) {
    await setDoc(gameRef, initialData);
  }
};

// 4. Live Games Feed (With Safety Catch)
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
      callback([]); // Return empty list on error (prevents black screen)
    });

  } catch (error) {
    console.error("Critical DB Error:", error);
    callback([]);
    return () => {};
  }
};
// ... existing imports

// 5. Get Active Games for a specific Host (Resume Game)
export const getUserActiveGames = (userId: string, callback: (games: BasketballGame[]) => void) => {
  if (!db) return () => {};
  
  // Find games where hostId matches AND status is 'live'
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