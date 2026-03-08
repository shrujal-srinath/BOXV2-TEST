// src/services/supabaseGameService.ts
//
// THE BOX — Supabase Game Service
//
// REPLACES: src/services/gameService.ts (Firestore version)
//
// Architecture:
//   - Supabase Postgres → Durable storage (settings, rosters, final results)
//   - Supabase Broadcast → Live ephemeral data (clock, score during gameplay)

import { supabase } from './supabase';
import type { BasketballGame, GameSettings, TeamData, GameState, Player } from '../types';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ─── Channel cache for realtime subscriptions ─────────────────────────────────
const gameSubChannels = new Map<string, RealtimeChannel>();

// ─── Data normalizer — runs on every row read from the DB ─────────────────────
const normalizeGameData = (data: any): BasketballGame => {
    const game = { ...data };
    // Ensure sportId is always populated (handles rows written before the migration)
    game.sportId = game.sportId || game.sport || 'basketball';
    // Standardize legacy status value
    if (game.status === 'finished') game.status = 'completed';
    return game as BasketballGame;
};

// ============================================
// GAME CREATION (replaces Firestore setDoc)
// ============================================

const generateGameCode = (): string => Math.floor(100000 + Math.random() * 900000).toString();

const createDefaultPlayer = (id: string): Player => ({
    id, name: '', number: '', position: '',
    points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0,
    turnovers: 0, fouls: 0, disqualified: false,
    fieldGoalsMade: 0, fieldGoalsAttempted: 0,
    threePointsMade: 0, threePointsAttempted: 0,
    freeThrowsMade: 0, freeThrowsAttempted: 0,
});

const createDefaultTeam = (name: string, color: string): TeamData => ({
    name, color, score: 0,
    timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3,
    fouls: 0, foulsThisQuarter: 0,
    players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
});

/**
 * Initialize a new game — writes to Supabase Postgres instead of Firestore.
 * * Drop-in replacement for gameService.initializeNewGame().
 * Same signature, same return type (game code string).
 */
export const initializeNewGame = async (
    settings: GameSettings,
    teamA: Partial<TeamData> & { name: string; color: string },
    teamB: Partial<TeamData> & { name: string; color: string },
    isOnline: boolean,
    sport: string,
    hostId: string
): Promise<string> => {
    const gameCode = generateGameCode();

    const initialGameState: GameState = {
        period: 1,
        gameTime: { minutes: settings.periodDuration, seconds: 0, tenths: 0 },
        shotClock: settings.shotClockDuration,
        gameRunning: false,
        shotClockRunning: false,
        possession: 'A',
    };

    const newGame: BasketballGame = {
        code: gameCode,
        hostId,
        sportId: sport,
        sport,      // legacy fallback
        status: 'live',
        gameType: isOnline ? 'online' : 'local',
        createdAt: Date.now(),
        lastUpdate: Date.now(),
        settings,
        gameState: initialGameState,
        teamA: { ...createDefaultTeam(teamA.name, teamA.color), ...teamA },
        teamB: { ...createDefaultTeam(teamB.name, teamB.color), ...teamB },
    };

    // Write to Supabase Postgres
    const { error } = await supabase
        .from('games')
        .insert({
            code: gameCode,
            hostId,
            sportId: sport,
            status: 'live',
            gameType: isOnline ? 'online' : 'local',
            data: newGame,
            lastUpdate: Date.now(),
        });

    if (error) {
        console.error('[Supabase] initializeNewGame failed:', error);
        throw new Error(`Failed to create game: ${error.message}`);
    }

    console.log(`[Supabase] Game ${gameCode} created in Postgres`);
    return gameCode;
};

// ============================================
// SUPABASE POSTGRES OPERATIONS (COLD DATA)
// ============================================

/**
 * Subscribe to game data. Uses Supabase Realtime Postgres Changes.
 */
