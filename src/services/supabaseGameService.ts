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
import { validateBasketballGame } from '../validation/gameSchema';

// ─── Channel cache for realtime subscriptions ─────────────────────────────────
const gameSubChannels = new Map<string, RealtimeChannel>();

// ─── Data normalizer — runs on every row read from the DB ─────────────────────
/**
 * @deprecated DO NOT USE. This function patches over malformed DB data.
 * Fix the root cause: validate on write, not read.
 * Kept temporarily for reading legacy rows.
 */
const normalizeGameData_DEPRECATED = (data: any): BasketballGame => {
    console.warn('[DEPRECATED] normalizeGameData called. Migrate to validated writes.');
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

// Charset excludes O, 0, I, 1, S, 5 — visually ambiguous on small displays/ESP32 LCD
const CODE_CHARS = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

const generateGameCode = async (): Promise<string> => {
    const chars = CODE_CHARS;
    while (true) {
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Uniqueness check — retries on collision (astronomically rare but correct)
        const { data } = await supabase
            .from('games')
            .select('code')
            .eq('code', code)
            .maybeSingle();
        if (!data) return code;
    }
};

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
    const gameCode = await generateGameCode();

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
        sport,      // @deprecated legacy alias — kept for old components
        status: 'live',
        gameType: isOnline ? 'online' : 'local',
        createdAt: Date.now(),
        lastUpdate: Date.now(),
        settings,
        gameState: initialGameState,
        teamA: { ...createDefaultTeam(teamA.name, teamA.color), ...teamA },
        teamB: { ...createDefaultTeam(teamB.name, teamB.color), ...teamB },
    };

    // ✅ VALIDATION CHECKPOINT
    const validation = validateBasketballGame(newGame);
    if (!validation.success) {
        console.error('[Supabase] Game validation failed:', validation.errors);
        throw new Error(`Invalid game data: ${validation.errors.join(', ')}`);
    }

    // Write to Supabase Postgres
    const { error } = await supabase
        .from('games')
        .insert({
            code: gameCode,
            hostId,
            sportId: sport,
            status: 'live',
            gameType: isOnline ? 'online' : 'local',
            data: validation.data,
            lastUpdate: Date.now(),
        });

    if (error) {
        console.error('[Supabase] initializeNewGame failed:', error);
        throw new Error(`Failed to create game: ${error.message}`);
    }

    console.log(`[Supabase] Game ${gameCode} created in Postgres`);
    return gameCode;
};

/**
 * Create a game for any non-basketball sport.
 * Uses the generic BaseGameSchema (passthrough) — no basketball-specific fields required.
 */
