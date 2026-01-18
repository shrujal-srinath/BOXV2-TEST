import React from 'react';

interface ShotClockProps {
  seconds: number;
  onReset?: (val: number) => void;
  readonly?: boolean;
}

export const ShotClock: React.FC<ShotClockProps> = ({ seconds, onReset, readonly = false }) => {
  const display = seconds > 9 ? Math.ceil(seconds) : seconds.toFixed(1);
  const isDanger = seconds <= 5;

  return (
    <div className="flex flex-col items-center bg-black border-4 border-zinc-800 p-2 shadow-lg">
      <div className="text-zinc-600 text-[9px] font-bold tracking-widest mb-1 uppercase">Shot Clock</div>
      
      <div className={`text-5xl font-mono font-bold leading-none tabular-nums ${isDanger ? 'text-red-500' : 'text-amber-500'}`}>
        {display}
      </div>

      {!readonly && onReset && (
        <div className="flex gap-1 w-full mt-2">
          <button onClick={() => onReset(24)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold py-1 border border-zinc-700">24</button>
          <button onClick={() => onReset(14)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold py-1 border border-zinc-700">14</button>
        </div>
      )}
    </div>
  );
};