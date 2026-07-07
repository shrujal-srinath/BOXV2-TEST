// pi-daemon/supabaseSync.js
// ═══════════════════════════════════════════════════════════════
// THE BOX — Supabase Sync Layer
//
// Uses the SERVICE ROLE KEY so the Pi can write to the games table
// without needing an authenticated user session.
//
// Responsibilities:
//   1. createGame()             — insert a new game row, return game code
//   2. fetchGameByCode()        — read persisted state for crash recovery
//   3. persistGameState()       — update games.data JSONB on every action
//   4. flushPendingPersist()    — force any throttled write to flush now
//   5. ensureChannel()          — pre-create the realtime channel on setup
//   6. broadcastToCloud()       — score_update broadcast
//   7. broadcastClockTick()     — per-second clock_tick broadcast
//   8. broadcastClockStart/Stop — fired on clock transitions
//   9. writeShotEvent()         — insert one shot_events row (returns id)
//  10. writeGameAction()        — insert one game_actions row (returns id)
//  11. deleteShotEvent()        — remove a shot_events row (for undo)
//  12. deleteGameAction()       — remove a game_actions row (for undo)
//  13. finishGame()             — mark game completed (flushes pending state)
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Service role key — bypasses RLS

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  No Supabase credentials found in .env. Cloud sync is DISABLED.');
    console.warn('    Add SUPABASE_URL and SUPABASE_SERVICE_KEY to pi-daemon/.env');
}

// Service role client — can write to any table regardless of RLS
const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;

let activeChannel = null;
let activeChannelCode = null;

// ─── Game Code Generator ───────────────────────────────────────
// Matches the website's algorithm exactly.
// Excludes O, 0, I, 1, S, 5 — visually ambiguous characters.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

const generateGameCode = async () => {
    if (!supabase) {
        // Offline fallback — generate a local code without uniqueness check
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
        }
        return code;
    }

    while (true) {
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
        }
        // Uniqueness check — retries on collision (astronomically rare)
        const { data } = await supabase
            .from('games')
            .select('code')
            .eq('code', code)
            .maybeSingle();
        if (!data) return code;
    }
};

// ─── Game Creation ─────────────────────────────────────────────
/**
 * Creates a new game in Supabase, identical to how the website does it.
 *
 * @param {object} config - { teamAName, teamBName, teamAColor, teamBColor,
 *                            periodMinutes, shotClockSeconds, periods, periodType }
 * @returns {string} gameCode — the 4-char code, or null if offline
 */
export const createGame = async (config) => {
    const gameCode = await generateGameCode();
    const now = Date.now();

    const gameData = {
        code: gameCode,
        hostId: 'THE-BOX-PI',         // Pi device identifier
        sportId: 'basketball',
        sport: 'basketball',
        status: 'live',
        gameType: 'local',
        createdAt: now,
        lastUpdate: now,
        settings: {
            gameName: `${config.teamAName} vs ${config.teamBName}`,
            periodDuration: config.periodMinutes,
            shotClockDuration: config.shotClockSeconds,
            periodType: config.periodType || 'quarter',
            periods: config.periods || 4,
            gameMode: config.gameMode || 'quick',
        },
        gameState: {
            period: 1,
            gameTime: {
                minutes: config.periodMinutes,
                seconds: 0,
                tenths: 0,
            },
            shotClock: config.shotClockSeconds,
            gameRunning: false,
            shotClockRunning: false,
            possession: 'A',
        },
        teamA: {
            name: config.teamAName,
            color: config.teamAColor || '#3B82F6',
            score: 0,
            fouls: 0,
            foulsThisQuarter: 0,
            timeouts: config.timeoutsPerTeam || 2,
            timeoutsFirstHalf: 2,
            timeoutsSecondHalf: 3,
            players: config.playersA || [],
        },
        teamB: {
            name: config.teamBName,
            color: config.teamBColor || '#EF4444',
            score: 0,
            fouls: 0,
            foulsThisQuarter: 0,
            timeouts: config.timeoutsPerTeam || 2,
            timeoutsFirstHalf: 2,
            timeoutsSecondHalf: 3,
            players: config.playersB || [],
        },
    };

    if (!supabase) {
        console.log(`[Offline] Game ${gameCode} created locally only (no Supabase)`);
        return gameCode;
    }

    const { error } = await supabase
        .from('games')
        .insert({
            code: gameCode,
            hostId: 'THE-BOX-PI',
            sportId: 'basketball',
            status: 'live',
            gameType: 'local',
            data: gameData,
            lastUpdate: now,
        });

    if (error) {
        console.error('[Supabase] createGame failed:', error.message);
        // Don't throw — game still works locally even if Supabase write fails
        return gameCode;
    }

    console.log(`☁️  Game ${gameCode} created in Supabase`);
    return gameCode;
};

