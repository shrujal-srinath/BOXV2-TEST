import React from 'react';
import { useBasketballGame } from '../hooks/useBasketballGame';

interface ScoreboardProps {
  gameCode: string;
  gameType: 'local' | 'online';
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ gameCode, gameType }) => {
  const { game } = useBasketballGame(gameCode, gameType);

  const formatTime = (minutes: number, seconds: number): string => {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPeriodText = (period: number): string => {
    return period <= 4 ? `Q${period}` : `OT${period - 4}`;
  };

  const isBonus = (fouls: number) => fouls >= 5;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>

      <header className="flex justify-between items-center p-6 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur">
        <h1 className="text-xl font-black italic tracking-tighter text-zinc-500">OFFICIAL SCOREBOARD</h1>
        <div className="text-xs font-mono text-zinc-600 tracking-widest">{gameCode}</div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-7xl grid grid-cols-[1fr_auto_1fr] gap-8 md:gap-16 items-center">
          {/* TEAM A */}
          <div className="flex flex-col items-center">
            <h2 className="text-4xl md:text-6xl font-black uppercase mb-4 text-center tracking-tight" style={{ color: game.teamA.color }}>{game.teamA.name}</h2>
            <div className="bg-zinc-900/50 border-4 border-zinc-800 rounded-3xl p-8 min-w-[280px] text-center shadow-2xl relative">
              <span className="text-[12rem] md:text-[16rem] font-bold leading-none font-mono text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{game.teamA.score}</span>
              {isBonus(game.teamA.foulsThisQuarter) && <div className="absolute -top-4 right-4 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-lg">Bonus</div>}
            </div>
          </div>

          {/* CENTER CLOCK */}
          <div className="flex flex-col items-center gap-8 z-10">
            <div className="bg-zinc-900 px-8 py-2 rounded-full border border-zinc-700 text-zinc-400 font-bold tracking-[0.2em] text-xl shadow-lg">{getPeriodText(game.gameState.period)}</div>
            <div className="bg-black border-8 border-zinc-800 rounded-3xl p-8 shadow-2xl min-w-[320px] text-center relative overflow-hidden">
              <div className={`text-[6rem] md:text-[8rem] font-mono font-bold leading-none tracking-tight ${game.gameState.gameTime.minutes === 0 ? 'text-red-500' : 'text-white'}`}>
                {formatTime(game.gameState.gameTime.minutes, game.gameState.gameTime.seconds)}
              </div>
            </div>
            <div className="bg-zinc-900 border-4 border-zinc-700 rounded-2xl p-6 min-w-[200px] text-center shadow-xl">
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2">Shot Clock</div>
              <div className={`text-6xl font-mono font-bold ${game.gameState.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>{game.gameState.shotClock}</div>
            </div>
          </div>

          {/* TEAM B */}
          <div className="flex flex-col items-center">
            <h2 className="text-4xl md:text-6xl font-black uppercase mb-4 text-center tracking-tight" style={{ color: game.teamB.color }}>{game.teamB.name}</h2>
            <div className="bg-zinc-900/50 border-4 border-zinc-800 rounded-3xl p-8 min-w-[280px] text-center shadow-2xl relative">
              <span className="text-[12rem] md:text-[16rem] font-bold leading-none font-mono text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{game.teamB.score}</span>
              {isBonus(game.teamB.foulsThisQuarter) && <div className="absolute -top-4 right-4 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-lg">Bonus</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};