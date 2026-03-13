// src/hooks/useStandaloneTimer.ts
import { useState, useRef, useEffect, useCallback } from 'react';

interface StandaloneTimerOptions {
    initialMinutes?: number;
    initialSeconds?: number;
    shotClockDuration?: number;
}

export const useStandaloneTimer = ({
    initialMinutes = 10,
    initialSeconds = 0,
    shotClockDuration = 24
}: StandaloneTimerOptions = {}) => {

    const [minutes, setMinutes] = useState(initialMinutes);
    const [seconds, setSeconds] = useState(initialSeconds);
    const [tenths, setTenths] = useState(0);
    const [shotClock, setShotClock] = useState(shotClockDuration);

    const [gameRunning, setGameRunning] = useState(false);
    const [shotClockRunning, setShotClockRunning] = useState(false);
    const [period, setPeriod] = useState(1);

    // Epoch anchors — the single source of truth for time
    const gameStartEpochRef = useRef<number | null>(null);
    const gameStartTenthsRef = useRef<number>(0);
    const shotStartEpochRef = useRef<number | null>(null);
    const shotStartValRef = useRef<number>(shotClockDuration);

    const workerRef = useRef<Worker | null>(null);

    // Boot the Web Worker once
    useEffect(() => {
        const workerCode = `
      let id = null;
      self.onmessage = (e) => {
        if (e.data === 'start') { if (id) return; id = setInterval(() => self.postMessage('tick'), 100); }
        else if (e.data === 'stop') { if (id) { clearInterval(id); id = null; } }
      };
    `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        workerRef.current = new Worker(URL.createObjectURL(blob));

        workerRef.current.onmessage = () => {
            // Every tick: derive current time mathematically from epoch
            if (!gameStartEpochRef.current) return;

            const now = Date.now();

            // ── Game Clock ──────────────────────────────────────────────
            const elapsedGameMs = now - gameStartEpochRef.current;
            const elapsedGameTenths = Math.floor(elapsedGameMs / 100);
            let totalTenths = Math.max(0, gameStartTenthsRef.current - elapsedGameTenths);

            const newMin = Math.floor(totalTenths / 600);
            const rem = totalTenths % 600;
            const newSec = Math.floor(rem / 10);
            const newTenth = rem % 10;

            setMinutes(newMin);
            setSeconds(newSec);
            setTenths(newTenth);

            if (totalTenths <= 0) {
                // Period expired
                gameStartEpochRef.current = null;
                setGameRunning(false);
                setShotClockRunning(false);
                workerRef.current?.postMessage('stop');
                if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
                return;
            }

            // ── Shot Clock ──────────────────────────────────────────────
            if (shotStartEpochRef.current !== null) {
                const elapsedShotMs = now - shotStartEpochRef.current;
                // FIBA: shot clock counts whole seconds, not tenths
                const elapsedShotSec = Math.floor(elapsedShotMs / 1000);
                const newShot = Math.max(0, shotStartValRef.current - elapsedShotSec);
                setShotClock(newShot);

                if (newShot <= 0) {
                    shotStartEpochRef.current = null;
                    setShotClockRunning(false);
                    if (navigator.vibrate) navigator.vibrate([200, 50, 200]);
                }
            }
        };

        return () => { workerRef.current?.terminate(); };
    }, []);

    // Start/stop the worker when gameRunning changes
    useEffect(() => {
        if (gameRunning) {
            workerRef.current?.postMessage('start');
        } else {
            workerRef.current?.postMessage('stop');
        }
    }, [gameRunning]);

    // ── Controls ─────────────────────────────────────────────────────────────

    const startClock = useCallback(() => {
        const currentTenths = minutes * 600 + seconds * 10 + tenths;
        gameStartEpochRef.current = Date.now();
        gameStartTenthsRef.current = currentTenths;
        if (shotClockRunning || true) { // start shot clock alongside
            shotStartEpochRef.current = Date.now();
            shotStartValRef.current = shotClock;
        }
        setGameRunning(true);
        setShotClockRunning(true);
    }, [minutes, seconds, tenths, shotClock, shotClockRunning]);

    const stopClock = useCallback(() => {
        // Freeze displayed values into state so they persist as new anchors
        gameStartEpochRef.current = null;
        shotStartEpochRef.current = null;
        setGameRunning(false);
        setShotClockRunning(false);
    }, []);

    const toggleClock = useCallback(() => {
        if (gameRunning) stopClock(); else startClock();
    }, [gameRunning, startClock, stopClock]);

    const resetShotClock = useCallback((val: number) => {
        setShotClock(val);
        shotStartValRef.current = val;
        if (gameRunning) {
            shotStartEpochRef.current = Date.now(); // re-anchor
        } else {
            shotStartEpochRef.current = null;
        }
        setShotClockRunning(gameRunning);
    }, [gameRunning]);

    const resetShotClock24 = useCallback(() => resetShotClock(shotClockDuration), [resetShotClock, shotClockDuration]);
    const resetShotClock14 = useCallback(() => resetShotClock(14), [resetShotClock]);

    const nextPeriod = useCallback(() => {
        gameStartEpochRef.current = null;
        shotStartEpochRef.current = null;
        setPeriod(p => p + 1);
        setGameRunning(false);
        setShotClockRunning(false);
        setMinutes(initialMinutes);
        setSeconds(initialSeconds);
        setTenths(0);
        setShotClock(shotClockDuration);
    }, [initialMinutes, initialSeconds, shotClockDuration]);

    const editClocks = useCallback((m: number, s: number, t: number, sc: number) => {
        // Re-anchor if running
        if (gameRunning) {
            gameStartEpochRef.current = Date.now();
            gameStartTenthsRef.current = m * 600 + s * 10 + t;
        }
        if (shotClockRunning) {
            shotStartEpochRef.current = Date.now();
            shotStartValRef.current = sc;
        }
        setMinutes(m); setSeconds(s); setTenths(t); setShotClock(sc);
    }, [gameRunning, shotClockRunning]);

    return {
        minutes, seconds, tenths, shotClock, period,
        gameRunning, shotClockRunning,
        toggleClock, stopClock, startClock,
        resetShotClock, resetShotClock24, resetShotClock14,
        nextPeriod, editClocks
    };
};