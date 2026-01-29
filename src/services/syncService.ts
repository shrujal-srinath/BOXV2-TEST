// src/services/syncService.ts
/**
 * SYNC SERVICE
 * Orchestrates synchronization between local games and Firebase cloud
 * Handles conflicts, retries, and background sync
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { BasketballGame } from '../types';
import {
  getLocalGameLibrary,
  getPendingSyncGames,
  markGameAsSynced,
  updateLocalGame,
  type LocalGameMetadata,
} from './localGameService';

// ============================================
// CONSTANTS
// ============================================

const SYNC_QUEUE_KEY = 'BOX_V2_SYNC_QUEUE';
const SYNC_STATUS_KEY = 'BOX_V2_SYNC_STATUS';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

// ============================================
// TYPES
// ============================================

export interface SyncQueueItem {
  localGameId: string;
  gameData: BasketballGame;
  timestamp: number;
  attempts: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingCount: number;
  failedCount: number;
  errors: string[];
}

export type SyncMode = 'manual' | 'auto' | 'background';

export interface SyncResult {
  success: boolean;
  syncedGames: string[];
  failedGames: string[];
  errors: string[];
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

/**
 * Get current sync queue
 */
const getSyncQueue = (): SyncQueueItem[] => {
  try {
    const queueJson = localStorage.getItem(SYNC_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('[SyncService] Failed to read sync queue:', error);
    return [];
  }
};

/**
 * Save sync queue
 */
const saveSyncQueue = (queue: SyncQueueItem[]): boolean => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (error) {
    console.error('[SyncService] Failed to save sync queue:', error);
    return false;
  }
};

/**
 * Add game to sync queue
 */
export const addToSyncQueue = (localGameId: string, gameData: BasketballGame): boolean => {
  const queue = getSyncQueue();
  
  // Check if already in queue
  const existingIndex = queue.findIndex(item => item.localGameId === localGameId);
  
  if (existingIndex !== -1) {
    // Update existing item
    queue[existingIndex] = {
      localGameId,
      gameData,
      timestamp: Date.now(),
      attempts: queue[existingIndex].attempts,
    };
  } else {
    // Add new item
    queue.push({
      localGameId,
      gameData,
      timestamp: Date.now(),
      attempts: 0,
    });
  }

  return saveSyncQueue(queue);
};

/**
 * Remove from sync queue
 */
const removeFromSyncQueue = (localGameId: string): boolean => {
  const queue = getSyncQueue();
  const filtered = queue.filter(item => item.localGameId !== localGameId);
  return saveSyncQueue(filtered);
};

/**
 * Clear entire sync queue
 */
export const clearSyncQueue = (): boolean => {
  return saveSyncQueue([]);
};

// ============================================
// SYNC STATUS MANAGEMENT
// ============================================

/**
 * Get current sync status
 */
export const getSyncStatus = (): SyncStatus => {
  try {
    const statusJson = localStorage.getItem(SYNC_STATUS_KEY);
    if (statusJson) {
      return JSON.parse(statusJson);
    }
  } catch (error) {
    console.error('[SyncService] Failed to read sync status:', error);
  }

  return {
    isSyncing: false,
    lastSyncTime: null,
    pendingCount: 0,
    failedCount: 0,
    errors: [],
  };
};

/**
 * Update sync status
 */
const updateSyncStatus = (updates: Partial<SyncStatus>): boolean => {
  try {
    const current = getSyncStatus();
    const updated = { ...current, ...updates };
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('[SyncService] Failed to update sync status:', error);
    return false;
  }
};

// ============================================
// CLOUD UPLOAD
// ============================================

/**
 * Upload a single game to Firebase
 */