// ─── Resume / Crash Recovery ───────────────────────────────────
/**
 * Fetches the persisted game row by code. Used by setup_game when an
 * existingGameCode is supplied (daemon crashed / restarted mid-game).
 *
 * Returns the full row including `data` JSONB, or null if not found or offline.
 */
export const fetchGameByCode = async (gameCode) => {
    if (!supabase || !gameCode) return null;
    const { data, error } = await supabase
        .from('games')
        .select('code, status, data')
        .eq('code', gameCode)
        .maybeSingle();
    if (error) {
        console.error('[Supabase] fetchGameByCode failed:', error.message);
        return null;
    }
    return data || null;
};

// ─── State Persistence ─────────────────────────────────────────
/**
 * Persists the full game state to the games.data JSONB column.
 * Called after every score/foul/timeout action (NOT on every clock tick).
 * Throttled internally — max 1 write per 500ms to avoid rate limits.
 */
let lastPersistTime = 0;
let pendingPersist = null;
let pendingPersistArgs = null;

const doPersist = async (gameCode, state) => {
    lastPersistTime = Date.now();

    const { data: existing, error: fetchError } = await supabase
        .from('games')
        .select('data')
        .eq('code', gameCode)
        .maybeSingle();

    if (fetchError || !existing) return;

    const merged = {
        ...existing.data,
        lastUpdate: Date.now(),
        teamA: { ...existing.data.teamA, score: state.teamA.score, fouls: state.teamA.fouls, timeouts: state.teamA.timeouts },
        teamB: { ...existing.data.teamB, score: state.teamB.score, fouls: state.teamB.fouls, timeouts: state.teamB.timeouts },
        gameState: {
            ...existing.data.gameState,
            period: state.clock.period,
            gameRunning: state.clock.isRunning,
            gameTime: {
                minutes: Math.floor(state.clock.gameMs / 60000),
                seconds: Math.floor((state.clock.gameMs % 60000) / 1000),
                tenths: 0,
            },
            shotClock: Math.ceil(state.clock.shotMs / 1000),
            possession: state.possession ?? existing.data.gameState?.possession ?? 'A',
        },
    };

    const { error } = await supabase
        .from('games')
        .update({ data: merged, lastUpdate: Date.now() })
        .eq('code', gameCode);

    if (error) console.error('[Supabase] persistGameState failed:', error.message);
};

export const persistGameState = (gameCode, state) => {
    if (!supabase || !gameCode) return;

    const now = Date.now();
    const timeSinceLast = now - lastPersistTime;

    // Always keep the latest args — if a write is pending, it'll use them.
    pendingPersistArgs = { gameCode, state };

    if (pendingPersist) return; // a write is already queued; it will use latest args

    if (timeSinceLast >= 500) {
        const args = pendingPersistArgs;
        pendingPersistArgs = null;
        doPersist(args.gameCode, args.state);
    } else {
        pendingPersist = setTimeout(() => {
            pendingPersist = null;
            const args = pendingPersistArgs;
            pendingPersistArgs = null;
            if (args) doPersist(args.gameCode, args.state);
        }, 500 - timeSinceLast);
    }
};

