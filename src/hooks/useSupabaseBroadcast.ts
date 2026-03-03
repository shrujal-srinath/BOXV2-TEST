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
    const [clockKey, setClockKey] = useState(0);

    // Store time in pure milliseconds for flawless math
    const [gameTimeMs, setGameTimeMs] = useState(periodDuration * 60000);
    const [shotClockMs, setShotClockMs] = useState(shotClockDuration * 1000);

    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // ─── THE ENGINE: Epoch-Based Interval ────────────────────────────────────
    // Captures start timestamps and computes elapsed time from those anchors.
    // 100ms interval is plenty for display — invisible to the eye.
    // Immune to browser throttling because elapsed = Date.now() - startEpoch.
    useEffect(() => {
        if (!isHost || !gameRunning) return;

        const startEpoch = Date.now();
        const startGameMs = gameTimeMs;
        const startShotMs = shotClockMs;

        const interval = setInterval(() => {
            const elapsed = Date.now() - startEpoch;

            const nextGame = Math.max(0, startGameMs - elapsed);
            const nextShot = Math.max(0, startShotMs - elapsed);

            setGameTimeMs(nextGame);
            setShotClockMs(nextShot);

            if (nextGame <= 0 || nextShot <= 0) {
                setGameRunning(false);
            }
        }, 100);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHost, gameRunning, clockKey]); // intentionally excludes gameTimeMs/shotClockMs

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

    // ─── VISIBILITY RE-SYNC ───────────────────────────────────────────────
    // When the host tab comes back from background, force a broadcast
    // so spectators re-align immediately.
    useEffect(() => {
        if (!isHost) return;
        const handleVisible = () => {
            if (document.visibilityState === 'visible' && gameRunning) {
                broadcastState();
            }
        };
        document.addEventListener('visibilitychange', handleVisible);
        return () => document.removeEventListener('visibilitychange', handleVisible);
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
        setClockKey(k => k + 1);
        broadcastState();
    };
    const resetShotClock14 = () => {
        setShotClockMs(14000);
        setClockKey(k => k + 1);
        broadcastState();
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