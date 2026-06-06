// src/pages/GameSetup.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { initializeNewGame } from '../services/supabaseGameService';
import { subscribeToAuth } from '../services/authService';
import { assignGameToBox } from '../services/boxUnitService';
import { SplashScreen } from '../components/SplashScreen';
import { useHardware } from '../contexts/HardwareContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Player } from '../types';
import type { User } from '@supabase/supabase-js';
import { SPORT_REGISTRY } from '../sports/registry';
import { useDisableTouchDeck } from '../services/gameControlPrefs';

const TEAM_COLORS = [
  '#DC2626', '#2563EB', '#16A34A', '#F59E0B', '#FFFFFF', '#9333EA', '#EA580C', '#000000',
];

export const GameSetup: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const boxCodeParam = searchParams.get('box');
  const sportType = location.state?.sport || 'basketball';

  // If this sport has its own setup page, delegate to it immediately.
  const manifest = SPORT_REGISTRY[sportType];
  if (manifest?.setupPage) {
    const SportSetupPage = manifest.setupPage;
    return (
      <SportSetupPage
        onLaunch={(code) => navigate(`/host/${code}`)}
        onBack={() => navigate(-1)}
      />
    );
  }

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
  const [advancedStats, setAdvancedStats] = useState(false);
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

  // --- HARDWARE BRIDGE INTEGRATION ---
  const { isConnected, controlMode, setMode: setAuthority, activateGame, deviceId } = useHardware();

  // Optimistic UI state for instant feedback
  const [localHwMode, setLocalHwMode] = useState<'web' | 'hardware'>('hardware');

  useEffect(() => {
    setLocalHwMode(controlMode);
  }, [controlMode]);

  const handleModeToggle = async (mode: 'web' | 'hardware') => {
    setLocalHwMode(mode); // Instant visual update
    await setAuthority(mode); // Background DB update
  };

  // Control whether we are using the controller for this game
  // Defaults to true if connected, but user can toggle it off
  const [isHardwareEnabled, setIsHardwareEnabled] = useState(isConnected);

  // Whether the on-screen touch deck is enabled — persisted across sessions
  // via Game Control prefs (also surfaced in the in-game Settings panel).
  const [touchDeckDisabled, setTouchDeckDisabled] = useDisableTouchDeck();

  // Auto-enable if connection comes online while on this page
  useEffect(() => {
    if (isConnected) setIsHardwareEnabled(true);
  }, [isConnected]);

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
          periodType,
          gameMode: advancedStats ? 'advanced' : trackStats ? 'stats' : 'quick',
        },
        { name: teamAName || "TEAM A", color: teamAColor, players: trackStats ? rosterA : [] },
        { name: teamBName || "TEAM B", color: teamBColor, players: trackStats ? rosterB : [] },
        trackStats,
        sportType,
        currentUser.id
      );

      setLaunchedGameCode(gameCode);

      // If launched from a Pi QR scan, assign the game to that box unit
      if (boxCodeParam) {
        try {
          await assignGameToBox(boxCodeParam, gameCode);
          console.log(`[GameSetup] Game ${gameCode} assigned to box ${boxCodeParam}`);
        } catch (err) {
          console.warn('[GameSetup] Could not assign to box (non-fatal):', err);
          // Non-fatal — game still launches normally even if box assignment fails
        }
      }

      // ── Hardware activation ───────────────────────────────────────────────────
      if (deviceId && isHardwareEnabled) {
        try {
          await activateGame(
            gameCode,
            teamAName || 'TEAM A',
            teamBName || 'TEAM B',
            localHwMode,
            currentUser.id
          );
          console.log('[GameSetup] Hardware controller activated for game', gameCode);
        } catch (err) {
          console.warn('[GameSetup] Could not activate hardware controller:', err);
          // Non-fatal — game still launches without hardware
        }
      }

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
          className={`w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${selected === c ? `scale-110 ring-2 ring-offset-2 ${theme === 'light' ? 'ring-slate-900 ring-offset-white' : 'ring-white ring-offset-black'}` : 'opacity-40 hover:opacity-100'}`}
          style={{ backgroundColor: c, border: c === '#000000' ? '1px solid #333' : 'none' }}
        />
      ))}
    </div>
  );

  if (isLaunching) {
    return <SplashScreen isReady={isGameReady} onComplete={onSplashComplete} />;
  }

  return (
    <div className={`min-h-screen font-sans flex items-center justify-center p-4 md:p-8 ${theme === 'light' ? 'bg-[#F0EEE9] text-slate-900' : 'bg-zinc-950 text-zinc-100'}`}>
      {/* Container */}
      <div className={`w-full max-w-6xl rounded-2xl overflow-hidden flex flex-col h-[90vh] max-h-[850px] ${theme === 'light' ? 'bg-white border border-slate-200 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.1)]' : 'bg-zinc-900 border border-zinc-800 shadow-2xl'}`}>

        {/* Header */}
        <div className={`px-6 py-5 flex justify-between items-center shrink-0 ${theme === 'light' ? 'bg-slate-50 border-b border-slate-100' : 'bg-zinc-950 border-b border-zinc-800'}`}>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate(-1)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-xl active:scale-95 ${theme === 'light' ? 'bg-slate-100 border border-slate-200 text-slate-500 hover:bg-red-600 hover:text-white hover:border-red-600' : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-white hover:text-black hover:border-white'}`}>←</button>
            <div>
              <h1 className={`text-xl font-black tracking-tight uppercase italic leading-none ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{sportType} CONFIG</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>
                  {step === 1 ? "Step 1: Match Settings" : "Step 2: Team Rosters"}
                </div>
                {/* Authority Switcher */}
                {isConnected && (
                  <div className="flex items-center gap-2 ml-2">
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${localHwMode === 'hardware' ? 'bg-green-900/30 border border-green-800' : 'bg-blue-900/30 border border-blue-800'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${localHwMode === 'hardware' ? 'bg-green-500' : 'bg-blue-500'}`} />
                      <span className={`text-[8px] font-bold uppercase tracking-wide ${localHwMode === 'hardware' ? 'text-green-500' : 'text-blue-400'}`}>
                        {localHwMode === 'hardware' ? 'ESP CTRL' : 'WEB CTRL'}
                      </span>
                    </div>
                    <div className="flex bg-black p-0.5 rounded border border-zinc-800">
                      <button onClick={() => handleModeToggle('hardware')} className={`px-2 py-0.5 text-[8px] font-black rounded transition-colors ${localHwMode === 'hardware' ? 'bg-green-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>ESP</button>
                      <button onClick={() => handleModeToggle('web')} className={`px-2 py-0.5 text-[8px] font-black rounded transition-colors ${localHwMode === 'web' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>WEB</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {step === 2 && (
            <button onClick={handleLaunchRequest} className="px-8 py-3 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-black uppercase tracking-widest shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all">Launch Console 🚀</button>
          )}
        </div>

        {/* Step 1 Content */}
        {step === 1 && (
          <div className={`flex-1 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto custom-scrollbar ${theme === 'light' ? 'bg-slate-50/50' : 'bg-black/20'}`}>

            {/* Rules Section */}
            <div className="lg:col-span-7 flex flex-col gap-8">





              {/* Match Details */}
              <section className={`p-6 rounded-xl ${theme === 'light' ? 'bg-slate-50 border border-slate-100' : 'bg-zinc-900/50 border border-zinc-800'}`}>
                <h2 className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${theme === 'light' ? 'text-slate-500' : 'text-zinc-400'}`}><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Match Details</h2>
                <div className="space-y-6">
                  {/* AUTHORITY & STATUS BANNER */}
                  {/* On-screen touch deck toggle — always available, regardless of hardware */}
                  <div className={`p-5 rounded-xl border flex items-center justify-between gap-4 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-zinc-950 border-zinc-800'}`}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base ${touchDeckDisabled ? 'bg-zinc-800 text-zinc-500' : 'bg-green-900/30 text-green-400'}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M7 12h10M12 7v10" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-xs font-black uppercase tracking-widest ${touchDeckDisabled ? 'text-zinc-500' : (theme === 'light' ? 'text-slate-900' : 'text-green-400')}`}>
                          On-Screen Touch Deck
                        </h3>
                        <p className={`text-[10px] font-bold ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>
                          {touchDeckDisabled
                            ? 'OFF — refs use only Pico hardware or Settings'
                            : 'ON — refs can pull up the touch deck on the scoreboard'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTouchDeckDisabled(!touchDeckDisabled)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${!touchDeckDisabled ? 'bg-green-600 text-black border-green-600' : (theme === 'light' ? 'text-slate-500 border-slate-300' : 'text-zinc-500 border-zinc-700')}`}
                    >
                      {!touchDeckDisabled ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  {isConnected && (
                    <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl space-y-6 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-green-900/30 text-green-500 rounded-full flex items-center justify-center text-xl animate-pulse">🎮</div>
                          <div>
                            <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest">Hardware Controller Linked</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase">Mode: {localHwMode === 'hardware' ? 'ESP32 is Parent' : 'Web is Parent'}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => setIsHardwareEnabled(!isHardwareEnabled)}
                          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isHardwareEnabled ? 'bg-green-600 text-black border-green-600' : 'text-zinc-500 border-zinc-700'}`}
                        >
                          {isHardwareEnabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-black p-1 rounded-lg border border-zinc-800">
                        <button
                          onClick={() => handleModeToggle('hardware')}
                          className={`py-2 text-[9px] font-black rounded uppercase transition-all ${localHwMode === 'hardware' ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          ESP Parent
                        </button>
                        <button
                          onClick={() => handleModeToggle('web')}
                          className={`py-2 text-[9px] font-black rounded uppercase transition-all ${localHwMode === 'web' ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Web Parent
                        </button>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={`text-[10px] font-bold tracking-widest block mb-2 uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Match Title</label>
                    <input
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      className={`w-full p-4 text-base font-bold outline-none rounded-lg focus:ring-1 transition-all uppercase ${theme === 'light' ? 'bg-white border border-slate-200 text-slate-900 placeholder-slate-300 focus:border-red-600 focus:ring-red-600' : 'bg-black border border-zinc-800 text-white placeholder-zinc-700 focus:border-blue-500 focus:ring-blue-500'}`}
                      placeholder="E.G. CHAMPIONSHIP FINAL"
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold tracking-widest block mb-2 uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Operation Mode</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => { setTrackStats(false); setAdvancedStats(false); }}
                        className={`p-4 rounded-xl text-left border transition-all ${!trackStats ? (theme === 'light' ? 'border-slate-900 bg-slate-900/5' : 'border-white bg-white/5') : (theme === 'light' ? 'border-slate-200' : 'border-zinc-800')}`}
                      >
                        <div className="text-2xl mb-2">⏱️</div>
                        <div className={`text-sm font-black uppercase tracking-wider ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Quick</div>
                        <div className={`text-[10px] mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Score only</div>
                      </button>
                      <button
                        onClick={() => { setTrackStats(true); setAdvancedStats(false); }}
                        className={`p-4 rounded-xl text-left border transition-all ${trackStats && !advancedStats ? 'border-red-500 bg-red-500/5' : (theme === 'light' ? 'border-slate-200' : 'border-zinc-800')}`}
                      >
                        <div className="text-2xl mb-2">📊</div>
                        <div className={`text-sm font-black uppercase tracking-wider ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Stats</div>
                        <div className={`text-[10px] mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>+ Players</div>
                      </button>
                      <button
                        onClick={() => { setTrackStats(true); setAdvancedStats(true); }}
                        className={`p-4 rounded-xl text-left border transition-all ${advancedStats ? 'border-yellow-500 bg-yellow-500/5' : (theme === 'light' ? 'border-slate-200' : 'border-zinc-800')}`}
                      >
                        <div className="text-2xl mb-2">🎯</div>
                        <div className={`text-sm font-black uppercase tracking-wider ${theme === 'light' ? 'text-yellow-600' : 'text-yellow-500'}`}>Advanced</div>
                        <div className={`text-[10px] mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>+ Shot chart</div>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Game Rules */}
              <section className={`p-6 rounded-xl ${theme === 'light' ? 'bg-slate-50 border border-slate-100' : 'bg-zinc-900/50 border border-zinc-800'}`}>
                <h2 className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${theme === 'light' ? 'text-slate-500' : 'text-zinc-400'}`}><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span> Rules</h2>
                <div className="grid grid-cols-2 gap-8 items-stretch">
                  <div className="flex flex-col gap-6">
                    <div>
                      <label className={`text-[10px] font-bold tracking-widest block mb-2 uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Format</label>
                      <div className={`flex p-1 rounded-lg border h-12 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-black border-zinc-800'}`}>
                        <button onClick={() => setPeriodType('quarter')} className={`flex-1 text-[10px] font-bold uppercase rounded-md transition-all active:scale-95 ${periodType === 'quarter' ? (theme === 'light' ? 'bg-slate-900 text-white shadow-sm' : 'bg-zinc-800 text-white shadow-sm') : (theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-zinc-500 hover:text-zinc-300')}`}>Quarters</button>
                        <button onClick={() => setPeriodType('half')} className={`flex-1 text-[10px] font-bold uppercase rounded-md transition-all active:scale-95 ${periodType === 'half' ? (theme === 'light' ? 'bg-slate-900 text-white shadow-sm' : 'bg-zinc-800 text-white shadow-sm') : (theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-zinc-500 hover:text-zinc-300')}`}>Halves</button>
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 justify-end">
                      <label className={`text-[10px] font-bold tracking-widest block mb-2 uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Period Duration (Min)</label>
                      <div className={`rounded-lg p-2 flex justify-between items-center h-16 border ${theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-black border-zinc-800'}`}>
                        <button onClick={() => setPeriodDuration(Math.max(1, periodDuration - 1))} className={`w-12 h-full rounded font-bold transition-colors text-xl ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-900' : 'bg-zinc-900 hover:bg-zinc-800 text-white active:bg-zinc-700'}`}>−</button>
                        <div className="text-2xl font-bold font-mono">{periodDuration}</div>
                        <button onClick={() => setPeriodDuration(Math.min(99, periodDuration + 1))} className={`w-12 h-full rounded font-bold transition-colors text-xl ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-900' : 'bg-zinc-900 hover:bg-zinc-800 text-white active:bg-zinc-700'}`}>+</button>
                      </div>
                    </div>
                  </div>

                  <div className={`flex flex-col gap-6 pl-8 border-l ${theme === 'light' ? 'border-slate-200' : 'border-zinc-800'}`}>
                    <div className="flex justify-between items-center h-12">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-600' : 'text-zinc-400'}`}>Shot Clock</span>
                      <button onClick={() => setShotClockEnabled(!shotClockEnabled)} className={`w-14 h-8 rounded-full relative transition-colors active:scale-95 ${shotClockEnabled ? 'bg-green-600' : (theme === 'light' ? 'bg-slate-300' : 'bg-zinc-700')}`}>
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${shotClockEnabled ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                    <div className={`flex flex-col flex-1 justify-end transition-opacity duration-300 ${shotClockEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                      <label className={`text-[10px] font-bold tracking-widest block mb-2 uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Shot Time (Sec)</label>
                      <div className={`rounded-lg p-2 text-center text-3xl font-bold font-mono h-16 flex items-center justify-center border ${theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-black border-zinc-800'}`}>{shotClockDuration}</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Teams Section */}
            <div className="lg:col-span-5 flex flex-col gap-8">
              <section className={`p-6 rounded-xl h-full flex flex-col ${theme === 'light' ? 'bg-slate-50 border border-slate-100' : 'bg-zinc-900/50 border border-zinc-800'}`}>
                <h2 className={`text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2 ${theme === 'light' ? 'text-slate-500' : 'text-zinc-400'}`}><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Teams</h2>
                <div className="flex-1 flex flex-col gap-6">
                  <div className={`p-5 rounded-xl group transition-colors ${theme === 'light' ? 'bg-slate-50 border border-slate-200 hover:border-slate-300' : 'bg-black border border-zinc-700 hover:border-zinc-500'}`}>
                    <label className={`text-[9px] font-bold tracking-widest block uppercase mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Home Team</label>
                    <div className={`flex gap-4 mb-2 items-center p-3 rounded-lg transition-colors ${theme === 'light' ? 'bg-white border border-slate-200 focus-within:border-red-600' : 'bg-zinc-900 border border-zinc-800 focus-within:border-white'}`}>
                      <div className="w-10 h-10 rounded-full border-2 border-zinc-700 shadow-sm" style={{ background: teamAColor }}></div>
                      <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} className={`flex-1 bg-transparent text-lg font-bold uppercase outline-none ${theme === 'light' ? 'text-slate-900 placeholder-slate-300' : 'text-white placeholder-zinc-700'}`} placeholder="TEAM A" />
                    </div>
                    <ColorPalette selected={teamAColor} onSelect={setTeamAColor} />
                  </div>

                  <div className="flex items-center justify-center text-zinc-700 font-black italic text-lg opacity-50">VS</div>

                  <div className={`p-5 rounded-xl group transition-colors ${theme === 'light' ? 'bg-slate-50 border border-slate-200 hover:border-slate-300' : 'bg-black border border-zinc-700 hover:border-zinc-500'}`}>
                    <label className={`text-[9px] font-bold tracking-widest block uppercase mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Guest Team</label>
                    <div className={`flex gap-4 mb-2 items-center p-3 rounded-lg transition-colors ${theme === 'light' ? 'bg-white border border-slate-200 focus-within:border-red-600' : 'bg-zinc-900 border border-zinc-800 focus-within:border-white'}`}>
                      <div className="w-10 h-10 rounded-full border-2 border-zinc-700 shadow-sm" style={{ background: teamBColor }}></div>
                      <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} className={`flex-1 bg-transparent text-lg font-bold uppercase outline-none ${theme === 'light' ? 'text-slate-900 placeholder-slate-300' : 'text-white placeholder-zinc-700'}`} placeholder="TEAM B" />
                    </div>
                    <ColorPalette selected={teamBColor} onSelect={setTeamBColor} />
                  </div>
                </div>
                <button
                  onClick={() => trackStats ? setStep(2) : finalizeAndLaunch()}
                  className={`mt-8 w-full font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all ${theme === 'light' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white hover:bg-zinc-200 text-black'}`}
                >
                  {trackStats ? "Next: Rosters" : "Initialize Console"} <span className="text-xl">→</span>
                </button>
              </section>
            </div>
          </div>
        )}

        {/* Step 2 Content - Rosters */}
        {step === 2 && (
          <div className={`flex flex-col h-full animate-in slide-in-from-right-8 duration-500 ${theme === 'light' ? 'bg-[#F0EEE9]' : 'bg-zinc-950'}`}>
            {/* Roster Tabs */}
            <div className={`flex border-b h-20 shrink-0 ${theme === 'light' ? 'border-slate-200 bg-white' : 'border-zinc-800 bg-black/40'}`}>
              <button onClick={() => setActiveTab('A')} className={`flex-1 flex items-center justify-center gap-3 transition-colors ${activeTab === 'A' ? (theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-zinc-900 text-white') : (theme === 'light' ? 'opacity-50 text-slate-500 hover:opacity-80' : 'opacity-50 text-zinc-500 hover:opacity-80')}`}>
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: teamAColor }}></div>
                <span className="text-xl font-black italic uppercase">{teamAName || "TEAM A"}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ml-2 ${theme === 'light' ? 'text-white bg-slate-900' : 'text-black bg-white'}`}>{rosterA.length}</span>
              </button>
              <div className={`w-[1px] ${theme === 'light' ? 'bg-slate-200' : 'bg-zinc-800'}`}></div>
              <button onClick={() => setActiveTab('B')} className={`flex-1 flex items-center justify-center gap-3 transition-colors ${activeTab === 'B' ? (theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-zinc-900 text-white') : (theme === 'light' ? 'opacity-50 text-slate-500 hover:opacity-80' : 'opacity-50 text-zinc-500 hover:opacity-80')}`}>
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: teamBColor }}></div>
                <span className="text-xl font-black italic uppercase">{teamBName || "TEAM B"}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ml-2 ${theme === 'light' ? 'text-white bg-slate-900' : 'text-black bg-white'}`}>{rosterB.length}</span>
              </button>
            </div>

            {/* Roster Grid */}
            <div className={`flex-1 overflow-y-auto p-8 custom-scrollbar ${theme === 'light' ? 'bg-[#F0EEE9]' : 'bg-zinc-900/30'}`}>
              {(activeTab === 'A' ? rosterA : rosterB).length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center opacity-60 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-700'}`}>
                  <span className="text-6xl mb-4 grayscale opacity-30">👟</span>
                  <h3 className={`text-sm font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>No Players Added</h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(activeTab === 'A' ? rosterA : rosterB).map((p) => (
                    <div key={p.id} className={`p-4 rounded-lg flex items-center gap-4 group transition-colors ${theme === 'light' ? 'bg-white border border-slate-200 hover:border-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'bg-black border border-zinc-800 hover:border-zinc-600'}`}>
                      <div className={`text-3xl font-black italic transition-colors ${theme === 'light' ? 'text-slate-300 group-hover:text-slate-900' : 'text-zinc-600 group-hover:text-white'}`}>{p.number}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-bold uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>{p.position}</div>
                        <div className={`font-bold uppercase text-lg truncate ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{p.name}</div>
                      </div>
                      <button onClick={() => removePlayer(activeTab, p.id)} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 text-lg ${theme === 'light' ? 'text-slate-400 hover:text-red-500 hover:bg-slate-100' : 'text-zinc-600 hover:text-red-500 hover:bg-zinc-900'}`}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Player Form */}
            <div className={`backdrop-blur border-t p-6 z-20 shrink-0 ${theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-black/90 border-zinc-800'}`}>
              <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <div className={`flex items-end gap-4 p-4 rounded-xl border shadow-xl ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
                  <div className="w-28">
                    <label className={`text-[10px] font-black mb-1.5 block tracking-widest px-1 uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Jersey #</label>
                    <input
                      ref={numberInputRef}
                      value={pNumber}
                      onChange={handleNumberChange}
                      className={`w-full p-3 text-center font-mono font-bold rounded-lg outline-none text-xl transition-colors ${theme === 'light' ? 'bg-white border border-slate-300 text-slate-900 focus:border-red-600' : 'bg-black border border-zinc-700 text-white focus:border-blue-500'} ${errorMsg && !pNumber ? '!border-red-500' : ''}`}
                      placeholder="00"
                    />
                  </div>
                  <div className="w-36">
                    <label className={`text-[10px] font-black mb-1.5 block tracking-widest px-1 uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Position</label>
                    <select value={pPos} onChange={(e) => setPPos(e.target.value)} className={`w-full p-3 text-center text-sm font-bold rounded-lg outline-none h-[54px] transition-colors ${theme === 'light' ? 'bg-white border border-slate-300 text-slate-900 focus:border-red-600' : 'bg-black border border-zinc-700 text-white focus:border-blue-500'}`}>
                      {['PG', 'SG', 'SF', 'PF', 'C'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className={`text-[10px] font-black mb-1.5 block tracking-widest px-1 uppercase ${theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}`}>Player Name</label>
                    <input
                      value={pName}
                      onChange={handleNameChange}
                      onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                      className={`w-full p-3 text-xl font-bold rounded-lg outline-none uppercase transition-colors ${theme === 'light' ? 'bg-white border border-slate-300 text-slate-900 focus:border-red-600' : 'bg-black border border-zinc-700 text-white focus:border-blue-500'} ${errorMsg && !pName ? '!border-red-500' : ''}`}
                      placeholder="TYPE NAME..."
                    />
                  </div>
                  <button onClick={addPlayer} className={`h-[54px] px-10 hover:scale-105 active:scale-95 text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-lg ${theme === 'light' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white text-black'}`}>
                    + Add Player
                  </button>
                </div>
                {errorMsg && <div className="text-center text-red-500 text-xs font-bold animate-pulse">{errorMsg}</div>}
                <div className="flex justify-start pt-2">
                  <button onClick={() => setStep(1)} className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors active:scale-95 ${theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-zinc-500 hover:text-white'}`}>← Return to Configuration</button>
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