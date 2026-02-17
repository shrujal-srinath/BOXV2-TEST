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

    // Internal State
    const [minutes, setMinutes] = useState(initialMinutes);
    const [seconds, setSeconds] = useState(initialSeconds);
    const [tenths, setTenths] = useState(0);
    const [shotClock, setShotClock] = useState(shotClockDuration);

    const [gameRunning, setGameRunning] = useState(false);
    const [shotClockRunning, setShotClockRunning] = useState(false);
    const [period, setPeriod] = useState(1);

    const intervalRef = useRef<number | null>(null);

    // THE LOCAL ENGINE LOOP (Runs every 100ms)
    useEffect(() => {
        if (gameRunning) {
            intervalRef.current = window.setInterval(() => {
                setTenths(prevT => {
                    if (prevT > 0) return prevT - 1;

                    // Tenths hit 0, decrement seconds
                    setSeconds(prevS => {
                        if (prevS > 0) return prevS - 1;

                        // Seconds hit 0, decrement minutes
                        setMinutes(prevM => {
                            if (prevM > 0) return prevM - 1;

                            // TIME EXPIRED
                            setGameRunning(false);
                            setShotClockRunning(false);
                            return 0;
                        });
                        return 59;
                    });

                    // Decrement Shot Clock roughly every second (when tenths roll over)
                    setShotClock(prevSC => {
                        if (!shotClockRunning) return prevSC;
                        return prevSC > 0 ? prevSC - 1 : 0;
                    });

                    return 9; // Reset tenths
                });
            }, 100);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [gameRunning, shotClockRunning]);

    // CONTROLS
    const toggleClock = useCallback(() => {
        setGameRunning(prev => !prev);
        setShotClockRunning(prev => !prev);
    }, []);

    const stopClock = useCallback(() => {
        setGameRunning(false);
        setShotClockRunning(false);
    }, []);

    const startClock = useCallback(() => {
        setGameRunning(true);
        setShotClockRunning(true);
    }, []);

    const resetShotClock24 = useCallback(() => setShotClock(24), []);
    const resetShotClock14 = useCallback(() => setShotClock(14), []);
    const resetShotClock = useCallback((val: number) => setShotClock(val), []);

    const nextPeriod = useCallback(() => {
        setPeriod(p => p + 1);
        setGameRunning(false);
        setShotClockRunning(false);
        setMinutes(initialMinutes); // Reset to default duration
        setSeconds(0);
        setTenths(0);
        setShotClock(shotClockDuration);
    }, [initialMinutes, shotClockDuration]);

    const editClocks = useCallback((m: number, s: number, t: number, sc: number) => {
        setMinutes(m);
        setSeconds(s);
        setTenths(t);
        setShotClock(sc);
    }, []);

    return {
        minutes, seconds, tenths, shotClock, period,
        gameRunning, shotClockRunning,
        toggleClock, stopClock, startClock,
        resetShotClock, resetShotClock24, resetShotClock14,
        nextPeriod, editClocks
    };
};