const uploadGameToCloud = async (
  localGameId: string,
  gameData: BasketballGame
): Promise<{ success: boolean; cloudId?: string; error?: string }> => {
  
  if (!db) {
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!auth.currentUser) {
    return { success: false, error: 'User not authenticated' };
  }

  try {
    // Generate cloud game code (6 digits)
    const cloudGameId = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Prepare cloud data (convert LOCAL-XXX to regular code)
    const cloudGameData: BasketballGame = {
      ...gameData,
      code: cloudGameId,
      hostId: auth.currentUser.uid,
      gameType: 'pro', // Convert local to pro when syncing
      lastUpdate: Date.now(),
    };

    // Upload to Firebase
    const gameRef = doc(db, 'games', cloudGameId);
    await setDoc(gameRef, cloudGameData);

    console.log(`[SyncService] ✅ Uploaded ${localGameId} → ${cloudGameId}`);
    
    return { success: true, cloudId: cloudGameId };
    
  } catch (error: any) {
    console.error(`[SyncService] ❌ Upload failed for ${localGameId}:`, error);
    return { success: false, error: error.message || 'Upload failed' };
  }
};

// ============================================
// CONFLICT RESOLUTION
// ============================================

/**
 * Check if cloud version exists and is newer
 */
const checkForConflict = async (
  cloudGameId: string,
  localGameData: BasketballGame
): Promise<{ hasConflict: boolean; cloudData?: BasketballGame }> => {
  
  if (!db) return { hasConflict: false };

  try {
    const gameRef = doc(db, 'games', cloudGameId);
    const gameSnap = await getDoc(gameRef);

    if (gameSnap.exists()) {
      const cloudData = gameSnap.data() as BasketballGame;
      
      // Compare timestamps
      if (cloudData.lastUpdate > localGameData.lastUpdate) {
        console.warn(`[SyncService] ⚠️ Conflict detected for ${cloudGameId}`);
        return { hasConflict: true, cloudData };
      }
    }

    return { hasConflict: false };
    
  } catch (error) {
    console.error('[SyncService] Conflict check failed:', error);
    return { hasConflict: false };
  }
};

/**
 * Resolve conflict using Last-Write-Wins strategy
 */
const resolveConflict = async (
  localGameId: string,
  localData: BasketballGame,
  cloudData: BasketballGame
): Promise<BasketballGame> => {
  
  // Simple: Use most recent timestamp
  if (cloudData.lastUpdate > localData.lastUpdate) {
    console.log(`[SyncService] Using cloud version (newer)`);
    // Update local with cloud data
    updateLocalGame(localGameId, cloudData);
    return cloudData;
  } else {
    console.log(`[SyncService] Using local version (newer)`);
    return localData;
  }
};

// ============================================
// MAIN SYNC OPERATIONS
// ============================================

/**
 * Sync a single game
 */
export const syncSingleGame = async (localGameId: string): Promise<boolean> => {
  const queue = getSyncQueue();
  const queueItem = queue.find(item => item.localGameId === localGameId);

  if (!queueItem) {
    console.warn(`[SyncService] Game not in queue: ${localGameId}`);
    return false;
  }

  // Check authentication
  if (!auth.currentUser) {
    console.warn('[SyncService] Sync aborted: No user logged in');
    return false;
  }

  // Check connection
  if (!navigator.onLine) {
    console.warn('[SyncService] Sync aborted: Offline');
    return false;
  }

  // Increment attempts
  queueItem.attempts += 1;

  // Upload to cloud
  const result = await uploadGameToCloud(localGameId, queueItem.gameData);

  if (result.success && result.cloudId) {
    // Mark as synced
    markGameAsSynced(localGameId, result.cloudId);
    
    // Remove from queue
    removeFromSyncQueue(localGameId);
    
    console.log(`[SyncService] ✅ Sync complete: ${localGameId} → ${result.cloudId}`);
    return true;
    
  } else {
    // Handle failure
    if (queueItem.attempts >= MAX_RETRY_ATTEMPTS) {
      console.error(`[SyncService] ❌ Max retries reached for ${localGameId}`);
      // Keep in queue but flag as failed
      updateSyncStatus({
        failedCount: getSyncStatus().failedCount + 1,
        errors: [...getSyncStatus().errors, result.error || 'Unknown error'],
      });
    } else {
      // Save updated attempt count
      saveSyncQueue(queue);
      
      // Retry after delay
      console.log(`[SyncService] Retry ${queueItem.attempts}/${MAX_RETRY_ATTEMPTS} in ${RETRY_DELAY_MS}ms`);
      setTimeout(() => syncSingleGame(localGameId), RETRY_DELAY_MS);
    }
    
    return false;
  }
};

