import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { initializeNewGame } from '../services/gameService';
import { subscribeToAuth } from '../services/authService';
import { SplashScreen } from '../components/SplashScreen';
import type { Player } from '../types';
import type { User } from 'firebase/auth';

const TEAM_COLORS = [
  '#DC2626', '#2563EB', '#16A34A', '#F59E0B', '#FFFFFF', '#9333EA', '#EA580C', '#000000',
];

export const GameSetup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sportType = location.state?.sport || 'basketball';

  // --- STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [step, setStep] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  // Launch State
  const [isLaunching, setIsLaunching] = useState(false);
  const [isGameReady, setIsGameReady] = useState(false);
  const [launchedGameCode, setLaunchedGameCode] = useState("");

  // Config State
  const [editTarget, setEditTarget] = useState<'game' | 'shot' | null>(null);
  const [tempTimeValue, setTempTimeValue] = useState(0);
  const [trackStats, setTrackStats] = useState(true);
  const [gameName, setGameName] = useState("");
  const [periodType, setPeriodType] = useState<'quarter' | 'half'>('quarter');
  const [periodDuration, setPeriodDuration] = useState(10);
  const [shotClockEnabled, setShotClockEnabled] = useState(true);
  const [shotClockDuration, setShotClockDuration] = useState(24);

  // Team State
  const [teamAName, setTeamAName] = useState("");
  const [teamBName, setTeamBName] = useState("");
  const [teamAColor, setTeamAColor] = useState(TEAM_COLORS[0]);
  const [teamBColor, setTeamBColor] = useState(TEAM_COLORS[1]);
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');
  const [rosterA, setRosterA] = useState<Player[]>([]);
  const [rosterB, setRosterB] = useState<Player[]>([]);

  // Player Input State
  const [pName, setPName] = useState("");
  const [pNumber, setPNumber] = useState("");
  const [pPos, setPPos] = useState("PG");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs for UX
  const numberInputRef = useRef<HTMLInputElement>(null);

  // --- EFFECT: Load User State ---
  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // --- HANDLERS ---
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setPNumber(val);
      if (errorMsg) setErrorMsg(null); // Auto-clear error on type
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPName(e.target.value);
    if (errorMsg) setErrorMsg(null); // Auto-clear error on type
  };

  const openTimeEditor = (target: 'game' | 'shot') => {
    setEditTarget(target);
    setTempTimeValue(target === 'game' ? periodDuration : shotClockDuration);
    setShowTimeModal(true);
  };

  const saveTimeEditor = () => {
    if (editTarget === 'game') setPeriodDuration(Math.max(1, Math.min(99, tempTimeValue)));
    else if (editTarget === 'shot') setShotClockDuration(Math.max(1, Math.min(99, tempTimeValue)));
    setShowTimeModal(false);
  };

  const addPlayer = () => {
    // 1. VALIDATION CHECKS
    if (!pNumber) {
      setErrorMsg("⚠️ PLEASE ENTER A JERSEY NUMBER");
      // Optional: Focus back if they clicked button without typing
      numberInputRef.current?.focus();
      return;
    }
    if (!pName) {
      setErrorMsg("⚠️ PLEASE ENTER A PLAYER NAME");
      return;
    }

    const currentRoster = activeTab === 'A' ? rosterA : rosterB;
    if (currentRoster.some(p => p.number === pNumber)) {
      setErrorMsg(`⚠️ JERSEY #${pNumber} IS ALREADY TAKEN`);
      return;
    }

    // 2. CREATE PLAYER
    const newPlayer: Player = {
      id: `p-${Date.now()}`,
      name: pName.toUpperCase(),
      number: pNumber,
      position: pPos,
      points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, turnovers: 0,
      disqualified: false, fieldGoalsMade: 0, fieldGoalsAttempted: 0, threePointsMade: 0,
      threePointsAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0
    };

    if (activeTab === 'A') setRosterA([...rosterA, newPlayer]);
    else setRosterB([...rosterB, newPlayer]);

    // 3. RESET FORM & UX
    setPName("");
    setPNumber("");
    setErrorMsg(null);

    // Auto-focus back to number input for rapid entry
    if (numberInputRef.current) {
      numberInputRef.current.focus();
    }
  };

  const removePlayer = (team: 'A' | 'B', id: string) => {
    if (team === 'A') setRosterA(rosterA.filter(p => p.id !== id));
    else setRosterB(rosterB.filter(p => p.id !== id));
  };

  const handleLaunchRequest = () => {
    if (trackStats && (rosterA.length === 0 || rosterB.length === 0)) {
      if (!window.confirm("⚠️ Warning: One or both teams have NO players. Stats tracking will be limited. Continue?")) return;
    }
    setShowConfirmation(true);
  };

  // --- UNIFIED LAUNCH LOGIC ---
  const finalizeAndLaunch = async () => {
    setShowConfirmation(false);
    setIsLaunching(true);
    setIsGameReady(false);

    try {
      if (!currentUser) {
        throw new Error("User session not found. Please re-login.");
      }

      const gameCode = await initializeNewGame(
        {
          gameName: gameName.trim() || "LIVE MATCH",
          periodDuration,
          shotClockDuration: shotClockEnabled ? shotClockDuration : 0,
          periodType
        },
        { name: teamAName || "TEAM A", color: teamAColor, players: trackStats ? rosterA : [] },
        { name: teamBName || "TEAM B", color: teamBColor, players: trackStats ? rosterB : [] },
        trackStats,
        sportType,
        currentUser.uid
      );

      setLaunchedGameCode(gameCode);

      setTimeout(() => {
        setIsGameReady(true);
      }, 800);

    } catch (error: any) {
      console.error('[GameSetup] Launch Error:', error);
      alert(`Error creating game: ${error.message}`);
      setIsLaunching(false);
      setIsGameReady(false);
    }
  };

  const onSplashComplete = () => {
    if (launchedGameCode) {
      navigate(`/host/${launchedGameCode}`);
    }
  };

  const ColorPalette = ({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) => (
    <div className="flex gap-3 mt-4 justify-between">
      {TEAM_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={`w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${selected === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-40 hover:opacity-100'}`}
          style={{ backgroundColor: c, border: c === '#000000' ? '1px solid #333' : 'none' }}
        />
      ))}
    </div>
  );

  if (isLaunching) {
    return <SplashScreen isReady={isGameReady} onComplete={onSplashComplete} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-4 md:p-8">
      {/* Container */}
      <div className="w-full max-w-6xl bg-zinc-900 border border-zinc-800 shadow-2xl rounded-2xl overflow-hidden flex flex-col h-[90vh] max-h-[850px]">

        {/* Header */}
        <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:bg-white hover:text-black hover:border-white transition-all text-xl active:scale-95">←</button>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase italic text-white leading-none">{sportType} CONFIG</h1>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-1">
                {step === 1 ? "Step 1: Match Settings" : "Step 2: Team Rosters"}
              </div>
            </div>
          </div>
          {step === 2 && (
            <button onClick={handleLaunchRequest} className="px-8 py-3 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase tracking-widest shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all">Launch Console 🚀</button>
          )}
        </div>

        {/* Step 1 Content */}
        {step === 1 && (
          <div className="flex-1 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto bg-black/20 custom-scrollbar">
            {/* Rules Section */}
            <div className="lg:col-span-7 flex flex-col gap-8">
              {/* Match Details */}
              <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Match Details</h2>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Match Title</label>
                    <input
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      className="w-full bg-black border border-zinc-800 p-4 text-base font-bold text-white placeholder-zinc-700 outline-none rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase"
                      placeholder="E.G. CHAMPIONSHIP FINAL"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Operation Mode</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Standard Timer Button */}
                      <button onClick={() => setTrackStats(false)} className={`group relative p-5 rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${!trackStats ? 'bg-zinc-900 border-white shadow-[0_0_25px_rgba(255,255,255,0.1)]' : 'bg-black border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className={`text-3xl mb-3 transition-all ${!trackStats ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>⏱</div>
                          {!trackStats && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                        </div>
                        <div className="text-sm font-black uppercase text-white mb-1">Standard Timer</div>
                        <div className="text-[10px] text-zinc-500 font-bold leading-relaxed">Scoreboard only. No individual player tracking.</div>
                      </button>

                      {/* Pro Stats Button */}
                      <button onClick={() => setTrackStats(true)} className={`group relative p-5 rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${trackStats ? 'bg-zinc-900 border-red-500 shadow-[0_0_25px_rgba(220,38,38,0.2)]' : 'bg-black border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className={`text-3xl mb-3 transition-all ${trackStats ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'}`}>📊</div>
                          {trackStats && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                        </div>
                        <div className="text-sm font-black uppercase text-white mb-1">Pro Stats</div>
                        <div className="text-[10px] text-zinc-500 font-bold leading-relaxed">Full roster management. Track points, fouls & logs.</div>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Game Rules */}
              <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span> Rules</h2>
                <div className="grid grid-cols-2 gap-8 items-stretch">
                  <div className="flex flex-col gap-6">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Format</label>
                      <div className="flex bg-black p-1 rounded-lg border border-zinc-800 h-12">
                        <button onClick={() => setPeriodType('quarter')} className={`flex-1 text-[10px] font-bold uppercase rounded-md transition-all active:scale-95 ${periodType === 'quarter' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Quarters</button>
                        <button onClick={() => setPeriodType('half')} className={`flex-1 text-[10px] font-bold uppercase rounded-md transition-all active:scale-95 ${periodType === 'half' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Halves</button>
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 justify-end">
                      <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Period Duration (Min)</label>
                      <div className="bg-black border border-zinc-800 rounded-lg p-2 flex justify-between items-center h-16">
                        <button onClick={() => setPeriodDuration(Math.max(1, periodDuration - 1))} className="w-12 h-full bg-zinc-900 hover:bg-zinc-800 text-white rounded font-bold transition-colors text-xl active:bg-zinc-700">−</button>
                        <div className="text-2xl font-bold font-mono">{periodDuration}</div>
                        <button onClick={() => setPeriodDuration(Math.min(99, periodDuration + 1))} className="w-12 h-full bg-zinc-900 hover:bg-zinc-800 text-white rounded font-bold transition-colors text-xl active:bg-zinc-700">+</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6 pl-8 border-l border-zinc-800">
                    <div className="flex justify-between items-center h-12">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Shot Clock</span>
                      <button onClick={() => setShotClockEnabled(!shotClockEnabled)} className={`w-14 h-8 rounded-full relative transition-colors active:scale-95 ${shotClockEnabled ? 'bg-green-600' : 'bg-zinc-700'}`}>
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${shotClockEnabled ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                    <div className={`flex flex-col flex-1 justify-end transition-opacity duration-300 ${shotClockEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                      <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Shot Time (Sec)</label>
                      <div className="bg-black border border-zinc-800 rounded-lg p-2 text-center text-3xl font-bold font-mono h-16 flex items-center justify-center">{shotClockDuration}</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Teams Section */}
            <div className="lg:col-span-5 flex flex-col gap-8">
              <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 h-full flex flex-col">
                <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Teams</h2>
                <div className="flex-1 flex flex-col gap-6">
                  <div className="bg-black border border-zinc-700 p-5 rounded-xl group hover:border-zinc-500 transition-colors">
                    <label className="text-[9px] font-bold text-zinc-500 tracking-widest block uppercase mb-2">Home Team</label>
                    <div className="flex gap-4 mb-2 items-center bg-zinc-900 p-3 rounded-lg border border-zinc-800 focus-within:border-white transition-colors">
                      <div className="w-10 h-10 rounded-full border-2 border-zinc-700 shadow-sm" style={{ background: teamAColor }}></div>
                      <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} className="flex-1 bg-transparent text-lg font-bold uppercase text-white outline-none placeholder-zinc-700" placeholder="TEAM A" />
                    </div>
                    <ColorPalette selected={teamAColor} onSelect={setTeamAColor} />
                  </div>

                  <div className="flex items-center justify-center text-zinc-700 font-black italic text-lg opacity-50">VS</div>

                  <div className="bg-black border border-zinc-700 p-5 rounded-xl group hover:border-zinc-500 transition-colors">
                    <label className="text-[9px] font-bold text-zinc-500 tracking-widest block uppercase mb-2">Guest Team</label>
                    <div className="flex gap-4 mb-2 items-center bg-zinc-900 p-3 rounded-lg border border-zinc-800 focus-within:border-white transition-colors">
                      <div className="w-10 h-10 rounded-full border-2 border-zinc-700 shadow-sm" style={{ background: teamBColor }}></div>
                      <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} className="flex-1 bg-transparent text-lg font-bold uppercase text-white outline-none placeholder-zinc-700" placeholder="TEAM B" />
                    </div>
                    <ColorPalette selected={teamBColor} onSelect={setTeamBColor} />
                  </div>
                </div>
                <button
                  onClick={() => trackStats ? setStep(2) : finalizeAndLaunch()}
                  className="mt-8 w-full bg-white hover:bg-zinc-200 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                >
                  {trackStats ? "Next: Rosters" : "Initialize Console"} <span className="text-xl">→</span>
                </button>
              </section>
            </div>
          </div>
        )}

        {/* Step 2 Content - Rosters */}
        {step === 2 && (
          <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-500 bg-zinc-950">
            {/* Roster Tabs */}
            <div className="flex border-b border-zinc-800 bg-black/40 h-20 shrink-0">
              <button onClick={() => setActiveTab('A')} className={`flex-1 flex items-center justify-center gap-3 transition-colors ${activeTab === 'A' ? 'bg-zinc-900 text-white' : 'opacity-50 text-zinc-500 hover:opacity-80'}`}>
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: teamAColor }}></div>
                <span className="text-xl font-black italic uppercase">{teamAName || "TEAM A"}</span>
                <span className="text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded ml-2">{rosterA.length}</span>
              </button>
              <div className="w-[1px] bg-zinc-800"></div>
              <button onClick={() => setActiveTab('B')} className={`flex-1 flex items-center justify-center gap-3 transition-colors ${activeTab === 'B' ? 'bg-zinc-900 text-white' : 'opacity-50 text-zinc-500 hover:opacity-80'}`}>
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: teamBColor }}></div>
                <span className="text-xl font-black italic uppercase">{teamBName || "TEAM B"}</span>
                <span className="text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded ml-2">{rosterB.length}</span>
              </button>
            </div>

            {/* Roster Grid */}
            <div className="flex-1 overflow-y-auto bg-zinc-900/30 p-8 custom-scrollbar">
              {(activeTab === 'A' ? rosterA : rosterB).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-60">
                  <span className="text-6xl mb-4 grayscale opacity-30">👟</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">No Players Added</h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(activeTab === 'A' ? rosterA : rosterB).map((p) => (
                    <div key={p.id} className="bg-black border border-zinc-800 p-4 rounded-lg flex items-center gap-4 group hover:border-zinc-600 transition-colors">
                      <div className="text-3xl font-black italic text-zinc-600 group-hover:text-white transition-colors">{p.number}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase">{p.position}</div>
                        <div className="font-bold text-white uppercase text-lg truncate">{p.name}</div>
                      </div>
                      <button onClick={() => removePlayer(activeTab, p.id)} className="w-10 h-10 flex items-center justify-center text-zinc-600 hover:text-red-500 hover:bg-zinc-900 rounded-full transition-all active:scale-90 text-lg">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Player Form */}
            <div className="bg-black/90 backdrop-blur border-t border-zinc-800 p-6 z-20 shrink-0">
              <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <div className="flex items-end gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 shadow-xl">
                  <div className="w-28">
                    <label className="text-[10px] font-black text-zinc-500 mb-1.5 block tracking-widest px-1 uppercase">Jersey #</label>
                    <input
                      ref={numberInputRef}
                      value={pNumber}
                      onChange={handleNumberChange}
                      className={`w-full bg-black border border-zinc-700 p-3 text-center font-mono text-white font-bold rounded-lg outline-none text-xl focus:border-blue-500 transition-colors ${errorMsg && !pNumber ? 'border-red-500' : ''}`}
                      placeholder="00"
                    />
                  </div>
                  <div className="w-36">
                    <label className="text-[10px] font-black text-zinc-500 mb-1.5 block tracking-widest px-1 uppercase">Position</label>
                    <select value={pPos} onChange={(e) => setPPos(e.target.value)} className="w-full bg-black border border-zinc-700 p-3 text-center text-white text-sm font-bold rounded-lg outline-none h-[54px] focus:border-blue-500 transition-colors">
                      {['PG', 'SG', 'SF', 'PF', 'C'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-zinc-500 mb-1.5 block tracking-widest px-1 uppercase">Player Name</label>
                    <input
                      value={pName}
                      onChange={handleNameChange}
                      onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                      className={`w-full bg-black border border-zinc-700 p-3 text-white text-xl font-bold rounded-lg outline-none uppercase focus:border-blue-500 transition-colors ${errorMsg && !pName ? 'border-red-500' : ''}`}
                      placeholder="TYPE NAME..."
                    />
                  </div>
                  <button onClick={addPlayer} className="h-[54px] px-10 bg-white hover:scale-105 active:scale-95 text-black text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-lg">
                    + Add Player
                  </button>
                </div>
                {errorMsg && <div className="text-center text-red-500 text-xs font-bold animate-pulse">{errorMsg}</div>}
                <div className="flex justify-start pt-2">
                  <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors active:scale-95">← Return to Configuration</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      {showTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-xl p-6 relative shadow-2xl">
            <button onClick={() => setShowTimeModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">&times;</button>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 text-center">Edit Duration</h3>
            <div className="flex justify-center mb-8">
              <input type="number" value={tempTimeValue} onChange={(e) => setTempTimeValue(Number(e.target.value))} className="bg-black border-2 border-zinc-700 focus:border-blue-500 transition-colors text-center text-5xl font-mono font-bold text-white rounded-lg w-32 h-24 outline-none" autoFocus />
            </div>
            <button onClick={saveTimeEditor} className="w-full bg-white hover:bg-zinc-200 text-black font-black py-4 rounded-lg uppercase tracking-widest text-xs active:scale-[0.98] transition-all">Save Change</button>
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in zoom-in-95 duration-200">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Match Pre-Flight Check</h3>
              <button onClick={() => setShowConfirmation(false)} className="text-zinc-500 hover:text-white transition-colors">&times;</button>
            </div>
            <div className="p-8 grid grid-cols-7 gap-4 items-center bg-zinc-950">
              <div className="col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ background: teamAColor }}></div>
                <h4 className="text-2xl font-black italic text-white uppercase mb-1">{teamAName || "TEAM A"}</h4>
                <div className="text-4xl font-black text-white my-2">{rosterA.length}</div>
                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Players</div>
              </div>
              <div className="col-span-1 flex justify-center"><div className="text-xl font-black text-zinc-700 italic">VS</div></div>
              <div className="col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ background: teamBColor }}></div>
                <h4 className="text-2xl font-black italic text-white uppercase mb-1">{teamBName || "TEAM B"}</h4>
                <div className="text-4xl font-black text-white my-2">{rosterB.length}</div>
                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Players</div>
              </div>
            </div>
            <div className="p-6 bg-black border-t border-zinc-800 flex justify-end gap-4">
              <button onClick={() => setShowConfirmation(false)} className="px-6 py-3 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest active:scale-95 transition-all">Edit</button>
              <button onClick={finalizeAndLaunch} disabled={isLaunching} className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">{isLaunching ? "Booting..." : "Launch Match"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};