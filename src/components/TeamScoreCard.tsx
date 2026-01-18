import React from 'react';

interface TeamScoreCardProps {
  name: string;
  score: number;
  color: string;
  onUpdateScore?: (points: number) => void;
  readonly?: boolean;
}

export const TeamScoreCard: React.FC<TeamScoreCardProps> = ({ 
  name, score, color, onUpdateScore, readonly = false 
}) => {
  return (
    <div 
      className="relative flex flex-col items-center bg-zinc-900 border-t-8 shadow-2xl overflow-hidden"
      style={{ borderColor: color }}
    >
      <div className="w-full bg-black/40 p-3 text-center border-b border-zinc-800">
        <h2 className="text-3xl font-black tracking-tighter uppercase text-white truncate px-2">
          {name}
        </h2>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-8 bg-black">
        <div className="text-[10rem] font-bold text-white font-mono leading-none tracking-tighter tabular-nums" style={{ textShadow: `0 0 30px ${color}40` }}>
          {score}
        </div>
      </div>

      {!readonly && onUpdateScore && (
        <div className="grid grid-cols-4 w-full border-t border-zinc-800">
          <button onClick={() => onUpdateScore(1)} className="h-16 bg-zinc-800 hover:bg-zinc-700 text-white font-bold border-r border-zinc-700 text-xl font-mono active:bg-white active:text-black transition-colors">+1</button>
          <button onClick={() => onUpdateScore(2)} className="h-16 bg-zinc-800 hover:bg-zinc-700 text-white font-bold border-r border-zinc-700 text-xl font-mono active:bg-white active:text-black transition-colors">+2</button>
          <button onClick={() => onUpdateScore(3)} className="h-16 bg-zinc-800 hover:bg-zinc-700 text-white font-bold border-r border-zinc-700 text-xl font-mono active:bg-white active:text-black transition-colors">+3</button>
          <button onClick={() => onUpdateScore(-1)} className="h-16 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold text-xl font-mono active:bg-red-600 active:text-white transition-colors">-1</button>
        </div>
      )}
    </div>
  );
};