export const initializeGenericGame = async (params: {
    gameName: string;
    sportId: string;
    rules: Record<string, unknown>;
    settings: Record<string, unknown>;
    initialState: Record<string, unknown>;
    teamA: { name: string; color: string; players?: any[] };
    teamB: { name: string; color: string; players?: any[] };
    hostId: string;
}): Promise<string> => {
    const { validateGenericGame } = await import('../validation/gameSchema');
    const gameCode = await generateGameCode();

    const gameData = {
        code: gameCode,
        hostId: params.hostId,
        sportId: params.sportId,
        sport: params.sportId,
        status: 'live' as const,
        createdAt: Date.now(),
        lastUpdate: Date.now(),
        rules: params.rules,
        settings: { gameName: params.gameName, ...params.settings },
        state: params.initialState,
        teamA: { name: params.teamA.name, color: params.teamA.color, score: 0, players: params.teamA.players ?? [] },
        teamB: { name: params.teamB.name, color: params.teamB.color, score: 0, players: params.teamB.players ?? [] },
    };

    const validation = validateGenericGame(gameData);
    if (!validation.success) {
        throw new Error(`Invalid game data: ${validation.errors?.join(', ')}`);
    }

    const { error } = await supabase
        .from('games')
        .insert({
            code: gameCode,
            hostId: params.hostId,
            sportId: params.sportId,
            status: 'live',
            gameType: 'online',
            data: gameData,
            lastUpdate: Date.now(),
        });

    if (error) throw new Error(`Failed to create game: ${error.message}`);
    console.log(`[Supabase] Generic game ${gameCode} (${params.sportId}) created`);
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

    // Initial fetch with retry — handles brief race between broadcast delivery
    // and DB propagation to REST endpoint (very rare but possible on slow networks).
    const fetchWithRetry = async (attemptsLeft: number): Promise<void> => {
        const { data, error } = await supabase
            .from('games')
            .select('data')
            .eq('code', code)
            .single();

        if (error || !data) {
            if (attemptsLeft > 1) {
                // Wait 600ms then retry (gives DB write time to propagate)
                setTimeout(() => fetchWithRetry(attemptsLeft - 1), 600);
            } else {
                callback(null); // Give up after 3 attempts (~1.8s total)
            }
        } else {
            // ✅ VALIDATE ON READ
            const validation = validateBasketballGame(data.data);
            if (validation.success) {
                callback(validation.data);
            } else {
                console.warn('[Supabase] Invalid game data from DB:', validation.errors);
                // Fallback to deprecated normalizer for legacy rows
                callback(normalizeGameData_DEPRECATED(data.data));
            }
        }
    };
    fetchWithRetry(3);

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
                    const validation = validateBasketballGame((payload.new as any).data);
                    callback(validation.success ? validation.data : normalizeGameData_DEPRECATED((payload.new as any).data));
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
            callback(data.map(row => {
                const validation = validateBasketballGame(row.data);
                return validation.success ? validation.data : normalizeGameData_DEPRECATED(row.data);
            }));
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

    // ✅ VALIDATE BEFORE WRITE
    const validation = validateBasketballGame(gameData);
    if (!validation.success) {
        console.error('[Supabase] updateGameField validation failed:', validation.errors);
        throw new Error(`Invalid game data after update: ${validation.errors.join(', ')}`);
    }

    // Write back
    const { error } = await supabase
        .from('games')
        .update({ data: validation.data, lastUpdate: Date.now() })
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

    // ✅ VALIDATE BEFORE WRITE
    const validation = validateBasketballGame(gameData);
    if (!validation.success) {
        console.error('[Supabase] batchUpdateGame validation failed:', validation.errors);
        throw new Error(`Invalid game data after update: ${validation.errors.join(', ')}`);
    }

    const { error } = await supabase
        .from('games')
        .update({ data: validation.data, lastUpdate: Date.now() })
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
    const validation = validateBasketballGame(data.data);
    return validation.success ? validation.data : normalizeGameData_DEPRECATED(data.data);
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

// ════════════════════════════════════════════════════════════════════════════
// BRIDGE
// This bridges BasketballGame (legacy flat type) ↔ Game<TState, TRules> (v2 engine)
// ════════════════════════════════════════════════════════════════════════════

import type { Game } from '../core/types/Game';

/**
 * Convert a BasketballGame (legacy flat type) to Game<any, any> for the v2 engine.
 *
 * Used by:
 *   - WallView.tsx (DynamicCourtCard subscribes to DB → needs Game<T,R> for manifests)
 *   - Any future component that reads from supabaseGameService but renders via sport manifests
 *
 * This becomes unnecessary once all pages migrate to the v2 Game<T,R> shape.
 */
// ─────────────────────────────────────────────────────────────────────────────
// FINALIZE GAME (atomic: game + bracket in one RPC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically complete a game and optionally advance the tournament bracket.
 * Replaces the previous pattern of calling finishGame() + a separate
 * tournament_fixtures update from the client (two round-trips, partial failure risk).
 *
 * When fixtureId + winnerSide are provided the RPC also:
 *   - marks the fixture 'completed' with winnerSide
 *   - propagates the winner name to the next bracket slot
 *
 * Falls back to the simple finishGame() call if the RPC fails.
 */
export const finalizeGameWithResult = async (
    gameCode: string,
    finalData: BasketballGame,
    fixtureId?: string | null,
    winnerSide?: 'A' | 'B' | null
): Promise<boolean> => {
    const { error } = await supabase.rpc('finalize_game_with_result', {
        p_game_code:   gameCode,
        p_final_data:  finalData,
        p_fixture_id:  fixtureId  ?? null,
        p_winner_side: winnerSide ?? null,
    });

    if (error) {
        console.error('[GameService] finalizeGameWithResult RPC failed, falling back:', error);
        return finishGame(gameCode);
    }
    return true;
};

export const toGenericGame = (bg: BasketballGame): Game<any, any> => ({
    id: bg.code,
    code: bg.code,
    hostId: bg.hostId,
    sportId: bg.sportId || bg.sport || 'basketball',
    status: bg.status === 'completed' ? 'completed' : bg.status === 'archived' ? 'archived' : 'live',
    createdAt: bg.createdAt,
    lastUpdate: bg.lastUpdate,
    rules: {
        periods: bg.settings?.periods || 4,
        periodDurationMin: bg.settings?.periodDuration || 10,
        shotClockSec: bg.settings?.shotClockDuration || 24,
        timeoutsPerHalf: 3,
    },
    state: {
        gameRunning: bg.gameState?.gameRunning || false,
        scoreA: bg.teamA?.score || 0,
        scoreB: bg.teamB?.score || 0,
        period: bg.gameState?.period || 1,
        shotClock: bg.gameState?.shotClock || 24,
        shotClockRunning: bg.gameState?.shotClockRunning || false,
        possession: bg.gameState?.possession || 'A',
        foulsA: bg.teamA?.fouls || 0,
        foulsB: bg.teamB?.fouls || 0,
        timeoutsA: bg.teamA?.timeouts || 0,
        timeoutsB: bg.teamB?.timeouts || 0,
    },
    teamA: {
        name: bg.teamA?.name || 'HOME',
        color: bg.teamA?.color || '#DC2626',
        score: bg.teamA?.score || 0,
    },
    teamB: {
        name: bg.teamB?.name || 'AWAY',
        color: bg.teamB?.color || '#2563EB',
        score: bg.teamB?.score || 0,
    },
});