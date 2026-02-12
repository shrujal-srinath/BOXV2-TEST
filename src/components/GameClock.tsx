import React, { useEffect } from 'react';
import type { TeamData, GameState } from '../types';

interface ControlDeckProps {
  teamA: TeamData;
  teamB: TeamData;
  gameState: GameState;
  onAction: (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => void;
  onGameClock: (action: 'start' | 'stop' | 'toggle' | 'adjust', value?: number) => void;
  onShotClock: (action: 'reset-24' | 'reset-14' | 'start' | 'stop') => void;
  onPossession: () => void;
  onUndo: () => void;
  onHorn: () => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  teamA,
  teamB,
  gameState,
  onAction,
  onGameClock,
  onShotClock,
  onPossession,
  onUndo,
  onHorn
}) => {

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (document.activeElement?.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ': // Spacebar -> Toggle Clock
          e.preventDefault();
          onGameClock('toggle');
          break;
        case 'Enter': // Enter -> Reset 24 & Start (Common workflow)
          e.preventDefault();
          onShotClock('reset-24');
          break;
        case 'r': // r -> Reset 14
        case 'R':
          onShotClock('reset-14');
          break;
        case 'p': // p -> Possession
        case 'P':
          onPossession();
          break;
        case 'z': // z -> Undo
        case 'Z':
          onUndo();
          break;
        case 'h': // h -> Horn
        case 'H':
          onHorn();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onGameClock, onShotClock, onPossession, onUndo, onHorn]);

  return (
    <div className="bg-zinc-950 border-t-4 border-zinc-900 p-4 shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] relative z-40">
      <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-4 lg:gap-8 h-full">

        {/* === ZONE 1: TEAM A (HOME) === */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-1 mb-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{teamA.name}</span>
            {teamA.fouls >= 5 && <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 rounded animate-pulse">BONUS</span>}
          </div>

          {/* Points Array */}
          <div className="grid grid-cols-3 gap-1.5 h-20">
            <TactileBtn label="+1" color={teamA.color} onClick={() => onAction('A', 'points', 1)} />
            <TactileBtn label="+2" color={teamA.color} onClick={() => onAction('A', 'points', 2)} />
            <TactileBtn label="+3" color={teamA.color} onClick={() => onAction('A', 'points', 3)} />
          </div>

          {/* Admin Row */}
          <div className="grid grid-cols-2 gap-1.5">
            <AdminBtn label="FOUL" value={teamA.fouls} type="danger" onClick={() => onAction('A', 'foul', 1)} />
            <AdminBtn label="TIMEOUT" value={teamA.timeouts} type="warning" onClick={() => onAction('A', 'timeout', -1)} />
          </div>
        </div>

        {/* === ZONE 2: CHRONOMETER (CENTER) === */}
        <div className="col-span-6 bg-zinc-900/50 rounded-xl border border-zinc-800 p-3 flex flex-col gap-3 relative overflow-hidden">
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>

          <div className="flex-1 grid grid-cols-12 gap-3 relative z-10">

            {/* Game Clock Controls */}
            <div className="col-span-4 flex flex-col gap-2">
              <div className="text-[9px] font-bold text-zinc-500 text-center uppercase tracking-widest">Game Clock</div>
              <button
                onClick={() => onGameClock('toggle')}
                className={`flex-1 rounded-lg border-2 transition-all flex flex-col items-center justify-center shadow-lg active:scale-95 ${gameState.gameRunning ? 'bg-red-900/20 border-red-600/50 hover:bg-red-900/40 text-red-500' : 'bg-green-900/20 border-green-600/50 hover:bg-green-900/40 text-green-500'}`}
              >
                <span className="text-2xl">{gameState.gameRunning ? '⏸' : '▶'}</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{gameState.gameRunning ? 'STOP' : 'START'}</span>
              </button>
              <div className="grid grid-cols-2 gap-1">
                <PrecisionBtn label="+1s" onClick={() => onGameClock('adjust', 1)} />
                <PrecisionBtn label="-1s" onClick={() => onGameClock('adjust', -1)} />
              </div>
            </div>

            {/* Shot Clock Controls */}
            <div className="col-span-4 flex flex-col gap-2 border-x border-zinc-800 px-3">
              <div className="text-[9px] font-bold text-zinc-500 text-center uppercase tracking-widest">Shot Clock</div>
              <div className="grid grid-cols-1 gap-2 flex-1">
                <button onClick={() => onShotClock('reset-24')} className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded font-black text-xl shadow-md active:scale-95 transition-all">24</button>
                <button onClick={() => onShotClock('reset-14')} className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded font-black text-xl shadow-md active:scale-95 transition-all">14</button>
              </div>
            </div>

            {/* Admin / Possession */}
            <div className="col-span-4 flex flex-col gap-2">
              <div className="text-[9px] font-bold text-zinc-500 text-center uppercase tracking-widest">Possession</div>
              <button
                onClick={onPossession}
                className="flex-1 bg-black border border-zinc-700 rounded-lg flex items-center justify-center gap-2 hover:border-white transition-all group active:scale-95"
              >
                <span className={`text-2xl transition-colors ${gameState.possession === 'A' ? 'text-white' : 'text-zinc-800'}`}>◀</span>
                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-white">SWAP</span>
                <span className={`text-2xl transition-colors ${gameState.possession === 'B' ? 'text-white' : 'text-zinc-800'}`}>▶</span>
              </button>
              <button onClick={onHorn} className="h-8 bg-zinc-800 hover:bg-white hover:text-black border border-zinc-600 text-zinc-400 rounded text-[10px] font-black uppercase tracking-widest transition-colors active:scale-95">
                📣 SIREN
              </button>
            </div>
          </div>
        </div>

        {/* === ZONE 3: TEAM B (GUEST) === */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-1 mb-1 flex-row-reverse">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{teamB.name}</span>
            {teamB.fouls >= 5 && <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 rounded animate-pulse">BONUS</span>}
          </div>

          {/* Points Array */}
          <div className="grid grid-cols-3 gap-1.5 h-20">
            <TactileBtn label="+3" color={teamB.color} onClick={() => onAction('B', 'points', 3)} />
            <TactileBtn label="+2" color={teamB.color} onClick={() => onAction('B', 'points', 2)} />
            <TactileBtn label="+1" color={teamB.color} onClick={() => onAction('B', 'points', 1)} />
          </div>

          {/* Admin Row */}
          <div className="grid grid-cols-2 gap-1.5">
            <AdminBtn label="TIMEOUT" value={teamB.timeouts} type="warning" onClick={() => onAction('B', 'timeout', -1)} />
            <AdminBtn label="FOUL" value={teamB.fouls} type="danger" onClick={() => onAction('B', 'foul', 1)} />
          </div>
        </div>

      </div>

      {/* Global Admin Strip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 opacity-50 hover:opacity-100 transition-opacity">
        <button onClick={onUndo} className="px-4 py-1 bg-zinc-900 border border-zinc-700 rounded text-[9px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 uppercase tracking-widest">
          ↶ Undo Last (Z)
        </button>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS for Industrial Look ---

const TactileBtn = ({ label, color, onClick }: any) => (
  <button
    onClick={(e) => {
      // Visual ripple effect logic could go here
      onClick(e);
    }}
    className="h-full rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-500 transition-all active:scale-95 active:bg-white group relative overflow-hidden shadow-sm"
    style={{ borderBottom: `3px solid ${color}` }}
  >
    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
    <span className="relative z-10 text-xl font-black italic text-white group-active:text-black">{label}</span>
  </button>
);

const AdminBtn = ({ label, value, type, onClick }: any) => {
  const styles: any = {
    danger: "text-red-500 border-red-900/30 hover:bg-red-900/20",
    warning: "text-yellow-500 border-yellow-900/30 hover:bg-yellow-900/20"
  };

  return (
    <button onClick={onClick} className={`h-10 rounded bg-black border ${styles[type]} flex items-center justify-between px-3 transition-all active:scale-95 group`}>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">{label}</span>
      <span className="font-mono font-bold text-lg">{value}</span>
    </button>
  );
};

const PrecisionBtn = ({ label, onClick }: any) => (
  <button onClick={onClick} className="bg-black border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-white rounded text-[9px] font-bold uppercase py-1 active:bg-zinc-800">
    {label}
  </button>
);