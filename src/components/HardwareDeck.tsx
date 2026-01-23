import React, { useState, useEffect, useRef } from 'react';
import type { TeamData, GameState } from '../types';

interface HardwareDeckProps {
  teamA: TeamData;
  teamB: TeamData;
  gameState: GameState;
  onAction: (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => void;
  onGameClock: (action: 'toggle' | 'reset', value?: any) => void;
  onShotClock: (action: 'reset-24' | 'reset-14') => void;
  onPossession: () => void;
}

export const HardwareDeck: React.FC<HardwareDeckProps> = ({
  teamA,
  teamB,
  gameState,
  onAction,
  onGameClock,
  onShotClock,
  onPossession
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the terminal log
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- SIGNAL GENERATOR ---
  const sendSignal = (cmd: string, payload: any, callback: () => void) => {
    // 1. Haptic Feedback (The "Click" Feel)
    if (navigator.vibrate) navigator.vibrate(50);

    // 2. Serial Monitor Log
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logLine = `[${timestamp}] TX >> ${cmd} : ${JSON.stringify(payload)}`;
    setLogs(prev => [...prev.slice(-8), logLine]); // Keep last 8 lines

    // 3. Execute Logic
    callback();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-white select-none overflow-hidden font-mono">
      
      {/* === TOP PANEL: CONTROLS === */}
      <div className="flex-1 grid grid-cols-12 gap-2 p-2">
        
        {/* TEAM A (RED) */}
        <div className="col-span-4 flex flex-col gap-2 border border-zinc-800 p-2 rounded bg-zinc-900/50">
          <div className="text-center font-black text-red-500 tracking-widest border-b border-zinc-800 pb-1 mb-1">{teamA.name.toUpperCase()}</div>
          <div className="grid grid-cols-2 gap-2 flex-1">
             <HardwareBtn color="red" label="+1" onClick={() => sendSignal("SCORE_A_1", {v:1}, () => onAction('A', 'points', 1))} />
             <HardwareBtn color="red" label="+2" onClick={() => sendSignal("SCORE_A_2", {v:2}, () => onAction('A', 'points', 2))} />
             <HardwareBtn color="red" label="+3" onClick={() => sendSignal("SCORE_A_3", {v:3}, () => onAction('A', 'points', 3))} />
             <HardwareBtn color="zinc" label="UNDO" onClick={() => sendSignal("SCORE_A_UNDO", {v:-1}, () => onAction('A', 'points', -1))} />
          </div>
          <div className="grid grid-cols-2 gap-2 h-16">
             <HardwareBtn color="zinc" label="FOUL" onClick={() => sendSignal("FOUL_A", {}, () => onAction('A', 'foul', 1))} />
             <HardwareBtn color="zinc" label="T.O." onClick={() => sendSignal("TO_A", {}, () => onAction('A', 'timeout', 1))} />
          </div>
        </div>

        {/* CENTER (ADMIN) */}
        <div className="col-span-4 flex flex-col gap-2 p-1">
           {/* Master Clock Switch */}
           <button 
             onClick={() => sendSignal("CLOCK_TOGGLE", {s: !gameState.gameRunning}, () => onGameClock('toggle'))}
             className={`flex-1 rounded border-4 ${gameState.gameRunning ? 'border-red-600 bg-red-900/20 text-red-500' : 'border-green-600 bg-green-900/20 text-green-500'} font-black text-3xl tracking-widest uppercase active:scale-95 transition-transform`}
           >
             {gameState.gameRunning ? 'STOP' : 'START'}
           </button>

           <div className="grid grid-cols-2 gap-2 h-24">
              <HardwareBtn color="yellow" label="24s" onClick={() => sendSignal("RST_24", {}, () => onShotClock('reset-24'))} />
              <HardwareBtn color="orange" label="14s" onClick={() => sendSignal("RST_14", {}, () => onShotClock('reset-14'))} />
           </div>
           
           <HardwareBtn color="blue" label={gameState.possession === 'A' ? "< POSS" : "POSS >"} onClick={() => sendSignal("POSS_SW", {}, onPossession)} />
        </div>

        {/* TEAM B (BLUE) */}
        <div className="col-span-4 flex flex-col gap-2 border border-zinc-800 p-2 rounded bg-zinc-900/50">
          <div className="text-center font-black text-blue-500 tracking-widest border-b border-zinc-800 pb-1 mb-1">{teamB.name.toUpperCase()}</div>
          <div className="grid grid-cols-2 gap-2 flex-1">
             <HardwareBtn color="blue" label="+1" onClick={() => sendSignal("SCORE_B_1", {v:1}, () => onAction('B', 'points', 1))} />
             <HardwareBtn color="blue" label="+2" onClick={() => sendSignal("SCORE_B_2", {v:2}, () => onAction('B', 'points', 2))} />
             <HardwareBtn color="blue" label="+3" onClick={() => sendSignal("SCORE_B_3", {v:3}, () => onAction('B', 'points', 3))} />
             <HardwareBtn color="zinc" label="UNDO" onClick={() => sendSignal("SCORE_B_UNDO", {v:-1}, () => onAction('B', 'points', -1))} />
          </div>
          <div className="grid grid-cols-2 gap-2 h-16">
             <HardwareBtn color="zinc" label="FOUL" onClick={() => sendSignal("FOUL_B", {}, () => onAction('B', 'foul', 1))} />
             <HardwareBtn color="zinc" label="T.O." onClick={() => sendSignal("TO_B", {}, () => onAction('B', 'timeout', 1))} />
          </div>
        </div>
      </div>

      {/* === BOTTOM PANEL: SERIAL MONITOR === */}
      <div className="h-32 bg-black border-t-4 border-zinc-800 p-2 text-xs font-mono shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
        <div className="flex justify-between border-b border-zinc-800 pb-1 mb-1 text-zinc-500">
           <span>SERIAL OUT [9600 BAUD]</span>
           <span className={navigator.onLine ? "text-green-500" : "text-red-500"}>
             {navigator.onLine ? "● ONLINE (SYNC READY)" : "● OFFLINE (LOCAL MODE)"}
           </span>
        </div>
        <div className="flex flex-col justify-end text-green-500/90 leading-tight">
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

// Reusable Button Component
const HardwareBtn = ({ color, label, onClick }: any) => {
  const styles: any = {
    red: "bg-red-800 hover:bg-red-700 active:bg-red-600 border-b-4 border-red-950 active:border-b-0 active:translate-y-1 active:mt-1",
    blue: "bg-blue-800 hover:bg-blue-700 active:bg-blue-600 border-b-4 border-blue-950 active:border-b-0 active:translate-y-1 active:mt-1",
    yellow: "bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 active:mt-1 text-black",
    orange: "bg-orange-600 hover:bg-orange-500 active:bg-orange-400 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 active:mt-1 text-black",
    zinc: "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border-b-4 border-black active:border-b-0 active:translate-y-1 active:mt-1 text-zinc-400",
  };
  return (
    <button onClick={onClick} className={`w-full h-full rounded text-xl font-bold uppercase transition-all ${styles[color] || styles.zinc}`}>
      {label}
    </button>
  );
};