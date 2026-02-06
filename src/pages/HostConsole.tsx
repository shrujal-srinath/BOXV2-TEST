// src/pages/HostConsole.tsx (JUMBOTRON DESIGN + PRO FEATURES)
/**
 * HOST CONSOLE - PREMIUM JUMBOTRON DESIGN
 * 
 * FEATURES:
 * - Massive jumbotron scoreboard display
 * - Pro control deck with tactile buttons
 * - Player selection popup
 * - Undo system with history
 * - Manual adjustments
 * - Keyboard shortcuts
 * - Professional header
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { deleteGame } from '../services/gameService';
import type { Player } from '../types';

// --- ICONS ---
const Icons = {
    Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Share: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    Help: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Power: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>,
    Undo: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
};

// Action history type
type GameAction = {
    type: 'score' | 'foul' | 'timeout';
    team: 'A' | 'B';
    value: number;
    playerId?: string;
    timestamp: number;
};

const formatTime = (num: number) => num.toString().padStart(2, '0');
const playSound = (type: 'horn' | 'whistle') => console.log(`🔊 ${type}`);

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [shareMenuOpen, setShareMenuOpen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Undo system
    const [actionHistory, setActionHistory] = useState<GameAction[]>([]);

    // Player selection popup state
    const [showPlayerPopup, setShowPlayerPopup] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        team: 'A' | 'B';
        type: 'points' | 'foul';
        value: number;
    } | null>(null);

    const {
        game,
        toggleTimer,
        updateGameTime,
        resetShotClock,
        handleAction,
        togglePossession
    } = useBasketballGame(gameCode || '', 'online');

    const gameRef = useRef(game);
    const gameStateRef = useRef(game?.gameState);

    useEffect(() => {
        gameRef.current = game;
        gameStateRef.current = game?.gameState;
    }, [game]);

    // ============================================
    // TIMER INTERVAL (Fixed from document)
    // ============================================
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (game?.gameState?.gameRunning) {
            if (!timerRef.current) {
                timerRef.current = window.setInterval(() => {
                    const currentState = gameStateRef.current;
                    if (!currentState) return;

                    const currentTotalSec = (currentState.gameTime.minutes * 60) + currentState.gameTime.seconds;
                    const currentShotClock = currentState.shotClock;

                    if (currentTotalSec > 0) {
                        const newTotal = currentTotalSec - 1;
                        let newShot = currentShotClock > 0 ? currentShotClock - 1 : 0;

                        updateGameTime(Math.floor(newTotal / 60), newTotal % 60, newShot);
                    } else {
                        toggleTimer();
                        updateGameTime(0, 0, 0);
                        playSound('horn');
                    }
                }, 1000);
            }
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [game?.gameState?.gameRunning]);

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;

            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (e.key === ' ') {
                e.preventDefault();
                handleTimerToggle(null as any);
            } else if (e.key.toLowerCase() === 'r') {
                handleResetShot(null as any, 24);
            } else if (e.key.toLowerCase() === 't') {
                handleResetShot(null as any, 14);
            } else if (e.key.toLowerCase() === 'p') {
                handleTogglePossession(null as any);
            } else if (e.key.toLowerCase() === 'h') {
                setShowHelp(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [actionHistory]);

    // ============================================
    // ACTION HANDLERS WITH HISTORY
    // ============================================
    const recordAction = (action: GameAction) => {
        setActionHistory(prev => [...prev.slice(-9), action]);
    };

    const handleScoreWithPlayer = (e: React.MouseEvent | null, team: 'A' | 'B', points: number) => {
        e?.stopPropagation();
        setPendingAction({ team, type: 'points', value: points });
        setShowPlayerPopup(true);
    };

    const handleFoulWithPlayer = (e: React.MouseEvent | null, team: 'A' | 'B') => {
        e?.stopPropagation();
        setPendingAction({ team, type: 'foul', value: 1 });
        setShowPlayerPopup(true);
    };

    const confirmPlayerAction = (player: Player) => {
        if (!pendingAction) return;

        const { team, type, value } = pendingAction;

        recordAction({
            type: type === 'points' ? 'score' : 'foul',
            team,
            value,
            playerId: player.id,
            timestamp: Date.now()
        });

        handleAction(team, type, value);
        // TODO: Update player stats in Firebase

        setShowPlayerPopup(false);
        setPendingAction(null);
    };

    const skipPlayerSelection = () => {
        if (!pendingAction) return;

        const { team, type, value } = pendingAction;

        recordAction({
            type: type === 'points' ? 'score' : 'foul',
            team,
            value,
            timestamp: Date.now()
        });

        handleAction(team, type, value);

        setShowPlayerPopup(false);
        setPendingAction(null);
    };

    const handleTimeout = (e: React.MouseEvent | null, team: 'A' | 'B') => {
        e?.stopPropagation();
        recordAction({
            type: 'timeout',
            team,
            value: -1,
            timestamp: Date.now()
        });
        handleAction(team, 'timeout', -1);
    };

    const handleResetShot = (e: React.MouseEvent | null, val: number) => {
        e?.stopPropagation();
        resetShotClock(val);
    };

    const handleTimerToggle = (e: React.MouseEvent | null) => {
        e?.stopPropagation();
        toggleTimer();
    };

    const handleTogglePossession = (e: React.MouseEvent | null) => {
        e?.stopPropagation();
        togglePossession();
    };

    const handleUndo = () => {
        if (actionHistory.length === 0) {
            alert('No actions to undo');
            return;
        }

        const lastAction = actionHistory[actionHistory.length - 1];

        if (lastAction.type === 'score') {
            handleAction(lastAction.team, 'points', -lastAction.value);
        } else if (lastAction.type === 'foul') {
            handleAction(lastAction.team, 'foul', -lastAction.value);
        } else if (lastAction.type === 'timeout') {
            handleAction(lastAction.team, 'timeout', -lastAction.value);
        }

        setActionHistory(prev => prev.slice(0, -1));
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

    const shareWatchLink = () => {
        const url = `${window.location.origin}/watch/${gameCode}`;
        if (navigator.share) {
            navigator.share({ title: `Watch ${game.settings.gameName}`, url }).catch(() => {
                navigator.clipboard.writeText(url);
                alert('Watch link copied!');
            });
        } else {
            navigator.clipboard.writeText(url);
            setShareMenuOpen(false);
            alert('Watch link copied!');
        }
    };

    const openWatchLink = () => {
        window.open(`${window.location.origin}/watch/${gameCode}`, '_blank');
        setShareMenuOpen(false);
    };

    const handleExportStats = () => {
        if (!game) return;
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

    const handleEndGame = async () => {
        if (window.confirm("⚠️ END GAME?\n\nThis will permanently end the session.\n\nContinue?")) {
            try {
                await deleteGame(gameCode!);
                navigate('/dashboard');
            } catch (error) {
                alert("Failed to end game.");
            }
        }
    };

    const getPeriodName = (p: number) => p <= 4 ? `Q${p}` : `OT${p - 4}`;

    if (!game) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center animate-pulse">
                    <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <div className="text-sm font-bold uppercase tracking-widest text-white">Connecting to Console...</div>
                </div>
            </div>
        );
    }

    const teamAPlayers = game.teamA.players?.filter(p => p.name) || [];
    const teamBPlayers = game.teamB.players?.filter(p => p.name) || [];
    const activePlayers = pendingAction?.team === 'A' ? teamAPlayers : teamBPlayers;

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col overflow-hidden">

            {/* HEADER */}
            <header className="h-16 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center px-4 lg:px-6 shrink-0 z-50 relative">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-9 h-9 rounded-full bg-black border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                        ←
                    </button>

                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-1 gap-1">
                        <div className="px-3 py-1 bg-black rounded text-zinc-400 text-xs font-mono font-bold tracking-wider select-all" title="Game Code">
                            {gameCode}
                        </div>
                        <button onClick={copyGameCode} title="Copy Code" className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-all">
                            {copied ? <Icons.Check /> : <span className="text-sm">📋</span>}
                        </button>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShareMenuOpen(!shareMenuOpen)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                        >
                            <span className="text-sm">🔗</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Share</span>
                        </button>

                        {shareMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShareMenuOpen(false)}></div>
                                <div className="absolute left-0 top-full mt-2 w-52 bg-zinc-950 border border-zinc-800 rounded shadow-2xl overflow-hidden z-50">
                                    <button
                                        onClick={openWatchLink}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-900 transition-colors"
                                    >
                                        <span className="text-blue-400">↗</span> Open in New Tab
                                    </button>
                                    <div className="h-px bg-zinc-800"></div>
                                    <button
                                        onClick={shareWatchLink}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-900 transition-colors"
                                    >
                                        🔗 Share Link
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setShowHelp(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all" title="Shortcuts">
                        <span className="text-sm">?</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Help</span>
                    </button>
                    <button onClick={handleExportStats} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all" title="Download CSV">
                        <span className="text-sm">⬇</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Export</span>
                    </button>
                    <button onClick={handleEndGame} className="px-4 py-1.5 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 text-red-500 hover:text-red-400 rounded text-[10px] font-bold uppercase tracking-widest transition-all">
                        End
                    </button>
                </div>
            </header>

            {/* JUMBOTRON SCOREBOARD */}
            <div className="flex-1 relative flex flex-col justify-center bg-black overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 to-black pointer-events-none"></div>

                <div className="relative z-10 w-full max-w-7xl mx-auto p-4 lg:p-6">
                    <div className="grid grid-cols-12 gap-4 lg:gap-8 h-full max-h-[600px] min-h-[400px]">

                        {/* TEAM A PANEL */}
                        <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-2" style={{ background: game.teamA.color }}></div>
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-2xl lg:text-4xl font-black italic uppercase tracking-tighter text-white truncate max-w-[85%]">
                                    {game.teamA.name}
                                </h2>
                                {game.gameState.possession === 'A' && (
                                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_red] animate-pulse mt-2"></div>
                                )}
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <div
                                    className="text-[8rem] lg:text-[11rem] font-mono font-bold leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl"
                                    style={{ textShadow: `0 0 50px ${game.teamA.color}40` }}
                                >
                                    {game.teamA.score}
                                </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-zinc-800 pt-3">
                                <div className="text-center">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Fouls</div>
                                    <div className="text-4xl font-mono font-bold text-red-500 tabular-nums">{game.teamA.fouls}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">
                                        Timeouts ({game.teamA.timeouts})
                                    </div>
                                    <div className="flex gap-1.5">
                                        {[...Array(5)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-3 h-5 rounded-sm transition-all ${i < game.teamA.timeouts
                                                        ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                                                        : 'bg-zinc-800/50'
                                                    }`}
                                            ></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CENTER CLOCK TOWER */}
                        <div className="col-span-4 flex flex-col gap-4 relative z-20">
                            <div className="flex-1 bg-black border-2 border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                                <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em] mb-2 z-10">Game Time</div>
                                <div className={`relative z-10 flex items-baseline gap-1 transition-colors duration-300 ${game.gameState.gameRunning ? 'text-white' : 'text-zinc-400'
                                    }`}>
                                    <span className="text-[6rem] lg:text-[8.5rem] font-mono font-bold leading-none tracking-tight tabular-nums drop-shadow-xl">
                                        {formatTime(game.gameState.gameTime.minutes)}:{formatTime(game.gameState.gameTime.seconds)}
                                    </span>
                                </div>
                            </div>

                            <div className="h-40 grid grid-cols-2 gap-4">
                                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm">
                                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Period</span>
                                    <span className="text-6xl font-black italic text-white">{getPeriodName(game.gameState.period)}</span>
                                </div>
                                <div className="bg-black border-2 border-zinc-800 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-lg">
                                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Shot Clock</span>
                                    <span className={`text-7xl font-mono font-bold leading-none relative z-10 tabular-nums ${game.gameState.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-500'
                                        }`}>
                                        {game.gameState.shotClock}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* TEAM B PANEL */}
                        <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-full h-2" style={{ background: game.teamB.color }}></div>
                            <div className="flex justify-between items-start mb-2 flex-row-reverse">
                                <h2 className="text-2xl lg:text-4xl font-black italic uppercase tracking-tighter text-white truncate max-w-[85%] text-right">
                                    {game.teamB.name}
                                </h2>
                                {game.gameState.possession === 'B' && (
                                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_red] animate-pulse mt-2"></div>
                                )}
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <div
                                    className="text-[8rem] lg:text-[11rem] font-mono font-bold leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl"
                                    style={{ textShadow: `0 0 50px ${game.teamB.color}40` }}
                                >
                                    {game.teamB.score}
                                </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-zinc-800 pt-3 flex-row-reverse">
                                <div className="text-center">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Fouls</div>
                                    <div className="text-4xl font-mono font-bold text-red-500 tabular-nums">{game.teamB.fouls}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">
                                        Timeouts ({game.teamB.timeouts})
                                    </div>
                                    <div className="flex gap-1.5 flex-row-reverse">
                                        {[...Array(5)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-3 h-5 rounded-sm transition-all ${i < game.teamB.timeouts
                                                        ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                                                        : 'bg-zinc-800/50'
                                                    }`}
                                            ></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRO CONTROL DECK */}
            <div className="bg-zinc-950 border-t-4 border-zinc-900 p-4 shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] relative z-40">
                <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-4 h-full pt-2">

                    {/* TEAM A CONTROLS */}
                    <div className="col-span-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center pb-1 border-b border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate pl-2">
                                {game.teamA.name}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 h-16">
                            <TactileBtn label="+1" color={game.teamA.color} onClick={(e) => handleScoreWithPlayer(e, 'A', 1)} />
                            <TactileBtn label="+2" color={game.teamA.color} onClick={(e) => handleScoreWithPlayer(e, 'A', 2)} />
                            <TactileBtn label="+3" color={game.teamA.color} onClick={(e) => handleScoreWithPlayer(e, 'A', 3)} />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <AdminBtn
                                label="FOUL"
                                value={game.teamA.fouls}
                                type="danger"
                                onClick={(e) => handleFoulWithPlayer(e, 'A')}
                            />
                            <AdminBtn
                                label="TIMEOUT"
                                value={game.teamA.timeouts}
                                type="warning"
                                onClick={(e) => handleTimeout(e, 'A')}
                            />
                        </div>
                    </div>

                    {/* CENTER CONSOLE */}
                    <div className="col-span-6 bg-zinc-900/50 rounded-xl border border-zinc-800 p-2 flex flex-col gap-2">
                        <div className="flex-1 grid grid-cols-12 gap-2">
                            <div className="col-span-5 flex flex-col gap-1">
                                <button
                                    onClick={handleTimerToggle}
                                    className={`flex-1 rounded border-2 transition-all flex flex-col items-center justify-center active:scale-95 shadow-lg ${game.gameState.gameRunning
                                            ? 'bg-red-900/20 border-red-600/50 hover:bg-red-900/40 text-red-500'
                                            : 'bg-green-900/20 border-green-600/50 hover:bg-green-900/40 text-green-500'
                                        }`}
                                >
                                    <span className="text-2xl font-black uppercase italic tracking-wider">
                                        {game.gameState.gameRunning ? 'STOP' : 'START'}
                                    </span>
                                </button>
                                <button
                                    onClick={handleUndo}
                                    disabled={actionHistory.length === 0}
                                    className="h-8 bg-black border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                                >
                                    <Icons.Undo />
                                    UNDO {actionHistory.length > 0 && `(${actionHistory.length})`}
                                </button>
                            </div>
                            <div className="col-span-3 flex flex-col gap-1 border-x border-zinc-800 px-2">
                                <button
                                    onClick={(e) => handleResetShot(e, 24)}
                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded font-black text-xl shadow-md active:scale-95"
                                >
                                    24
                                </button>
                                <button
                                    onClick={(e) => handleResetShot(e, 14)}
                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded font-black text-xl shadow-md active:scale-95"
                                >
                                    14
                                </button>
                            </div>
                            <div className="col-span-4 flex flex-col gap-1">
                                <button
                                    onClick={handleTogglePossession}
                                    className="flex-1 bg-black border border-zinc-700 rounded flex items-center justify-center gap-2 hover:border-white transition-all group active:scale-95"
                                >
                                    <span className={`text-xl ${game.gameState.possession === 'A' ? 'text-white' : 'text-zinc-800'}`}>◀</span>
                                    <span className="text-[10px] font-bold text-zinc-500 group-hover:text-white">POSS</span>
                                    <span className={`text-xl ${game.gameState.possession === 'B' ? 'text-white' : 'text-zinc-800'}`}>▶</span>
                                </button>
                                <button
                                    onClick={() => playSound('horn')}
                                    className="h-8 bg-zinc-800 hover:bg-white hover:text-black border border-zinc-600 text-zinc-400 rounded text-[9px] font-black uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2"
                                >
                                    SIREN 🔊
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* TEAM B CONTROLS */}
                    <div className="col-span-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center pb-1 border-b border-zinc-800 flex-row-reverse">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                                {game.teamB.name}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 h-16">
                            <TactileBtn label="+3" color={game.teamB.color} onClick={(e) => handleScoreWithPlayer(e, 'B', 3)} />
                            <TactileBtn label="+2" color={game.teamB.color} onClick={(e) => handleScoreWithPlayer(e, 'B', 2)} />
                            <TactileBtn label="+1" color={game.teamB.color} onClick={(e) => handleScoreWithPlayer(e, 'B', 1)} />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <AdminBtn
                                label="TIMEOUT"
                                value={game.teamB.timeouts}
                                type="warning"
                                onClick={(e) => handleTimeout(e, 'B')}
                            />
                            <AdminBtn
                                label="FOUL"
                                value={game.teamB.fouls}
                                type="danger"
                                onClick={(e) => handleFoulWithPlayer(e, 'B')}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* HELP MODAL */}
            {showHelp && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 p-6 max-w-md w-full shadow-2xl rounded-xl">
                        <h3 className="text-xl font-bold mb-4 uppercase tracking-widest border-b border-zinc-700 pb-2">Shortcuts</h3>
                        <div className="space-y-2 text-sm text-zinc-400 font-mono">
                            <div className="flex justify-between"><span>SPACE</span> <span className="text-white">Start/Stop Clock</span></div>
                            <div className="flex justify-between"><span>R</span> <span className="text-white">Reset Shot (24s)</span></div>
                            <div className="flex justify-between"><span>T</span> <span className="text-white">Reset Shot (14s)</span></div>
                            <div className="flex justify-between"><span>P</span> <span className="text-white">Possession</span></div>
                            <div className="flex justify-between"><span>CTRL+Z</span> <span className="text-white">Undo</span></div>
                            <div className="flex justify-between"><span>H</span> <span className="text-white">Help</span></div>
                        </div>
                        <button
                            onClick={() => setShowHelp(false)}
                            className="mt-6 w-full py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-zinc-200 rounded"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* PLAYER SELECTION POPUP */}
            {showPlayerPopup && pendingAction && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPlayerPopup(false)}></div>

                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl rounded-sm">
                        <div className="flex justify-between items-center p-6 border-b border-zinc-800">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                                    {pendingAction.type === 'points' ? `+${pendingAction.value} POINT${pendingAction.value !== 1 ? 'S' : ''}` : 'FOUL'}
                                </h3>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Select player for {pendingAction.team === 'A' ? game.teamA.name : game.teamB.name}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPlayerPopup(false)}
                                className="text-zinc-500 hover:text-white text-2xl transition-colors"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {activePlayers.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-zinc-500 mb-4">No players in roster</p>
                                    <button
                                        onClick={skipPlayerSelection}
                                        className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-wider rounded transition-colors"
                                    >
                                        Continue Without Player
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                        {activePlayers.map(player => (
                                            <button
                                                key={player.id}
                                                onClick={() => confirmPlayerAction(player)}
                                                className="p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="text-2xl font-black text-zinc-600 group-hover:text-white transition-colors">
                                                        #{player.number || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-white truncate">
                                                            {player.name}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
                                                            {player.position || 'Player'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 text-[10px] text-zinc-600">
                                                    <span>PTS: {player.points || 0}</span>
                                                    <span>FOULS: {player.fouls || 0}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={skipPlayerSelection}
                                        className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded transition-colors"
                                    >
                                        Skip Player Selection
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- HELPER COMPONENTS ---
const TactileBtn = ({ label, color, onClick }: any) => (
    <button
        onClick={onClick}
        className="h-full rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-500 transition-all active:scale-95 active:bg-white group relative overflow-hidden shadow-sm"
        style={{ borderBottom: `3px solid ${color}` }}
    >
        <span className="relative z-10 text-xl font-black italic text-white group-active:text-black">{label}</span>
    </button>
);

const AdminBtn = ({ label, value, type, onClick }: any) => {
    const styles: any = {
        danger: "text-red-500 border-red-900/30 hover:bg-red-900/20",
        warning: "text-yellow-500 border-yellow-900/30 hover:bg-yellow-900/20"
    };
    return (
        <button
            onClick={onClick}
            className={`h-8 rounded bg-black border ${styles[type]} flex items-center justify-between px-2 transition-all active:scale-95 group`}
        >
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">{label}</span>
            <span className="font-mono font-bold text-sm">{value}</span>
        </button>
    );
};