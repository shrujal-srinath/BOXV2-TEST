// src/hooks/useSupabaseBroadcast.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    broadcastClockTick, broadcastClockStart, broadcastClockStop,
    broadcastShotClockReset, broadcastPeriodChange, subscribeToGameBroadcast,
    type BroadcastClockState,
} from '../services/supabaseBroadcastService';
import { HostWebRTCManager, SpectatorWebRTCManager } from '../services/webrtcSync';

interface UseSupabaseBroadcastProps {
    gameCode: string;
    isHost: boolean;
    periodDuration: number;
    shotClockDuration: number;
}

export const useSupabaseBroadcast = ({
    gameCode, isHost, periodDuration, shotClockDuration,
}: UseSupabaseBroadcastProps) => {

    const [gameRunning, setGameRunning] = useState(false);
    const [period, setPeriod] = useState(1);
    const [gameTimeMs, setGameTimeMs] = useState(periodDuration * 60_000);
    const [shotClockMs, setShotClockMs] = useState(shotClockDuration * 1_000);

    const gameStartEpochRef = useRef<number | null>(null);
    const shotStartEpochRef = useRef<number | null>(null);
    const gameStartMsRef = useRef<number>(periodDuration * 60_000);
    const shotStartMsRef = useRef<number>(shotClockDuration * 1_000);

    const rafRef = useRef<number | null>(null);
    const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const rtcHostRef = useRef<HostWebRTCManager | null>(null);

    // ─── INITIALIZE WEBRTC ───────────────────────────────────────────────────
    useEffect(() => {
        if (!gameCode) return;
        if (isHost) {
            rtcHostRef.current = new HostWebRTCManager(gameCode);
            return () => rtcHostRef.current?.cleanup();
        }
    }, [isHost, gameCode]);

    // ── Ensures shared channel is initialised ────────────────────────────────
    useEffect(() => {
        if (!gameCode) return;
        const unsub = subscribeToGameBroadcast(gameCode, {});
        return unsub;
    }, [gameCode]);

    // =========================================================================
    // HOST SIDE
    // =========================================================================
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
                if (nextShot <= 0) shotStartEpochRef.current = null;
            }

            if (nextGame <= 0) {
                gameStartEpochRef.current = null;
                setGameRunning(false);
                return;
            }
            rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
    }, []);

    const stopHostLoop = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }, []);

    // ── Broadcast tick every 1000ms ──────────────────────────────────────────
    useEffect(() => {
        if (!isHost || !gameCode || !gameRunning) return;

        tickIntervalRef.current = setInterval(() => {
            // FIX: Calculate true time from epochs, completely independent of React state.
            // 1. Prevents "frozen time" if the Host tab is backgrounded.
            // 2. We removed gameTimeMs from the dependency array below so the interval 
            //    isn't destroyed and recreated 60 times a second.
            let broadcastGameMs = 0;
            let broadcastShotMs = 0;

            if (gameStartEpochRef.current !== null) {
                const elapsedGame = Date.now() - gameStartEpochRef.current;
                broadcastGameMs = Math.max(0, gameStartMsRef.current - elapsedGame);
            } else {
                broadcastGameMs = gameStartMsRef.current;
            }

            if (shotStartEpochRef.current !== null) {
                const elapsedShot = Date.now() - shotStartEpochRef.current;
                broadcastShotMs = Math.max(0, shotStartMsRef.current - elapsedShot);
            } else {
                broadcastShotMs = shotStartMsRef.current;
            }

            const mins = Math.floor(broadcastGameMs / 60_000);
            const secs = Math.floor((broadcastGameMs % 60_000) / 1_000);
            const tenths = Math.floor((broadcastGameMs % 1_000) / 100);
            const shot = Math.ceil(broadcastShotMs / 1_000);

            if (rtcHostRef.current) {
                rtcHostRef.current.broadcast(JSON.stringify({
                    type: 'clock_tick', payload: { minutes: mins, seconds: secs, tenths, shotClock: shot }
                }));
            }
            broadcastClockTick(gameCode, mins, secs, tenths, shot);
        }, 1000);

        return () => { if (tickIntervalRef.current) clearInterval(tickIntervalRef.current); };
    }, [isHost, gameCode, gameRunning]); // <-- CRITICAL FIX: Removed dynamic dependencies

    // =========================================================================
    // SPECTATOR SIDE
    // =========================================================================
    const lastSyncRef = useRef<{
        gameRunning: boolean; gameTimeMs: number; shotClockMs: number;
        period: number; receivedAt: number; startedAt: number | null; shotStartedAt: number | null;
    } | null>(null);

    // ── Local Interpolation Loop with STALE STATE PROTECTION ─────────────────
    useEffect(() => {
        if (isHost || !gameCode) return;
        const loop = () => {
            const sync = lastSyncRef.current;
            if (!sync) {
                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            if (sync.gameRunning && sync.startedAt !== null) {
                const now = Date.now();

                // STALE STATE PROTECTION: Increased from 3000ms to 8000ms
                // This gives the host a massive buffer if the browser throttles 
                // its background timers aggressively when tabs are switched.
                if (now - sync.receivedAt > 8000) {
                    rafRef.current = requestAnimationFrame(loop);
                    return;
                }

                const anchoredGame = Math.max(0, sync.gameTimeMs - (now - sync.startedAt) + (sync.receivedAt - sync.startedAt));
                setGameTimeMs(anchoredGame);

                if (sync.shotStartedAt !== null) {
                    const elapsedShot = now - sync.shotStartedAt;
                    const nextShot = Math.max(0, sync.shotClockMs - elapsedShot + (sync.receivedAt - sync.shotStartedAt));
                    setShotClockMs(Math.max(0, nextShot));
                }
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [isHost, gameCode]);

    // ── Unified State Handlers for both WebRTC and Supabase ──────────────────
    const handleTick = useCallback((payload: any) => {
        const newGameMs = payload.minutes * 60_000 + payload.seconds * 1_000 + payload.tenths * 100;
        const newShotMs = payload.shotClock * 1_000;
        if (lastSyncRef.current && lastSyncRef.current.startedAt !== null) {
            lastSyncRef.current = {
                ...lastSyncRef.current, gameTimeMs: newGameMs, shotClockMs: newShotMs,
                receivedAt: Date.now(), startedAt: Date.now(), shotStartedAt: Date.now(),
            };
        } else {
            setGameTimeMs(newGameMs);
            setShotClockMs(newShotMs);
        }
    }, []);

    const handleStart = useCallback((payload: any) => {
        const newGameMs = payload.minutes * 60_000 + payload.seconds * 1_000 + payload.tenths * 100;
        const newShotMs = payload.shotClock * 1_000;
        const now = Date.now();
        lastSyncRef.current = {
            gameRunning: true, gameTimeMs: newGameMs, shotClockMs: newShotMs, period: payload.period,
            receivedAt: now, startedAt: payload.startedAt ?? now, shotStartedAt: payload.shotClockStartedAt ?? now,
        };
        setGameRunning(true); setPeriod(payload.period);
        setGameTimeMs(newGameMs); setShotClockMs(newShotMs);
    }, []);

    const handleStop = useCallback((payload: any) => {
        const newGameMs = payload.minutes * 60_000 + payload.seconds * 1_000 + payload.tenths * 100;
        const newShotMs = payload.shotClock * 1_000;
        lastSyncRef.current = {
            gameRunning: false, gameTimeMs: newGameMs, shotClockMs: newShotMs, period: payload.period,
            receivedAt: Date.now(), startedAt: null, shotStartedAt: null,
        };
        setGameRunning(false); setPeriod(payload.period);
        setGameTimeMs(newGameMs); setShotClockMs(newShotMs);
    }, []);

    // ── Subscribe to incoming signals ────────────────────────────────────────
    useEffect(() => {
        if (isHost || !gameCode) return;

        // 1. WebRTC Receiver
        const rtc = new SpectatorWebRTCManager(gameCode, (msg) => {
            try {
                const data = JSON.parse(msg);
                if (data.type === 'clock_tick') handleTick(data.payload);
                else if (data.type === 'clock_start') handleStart(data.payload);
                else if (data.type === 'clock_stop') handleStop(data.payload);
            } catch (e) { }
        });

        // 2. Supabase Fallback Receiver
        const unsub = subscribeToGameBroadcast(gameCode, {
            onClockTick: handleTick,
            onClockStart: handleStart,
            onClockStop: handleStop,
            onShotClockReset: (payload) => {
                const newShotMs = payload.shotClock * 1_000;
                setShotClockMs(newShotMs);
                if (lastSyncRef.current) {
                    lastSyncRef.current = {
                        ...lastSyncRef.current, shotClockMs: newShotMs,
                        shotStartedAt: payload.shotClockRunning ? Date.now() : null, receivedAt: Date.now(),
                    };
                }
            },
            onPeriodChange: handleStop,
            onClockEdit: handleTick,
        });

        return () => { rtc.cleanup(); unsub(); };
    }, [isHost, gameCode, handleTick, handleStart, handleStop]);

    // =========================================================================
    // HOST ACTIONS
    // =========================================================================
    const toggleClock = useCallback(() => {
        if (!isHost || !gameCode) return;
        if (gameRunning) {
            stopHostLoop();
            const now = Date.now();
            let finalGameMs = gameTimeMs; let finalShotMs = shotClockMs;
            if (gameStartEpochRef.current !== null) finalGameMs = Math.max(0, gameStartMsRef.current - (now - gameStartEpochRef.current));
            if (shotStartEpochRef.current !== null) finalShotMs = Math.max(0, shotStartMsRef.current - (now - shotStartEpochRef.current));
            gameStartEpochRef.current = null; shotStartEpochRef.current = null;
            setGameTimeMs(finalGameMs); setShotClockMs(finalShotMs); setGameRunning(false);

            const state: BroadcastClockState = {
                gameRunning: false, shotClockRunning: false,
                minutes: Math.floor(finalGameMs / 60_000), seconds: Math.floor((finalGameMs % 60_000) / 1_000),
                tenths: Math.floor((finalGameMs % 1_000) / 100), shotClock: Math.ceil(finalShotMs / 1_000),
                period, startedAt: null, shotClockStartedAt: null,
            };
            if (rtcHostRef.current) rtcHostRef.current.broadcast(JSON.stringify({ type: 'clock_stop', payload: state }));
            broadcastClockStop(gameCode, state);
        } else {
            const now = Date.now();
            gameStartEpochRef.current = now; shotStartEpochRef.current = now;
            gameStartMsRef.current = gameTimeMs; shotStartMsRef.current = shotClockMs;
            setGameRunning(true); runHostLoop();

            const state: BroadcastClockState = {
                gameRunning: true, shotClockRunning: true,
                minutes: Math.floor(gameTimeMs / 60_000), seconds: Math.floor((gameTimeMs % 60_000) / 1_000),
                tenths: Math.floor((gameTimeMs % 1_000) / 100), shotClock: Math.ceil(shotClockMs / 1_000),
                period, startedAt: now, shotClockStartedAt: now,
            };
            if (rtcHostRef.current) rtcHostRef.current.broadcast(JSON.stringify({ type: 'clock_start', payload: state }));
            broadcastClockStart(gameCode, state);
        }
    }, [isHost, gameCode, gameRunning, gameTimeMs, shotClockMs, period, runHostLoop, stopHostLoop]);

    const stopClock = useCallback(() => {
        if (!isHost || !gameCode || !gameRunning) return;
        stopHostLoop();
        const now = Date.now();
        let finalGameMs = gameTimeMs; let finalShotMs = shotClockMs;
        if (gameStartEpochRef.current !== null) finalGameMs = Math.max(0, gameStartMsRef.current - (now - gameStartEpochRef.current));
        if (shotStartEpochRef.current !== null) finalShotMs = Math.max(0, shotStartMsRef.current - (now - shotStartEpochRef.current));
        gameStartEpochRef.current = null; shotStartEpochRef.current = null;
        setGameTimeMs(finalGameMs); setShotClockMs(finalShotMs); setGameRunning(false);

        const state: BroadcastClockState = {
            gameRunning: false, shotClockRunning: false,
            minutes: Math.floor(finalGameMs / 60_000), seconds: Math.floor((finalGameMs % 60_000) / 1_000),
            tenths: Math.floor((finalGameMs % 1_000) / 100), shotClock: Math.ceil(finalShotMs / 1_000),
            period, startedAt: null, shotClockStartedAt: null,
        };
        if (rtcHostRef.current) rtcHostRef.current.broadcast(JSON.stringify({ type: 'clock_stop', payload: state }));
        broadcastClockStop(gameCode, state);
    }, [isHost, gameCode, gameRunning, gameTimeMs, shotClockMs, period, stopHostLoop]);

    const resetShotClock24 = useCallback(() => {
        if (!isHost || !gameCode) return;
        const newMs = 24_000;
        setShotClockMs(newMs); shotStartMsRef.current = newMs;
        if (gameRunning) shotStartEpochRef.current = Date.now();
        broadcastShotClockReset(gameCode, 24, gameRunning);
    }, [isHost, gameCode, gameRunning]);

    const resetShotClock14 = useCallback(() => {
        if (!isHost || !gameCode) return;
        const newMs = 14_000;
        setShotClockMs(newMs); shotStartMsRef.current = newMs;
        if (gameRunning) shotStartEpochRef.current = Date.now();
        broadcastShotClockReset(gameCode, 14, gameRunning);
    }, [isHost, gameCode, gameRunning]);

    const nextPeriod = useCallback(() => {
        if (!isHost || !gameCode) return;
        stopHostLoop();
        gameStartEpochRef.current = null; shotStartEpochRef.current = null;
        const newPeriod = period + 1; const newGameMs = periodDuration * 60_000; const newShotMs = shotClockDuration * 1_000;
        setPeriod(newPeriod); setGameRunning(false); setGameTimeMs(newGameMs); setShotClockMs(newShotMs);
        gameStartMsRef.current = newGameMs; shotStartMsRef.current = newShotMs;

        const state: BroadcastClockState = {
            gameRunning: false, shotClockRunning: false, minutes: Math.floor(newGameMs / 60_000),
            seconds: 0, tenths: 0, shotClock: shotClockDuration, period: newPeriod,
            startedAt: null, shotClockStartedAt: null,
        };
        if (rtcHostRef.current) rtcHostRef.current.broadcast(JSON.stringify({ type: 'clock_stop', payload: state }));
        broadcastPeriodChange(gameCode, newPeriod, state);
    }, [isHost, gameCode, period, periodDuration, shotClockDuration, stopHostLoop]);

    // ── Hardware override: ESP32 sends its authoritative clock state ──────
    // When ESP32 is parent, the website doesn't run its own timer — it just
    // renders whatever the ESP32 says. This prevents clock drift entirely.
    const setFromHardware = useCallback((hw: {
        minutes: number;
        seconds: number;
        shotClock: number;
        period: number;
        gameRunning: boolean;
    }) => {
        // ESP32 is authoritative — re-anchor our epochs from received values.
        // If running: start the RAF loop from this point (smooth 60fps interpolation
        // between ESP32 ticks, eliminates the 0-1s display freeze).
        // If paused: set static values and stop the loop.
        const newGameMs = hw.minutes * 60_000 + hw.seconds * 1_000;
        const newShotMs = hw.shotClock * 1_000;

        gameStartMsRef.current = newGameMs;
        shotStartMsRef.current = newShotMs;
        setPeriod(hw.period);
        setGameRunning(hw.gameRunning);

        if (hw.gameRunning) {
            // Anchor epochs to NOW — RAF loop ticks forward from these values
            gameStartEpochRef.current = Date.now();
            shotStartEpochRef.current = Date.now();
            runHostLoop(); // smooth interpolation at 60fps until next ESP32 update
        } else {
            stopHostLoop();
            gameStartEpochRef.current = null;
            shotStartEpochRef.current = null;
            setGameTimeMs(newGameMs);
            setShotClockMs(newShotMs);
        }
    }, [stopHostLoop, runHostLoop]);

    useEffect(() => { return () => { stopHostLoop(); if (tickIntervalRef.current) clearInterval(tickIntervalRef.current); }; }, [stopHostLoop]);

    return {
        minutes: Math.floor(gameTimeMs / 60_000), seconds: Math.floor((gameTimeMs % 60_000) / 1_000), tenths: Math.floor((gameTimeMs % 1_000) / 100),
        shotClock: Math.ceil(shotClockMs / 1_000), period, gameRunning,
        toggleClock, stopClock, resetShotClock24, resetShotClock14, nextPeriod, setFromHardware,
    };
};