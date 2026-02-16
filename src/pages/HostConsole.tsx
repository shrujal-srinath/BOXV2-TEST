// src/pages/HostConsole.tsx
// CLOCK CHANGE ONLY — zero UI changes.
// Removed: timerRef, setInterval block, updateGameTime Firestore writes
// Added: useRTDBTimer (isHost:true) — clock runs here, spectators receive via RTDB
// timer.minutes / timer.seconds / timer.shotClock / timer.gameRunning replace game.gameState.*
// timer.toggleClock() replaces toggleTimer()
// timer.nextPeriod() + advancePeriodFirestore() replace setPeriod()
// FIBA: handleFoul + handleTimeout now call timer.stopClock() when clock is running

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { useRTDBTimer } from '../hooks/useRTDBTimer';
import { deleteGame } from '../services/gameService';
import { useHardwareBridge } from '../hooks/useHardwareBridge';
import { ConnectControllerModal } from '../components/ConnectControllerModal';
import { TimeEditModal } from '../components/TimeEditModal';
import type { Player } from '../types';

// --- ICONS (original) ---
const Icons = {
    Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Share: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    Help: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Power: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>,
    Undo: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
};

type GameAction = {
    type: 'score' | 'foul' | 'timeout';
    team: 'A' | 'B';
    value: number;
    playerId?: string;
    timestamp: number;
};

const formatTime = (num: number) => num.toString().padStart(2, '0');
const playSound = (type: 'horn' | 'whistle') => console.log(`🔊 ${type}`);

