// src/services/supabaseGameService.ts
//
// THE BOX — Supabase Game Service
//
// REPLACES: src/services/gameService.ts (Firestore version)
//
// Architecture split (same as before, just different backends):
//   - Supabase Postgres → Durable storage (settings, rosters, final results)
//   - Supabase Broadcast → Live ephemeral data (clock, score during gameplay)
//
// The live clock/score signaling is in supabaseBroadcastService.ts.
// This service handles CRUD + realtime subscriptions for persistent game data.

import { supabase } from './supabase';
import type { BasketballGame, GameSettings, TeamData, GameState, Player } from '../types';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ─── Channel cache for realtime subscriptions ─────────────────────────────────
const gameSubChannels = new Map<string, RealtimeChannel>();

// ============================================
// SUPABASE POSTGRES OPERATIONS (COLD DATA)
// ============================================

/**
 * Subscribe to the "Cold" game data (settings, rosters, team names, colors).
 * 
 * Uses Supabase Realtime Postgres Changes — whenever the `games` row updates
 * in Postgres, the callback fires. This replaces Firestore's onSnapshot.
 * 
 * NOTE: This is for DURABLE data only. Clock ticks and live scores go through
 * Supabase Broadcast (supabaseBroadcastService.ts) — not through Postgres.
 */
export const subscribeToGame = (
    code: string,
    callback: (game: BasketballGame | null) => void
): (() => void) => {
    if (!code) {
        callback(null);
        return () => { };
    }

    // Initial fetch
    supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .single()
        .then(({ data, error }) => {
            if (error || !data) {
                callback(null);
            } else {
                callback(data as BasketballGame);
            }
        });

    // Realtime subscription for updates
    const channelName = `game-sub:${code}`;
    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `code=eq.${code}`,
            },
            (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
                if (payload.eventType === 'DELETE') {
                    callback(null);
                } else {
                    callback(payload.new as BasketballGame);
                }
            }
        )
        .subscribe();

    gameSubChannels.set(channelName, channel);

    return () => {
        const ch = gameSubChannels.get(channelName);
        if (ch) {
            supabase.removeChannel(ch);
            gameSubChannels.delete(channelName);
        }
    };
};

/**
 * Subscribe to the global feed of live games.
 * Replaces the Firestore query with where('status', '==', 'live').
 */
export const subscribeToLiveGames = (
    callback: (games: BasketballGame[]) => void
): (() => void) => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Initial fetch
    const fetchLive = async () => {
        const cutoff = Date.now() - ONE_DAY_MS;
        const { data, error } = await supabase
            .from('games')
            .select('*')
            .eq('status', 'live')
            .gt('last_update', cutoff)
            .order('last_update', { ascending: false });

        if (!error && data) {
            callback(data as BasketballGame[]);
        }
    };

    fetchLive();

    // Realtime for live games table changes
    const channel = supabase
        .channel('live-games-feed')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: 'status=eq.live',
            },
            () => {
                // Re-fetch on any change (simpler than maintaining local state)
                fetchLive();
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Update a specific field in the games table.
 * 
 * NOTE: Firestore allowed nested dot paths like 'teamA.score'.
 * Postgres uses JSONB, so we handle this with jsonb_set or by
 * storing team data as JSONB columns.
 */
export const updateGameField = async (
    gameId: string,
    fieldPath: string,
    value: any
): Promise<void> => {
    // Parse nested paths: 'teamA.score' → update team_a JSONB at .score
    // For the Postgres schema, we store the full game as a JSONB document
    // in a 'data' column for migration simplicity. Can normalize later.
    const { error } = await supabase.rpc('update_game_field', {
        game_code: gameId,
        field_path: fieldPath,
        field_value: JSON.stringify(value),
    });

    if (error) {
        console.error('[Supabase] updateGameField failed:', error);
    }
};

/**
 * Update multiple fields in one operation.
 */
export const batchUpdateGame = async (
    gameId: string,
    updates: Record<string, any>
): Promise<void> => {
    const { error } = await supabase.rpc('batch_update_game', {
        game_code: gameId,
        updates_json: JSON.stringify(updates),
    });

    if (error) {
        console.error('[Supabase] batchUpdateGame failed:', error);
    }
};

/**
 * Create a new game.
 */
export const createGame = async (game: BasketballGame): Promise<void> => {
    const { error } = await supabase
        .from('games')
        .insert({
            code: game.code,
            host_id: game.hostId,
            sport: game.sport,
            status: game.status,
            game_type: game.gameType,
            data: game, // Store full game as JSONB for now
            created_at: game.createdAt,
            last_update: game.lastUpdate,
        });

    if (error) {
        console.error('[Supabase] createGame failed:', error);
        throw error;
    }
};

/**
 * Finish a game (mark as completed).
 */
export const finishGame = async (gameId: string): Promise<void> => {
    const { error } = await supabase
        .from('games')
        .update({
            status: 'finished',
            last_update: Date.now(),
        })
        .eq('code', gameId);

    if (error) {
        console.error('[Supabase] finishGame failed:', error);
    }
};

/**
 * Delete a game.
 */
export const deleteGame = async (gameId: string): Promise<void> => {
    const { error } = await supabase
        .from('games')
        .delete()
        .eq('code', gameId);

    if (error) {
        console.error('[Supabase] deleteGame failed:', error);
    }
};

/**
 * Get a single game by code (one-time fetch, no subscription).
 */
export const getGameByCode = async (code: string): Promise<BasketballGame | null> => {
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !data) return null;
    return data as BasketballGame;
};