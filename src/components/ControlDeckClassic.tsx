import React from 'react';
import type { TeamData, GameState } from '../types';

interface ControlDeckProps {
   teamA: TeamData;
   teamB: TeamData;
   gameState: GameState;
   onAction: (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => void;
   onGameClock: (action: 'start' | 'stop' | 'toggle') => void;
   onShotClock: (action: 'reset-24' | 'reset-14') => void;
   onPossession: () => void;
   onUndo: () => void;
   onSwitchMode: () => void;
}

export const ControlDeckClassic: React.FC<ControlDeckProps> = ({
   teamA, teamB, gameState, onAction, onGameClock, onShotClock, onPossession, onSwitchMode
}) => {
   return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">

         {/* CLOCK CONTROLS ROW */}
         <div className="flex gap-4 items-stretch h-20 md:h-24">
            <button
               onClick={() => onGameClock('toggle')}
               className={`flex-1 rounded-xl font-black text-2xl md:text-3xl uppercase tracking-widest shadow-lg transition-transform active:scale-[0.98] ${gameState.gameRunning ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
            >
               {gameState.gameRunning ? 'STOP CLOCK' : 'START GAME'}
            </button>

            <div className="flex flex-col gap-2 w-32 md:w-48">
               <button onClick={() => onShotClock('reset-24')} className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg font-bold text-white text-sm md:text-lg">Reset 24</button>
               <button onClick={() => onShotClock('reset-14')} className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg font-bold text-white text-sm md:text-lg">Reset 14</button>
            </div>

            <button onClick={onPossession} className="w-24 md:w-32 bg-zinc-900 border-2 border-zinc-700 rounded-xl flex flex-col items-center justify-center p-2 group">
               <div className="text-[8px] md:text-[9px] uppercase font-bold text-zinc-500 group-hover:text-white">Possession</div>
               <div className="text-2xl md:text-3xl font-black" style={{ color: gameState.possession === 'A' ? teamA.color : teamB.color }}>
                  {gameState.possession === 'A' ? '◀' : '▶'}
               </div>
            </button>
         </div>

         {/* TEAMS ROW */}
         <div className="grid grid-cols-2 gap-4 md:gap-8">

            {/* Team A Controls */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-3 md:p-4 rounded-xl flex flex-col gap-3">
               <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="font-bold text-white uppercase truncate text-sm md:text-base">{teamA.name}</span>
                  <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">HOME</span>
               </div>
               <div className="grid grid-cols-3 gap-2 h-16 md:h-20">
                  {[1, 2, 3].map(pts => (
                     <button key={pts} onClick={() => onAction('A', 'points', pts)} className="bg-zinc-800 hover:bg-blue-900 border border-zinc-700 hover:border-blue-600 rounded-lg text-lg md:text-xl font-black text-white transition-colors">
                        +{pts}
                     </button>
                  ))}
               </div>
               <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => onAction('A', 'points', -1)} className="bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold rounded py-3 text-[10px] md:text-xs uppercase">Kor (-1)</button>
                  <button onClick={() => onAction('A', 'foul', 1)} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded py-3 text-[10px] md:text-xs uppercase">Foul (+1)</button>
                  <button onClick={() => onAction('A', 'timeout', -1)} className="bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-500 font-bold rounded py-3 text-[10px] md:text-xs uppercase">Timeout</button>
               </div>
            </div>

            {/* Team B Controls */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-3 md:p-4 rounded-xl flex flex-col gap-3">
               <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="font-bold text-white uppercase truncate text-sm md:text-base">{teamB.name}</span>
                  <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">AWAY</span>
               </div>
               <div className="grid grid-cols-3 gap-2 h-16 md:h-20">
                  {[1, 2, 3].map(pts => (
                     <button key={pts} onClick={() => onAction('B', 'points', pts)} className="bg-zinc-800 hover:bg-red-900 border border-zinc-700 hover:border-red-600 rounded-lg text-lg md:text-xl font-black text-white transition-colors">
                        +{pts}
                     </button>
                  ))}
               </div>
               <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => onAction('B', 'points', -1)} className="bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold rounded py-3 text-[10px] md:text-xs uppercase">Kor (-1)</button>
                  <button onClick={() => onAction('B', 'foul', 1)} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded py-3 text-[10px] md:text-xs uppercase">Foul (+1)</button>
                  <button onClick={() => onAction('B', 'timeout', -1)} className="bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-500 font-bold rounded py-3 text-[10px] md:text-xs uppercase">Timeout</button>
               </div>
            </div>

         </div>

         <button onClick={onSwitchMode} className="w-full py-4 bg-zinc-800 hover:bg-blue-900 text-zinc-400 hover:text-white font-bold uppercase text-xs tracking-widest rounded-lg transition-colors border border-zinc-700">
            End Period / Next Quarter
         </button>

      </div>
   );
};