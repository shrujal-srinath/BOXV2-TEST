import React, { useEffect } from 'react';
import { useGameTimer } from '../hooks/useGameTimer';

interface GameClockProps {
  onTimeUpdate?: (minutes: number, seconds: number, tenths: number) => void;
  readonly?: boolean;
}

const formatTime = (num: number) => num.toString().padStart(2, '0');

export const GameClock: React.FC<GameClockProps> = ({ onTimeUpdate, readonly = false }) => {
  const { minutes, seconds, tenths, isRunning, startStop, reset } = useGameTimer(10, 0);

  useEffect(() => {
    if (!readonly && onTimeUpdate) {
      onTimeUpdate(minutes, seconds, tenths);
    }
  }, [minutes, seconds, tenths, readonly]); 

  const showTenths = minutes === 0 && seconds < 60;

  return (
    <div className="flex flex-col items-center w-full">
      <div className={`text-8xl font-mono font-bold tracking-tight tabular-nums mb-4 ${isRunning ? 'text-green-500' : 'text-zinc-200'}`}>
        {showTenths ? (
          <span>{seconds}.{tenths}</span>
        ) : (
          <span>{formatTime(minutes)}:{formatTime(seconds)}</span>
        )}
      </div>

      {!readonly && (
        <div className="flex gap-2 w-full max-w-xs">
          <button 
            onClick={startStop}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest rounded-sm border-b-4 active:border-b-0 active:translate-y-1 transition-all ${
              isRunning 
                ? 'bg-red-600 border-red-800 text-white hover:bg-red-500' 
                : 'bg-green-600 border-green-800 text-white hover:bg-green-500'
            }`}
          >
            {isRunning ? 'Stop Clock' : 'Start Clock'}
          </button>
          
          <button 
            onClick={() => reset(10, 0)}
            className="px-4 bg-zinc-800 border-b-4 border-zinc-950 text-zinc-400 hover:text-white font-bold rounded-sm active:border-b-0 active:translate-y-1"
          >
            RST
          </button>
        </div>
      )}
    </div>
  );
};