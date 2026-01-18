import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame } from '../services/gameService';
import type { BasketballGame, TeamData, Player } from '../types';

export const GameSetup: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackStats, setTrackStats] = useState(true);

  // Game Info
  const [gameName, setGameName] = useState("LEAGUE MATCH 01");
  const [teamAName, setTeamAName] = useState("HOME");
  const [teamBName, setTeamBName] = useState("GUEST");
  const [teamAColor, setTeamAColor] = useState("#DC2626"); // Pro Red
  const [teamBColor, setTeamBColor] = useState("#2563EB"); // Pro Blue

  // Roster
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');
  const [rosterA, setRosterA] = useState<Player[]>([]);
  const [rosterB, setRosterB] = useState<Player[]>([]);

  // Input State
  const [pName, setPName] = useState("");
  const [pNumber, setPNumber] = useState("");
  const [pPos, setPPos] = useState("G");

  const addPlayer = () => {
    if (!pName || !pNumber) return;
    const newPlayer: Player = {
      id: `p-${Date.now()}`,
      name: pName.toUpperCase(),
      number: pNumber,
      position: pPos,
      points: 0,
      fouls: 0
    };
    
    // Sort by number for clean list
    const sorter = (a: Player, b: Player) => parseInt(a.number) - parseInt(b.number);

    if (activeTab === 'A') setRosterA([...rosterA, newPlayer].sort(sorter));
    else setRosterB([...rosterB, newPlayer].sort(sorter));
    
    setPName("");
    setPNumber("");
    // Keep focus on Number input for rapid entry
    document.getElementById('playerNumInput')?.focus();
  };

  const removePlayer = (team: 'A' | 'B', id: string) => {
    if (team === 'A') setRosterA(rosterA.filter(p => p.id !== id));
    else setRosterB(rosterB.filter(p => p.id !== id));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const gameCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newGame: BasketballGame = {
      hostId: "host-user",
      code: gameCode,
      gameType: "standard",
      sport: "basketball",
      status: "live",
      settings: { gameName, periodDuration: 10, shotClockDuration: 24, periodType: "quarter" },
      teamA: { name: teamAName, color: teamAColor, score: 0, timeouts: 7, fouls: 0, players: trackStats ? rosterA : [] } as TeamData,
      teamB: { name: teamBName, color: teamBColor, score: 0, timeouts: 7, fouls: 0, players: trackStats ? rosterB : [] } as TeamData,
      gameState: { period: 1, gameTime: { minutes: 10, seconds: 0, tenths: 0 }, shotClock: 24.0, possession: 'A', gameRunning: false, shotClockRunning: false },
      lastUpdate: Date.now()
    };

    await createGame(gameCode, newGame);
    navigate(`/host/${gameCode}`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans flex items-center justify-center">
      <div className="max-w-5xl w-full bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden rounded-xl">
        
        {/* HEADER */}
        <div className="bg-black p-6 border-b border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <h1 className="text-xl font-bold tracking-[0.2em] uppercase text-zinc-400">System Setup // <span className="text-white">{step === 1 ? "Configuration" : "Roster Entry"}</span></h1>
          </div>
          <div className="text-xs font-mono text-zinc-600">BOX_V2_BUILD_2025</div>
        </div>

        {/* === STEP 1: CONFIGURATION === */}
        {step === 1 && (
          <div className="p-8 space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Col */}
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-zinc-500 tracking-widest mb-2 block">MATCH IDENTIFIER</label>
                  <input 
                    value={gameName} onChange={(e) => setGameName(e.target.value)}
                    className="w-full bg-black border border-zinc-700 p-3 text-lg font-mono text-white focus:border-white focus:outline-none transition-colors"
                  />
                </div>
                
                <div className="flex items-center gap-4 p-4 border border-zinc-800 bg-black/20">
                  <input 
                    type="checkbox" 
                    checked={trackStats} 
                    onChange={(e) => setTrackStats(e.target.checked)}
                    className="w-5 h-5 accent-white cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-sm uppercase tracking-wide">Detailed Stats Mode</div>
                    <div className="text-xs text-zinc-500">Enable individual player tracking (Points/Fouls)</div>
                  </div>
                </div>
              </div>

              {/* Right Col: Teams */}
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-zinc-500 tracking-widest mb-2 block">HOME TEAM</label>
                    <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} className="w-full bg-black border-l-4 border-l-red-600 border-zinc-700 p-3 font-bold uppercase text-white" />
                  </div>
                  <input type="color" value={teamAColor} onChange={(e) => setTeamAColor(e.target.value)} className="h-[50px] w-[50px] bg-transparent cursor-pointer border-none" />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-zinc-500 tracking-widest mb-2 block">AWAY TEAM</label>
                    <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} className="w-full bg-black border-l-4 border-l-blue-600 border-zinc-700 p-3 font-bold uppercase text-white" />
                  </div>
                  <input type="color" value={teamBColor} onChange={(e) => setTeamBColor(e.target.value)} className="h-[50px] w-[50px] bg-transparent cursor-pointer border-none" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-800 flex justify-end">
              <button onClick={() => trackStats ? setStep(2) : handleSubmit()} className="bg-white text-black px-8 py-3 font-bold hover:bg-zinc-200 transition-colors uppercase tracking-widest text-sm rounded-sm">
                {trackStats ? "Next: Rosters" : "Initialize System"} &rarr;
              </button>
            </div>
          </div>
        )}

        {/* === STEP 2: ROSTER ENTRY === */}
        {step === 2 && (
          <div className="flex h-[600px] animate-in fade-in duration-300">
            {/* LEFT: INPUT PANEL */}
            <div className="w-1/3 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col">
              <div className="flex gap-1 mb-6 bg-zinc-900 p-1 border border-zinc-800">
                <button onClick={() => setActiveTab('A')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide ${activeTab === 'A' ? 'bg-zinc-800 text-white border-b-2' : 'text-zinc-600 hover:text-zinc-300'}`} style={{ borderColor: activeTab === 'A' ? teamAColor : 'transparent' }}>
                  {teamAName}
                </button>
                <button onClick={() => setActiveTab('B')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide ${activeTab === 'B' ? 'bg-zinc-800 text-white border-b-2' : 'text-zinc-600 hover:text-zinc-300'}`} style={{ borderColor: activeTab === 'B' ? teamBColor : 'transparent' }}>
                  {teamBName}
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] font-bold text-zinc-600 mb-1 block">#</label>
                    <input id="playerNumInput" value={pNumber} onChange={(e) => setPNumber(e.target.value)} className="w-full bg-black border border-zinc-700 p-2 text-center font-mono text-white focus:border-white outline-none" placeholder="00" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] font-bold text-zinc-600 mb-1 block">POS</label>
                    <select value={pPos} onChange={(e) => setPPos(e.target.value)} className="w-full bg-black border border-zinc-700 p-2 text-center text-white text-sm outline-none">
                      {['G','SG','SF','PF','C'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                     <label className="text-[10px] font-bold text-zinc-600 mb-1 block">SURNAME</label>
                     <input value={pName} onChange={(e) => setPName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()} className="w-full bg-black border border-zinc-700 p-2 text-white text-sm focus:border-white outline-none uppercase" placeholder="JAMES" />
                  </div>
                </div>
                <button onClick={addPlayer} disabled={!pNumber || !pName} className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white py-3 text-xs font-bold uppercase tracking-widest border border-zinc-700">
                  + Add Entry
                </button>
              </div>

              <div className="mt-auto pt-6 border-t border-zinc-900 space-y-2">
                 <button onClick={handleSubmit} className="w-full bg-green-700 hover:bg-green-600 text-white py-4 text-sm font-bold uppercase tracking-widest shadow-lg border-b-4 border-green-900 active:border-b-0 active:translate-y-1">
                   {isSubmitting ? 'Loading...' : 'Launch Console'}
                 </button>
                 <button onClick={() => setStep(1)} className="w-full text-zinc-600 hover:text-zinc-400 text-xs py-2 uppercase">Back to Config</button>
              </div>
            </div>

            {/* RIGHT: TABLE VIEW */}
            <div className="w-2/3 bg-zinc-900 p-6 overflow-y-auto">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex justify-between border-b border-zinc-800 pb-2">
                <span>Active Roster // {activeTab === 'A' ? teamAName : teamBName}</span>
                <span>{(activeTab === 'A' ? rosterA : rosterB).length} Players</span>
              </h3>
              
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-zinc-600 text-[10px] uppercase tracking-widest">
                    <th className="py-2 w-16 text-center">No.</th>
                    <th className="py-2 w-16 text-center">Pos</th>
                    <th className="py-2">Player Name</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {(activeTab === 'A' ? rosterA : rosterB).map((p) => (
                    <tr key={p.id} className="group hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 text-center font-mono text-white font-bold text-lg">{p.number}</td>
                      <td className="py-3 text-center text-zinc-500 text-xs font-bold">{p.position}</td>
                      <td className="py-3 font-bold text-zinc-300">{p.name}</td>
                      <td className="py-3 text-right">
                        <button onClick={() => removePlayer(activeTab, p.id)} className="text-zinc-600 hover:text-red-500 px-3 py-1 hover:bg-zinc-800 rounded transition-colors">
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(activeTab === 'A' ? rosterA : rosterB).length === 0 && (
                <div className="text-center py-20 text-zinc-700 text-xs uppercase tracking-widest">
                  Awaiting Input...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};