/**
 * Sync all pending games
 */
export const syncAllGames = async (): Promise<SyncResult> => {
  console.log('[SyncService] 🔄 Starting full sync...');

  updateSyncStatus({ isSyncing: true });

  const queue = getSyncQueue();
  const results: SyncResult = {
    success: true,
    syncedGames: [],
    failedGames: [],
    errors: [],
  };

  // Process each game
  for (const item of queue) {
    const success = await syncSingleGame(item.localGameId);
    
    if (success) {
      results.syncedGames.push(item.localGameId);
    } else {
      results.failedGames.push(item.localGameId);
      results.success = false;
    }
  }

  // Update status
  updateSyncStatus({
    isSyncing: false,
    lastSyncTime: Date.now(),
    pendingCount: results.failedGames.length,
  });

  console.log(`[SyncService] ✅ Sync complete: ${results.syncedGames.length} synced, ${results.failedGames.length} failed`);

  return results;
};

/**
 * Auto-sync on connection restore
 */
export const startAutoSync = () => {
  console.log('[SyncService] Auto-sync enabled');

  // Sync when coming online
  window.addEventListener('online', async () => {
    console.log('[SyncService] 📡 Connection restored - auto-syncing...');
    
    // Wait a bit for connection to stabilize
    setTimeout(async () => {
      if (auth.currentUser) {
        await syncAllGames();
      } else {
        console.log('[SyncService] Skipping auto-sync: No user logged in');
      }
    }, 1000);
  });

  // Initial sync if online
  if (navigator.onLine && auth.currentUser) {
    setTimeout(() => syncAllGames(), 2000);
  }
};

/**
 * Manual sync trigger (user-initiated)
 */
export const triggerManualSync = async (): Promise<SyncResult> => {
  if (!auth.currentUser) {
    return {
      success: false,
      syncedGames: [],
      failedGames: [],
      errors: ['Not logged in. Sign in to sync to cloud.'],
    };
  }

  if (!navigator.onLine) {
    return {
      success: false,
      syncedGames: [],
      failedGames: [],
      errors: ['No internet connection. Try again when online.'],
    };
  }

  return await syncAllGames();
};

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * Migrate all local games to cloud (one-time operation)
 */
export const migrateAllLocalGamesToCloud = async (): Promise<SyncResult> => {
  console.log('[SyncService] 📦 Starting migration...');

  const pendingGames = getPendingSyncGames();
  
  // Add all to queue
  pendingGames.forEach(metadata => {
    addToSyncQueue(metadata.id, metadata.game);
  });

  // Sync all
  return await syncAllGames();
};

/**
 * Download cloud game to local storage
 */
export const downloadCloudGameToLocal = async (
  cloudGameId: string
): Promise<boolean> => {
  
  if (!db) return false;

  try {
    const gameRef = doc(db, 'games', cloudGameId);
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) {
      console.error(`[SyncService] Cloud game not found: ${cloudGameId}`);
      return false;
    }

    const cloudData = gameSnap.data() as BasketballGame;
    
    // Import to local storage
    const localGameService = await import('./localGameService');
    const metadata = localGameService.createLocalGame(
      cloudData.teamA.name,
      cloudData.teamB.name,
      cloudData.settings.periodDuration,
      cloudData.settings.shotClockDuration
    );

    if (metadata) {
      // Update with cloud data
      localGameService.updateLocalGame(metadata.id, cloudData);
      localGameService.markGameAsSynced(metadata.id, cloudGameId);
      
      console.log(`[SyncService] ✅ Downloaded ${cloudGameId} → ${metadata.id}`);
      return true;
    }

    return false;
    
  } catch (error) {
    console.error('[SyncService] Download failed:', error);
    return false;
  }
};

// ============================================
// EXPORT DEFAULT API
// ============================================

export default {
  // Queue
  addToSyncQueue,
  clearSyncQueue,
  
  // Status
  getSyncStatus,
  
  // Sync
  syncSingleGame,
  syncAllGames,
  triggerManualSync,
  
  // Auto-sync
  startAutoSync,
  
  // Migration
  migrateAllLocalGamesToCloud,
  downloadCloudGameToLocal,
};