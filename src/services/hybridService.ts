// src/services/hybridService.ts
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { BasketballGame } from "../types";

// CONSTANTS
const LOCAL_STORAGE_KEY = "BOX_V2_ACTIVE_GAME";
const SYNC_QUEUE_KEY = "BOX_V2_SYNC_QUEUE";

/**
 * 1. SAVE ACTION (The Primary Function)
 * This is what the Tablet UI will call instead of calling Firebase directly.
 */
export const saveGameAction = (gameData: BasketballGame) => {
  if (!gameData.code) return;

  // A. Save to Local Tablet Storage (Instant / 0ms Latency)
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameData));
  
  // B. Add to the "Sync Queue" (To-Do List for the Cloud)
  addToSyncQueue(gameData);

  // C. Try to Sync immediately (If we have WiFi)
  if (navigator.onLine) {
    processSyncQueue();
  }
};

/**
 * 2. LOAD ACTION
 * Retrieves the game state from the tablet's memory.
 */
export const loadLocalGame = (): BasketballGame | null => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};

/**
 * 3. HELPER: Add to Queue
 */
const addToSyncQueue = (gameData: BasketballGame) => {
  try {
    const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
    // We append the new state to the list
    queue.push({ 
      code: gameData.code,
      data: gameData,
      timestamp: Date.now() 
    });
    // Limit queue size to last 50 actions to prevent memory overflow
    if (queue.length > 50) queue.shift();
    
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Local Queue Error:", e);
  }
};

/**
 * 4. THE BACKGROUND SYNC PROCESS
 * Takes items from the queue and sends them to Firebase.
 */
export const processSyncQueue = async () => {
  const queueJson = localStorage.getItem(SYNC_QUEUE_KEY);
  if (!queueJson) return;

  const queue = JSON.parse(queueJson);
  if (queue.length === 0) return;

  console.log(`[CLOUD SYNC] Uploading ${queue.length} pending actions...`);

  // Optimization: We only strictly need to send the LATEST state
  // to make the scoreboard correct.
  const latestAction = queue[queue.length - 1]; 

  try {
    const gameRef = doc(db, "games", latestAction.code);
    
    // Write to Firebase
    await setDoc(gameRef, latestAction.data, { merge: true });
    
    console.log("[CLOUD SYNC] Success! Cleared queue.");
    
    // Clear the queue after success
    localStorage.setItem(SYNC_QUEUE_KEY, "[]");
    
  } catch (err) {
    console.warn("[CLOUD SYNC] Failed. Will retry when connection improves.", err);
  }
};

// 5. AUTO-RETRY LISTENER
// This automatically triggers a sync when the tablet reconnects to WiFi
window.addEventListener('online', () => {
  console.log("[NETWORK] WiFi Restored - Attempting Sync...");
  processSyncQueue();
});