/**
 * Forces any pending throttled persistGameState write to flush immediately.
 * Awaitable — resolves when the underlying Supabase write completes.
 * Called from end_game / finishGame so the final state always lands before
 * status is flipped to 'completed'.
 */
export const flushPendingPersist = async () => {
    if (pendingPersist) {
        clearTimeout(pendingPersist);
        pendingPersist = null;
    }
    const args = pendingPersistArgs;
    pendingPersistArgs = null;
    if (args) await doPersist(args.gameCode, args.state);
};

// ─── Game Finish ───────────────────────────────────────────────
export const finishGame = async (gameCode) => {
    if (!supabase || !gameCode) return;

    // Make sure the throttled persist has landed before we flip status.
    await flushPendingPersist();

    const { error } = await supabase
        .from('games')
        .update({ status: 'completed', lastUpdate: Date.now() })
        .eq('code', gameCode);

    if (error) console.error('[Supabase] finishGame failed:', error.message);
    else console.log(`☁️  Game ${gameCode} marked as completed`);
};

// ─── Realtime Broadcast ────────────────────────────────────────
// Uses ANON key for broadcast — this is fine, broadcast is ephemeral
// and doesn't touch the DB. We create a second client for this.
const anonKey = process.env.SUPABASE_ANON_KEY;
const broadcastClient = supabaseUrl && anonKey
    ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    : supabase; // fallback to service client if no anon key

/**
 * Ensures the realtime channel for this game exists and is subscribed.
 * Called from setup_game so cloud viewers receive clock_tick from the
 * very first tick, not just after the first score-changing action.
 *
 * Web consumers (supabaseBroadcastService, useSupabaseBroadcast, SpectatorView)
 * subscribe to `game:${code}` and listen for: clock_tick / clock_start /
 * clock_stop / score_update. Keep both ends aligned.
 */
export const ensureChannel = (gameCode) => {
    if (!broadcastClient || !gameCode) return;
    if (activeChannelCode === gameCode && activeChannel) return;

    if (activeChannel) {
        broadcastClient.removeChannel(activeChannel);
        activeChannel = null;
    }

    activeChannelCode = gameCode;
    activeChannel = broadcastClient.channel(`game:${gameCode}`);
    activeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`☁️  Broadcasting on channel [game:${gameCode}]`);
    });
};

export const broadcastToCloud = (gameCode, state) => {
    if (!broadcastClient || !gameCode) return;
    ensureChannel(gameCode);

    activeChannel.send({
        type: 'broadcast',
        event: 'score_update',
        payload: {
            teamA: state.teamA.score,
            teamB: state.teamB.score,
            foulsA: state.teamA.fouls,
            foulsB: state.teamB.fouls,
            timeoutsA: state.teamA.timeouts,
            timeoutsB: state.teamB.timeouts,
            possession: state.possession ?? 'A',
            period: state.clock.period,
            ts: Date.now(),
        }
    });
};

/**
 * Per-tick clock broadcast for cloud spectators. Event name matches
 * supabaseBroadcastService.broadcastClockTick exactly.
 */
export const broadcastClockTick = (gameCode, clockState) => {
    if (!activeChannel || activeChannelCode !== gameCode) return;
    activeChannel.send({
        type: 'broadcast',
        event: 'clock_tick',
        payload: {
            minutes: Math.floor(clockState.gameMs / 60000),
            seconds: Math.floor((clockState.gameMs % 60000) / 1000),
            tenths: 0,
            shotClock: Math.ceil(clockState.shotMs / 1000),
            period: clockState.period,
            gameRunning: clockState.isRunning,
            ts: Date.now(),
        }
    });
};

/** Fired once when the clock transitions to running. */
export const broadcastClockStart = (gameCode, clockState) => {
    if (!activeChannel || activeChannelCode !== gameCode) return;
    activeChannel.send({
        type: 'broadcast',
        event: 'clock_start',
        payload: {
            minutes: Math.floor(clockState.gameMs / 60000),
            seconds: Math.floor((clockState.gameMs % 60000) / 1000),
            tenths: 0,
            shotClock: Math.ceil(clockState.shotMs / 1000),
            period: clockState.period,
            gameRunning: true,
            ts: Date.now(),
        }
    });
};

