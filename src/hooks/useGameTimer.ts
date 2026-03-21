import { useState, useEffect, useRef } from 'react';

export const useGameTimer = (initialMinutes: number, initialSeconds: number, initialShotClock: number = 24) => {
  const [minutes, setMinutes] = useState(initialMinutes);
  const [seconds, setSeconds] = useState(initialSeconds);
  const [tenths, setTenths] = useState(0);
  const [shotClock, setShotClock] = useState(initialShotClock);
  const [isRunning, setIsRunning] = useState(false);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      // Tick every 100ms (0.1 seconds)
      intervalRef.current = window.setInterval(() => {

        // Shot Clock Logic (Dead reckoning locally)
        setShotClock((prevSC) => {
          if (prevSC > 0.1) {
            return Number((prevSC - 0.1).toFixed(1));
          }
          return 0;
        });

        // Game Clock Logic
        setTenths((prevTenths) => {
          if (prevTenths > 0) {
            return prevTenths - 1;
          } else {
            // Tenths hit 0, decrease Seconds
            setSeconds((prevSeconds) => {
              if (prevSeconds > 0) {
                return prevSeconds - 1;
              } else {
                // Seconds hit 0, decrease Minutes
                setMinutes((prevMinutes) => {
                  if (prevMinutes > 0) {
                    return prevMinutes - 1;
                  } else {
                    // Time is up!
                    setIsRunning(false);
                    return 0;
                  }
                });
                return 59; // Reset seconds
              }
            });
            return 9; // Reset tenths
          }
        });
      }, 100); // 100ms interval
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Shot clock blanking rule: turns off if game clock is less than shot clock
  useEffect(() => {
    const gameTimeLeft = minutes * 60 + seconds + (tenths / 10);
    if (gameTimeLeft < shotClock && shotClock > 0) {
      setShotClock(0);
    }
  }, [minutes, seconds, tenths, shotClock]);

  const startStop = () => setIsRunning(!isRunning);

  const reset = (m: number, s: number, sc: number = 24) => {
    setIsRunning(false);
    setMinutes(m);
    setSeconds(s);
    setTenths(0);
    setShotClock(sc);
  };

  return { minutes, seconds, tenths, shotClock, isRunning, startStop, reset };
};