// src/services/supabaseBroadcastService.ts
//
// THE BOX — Supabase Realtime Broadcast for Live Game Data
//
// REPLACES: src/services/rtdbClockService.ts
//
// ARCHITECTURE:
//   - Single channel per game: game:{gameCode}
//   - subscribeToGameBroadcast() registers .on() handlers then .subscribe()
//   - All send functions wait for the channel to be subscribed
//   - No duplicate channels, no race conditions

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

console.log('[DEBUG] supabaseBroadcastService loaded');

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface BroadcastGameSnapshot {
    clock: BroadcastClockState;
    score: BroadcastScoreState;
    timestamp: number;
}

// ─── Channel Management ───────────────────────────────────────────────────────

// Single source of truth: one channel per game, one ready promise per game
const channelCache = new Map<string, RealtimeChannel>();
const channelReadyResolvers = new Map<string, {
    promise: Promise<RealtimeChannel>;
    resolve: (ch: RealtimeChannel) => void;
}>();

/**
 * Wait for the channel to be subscribed. 
 * If subscribeToGameBroadcast hasn't been called yet, this creates the channel
 * and subscribes it (without .on() handlers — host-only path).
 * If subscribeToGameBroadcast was already called, this resolves immediately.
 */
const waitForChannel = (gameCode: string): Promise<RealtimeChannel> => {
    const topic = `game:${gameCode}`;

    // Already have a ready promise? Return it.
    if (channelReadyResolvers.has(topic)) {
        return channelReadyResolvers.get(topic)!.promise;
    }

    // No one has set up this channel yet (host sending before subscribe).
    // Create channel, subscribe, and resolve when ready.
    let resolveReady: (ch: RealtimeChannel) => void;
    const promise = new Promise<RealtimeChannel>((resolve) => {
        resolveReady = resolve;
    });
    channelReadyResolvers.set(topic, { promise, resolve: resolveReady! });

    let channel: RealtimeChannel;
    if (channelCache.has(topic)) {
        channel = channelCache.get(topic)!;
    } else {
        channel = supabase.channel(topic, {
            config: { broadcast: { self: true, ack: false } },
        });
        channelCache.set(topic, channel);
    }

    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`[Broadcast] Channel ready (send path): ${topic}`);
            resolveReady(channel);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`[Broadcast] Channel failed: ${topic} — ${status}`);
        }
    });

    return promise;
};

/**
 * Cleanup a game channel.
 */
export const removeGameChannel = async (gameCode: string): Promise<void> => {
    const topic = `game:${gameCode}`;
    const channel = channelCache.get(topic);

    if (channel) {
        await supabase.removeChannel(channel);
        channelCache.delete(topic);
        channelReadyResolvers.delete(topic);
    }
};

// ─── Host-Side: Broadcasting (Write) ──────────────────────────────────────────

export const broadcastClockTick = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    tenths: number,
    shotClock: number
): Promise<void> => {
    try {
        const channel = await waitForChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'clock_tick',
            payload: { minutes, seconds, tenths, shotClock, ts: Date.now() },
        });
    } catch (err) { /* silent for ticks */ }
};

export const broadcastClockStart = async (
    gameCode: string,
    fullState: BroadcastClockState
): Promise<void> => {
    try {
        const channel = await waitForChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'clock_start',
            payload: { ...fullState, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] clockStart failed:', err);
    }
};

export const broadcastClockStop = async (
    gameCode: string,
    fullState: BroadcastClockState
): Promise<void> => {
    try {
        const channel = await waitForChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'clock_stop',
            payload: { ...fullState, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] clockStop failed:', err);
    }
};

export const broadcastShotClockReset = async (
    gameCode: string,
    value: number,
    gameRunning: boolean
): Promise<void> => {
    try {
        const channel = await waitForChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'shotclock_reset',
            payload: { shotClock: value, shotClockRunning: gameRunning, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] shotClockReset failed:', err);
    }
};

export const broadcastPeriodChange = async (
    gameCode: string,
    period: number,
    fullState: BroadcastClockState
): Promise<void> => {
    try {
        const channel = await waitForChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'period_change',
            payload: { period, ...fullState, ts: Date.now() },
        });
    } catch (err) {
        console.error('[Broadcast] periodChange failed:', err);
    }
};

