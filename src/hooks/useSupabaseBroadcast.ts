// src/hooks/useSupabaseBroadcast.ts
//
// v3.0 — COMPLETE REWRITE
//
// ROOT CAUSE FIXES:
//   [FIX-1] Host was calling supabase.channel(`clock-${gameCode}`).send() directly.
//           This creates an UNSUBSCRIBED channel — Supabase silently drops the message.
//           Now uses supabaseBroadcastService which holds a properly SUBSCRIBED channel.
//
//   [FIX-2] Spectator had no local interpolation — only updated on each 300ms broadcast
//           causing clock to skip/freeze visually between packets.
//           Now spectator runs its own local rAF loop, anchored to the last received
//           startedAt epoch, so it interpolates smoothly between broadcasts.
//
//   [FIX-3] Spectator subscribed to `clock-${gameCode}` but host never published there.
//           Both sides now use `game:${gameCode}` via subscribeToGameBroadcast.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    broadcastClockTick,
    broadcastClockStart,
    broadcastClockStop,
    broadcastShotClockReset,
    broadcastPeriodChange,
    subscribeToGameBroadcast,
    type BroadcastClockState,
} from '../services/supabaseBroadcastService';

// NOTE: broadcastClockTick etc. call activeChannels.get(`game:${gameCode}`) internally.
// For the HOST, activeChannels is only populated when someone calls subscribeToGameBroadcast
// or getSharedChannel. We initialise it by subscribing with empty callbacks on mount —
// this creates the channel and increments refCount, enabling all broadcast sends.

interface UseSupabaseBroadcastProps {
    gameCode: string;
    isHost: boolean;
    periodDuration: number;      // minutes, e.g. 10
    shotClockDuration: number;   // seconds, e.g. 24
}