export const subscribeToGame = (
    code: string,
    callback: (game: BasketballGame | null) => void
): (() => void) => {
    if (!code) {
        callback(null);
        return () => { };
    }

    // Initial fetch — game is stored in the `data` JSONB column
    supabase
        .from('games')
        .select('data')
        .eq('code', code)
        .single()
        .then(({ data, error }) => {
            if (error || !data) {
                callback(null);
            } else {
                callback(normalizeGameData(data.data));
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
                } else if (payload.new && (payload.new as any).data) {
                    callback(normalizeGameData((payload.new as any).data));
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
 * Subscribe to live games feed.
 */
export const subscribeToLiveGames = (
    callback: (games: BasketballGame[]) => void
): (() => void) => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const fetchLive = async () => {
        const cutoff = Date.now() - ONE_DAY_MS;
        const { data, error } = await supabase
            .from('games')
            .select('data')
            .eq('status', 'live')
            .gt('lastUpdate', cutoff)
            .order('lastUpdate', { ascending: false });

        if (!error && data) {
            callback(data.map(row => normalizeGameData(row.data)));
        }
    };

    fetchLive();

    const channelName = `live-games-feed-${Date.now()}`;
    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: 'status=eq.live',
            },
            () => {
                fetchLive();
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Update a specific field in the game's data JSONB column.
 */
export const updateGameField = async (
    gameId: string,
    fieldPath: string,
    value: any
): Promise<void> => {
    // Fetch current data, update the field, write back
    const { data: row, error: fetchError } = await supabase
        .from('games')
        .select('data')
        .eq('code', gameId)
        .single();

    if (fetchError || !row) {
        console.error('[Supabase] updateGameField fetch failed:', fetchError);
        return;
    }

    const gameData = row.data as any;

    // Navigate dot path and set value
    const parts = fieldPath.split('.');
    let obj = gameData;
    for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] === undefined) obj[parts[i]] = {};
        obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;

    // Write back
    const { error } = await supabase
        .from('games')
        .update({ data: gameData, lastUpdate: Date.now() })
        .eq('code', gameId);

    if (error) {
        console.error('[Supabase] updateGameField write failed:', error);
    }
};

/**
 * Update multiple fields in one operation.
 */
export const batchUpdateGame = async (
    gameId: string,
    updates: Record<string, any>
): Promise<void> => {
    const { data: row, error: fetchError } = await supabase
        .from('games')
        .select('data')
        .eq('code', gameId)
        .single();

    if (fetchError || !row) {
        console.error('[Supabase] batchUpdateGame fetch failed:', fetchError);
        return;
    }

    const gameData = row.data as any;

    // Apply all updates
    for (const [fieldPath, value] of Object.entries(updates)) {
        if (fieldPath === 'lastUpdate') continue;
        const parts = fieldPath.split('.');
        let obj = gameData;
        for (let i = 0; i < parts.length - 1; i++) {
            if (obj[parts[i]] === undefined) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    }

    const { error } = await supabase
        .from('games')
        .update({ data: gameData, lastUpdate: Date.now() })
        .eq('code', gameId);

    if (error) {
        console.error('[Supabase] batchUpdateGame write failed:', error);
    }
};

/**
 * Finish a game.
 * NOTE: Schema only allows 'live' | 'completed' | 'archived' — never 'finished'.
 */
export const finishGame = async (gameId: string): Promise<void> => {
    const { error } = await supabase
        .from('games')
        .update({ status: 'completed', lastUpdate: Date.now() })
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
 * Get a single game by code (one-time fetch).
 */
export const getGameByCode = async (code: string): Promise<BasketballGame | null> => {
    const { data, error } = await supabase
        .from('games')
        .select('data')
        .eq('code', code)
        .single();

    if (error || !data) return null;
    return normalizeGameData(data.data);
};

/**
 * Alias for backward compatibility.
 */
export const getGame = getGameByCode;

/**
 * NEW: Record a game event (score, foul, etc) via RPC.
 * This both updates the durable JSONB and triggers real-time broadcasts.
 */
export const recordGameEvent = async (params: {
    gameCode: string;
    eventType: string;
    team?: 'A' | 'B' | null;
    amount?: number;
    period?: number;
    actorId?: string;
    actorType?: 'web' | 'hardware';
    eventData?: any;
    gameSnapshot: BasketballGame;
}): Promise<void> => {
    const { error } = await supabase.rpc('record_game_event', {
        p_game_code: params.gameCode,
        p_event_type: params.eventType,
        p_team: params.team || null,
        p_amount: params.amount || 0,
        p_period: params.period || 1,
        p_actor_id: params.actorId || 'system',
        p_actor_type: params.actorType || 'web',
        p_event_data: params.eventData || {},
        p_game_snapshot: params.gameSnapshot
    });

    if (error) {
        console.error('[Supabase] record_game_event failed:', error);
        throw error;
    }
};