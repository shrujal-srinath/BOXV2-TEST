import React, { useState, useEffect, useRef } from 'react';
import type { TeamData, GameState } from '../types';
import { Pencil, ChevronRight, Play, Pause, ArrowLeftRight } from 'lucide-react';

// Define props for the component
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

// Reusable Circular Button for Score
const ScoreCircleBtn = ({ label, onClick, color }: { label: string; onClick: () => void; color: 'green' | 'red' }) => {
  const gradient = color === 'green' ? 'from-green-600 to-green-800' : 'from-red-600 to-red-800';
  const shadow = color === 'green' ? 'shadow-green-900' : 'shadow-red-900';
  return (
    <button
      onClick={onClick}
      className={`w-16 h-16 rounded-full bg-gradient-to-b ${gradient} text-white font-bold text-xl flex items-center justify-center shadow-lg ${shadow} active:translate-y-1 active:shadow-md transition-all border-2 border-white/20`}
    >
      {label}
    </button>
  );
};

// Reusable Rectangular Button
const RectBtn = ({ label, icon, onClick, color = 'zinc', className = '' }: { label: string; icon?: React.ReactNode; onClick: () => void; color?: 'green' | 'red' | 'zinc'; className?: string }) => {
  const bg = color === 'green' ? 'bg-green-800 hover:bg-green-700' : color === 'red' ? 'bg-red-800 hover:bg-red-700' : 'bg-zinc-800 hover:bg-zinc-700';
  return (
    <button
      onClick={onClick}
      className={`h-12 px-4 rounded-md ${bg} text-white font-semibold uppercase flex items-center justify-center gap-2 shadow-md active:translate-y-0.5 transition-all border border-white/10 ${className}`}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      {label}
    </button>
  );
};

