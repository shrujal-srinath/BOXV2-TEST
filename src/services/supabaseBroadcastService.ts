// src/services/supabaseBroadcastService.ts
//
// THE BOX — Supabase Realtime Broadcast for Live Game Data
//
// REPLACES: src/services/rtdbClockService.ts
//
// KEY ARCHITECTURAL DIFFERENCE FROM FIREBASE RTDB:
//   Firebase RTDB: Host writes to a database node. Each spectator opens
//   a persistent listener on that node. Firebase multiplies the download
//   cost by N spectators. Every tick is a database write.
//
//   Supabase Broadcast: Host sends an ephemeral message to a channel.
//   Supabase's Realtime server (Elixir/Phoenix) fans out to all subscribers
//   via WebSocket. ZERO database writes. ZERO per-subscriber cost multiplication.
//   This is true pub/sub — built for exactly this use case.
//
// CHANNEL NAMING:
//   game:{gameCode}:clock  → Clock ticks (every 1s when running)
//   game:{gameCode}:score  → Score/fouls/timeouts/possession updates
//   game:{gameCode}:state  → Full game state snapshot (on connect, period changes)
//
// We use a SINGLE channel per game with different event types to minimize
// WebSocket connections. This is more efficient than multiple channels.

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types (matching existing RTDB types for drop-in compatibility) ───────────

export interface BroadcastClockState {
    gameRunning: boolean;
    shotClockRunning: boolean;
    minutes: number;
    seconds: number;
    tenths: number;
    shotClock: number;
    period: number;
    startedAt: number | null;
    shotClockStartedAt: number | null;
}

export interface BroadcastScoreState {
    teamA: number;
    teamB: number;
    foulsA: number;
    foulsB: number;
    timeoutsA: number;
    timeoutsB: number;
    possession: 'A' | 'B';
}

// Full game state snapshot — sent on initial connection and period transitions
export interface BroadcastGameSnapshot {
    clock: BroadcastClockState;
    score: BroadcastScoreState;
    timestamp: number;
}

// ─── Channel Management ───────────────────────────────────────────────────────

// Cache channels so we don't create duplicates per game
const channelCache = new Map<string, RealtimeChannel>();

/**
 * Get or create a Supabase Realtime channel for a game.
 * 
 * Uses PUBLIC channels — no auth required for spectators.
 * This is the killer feature: QR code on arena screen → scan → instant live data.
 * No anonymous auth, no token refresh, no Firebase SDK download.
 */
const getGameChannel = (gameCode: string): RealtimeChannel => {
    const topic = `game:${gameCode}`;

    if (channelCache.has(topic)) {
        return channelCache.get(topic)!;
    }

    const channel = supabase.channel(topic, {
        config: {
            broadcast: {
                // Host receives its own broadcasts (needed for state consistency)
                self: true,
                // Wait for server acknowledgment before resolving
                ack: false, // false = fire-and-forget for lowest latency
            },
        },
    });

    channelCache.set(topic, channel);
    return channel;
};

/**
 * Cleanup a game channel. Call on component unmount or game end.
 */
export const removeGameChannel = async (gameCode: string): Promise<void> => {
    const topic = `game:${gameCode}`;
    const channel = channelCache.get(topic);

    if (channel) {
        await supabase.removeChannel(channel);
        channelCache.delete(topic);
    }
};

// ─── Host-Side: Broadcasting (Write) ──────────────────────────────────────────

/**
 * Called every 1 second by the host's setInterval.
 * Broadcasts the current clock state to all spectators.
 * 
 * ZERO database writes. This is pure WebSocket pub/sub.
 * Compare with RTDB's pushClockTick which does:
 *   await update(ref(rtdb, `games/${gameCode}/clock`), {...})
 * That's a database write × N reads. This is just a message.
 */
