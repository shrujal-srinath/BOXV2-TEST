// src/services/hybridService.ts (V2 - PRODUCTION READY)
/**
 * HYBRID SERVICE - PRODUCTION VERSION
 * 
 * FIXES APPLIED:
 * ✅ Retry logic with exponential backoff
 * ✅ Proper error handling
 * ✅ Returns success/failure status
 * ✅ Better queue management
 */

import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { BasketballGame } from "../types";

// ============================================
// CONSTANTS
// ============================================
const LOCAL_STORAGE_KEY = "BOX_V2_ACTIVE_GAME";
const SYNC_QUEUE_KEY = "BOX_V2_SYNC_QUEUE";
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// ============================================
// TYPES
// ============================================
export interface SaveResult {
  success: boolean;
  offline?: boolean;
  error?: string;
}

interface QueueItem {
  code: string;
  data: BasketballGame;
  timestamp: number;
  attempts: number;
}

// ============================================
// MAIN SAVE FUNCTION (FIXED)
// ============================================
/**
 * Save action with automatic retry and error recovery
 */
export const saveGameAction = async (gameData: BasketballGame): Promise<SaveResult> => {
  if (!gameData.code) {
    return { success: false, error: 'No game code provided' };
  }

  // STEP 1: Save to local storage (always succeeds)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameData));
  } catch (e) {
    console.error('[HybridService] Local save failed:', e);
    return { success: false, error: 'Local storage full or unavailable' };
  }
  
  // STEP 2: Add to sync queue
  addToSyncQueue(gameData);

  // STEP 3: Try cloud sync if online
  if (navigator.onLine) {
    const result = await processSyncQueueWithRetry();
    return result;
  }
  
  // Offline: Local save succeeded
  return { success: true, offline: true };
};

// ============================================
// LOAD FUNCTION (NO CHANGES)
// ============================================
/**
 * Load game from local storage
 */
export const loadLocalGame = (): BasketballGame | null => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('[HybridService] Load failed:', e);
    return null;
  }
};

// ============================================
// QUEUE MANAGEMENT (IMPROVED)
// ============================================
/**
 * Add game to sync queue
 */
const addToSyncQueue = (gameData: BasketballGame): boolean => {
  try {
    const queue = getSyncQueue();
    
    // Check if game already in queue
    const existingIndex = queue.findIndex(item => item.code === gameData.code);
    
    if (existingIndex !== -1) {
      // Update existing item (keep same attempt count)
      queue[existingIndex] = {
        code: gameData.code,
        data: gameData,
        timestamp: Date.now(),
        attempts: queue[existingIndex].attempts
      };
    } else {
      // Add new item
      queue.push({
        code: gameData.code,
        data: gameData,
        timestamp: Date.now(),
        attempts: 0
      });
    }
    
    // Limit queue size to prevent memory issues
    if (queue.length > 50) {
      queue.shift();
    }
    
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (e) {
    console.error('[HybridService] Failed to add to queue:', e);
    return false;
  }
};

/**
 * Get sync queue
 */
const getSyncQueue = (): QueueItem[] => {
  try {
    const queueJson = localStorage.getItem(SYNC_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (e) {
    console.error('[HybridService] Failed to read queue:', e);
    return [];
  }
};

/**
 * Save sync queue
 */
const saveSyncQueue = (queue: QueueItem[]): boolean => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (e) {
    console.error('[HybridService] Failed to save queue:', e);
    return false;
  }
};

// ============================================
// SYNC WITH RETRY (NEW)
// ============================================
/**
 * Process sync queue with retry logic
 */
const processSyncQueueWithRetry = async (): Promise<SaveResult> => {
  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { success: true };
  }

  // Get latest action (most important to sync)
  const latestAction = queue[queue.length - 1];

  // Try to sync with retry
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const gameRef = doc(db, "games", latestAction.code);
      
      // Sanitize data (remove undefined values)
      const cleanData = JSON.parse(JSON.stringify(latestAction.data, (key, value) => {
        return value === undefined ? null : value;
      }));
      
      await setDoc(gameRef, cleanData, { merge: true });
      
      console.log(`[HybridService] ✅ Sync successful (attempt ${attempt + 1})`);
      
      // Clear queue on success
      localStorage.setItem(SYNC_QUEUE_KEY, "[]");
      
      return { success: true };
      
    } catch (err: any) {
      console.warn(`[HybridService] Sync attempt ${attempt + 1} failed:`, err);
      
      // Update attempt count
      latestAction.attempts = attempt + 1;
      queue[queue.length - 1] = latestAction;
      saveSyncQueue(queue);
      
      // If not last attempt, wait before retry
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }
  }

  // All retries failed
  console.error('[HybridService] ❌ Sync failed after all retries');
  return { 
    success: false, 
    error: 'Sync failed after retries. Data saved locally and will sync when connection improves.' 
  };
};

// ============================================
// MANUAL SYNC (NEW)
// ============================================
/**
 * Manually trigger sync (called when connection restores)
 */
export const processSyncQueue = async (): Promise<SaveResult> => {
  if (!navigator.onLine) {
    return { success: false, error: 'No internet connection' };
  }

  return await processSyncQueueWithRetry();
};

// ============================================
// CLEAR QUEUE (NEW)
// ============================================
/**
 * Clear sync queue (use with caution)
 */
export const clearSyncQueue = (): boolean => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, "[]");
    console.log('[HybridService] Sync queue cleared');
    return true;
  } catch (e) {
    console.error('[HybridService] Failed to clear queue:', e);
    return false;
  }
};

// ============================================
// GET QUEUE STATUS (NEW)
// ============================================
/**
 * Get sync queue status
 */
export const getSyncQueueStatus = () => {
  const queue = getSyncQueue();
  return {
    count: queue.length,
    oldestTimestamp: queue.length > 0 ? queue[0].timestamp : null,
    newestTimestamp: queue.length > 0 ? queue[queue.length - 1].timestamp : null,
    failedAttempts: queue.reduce((sum, item) => sum + item.attempts, 0)
  };
};

// ============================================
// AUTO-RETRY LISTENER (IMPROVED)
// ============================================
let isAutoSyncEnabled = true;

/**
 * Enable/disable auto-sync
 */
export const setAutoSync = (enabled: boolean) => {
  isAutoSyncEnabled = enabled;
};

/**
 * Auto-sync when connection restores
 */
window.addEventListener('online', async () => {
  if (!isAutoSyncEnabled) {
    console.log('[HybridService] Auto-sync disabled, skipping');
    return;
  }

  console.log("[HybridService] 📡 Connection restored - attempting sync...");
  
  // Wait a bit for connection to stabilize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const result = await processSyncQueue();
  
  if (result.success) {
    console.log('[HybridService] ✅ Auto-sync complete');
  } else {
    console.warn('[HybridService] ⚠️ Auto-sync failed:', result.error);
  }
});

// ============================================
// PERIODIC SYNC (NEW)
// ============================================
/**
 * Periodically attempt to sync (every 30 seconds if queue not empty)
 */
setInterval(async () => {
  if (!isAutoSyncEnabled || !navigator.onLine) return;
  
  const queue = getSyncQueue();
  if (queue.length === 0) return;
  
  console.log('[HybridService] 🔄 Periodic sync check...');
  await processSyncQueue();
}, 30000); // 30 seconds

// ============================================
// EXPORT DEFAULT API
// ============================================
export default {
  saveGameAction,
  loadLocalGame,
  processSyncQueue,
  clearSyncQueue,
  getSyncQueueStatus,
  setAutoSync
};