/** Fired once when the clock transitions to stopped. */
export const broadcastClockStop = (gameCode, clockState) => {
    if (!activeChannel || activeChannelCode !== gameCode) return;
    activeChannel.send({
        type: 'broadcast',
        event: 'clock_stop',
        payload: {
            minutes: Math.floor(clockState.gameMs / 60000),
            seconds: Math.floor((clockState.gameMs % 60000) / 1000),
            tenths: 0,
            shotClock: Math.ceil(clockState.shotMs / 1000),
            period: clockState.period,
            gameRunning: false,
            ts: Date.now(),
        }
    });
};

// ─── Shot Event Writer ─────────────────────────────────────────
/**
 * Writes a single shot attribution event to shot_events table.
 * Throws if Supabase is unavailable — caller should catch and queue.
 * Returns the inserted row's id so the caller can delete it on UNDO.
 */
export const writeShotEvent = async (gameCode, event) => {
    if (!supabase) throw new Error('Supabase unavailable');

    const { data, error } = await supabase
        .from('shot_events')
        .insert({
            game_code: gameCode,
            player_id: event.playerId ?? null,
            team_side: event.team,
            x: event.x ?? null,
            y: event.y ?? null,
            zone: event.zone ?? 'unlocated',
            // Honour the made flag (default true for legacy made-only score-button flow).
            made: event.made ?? true,
            points: event.points,
            shot_type: event.points === 1 ? 'free_throw' : 'field_goal',
            period: event.period ?? 1,
            game_clock_sec: event.gameClockSec ?? null,
            shot_clock_sec: event.shotClockSec ?? null,
            attributes: Array.isArray(event.attributes) ? event.attributes : [],
            input_method: 'live',
            created_at: event.createdAt ?? new Date().toISOString(),
        })
        .select('id')
        .single();

    if (error) throw new Error(error.message);
    return data?.id ?? null;
};

/**
 * Deletes a single shot_events row. Used by UNDO to keep the shot chart
 * consistent with the visible score. Silent no-op if id is null/missing.
 */
export const deleteShotEvent = async (shotId) => {
    if (!supabase || !shotId) return;
    const { error } = await supabase.from('shot_events').delete().eq('id', shotId);
    if (error) console.error('[Supabase] deleteShotEvent failed:', error.message);
};

// ─── Game Action Writer ────────────────────────────────────────
/**
 * Writes a single game_actions row (foul, timeout, etc).
 * Mirrors src/services/shotService.ts createGameAction so the play-by-play
 * timeline picks up Pi-scored games. Returns inserted id (for undo).
 */
export const writeGameAction = async (gameCode, action) => {
    if (!supabase) throw new Error('Supabase unavailable');

    const { data, error } = await supabase
        .from('game_actions')
        .insert({
            game_code: gameCode,
            player_id: action.playerId ?? null,
            team_side: action.team,
            action_type: action.actionType,
            subtype: action.subtype ?? null,
            period: action.period ?? 1,
            game_clock_sec: action.gameClockSec ?? null,
            related_shot_id: action.relatedShotId ?? null,
        })
        .select('id')
        .single();

    if (error) throw new Error(error.message);
    return data?.id ?? null;
};

/** Deletes a single game_actions row (used by undo). */
export const deleteGameAction = async (actionId) => {
    if (!supabase || !actionId) return;
    const { error } = await supabase.from('game_actions').delete().eq('id', actionId);
    if (error) console.error('[Supabase] deleteGameAction failed:', error.message);
};

// ─── Channel Teardown ──────────────────────────────────────────
export const teardownChannel = () => {
    if (activeChannel && broadcastClient) {
        broadcastClient.removeChannel(activeChannel);
        activeChannel = null;
        activeChannelCode = null;
    }
};