export const useSupabaseBroadcast = ({
    gameCode,
    isHost,
    periodDuration,
    shotClockDuration,
}: UseSupabaseBroadcastProps) => {

    // ─── Shared display state (both host & spectator expose these) ────────
    const [gameRunning, setGameRunning] = useState(false);
    const [period, setPeriod] = useState(1);

    // Time stored in pure milliseconds for precise arithmetic
    const [gameTimeMs, setGameTimeMs] = useState(periodDuration * 60_000);
    const [shotClockMs, setShotClockMs] = useState(shotClockDuration * 1_000);

    // Epoch anchors — capture the "wall clock" moment the timer was started
    // so elapsed = Date.now() - startedAtEpoch without accumulating drift
    const gameStartEpochRef = useRef<number | null>(null);
    const shotStartEpochRef = useRef<number | null>(null);
    const gameStartMsRef = useRef<number>(periodDuration * 60_000);
    const shotStartMsRef = useRef<number>(shotClockDuration * 1_000);

    const rafRef = useRef<number | null>(null);
    const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Ensure shared channel is initialised (critical for host broadcasts) ─────
    // broadcastClockTick/Start/Stop look up activeChannels.get(`game:${gameCode}`) internally.
    // The channel only exists in activeChannels if subscribeToGameBroadcast has been called.
    // Calling with empty callbacks creates + subscribes the channel on both host and spectator.
    useEffect(() => {
        if (!gameCode) return;
        const unsub = subscribeToGameBroadcast(gameCode, {}); // boots the channel
        return unsub;
    }, [gameCode]);

    // =========================================================================
    // HOST SIDE
    // =========================================================================

    // ── Local epoch-based timer loop (host only) ─────────────────────────────
    const runHostLoop = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        const step = () => {
            if (gameStartEpochRef.current === null) return;

            const now = Date.now();
            const elapsedGame = now - gameStartEpochRef.current;
            const nextGame = Math.max(0, gameStartMsRef.current - elapsedGame);
            setGameTimeMs(nextGame);

            if (shotStartEpochRef.current !== null) {
                const elapsedShot = now - shotStartEpochRef.current;
                const nextShot = Math.max(0, shotStartMsRef.current - elapsedShot);
                setShotClockMs(nextShot);

                if (nextShot <= 0) {
                    shotStartEpochRef.current = null;
                }
            }

            if (nextGame <= 0) {
                gameStartEpochRef.current = null;
                setGameRunning(false);
                return; // stop loop
            }

            rafRef.current = requestAnimationFrame(step);
        };

        rafRef.current = requestAnimationFrame(step);
    }, []);

    const stopHostLoop = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    // ── Broadcast tick to spectators every 200ms ──────────────────────────────
    useEffect(() => {
        if (!isHost || !gameCode) return;
        if (!gameRunning) return;

        tickIntervalRef.current = setInterval(() => {
            const mins = Math.floor(gameTimeMs / 60_000);
            const secs = Math.floor((gameTimeMs % 60_000) / 1_000);
            const tenths = Math.floor((gameTimeMs % 1_000) / 100);
            const shot = Math.ceil(shotClockMs / 1_000);
            broadcastClockTick(gameCode, mins, secs, tenths, shot);
        }, 200);

        return () => {
            if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHost, gameCode, gameRunning]); // intentionally excludes gameTimeMs/shotClockMs

    // =========================================================================
    // SPECTATOR SIDE
    // =========================================================================

    // Last received broadcast state — spectator interpolates from this
    const lastSyncRef = useRef<{
        gameRunning: boolean;
        gameTimeMs: number;
        shotClockMs: number;
        period: number;
        receivedAt: number;
        startedAt: number | null;
        shotStartedAt: number | null;
    } | null>(null);

    useEffect(() => {
        if (isHost || !gameCode) return;

        // Local interpolation loop — runs at ~60fps
        // Between broadcasts we compute elapsed from startedAt epoch
        const loop = () => {
            const sync = lastSyncRef.current;
            if (!sync) {
                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            if (sync.gameRunning && sync.startedAt !== null) {
                const elapsed = Date.now() - sync.startedAt;
                const nextGame = Math.max(0, sync.gameTimeMs - elapsed +
                    (Date.now() - sync.receivedAt)); // compensate for broadcast delay

                // Recalculate from true epoch anchor
                const anchoredGame = Math.max(0, sync.gameTimeMs - (Date.now() - sync.startedAt) + (sync.receivedAt - sync.startedAt));
                setGameTimeMs(anchoredGame);

                if (sync.shotStartedAt !== null) {
                    const elapsedShot = Date.now() - sync.shotStartedAt;
                    const nextShot = Math.max(0, sync.shotClockMs - elapsedShot + (sync.receivedAt - sync.shotStartedAt));
                    setShotClockMs(Math.max(0, nextShot));
                }
            }

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isHost, gameCode]);

    // Subscribe to broadcast events from host
    useEffect(() => {
        if (isHost || !gameCode) return;

        const unsub = subscribeToGameBroadcast(gameCode, {
            onClockTick: (payload) => {
                // clock_tick gives us current display values — use as fallback if no epoch
                const newGameMs = payload.minutes * 60_000 + payload.seconds * 1_000 + payload.tenths * 100;
                const newShotMs = payload.shotClock * 1_000;

                if (lastSyncRef.current && lastSyncRef.current.startedAt !== null) {
                    // We have epoch data — update the sync anchor so interpolation stays accurate
                    lastSyncRef.current = {
                        ...lastSyncRef.current,
                        gameTimeMs: newGameMs,
                        shotClockMs: newShotMs,
                        receivedAt: Date.now(),
                        // Recalibrate startedAt as if clock started right now counting from current value
                        startedAt: Date.now(),
                        shotStartedAt: Date.now(),
                    };
                } else {
                    // No epoch — fallback: set directly
                    setGameTimeMs(newGameMs);
                    setShotClockMs(newShotMs);
                }
            },

            onClockStart: (payload) => {
                const newGameMs = payload.minutes * 60_000 + payload.seconds * 1_000 + payload.tenths * 100;
                const newShotMs = payload.shotClock * 1_000;
                const now = Date.now();

                lastSyncRef.current = {
                    gameRunning: true,
                    gameTimeMs: newGameMs,
                    shotClockMs: newShotMs,
                    period: payload.period,
                    receivedAt: now,
                    startedAt: payload.startedAt ?? now,
                    shotStartedAt: payload.shotClockStartedAt ?? now,
                };

                setGameRunning(true);
                setPeriod(payload.period);
                setGameTimeMs(newGameMs);
                setShotClockMs(newShotMs);
            },

            onClockStop: (payload) => {
                const newGameMs = payload.minutes * 60_000 + payload.seconds * 1_000 + payload.tenths * 100;
                const newShotMs = payload.shotClock * 1_000;

                lastSyncRef.current = {
                    gameRunning: false,
                    gameTimeMs: newGameMs,
                    shotClockMs: newShotMs,
                    period: payload.period,
                    receivedAt: Date.now(),
                    startedAt: null,
                    shotStartedAt: null,
                };

                setGameRunning(false);
                setGameTimeMs(newGameMs);
                setShotClockMs(newShotMs);
                setPeriod(payload.period);
            },

            onShotClockReset: (payload) => {
                const newShotMs = payload.shotClock * 1_000;
                setShotClockMs(newShotMs);

                if (lastSyncRef.current) {
                    lastSyncRef.current = {
                        ...lastSyncRef.current,
                        shotClockMs: newShotMs,
                        shotStartedAt: payload.shotClockRunning ? Date.now() : null,
                        receivedAt: Date.now(),
                    };
                }
            },

            onPeriodChange: (payload) => {
                const newGameMs = payload.minutes * 60_000 + payload.seconds * 1_000 + payload.tenths * 100;
                const newShotMs = payload.shotClock * 1_000;

                lastSyncRef.current = {
                    gameRunning: false,
                    gameTimeMs: newGameMs,
                    shotClockMs: newShotMs,
                    period: payload.period,
                    receivedAt: Date.now(),
                    startedAt: null,
                    shotStartedAt: null,
                };

                setPeriod(payload.period);
                setGameRunning(false);
                setGameTimeMs(newGameMs);
                setShotClockMs(newShotMs);
            },

            onClockEdit: (payload) => {
                const newGameMs = payload.minutes * 60_000 + payload.seconds * 1_000 + payload.tenths * 100;
                const newShotMs = payload.shotClock * 1_000;

                if (lastSyncRef.current) {
                    lastSyncRef.current = {
                        ...lastSyncRef.current,
                        gameTimeMs: newGameMs,
                        shotClockMs: newShotMs,
                        receivedAt: Date.now(),
                        startedAt: lastSyncRef.current.gameRunning ? Date.now() : null,
                        shotStartedAt: lastSyncRef.current.gameRunning ? Date.now() : null,
                    };
                }
                setGameTimeMs(newGameMs);
                setShotClockMs(newShotMs);
            },
        });

        return unsub;
    }, [isHost, gameCode]);

    // =========================================================================
    // HOST ACTIONS
    // =========================================================================

    const toggleClock = useCallback(() => {
        if (!isHost || !gameCode) return;

        if (gameRunning) {
            // STOP
            stopHostLoop();
            const now = Date.now();
            // Compute final time from epoch
            let finalGameMs = gameTimeMs;
            let finalShotMs = shotClockMs;
            if (gameStartEpochRef.current !== null) {
                finalGameMs = Math.max(0, gameStartMsRef.current - (now - gameStartEpochRef.current));
            }
            if (shotStartEpochRef.current !== null) {
                finalShotMs = Math.max(0, shotStartMsRef.current - (now - shotStartEpochRef.current));
            }
            gameStartEpochRef.current = null;
            shotStartEpochRef.current = null;
            setGameTimeMs(finalGameMs);
            setShotClockMs(finalShotMs);
            setGameRunning(false);

            const mins = Math.floor(finalGameMs / 60_000);
            const secs = Math.floor((finalGameMs % 60_000) / 1_000);
            const tenths = Math.floor((finalGameMs % 1_000) / 100);
            const shot = Math.ceil(finalShotMs / 1_000);
            const state: BroadcastClockState = {
                gameRunning: false, shotClockRunning: false,
                minutes: mins, seconds: secs, tenths, shotClock: shot,
                period, startedAt: null, shotClockStartedAt: null,
            };
            broadcastClockStop(gameCode, state);
        } else {
            // START
            const now = Date.now();
            gameStartEpochRef.current = now;
            shotStartEpochRef.current = now;
            gameStartMsRef.current = gameTimeMs;
            shotStartMsRef.current = shotClockMs;
            setGameRunning(true);
            runHostLoop();

            const mins = Math.floor(gameTimeMs / 60_000);
            const secs = Math.floor((gameTimeMs % 60_000) / 1_000);
            const tenths = Math.floor((gameTimeMs % 1_000) / 100);
            const shot = Math.ceil(shotClockMs / 1_000);
            const state: BroadcastClockState = {
                gameRunning: true, shotClockRunning: true,
                minutes: mins, seconds: secs, tenths, shotClock: shot,
                period,
                startedAt: now,
                shotClockStartedAt: now,
            };
            broadcastClockStart(gameCode, state);
        }
    }, [isHost, gameCode, gameRunning, gameTimeMs, shotClockMs, period, runHostLoop, stopHostLoop]);

    const stopClock = useCallback(() => {
        if (!isHost || !gameCode || !gameRunning) return;
        stopHostLoop();
        const now = Date.now();
        let finalGameMs = gameTimeMs;
        let finalShotMs = shotClockMs;
        if (gameStartEpochRef.current !== null) {
            finalGameMs = Math.max(0, gameStartMsRef.current - (now - gameStartEpochRef.current));
        }
        if (shotStartEpochRef.current !== null) {
            finalShotMs = Math.max(0, shotStartMsRef.current - (now - shotStartEpochRef.current));
        }
        gameStartEpochRef.current = null;
        shotStartEpochRef.current = null;
        setGameTimeMs(finalGameMs);
        setShotClockMs(finalShotMs);
        setGameRunning(false);

        const mins = Math.floor(finalGameMs / 60_000);
        const secs = Math.floor((finalGameMs % 60_000) / 1_000);
        const tenths = Math.floor((finalGameMs % 1_000) / 100);
        const shot = Math.ceil(finalShotMs / 1_000);
        broadcastClockStop(gameCode, {
            gameRunning: false, shotClockRunning: false,
            minutes: mins, seconds: secs, tenths, shotClock: shot,
            period, startedAt: null, shotClockStartedAt: null,
        });
    }, [isHost, gameCode, gameRunning, gameTimeMs, shotClockMs, period, stopHostLoop]);

    const resetShotClock24 = useCallback(() => {
        if (!isHost || !gameCode) return;
        const newMs = 24_000;
        setShotClockMs(newMs);
        shotStartMsRef.current = newMs;
        if (gameRunning) {
            shotStartEpochRef.current = Date.now();
        }
        broadcastShotClockReset(gameCode, 24, gameRunning);
    }, [isHost, gameCode, gameRunning]);

    const resetShotClock14 = useCallback(() => {
        if (!isHost || !gameCode) return;
        const newMs = 14_000;
        setShotClockMs(newMs);
        shotStartMsRef.current = newMs;
        if (gameRunning) {
            shotStartEpochRef.current = Date.now();
        }
        broadcastShotClockReset(gameCode, 14, gameRunning);
    }, [isHost, gameCode, gameRunning]);

    const nextPeriod = useCallback(() => {
        if (!isHost || !gameCode) return;
        stopHostLoop();
        gameStartEpochRef.current = null;
        shotStartEpochRef.current = null;
        const newPeriod = period + 1;
        const newGameMs = periodDuration * 60_000;
        const newShotMs = shotClockDuration * 1_000;
        setPeriod(newPeriod);
        setGameRunning(false);
        setGameTimeMs(newGameMs);
        setShotClockMs(newShotMs);
        gameStartMsRef.current = newGameMs;
        shotStartMsRef.current = newShotMs;

        broadcastPeriodChange(gameCode, newPeriod, {
            gameRunning: false, shotClockRunning: false,
            minutes: Math.floor(newGameMs / 60_000),
            seconds: 0, tenths: 0,
            shotClock: shotClockDuration,
            period: newPeriod,
            startedAt: null, shotClockStartedAt: null,
        });
    }, [isHost, gameCode, period, periodDuration, shotClockDuration, stopHostLoop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopHostLoop();
            if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        };
    }, [stopHostLoop]);

    // ─── FIBA DISPLAY FORMATTING ─────────────────────────────────────────────
    const minutes = Math.floor(gameTimeMs / 60_000);
    const seconds = Math.floor((gameTimeMs % 60_000) / 1_000);
    const tenths = Math.floor((gameTimeMs % 1_000) / 100);

    // FIBA: shot clock shows ceiling (23.9s → 24, 0.1s → 1)
    const displayShotClock = Math.ceil(shotClockMs / 1_000);

    return {
        minutes,
        seconds,
        tenths,
        shotClock: displayShotClock,
        period,
        gameRunning,
        toggleClock,
        stopClock,
        resetShotClock24,
        resetShotClock14,
        nextPeriod,
    };
};