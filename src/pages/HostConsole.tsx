// src/pages/HostConsole.tsx (DEBUG VERSION)
// Add this temporarily to find the issue

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { deleteGame } from '../services/gameService';

// --- ICONS ---
const Icons = {
    Settings: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Link: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
    Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Help: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Power: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
};

const playSound = (type: 'horn' | 'whistle') => {
    console.log(`🔊 Sound: ${type}`);
};

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    // ============================================
    // GAME CONNECTION (FIREBASE ONLY)
    // ============================================
    const hookResult = useBasketballGame(gameCode || '', 'online');

    // 🐛 DEBUG: Log what we get from the hook
    useEffect(() => {
        console.log('=== HOOK RESULT DEBUG ===');
        console.log('Game Code:', gameCode);
        console.log('Hook Result:', hookResult);
        console.log('Game Object:', hookResult.game);
        console.log('toggleTimer type:', typeof hookResult.toggleTimer);
        console.log('updateGameTime type:', typeof hookResult.updateGameTime);
        console.log('resetShotClock type:', typeof hookResult.resetShotClock);
        console.log('handleAction type:', typeof hookResult.handleAction);
        console.log('togglePossession type:', typeof hookResult.togglePossession);
        console.log('========================');
    }, [gameCode, hookResult]);

    const {
        game,
        toggleTimer,
        updateGameTime,
        resetShotClock,
        handleAction,
        togglePossession
    } = hookResult;

    // 🐛 DEBUG: Log game state changes
    useEffect(() => {
        if (game) {
            console.log('=== GAME STATE ===');
            console.log('Team A Score:', game.teamA.score);
            console.log('Team B Score:', game.teamB.score);
            console.log('Game Running:', game.gameState.gameRunning);
            console.log('Shot Clock:', game.gameState.shotClock);
            console.log('==================');
        }
    }, [game]);

    // Auth subscription
    useEffect(() => {
        const unsubscribe = subscribeToAuth((user) => {
            setCurrentUser(user);
        });
        return unsubscribe;
    }, []);

    // ============================================
    // CLOCK DRIVER (TIMER INTERVAL)
    // ============================================
    const gameRef = useRef(game);
    useEffect(() => {
        gameRef.current = game;
    }, [game]);

    useEffect(() => {
        let interval: any = null;

        if (game?.gameState?.gameRunning) {
            console.log('⏱️ Timer interval started');
            interval = setInterval(() => {
                const g = gameRef.current;
                if (!g || !g.gameState.gameRunning) return;

                let { minutes, seconds } = g.gameState.gameTime;
                let { shotClock } = g.gameState;

                console.log(`⏱️ Tick: ${minutes}:${seconds} | Shot: ${shotClock}`);

                // Game Clock Logic
                if (seconds > 0) {
                    seconds--;
                } else {
                    if (minutes > 0) {
                        minutes--;
                        seconds = 59;
                    } else {
                        // Time Expired
                        console.log('⏱️ TIME EXPIRED');
                        toggleTimer();
                        playSound('horn');
                        return;
                    }
                }

                // Shot Clock Logic
                if (g.gameState.shotClockRunning && shotClock > 0) {
                    shotClock--;
                    if (shotClock === 0) {
                        console.log('⏱️ SHOT CLOCK EXPIRED');
                        toggleTimer();
                        playSound('whistle');
                    }
                }

                // Update Firebase
                if (updateGameTime) {
                    console.log(`📤 Updating time: ${minutes}:${seconds} | ${shotClock}`);
                    updateGameTime(minutes, seconds, shotClock);
                } else {
                    console.error('❌ updateGameTime is undefined!');
                }
            }, 1000);
        } else {
            console.log('⏱️ Timer stopped or game not running');
        }

        return () => {
            if (interval) {
                console.log('⏱️ Clearing interval');
                clearInterval(interval);
            }
        };
    }, [game?.gameState?.gameRunning, toggleTimer, updateGameTime]);

    // ============================================
    // ACTION HANDLERS
    // ============================================
    const handleScore = (e: React.MouseEvent, team: 'A' | 'B', points: number) => {
        e.stopPropagation();
        console.log(`🏀 Score clicked: Team ${team} +${points}`);
        console.log('handleAction type:', typeof handleAction);
        if (handleAction) {
            handleAction(team, 'points', points);
            console.log('✅ handleAction called');
        } else {
            console.error('❌ handleAction is undefined!');
        }
    };

    const handleFoul = (e: React.MouseEvent, team: 'A' | 'B') => {
        e.stopPropagation();
        console.log(`🚨 Foul clicked: Team ${team}`);
        if (handleAction) {
            handleAction(team, 'foul', 1);
        } else {
            console.error('❌ handleAction is undefined!');
        }
    };

    const handleTimeout = (e: React.MouseEvent, team: 'A' | 'B') => {
        e.stopPropagation();
        console.log(`⏸️ Timeout clicked: Team ${team}`);
        if (handleAction) {
            handleAction(team, 'timeout', -1);
        } else {
            console.error('❌ handleAction is undefined!');
        }
    };

    const handleResetShot = (e: React.MouseEvent, val: number) => {
        e.stopPropagation();
        console.log(`🔄 Shot clock reset: ${val}`);
        if (resetShotClock) {
            resetShotClock(val);
        } else {
            console.error('❌ resetShotClock is undefined!');
        }
    };

    const handleTimerToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('⏯️ Timer toggle clicked');
        console.log('Current gameRunning:', game?.gameState?.gameRunning);
        if (toggleTimer) {
            toggleTimer();
            console.log('✅ toggleTimer called');
        } else {
            console.error('❌ toggleTimer is undefined!');
        }
    };

    const handleTogglePossession = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('🔄 Possession toggle clicked');
        if (togglePossession) {
            togglePossession();
        } else {
            console.error('❌ togglePossession is undefined!');
        }
    };

    // ============================================
    // HEADER ACTIONS
    // ============================================
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
            try {
                await deleteGame(gameCode!);
                navigate('/dashboard');
            } catch (error) {
                console.error("Failed to end game:", error);
                alert("Failed to end game. Please try again.");
            }
        }
    };

    // ============================================
    // LOADING & ERROR STATES
    // ============================================
    if (!game) {
        console.log('⏳ Game is null, showing loading screen');
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <div className="text-white text-xl font-bold">Loading Game...</div>
                    <div className="text-zinc-500 text-sm mt-2">{gameCode}</div>
                </div>
            </div>
        );
    }

    console.log('✅ Rendering game interface');

    // ============================================
    // MAIN RENDER
    // ============================================
    return (
        <div className="min-h-screen bg-black text-white">
            {/* DEBUG PANEL */}
            <div className="fixed top-0 right-0 bg-red-900 text-white text-xs p-2 z-50 max-w-xs">
                <div>Game: {game.code}</div>
                <div>A: {game.teamA.score} | B: {game.teamB.score}</div>
                <div>Running: {game.gameState.gameRunning ? 'YES' : 'NO'}</div>
                <div>Time: {game.gameState.gameTime.minutes}:{game.gameState.gameTime.seconds}</div>
                <div>Shot: {game.gameState.shotClock}</div>
            </div>

            {/* HEADER */}
            <header className="bg-zinc-900 border-b border-zinc-800 p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">{game.settings.gameName}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-zinc-500 uppercase tracking-wider">Game Code:</span>
                            <code className="text-sm font-mono bg-black px-3 py-1 rounded border border-zinc-800 text-white">{gameCode}</code>
                            <button onClick={copyGameCode} className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
                                <Icons.Copy />
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={openWatchLink} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors flex items-center gap-2">
                            <Icons.Link />
                            Open Viewer
                        </button>
                        <button onClick={handleEndGame} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors flex items-center gap-2">
                            <Icons.Power />
                            End Game
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {/* SCOREBOARD */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-6">
                    <div className="grid grid-cols-3 gap-8 items-center">
                        {/* TEAM A */}
                        <div className="text-center">
                            <h2 className="text-3xl font-black uppercase mb-2" style={{ color: game.teamA.color }}>{game.teamA.name}</h2>
                            <div className="text-8xl font-black font-mono">{game.teamA.score}</div>
                            <div className="text-sm text-zinc-500 mt-2">Fouls: {game.teamA.fouls} | Timeouts: {game.teamA.timeouts}</div>
                        </div>

                        {/* CENTER - CLOCK */}
                        <div className="text-center">
                            <div className="text-sm text-zinc-500 uppercase tracking-widest mb-2">Period {game.gameState.period}</div>
                            <div className="text-6xl font-mono font-black mb-4">
                                {String(game.gameState.gameTime.minutes).padStart(2, '0')}:{String(game.gameState.gameTime.seconds).padStart(2, '0')}
                            </div>
                            <div className="text-2xl font-mono text-amber-500 mb-4">Shot Clock: {game.gameState.shotClock}</div>
                            <div className="flex justify-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${game.gameState.possession === 'A' ? 'bg-white animate-pulse' : 'bg-zinc-700'}`}></div>
                                <span className="text-xs text-zinc-500">POSSESSION</span>
                                <div className={`w-3 h-3 rounded-full ${game.gameState.possession === 'B' ? 'bg-white animate-pulse' : 'bg-zinc-700'}`}></div>
                            </div>
                        </div>

                        {/* TEAM B */}
                        <div className="text-center">
                            <h2 className="text-3xl font-black uppercase mb-2" style={{ color: game.teamB.color }}>{game.teamB.name}</h2>
                            <div className="text-8xl font-black font-mono">{game.teamB.score}</div>
                            <div className="text-sm text-zinc-500 mt-2">Fouls: {game.teamB.fouls} | Timeouts: {game.teamB.timeouts}</div>
                        </div>
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* TEAM A PANEL */}
                    <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black uppercase text-white text-xl">{game.teamA.name}</h3>
                            <button onClick={(e) => handleTimeout(e, 'A')} className="px-3 py-1.5 bg-black hover:bg-zinc-800 border border-zinc-800 rounded text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">Timeout</button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3].map(pts => (
                                <button key={pts} onClick={(e) => handleScore(e, 'A', pts)} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 text-white font-black py-6 rounded-xl text-2xl shadow-lg transition-all active:scale-95">
                                    +{pts}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={(e) => handleScore(e, 'A', -1)} className="bg-black/40 hover:bg-red-900/20 border border-zinc-800 hover:border-red-900/50 text-zinc-500 hover:text-red-400 font-bold py-3 rounded-lg text-xs uppercase transition-colors">
                                −1 Point
                            </button>
                            <button onClick={(e) => handleFoul(e, 'A')} className="bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 hover:border-red-500 text-red-500 font-bold py-3 rounded-lg text-xs uppercase transition-colors">
                                Foul +
                            </button>
                        </div>
                    </div>

                    {/* CENTER - CLOCK CONTROLS */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        {/* Main Timer */}
                        <button
                            onClick={handleTimerToggle}
                            className={`flex-1 min-h-[100px] rounded-2xl font-black text-2xl uppercase tracking-wider shadow-2xl transition-all active:scale-95 border-b-4 ${game.gameState.gameRunning
                                ? 'bg-red-900/20 border-red-600/50 hover:bg-red-900/40 text-red-500'
                                : 'bg-green-900/20 border-green-600/50 hover:bg-green-900/40 text-green-500'
                                }`}
                        >
                            {game.gameState.gameRunning ? '⏸ STOP' : '▶ START'}
                        </button>

                        {/* Shot Clock Controls */}
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={(e) => handleResetShot(e, 24)} className="bg-zinc-800 hover:bg-amber-900/30 border border-zinc-700 hover:border-amber-600 text-white font-black py-4 rounded-xl text-xl transition-all active:scale-95">
                                24
                            </button>
                            <button onClick={(e) => handleResetShot(e, 14)} className="bg-zinc-800 hover:bg-orange-900/30 border border-zinc-700 hover:border-orange-600 text-white font-black py-4 rounded-xl text-xl transition-all active:scale-95">
                                14
                            </button>
                        </div>

                        {/* Possession Toggle */}
                        <button onClick={handleTogglePossession} className="bg-black hover:bg-zinc-900 border border-zinc-700 hover:border-white text-zinc-400 hover:text-white font-bold py-3 rounded-lg text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-3">
                            <span className={`text-xl ${game.gameState.possession === 'A' ? 'text-white' : 'text-zinc-700'}`}>◀</span>
                            SWAP POSSESSION
                            <span className={`text-xl ${game.gameState.possession === 'B' ? 'text-white' : 'text-zinc-700'}`}>▶</span>
                        </button>
                    </div>

                    {/* TEAM B PANEL */}
                    <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black uppercase text-white text-xl">{game.teamB.name}</h3>
                            <button onClick={(e) => handleTimeout(e, 'B')} className="px-3 py-1.5 bg-black hover:bg-zinc-800 border border-zinc-800 rounded text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">Timeout</button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3].map(pts => (
                                <button key={pts} onClick={(e) => handleScore(e, 'B', pts)} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 text-white font-black py-6 rounded-xl text-2xl shadow-lg transition-all active:scale-95">
                                    +{pts}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
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