// src/services/supabaseBroadcastService.ts

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

// ─── Ref-Counted Channel Manager ──────────────────────────────────────────────

interface SharedChannel {
    channel: RealtimeChannel;
    promise: Promise<RealtimeChannel>;
    refCount: number;
}

const activeChannels = new Map<string, SharedChannel>();

const getSharedChannel = (gameCode: string): SharedChannel => {
    const topic = `game:${gameCode}`;

    // If channel exists, increment refCount (handles React Strict Mode)
    if (activeChannels.has(topic)) {
        const state = activeChannels.get(topic)!;
        state.refCount++;
        return state;
    }

    // Otherwise, create new channel
    const channel = supabase.channel(topic, {
        config: { broadcast: { self: true, ack: false } }
    });

    const promise = new Promise<RealtimeChannel>((resolve, reject) => {
        channel.subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[Broadcast] Channel Ready: ${topic}`);
                resolve(channel);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(`[Broadcast] Channel Failed: ${topic} - ${status}`);
                reject(err || new Error(status));
            }
        });
    });

    const state = { channel, promise, refCount: 1 };
    activeChannels.set(topic, state);
    return state;
};

const releaseSharedChannel = (gameCode: string) => {
    const topic = `game:${gameCode}`;
    const state = activeChannels.get(topic);

    if (state) {
        state.refCount--;
        // Only destroy the channel when zero components are using it
        if (state.refCount <= 0) {
            console.log(`[Broadcast] Closing Channel: ${topic}`);
            supabase.removeChannel(state.channel);
            activeChannels.delete(topic);
        }
    }
};

// Kept as a no-op fallback in case any other files still try to call it directly
export const removeGameChannel = async (gameCode: string): Promise<void> => { };

// ─── Host-Side: Broadcasting (Write) ──────────────────────────────────────────

export const broadcastClockTick = async (gameCode: string, minutes: number, seconds: number, tenths: number, shotClock: number): Promise<void> => {
    const state = activeChannels.get(`game:${gameCode}`);
    if (!state) return;
    try {
        const channel = await state.promise;
        channel.send({ type: 'broadcast', event: 'clock_tick', payload: { minutes, seconds, tenths, shotClock, ts: Date.now() } });
    } catch (err) { /* silent for ticks */ }
};

export const broadcastClockStart = async (gameCode: string, fullState: BroadcastClockState): Promise<void> => {
    const state = activeChannels.get(`game:${gameCode}`);
    if (!state) return;
    try {
        const channel = await state.promise;
        channel.send({ type: 'broadcast', event: 'clock_start', payload: { ...fullState, ts: Date.now() } });
    } catch (err) { console.error('[Broadcast] start failed:', err); }
};

export const broadcastClockStop = async (gameCode: string, fullState: BroadcastClockState): Promise<void> => {
    const state = activeChannels.get(`game:${gameCode}`);
    if (!state) return;
    try {
        const channel = await state.promise;
        channel.send({ type: 'broadcast', event: 'clock_stop', payload: { ...fullState, ts: Date.now() } });
    } catch (err) { console.error('[Broadcast] stop failed:', err); }
};

export const broadcastShotClockReset = async (gameCode: string, value: number, gameRunning: boolean): Promise<void> => {
    const state = activeChannels.get(`game:${gameCode}`);
    if (!state) return;
    try {
        const channel = await state.promise;
        channel.send({ type: 'broadcast', event: 'shotclock_reset', payload: { shotClock: value, shotClockRunning: gameRunning, ts: Date.now() } });
    } catch (err) { console.error('[Broadcast] shotReset failed:', err); }
};

export const broadcastPeriodChange = async (gameCode: string, period: number, fullState: BroadcastClockState): Promise<void> => {
    const state = activeChannels.get(`game:${gameCode}`);
    if (!state) return;
    try {
        const channel = await state.promise;
        channel.send({ type: 'broadcast', event: 'period_change', payload: { period, ...fullState, ts: Date.now() } });
    } catch (err) { console.error('[Broadcast] periodChange failed:', err); }
};

export const broadcastClockEdit = async (gameCode: string, minutes: number, seconds: number, tenths: number, shotClock: number): Promise<void> => {
    const state = activeChannels.get(`game:${gameCode}`);
    if (!state) return;
    try {
        const channel = await state.promise;
        channel.send({ type: 'broadcast', event: 'clock_edit', payload: { minutes, seconds, tenths, shotClock, startedAt: null, shotClockStartedAt: null, ts: Date.now() } });
    } catch (err) { console.error('[Broadcast] clockEdit failed:', err); }
};

export const broadcastScoreUpdate = async (gameCode: string, scoreA: number, scoreB: number, foulsA: number, foulsB: number, timeoutsA: number, timeoutsB: number, possession: 'A' | 'B'): Promise<void> => {
    const state = activeChannels.get(`game:${gameCode}`);
    if (!state) return;
    try {
        const channel = await state.promise;
        channel.send({
            type: 'broadcast', event: 'score_update',
            payload: { teamA: scoreA, teamB: scoreB, foulsA, foulsB, timeoutsA, timeoutsB, possession, ts: Date.now() },
        });
    } catch (err) { console.error('[Broadcast] scoreUpdate failed:', err); }
};

export const broadcastGameSnapshot = async (gameCode: string, clock: BroadcastClockState, score: BroadcastScoreState): Promise<void> => {
    const state = activeChannels.get(`game:${gameCode}`);
    if (!state) return;
    try {
        const channel = await state.promise;
        channel.send({ type: 'broadcast', event: 'game_snapshot', payload: { clock, score, timestamp: Date.now() } });
    } catch (err) { /* best effort */ }
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

export const subscribeToGameBroadcast = (gameCode: string, callbacks: GameBroadcastCallbacks): (() => void) => {
    const { channel } = getSharedChannel(gameCode);

    if (callbacks.onClockTick) channel.on('broadcast', { event: 'clock_tick' }, ({ payload }) => callbacks.onClockTick!(payload));
    if (callbacks.onClockStart) channel.on('broadcast', { event: 'clock_start' }, ({ payload }) => callbacks.onClockStart!(payload));
    if (callbacks.onClockStop) channel.on('broadcast', { event: 'clock_stop' }, ({ payload }) => callbacks.onClockStop!(payload));
    if (callbacks.onShotClockReset) channel.on('broadcast', { event: 'shotclock_reset' }, ({ payload }) => callbacks.onShotClockReset!(payload));
    if (callbacks.onPeriodChange) channel.on('broadcast', { event: 'period_change' }, ({ payload }) => callbacks.onPeriodChange!(payload));
    if (callbacks.onClockEdit) channel.on('broadcast', { event: 'clock_edit' }, ({ payload }) => callbacks.onClockEdit!(payload));
    if (callbacks.onScoreUpdate) channel.on('broadcast', { event: 'score_update' }, ({ payload }) => callbacks.onScoreUpdate!(payload));
    if (callbacks.onGameSnapshot) channel.on('broadcast', { event: 'game_snapshot' }, ({ payload }) => callbacks.onGameSnapshot!(payload));

    return () => {
        releaseSharedChannel(gameCode);
    };
};