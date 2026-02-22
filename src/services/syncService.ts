// src/services/syncService.ts
// Stubbed out — sync is now handled by Supabase real-time.

export const startAutoSync = () => { };

export const addToSyncQueue = (_gameId: string) => { };

export const getSyncStatus = () => ({
    pendingCount: 0,
    lastSyncTime: null as number | null,
    isSyncing: false,
});

export const triggerManualSync = async () => ({
    syncedGames: [] as string[],
    failedGames: [] as string[],
});
