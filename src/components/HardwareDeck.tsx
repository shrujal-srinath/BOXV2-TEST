import React, { useState, useEffect, useRef } from 'react';
import type { TeamData, GameState } from '../types';
import { Play, Pause, ChevronRight, RotateCcw } from 'lucide-react';

interface HardwareDeckProps {
  teamA: TeamData; // Home
  teamB: TeamData; // Guest
  gameState: GameState;
  onAction: (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => void;
  onGameClock: (action: 'toggle' | 'reset', value?: any) => void;
  onShotClock: (action: 'reset-24' | 'reset-14') => void;
  onPossession: () => void;
  onNextPeriod: () => void;
}

export const HardwareDeck: React.FC<HardwareDeckProps> = ({
  teamA,
  teamB,
  gameState,
  onAction,
  onGameClock,
  onShotClock,
  onPossession,
  onNextPeriod
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Haptic Feedback Helper
  const signal = (cmd: string, cb: () => void) => {
    if (navigator.vibrate) navigator.vibrate(50);
    setLogs(p => [...p.slice(-4), `[${new Date().toLocaleTimeString()}] ${cmd}`]);
    cb();
  };

  // Format Time (MM:SS)
  const formatTime = () => {
    const m = gameState.gameTime.minutes.toString().padStart(2, '0');
    const s = gameState.gameTime.seconds.toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-screen h-screen bg-black text-white overflow-hidden flex flex-col font-sans select-none">
      
      {/* === TOP SECTION: HUD & LABELS === */}
      <div className="h-[30vh] w-full bg-zinc-900 border-b-4 border-zinc-800 flex items-center justify-between px-4 py-2">
        
        {/* LEFT LABEL */}
        <div className="flex-1 h-full flex items-center justify-center border-r-2 border-zinc-800 bg-zinc-900/50">
           <h1 className="text-zinc-600 font-black text-4xl tracking-widest uppercase rotate-180 text-vertical-rl" style={{ writingMode: 'vertical-rl' }}>
             HOME TEAM
           </h1>
        </div>

        {/* CENTER SCREEN (GREEN BOX) */}
        <div className="w-[60%] max-w-4xl h-full bg-black border-[6px] border-green-700 rounded-2xl shadow-[0_0_30px_rgba(21,128,61,0.4)] flex relative overflow-hidden mx-4">
          
          {/* Scanline Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,255,0,0.05)_50%,transparent_50%)] bg-[length:100%_4px] pointer-events-none z-0"></div>

          {/* HOME SCORE */}
          <div className="flex-1 flex flex-col justify-center items-center border-r-2 border-green-900/60 z-10 bg-green-900/5">
            <span className="text-green-500 font-bold text-xs tracking-widest uppercase mb-1">SCORE</span>
            <span className="text-7xl font-mono font-black text-green-400 leading-none">{teamA.score}</span>
            <div className="flex gap-4 mt-2 bg-green-900/20 px-3 py-1 rounded">
              <span className="text-green-600 font-mono font-bold text-sm">FLS:{teamA.fouls}</span>
              <span className="text-green-600 font-mono font-bold text-sm">T.O:{teamA.timeouts}</span>
            </div>
          </div>

          {/* CLOCK & PERIOD */}
          <div className="flex-[1.4] flex flex-col justify-center items-center bg-green-900/10 z-10 border-r-2 border-green-900/60">
            <span className="text-blue-400 font-bold text-base uppercase tracking-widest mb-1">PERIOD {gameState.period}</span>
            <span className={`text-8xl font-mono font-black tracking-tighter leading-none ${gameState.gameRunning ? 'text-white' : 'text-zinc-400'}`}>
              {formatTime()}
            </span>
            <span className="text-yellow-400 font-mono font-bold text-4xl mt-2 drop-shadow-md">
              {gameState.shotClock}
            </span>
          </div>

          {/* GUEST SCORE */}
          <div className="flex-1 flex flex-col justify-center items-center z-10 bg-red-900/5">
            <span className="text-red-500 font-bold text-xs tracking-widest uppercase mb-1">SCORE</span>
            <span className="text-7xl font-mono font-black text-red-400 leading-none">{teamB.score}</span>
            <div className="flex gap-4 mt-2 bg-red-900/20 px-3 py-1 rounded">
              <span className="text-red-600 font-mono font-bold text-sm">FLS:{teamB.fouls}</span>
              <span className="text-red-600 font-mono font-bold text-sm">T.O:{teamB.timeouts}</span>
            </div>
          </div>
        </div>

        {/* RIGHT LABEL */}
        <div className="flex-1 h-full flex items-center justify-center border-l-2 border-zinc-800 bg-zinc-900/50">
           <h1 className="text-zinc-600 font-black text-4xl tracking-widest uppercase text-vertical-rl" style={{ writingMode: 'vertical-rl' }}>
             AWAY TEAM
           </h1>
        </div>
      </div>

      {/* === BOTTOM SECTION: BUTTON DECK === */}
      <div className="flex-1 grid grid-cols-12 gap-2 p-2 bg-zinc-950">
        
        {/* --- LEFT: HOME CONTROLS --- */}
        <div className="col-span-4 flex flex-col gap-2">
          {/* Main Scorer */}
          <button 
            onClick={() => signal("A+1", () => onAction('A', 'points', 1))}
            className="flex-1 bg-zinc-900 rounded-xl border-2 border-zinc-700 active:border-green-500 active:bg-green-900/20 active:text-green-500 flex flex-col items-center justify-center transition-all shadow-lg active:shadow-green-900/50 active:scale-[0.98]"
          >
            <span className="text-7xl font-black text-green-600">+1</span>
            <span className="text-xs font-bold text-zinc-500 uppercase mt-2">POINT</span>
          </button>
          
          {/* Actions Row */}
          <div className="h-24 grid grid-cols-3 gap-2">
             <ActionBtn label="-1" sub="CORR" onClick={() => signal("A-1", () => onAction('A', 'points', -1))} />
             <ActionBtn label="FOUL" sub="+1" onClick={() => signal("FOUL_A", () => onAction('A', 'foul', 1))} />
             <ActionBtn label="T.O." sub="CALL" onClick={() => signal("TO_A", () => onAction('A', 'timeout', 1))} />
          </div>
        </div>

        {/* --- CENTER: ADMIN CONTROLS --- */}
        <div className="col-span-4 flex flex-col gap-2 px-1">
          {/* Main Clock Toggle */}
          <button 
            onClick={() => signal("CLK", () => onGameClock('toggle'))}
            className={`flex-1 rounded-xl flex flex-col items-center justify-center border-4 shadow-xl transition-all active:scale-[0.98] ${gameState.gameRunning ? 'bg-red-900/20 border-red-600 text-red-500' : 'bg-green-900/20 border-green-600 text-green-500'}`}
          >
            {gameState.gameRunning ? <Pause size={56} fill="currentColor" /> : <Play size={56} fill="currentColor" ml-2 />}
            <span className="font-black text-2xl uppercase mt-2 tracking-widest">{gameState.gameRunning ? 'STOP' : 'START'}</span>
          </button>

          {/* Shot Clock Resets */}
          <div className="h-24 grid grid-cols-2 gap-2">
             <button 
               onClick={() => signal("RST_24", () => onShotClock('reset-24'))}
               className="bg-zinc-800 border-2 border-yellow-700/50 rounded-lg text-yellow-500 font-black text-3xl active:bg-yellow-500 active:text-black transition-colors"
             >
               24
             </button>
             <button 
               onClick={() => signal("RST_14", () => onShotClock('reset-14'))}
               className="bg-zinc-800 border-2 border-orange-700/50 rounded-lg text-orange-500 font-black text-3xl active:bg-orange-500 active:text-black transition-colors"
             >
               14
             </button>
          </div>

          {/* Possession & Period */}
          <div className="h-20 grid grid-cols-2 gap-2">
             <button 
               onClick={() => signal("POSS", onPossession)}
               className="bg-zinc-800 border border-zinc-600 rounded-lg flex items-center justify-between px-4 active:bg-blue-900/50 transition-colors group"
             >
               <span className={`text-3xl transition-colors ${gameState.possession === 'A' ? 'text-white' : 'text-zinc-700'}`}>◀</span>
               <span className="text-[10px] font-bold text-zinc-400 uppercase group-active:text-blue-400">POSS</span>
               <span className={`text-3xl transition-colors ${gameState.possession === 'B' ? 'text-white' : 'text-zinc-700'}`}>▶</span>
             </button>
             <button 
               onClick={() => signal("NXT_QTR", onNextPeriod)}
               className="bg-zinc-800 border border-zinc-600 rounded-lg flex items-center justify-center gap-2 text-zinc-400 font-bold active:bg-zinc-700 hover:text-white transition-colors"
             >
               <span>NEXT Q</span>
               <ChevronRight size={20} />
             </button>
          </div>
        </div>

        {/* --- RIGHT: GUEST CONTROLS --- */}
        <div className="col-span-4 flex flex-col gap-2">
          {/* Main Scorer */}
          <button 
            onClick={() => signal("B+1", () => onAction('B', 'points', 1))}
            className="flex-1 bg-zinc-900 rounded-xl border-2 border-zinc-700 active:border-red-500 active:bg-red-900/20 active:text-red-500 flex flex-col items-center justify-center transition-all shadow-lg active:shadow-red-900/50 active:scale-[0.98]"
          >
            <span className="text-7xl font-black text-red-600">+1</span>
            <span className="text-xs font-bold text-zinc-500 uppercase mt-2">POINT</span>
          </button>
          
          {/* Actions Row */}
          <div className="h-24 grid grid-cols-3 gap-2">
             <ActionBtn label="-1" sub="CORR" onClick={() => signal("B-1", () => onAction('B', 'points', -1))} />
             <ActionBtn label="FOUL" sub="+1" onClick={() => signal("FOUL_B", () => onAction('B', 'foul', 1))} />
             <ActionBtn label="T.O." sub="CALL" onClick={() => signal("TO_B", () => onAction('B', 'timeout', 1))} />
          </div>
        </div>
      </div>

      {/* Debug Line */}
      <div className="h-6 bg-black flex items-center justify-between px-4 text-[9px] text-zinc-700 font-mono">
        <div className="flex gap-2">
           <span className="text-zinc-600">SERIAL OUT:</span>
           <div className="flex gap-2 text-green-700">
              {logs.map((l, i) => <span key={i}>{l}</span>)}
              <div ref={logsEndRef}></div>
           </div>
        </div>
        <div>BAT: 100% | WIFI: {navigator.onLine ? "OK" : "ERR"}</div>
      </div>
    </div>
  );
};

// Sub-component for small buttons
const ActionBtn = ({ label, sub, onClick }: any) => (
  <button 
    onClick={onClick}
    className="bg-zinc-900 rounded border border-zinc-700 text-zinc-400 font-bold active:bg-zinc-700 active:text-white transition-colors flex flex-col items-center justify-center"
  >
    <span className="text-xl leading-none">{label}</span>
    <span className="text-[9px] opacity-60 uppercase mt-1">{sub}</span>
  </button>
);