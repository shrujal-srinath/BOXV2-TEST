// src/hooks/useSupabaseBroadcast.ts
//
// THE BOX — Supabase Broadcast Timer Hook
//
// REPLACES: src/hooks/useRTDBTimer.ts
//
// Drop-in replacement: same return type (minutes, seconds, tenths, shotClock,
// period, gameRunning, shotClockRunning, startClock, stopClock, etc.)
//
// KEY DIFFERENCES FROM useRTDBTimer:
//   1. Host publishes via Supabase Broadcast (ephemeral) instead of RTDB (database write)
//   2. Spectators receive via WebSocket channel subscription instead of RTDB onValue
//   3. Host also sends periodic snapshots (every 5s) so late joiners get current state
//   4. No database involved in the real-time loop — pure pub/sub
//
// The host still runs its own setInterval for the clock. The interval
// calculates the next second and broadcasts it. Spectators just render
// whatever they receive. Same model as RTDB, but without the DB writes.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
    subscribeToGameBroadcast,
    broadcastClockTick,
    broadcastClockStart,
    broadcastClockStop,
    broadcastShotClockReset,
    broadcastPeriodChange,
    broadcastClockEdit,
    broadcastGameSnapshot,
    removeGameChannel,
    type BroadcastClockState,
    type BroadcastScoreState,
} from '../services/supabaseBroadcastService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseSupabaseBroadcastOptions {
    gameCode: string;
    isHost: boolean;
    periodDuration: number;    // minutes per period from game settings
    shotClockDuration: number; // seconds from game settings
}

// Return type intentionally matches RTDBTimerReturn for drop-in swap
export interface SupabaseBroadcastReturn {
    // Display values — use these directly in JSX
    minutes: number;
    seconds: number;
    tenths: number;
    shotClock: number;
    period: number;
    gameRunning: boolean;
    shotClockRunning: boolean;

