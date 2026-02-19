// src/services/supabaseBroadcastService.ts
//
// THE BOX — Supabase Realtime Broadcast for Live Game Data
//
// REPLACES: src/services/rtdbClockService.ts
//
// FIX: Channel must be SUBSCRIBED before send() works via WebSocket.
// Without this, send() falls back to REST API (slow, one-way, no fanout).

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

const channelCache = new Map<string, RealtimeChannel>();
const channelReady = new Map<string, Promise<RealtimeChannel>>();

/**
 * Get or create a channel, and ensure it is SUBSCRIBED before returning.
 * This is the critical fix — send() only works via WebSocket after subscribe.
 */
const getSubscribedChannel = (gameCode: string): Promise<RealtimeChannel> => {
    const topic = `game:${gameCode}`;

    // If we already have a ready promise, return it
    if (channelReady.has(topic)) {
        return channelReady.get(topic)!;
    }

    const promise = new Promise<RealtimeChannel>((resolve, reject) => {
        let channel: RealtimeChannel;

        if (channelCache.has(topic)) {
            channel = channelCache.get(topic)!;
            // Check if already subscribed
            if ((channel as any).state === 'joined') {
                resolve(channel);
                return;
            }
        } else {
            channel = supabase.channel(topic, {
                config: {
                    broadcast: {
                        self: true,
                        ack: false,
                    },
                },
            });
            channelCache.set(topic, channel);
        }

        // Subscribe and wait for confirmation
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[Broadcast] Channel subscribed: ${topic}`);
                resolve(channel);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(`[Broadcast] Channel error: ${topic} — ${status}`);
                reject(new Error(`Channel ${status}`));
            }
        });
    });

    channelReady.set(topic, promise);
    return promise;
};

/**
 * Get or create a channel WITHOUT waiting for subscription.
 * Used by subscribeToGameBroadcast to register .on() handlers BEFORE subscribing.
 */
const getOrCreateChannel = (gameCode: string): RealtimeChannel => {
    const topic = `game:${gameCode}`;

    if (channelCache.has(topic)) {
        return channelCache.get(topic)!;
    }

    const channel = supabase.channel(topic, {
        config: {
            broadcast: {
                self: true,
                ack: false,
            },
        },
    });

    channelCache.set(topic, channel);
    return channel;
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
        channelReady.delete(topic);
    }
};

// ─── Host-Side: Broadcasting (Write) ──────────────────────────────────────────
// All send functions now await getSubscribedChannel() to ensure WebSocket is ready.

export const broadcastClockTick = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    tenths: number,
    shotClock: number
): Promise<void> => {
    try {
        const channel = await getSubscribedChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'clock_tick',
            payload: { minutes, seconds, tenths, shotClock, ts: Date.now() },
        });
    } catch (err) {
        // Don't spam console for clock ticks
    }
};

export const broadcastClockStart = async (
    gameCode: string,
    fullState: BroadcastClockState
): Promise<void> => {
    try {
        const channel = await getSubscribedChannel(gameCode);
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
        const channel = await getSubscribedChannel(gameCode);
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
        const channel = await getSubscribedChannel(gameCode);
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
        const channel = await getSubscribedChannel(gameCode);
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
        const channel = await getSubscribedChannel(gameCode);
        channel.send({
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
        const channel = await getSubscribedChannel(gameCode);
        channel.send({
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

export const broadcastGameSnapshot = async (
    gameCode: string,
    clock: BroadcastClockState,
    score: BroadcastScoreState
): Promise<void> => {
    try {
        const channel = await getSubscribedChannel(gameCode);
        channel.send({
            type: 'broadcast',
            event: 'game_snapshot',
            payload: { clock, score, timestamp: Date.now() },
        });
    } catch (err) {
        // Silent — snapshot is best-effort
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
 * 
 * IMPORTANT: Register .on() handlers BEFORE calling .subscribe().
 * Then mark the channel as ready so send functions use WebSocket.
 */
export const subscribeToGameBroadcast = (
    gameCode: string,
    callbacks: GameBroadcastCallbacks
): (() => void) => {
    const topic = `game:${gameCode}`;
    const channel = getOrCreateChannel(gameCode);

    // Register event listeners BEFORE subscribing
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

    // Subscribe and mark channel as ready for send()
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`[Broadcast] Subscribed to ${topic}`);
            // Mark as ready so getSubscribedChannel() resolves immediately
            if (!channelReady.has(topic)) {
                channelReady.set(topic, Promise.resolve(channel));
            }
        } else if (status === 'CHANNEL_ERROR') {
            console.error(`[Broadcast] Channel error for ${topic}`);
        }
    });

    return () => {
        removeGameChannel(gameCode);
    };
};