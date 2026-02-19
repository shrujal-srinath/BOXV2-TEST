// src/hooks/useSupabaseBroadcast.ts
//
// THE BOX — Supabase Broadcast Timer Hook
//
// REPLACES: src/hooks/useRTDBTimer.ts
//
// Drop-in replacement with identical return type.
// Timer logic ported exactly from useRTDBTimer to avoid drift/speed bugs.

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSupabaseBroadcast = ({
    gameCode,
    isHost,
    periodDuration,
    shotClockDuration,
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
    const subscribedRef = useRef(false);

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

            onGameSnapshot: (payload) => {
                setClock(payload.clock);
            },
        });

        subscribedRef.current = true;

        return () => {
            subscribedRef.current = false;
            unsub();
        };
    }, [gameCode, periodDuration, shotClockDuration]);

    // ── Step 2: Host only — run the 100ms interval (matches useRTDBTimer exactly) ──

    useEffect(() => {
        if (!isHost) return;

        // Clear any existing interval
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

            // ── EXACT LOGIC FROM useRTDBTimer ──
            // Calculate total tenths: (Minutes * 600) + (Seconds * 10) + Tenths
            let totalTenths = (c.minutes * 600) + (c.seconds * 10) + c.tenths;

            if (totalTenths <= 0) {
                // Period ended
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

            // Decrement by 1 tenth
            totalTenths -= 1;

            // Convert back to minutes, seconds, tenths
            const newMin = Math.floor(totalTenths / 600);
            const remainder = totalTenths % 600;
            const newSec = Math.floor(remainder / 10);
            const newTenths = remainder % 10;

            // Shot clock: decrement once per SECOND, not per tick
            // Detect second boundary: when tenths wraps from 0 to 9
            const secondBoundary = (newTenths === 9 && c.tenths === 0);
            const newShot = (c.shotClockRunning && secondBoundary)
                ? Math.max(0, c.shotClock - 1)
                : c.shotClock;

            // Update local state
            setClock(prev => ({
                ...prev,
                minutes: newMin,
                seconds: newSec,
                tenths: newTenths,
                shotClock: newShot,
            }));

            // Broadcast to spectators
            broadcastClockTick(gameCode, newMin, newSec, newTenths, newShot);

        }, 100); // 100ms for tenth-of-a-second precision

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isHost, gameCode, clock.gameRunning]);

    // ── Step 3: Host only — periodic snapshot for late joiners ─────────────────

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

    // ── Cleanup on unmount ────────────────────────────────────────────────────

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

    // ── Return ────────────────────────────────────────────────────────────────

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