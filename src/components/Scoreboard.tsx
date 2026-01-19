import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GameClock } from './GameClock';
import { ShotClock } from './ShotClock';
import { PlayerSelectModal } from './PlayerSelectModal'; 
import { useBasketballGame } from '../hooks/useBasketballGame';

export const Scoreboard: React.FC = () => {
  const { gameCode } = useParams(); 
  const game = useBasketballGame(gameCode || "DEMO");

  // --- MODAL STATE ---
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    team: 'A' | 'B';
    type: 'points' | 'foul';
    value: number;
    label: string;
  } | null>(null);

  // --- HANDLERS ---
  const handleActionClick = (team: 'A' | 'B', type: 'points' | 'foul', value: number) => {
    // Immediate Undo (Negative values)
    if (value < 0) {
      if (type === 'points') game.updateScore(team, value);
      else game.updateFouls(team, value);
      return;
    }

    // Open Player Selection for Positive Actions
    setPendingAction({
      team,
      type,
      value,
      label: type === 'points' ? `+${value} PTS` : 'FOUL'
    });
    setModalOpen(true);
  };

  const handlePlayerSelect = (playerId: string) => {
    if (!pendingAction) return;

    if (playerId === 'anonymous') {
      if (pendingAction.type === 'points') game.updateScore(pendingAction.team, pendingAction.value);
      else game.updateFouls(pendingAction.team, pendingAction.value);
    } else {
      const pts = pendingAction.type === 'points' ? pendingAction.value : 0;
      const fls = pendingAction.type === 'foul' ? pendingAction.value : 0;
      game.updatePlayerStats(pendingAction.team, playerId, pts, fls);
    }
    setModalOpen(false);
    setPendingAction(null);
  };

  const handleNextPeriod = () => {
    const current = game.gameState.period;
    if (current === 4) game.setPeriod(5);
    else game.setPeriod(current + 1);
  };

  const getPeriodName = (p: number) => p <= 4 ? `Q${p}` : `OT${p - 4}`;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col overflow-hidden">
      
      {/* MODAL */}
      <PlayerSelectModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        teamName={pendingAction?.team === 'A' ? game.teamA.name : game.teamB.name}
        color={pendingAction?.team === 'A' ? game.teamA.color : game.teamB.color}
        players={pendingAction?.team === 'A' ? game.teamA.players : game.teamB.players}
        onSelectPlayer={handlePlayerSelect}
        actionLabel={pendingAction?.label || ""}
      />

      {/* === HEADER BAR === */}
      <header className="h-14 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-900/30 border border-red-900/50 rounded-full">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-red-500 tracking-widest uppercase">Live Connection</span>
          </div>
          <div className="h-4 w-[1px] bg-zinc-800"></div>
          <div className="text-zinc-500 text-xs font-bold tracking-widest">
            ID: <span className="text-white font-mono">{gameCode}</span>
          </div>
        </div>
        <div className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">Console V2.4</div>
      </header>

      {/* === MAIN DISPLAY (JUMBOTRON) === */}
      <div className="flex-1 relative flex flex-col">
        {/* Background Grid FX */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 to-black pointer-events-none"></div>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        {/* SCOREBOARD CONTAINER */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-7xl mx-auto w-full p-4 lg:p-8">
          
          <div className="grid grid-cols-12 gap-4 lg:gap-8 h-full max-h-[500px]">
            
            {/* TEAM A DISPLAY */}
            <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 flex flex-col relative overflow-hidden group">
               {/* Team Color Accent */}
               <div className="absolute top-0 left-0 w-full h-2" style={{ background: game.teamA.color }}></div>
               {game.gameState.possession === 'A' && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/10 to-transparent"></div>}
               
               <div className="flex justify-between items-start mb-4">
                 <h2 className="text-2xl lg:text-3xl font-black italic uppercase tracking-tighter text-white truncate max-w-[80%]">{game.teamA.name}</h2>
                 {game.gameState.possession === 'A' && <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_white] animate-pulse"></div>}
               </div>

               <div className="flex-1 flex items-center justify-center">
                 <div className="text-[8rem] lg:text-[10rem] font-mono font-bold leading-none tracking-tighter" style={{ color: game.teamA.color, textShadow: `0 0 40px ${game.teamA.color}40` }}>
                   {game.teamA.score}
                 </div>
               </div>

               <div className="flex justify-between items-end border-t border-zinc-800 pt-4">
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Fouls</div>
                    <div className="text-2xl font-mono font-bold text-red-500">{game.teamA.fouls}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Timeouts</div>
                    <div className="flex gap-1">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className={`w-2 h-4 rounded-sm ${i < game.teamA.timeouts ? 'bg-yellow-500 shadow-[0_0_5px_#eab308]' : 'bg-zinc-800'}`}></div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>

            {/* CENTER CLOCK TOWER */}
            <div className="col-span-4 flex flex-col gap-4">
               {/* Main Clock */}
               <div className="flex-1 bg-black border-2 border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                  <div className="absolute top-4 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Game Clock</div>
                  <div className="scale-125 lg:scale-150 transform origin-center">
                    <GameClock onTimeUpdate={(m,s,t) => game.updateGameTime(m,s,t)} />
                  </div>
               </div>

               {/* Period & Shot Clock */}
               <div className="h-1/3 grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center justify-center">
                     <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Period</span>
                     <span className="text-4xl font-black italic text-white">{getPeriodName(game.gameState.period)}</span>
                     <button onClick={handleNextPeriod} className="mt-2 text-[9px] text-blue-500 hover:text-white uppercase font-bold tracking-widest transition-colors">Adv &rarr;</button>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                     <div className="scale-75">
                       <ShotClock seconds={game.gameState.shotClock} onReset={game.resetShotClock} />
                     </div>
                  </div>
               </div>
            </div>

            {/* TEAM B DISPLAY */}
            <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 flex flex-col relative overflow-hidden group">
               {/* Team Color Accent */}
               <div className="absolute top-0 right-0 w-full h-2" style={{ background: game.teamB.color }}></div>
               {game.gameState.possession === 'B' && <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-white/10 to-transparent"></div>}
               
               <div className="flex justify-between items-start mb-4 flex-row-reverse">
                 <h2 className="text-2xl lg:text-3xl font-black italic uppercase tracking-tighter text-white truncate max-w-[80%] text-right">{game.teamB.name}</h2>
                 {game.gameState.possession === 'B' && <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_white] animate-pulse"></div>}
               </div>

               <div className="flex-1 flex items-center justify-center">
                 <div className="text-[8rem] lg:text-[10rem] font-mono font-bold leading-none tracking-tighter" style={{ color: game.teamB.color, textShadow: `0 0 40px ${game.teamB.color}40` }}>
                   {game.teamB.score}
                 </div>
               </div>

               <div className="flex justify-between items-end border-t border-zinc-800 pt-4 flex-row-reverse">
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Fouls</div>
                    <div className="text-2xl font-mono font-bold text-red-500">{game.teamB.fouls}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Timeouts</div>
                    <div className="flex gap-1 flex-row-reverse">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className={`w-2 h-4 rounded-sm ${i < game.teamB.timeouts ? 'bg-yellow-500 shadow-[0_0_5px_#eab308]' : 'bg-zinc-800'}`}></div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* === THE CONTROL DECK (PILOT'S COCKPIT) === */}
      <div className="bg-zinc-950 border-t border-zinc-800 p-6 z-30 shrink-0">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">
          
          {/* TEAM A CONTROLS */}
          <div className="col-span-4 flex flex-col gap-4 border-r border-zinc-900 pr-8">
             <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">{game.teamA.name} Controls</div>
             
             {/* Score Buttons */}
             <div className="grid grid-cols-3 gap-2">
               <ScoreBtn value={1} color={game.teamA.color} onClick={() => handleActionClick('A', 'points', 1)} />
               <ScoreBtn value={2} color={game.teamA.color} onClick={() => handleActionClick('A', 'points', 2)} />
               <ScoreBtn value={3} color={game.teamA.color} onClick={() => handleActionClick('A', 'points', 3)} />
             </div>

             {/* Admin Row */}
             <div className="grid grid-cols-3 gap-2 mt-1">
                <AdminBtn label="FOUL" color="text-red-500" onClick={() => handleActionClick('A', 'foul', 1)} />
                <AdminBtn label="TIMEOUT" color="text-yellow-500" onClick={() => game.updateTimeouts('A', -1)} />
                <AdminBtn label="UNDO" color="text-zinc-500" onClick={() => handleActionClick('A', 'points', -1)} />
             </div>
          </div>

          {/* CENTER ACTIONS */}
          <div className="col-span-4 flex items-center justify-center gap-4">
             <button 
               onClick={game.togglePossession} 
               className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-zinc-800 hover:border-white transition-all flex flex-col items-center justify-center gap-1 group active:scale-95"
             >
               <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white">Poss</span>
               <span className="text-2xl font-black text-white">
                 {game.gameState.possession === 'A' ? '◀' : '▶'}
               </span>
             </button>
          </div>

          {/* TEAM B CONTROLS */}
          <div className="col-span-4 flex flex-col gap-4 border-l border-zinc-900 pl-8">
             <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1 text-right">{game.teamB.name} Controls</div>
             
             {/* Score Buttons */}
             <div className="grid grid-cols-3 gap-2">
               <ScoreBtn value={1} color={game.teamB.color} onClick={() => handleActionClick('B', 'points', 1)} />
               <ScoreBtn value={2} color={game.teamB.color} onClick={() => handleActionClick('B', 'points', 2)} />
               <ScoreBtn value={3} color={game.teamB.color} onClick={() => handleActionClick('B', 'points', 3)} />
             </div>

             {/* Admin Row */}
             <div className="grid grid-cols-3 gap-2 mt-1">
                <AdminBtn label="UNDO" color="text-zinc-500" onClick={() => handleActionClick('B', 'points', -1)} />
                <AdminBtn label="TIMEOUT" color="text-yellow-500" onClick={() => game.updateTimeouts('B', -1)} />
                <AdminBtn label="FOUL" color="text-red-500" onClick={() => handleActionClick('B', 'foul', 1)} />
             </div>
          </div>

        </div>
      </div>

    </div>
  );
};

// --- SUB-COMPONENTS ---

const ScoreBtn = ({ value, color, onClick }: any) => (
  <button 
    onClick={onClick}
    className="h-16 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-white/20 transition-all active:scale-95 active:bg-white flex flex-col items-center justify-center group shadow-lg"
    style={{ borderBottom: `4px solid ${color}` }}
  >
    <span className="text-2xl font-black italic text-white group-active:text-black">+{value}</span>
  </button>
);

const AdminBtn = ({ label, color, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`h-10 rounded bg-black border border-zinc-800 hover:border-zinc-600 transition-all active:scale-95 flex items-center justify-center ${color} font-black text-[10px] uppercase tracking-widest`}
  >
    {label}
  </button>
);