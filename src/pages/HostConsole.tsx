import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { useLocalGame } from '../hooks/useLocalGame';

// --- ICONS ---
const Icons = {
    Settings: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Link: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
    Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Help: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Power: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
};

// Sound Effects Stub
const playSound = (type: 'horn' | 'whistle') => {
    // Implement Audio() here if needed
};

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    // --- GAME CONNECTION ---
    const isLocalGame = gameCode?.startsWith('LOCAL-');

    // Hooks
    const firebaseGame = useBasketballGame(!isLocalGame && gameCode ? gameCode : '', 'online');
    const localGame = useLocalGame(isLocalGame && gameCode ? gameCode : '');

    // Adapter
    const game = isLocalGame ? localGame.game : firebaseGame.game;
    const updateGameTime = isLocalGame ? localGame.updateGameTime : firebaseGame.updateGameTime;
    const toggleTimer = isLocalGame ? localGame.toggleGameClock : firebaseGame.toggleTimer;
    const resetShotClockIn = isLocalGame ? localGame.resetShotClock : firebaseGame.resetShotClock;
    const handleAction = isLocalGame ? localGame.handleAction : firebaseGame.handleAction;

    // Toggle Possession Logic
    const handleTogglePossession = useCallback(() => {
        if (!game) return;
        // Manual toggle logic to ensure we control the state update
        const nextPos = game.gameState.possession === 'A' ? 'B' : 'A';
        // Use direct update if available, or assume handleAction might support it (or add custom logic)
        // For now, we update via the specific hook method if available
        if (isLocalGame) localGame.togglePossession();
        else if (firebaseGame.togglePossession) firebaseGame.togglePossession();
    }, [game, isLocalGame, localGame, firebaseGame]);

    // --- CLOCK DRIVER ---
    // Using a ref to hold the latest game state avoids closure staleness in the interval
    const gameRef = useRef(game);
    useEffect(() => { gameRef.current = game; }, [game]);

    useEffect(() => {
        let interval: any = null;

        if (game?.gameState?.gameRunning) {
            interval = setInterval(() => {
                const g = gameRef.current;
                if (!g || !g.gameState.gameRunning) return;

                let { minutes, seconds } = g.gameState.gameTime;
                let { shotClock } = g.gameState;

                // Game Clock Logic
                if (seconds > 0) {
                    seconds--;
                } else {
                    if (minutes > 0) {
                        minutes--;
                        seconds = 59;
                    } else {
                        // Time Expired
                        toggleTimer();
                        playSound('horn');
                        return;
                    }
                }

                // Shot Clock Logic
                if (g.gameState.shotClockRunning && shotClock > 0) {
                    shotClock--;
                    if (shotClock === 0) {
                        toggleTimer();
                        playSound('whistle');
                    }
                }

                // Sync
                if (updateGameTime) {
                    updateGameTime(minutes, seconds, shotClock);
                }
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [game?.gameState?.gameRunning]); // Only re-run when running state changes

    // --- ACTIONS HANDLERS (With Anti-Bubble) ---
    // The e: React.MouseEvent is crucial to stop propagation
    const handleScore = (e: React.MouseEvent, team: 'A' | 'B', points: number) => {
        e.stopPropagation();
        handleAction(team, 'points', points);
    };

    const handleFoul = (e: React.MouseEvent, team: 'A' | 'B') => {
        e.stopPropagation();
        handleAction(team, 'foul', 1);
    };

    const handleTimeout = (e: React.MouseEvent, team: 'A' | 'B') => {
        e.stopPropagation();
        handleAction(team, 'timeout', -1);
    };

    const handleResetShot = (e: React.MouseEvent, val: number) => {
        e.stopPropagation();
        resetShotClockIn(val);
    };

    const handleTimerToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleTimer();
    };

    // --- HEADER ACTIONS ---
    const copyGameCode = () => {
        if (gameCode) {
            navigator.clipboard.writeText(gameCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const openWatchLink = () => {
        const url = `${window.location.origin}/watch/${gameCode}`;
        window.open(url, '_blank');
    };

    const handleEndGame = async () => {
        if (window.confirm("Are you sure you want to END this game? This will stop the session.")) {
            navigate('/dashboard');
        }
    };

    useEffect(() => {
        const unsub = subscribeToAuth((user) => setCurrentUser(user));
        return () => unsub();
    }, []);

    if (!game) return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="text-center animate-pulse">
                <div className="text-4xl mb-4">📡</div>
                <div className="text-sm font-bold uppercase tracking-widest">Connecting to Console...</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">

            {/* NEW HEADER BAR */}
            <header className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-3 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">

                    {/* LEFT: NAV & INFO */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <button onClick={() => navigate('/dashboard')} className="w-9 h-9 rounded-full bg-black border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">←</button>

                        <div className="h-6 w-[1px] bg-zinc-700 hidden md:block"></div>

                        <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Settings">
                            <Icons.Settings />
                        </button>

                        <button
                            onClick={copyGameCode}
                            className="flex items-center gap-2 bg-black hover:bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors group cursor-pointer active:scale-95"
                        >
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400">CODE:</span>
                            <span className="text-sm font-mono font-black text-white tracking-wider">{gameCode}</span>
                            <span className="text-zinc-500 group-hover:text-white">
                                {copied ? <span className="text-green-500 text-xs font-bold">✓</span> : <Icons.Copy />}
                            </span>
                        </button>

                        <button onClick={openWatchLink} className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors" title="Open Spectator View">
                            <Icons.Link />
                        </button>
                    </div>

                    {/* RIGHT: TOOLS */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <button className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-colors uppercase tracking-wider">
                            <Icons.Download /> <span className="hidden md:inline">Export Stats</span>
                        </button>

                        <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Help">
                            <Icons.Help />
                        </button>

                        <div className="h-6 w-[1px] bg-zinc-700 mx-1"></div>

                        <button
                            onClick={handleEndGame}
                            className="flex items-center gap-2 bg-red-900/20 hover:bg-red-600 border border-red-900 hover:border-red-500 text-red-500 hover:text-white px-4 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest"
                        >
                            <Icons.Power /> End
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">

                {/* 1. HERO SCOREBOARD (Display Only) */}
                <div className="bg-black border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-30"></div>

                    <div className="flex justify-between items-center relative z-10">
                        {/* TEAM A SCORE */}
                        <div className="text-center w-1/3">
                            <div className="text-sm font-bold uppercase tracking-widest mb-1 opacity-80" style={{ color: game.teamA.color }}>{game.teamA.name}</div>
                            <div className="text-8xl md:text-9xl font-black text-white leading-none tracking-tighter drop-shadow-2xl">{game.teamA.score}</div>
                            <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-70">
                                <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">FLS: {game.teamA.fouls}</span>
                                <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">T.O: {game.teamA.timeouts}</span>
                            </div>
                        </div>

                        {/* CENTER CLOCK DISPLAY */}
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="bg-zinc-900/80 px-4 py-1 rounded-full border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">
                                {game.gameState.period <= 4 ? `Quarter ${game.gameState.period}` : `OT ${game.gameState.period - 4}`}
                            </div>
                            <div className={`text-7xl md:text-8xl font-mono font-black tracking-widest tabular-nums leading-none ${game.gameState.gameRunning ? 'text-white' : 'text-red-500'}`}>
                                {game.gameState.gameTime.minutes}:{String(game.gameState.gameTime.seconds).padStart(2, '0')}
                            </div>
                            <div className="mt-4 flex items-center gap-3">
                                <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Shot Clock</div>
                                <div className={`text-4xl font-mono font-bold ${game.gameState.shotClock <= 5 ? 'text-red-500' : 'text-amber-400'}`}>
                                    {game.gameState.shotClock}
                                </div>
                            </div>
                        </div>

                        {/* TEAM B SCORE */}
                        <div className="text-center w-1/3">
                            <div className="text-sm font-bold uppercase tracking-widest mb-1 opacity-80" style={{ color: game.teamB.color }}>{game.teamB.name}</div>
                            <div className="text-8xl md:text-9xl font-black text-white leading-none tracking-tighter drop-shadow-2xl">{game.teamB.score}</div>
                            <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-70">
                                <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">FLS: {game.teamB.fouls}</span>
                                <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-400">T.O: {game.teamB.timeouts}</span>
                            </div>
                        </div>
                    </div>

                    {/* POSSESSION INDICATOR */}
                    <div className="absolute bottom-0 left-0 w-full h-2 bg-zinc-900 flex">
                        <div className={`flex-1 transition-colors duration-300 ${game.gameState.possession === 'A' ? 'bg-white shadow-[0_0_15px_white]' : 'bg-transparent'}`}></div>
                        <div className={`flex-1 transition-colors duration-300 ${game.gameState.possession === 'B' ? 'bg-white shadow-[0_0_15px_white]' : 'bg-transparent'}`}></div>
                    </div>
                </div>

                {/* 2. MAIN CONTROLS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* TEAM A PANEL */}
                    <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full" style={{ background: game.teamA.color }}></div>
                        <div className="flex justify-between items-center pl-3">
                            <h3 className="font-black italic uppercase text-white text-xl">{game.teamA.name}</h3>
                            <button onClick={(e) => handleTimeout(e, 'A')} className="px-3 py-1.5 bg-black hover:bg-zinc-800 border border-zinc-800 rounded text-[10px] font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors active:scale-95">Timeout</button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3].map(pts => (
                                <button key={pts} onClick={(e) => handleScore(e, 'A', pts)} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 text-white font-black py-6 rounded-xl text-2xl shadow-lg transition-all active:scale-95 active:bg-zinc-600">
                                    +{pts}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-auto">
                            <button onClick={(e) => handleScore(e, 'A', -1)} className="bg-black/40 hover:bg-red-900/20 border border-zinc-800 hover:border-red-900/50 text-zinc-500 hover:text-red-400 font-bold py-3 rounded-lg text-xs uppercase transition-colors">
                                −1 Point
                            </button>
                            <button onClick={(e) => handleFoul(e, 'A')} className="bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 hover:border-red-500 text-red-500 font-bold py-3 rounded-lg text-xs uppercase transition-colors">
                                Foul +
                            </button>
                        </div>
                    </div>

                    {/* CENTER: CLOCK & GAME MANAGEMENT */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        {/* Primary Clock Control */}
                        <button
                            onClick={handleTimerToggle}
                            className={`flex-1 min-h-[100px] rounded-2xl font-black text-2xl uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98] border-b-4 ${game.gameState.gameRunning
                                ? 'bg-red-600 hover:bg-red-500 border-red-800 text-white shadow-red-900/20'
                                : 'bg-green-600 hover:bg-green-500 border-green-800 text-white shadow-green-900/20'
                                }`}
                        >
                            {game.gameState.gameRunning ? 'STOP GAME' : 'START GAME'}
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={(e) => handleResetShot(e, 24)} className="bg-zinc-800 hover:bg-amber-600 hover:text-white hover:border-amber-500 border border-zinc-700 text-amber-500 font-bold py-4 rounded-xl uppercase tracking-widest text-sm transition-all active:scale-95 shadow-lg">
                                Reset 24
                            </button>
                            <button onClick={(e) => handleResetShot(e, 14)} className="bg-zinc-800 hover:bg-amber-600 hover:text-white hover:border-amber-500 border border-zinc-700 text-amber-500 font-bold py-4 rounded-xl uppercase tracking-widest text-sm transition-all active:scale-95 shadow-lg">
                                Reset 14
                            </button>
                        </div>

                        <button onClick={handleTogglePossession} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white font-bold py-3 rounded-xl uppercase tracking-widest text-xs transition-all active:scale-95">
                            Switch Possession ↔
                        </button>
                    </div>

                    {/* TEAM B PANEL */}
                    <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-2 h-full" style={{ background: game.teamB.color }}></div>
                        <div className="flex justify-between items-center pr-3 flex-row-reverse">
                            <h3 className="font-black italic uppercase text-white text-xl">{game.teamB.name}</h3>
                            <button onClick={(e) => handleTimeout(e, 'B')} className="px-3 py-1.5 bg-black hover:bg-zinc-800 border border-zinc-800 rounded text-[10px] font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors active:scale-95">Timeout</button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3].map(pts => (
                                <button key={pts} onClick={(e) => handleScore(e, 'B', pts)} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 text-white font-black py-6 rounded-xl text-2xl shadow-lg transition-all active:scale-95 active:bg-zinc-600">
                                    +{pts}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-auto">
                            <button onClick={(e) => handleScore(e, 'B', -1)} className="bg-black/40 hover:bg-red-900/20 border border-zinc-800 hover:border-red-900/50 text-zinc-500 hover:text-red-400 font-bold py-3 rounded-lg text-xs uppercase transition-colors">
                                −1 Point
                            </button>
                            <button onClick={(e) => handleFoul(e, 'B')} className="bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 hover:border-red-500 text-red-500 font-bold py-3 rounded-lg text-xs uppercase transition-colors">
                                Foul +
                            </button>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};