export const broadcastClockTick = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    tenths: number,
    shotClock: number
): Promise<void> => {
    const channel = getGameChannel(gameCode);

    try {
        await channel.send({
            type: 'broadcast',
            event: 'clock_tick',
            payload: { minutes, seconds, tenths, shotClock, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] clockTick failed:', err);
    }
};

/**
 * Called when host presses START.
 */
export const broadcastClockStart = async (
    gameCode: string,
    fullState: BroadcastClockState
): Promise<void> => {
    const channel = getGameChannel(gameCode);

    try {
        await channel.send({
            type: 'broadcast',
            event: 'clock_start',
            payload: { ...fullState, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] clockStart failed:', err);
    }
};

/**
 * Called when host presses STOP.
 */
export const broadcastClockStop = async (
    gameCode: string,
    fullState: BroadcastClockState
): Promise<void> => {
    const channel = getGameChannel(gameCode);

    try {
        await channel.send({
            type: 'broadcast',
            event: 'clock_stop',
            payload: { ...fullState, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] clockStop failed:', err);
    }
};

/**
 * Called when shot clock is reset (24s or 14s).
 */
export const broadcastShotClockReset = async (
    gameCode: string,
    value: number,
    gameRunning: boolean
): Promise<void> => {
    const channel = getGameChannel(gameCode);

    try {
        await channel.send({
            type: 'broadcast',
            event: 'shotclock_reset',
            payload: { shotClock: value, shotClockRunning: gameRunning, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] shotClockReset failed:', err);
    }
};

/**
 * Called when period changes.
 */
export const broadcastPeriodChange = async (
    gameCode: string,
    period: number,
    fullState: BroadcastClockState
): Promise<void> => {
    const channel = getGameChannel(gameCode);

    try {
        await channel.send({
            type: 'broadcast',
            event: 'period_change',
            payload: { period, ...fullState, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] periodChange failed:', err);
    }
};

/**
 * Called when host manually edits clocks via TimeEditModal.
 */
export const broadcastClockEdit = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    tenths: number,
    shotClock: number
): Promise<void> => {
    const channel = getGameChannel(gameCode);

    try {
        await channel.send({
            type: 'broadcast',
            event: 'clock_edit',
            payload: {
                minutes, seconds, tenths, shotClock,
                startedAt: null,
                shotClockStartedAt: null,
                ts: Date.now(),
            },
        });
    } catch (err) {
        console.error('[Broadcast] clockEdit failed:', err);
    }
};

/**
 * Called after every score/foul/timeout/possession change.
 * Replaces pushScoreUpdate from rtdbClockService.
 */
export const broadcastScoreUpdate = async (
    gameCode: string,
    scoreA: number,
    scoreB: number,
    foulsA: number,
    foulsB: number,
    timeoutsA: number,
    timeoutsB: number,
    possession: 'A' | 'B'
): Promise<void> => {
    const channel = getGameChannel(gameCode);

    try {
        await channel.send({
            type: 'broadcast',
            event: 'score_update',
            payload: {
                teamA: scoreA,
                teamB: scoreB,
                foulsA, foulsB,
                timeoutsA, timeoutsB,
                possession,
                ts: Date.now(),
            },
        });
    } catch (err) {
        console.error('[Broadcast] scoreUpdate failed:', err);
    }
};

/**
 * Send a full game state snapshot.
 * Used when:
 *   1. A new spectator joins (host detects via Presence, sends snapshot)
 *   2. Period transitions
 *   3. Manual "sync all" trigger from host
 * 
 * This solves the "late joiner" problem that pure Broadcast has:
 * if you connect after the last tick, you see stale data.
 * The host periodically broadcasts snapshots (every 5s) as a heartbeat.
 */
export const broadcastGameSnapshot = async (
    gameCode: string,
    clock: BroadcastClockState,
    score: BroadcastScoreState
): Promise<void> => {
    const channel = getGameChannel(gameCode);

    try {
        await channel.send({
            type: 'broadcast',
            event: 'game_snapshot',
            payload: { clock, score, timestamp: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] gameSnapshot failed:', err);
    }
};

// ─── Spectator-Side: Subscribing (Read) ───────────────────────────────────────

export interface GameBroadcastCallbacks {
    onClockTick?: (payload: { minutes: number; seconds: number; tenths: number; shotClock: number; ts: number }) => void;
    onClockStart?: (payload: BroadcastClockState & { ts: number }) => void;
    onClockStop?: (payload: BroadcastClockState & { ts: number }) => void;
    onShotClockReset?: (payload: { shotClock: number; shotClockRunning: boolean; ts: number }) => void;
    onPeriodChange?: (payload: BroadcastClockState & { period: number; ts: number }) => void;
    onClockEdit?: (payload: { minutes: number; seconds: number; tenths: number; shotClock: number; ts: number }) => void;
    onScoreUpdate?: (payload: BroadcastScoreState & { ts: number }) => void;
    onGameSnapshot?: (payload: BroadcastGameSnapshot) => void;
}

/**
 * Subscribe to all game broadcast events.
 * Returns an unsubscribe function — call on component unmount.
 * 
 * Usage in SpectatorView:
 *   useEffect(() => {
 *     const unsub = subscribeToGameBroadcast(gameCode, {
 *       onClockTick: (p) => setClock(prev => ({ ...prev, ...p })),
 *       onScoreUpdate: (p) => setScore(p),
 *       onGameSnapshot: (p) => { setClock(p.clock); setScore(p.score); },
 *     });
 *     return unsub;
 *   }, [gameCode]);
 */
export const subscribeToGameBroadcast = (
    gameCode: string,
    callbacks: GameBroadcastCallbacks
): (() => void) => {
    const channel = getGameChannel(gameCode);

    // Register event listeners
    if (callbacks.onClockTick) {
        channel.on('broadcast', { event: 'clock_tick' }, ({ payload }) => {
            callbacks.onClockTick!(payload);
        });
    }

    if (callbacks.onClockStart) {
        channel.on('broadcast', { event: 'clock_start' }, ({ payload }) => {
            callbacks.onClockStart!(payload);
        });
    }

    if (callbacks.onClockStop) {
        channel.on('broadcast', { event: 'clock_stop' }, ({ payload }) => {
            callbacks.onClockStop!(payload);
        });
    }

    if (callbacks.onShotClockReset) {
        channel.on('broadcast', { event: 'shotclock_reset' }, ({ payload }) => {
            callbacks.onShotClockReset!(payload);
        });
    }

    if (callbacks.onPeriodChange) {
        channel.on('broadcast', { event: 'period_change' }, ({ payload }) => {
            callbacks.onPeriodChange!(payload);
        });
    }

    if (callbacks.onClockEdit) {
        channel.on('broadcast', { event: 'clock_edit' }, ({ payload }) => {
            callbacks.onClockEdit!(payload);
        });
    }

    if (callbacks.onScoreUpdate) {
        channel.on('broadcast', { event: 'score_update' }, ({ payload }) => {
            callbacks.onScoreUpdate!(payload);
        });
    }

    if (callbacks.onGameSnapshot) {
        channel.on('broadcast', { event: 'game_snapshot' }, ({ payload }) => {
            callbacks.onGameSnapshot!(payload);
        });
    }

    // Subscribe to the channel (actually connect the WebSocket)
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`[Broadcast] Subscribed to game:${gameCode}`);
        } else if (status === 'CHANNEL_ERROR') {
            console.error(`[Broadcast] Channel error for game:${gameCode}`);
        }
    });

    // Return cleanup function
    return () => {
        removeGameChannel(gameCode);
    };
};