const getPeriodName = (period: number) => {
    if (period <= 4) return `Q${period}`;
    return `OT${period - 4}`;
};

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [shareMenuOpen, setShareMenuOpen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [showTimeEdit, setShowTimeEdit] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [actionHistory, setActionHistory] = useState<GameAction[]>([]);
    const [showPlayerPopup, setShowPlayerPopup] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        team: 'A' | 'B';
        type: 'points' | 'foul';
        value: number;
    } | null>(null);

    // Firestore: scores, fouls, timeouts, possession, roster
    const { game, handleAction, togglePossession, advancePeriodFirestore } =
        useBasketballGame(gameCode || '', 'online');

    // RTDB: clock display + controls — replaces the old timerRef setInterval
    const timer = useRTDBTimer({
        gameCode: gameCode || '',
        isHost: true,
        periodDuration: game?.settings.periodDuration ?? 10,
        shotClockDuration: game?.settings.shotClockDuration ?? 24,
    });

    const { lastInput, ackInput, updateScreen, isConnected, sendCommand } = useHardwareBridge();
    const gameRef = useRef(game);
    useEffect(() => { gameRef.current = game; }, [game]);

    useEffect(() => {
        const unsubscribe = subscribeToAuth((user) => { if (user) setUserId(user.uid); });
        return () => unsubscribe();
    }, []);

    // Period end horn
    useEffect(() => {
        const onPeriodEnd = () => playSound('horn');
        window.addEventListener('periodEnd', onPeriodEnd);
        return () => window.removeEventListener('periodEnd', onPeriodEnd);
    }, []);

    // Hardware screen sync
    useEffect(() => {
        if (!game) return;
        updateScreen(
            `${game.teamA.name} ${game.teamA.score}-${game.teamB.score} ${game.teamB.name}`,
            `${formatTime(timer.minutes)}:${formatTime(timer.seconds)}`,
            `${getPeriodName(timer.period)} SHOT:${timer.shotClock}s`
        );
    }, [game, timer.minutes, timer.seconds, timer.period, timer.shotClock, updateScreen]);

    // Hardware button input
    useEffect(() => {
        if (!lastInput || lastInput.handled || !game) return;
        switch (lastInput.button) {
            case 'PAUSE': timer.toggleClock(); break;
            case 'A': handleScoreWithPlayer(null, 'A', 2); break;
            case 'B': handleScoreWithPlayer(null, 'B', 2); break;
            case 'C': handleScoreWithPlayer(null, 'A', 1); break;
            case 'UNDO': handleUndo(); break;
            case 'QUARTER': handleNextPeriod(); break;
        }
        ackInput();
    }, [lastInput]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
            else if (e.key === ' ') { e.preventDefault(); handleTimerToggle(null as any); }
            else if (e.key.toLowerCase() === 'r') { handleResetShot(null as any, game?.settings.shotClockDuration ?? 24); }
            else if (e.key.toLowerCase() === 't') { handleResetShot(null as any, 14); }
            else if (e.key.toLowerCase() === 'p') { handleTogglePossession(null as any); }
            else if (e.key.toLowerCase() === 'h') { setShowHelp(prev => !prev); }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [actionHistory, game]);

    const recordAction = (action: GameAction) => setActionHistory(prev => [...prev.slice(-9), action]);

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
        recordAction({ type: type === 'points' ? 'score' : 'foul', team, value, playerId: player.id, timestamp: Date.now() });
        handleAction(team, type, value);
        // FIBA: clock stops on foul
        if (type === 'foul' && timer.gameRunning) timer.stopClock();
        if (isConnected && type === 'points') sendCommand({ cmd: 'BEEP' });
        setShowPlayerPopup(false);
        setPendingAction(null);
    };

    const skipPlayerSelection = () => {
        if (!pendingAction) return;
        const { team, type, value } = pendingAction;
        recordAction({ type: type === 'points' ? 'score' : 'foul', team, value, timestamp: Date.now() });
        handleAction(team, type, value);
        if (type === 'foul' && timer.gameRunning) timer.stopClock();
        if (isConnected && type === 'points') sendCommand({ cmd: 'BEEP' });
        setShowPlayerPopup(false);
        setPendingAction(null);
    };

    const handleTimeout = (e: React.MouseEvent | null, team: 'A' | 'B') => {
        e?.stopPropagation();
        recordAction({ type: 'timeout', team, value: -1, timestamp: Date.now() });
        handleAction(team, 'timeout', -1);
        // FIBA: clock stops on timeout
        if (timer.gameRunning) timer.stopClock();
    };

    const handleResetShot = (e: React.MouseEvent | null, val: number) => {
        e?.stopPropagation();
        timer.resetShotClock(val);
    };

    const handleTimerToggle = (e: React.MouseEvent | null) => {
        e?.stopPropagation();
        timer.toggleClock();
    };

    const handleTogglePossession = (e: React.MouseEvent | null) => {
        e?.stopPropagation();
        togglePossession();
    };

    const handleUndo = () => {
        if (actionHistory.length === 0) { alert('No actions to undo'); return; }
        const lastAction = actionHistory[actionHistory.length - 1];
        if (lastAction.type === 'score') handleAction(lastAction.team, 'points', -lastAction.value);
        else if (lastAction.type === 'foul') handleAction(lastAction.team, 'foul', -lastAction.value);
        else if (lastAction.type === 'timeout') handleAction(lastAction.team, 'timeout', -lastAction.value);
        setActionHistory(prev => prev.slice(0, -1));
    };

    const handleNextPeriod = () => {
        const newPeriod = timer.period + 1;
        timer.nextPeriod();               // RTDB: clock reset
        advancePeriodFirestore(newPeriod); // Firestore: fouls reset, period number
    };

    const handleClockSave = (min: number, sec: number, shot: number) => {
        timer.editClocks(min, sec, shot);
        setShowTimeEdit(false);
    };

    const handleEndGame = async () => {
        if (!confirm('End this game?')) return;
        await deleteGame(gameCode || '');
        navigate('/dashboard');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(gameCode || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const watchUrl = `${window.location.origin}/watch/${gameCode}`;

    if (!game || game.hostId === 'loading') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-pulse text-zinc-500 font-mono text-sm uppercase tracking-widest">Loading game...</div>
            </div>
        );
    }

    const activePlayers = (pendingAction?.team === 'A' ? game.teamA.players : game.teamB.players)
        .filter(p => p.name || p.number);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden">

            {/* HEADER */}
            <header className="shrink-0 bg-zinc-950 border-b border-zinc-900 px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-white font-black text-lg tracking-tight shrink-0">THE BOX</span>
                    <span className="text-zinc-800">|</span>
                    <span className="text-zinc-400 text-sm font-medium truncate">{game.settings.gameName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${isConnected ? 'text-green-500 bg-green-950/50' : 'text-zinc-600 bg-zinc-900'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`}></div>
                        {isConnected ? 'HW LINKED' : 'NO HW'}
                    </div>
                    <button onClick={() => setShowConnectModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-[10px] font-bold uppercase tracking-widest">
                        Link Controller
                    </button>
                    <div className="relative">
                        <button onClick={() => setShareMenuOpen(!shareMenuOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                            <Icons.Share />
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Share</span>
                        </button>
                        {shareMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-950 border border-zinc-800 rounded-xl p-4 z-50 shadow-2xl">
                                <p className="text-zinc-500 text-xs uppercase tracking-widest mb-3">Spectator Link</p>
                                <div className="flex gap-2 items-center bg-black rounded-lg p-3 border border-zinc-800">
                                    <span className="text-zinc-400 text-xs font-mono flex-1 truncate">{watchUrl}</span>
                                    <button onClick={handleCopy} className="shrink-0 text-zinc-500 hover:text-white">
                                        {copied ? <Icons.Check /> : <Icons.Copy />}
                                    </button>
                                </div>
                                <p className="text-zinc-600 text-[10px] mt-2">Game Code: <span className="text-white font-mono">{gameCode}</span></p>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowHelp(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"><Icons.Help /></button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all" title="Download CSV">
                        <span className="text-sm">⬇</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Export</span>
                    </button>
                    <button onClick={handleEndGame} className="px-4 py-1.5 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 text-red-500 hover:text-red-400 rounded text-[10px] font-bold uppercase tracking-widest transition-all">End</button>
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
                                <h2 className="text-2xl lg:text-4xl font-black italic uppercase tracking-tighter text-white truncate max-w-[85%]">{game.teamA.name}</h2>
                                {game.gameState.possession === 'A' && <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_red] animate-pulse mt-2"></div>}
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-[8rem] lg:text-[11rem] font-mono font-bold leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl" style={{ textShadow: `0 0 50px ${game.teamA.color}40` }}>
                                    {game.teamA.score}
                                </div>
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

                        {/* CENTER CLOCK TOWER */}
                        <div className="col-span-4 flex flex-col gap-4 relative z-20">
                            <div className="flex-1 bg-black border-2 border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                                <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em] mb-2 z-10">Game Time</div>
                                {/* timer.minutes / timer.seconds from RTDB */}
                                <div className={`relative z-10 flex items-baseline gap-1 transition-colors duration-300 ${timer.gameRunning ? 'text-white' : 'text-zinc-400'}`}>
                                    <span className="text-[6rem] lg:text-[8.5rem] font-mono font-bold leading-none tracking-tight tabular-nums drop-shadow-xl">
                                        {formatTime(timer.minutes)}:{formatTime(timer.seconds)}
                                    </span>
                                </div>
                            </div>
                            <div className="h-40 grid grid-cols-2 gap-4">
                                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm">
                                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Period</span>
                                    {/* timer.period from RTDB */}
                                    <span className="text-6xl font-black italic text-white">{getPeriodName(timer.period)}</span>
                                </div>
                                <div className="bg-black border-2 border-zinc-800 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-lg">
                                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Shot Clock</span>
                                    {/* timer.shotClock from RTDB */}
                                    <span className={`text-7xl font-mono font-bold leading-none relative z-10 tabular-nums ${timer.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                                        {timer.shotClock}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* TEAM B PANEL */}
                        <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-full h-2" style={{ background: game.teamB.color }}></div>
                            <div className="flex justify-between items-start mb-2 flex-row-reverse">
                                <h2 className="text-2xl lg:text-4xl font-black italic uppercase tracking-tighter text-white truncate max-w-[85%] text-right">{game.teamB.name}</h2>
                                {game.gameState.possession === 'B' && <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_15px_blue] animate-pulse mt-2"></div>}
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-[8rem] lg:text-[11rem] font-mono font-bold leading-none tracking-tighter text-white tabular-nums drop-shadow-2xl" style={{ textShadow: `0 0 50px ${game.teamB.color}40` }}>
                                    {game.teamB.score}
                                </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-zinc-800 pt-3">
                                <div className="text-center">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Timeouts ({game.teamB.timeouts})</div>
                                    <div className="flex gap-1.5">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className={`w-3 h-5 rounded-sm transition-all ${i < game.teamB.timeouts ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-zinc-800/50'}`}></div>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Fouls</div>
                                    <div className="text-4xl font-mono font-bold text-red-500 tabular-nums">{game.teamB.fouls}</div>
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
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate pl-2">{game.teamA.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 h-16">
                            <TactileBtn label="+1" color={game.teamA.color} onClick={(e: any) => handleScoreWithPlayer(e, 'A', 1)} />
                            <TactileBtn label="+2" color={game.teamA.color} onClick={(e: any) => handleScoreWithPlayer(e, 'A', 2)} />
                            <TactileBtn label="+3" color={game.teamA.color} onClick={(e: any) => handleScoreWithPlayer(e, 'A', 3)} />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <AdminBtn label="FOUL" value={game.teamA.fouls} type="danger" onClick={(e: any) => handleFoulWithPlayer(e, 'A')} />
                            <AdminBtn label="TIMEOUT" value={game.teamA.timeouts} type="warning" onClick={(e: any) => handleTimeout(e, 'A')} />
                        </div>
                    </div>

                    {/* CENTER CONSOLE */}
                    <div className="col-span-6 bg-zinc-900/50 rounded-xl border border-zinc-800 p-2 flex flex-col gap-2">
                        <div className="flex-1 grid grid-cols-12 gap-2">
                            <div className="col-span-5 flex flex-col gap-1">
                                {/* START/STOP uses timer.toggleClock() */}
                                <button
                                    onClick={handleTimerToggle}
                                    className={`flex-1 rounded border-2 transition-all flex flex-col items-center justify-center active:scale-95 shadow-lg ${timer.gameRunning
                                        ? 'bg-red-900/20 border-red-600/50 hover:bg-red-900/40 text-red-500'
                                        : 'bg-green-900/20 border-green-600/50 hover:bg-green-900/40 text-green-500'
                                        }`}
                                >
                                    <span className="text-2xl font-black uppercase italic tracking-wider">
                                        {timer.gameRunning ? '⏸ STOP' : '▶ START'}
                                    </span>
                                </button>
                                <div className="grid grid-cols-2 gap-1">
                                    <button onClick={(e) => handleResetShot(e, game.settings.shotClockDuration ?? 24)} className="h-8 bg-amber-950/30 border border-amber-900/30 text-amber-500 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-amber-900/20 active:scale-95 transition-all">
                                        {game.settings.shotClockDuration ?? 24}s
                                    </button>
                                    <button onClick={(e) => handleResetShot(e, 14)} className="h-8 bg-orange-950/30 border border-orange-900/30 text-orange-500 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-orange-900/20 active:scale-95 transition-all">
                                        14s
                                    </button>
                                </div>
                            </div>
                            <div className="col-span-7 flex flex-col gap-1">
                                <button onClick={handleTogglePossession} className="h-8 bg-blue-950/30 border border-blue-900/30 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-blue-900/20 active:scale-95 transition-all">
                                    {game.gameState.possession === 'A' ? `◀ ${game.teamA.name}` : `${game.teamB.name} ▶`} Possession
                                </button>
                                <button onClick={handleNextPeriod} className="h-8 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-zinc-700 active:scale-95 transition-all">
                                    Next {game.settings.periodType === 'half' ? 'Half' : 'Quarter'} →
                                </button>
                                <button onClick={() => setShowTimeEdit(true)} className="h-8 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-zinc-800 active:scale-95 transition-all">
                                    Edit Time
                                </button>
                                <button onClick={handleUndo} className="h-8 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-zinc-800 active:scale-95 flex items-center justify-center gap-1 transition-all">
                                    <Icons.Undo /><span>Undo</span>
                                </button>
                            </div>
                        </div>
                        <div className="h-14 overflow-y-auto border-t border-zinc-800 pt-1">
                            {actionHistory.length === 0
                                ? <div className="text-[10px] text-zinc-700 italic text-center py-1">No actions yet</div>
                                : [...actionHistory].reverse().slice(0, 4).map((a, i) => (
                                    <div key={i} className="text-[9px] text-zinc-500 font-mono truncate py-0.5">
                                        {a.type.toUpperCase()} · {a.team === 'A' ? game.teamA.name : game.teamB.name}
                                        {a.type === 'score' ? ` +${a.value}` : ''}
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* TEAM B CONTROLS */}
                    <div className="col-span-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center pb-1 border-b border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate pl-2">{game.teamB.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 h-16">
                            <TactileBtn label="+1" color={game.teamB.color} onClick={(e: any) => handleScoreWithPlayer(e, 'B', 1)} />
                            <TactileBtn label="+2" color={game.teamB.color} onClick={(e: any) => handleScoreWithPlayer(e, 'B', 2)} />
                            <TactileBtn label="+3" color={game.teamB.color} onClick={(e: any) => handleScoreWithPlayer(e, 'B', 3)} />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <AdminBtn label="TIMEOUT" value={game.teamB.timeouts} type="warning" onClick={(e: any) => handleTimeout(e, 'B')} />
                            <AdminBtn label="FOUL" value={game.teamB.fouls} type="danger" onClick={(e: any) => handleFoulWithPlayer(e, 'B')} />
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
                            <div className="flex justify-between"><span>SPACE</span><span className="text-white">Start/Stop Clock</span></div>
                            <div className="flex justify-between"><span>R</span><span className="text-white">Reset Shot (24s)</span></div>
                            <div className="flex justify-between"><span>T</span><span className="text-white">Reset Shot (14s)</span></div>
                            <div className="flex justify-between"><span>P</span><span className="text-white">Possession</span></div>
                            <div className="flex justify-between"><span>CTRL+Z</span><span className="text-white">Undo</span></div>
                            <div className="flex justify-between"><span>H</span><span className="text-white">Help</span></div>
                        </div>
                        <button onClick={() => setShowHelp(false)} className="mt-6 w-full py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-zinc-200 rounded">Close</button>
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
                                <p className="text-xs text-zinc-500 mt-1">Select player for {pendingAction.team === 'A' ? game.teamA.name : game.teamB.name}</p>
                            </div>
                            <button onClick={() => setShowPlayerPopup(false)} className="text-zinc-500 hover:text-white text-2xl transition-colors">&times;</button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {activePlayers.length === 0 ? (
                                <p className="text-zinc-500 text-center py-8">No players with names/numbers set up.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {activePlayers.map(player => (
                                        <button key={player.id} onClick={() => confirmPlayerAction(player)} className="flex items-center gap-3 p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-lg transition-all group text-left">
                                            <div className="w-10 h-10 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center shrink-0">
                                                <span className="text-white font-black text-sm">#{player.number}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-white truncate">{player.name}</div>
                                                <div className="text-[10px] text-zinc-600 uppercase tracking-wider">{player.position || 'Player'}</div>
                                            </div>
                                            <div className="flex gap-3 text-[10px] text-zinc-600">
                                                <span>PTS: {player.points || 0}</span>
                                                <span>FOULS: {player.fouls || 0}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button onClick={skipPlayerSelection} className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded transition-colors">
                                Skip Player Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TIME EDIT MODAL — passes timer values, saves via timer.editClocks */}
            <TimeEditModal
                isOpen={showTimeEdit}
                onClose={() => setShowTimeEdit(false)}
                gameTime={{ minutes: timer.minutes, seconds: timer.seconds }}
                shotClock={timer.shotClock}
                onSave={handleClockSave}
            />

            {/* HARDWARE CONNECTION MODAL */}
            {showConnectModal && (
                <ConnectControllerModal
                    userId={userId || 'anon'}
                    onClose={() => setShowConnectModal(false)}
                    onSuccess={() => setTimeout(() => setShowConnectModal(false), 1500)}
                />
            )}
        </div>
    );
};

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

export default HostConsole;