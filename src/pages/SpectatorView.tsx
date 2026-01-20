import React from 'react';
import { useParams } from 'react-router-dom';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { TeamScoreCard } from '../components/TeamScoreCard';
// Removed unused GameClock import
import { ShotClock } from '../components/ShotClock';

// A Special Wrapper to force GameClock to show DB time, not internal time
const SpectatorClock = ({ minutes, seconds, tenths }: any) => {
  const showTenths = minutes === 0 && seconds < 60;
  const formatTime = (n: number) => n.toString().padStart(2, '0');
  
  return (
    <div className="flex flex-col items-center bg-gray-900 border-4 border-gray-800 rounded-xl p-6 w-full max-w-sm mx-auto shadow-2xl">
      <div className="text-7xl font-mono font-bold tracking-widest text-white">
        {showTenths ? <span>{seconds}.{tenths}</span> : <span>{formatTime(minutes)}:{formatTime(seconds)}</span>}
      </div>
    </div>
  );
};

export const SpectatorView: React.FC = () => {
  const { gameCode } = useParams();
  const game = useBasketballGame(gameCode || "DEMO");

  const getPeriodName = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans flex flex-col items-center justify-center">
      
      {/* HEADER */}
      <div className="mb-8 text-center">
        <div className="text-gray-500 text-sm tracking-[0.5em] uppercase mb-2">Live Broadcast</div>
        <h1 className="text-4xl font-bold text-white tracking-widest">{game.settings.gameName}</h1>
      </div>

      {/* SCOREBOARD ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-12 items-center w-full max-w-7xl">
        
        {/* TEAM A */}
        <TeamScoreCard 
          name={game.teamA.name} 
          color={game.teamA.color} 
          score={game.teamA.score} 
          readonly={true} // Hides buttons
        />

        {/* CENTER STAGE */}
        <div className="flex flex-col items-center gap-8">
          <div className="bg-gray-800 px-8 py-2 rounded-full text-2xl font-bold border border-gray-700">
            {getPeriodName(game.gameState.period)}
          </div>
          
          <SpectatorClock 
            minutes={game.gameState.gameTime.minutes} 
            seconds={game.gameState.gameTime.seconds} 
            tenths={game.gameState.gameTime.tenths} 
          />
          
          <div className="scale-125">
            <ShotClock seconds={game.gameState.shotClock} readonly={true} />
          </div>

          {/* Possession */}
          <div className="mt-4 flex flex-col items-center">
            <span className="text-gray-600 text-xs tracking-widest mb-2">POSSESSION</span>
            <div className="text-5xl" style={{ color: game.gameState.possession === 'A' ? game.teamA.color : game.teamB.color }}>
              {game.gameState.possession === 'A' ? '◄' : '►'}
            </div>
          </div>
        </div>

        {/* TEAM B */}
        <TeamScoreCard 
          name={game.teamB.name} 
          color={game.teamB.color} 
          score={game.teamB.score} 
          readonly={true} // Hides buttons
        />
      </div>

      {/* FOOTER STATS */}
      <div className="mt-16 flex gap-20 text-gray-400 font-mono text-xl">
        <div>{game.teamA.name} FOULS: <span className="text-white">{game.teamA.fouls}</span></div>
        <div>{game.teamB.name} FOULS: <span className="text-white">{game.teamB.fouls}</span></div>
      </div>

    </div>
  );
};