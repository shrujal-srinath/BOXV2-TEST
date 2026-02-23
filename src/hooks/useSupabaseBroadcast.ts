// src/hooks/useSupabaseBroadcast.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';

interface UseSupabaseBroadcastProps {
    gameCode: string;
    isHost: boolean;
    periodDuration: number;
    shotClockDuration: number;
}

export const useSupabaseBroadcast = ({
    gameCode,
    isHost,
    periodDuration,
    shotClockDuration
}: UseSupabaseBroadcastProps) => {
    const [gameRunning, setGameRunning] = useState(false);
    const [period, setPeriod] = useState(1);

    // Store time in pure milliseconds for flawless math
    const [gameTimeMs, setGameTimeMs] = useState(periodDuration * 60000);
    const [shotClockMs, setShotClockMs] = useState(shotClockDuration * 1000);

    const lastTickRef = useRef<number>(0);

    // FIX: Added | null and (null) to satisfy TypeScript
    const requestRef = useRef<number | null>(null);
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Track running state in a ref so the animation loop never goes stale
    const gameRunningRef = useRef(gameRunning);
    useEffect(() => { gameRunningRef.current = gameRunning; }, [gameRunning]);

    // ─── THE ENGINE: Delta-Time Clock ────────────────────────────────────────
    // Calculates the exact mathematical time passed between frames.
    // Completely immune to React re-renders and "fast clock" glitches.
    const tick = useCallback(() => {
        if (!gameRunningRef.current) return;

        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;

        setGameTimeMs(prevGame => {
            const nextGame = prevGame - delta;
            if (nextGame <= 0) {
                setGameRunning(false);
                return 0;
            }
            return nextGame;
        });

        setShotClockMs(prevShot => {
            const nextShot = prevShot - delta;
            if (nextShot <= 0) {
                setGameRunning(false); // FIBA: shot clock violation stops game clock
                return 0;
            }
            return nextShot;
        });

        requestRef.current = requestAnimationFrame(tick);
    }, []);

    // Start/Stop the engine
    useEffect(() => {
        if (isHost && gameRunning) {
            lastTickRef.current = Date.now();
            requestRef.current = requestAnimationFrame(tick);
        } else if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isHost, gameRunning, tick]);

    // ─── SYNC TO SUPABASE ──────────────────────────────────────────────────
    // Send clock state to Spectators and TVs every 300ms
    const broadcastState = useCallback(() => {
        if (!isHost || !gameCode) return;

        supabase.channel(`clock-${gameCode}`).send({
            type: 'broadcast',
            event: 'sync',
            payload: { gameRunning, gameTimeMs, shotClockMs, period }
        });
    }, [isHost, gameCode, gameRunning, gameTimeMs, shotClockMs, period]);

    useEffect(() => {
        if (isHost && gameRunning) {
            syncIntervalRef.current = setInterval(broadcastState, 300);
        } else if (isHost && !gameRunning) {
            broadcastState(); // Force one final sync when paused
        }
        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, [isHost, gameRunning, broadcastState]);

    // ─── SPECTATOR LISTENER ────────────────────────────────────────────────
    useEffect(() => {
        if (isHost || !gameCode) return;

        const channel = supabase.channel(`clock-${gameCode}`)
            .on('broadcast', { event: 'sync' }, ({ payload }) => {
                setGameRunning(payload.gameRunning);
                setGameTimeMs(payload.gameTimeMs);
                setShotClockMs(payload.shotClockMs);
                setPeriod(payload.period);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isHost, gameCode]);

    // ─── ACTIONS ───────────────────────────────────────────────────────────
    const toggleClock = () => setGameRunning(prev => !prev);
    const stopClock = () => setGameRunning(false);

    const resetShotClock24 = () => {
        setShotClockMs(24000);
        if (!gameRunning) broadcastState();
    };
    const resetShotClock14 = () => {
        setShotClockMs(14000);
        if (!gameRunning) broadcastState();
    };
    const nextPeriod = () => {
        setGameRunning(false);
        setPeriod(p => p + 1);
        setGameTimeMs(periodDuration * 60000);
        setShotClockMs(shotClockDuration * 1000);
    };

    // ─── FIBA FORMATTING ───────────────────────────────────────────────────
    const minutes = Math.floor(gameTimeMs / 60000);
    const seconds = Math.floor((gameTimeMs % 60000) / 1000);
    const tenths = Math.floor((gameTimeMs % 1000) / 100);

    // FIBA Rule: 23.9s shows as 24, 0.1s shows as 1.
    const displayShotClock = Math.ceil(shotClockMs / 1000);

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