export const HardwareDeck: React.FC<HardwareDeckProps> = ({
  teamA,
  teamB,
  gameState,
  onAction,
  onGameClock,
  onPossession,
  onNextPeriod
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const sendSignal = (cmd: string, payload: any, callback: () => void) => {
    if (navigator.vibrate) navigator.vibrate(50);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logLine = `[${timestamp}] TX >> ${cmd}`;
    setLogs(prev => [...prev.slice(-4), logLine]);
    callback();
  };

  // --- FIX 1: Correctly format time from the GameState object ---
  const formattedTime = `${gameState.gameTime.minutes.toString().padStart(2, '0')}:${gameState.gameTime.seconds.toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1a1a1a] text-white select-none overflow-hidden font-sans fixed inset-0" style={{ backgroundImage: 'radial-gradient(circle at center, #2a2a2a 0%, #1a1a1a 100%)' }}>
      
      {/* === TOP SCREEN === */}
      <div className="h-1/3 bg-black border-b-4 border-zinc-800 relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 bg-[url('/scanlines.png')] opacity-10 pointer-events-none"></div>
        <div className="flex-1 flex items-center justify-between px-8 py-4 relative z-10">
          {/* Home Score */}
          <div className="flex flex-col items-center">
            <span className="text-green-500 font-bold text-xl tracking-wider uppercase mb-2">HOME</span>
            <span className="text-7xl font-black text-green-400 font-mono">{teamA.score.toString().padStart(3, '0')}</span>
            <div className="flex gap-4 mt-2 text-green-300 text-sm font-semibold">
              <span>FOULS {teamA.fouls}</span>
              <span>TIME OUT {teamA.timeouts}</span>
            </div>
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center">
            <span className="text-blue-400 font-bold text-xl tracking-wider uppercase mb-4">PERIOD {gameState.period}</span>
            {/* Display the Fixed Formatted Time */}
            <span className="text-8xl font-black text-white font-mono tracking-tight tabular-nums">{formattedTime}</span>
            <span className="text-yellow-400 font-bold text-2xl tracking-wider uppercase mt-4">SHOT CLOCK {gameState.shotClock}</span>
          </div>

          {/* Guest Score */}
          <div className="flex flex-col items-center">
            <span className="text-red-500 font-bold text-xl tracking-wider uppercase mb-2">GUEST</span>
            <span className="text-7xl font-black text-red-400 font-mono">{teamB.score.toString().padStart(3, '0')}</span>
            <div className="flex gap-4 mt-2 text-red-300 text-sm font-semibold">
              <span>FOULS {teamB.fouls}</span>
              <span>TIME OUT {teamB.timeouts}</span>
            </div>
          </div>
        </div>
      </div>

      {/* === CONTROL PANEL === */}
      <div className="flex-1 grid grid-cols-3 p-6 gap-8 relative z-10">
        
        {/* === HOME CONTROLS (LEFT) === */}
        <div className="flex flex-col gap-6 p-6 bg-zinc-900/50 rounded-3xl border-2 border-zinc-700/50 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-600 to-green-400"></div>
          <h3 className="text-center text-green-400 font-bold text-2xl uppercase tracking-wider">HOME</h3>
          
          <div className="flex items-center justify-between bg-zinc-800/50 p-4 rounded-xl">
            <span className="font-bold text-xl">SCORE</span>
            <div className="flex gap-4">
              <ScoreCircleBtn label="+1" color="green" onClick={() => sendSignal("HOME_SCORE_+1", { v: 1 }, () => onAction('A', 'points', 1))} />
              <ScoreCircleBtn label="-1" color="green" onClick={() => sendSignal("HOME_SCORE_-1", { v: -1 }, () => onAction('A', 'points', -1))} />
            </div>
          </div>
          <div className="flex items-center justify-between bg-zinc-800/50 p-4 rounded-xl">
            <span className="font-bold text-xl">POINTS</span>
            <div className="flex gap-4">
               {/* Fixed Logic: Assuming these are meant to be bigger jumps like +2/+3 or just generic adders */}
              <ScoreCircleBtn label="+2" color="green" onClick={() => sendSignal("HOME_SCORE_+2", { v: 2 }, () => onAction('A', 'points', 2))} />
              <ScoreCircleBtn label="+3" color="green" onClick={() => sendSignal("HOME_SCORE_+3", { v: 3 }, () => onAction('A', 'points', 3))} />
            </div>
          </div>

          <div className="flex gap-4 mt-auto">
            <RectBtn label="FOULS" color="green" onClick={() => sendSignal("HOME_FOUL", {}, () => onAction('A', 'foul', 1))} className="flex-1" />
            <RectBtn label="TIME OUTS" color="green" onClick={() => sendSignal("HOME_TIMEOUT", {}, () => onAction('A', 'timeout', 1))} className="flex-1" />
          </div>
          <RectBtn label="EDIT" icon={<Pencil />} onClick={() => {}} className="w-full" />
        </div>

        {/* === CENTER CONTROLS === */}
        <div className="flex flex-col items-center justify-center gap-8 relative">
          <div className="flex items-center gap-4 p-2 bg-zinc-900/80 rounded-full border-2 border-zinc-700/50 shadow-lg">
            <span className="font-bold text-lg ml-4">POSS</span>
            <button onClick={() => sendSignal("TOGGLE_POSS", {}, onPossession)} className="relative w-32 h-12 bg-black rounded-full flex items-center justify-between px-2 border-2 border-blue-500/50 shadow-inner overflow-hidden">
              <div className={`absolute top-1 left-1 w-14 h-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 shadow-md transition-all ${gameState.possession === 'B' ? 'translate-x-16' : ''}`}></div>
              <ArrowLeftRight className="w-6 h-6 text-white/50 relative z-10" />
              <ArrowLeftRight className="w-6 h-6 text-white/50 relative z-10" />
            </button>
          </div>

          <button
            onClick={() => sendSignal("CLOCK_TOGGLE", { s: !gameState.gameRunning }, () => onGameClock('toggle'))}
            className={`w-48 h-48 rounded-full bg-gradient-to-b ${gameState.gameRunning ? 'from-red-600 to-red-800' : 'from-green-600 to-green-800'} border-4 border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center active:scale-95 transition-all relative`}
          >
            <div className="absolute inset-0 rounded-full bg-black/20"></div>
            {gameState.gameRunning ? <Pause className="w-20 h-20 text-white relative z-10" fill="currentColor" /> : <Play className="w-20 h-20 text-white relative z-10" fill="currentColor" ml-2 />}
            <span className="font-bold text-xl mt-2 relative z-10">{gameState.gameRunning ? 'STOP' : 'START'}</span>
          </button>

          <RectBtn label="NEXT QUARTER" icon={<ChevronRight />} onClick={() => sendSignal("NEXT_PERIOD", {}, onNextPeriod)} className="w-full max-w-xs py-4 text-lg" />
        </div>

        {/* === GUEST CONTROLS (RIGHT) === */}
        <div className="flex flex-col gap-6 p-6 bg-zinc-900/50 rounded-3xl border-2 border-zinc-700/50 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-red-400"></div>
          <h3 className="text-center text-red-400 font-bold text-2xl uppercase tracking-wider">GUEST</h3>
          
          <div className="flex items-center justify-between bg-zinc-800/50 p-4 rounded-xl">
            <span className="font-bold text-xl">SCORE</span>
            <div className="flex gap-4">
              <ScoreCircleBtn label="+1" color="red" onClick={() => sendSignal("GUEST_SCORE_+1", { v: 1 }, () => onAction('B', 'points', 1))} />
              <ScoreCircleBtn label="-1" color="red" onClick={() => sendSignal("GUEST_SCORE_-1", { v: -1 }, () => onAction('B', 'points', -1))} />
            </div>
          </div>
          <div className="flex items-center justify-between bg-zinc-800/50 p-4 rounded-xl">
            <span className="font-bold text-xl">POINTS</span>
            <div className="flex gap-4">
              <ScoreCircleBtn label="+2" color="red" onClick={() => sendSignal("GUEST_SCORE_+2", { v: 2 }, () => onAction('B', 'points', 2))} />
              <ScoreCircleBtn label="+3" color="red" onClick={() => sendSignal("GUEST_SCORE_+3", { v: 3 }, () => onAction('B', 'points', 3))} />
            </div>
          </div>

          <div className="flex gap-4 mt-auto">
            <RectBtn label="FOULS" color="red" onClick={() => sendSignal("GUEST_FOUL", {}, () => onAction('B', 'foul', 1))} className="flex-1" />
            <RectBtn label="TIME OUTS" color="red" onClick={() => sendSignal("GUEST_TIMEOUT", {}, () => onAction('B', 'timeout', 1))} className="flex-1" />
          </div>
          <RectBtn label="EDIT" icon={<Pencil />} onClick={() => {}} className="w-full" />
        </div>
      </div>

      {/* === SERIAL OUT (DEBUG) === */}
      <div className="h-12 bg-black/80 border-t border-zinc-800 p-1 font-mono text-[10px] leading-tight opacity-70 fixed bottom-0 w-full z-20">
        <div className="flex flex-col justify-end h-full text-green-500">
          {logs.map((log, i) => (
            <div key={i} className="truncate border-l-2 border-green-500 pl-2">{log}</div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};