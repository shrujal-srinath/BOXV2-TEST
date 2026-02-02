import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { initializeNewGame } from '../services/gameService';
import { auth, subscribeToAuth } from '../services/authService'; // Updated import
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
  const [pName, setPName] = useState("");
  const [pNumber, setPNumber] = useState("");
  const [pPos, setPPos] = useState("PG");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- EFFECT: Ensure User is Loaded ---
  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      if (user) setCurrentUser(user);
      else {
        // If user logs out or isn't found, redirect to home
        navigate('/');
      }
    });
    return () => unsub();
  }, [navigate]);

  // --- HANDLERS ---

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) { setPNumber(val); setErrorMsg(null); }
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
    if (!pName || !pNumber) return;
    const currentRoster = activeTab === 'A' ? rosterA : rosterB;
    if (currentRoster.some(p => p.number === pNumber)) { setErrorMsg(`Jersey #${pNumber} is already taken!`); return; }

    const newPlayer: Player = {
      id: `p-${Date.now()}`, name: pName.toUpperCase(), number: pNumber, position: pPos,
      points: 0, fouls: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, turnovers: 0,
      disqualified: false, fieldGoalsMade: 0, fieldGoalsAttempted: 0, threePointsMade: 0,
      threePointsAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0
    };
    if (activeTab === 'A') setRosterA([...rosterA, newPlayer]);
    else setRosterB([...rosterB, newPlayer]);
    setPName(""); setPNumber("");
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

  // --- FINAL LAUNCH LOGIC (Fixed) ---
  const finalizeAndLaunch = async () => {
    // 1. Double check user to prevent "Anonymous" games
    if (!currentUser) {
      alert("System Error: User session not found. Please refresh and log in.");
      return;
    }

    // 2. Start Splash Screen
    setShowConfirmation(false);
    setIsLaunching(true);
    setIsGameReady(false); // Keeps splash at 90%

    try {
      // 3. Create Game with VALIDATED User ID
      const gameCode = await initializeNewGame(
        {
          gameName: gameName.trim() || "LEAGUE MATCH 01",
          periodDuration,
          shotClockDuration: shotClockEnabled ? shotClockDuration : 0,
          periodType
        },
        { name: teamAName || "TEAM A", color: teamAColor, players: trackStats ? rosterA : [] },
        { name: teamBName || "TEAM B", color: teamBColor, players: trackStats ? rosterB : [] },
        trackStats,
        sportType,
        currentUser.uid // <--- CRITICAL FIX: Passing verified ID
      );

      setLaunchedGameCode(gameCode);

      // 4. Game is ready, tell Splash Screen to finish
      // Small delay ensures database consistency
      setTimeout(() => {
        setIsGameReady(true);
      }, 800);

    } catch (error: any) {
      console.error("Launch Error:", error);
      alert(`Error: ${error.message}`);
      setIsLaunching(false);
    }
  };

  // Called when splash animation hits 100%
  const onSplashComplete = () => {
    if (launchedGameCode) {
      navigate(`/host/${launchedGameCode}`);
    }
  };

  const ColorPalette = ({ selected, onSelect }: any) => (
    <div className="flex gap-2 mt-3 justify-between">
      {TEAM_COLORS.map((c) => (
        <button key={c} onClick={() => onSelect(c)} className={`w-6 h-6 rounded-full transition-all ${selected === c ? 'scale-125 ring-2 ring-white' : 'opacity-50'}`} style={{ backgroundColor: c, border: c === '#000000' ? '1px solid #333' : 'none' }} />
      ))}
    </div>
  );

  // --- RENDER ---

  if (isLaunching) {
    return <SplashScreen isReady={isGameReady} onComplete={onSplashComplete} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl bg-zinc-900 border border-zinc-800 shadow-2xl rounded-2xl overflow-hidden flex flex-col h-[90vh] max-h-[850px]">
        {/* Header */}
        <div className="bg-zinc-950 border-b border-zinc-800 px-8 py-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:bg-white hover:text-black hover:border-white transition-all text-xl">←</button>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase italic text-white leading-none">{sportType} CONFIG</h1>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-1">{step === 1 ? "Step 1: Match Settings" : "Step 2: Team Rosters"}</div>
            </div>
          </div>
          {step === 2 && (
            <button onClick={handleLaunchRequest} className="px-8 py-3 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase tracking-widest shadow-lg hover:-translate-y-0.5">Launch Console 🚀</button>
          )}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto bg-black/20 custom-scrollbar">
            <div className="lg:col-span-7 flex flex-col gap-8">
              <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Match Details</h2>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Match Title</label>
                    <input value={gameName} onChange={(e) => setGameName(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 text-base font-bold text-white placeholder-zinc-700 outline-none rounded-lg focus:border-blue-500 transition-all uppercase" placeholder="E.G. CHAMPIONSHIP FINAL" />
                  </div>
                  {/* RESTORED: Operation Mode */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Operation Mode</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setTrackStats(false)} className={`p-5 rounded-lg border-2 text-left transition-all ${!trackStats ? 'bg-zinc-900 border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-black border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600'}`}>
                        <div className="text-2xl mb-3">⏱</div>
                        <div className="text-sm font-black uppercase text-white">Standard Timer</div>
                        <div className="text-[10px] text-zinc-400 mt-2 leading-relaxed">Basic Scoreboard & Clock only.</div>
                      </button>
                      <button onClick={() => setTrackStats(true)} className={`p-5 rounded-lg border-2 text-left transition-all ${trackStats ? 'bg-zinc-900 border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.15)]' : 'bg-black border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600'}`}>
                        <div className="text-2xl mb-3">📊</div>
                        <div className="text-sm font-black uppercase text-white">Pro Stats</div>
                        <div className="text-[10px] text-zinc-400 mt-2 leading-relaxed">Full Telemetry. Track Player Points, Fouls & Minutes.</div>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
              <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span> Rules</h2>
                <div className="grid grid-cols-2 gap-8 items-stretch">
                  <div className="flex flex-col gap-6">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Format</label>
                      <div className="flex bg-black p-1 rounded-lg border border-zinc-800 h-12">
                        <button onClick={() => setPeriodType('quarter')} className={`flex-1 text-[10px] font-bold uppercase rounded-md transition-all ${periodType === 'quarter' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Quarters</button>
                        <button onClick={() => setPeriodType('half')} className={`flex-1 text-[10px] font-bold uppercase rounded-md transition-all ${periodType === 'half' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Halves</button>
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 justify-end">
                      <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Period Duration (Min)</label>
                      <div className="bg-black border border-zinc-800 rounded-lg p-2">
                        <div className="flex items-center h-12 mb-1">
                          <button onClick={() => setPeriodDuration(Math.max(1, periodDuration - 1))} className="w-12 h-full bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xl font-bold transition-colors">−</button>
                          <div className="flex-1 text-center font-mono text-2xl font-bold text-white">{periodDuration}</div>
                          <button onClick={() => setPeriodDuration(Math.min(99, periodDuration + 1))} className="w-12 h-full bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xl font-bold transition-colors">+</button>
                        </div>
                        <button onClick={() => openTimeEditor('game')} className="w-full text-[9px] font-bold text-zinc-500 hover:text-blue-400 uppercase tracking-widest py-1 transition-colors">✎ Edit Time</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-6 pl-8 border-l border-zinc-800">
                    <div className="flex justify-between items-center h-12">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Shot Clock</span>
                      <button onClick={() => setShotClockEnabled(!shotClockEnabled)} className={`w-12 h-6 rounded-full relative transition-colors ${shotClockEnabled ? 'bg-green-600' : 'bg-zinc-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${shotClockEnabled ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                    <div className={`flex flex-col flex-1 justify-end transition-opacity duration-200 ${shotClockEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                      <label className="text-[10px] font-bold text-zinc-500 tracking-widest block mb-2 uppercase">Shot Time (Sec)</label>
                      <div className="bg-black border border-zinc-800 rounded-lg p-2">
                        <div className="h-12 flex items-center justify-center font-mono text-3xl font-bold text-white mb-1">{shotClockDuration}</div>
                        <button onClick={() => openTimeEditor('shot')} className="w-full text-[9px] font-bold text-zinc-500 hover:text-blue-400 uppercase tracking-widest py-1 transition-colors">✎ Edit Time</button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <div className="lg:col-span-5 flex flex-col gap-8">
              <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 h-full flex flex-col">
                <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Teams</h2>
                <div className="flex-1 flex flex-col gap-6">
                  <div className="bg-black border border-zinc-700 p-5 rounded-lg transition-all hover:border-zinc-600 group">
                    <label className="text-[9px] font-bold text-zinc-500 tracking-widest block uppercase mb-2 group-hover:text-zinc-400">Home Team</label>
                    <div className="flex gap-4 mb-4 items-center bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                      <div className="w-10 h-10 rounded-full border-2 border-zinc-700 shadow-inner" style={{ background: teamAColor }}></div>
                      <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} className="flex-1 bg-transparent text-lg font-bold uppercase text-white outline-none placeholder-zinc-700" placeholder="TEAM A" />
                    </div>
                    <ColorPalette selected={teamAColor} onSelect={setTeamAColor} />
                  </div>
                  <div className="flex items-center justify-center text-zinc-700 font-black italic text-lg">VS</div>
                  <div className="bg-black border border-zinc-800 p-5 rounded-xl transition-all hover:border-zinc-600 group">
                    <label className="text-[9px] font-bold text-zinc-500 tracking-widest block uppercase mb-2 group-hover:text-zinc-400">Guest Team</label>
                    <div className="flex gap-4 mb-4 items-center bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                      <div className="w-10 h-10 rounded-full border-2 border-zinc-700 shadow-inner" style={{ background: teamBColor }}></div>
                      <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} className="flex-1 bg-transparent text-lg font-bold uppercase text-white outline-none placeholder-zinc-700" placeholder="TEAM B" />
                    </div>
                    <ColorPalette selected={teamBColor} onSelect={setTeamBColor} />
                  </div>
                </div>
                <button onClick={() => trackStats ? setStep(2) : finalizeAndLaunch()} className="mt-8 w-full bg-white hover:bg-zinc-200 text-black font-black py-4 rounded-lg uppercase tracking-widest text-xs shadow-lg transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-3">
                  {trackStats ? "Next: Rosters" : "Initialize Console"} <span className="text-xl">→</span>
                </button>
              </section>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-500 bg-zinc-950">
            <div className="flex border-b border-zinc-800 bg-black/40 h-20 shrink-0">
              <button onClick={() => setActiveTab('A')} className={`flex-1 relative transition-all flex items-center justify-center gap-3 group ${activeTab === 'A' ? 'bg-zinc-900' : 'opacity-50'}`}>
                <div className="w-3 h-3 rounded-full shadow border border-white/20" style={{ background: teamAColor }}></div>
                <span className={`text-xl font-black italic uppercase ${activeTab === 'A' ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{teamAName || "TEAM A"}</span>
                <span className="text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded ml-2">{rosterA.length}</span>
                {activeTab === 'A' && <div className="absolute bottom-0 left-0 w-full h-1" style={{ background: teamAColor }}></div>}
              </button>
              <div className="w-[1px] bg-zinc-800"></div>
              <button onClick={() => setActiveTab('B')} className={`flex-1 relative transition-all flex items-center justify-center gap-3 group ${activeTab === 'B' ? 'bg-zinc-900' : 'opacity-50'}`}>
                <div className="w-3 h-3 rounded-full shadow border border-white/20" style={{ background: teamBColor }}></div>
                <span className={`text-xl font-black italic uppercase ${activeTab === 'B' ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{teamBName || "TEAM B"}</span>
                <span className="text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded ml-2">{rosterB.length}</span>
                {activeTab === 'B' && <div className="absolute bottom-0 left-0 w-full h-1" style={{ background: teamBColor }}></div>}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-900/30 p-8 custom-scrollbar">
              {(activeTab === 'A' ? rosterA : rosterB).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-60">
                  <span className="text-6xl mb-4 grayscale opacity-30">👟</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">No Players Added</h3>
                  <p className="text-[10px] mt-2">Use the terminal below to build the squad.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(activeTab === 'A' ? rosterA : rosterB).map((p) => (
                    <div key={p.id} className="bg-black border border-zinc-800 p-4 rounded-lg flex items-center gap-4 group hover:border-zinc-500 transition-all shadow-sm">
                      <div className="text-3xl font-black italic text-zinc-600 group-hover:text-white transition-colors w-14 text-center border-r border-zinc-800 pr-4">{p.number}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">{p.position}</div>
                        <div className="font-bold text-white uppercase text-lg truncate">{p.name}</div>
                      </div>
                      <button onClick={() => removePlayer(activeTab, p.id)} className="text-zinc-600 hover:text-red-500 hover:bg-red-900/10 w-8 h-8 flex items-center justify-center rounded transition-all">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-black/90 backdrop-blur border-t border-zinc-800 p-6 z-20 shrink-0">
              <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <div className="flex items-end gap-4 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 shadow-xl">
                  <div className="w-28">
                    <label className="text-[10px] font-black text-zinc-500 mb-1.5 block tracking-widest px-1 uppercase">Jersey #</label>
                    <input id="playerNumInput" value={pNumber} onChange={handleNumberChange} className={`w-full bg-black border border-zinc-700 focus:border-white p-3 text-center font-mono text-white font-bold rounded-lg outline-none text-xl transition-all ${errorMsg ? 'border-red-500 animate-pulse' : ''}`} placeholder="00" />
                  </div>
                  <div className="w-36">
                    <label className="text-[10px] font-black text-zinc-500 mb-1.5 block tracking-widest px-1 uppercase">Position</label>
                    <select value={pPos} onChange={(e) => setPPos(e.target.value)} className="w-full bg-black border border-zinc-700 focus:border-white p-3 text-center text-white text-sm font-bold rounded-lg outline-none h-[54px] transition-all">
                      {['PG', 'SG', 'SF', 'PF', 'C'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-zinc-500 mb-1.5 block tracking-widest px-1 uppercase">Player Name</label>
                    <input value={pName} onChange={(e) => setPName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()} className="w-full bg-black border border-zinc-700 focus:border-white p-3 text-white text-xl font-bold rounded-lg outline-none uppercase placeholder-zinc-700 transition-all" placeholder="TYPE NAME..." />
                  </div>
                  <button onClick={addPlayer} disabled={!pNumber || !pName} className="h-[54px] px-10 bg-white hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 text-black text-xs font-black uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all">
                    + Add Player
                  </button>
                </div>
                {errorMsg && <div className="text-center text-red-500 text-xs font-bold animate-bounce bg-red-900/20 py-2 rounded border border-red-900/50">{errorMsg}</div>}
                <div className="flex justify-start pt-2">
                  <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 group"><span className="group-hover:-translate-x-1 transition-transform">←</span> Return to Configuration</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-xl shadow-2xl p-6 relative">
            <button onClick={() => setShowTimeModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">&times;</button>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 text-center">Edit {editTarget === 'game' ? 'Period Duration' : 'Shot Clock'}</h3>
            <div className="flex justify-center mb-8">
              <input type="number" value={tempTimeValue} onChange={(e) => setTempTimeValue(Number(e.target.value))} className="bg-black border-2 border-zinc-700 text-center text-5xl font-mono font-bold text-white rounded-lg w-32 h-20 outline-none focus:border-white transition-colors" autoFocus />
            </div>
            <button onClick={saveTimeEditor} className="w-full bg-white hover:bg-zinc-200 text-black font-black py-4 rounded-lg uppercase tracking-widest text-xs">Save Change</button>
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-3xl rounded-lg shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Match Pre-Flight Check</h3>
              <button onClick={() => setShowConfirmation(false)} className="text-zinc-500 hover:text-white">&times;</button>
            </div>
            <div className="p-8 grid grid-cols-7 gap-4 items-center bg-zinc-950">
              <div className="col-span-3 bg-zinc-900/50 border border-zinc-800 rounded p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ background: teamAColor }}></div>
                <h4 className="text-2xl font-black italic text-white uppercase mb-1">{teamAName || "TEAM A"}</h4>
                <div className="text-4xl font-black text-white my-2">{rosterA.length}</div>
                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Players</div>
              </div>
              <div className="col-span-1 flex justify-center"><div className="text-xl font-black text-zinc-700 italic">VS</div></div>
              <div className="col-span-3 bg-zinc-900/50 border border-zinc-800 rounded p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ background: teamBColor }}></div>
                <h4 className="text-2xl font-black italic text-white uppercase mb-1">{teamBName || "TEAM B"}</h4>
                <div className="text-4xl font-black text-white my-2">{rosterB.length}</div>
                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Players</div>
              </div>
            </div>
            <div className="p-6 bg-black border-t border-zinc-800 flex justify-end gap-4">
              <button onClick={() => setShowConfirmation(false)} className="px-6 py-3 rounded border border-zinc-700 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">Edit</button>
              <button onClick={finalizeAndLaunch} disabled={isLaunching} className="px-8 py-3 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase tracking-widest shadow-lg transition-transform hover:-translate-y-0.5">{isLaunching ? "Booting..." : "Launch Match"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};