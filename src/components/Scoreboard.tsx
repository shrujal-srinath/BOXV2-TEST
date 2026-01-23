import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlayerSelectModal } from './PlayerSelectModal';
import { TimeEditModal } from './TimeEditModal';
import { ControlDeckClassic } from './ControlDeckClassic';
import { useBasketballGame } from '../hooks/useBasketballGame';

// Sound Effect
const BUZZER_URL = "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=basketball-buzzer-99662.mp3";

const formatTime = (num: number) => num.toString().padStart(2, '0');

export const Scoreboard: React.FC = () => {
  const { gameCode } = useParams(); 
  const navigate = useNavigate();
  const game = useBasketballGame(gameCode || "DEMO");
  const audioRef = useRef<HTMLAudioElement>(new Audio(BUZZER_URL));

  // --- UI STATE ---
  const [controlMode, setControlMode] = useState<'pro' | 'classic'>('pro');
  const [showHelp, setShowHelp] = useState(false);
  const [showEndGame, setShowEndGame] = useState(false);
  const [showTimeEdit, setShowTimeEdit] = useState(false);
  
  // --- LOCAL STATE ---
  const timerRef = useRef<number | null>(null);

  // --- PLAYER MODAL STATE ---
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    team: 'A' | 'B';
    type: 'points' | 'foul';
    value: number;
    label: string;
  } | null>(null);

  // ==========================================
  // 1. TIMER ENGINE (FIXED)
  // ==========================================
  
  // A. Use a Ref to hold the latest state. 
  // This allows the interval to read the latest time WITHOUT needing to restart the timer every second.
  const gameStateRef = useRef(game.gameState);

  // Keep the Ref synced with the real state
  useEffect(() => {
    gameStateRef.current = game.gameState;
  }, [game.gameState]);

  useEffect(() => {
    // Keyboard Shortcuts (Keep as is)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      switch(e.key) {
        case ' ': e.preventDefault(); game.toggleTimer(); break;
        case 'Enter': e.preventDefault(); game.resetShotClock(24); break;
        case 'r': case 'R': game.resetShotClock(14); break;
        case 'p': case 'P': game.togglePossession(); break;
        case 'h': case 'H': setShowHelp(prev => !prev); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Master Timer Loop
    if (game.gameState.gameRunning) {
      if (!timerRef.current) {
        timerRef.current = window.setInterval(() => {
          // READ FROM REF (Solves the "Stale State" issue without restarting interval)
          const currentState = gameStateRef.current; 
          
          const currentTotalSec = (currentState.gameTime.minutes * 60) + currentState.gameTime.seconds;
          const currentShotClock = currentState.shotClock;

          if (currentTotalSec > 0) {
            // 1. Decrement Game Time
            const newTotal = currentTotalSec - 1;
            
            // 2. Decrement Shot Clock (FIXED: Now we actually calculate it!)
            // Logic: Decrease only if it's above 0.
            let newShot = currentShotClock > 0 ? currentShotClock - 1 : 0;
            
            // Auto-reset Shot Clock? (Optional: Usually in basketball it just buzzes and stops, so we keep at 0)
            
            // 3. Update Both (Pass newShot instead of 0)
            game.updateGameTime(Math.floor(newTotal / 60), newTotal % 60, newShot); 

            // Optional: Auto-stop if shot clock hits 0?
            // if (currentShotClock === 1) { playHorn(); } 

          } else {
            // Game Time Expired
            game.toggleTimer(); 
            game.updateGameTime(0, 0, 0);
            playHorn();
          }
        }, 1000);
      }
    } else {
      // Clean up if paused
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // CRITICAL: We REMOVED 'game.gameState.gameTime' from dependencies to stop the "1 second freeze"
  }, [game.gameState.gameRunning]);
  

  // ==========================================
  // 2. ACTIONS & HANDLERS
  // ==========================================
  
  const copyGameLink = () => {
    const url = `${window.location.origin}/watch/${gameCode}`;
    navigator.clipboard.writeText(url);
    alert(`Spectator Link Copied: ${url}`);
  };

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameCode || "");
    alert(`Game Code Copied: ${gameCode}`);
  };

  const exportStats = () => {
    const headers = "Team,Player,Number,PTS,Fouls\n";
    const rowsA = game.teamA.players.map(p => `"${game.teamA.name}","${p.name}",${p.number},${p.points},${p.fouls}`).join("\n");
    const rowsB = game.teamB.players.map(p => `"${game.teamB.name}","${p.name}",${p.number},${p.points},${p.fouls}`).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + rowsA + "\n" + rowsB;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${game.settings.gameName}_stats.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const finalizeGame = () => {
    game.setGameTime(0, 0, 0);
    game.resetShotClock(0);
    alert("Game Ended. Final stats saved.");
    navigate('/');
  };

  const handleAction = (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => {
    if (type === 'timeout') {
       game.updateTimeouts(team, value);
       return;
    }
    if (value < 0) {
      if (type === 'points') game.updateScore(team, value);
      else game.updateFouls(team, value);
      return;
    }
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

  const handleTimeEditSave = (min: number, sec: number, shot: number) => {
    game.setGameTime(min, sec, shot);
  };

  const playHorn = () => audioRef.current.play().catch(e => console.error("Audio failed", e));
  const getPeriodName = (p: number) => p <= 4 ? `Q${p}` : `OT${p - 4}`;


  // ==========================================
  // 3. MAIN RENDER
  // ==========================================
  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col overflow-hidden">
      
      {/* --- MODALS --- */}
      <PlayerSelectModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        teamName={pendingAction?.team === 'A' ? game.teamA.name : game.teamB.name}
        color={pendingAction?.team === 'A' ? game.teamA.color : game.teamB.color}
        players={pendingAction?.team === 'A' ? game.teamA.players : game.teamB.players}
        onSelectPlayer={handlePlayerSelect}
        actionLabel={pendingAction?.label || ""}
      />

      <TimeEditModal 
        isOpen={showTimeEdit}
        onClose={() => setShowTimeEdit(false)}
        gameTime={game.gameState.gameTime}
        shotClock={game.gameState.shotClock}
        onSave={handleTimeEditSave}
      />

      {/* HELP MODAL */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 p-6 max-w-md w-full shadow-2xl rounded-xl">
            <h3 className="text-xl font-bold mb-4 uppercase tracking-widest border-b border-zinc-700 pb-2">Shortcuts</h3>
            <div className="space-y-2 text-sm text-zinc-400 font-mono">
              <div className="flex justify-between"><span>SPACE</span> <span className="text-white">Start/Stop Clock</span></div>
              <div className="flex justify-between"><span>ENTER</span> <span className="text-white">Reset Shot (24s)</span></div>
              <div className="flex justify-between"><span>R</span> <span className="text-white">Reset Shot (14s)</span></div>
              <div className="flex justify-between"><span>P</span> <span className="text-white">Possession</span></div>
              <div className="flex justify-between"><span>H</span> <span className="text-white">Horn</span></div>
            </div>
            <button onClick={() => setShowHelp(false)} className="mt-6 w-full py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-zinc-200 rounded">Close</button>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="h-16 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center px-4 lg:px-6 shrink-0 z-50 relative">
        <div className="flex items-center gap-4">
           <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-1 gap-1">
              <div className="px-3 py-1 bg-black rounded text-zinc-400 text-xs font-mono font-bold tracking-wider select-all" title="Game Code">
                {gameCode}
              </div>
              <HeaderIconBtn icon="🔗" onClick={copyGameLink} title="Copy Spectator Link" />
              <HeaderIconBtn icon="📋" onClick={copyGameCode} title="Copy Game Code" />
           </div>
           <button onClick={() => setControlMode(prev => prev === 'pro' ? 'classic' : 'pro')} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded text-[10px] font-bold uppercase tracking-widest transition-all">
             <span className="text-zinc-400 hidden md:inline">Layout:</span>
             <span className="text-white">{controlMode === 'pro' ? 'Pro' : 'Retro'}</span>
           </button>
        </div>
        <div className="flex items-center gap-2">
           <HeaderBtn icon="?" label="Help" onClick={() => setShowHelp(true)} title="Shortcuts (H)" />
           <HeaderBtn icon="⬇" label="Export" onClick={exportStats} title="Download CSV" />
           <button onClick={() => setShowEndGame(true)} className="px-4 py-1.5 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 text-red-500 hover:text-red-400 rounded text-[10px] font-bold uppercase tracking-widest transition-all">End</button>
        </div>
      </header>

      {/* --- JUMBOTRON --- */}
      <div className="flex-1 relative flex flex-col justify-center bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 to-black pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto p-4 lg:p-6">
          <div className="grid grid-cols-12 gap-4 lg:gap-8 h-full max-h-[600px] min-h-[400px]">
            
            {/* Team A Panel */}
            <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-2" style={{ background: game.teamA.color }}></div>
               <div className="flex justify-between items-start mb-2">
                 <h2 className="text-2xl lg:text-4xl font-black italic uppercase tracking-tighter text-white truncate max-w-[85%]">{game.teamA.name}</h2>
                 {game.gameState.possession === 'A' && <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_red] animate-pulse mt-2"></div>}
               </div>
               <div className="flex-1 flex items-center justify-center">
                 <div className="text-[8rem] lg:text-[11rem] font-mono font-bold leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl" style={{ textShadow: `0 0 50px ${game.teamA.color}40` }}>{game.teamA.score}</div>
               </div>
               <div className="flex justify-between items-end border-t border-zinc-800 pt-3">
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Fouls</div>
                    <div className="text-4xl font-mono font-bold text-red-500 tabular-nums">{game.teamA.fouls}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Timeouts ({game.teamA.timeouts})</div>
                    <div className="flex gap-1.5">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-3 h-5 rounded-sm transition-all ${i < game.teamA.timeouts ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-zinc-800/50'}`}></div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>

            {/* Center Clock Tower */}
            <div className="col-span-4 flex flex-col gap-4 relative z-20">
               <div className="flex-1 bg-black border-2 border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                  <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em] mb-2 z-10">Game Time</div>
                  <div className={`relative z-10 flex items-baseline gap-1 transition-colors duration-300 ${game.gameState.gameRunning ? 'text-white' : 'text-zinc-400'}`}>
                    <span className="text-[6rem] lg:text-[8.5rem] font-mono font-bold leading-none tracking-tight tabular-nums drop-shadow-xl">
                      {formatTime(game.gameState.gameTime.minutes)}:{formatTime(game.gameState.gameTime.seconds)}
                    </span>
                  </div>
               </div>
               
               <div className="h-40 grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm">
                     <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Period</span>
                     <span className="text-6xl font-black italic text-white">{getPeriodName(game.gameState.period)}</span>
                     <button onClick={() => game.setPeriod(game.gameState.period + 1)} className="mt-2 text-[9px] text-zinc-600 hover:text-white uppercase font-bold tracking-widest transition-colors">Next &rarr;</button>
                  </div>
                  <div className="bg-black border-2 border-zinc-800 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-lg">
                     <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Shot Clock</span>
                     <span className={`text-7xl font-mono font-bold leading-none relative z-10 tabular-nums ${game.gameState.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                        {game.gameState.shotClock}
                     </span>
                  </div>
               </div>
            </div>

            {/* Team B Panel */}
            <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-full h-2" style={{ background: game.teamB.color }}></div>
               <div className="flex justify-between items-start mb-2 flex-row-reverse">
                 <h2 className="text-2xl lg:text-4xl font-black italic uppercase tracking-tighter text-white truncate max-w-[85%] text-right">{game.teamB.name}</h2>
                 {game.gameState.possession === 'B' && <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_red] animate-pulse mt-2"></div>}
               </div>
               <div className="flex-1 flex items-center justify-center">
                 <div className="text-[8rem] lg:text-[11rem] font-mono font-bold leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl" style={{ textShadow: `0 0 50px ${game.teamB.color}40` }}>{game.teamB.score}</div>
               </div>
               <div className="flex justify-between items-end border-t border-zinc-800 pt-3 flex-row-reverse">
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Fouls</div>
                    <div className="text-4xl font-mono font-bold text-red-500 tabular-nums">{game.teamB.fouls}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Timeouts ({game.teamB.timeouts})</div>
                    <div className="flex gap-1.5 flex-row-reverse">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-3 h-5 rounded-sm transition-all ${i < game.teamB.timeouts ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-zinc-800/50'}`}></div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* --- CONTROL DECK AREA --- */}
      {controlMode === 'pro' ? (
        <div className="bg-zinc-950 border-t-4 border-zinc-900 p-4 shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] relative z-40">
           <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-4 h-full pt-2">
              
              {/* Pro: Team A */}
              <div className="col-span-3 flex flex-col gap-2">
                 <div className="flex justify-between items-center pb-1 border-b border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate pl-2">{game.teamA.name}</span>
                 </div>
                 <div className="grid grid-cols-3 gap-1 h-16">
                    <TactileBtn label="+1" color={game.teamA.color} onClick={() => handleAction('A', 'points', 1)} />
                    <TactileBtn label="+2" color={game.teamA.color} onClick={() => handleAction('A', 'points', 2)} />
                    <TactileBtn label="+3" color={game.teamA.color} onClick={() => handleAction('A', 'points', 3)} />
                 </div>
                 <div className="grid grid-cols-2 gap-1">
                    <AdminBtn label="FOUL" value={game.teamA.fouls} type="danger" onClick={() => handleAction('A', 'foul', 1)} />
                    <AdminBtn label="TIMEOUT" value={game.teamA.timeouts} type="warning" onClick={() => handleAction('A', 'timeout', -1)} />
                 </div>
              </div>

              {/* Pro: Center Console */}
              <div className="col-span-6 bg-zinc-900/50 rounded-xl border border-zinc-800 p-2 flex flex-col gap-2">
                 <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-5 flex flex-col gap-1">
                       <button onClick={game.toggleTimer} className={`flex-1 rounded border-2 transition-all flex flex-col items-center justify-center active:scale-95 shadow-lg ${game.gameState.gameRunning ? 'bg-red-900/20 border-red-600/50 hover:bg-red-900/40 text-red-500' : 'bg-green-900/20 border-green-600/50 hover:bg-green-900/40 text-green-500'}`}>
                          <span className="text-2xl font-black uppercase italic tracking-wider">{game.gameState.gameRunning ? 'STOP' : 'START'}</span>
                       </button>
                       <button onClick={() => setShowTimeEdit(true)} className="h-8 bg-black border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded text-[9px] font-bold uppercase tracking-widest transition-all">Edit Time</button>
                    </div>
                    <div className="col-span-3 flex flex-col gap-1 border-x border-zinc-800 px-2">
                       <button onClick={() => game.resetShotClock(24)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded font-black text-xl shadow-md active:scale-95">24</button>
                       <button onClick={() => game.resetShotClock(14)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded font-black text-xl shadow-md active:scale-95">14</button>
                    </div>
                    <div className="col-span-4 flex flex-col gap-1">
                       <button onClick={game.togglePossession} className="flex-1 bg-black border border-zinc-700 rounded flex items-center justify-center gap-2 hover:border-white transition-all group active:scale-95">
                          <span className={`text-xl ${game.gameState.possession === 'A' ? 'text-white' : 'text-zinc-800'}`}>◀</span>
                          <span className="text-[10px] font-bold text-zinc-500 group-hover:text-white">POSS</span>
                          <span className={`text-xl ${game.gameState.possession === 'B' ? 'text-white' : 'text-zinc-800'}`}>▶</span>
                       </button>
                       <button onClick={playHorn} className="h-8 bg-zinc-800 hover:bg-white hover:text-black border border-zinc-600 text-zinc-400 rounded text-[9px] font-black uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2">SIREN 🔊</button>
                    </div>
                 </div>
              </div>

              {/* Pro: Team B */}
              <div className="col-span-3 flex flex-col gap-2">
                 <div className="flex justify-between items-center pb-1 border-b border-zinc-800 flex-row-reverse">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{game.teamB.name}</span>
                 </div>
                 <div className="grid grid-cols-3 gap-1 h-16">
                    <TactileBtn label="+3" color={game.teamB.color} onClick={() => handleAction('B', 'points', 3)} />
                    <TactileBtn label="+2" color={game.teamB.color} onClick={() => handleAction('B', 'points', 2)} />
                    <TactileBtn label="+1" color={game.teamB.color} onClick={() => handleAction('B', 'points', 1)} />
                 </div>
                 <div className="grid grid-cols-2 gap-1">
                    <AdminBtn label="TIMEOUT" value={game.teamB.timeouts} type="warning" onClick={() => handleAction('B', 'timeout', -1)} />
                    <AdminBtn label="FOUL" value={game.teamB.fouls} type="danger" onClick={() => handleAction('B', 'foul', 1)} />
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <ControlDeckClassic 
          teamA={game.teamA} 
          teamB={game.teamB} 
          gameState={game.gameState}
          onAction={handleAction}
          onGameClock={() => {}} // Classic mode clock controls deferred for now
          onShotClock={game.resetShotClock}
          onPossession={game.togglePossession}
          onUndo={() => {}} 
          onSwitchMode={() => setControlMode('pro')} 
        />
      )}

    </div>
  );
};

// --- HELPER COMPONENTS ---
const HeaderBtn = ({ icon, label, onClick, title }: any) => (
  <button onClick={onClick} title={title} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all active:scale-95">
    <span className="text-sm">{icon}</span>
    <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">{label}</span>
  </button>
);
const HeaderIconBtn = ({ icon, onClick, title }: any) => (
  <button onClick={onClick} title={title} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-all">
    <span className="text-sm">{icon}</span>
  </button>
);
const TactileBtn = ({ label, color, onClick }: any) => (
  <button onClick={onClick} className="h-full rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-500 transition-all active:scale-95 active:bg-white group relative overflow-hidden shadow-sm" style={{ borderBottom: `3px solid ${color}` }}>
    <span className="relative z-10 text-xl font-black italic text-white group-active:text-black">{label}</span>
  </button>
);
const AdminBtn = ({ label, value, type, onClick }: any) => {
  const styles: any = { danger: "text-red-500 border-red-900/30 hover:bg-red-900/20", warning: "text-yellow-500 border-yellow-900/30 hover:bg-yellow-900/20" };
  return (
    <button onClick={onClick} className={`h-8 rounded bg-black border ${styles[type]} flex items-center justify-between px-2 transition-all active:scale-95 group`}>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">{label}</span>
      <span className="font-mono font-bold text-sm">{value}</span>
    </button>
  );
};