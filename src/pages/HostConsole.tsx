// src/pages/HostConsole.tsx
/**
 * HOST CONSOLE — The Brain for cloud/online games
 *
 * HARDWARE BRIDGE ADDED:
 *  ✅ ESP32 button presses routed to game actions
 *  ✅ ESP32 LCD mirrors live game state (scores, clock, period)
 *  ✅ Hardware connection indicator in header
 *  ✅ TabletController is completely untouched
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { useHardwareBridge } from '../hooks/useHardwareBridge';
import { deleteGame } from '../services/gameService';
import type { Player } from '../types';

// ─── Icons ────────────────────────────────────────────────────────
const Icons = {
    Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Share: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    Help: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Power: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>,
    Undo: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
    Controller: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a1 1 0 01-1-1V8a1 1 0 011-1h1a2 2 0 100-4H4a1 1 0 01-1-1V4a1 1 0 011-1h3a1 1 0 001-1v-1z" /></svg>,
};

// ─── Types ────────────────────────────────────────────────────────
type GameAction = {
    type: 'score' | 'foul' | 'timeout';
    team: 'A' | 'B';
    value: number;
    playerId?: string;
    timestamp: number;
};

// ─── Helpers ──────────────────────────────────────────────────────
const formatTime = (num: number) => num.toString().padStart(2, '0');
const playSound = (type: 'horn' | 'whistle') => console.log(`🔊 ${type}`);

// ─── Sub-components ───────────────────────────────────────────────
const TactileBtn: React.FC<{
    label: string;
    color?: string;
    onClick: (e: React.MouseEvent) => void;
}> = ({ label, color = '#ffffff', onClick }) => (
    <button
        onClick={onClick}
        className="flex-1 h-full rounded border-2 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 active:scale-95 transition-all font-black text-2xl shadow-md"
        style={{ color }}
    >
        {label}
    </button>
);

const AdminBtn: React.FC<{
    label: string;
    value?: number;
    type?: 'danger' | 'warning' | 'default';
    onClick: (e: React.MouseEvent) => void;
}> = ({ label, value, type = 'default', onClick }) => {
    const colors = {
        danger: 'border-red-900/50 text-red-400 hover:border-red-600',
        warning: 'border-yellow-900/50 text-yellow-400 hover:border-yellow-600',
        default: 'border-zinc-700 text-zinc-400 hover:border-zinc-500',
    };
    return (
        <button
            onClick={onClick}
            className={`h-10 rounded border bg-black flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs font-bold uppercase tracking-widest ${colors[type]}`}
        >
            {label}
            {value !== undefined && (
                <span className="text-xs opacity-60">({value})</span>
            )}
        </button>
    );
};

// ─── Hardware Status Badge ─────────────────────────────────────────
const HardwareBadge: React.FC<{
    isConnected: boolean;
    transport: string;
    latencyMs: number | null;
}> = ({ isConnected, transport, latencyMs }) => {
    if (!isConnected) return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">NO CONTROLLER</span>
        </div>
    );

    const isWS = transport === 'websocket';
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${isWS ? 'bg-green-900/20 border-green-800/50' : 'bg-blue-900/20 border-blue-800/50'}`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isWS ? 'bg-green-400' : 'bg-blue-400'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isWS ? 'text-green-400' : 'text-blue-400'}`}>
                {isWS ? 'LOCAL WS' : 'CLOUD RTDB'}
            </span>
            {latencyMs !== null && (
                <span className="text-[10px] text-zinc-500 font-mono">{latencyMs}ms</span>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();

    const [copied, setCopied] = useState(false);
    const [shareMenuOpen, setShareMenuOpen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [actionHistory, setActionHistory] = useState<GameAction[]>([]);
    const [showPlayerPopup, setShowPlayerPopup] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        team: 'A' | 'B';
        type: 'points' | 'foul';
        value: number;
    } | null>(null);

    // ── Game engine (THE brain — Firebase backed) ──────────────────
    const {
        game,
        toggleTimer,
        updateGameTime,
        resetShotClock,
        handleAction,
        togglePossession,
    } = useBasketballGame(gameCode || '', 'online');

    // ── Hardware bridge (ESP32 ↔ website) ──────────────────────────
    const {
        isConnected: hwConnected,
        transport: hwTransport,
        latencyMs: hwLatency,
        lastInput,
        updateScreen,
        ackInput,
    } = useHardwareBridge();

    // ── Refs for timer (avoids stale closure in interval) ──────────
    const gameRef = useRef(game);
    const gameStateRef = useRef(game?.gameState);
    useEffect(() => {
        gameRef.current = game;
        gameStateRef.current = game?.gameState;
    }, [game]);

    // ─────────────────────────────────────────────────────────────
    // TIMER INTERVAL
    // ─────────────────────────────────────────────────────────────
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (game?.gameState?.gameRunning) {
            if (!timerRef.current) {
                timerRef.current = window.setInterval(() => {
                    const currentState = gameStateRef.current;
                    if (!currentState) return;

                    const currentTotalSec =
                        currentState.gameTime.minutes * 60 + currentState.gameTime.seconds;
                    const currentShotClock = currentState.shotClock;

                    if (currentTotalSec > 0) {
                        const newTotal = currentTotalSec - 1;
                        const newShot = currentShotClock > 0 ? currentShotClock - 1 : 0;
                        updateGameTime(
                            Math.floor(newTotal / 60),
                            newTotal % 60,
                            newShot
                        );
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

    // ─────────────────────────────────────────────────────────────
    // ESP32 SCREEN MIRROR
    // Pushes live game state to Nokia LCD on the controller.
    // Fires whenever score, clock, shot clock, period, or run state changes.
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!hwConnected || !game) return;

        const { teamA, teamB, gameState, settings } = game;

        // Line 1: scores  →  "24 - 18"
        const line1 = `${teamA.score} - ${teamB.score}`;

        // Line 2: clock + shot clock  →  "08:45 | 14"
        const mm = formatTime(gameState.gameTime.minutes);
        const ss = formatTime(gameState.gameTime.seconds);
        const line2 = `${mm}:${ss} | ${gameState.shotClock}`;

        // Footer: period + clock state  →  "Q2  LIVE"
        const periodLabel =
            settings.periodType === 'half'
                ? `H${gameState.period}`
                : `Q${gameState.period}`;
        const footer = `${periodLabel}  ${gameState.gameRunning ? 'LIVE' : 'STOP'}`;

        updateScreen(line1, line2, footer);
    }, [
        game?.teamA.score,
        game?.teamB.score,
        game?.gameState.gameTime.minutes,
        game?.gameState.gameTime.seconds,
        game?.gameState.shotClock,
        game?.gameState.period,
        game?.gameState.gameRunning,
        hwConnected,
    ]);

    // ─────────────────────────────────────────────────────────────
    // ESP32 BUTTON HANDLER
    // Routes physical button presses to the exact same functions
    // the on-screen buttons call. Nothing special — same handlers.
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!lastInput || lastInput.handled) return;

        const { button } = lastInput;

        switch (button) {
            case 'A':
                // Score home +2 (most common basketball score)
                handleAction('A', 'points', 2);
                recordAction({ type: 'score', team: 'A', value: 2, timestamp: Date.now() });
                break;
            case 'B':
                // Score away +2
                handleAction('B', 'points', 2);
                recordAction({ type: 'score', team: 'B', value: 2, timestamp: Date.now() });
                break;
            case 'C':
                // Reset shot clock to 24s
                resetShotClock(24);
                break;
            case 'PAUSE':
                // Toggle clock — most time-critical action, benefits most from WS transport
                toggleTimer();
                break;
            case 'QUARTER':
                // No confirm dialog on hardware — too slow for live game
                // Just advances period directly
                if (game) {
                    updateGameTime(
                        game.settings.periodDuration,
                        0,
                        game.settings.shotClockDuration
                    );
                }
                break;
            case 'UNDO':
                handleUndo();
                break;
            default:
                console.log('[HW] Unknown button:', button);
        }

        ackInput();
    }, [lastInput]);

    // ─────────────────────────────────────────────────────────────
    // KEYBOARD SHORTCUTS
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
            else if (e.key === ' ') { e.preventDefault(); handleTimerToggle(null as any); }
            else if (e.key.toLowerCase() === 'r') handleResetShot(null as any, 24);
            else if (e.key.toLowerCase() === 't') handleResetShot(null as any, 14);
            else if (e.key.toLowerCase() === 'p') handleTogglePossession(null as any);
            else if (e.key.toLowerCase() === 'h') setShowHelp(prev => !prev);
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [actionHistory]);

    // ─────────────────────────────────────────────────────────────
    // ACTION HANDLERS
    // ─────────────────────────────────────────────────────────────
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
            timestamp: Date.now(),
        });
        handleAction(team, type, value);
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
            timestamp: Date.now(),
        });
        handleAction(team, type, value);
        setShowPlayerPopup(false);
        setPendingAction(null);
    };

    const handleTimeout = (e: React.MouseEvent | null, team: 'A' | 'B') => {
        e?.stopPropagation();
        recordAction({ type: 'timeout', team, value: -1, timestamp: Date.now() });
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
        if (actionHistory.length === 0) { alert('No actions to undo'); return; }
        const lastAction = actionHistory[actionHistory.length - 1];
        if (lastAction.type === 'score') handleAction(lastAction.team, 'points', -lastAction.value);
        else if (lastAction.type === 'foul') handleAction(lastAction.team, 'foul', -lastAction.value);
        else if (lastAction.type === 'timeout') handleAction(lastAction.team, 'timeout', -lastAction.value);
        setActionHistory(prev => prev.slice(0, -1));
    };

    // ─────────────────────────────────────────────────────────────
    // HEADER ACTIONS
    // ─────────────────────────────────────────────────────────────
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
            navigator.share({ title: `Watch ${game?.settings.gameName}`, url }).catch(() => {
                navigator.clipboard.writeText(url);
                alert('Watch link copied!');
            });
        } else {
            navigator.clipboard.writeText(url);
            setShareMenuOpen(false);
            alert('Watch link copied!');
        }
    };

    // ─────────────────────────────────────────────────────────────
    // LOADING STATE
    // ─────────────────────────────────────────────────────────────
    if (!game) {
        return (
            <div className="w-screen h-screen bg-black flex items-center justify-center">
                <div className="text-zinc-500 font-mono text-sm animate-pulse uppercase tracking-widest">
                    Loading game…
                </div>
            </div>
        );
    }

    const { teamA, teamB, gameState, settings } = game;

    const periodLabel =
        settings.periodType === 'half'
            ? gameState.period <= 2 ? `HALF ${gameState.period}` : 'OT'
            : gameState.period <= 4 ? `Q${gameState.period}` : 'OT';

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="w-screen h-screen bg-black flex flex-col overflow-hidden select-none">

            {/* ── HEADER ───────────────────────────────────────────── */}
            <div className="shrink-0 h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-zinc-600 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                    >
                        ← DASHBOARD
                    </button>
                    <span className="text-zinc-800">|</span>
                    <span className="text-zinc-400 font-black uppercase tracking-wider text-sm">
                        {settings.gameName || 'HOST CONSOLE'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Hardware controller status badge */}
                    <HardwareBadge
                        isConnected={hwConnected}
                        transport={hwTransport}
                        latencyMs={hwLatency}
                    />

                    {/* Game code copy */}
                    <button
                        onClick={copyGameCode}
                        className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs font-mono text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
                    >
                        {copied ? <Icons.Check /> : <Icons.Copy />}
                        {gameCode}
                    </button>

                    {/* Share */}
                    <button
                        onClick={shareWatchLink}
                        className="p-2 text-zinc-500 hover:text-white transition-colors"
                        title="Share watch link"
                    >
                        <Icons.Share />
                    </button>

                    {/* Help */}
                    <button
                        onClick={() => setShowHelp(true)}
                        className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                        <Icons.Help />
                    </button>
                </div>
            </div>

            {/* ── JUMBOTRON SCOREBOARD ─────────────────────────────── */}
            <div className="flex-1 grid grid-cols-12 min-h-0">

                {/* Team A score */}
                <div className="col-span-4 flex flex-col items-center justify-center border-r border-zinc-900 bg-zinc-950/50">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mb-2">
                        {teamA.name || 'HOME'}
                    </span>
                    <span className="text-[120px] font-black leading-none tabular-nums"
                        style={{ color: teamA.color || '#ffffff' }}>
                        {teamA.score}
                    </span>
                    <div className="flex gap-4 mt-2 text-xs font-mono text-zinc-600">
                        <span>FLS: {teamA.fouls}</span>
                        <span>T/O: {teamA.timeouts}</span>
                    </div>
                    {/* Possession indicator */}
                    {gameState.possession === 'A' && (
                        <div className="mt-3 w-2 h-2 rounded-full bg-white animate-pulse" />
                    )}
                </div>

                {/* Center clock */}
                <div className="col-span-4 flex flex-col items-center justify-center gap-2">
                    <span className="text-zinc-600 text-xs font-bold uppercase tracking-widest">
                        {periodLabel}
                    </span>
                    <span className={`text-6xl font-black font-mono tabular-nums ${gameState.gameRunning ? 'text-white' : 'text-zinc-500'}`}>
                        {formatTime(gameState.gameTime.minutes)}:{formatTime(gameState.gameTime.seconds)}
                    </span>
                    <div className={`text-4xl font-black font-mono tabular-nums ${gameState.shotClock <= 5 ? 'text-red-500' : 'text-yellow-400'}`}>
                        {gameState.shotClock}
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${gameState.gameRunning ? 'text-green-500' : 'text-red-500'}`}>
                        {gameState.gameRunning ? '● RUNNING' : '■ STOPPED'}
                    </div>
                </div>

                {/* Team B score */}
                <div className="col-span-4 flex flex-col items-center justify-center border-l border-zinc-900 bg-zinc-950/50">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mb-2">
                        {teamB.name || 'AWAY'}
                    </span>
                    <span className="text-[120px] font-black leading-none tabular-nums"
                        style={{ color: teamB.color || '#ef4444' }}>
                        {teamB.score}
                    </span>
                    <div className="flex gap-4 mt-2 text-xs font-mono text-zinc-600">
                        <span>FLS: {teamB.fouls}</span>
                        <span>T/O: {teamB.timeouts}</span>
                    </div>
                    {gameState.possession === 'B' && (
                        <div className="mt-3 w-2 h-2 rounded-full bg-white animate-pulse" />
                    )}
                </div>
            </div>

            {/* ── CONTROL DECK ─────────────────────────────────────── */}
            <div className="shrink-0 bg-zinc-950 border-t-4 border-zinc-900 p-3">
                <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-3 h-36">

                    {/* Team A controls */}
                    <div className="col-span-3 flex flex-col gap-2">
                        <div className="pb-1 border-b border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                {teamA.name || 'HOME'}
                            </span>
                        </div>
                        <div className="flex gap-1 h-12">
                            <TactileBtn label="+1" color={teamA.color} onClick={(e) => handleScoreWithPlayer(e, 'A', 1)} />
                            <TactileBtn label="+2" color={teamA.color} onClick={(e) => handleScoreWithPlayer(e, 'A', 2)} />
                            <TactileBtn label="+3" color={teamA.color} onClick={(e) => handleScoreWithPlayer(e, 'A', 3)} />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <AdminBtn label="FOUL" value={teamA.fouls} type="danger" onClick={(e) => handleFoulWithPlayer(e, 'A')} />
                            <AdminBtn label="T/O" value={teamA.timeouts} type="warning" onClick={(e) => handleTimeout(e, 'A')} />
                        </div>
                    </div>

                    {/* Center controls */}
                    <div className="col-span-6 flex flex-col gap-2">
                        <div className="flex-1 grid grid-cols-12 gap-2">

                            {/* Clock toggle */}
                            <div className="col-span-5 flex flex-col gap-1">
                                <button
                                    onClick={handleTimerToggle}
                                    className={`flex-1 rounded border-2 transition-all flex flex-col items-center justify-center active:scale-95 shadow-lg ${gameState.gameRunning
                                            ? 'bg-red-900/20 border-red-600/50 hover:bg-red-900/40 text-red-500'
                                            : 'bg-green-900/20 border-green-600/50 hover:bg-green-900/40 text-green-500'
                                        }`}
                                >
                                    <span className="text-2xl font-black uppercase italic tracking-wider">
                                        {gameState.gameRunning ? 'STOP' : 'START'}
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

                            {/* Shot clock resets */}
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

                            {/* Possession + period */}
                            <div className="col-span-4 flex flex-col gap-1">
                                <button
                                    onClick={handleTogglePossession}
                                    className="flex-1 bg-black border border-zinc-700 rounded flex items-center justify-center gap-2 hover:border-white transition-all group active:scale-95"
                                >
                                    <span className={`text-xl ${gameState.possession === 'A' ? 'text-white' : 'text-zinc-800'}`}>◀</span>
                                    <span className="text-[10px] font-bold text-zinc-500 group-hover:text-white">POSS</span>
                                    <span className={`text-xl ${gameState.possession === 'B' ? 'text-white' : 'text-zinc-800'}`}>▶</span>
                                </button>
                                <div className="flex gap-1">
                                    {/* Period dots */}
                                    {Array.from({ length: settings.periodType === 'half' ? 2 : 4 }, (_, i) => (
                                        <div
                                            key={i}
                                            className={`flex-1 h-3 rounded-sm ${i < gameState.period
                                                ? 'bg-yellow-500'
                                                : 'bg-zinc-800/50'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Team B controls */}
                    <div className="col-span-3 flex flex-col gap-2">
                        <div className="pb-1 border-b border-zinc-800 text-right">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                {teamB.name || 'AWAY'}
                            </span>
                        </div>
                        <div className="flex gap-1 h-12">
                            <TactileBtn label="+1" color={teamB.color} onClick={(e) => handleScoreWithPlayer(e, 'B', 1)} />
                            <TactileBtn label="+2" color={teamB.color} onClick={(e) => handleScoreWithPlayer(e, 'B', 2)} />
                            <TactileBtn label="+3" color={teamB.color} onClick={(e) => handleScoreWithPlayer(e, 'B', 3)} />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <AdminBtn label="FOUL" value={teamB.fouls} type="danger" onClick={(e) => handleFoulWithPlayer(e, 'B')} />
                            <AdminBtn label="T/O" value={teamB.timeouts} type="warning" onClick={(e) => handleTimeout(e, 'B')} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PLAYER SELECTION POPUP ───────────────────────────── */}
            {showPlayerPopup && pendingAction && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-sm font-black uppercase tracking-widest mb-1 text-zinc-400">
                            {pendingAction.type === 'points'
                                ? `+${pendingAction.value} PTS — ${pendingAction.team === 'A' ? (teamA.name || 'HOME') : (teamB.name || 'AWAY')}`
                                : `FOUL — ${pendingAction.team === 'A' ? (teamA.name || 'HOME') : (teamB.name || 'AWAY')}`
                            }
                        </h3>
                        <p className="text-xs text-zinc-600 mb-4">Select player or skip</p>

                        <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
                            {(pendingAction.team === 'A' ? teamA.players : teamB.players).map((player) => (
                                <button
                                    key={player.id}
                                    onClick={() => confirmPlayerAction(player)}
                                    className="w-full flex items-center gap-3 p-2.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors text-left"
                                >
                                    <span className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center text-xs font-black font-mono">
                                        {player.number}
                                    </span>
                                    <span className="text-sm font-bold text-white">{player.name}</span>
                                    <span className="text-xs text-zinc-500 ml-auto">{player.position}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowPlayerPopup(false); setPendingAction(null); }}
                                className="flex-1 py-2.5 border border-zinc-700 text-zinc-500 text-xs font-bold uppercase tracking-widest rounded hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={skipPlayerSelection}
                                className="flex-1 py-2.5 bg-white text-black text-xs font-black uppercase tracking-widest rounded hover:bg-zinc-200 transition-colors"
                            >
                                No Player
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── HELP MODAL ───────────────────────────────────────── */}
            {showHelp && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 p-6 max-w-md w-full shadow-2xl rounded-xl">
                        <h3 className="text-xl font-bold mb-4 uppercase tracking-widest border-b border-zinc-700 pb-2">
                            Shortcuts
                        </h3>
                        <div className="space-y-2 text-sm text-zinc-400 font-mono mb-6">
                            <div className="flex justify-between"><span>SPACE</span><span className="text-white">Start / Stop Clock</span></div>
                            <div className="flex justify-between"><span>R</span><span className="text-white">Reset Shot Clock 24s</span></div>
                            <div className="flex justify-between"><span>T</span><span className="text-white">Reset Shot Clock 14s</span></div>
                            <div className="flex justify-between"><span>P</span><span className="text-white">Toggle Possession</span></div>
                            <div className="flex justify-between"><span>Ctrl+Z</span><span className="text-white">Undo Last Action</span></div>
                            <div className="flex justify-between"><span>H</span><span className="text-white">Toggle This Help</span></div>
                        </div>
                        <div className="border-t border-zinc-800 pt-4">
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">
                                ESP32 Controller Buttons
                            </p>
                            <div className="space-y-1 text-xs font-mono text-zinc-500">
                                <div className="flex justify-between"><span>BTN A</span><span>Home +2</span></div>
                                <div className="flex justify-between"><span>BTN B</span><span>Away +2</span></div>
                                <div className="flex justify-between"><span>BTN C</span><span>Shot Clock 24s</span></div>
                                <div className="flex justify-between"><span>PAUSE</span><span>Toggle Clock</span></div>
                                <div className="flex justify-between"><span>QUARTER</span><span>Next Period</span></div>
                                <div className="flex justify-between"><span>UNDO</span><span>Undo Last Action</span></div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowHelp(false)}
                            className="mt-4 w-full py-2.5 bg-white text-black font-black text-xs uppercase tracking-widest rounded hover:bg-zinc-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};