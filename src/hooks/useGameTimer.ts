import { useState, useEffect, useRef } from 'react';

export const useGameTimer = (initialMinutes: number, initialSeconds: number) => {
  const [minutes, setMinutes] = useState(initialMinutes);
  const [seconds, setSeconds] = useState(initialSeconds);
  const [tenths, setTenths] = useState(0); // NEW: Track tenths (0-9)
  const [isRunning, setIsRunning] = useState(false);
  
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      // Tick every 100ms (0.1 seconds)
      intervalRef.current = window.setInterval(() => {
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

  const startStop = () => setIsRunning(!isRunning);
  
  const reset = (m: number, s: number) => {
    setIsRunning(false);
    setMinutes(m);
    setSeconds(s);
    setTenths(0);
  };

  return { minutes, seconds, tenths, isRunning, startStop, reset };
};