    // Host controls — no-ops if !isHost
    startClock: () => void;
    stopClock: () => void;
    toggleClock: () => void;
    resetShotClock24: () => void;
    resetShotClock14: () => void;
    resetShotClock: (value: number) => void;
    nextPeriod: () => void;
    editClocks: (minutes: number, seconds: number, tenths: number, shotClock: number) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSupabaseBroadcast = ({
    gameCode,
    isHost,
    periodDuration,
    shotClockDuration,
}: UseSupabaseBroadcastOptions): SupabaseBroadcastReturn => {

    // Local display state
    const [clock, setClock] = useState<BroadcastClockState>({
        gameRunning: false,
        shotClockRunning: false,
        minutes: periodDuration,
        seconds: 0,
        tenths: 0,
        shotClock: shotClockDuration,
        period: 1,
        startedAt: null,
        shotClockStartedAt: null,
    });

    // Stable ref for interval closure
    const clockRef = useRef<BroadcastClockState>(clock);
    useEffect(() => {
        clockRef.current = clock;
    }, [clock]);

    const intervalRef = useRef<number | null>(null);
    const snapshotIntervalRef = useRef<number | null>(null);

    // ── Step 1: Subscribe to Broadcast (both host and spectators) ─────────────

    useEffect(() => {
        if (!gameCode) return;

        const unsub = subscribeToGameBroadcast(gameCode, {
            onClockTick: (payload) => {
                setClock(prev => ({
                    ...prev,
                    minutes: payload.minutes,
                    seconds: payload.seconds,
                    tenths: payload.tenths,
                    shotClock: payload.shotClock,
                }));
            },

            onClockStart: (payload) => {
                setClock({
                    gameRunning: payload.gameRunning,
                    shotClockRunning: payload.shotClockRunning,
                    minutes: payload.minutes,
                    seconds: payload.seconds,
                    tenths: payload.tenths,
                    shotClock: payload.shotClock,
                    period: payload.period,
                    startedAt: payload.startedAt,
                    shotClockStartedAt: payload.shotClockStartedAt,
                });
            },

            onClockStop: (payload) => {
                setClock({
                    gameRunning: payload.gameRunning,
                    shotClockRunning: payload.shotClockRunning,
                    minutes: payload.minutes,
                    seconds: payload.seconds,
                    tenths: payload.tenths,
                    shotClock: payload.shotClock,
                    period: payload.period,
                    startedAt: payload.startedAt,
                    shotClockStartedAt: payload.shotClockStartedAt,
                });
            },

            onShotClockReset: (payload) => {
                setClock(prev => ({
                    ...prev,
                    shotClock: payload.shotClock,
                    shotClockRunning: payload.shotClockRunning,
                }));
            },

            onPeriodChange: (payload) => {
                setClock({
                    gameRunning: false,
                    shotClockRunning: false,
                    minutes: periodDuration,
                    seconds: 0,
                    tenths: 0,
                    shotClock: shotClockDuration,
                    period: payload.period,
                    startedAt: null,
                    shotClockStartedAt: null,
                });
            },

            onClockEdit: (payload) => {
                setClock(prev => ({
                    ...prev,
                    minutes: payload.minutes,
                    seconds: payload.seconds,
                    tenths: payload.tenths,
                    shotClock: payload.shotClock,
                    startedAt: null,
                    shotClockStartedAt: null,
                }));
            },

            // Full snapshot — used by late joiners and as periodic heartbeat
            onGameSnapshot: (payload) => {
                setClock(payload.clock);
            },
        });

        return () => {
            unsub();
        };
    }, [gameCode, periodDuration, shotClockDuration]);

    // ── Step 2: Host only — run the interval that broadcasts ticks ────────────

    useEffect(() => {
        if (!isHost || !gameCode) return;

        const clearTickInterval = () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        // Watch for gameRunning changes to start/stop the interval
        if (clock.gameRunning) {
            clearTickInterval(); // Clear any existing

            intervalRef.current = window.setInterval(() => {
                const c = clockRef.current;
                if (!c.gameRunning) return;

                let newMinutes = c.minutes;
                let newSeconds = c.seconds;
                let newTenths = c.tenths;
                let newShotClock = c.shotClock;

                // Decrement game clock (counts down)
                if (newTenths > 0) {
                    newTenths -= 1;
                } else if (newSeconds > 0) {
                    newSeconds -= 1;
                    newTenths = 9;
                } else if (newMinutes > 0) {
                    newMinutes -= 1;
                    newSeconds = 59;
                    newTenths = 9;
                }
                // else: clock at 0:00.0 — period over

                // Decrement shot clock
                if (c.shotClockRunning && newShotClock > 0) {
                    newShotClock -= 1;
                }

                // Update local state
                setClock(prev => ({
                    ...prev,
                    minutes: newMinutes,
                    seconds: newSeconds,
                    tenths: newTenths,
                    shotClock: newShotClock,
                }));

                // Broadcast to spectators (fire-and-forget, no await in interval)
                broadcastClockTick(gameCode, newMinutes, newSeconds, newTenths, newShotClock);

            }, 100); // 100ms for tenths precision (same as RTDB version)
        } else {
            clearTickInterval();
        }

        return clearTickInterval;
    }, [isHost, gameCode, clock.gameRunning]);

    // ── Step 3: Host only — periodic snapshot for late joiners ─────────────────

    useEffect(() => {
        if (!isHost || !gameCode) return;

        // Send snapshot every 5 seconds so late joiners get current state
        snapshotIntervalRef.current = window.setInterval(() => {
            const c = clockRef.current;
            broadcastGameSnapshot(gameCode, c, {
                // Score is managed separately by useBasketballGame,
                // but we include a placeholder. The real score comes from
                // the score_update events. This just ensures clock is synced.
                teamA: 0, teamB: 0,
                foulsA: 0, foulsB: 0,
                timeoutsA: 0, timeoutsB: 0,
                possession: 'A',
            });
        }, 5000);

        return () => {
            if (snapshotIntervalRef.current !== null) {
                clearInterval(snapshotIntervalRef.current);
                snapshotIntervalRef.current = null;
            }
        };
    }, [isHost, gameCode]);

    // ── Step 4: Cleanup on unmount ────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (gameCode) {
                removeGameChannel(gameCode);
            }
        };
    }, [gameCode]);

    // ── Host Controls ─────────────────────────────────────────────────────────

    const startClock = useCallback(() => {
        if (!isHost) return;

        const newState: BroadcastClockState = {
            ...clockRef.current,
            gameRunning: true,
            shotClockRunning: true,
            startedAt: Date.now(),
            shotClockStartedAt: Date.now(),
        };

        setClock(newState);
        broadcastClockStart(gameCode, newState);
    }, [isHost, gameCode]);

    const stopClock = useCallback(() => {
        if (!isHost) return;

        const newState: BroadcastClockState = {
            ...clockRef.current,
            gameRunning: false,
            shotClockRunning: false,
            startedAt: null,
            shotClockStartedAt: null,
        };

        setClock(newState);
        broadcastClockStop(gameCode, newState);
    }, [isHost, gameCode]);

    const toggleClock = useCallback(() => {
        if (clockRef.current.gameRunning) {
            stopClock();
        } else {
            startClock();
        }
    }, [startClock, stopClock]);

    const resetShotClock = useCallback((value: number) => {
        if (!isHost) return;

        setClock(prev => ({
            ...prev,
            shotClock: value,
            shotClockRunning: prev.gameRunning,
            shotClockStartedAt: prev.gameRunning ? Date.now() : null,
        }));

        broadcastShotClockReset(gameCode, value, clockRef.current.gameRunning);
    }, [isHost, gameCode]);

    const resetShotClock24 = useCallback(() => resetShotClock(shotClockDuration), [resetShotClock, shotClockDuration]);
    const resetShotClock14 = useCallback(() => resetShotClock(14), [resetShotClock]);

    const nextPeriod = useCallback(() => {
        if (!isHost) return;

        const newPeriod = clockRef.current.period + 1;
        const newState: BroadcastClockState = {
            gameRunning: false,
            shotClockRunning: false,
            minutes: periodDuration,
            seconds: 0,
            tenths: 0,
            shotClock: shotClockDuration,
            period: newPeriod,
            startedAt: null,
            shotClockStartedAt: null,
        };

        setClock(newState);
        broadcastPeriodChange(gameCode, newPeriod, newState);
    }, [isHost, gameCode, periodDuration, shotClockDuration]);

    const editClocks = useCallback((minutes: number, seconds: number, tenths: number, shotClock: number) => {
        if (!isHost) return;

        setClock(prev => ({
            ...prev,
            minutes, seconds, tenths, shotClock,
            startedAt: null,
            shotClockStartedAt: null,
        }));

        broadcastClockEdit(gameCode, minutes, seconds, tenths, shotClock);
    }, [isHost, gameCode]);

    // ── Return (identical shape to RTDBTimerReturn) ───────────────────────────

    return {
        minutes: clock.minutes,
        seconds: clock.seconds,
        tenths: clock.tenths,
        shotClock: clock.shotClock,
        period: clock.period,
        gameRunning: clock.gameRunning,
        shotClockRunning: clock.shotClockRunning,

        startClock,
        stopClock,
        toggleClock,
        resetShotClock24,
        resetShotClock14,
        resetShotClock,
        nextPeriod,
        editClocks,
    };
};