export const broadcastClockEdit = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    tenths: number,
    shotClock: number
): Promise<void> => {
    try {
        const channel = await waitForChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'clock_edit',
            payload: {
                minutes, seconds, tenths, shotClock,
                startedAt: null, shotClockStartedAt: null,
                ts: Date.now(),
            },
        });
    } catch (err) {
        console.error('[Broadcast] clockEdit failed:', err);
    }
};

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
    try {
        const channel = await waitForChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'score_update',
            payload: {
                teamA: scoreA, teamB: scoreB,
                foulsA, foulsB, timeoutsA, timeoutsB,
                possession, ts: Date.now(),
            },
        });
    } catch (err) {
        console.error('[Broadcast] scoreUpdate failed:', err);
    }
};

export const broadcastGameSnapshot = async (
    gameCode: string,
    clock: BroadcastClockState,
    score: BroadcastScoreState
): Promise<void> => {
    try {
        const channel = await waitForChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'game_snapshot',
            payload: { clock, score, timestamp: Date.now() },
        });
    } catch (err) { /* silent — best effort */ }
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
 * 
 * KEY: .on() handlers are registered BEFORE .subscribe().
 * The ready promise is set so send functions can use the same channel.
 */
export const subscribeToGameBroadcast = (
    gameCode: string,
    callbacks: GameBroadcastCallbacks
): (() => void) => {
    const topic = `game:${gameCode}`;

    // Create or reuse channel
    let channel: RealtimeChannel;
    if (channelCache.has(topic)) {
        channel = channelCache.get(topic)!;
    } else {
        channel = supabase.channel(topic, {
            config: { broadcast: { self: true, ack: false } },
        });
        channelCache.set(topic, channel);
    }

    // Register ALL event handlers BEFORE subscribing
    if (callbacks.onClockTick) {
        channel.on('broadcast', { event: 'clock_tick' }, ({ payload }) => callbacks.onClockTick!(payload));
    }
    if (callbacks.onClockStart) {
        channel.on('broadcast', { event: 'clock_start' }, ({ payload }) => callbacks.onClockStart!(payload));
    }
    if (callbacks.onClockStop) {
        channel.on('broadcast', { event: 'clock_stop' }, ({ payload }) => callbacks.onClockStop!(payload));
    }
    if (callbacks.onShotClockReset) {
        channel.on('broadcast', { event: 'shotclock_reset' }, ({ payload }) => callbacks.onShotClockReset!(payload));
    }
    if (callbacks.onPeriodChange) {
        channel.on('broadcast', { event: 'period_change' }, ({ payload }) => callbacks.onPeriodChange!(payload));
    }
    if (callbacks.onClockEdit) {
        channel.on('broadcast', { event: 'clock_edit' }, ({ payload }) => callbacks.onClockEdit!(payload));
    }
    if (callbacks.onScoreUpdate) {
        channel.on('broadcast', { event: 'score_update' }, ({ payload }) => callbacks.onScoreUpdate!(payload));
    }
    if (callbacks.onGameSnapshot) {
        channel.on('broadcast', { event: 'game_snapshot' }, ({ payload }) => callbacks.onGameSnapshot!(payload));
    }

    // Set up the ready resolver BEFORE subscribing
    // This way, if waitForChannel() is called later (by send functions in the same tab),
    // it gets the same promise that resolves when THIS subscribe completes.
    let resolveReady: (ch: RealtimeChannel) => void;
    if (!channelReadyResolvers.has(topic)) {
        const promise = new Promise<RealtimeChannel>((resolve) => {
            resolveReady = resolve;
        });
        channelReadyResolvers.set(topic, { promise, resolve: resolveReady! });
    } else {
        resolveReady = channelReadyResolvers.get(topic)!.resolve;
    }

    // NOW subscribe — handlers are already registered
    console.log('[DEBUG] About to subscribe channel:', topic, 'handlers registered:', Object.keys(callbacks).join(', '));
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`[Broadcast] Subscribed to ${topic}`);
            resolveReady(channel);
        } else if (status === 'CHANNEL_ERROR') {
            console.error(`[Broadcast] Channel error: ${topic}`);
        }
    });

    return () => {
        removeGameChannel(gameCode);
    };
};