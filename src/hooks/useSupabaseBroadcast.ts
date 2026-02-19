// src/hooks/useSupabaseBroadcast.ts
//
// THE BOX — Supabase Broadcast Timer Hook
//
// REPLACES: src/hooks/useRTDBTimer.ts
//
// Now also handles score updates via an optional onScoreUpdate callback,
// eliminating the need for a separate subscribeToGameBroadcast call
// in SpectatorView/WallView (which caused channel conflicts).

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
    periodDuration: number;
    shotClockDuration: number;
    onScoreUpdate?: (score: BroadcastScoreState) => void;
}

export interface SupabaseBroadcastReturn {
    minutes: number;
    seconds: number;
    tenths: number;
    shotClock: number;
    period: number;
    gameRunning: boolean;
    shotClockRunning: boolean;

    startClock: () => void;
    stopClock: () => void;
    toggleClock: () => void;
    resetShotClock24: () => void;
    resetShotClock14: () => void;
    resetShotClock: (value: number) => void;
    nextPeriod: () => void;
    editClocks: (minutes: number, seconds: number, tenths: number, shotClock: number) => void;
}

// Re-export for consumers
export type { BroadcastScoreState } from '../services/supabaseBroadcastService';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSupabaseBroadcast = ({
    gameCode,
    isHost,
    periodDuration,
    shotClockDuration,
    onScoreUpdate,
}: UseSupabaseBroadcastOptions): SupabaseBroadcastReturn => {

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

    const clockRef = useRef<BroadcastClockState>(clock);
    useEffect(() => {
        clockRef.current = clock;
    }, [clock]);

    const intervalRef = useRef<number | null>(null);
    const snapshotIntervalRef = useRef<number | null>(null);

    // Stable ref for onScoreUpdate so we don't re-subscribe on every render
    const onScoreUpdateRef = useRef(onScoreUpdate);
    useEffect(() => {
        onScoreUpdateRef.current = onScoreUpdate;
    }, [onScoreUpdate]);

    // ── Step 1: SINGLE subscription for ALL broadcast events ──────────────────
    // This is the key fix: one channel, one subscription, all events handled.

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

            onGameSnapshot: (payload) => {
                setClock(payload.clock);
                // Also forward score from snapshot if callback provided
                if (onScoreUpdateRef.current && payload.score) {
                    onScoreUpdateRef.current(payload.score);
                }
            },

            // Forward score updates to the consumer component
            onScoreUpdate: (payload) => {
                if (onScoreUpdateRef.current) {
                    onScoreUpdateRef.current({
                        teamA: payload.teamA,
                        teamB: payload.teamB,
                        foulsA: payload.foulsA,
                        foulsB: payload.foulsB,
                        timeoutsA: payload.timeoutsA,
                        timeoutsB: payload.timeoutsB,
                        possession: payload.possession,
                    });
                }
            },
        });

        return unsub;
    }, [gameCode, periodDuration, shotClockDuration]);

    // ── Step 2: Host only — 100ms interval (exact logic from useRTDBTimer) ────

    useEffect(() => {
        if (!isHost) return;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!clock.gameRunning) return;

        intervalRef.current = window.setInterval(() => {
            const c = clockRef.current;

            if (!c.gameRunning) {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                return;
            }

            let totalTenths = (c.minutes * 600) + (c.seconds * 10) + c.tenths;

            if (totalTenths <= 0) {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                broadcastClockStop(gameCode, {
                    ...c,
                    gameRunning: false,
                    shotClockRunning: false,
                    minutes: 0,
                    seconds: 0,
                    tenths: 0,
                    startedAt: null,
                    shotClockStartedAt: null,
                });
                window.dispatchEvent(new CustomEvent('periodEnd', { detail: { period: c.period } }));
                return;
            }

            totalTenths -= 1;

            const newMin = Math.floor(totalTenths / 600);
            const remainder = totalTenths % 600;
            const newSec = Math.floor(remainder / 10);
            const newTenths = remainder % 10;

            // Shot clock: decrement once per SECOND (on second boundary)
            const secondBoundary = (newTenths === 9 && c.tenths === 0);
            const newShot = (c.shotClockRunning && secondBoundary)
                ? Math.max(0, c.shotClock - 1)
                : c.shotClock;

            setClock(prev => ({
                ...prev,
                minutes: newMin,
                seconds: newSec,
                tenths: newTenths,
                shotClock: newShot,
            }));

            broadcastClockTick(gameCode, newMin, newSec, newTenths, newShot);

        }, 100);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isHost, gameCode, clock.gameRunning]);

    // ── Step 3: Host only — periodic snapshot ─────────────────────────────────

    useEffect(() => {
        if (!isHost || !gameCode) return;

        snapshotIntervalRef.current = window.setInterval(() => {
            const c = clockRef.current;
            broadcastGameSnapshot(gameCode, c, {
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

    // ── Cleanup ───────────────────────────────────────────────────────────────

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
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
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
        if (clockRef.current.gameRunning) stopClock();
        else startClock();
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
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
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