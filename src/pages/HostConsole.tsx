// src/pages/HostConsole.tsx
//
// UI: Original jumbotron design — zero visual changes.
// DATA LAYER CHANGES:
//   [FIX-1] useParams: { code } → { gameCode } — was returning undefined, game stuck on loading
//   [FIX-2] Removed old setInterval timer + toggleTimer + updateGameTime + resetShotClock
//           Replaced with useRTDBTimer (isHost:true) — clock runs in RTDB, spectators sync <10ms
//   [FIX-3] useBasketballGame now used for cold data only (scores, fouls, possession, rosters)
//           timer.minutes / timer.seconds / timer.shotClock / timer.period replace game.gameState.*
//   [FIX-4] handleAction replaced with updateScore / updateFouls / updateTimeouts directly
//   [FIX-5] handleResetShot uses timer.resetShotClock24() / timer.resetShotClock14()
//   [FIX-6] FIBA: foul + timeout now call timer.stopClock() when clock is running
//   [FIX-7] Loading guard: game.hostId === 'loading' instead of !game
//   [HARDWARE] Added useHardwareSignaling to allow ESP32 to drive the engine

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameEngine } from '../core/engine/useGameEngine';
import { SPORT_REGISTRY } from '../sports/registry';
import { deleteGame, subscribeToGame } from '../services/supabaseGameService';
import { useSupabaseBroadcast } from '../hooks/useSupabaseBroadcast';
import { usePersistEngine } from '../hooks/usePersistEngine';

import { useHardwareSignaling } from '../hooks/useHardwareSignaling';
import { subscribeToControlMode, subscribeToDeviceHeartbeat, unpairHandheldDevice, setControlMode, HW_SESSION_KEY, type ControlMode } from '../services/handheldService';
import { CastModal } from '../components/CastModal';
import { stopAllCastsForGame } from '../services/tvDisplayService';
import { supabase } from '../services/supabase';
import type { Player } from '../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
    Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Share: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    Help: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Power: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>,
    Undo: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type GameAction = {
    type: 'score' | 'foul' | 'timeout';
    team: 'A' | 'B';
    value: number;
    playerId?: string;
    timestamp: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (num: number) => num.toString().padStart(2, '0');
const playSound = (type: 'horn' | 'whistle') => console.log(`🔊 ${type}`);
const getPeriodName = (p: number) => p <= 4 ? `Q${p}` : `OT${p - 4}`;

// ─── Main Component ───────────────────────────────────────────────────────────

const CONSOLE_CSS = `
@keyframes cpPulse {
    0%,100% { opacity:1; box-shadow:0 0 6px #22c55e; }
    50%      { opacity:0.3; box-shadow:0 0 2px #22c55e; }
}
`;

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();

    const [copied, setCopied] = useState(false);
    const [shareMenuOpen, setShareMenuOpen] = useState(false);
    const [showCastModal, setShowCastModal] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [actionHistory, setActionHistory] = useState<GameAction[]>([]);
    const [showPlayerPopup, setShowPlayerPopup] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        team: 'A' | 'B';
        type: 'points' | 'foul';
        value: number;
    } | null>(null);

    const [showBackConfirm, setShowBackConfirm] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
    const [deviceOnline, setDeviceOnline] = useState(false);

    const [castingActive, setCastingActive] = useState(false);
    useEffect(() => {
        if (!gameCode) return;
        const channel = supabase.channel(`cast_status_${gameCode}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_displays' }, () => {
                supabase.from('tv_displays').select('tv_code').eq('game_code', gameCode.toUpperCase()).limit(1)
                    .then(({ data }) => setCastingActive(!!data && data.length > 0));
            })
            .subscribe();
        supabase.from('tv_displays').select('tv_code').eq('game_code', gameCode.toUpperCase()).limit(1)
            .then(({ data }) => setCastingActive(!!data && data.length > 0));
        return () => { supabase.removeChannel(channel); };
    }, [gameCode]);

    // --- 1. LIVE DB FETCH ---
    const [dbGame, setDbGame] = useState<any>(null);
    useEffect(() => {
        if (!gameCode) return;
        return subscribeToGame(gameCode, (data) => { if (data) setDbGame(data); });
    }, [gameCode]);

    // --- 2. ENGINE SWAP ---
    const manifest = SPORT_REGISTRY['basketball'];
    const { state, dispatch } = useGameEngine(
        gameCode || '',
        dbGame || { rules: manifest.rules, state: manifest.createInitialState(manifest.rules) },
        manifest,
        true
    );

    usePersistEngine(gameCode || null, dbGame, state, !!dbGame && !!gameCode);

    // --- 3. THE UI FACADE (Protects all HTML below) ---
    const game = dbGame ? {
        ...dbGame,
        teamA: { ...dbGame.teamA, score: state.scoreA, fouls: state.foulsA, timeouts: state.timeoutsA },
        teamB: { ...dbGame.teamB, score: state.scoreB, fouls: state.foulsB, timeouts: state.timeoutsB },
        gameState: { possession: state.possession }
    } : null;

    const updateScore = (team: 'A' | 'B', value: number) => dispatch({ type: 'ADD_POINTS', team, amount: value });
    const updateFouls = (team: 'A' | 'B', _value: number) => dispatch({ type: 'ADD_FOUL', team });
    const updateTimeouts = (team: 'A' | 'B', _value: number) => dispatch({ type: 'USE_TIMEOUT', team });
    const togglePossession = () => dispatch({ type: 'SET_POSSESSION', team: state.possession === 'A' ? 'B' : 'A' });

    const timer = useSupabaseBroadcast({
        gameCode: gameCode || '',
        isHost: true,
        periodDuration: game?.settings?.periodDuration ?? 10,
        shotClockDuration: game?.settings?.shotClockDuration ?? 24,
    });

    // ── Hardware Control Mode ─────────────────────────────────────────────────────
    const [hwMode, setHwMode] = useState<'web' | 'hardware'>('web');
    const hwDeviceId = sessionStorage.getItem(HW_SESSION_KEY);

    useEffect(() => {
        if (!hwDeviceId) return;
        const unsub = subscribeToDeviceHeartbeat(hwDeviceId, (isOnline) => {
            setDeviceOnline(isOnline);
        });
        return unsub;
    }, [hwDeviceId]);

    const handleDisconnectDevice = async () => {
        if (hwDeviceId) {
            // Wait for unpair, then clear session and reload to clean the UI
            await unpairHandheldDevice(hwDeviceId, '');
            sessionStorage.removeItem(HW_SESSION_KEY);
            window.location.reload();
        }
    };

    // Subscribe to control mode changes in real time
    useEffect(() => {
        if (!hwDeviceId) return;
        const unsub = subscribeToControlMode(hwDeviceId, (mode) => {
            setHwMode(mode);
            console.log('[HW Mode]', mode);
        });
        return unsub;
    }, [hwDeviceId]);

    // Web buttons locked when ESP32 has exclusive control
    const isWebLocked = hwMode === 'hardware' && !!hwDeviceId;

    const handleModeSwitch = async (mode: 'web' | 'hardware') => {
        if (!hwDeviceId || hwMode === mode) return;
        setHwMode(mode); // Optimistic UI update for instant feedback
        await setControlMode(hwDeviceId, mode);
    };

    // Refs to avoid hoisting issues within the useCallback hook
    const handleUndoRef = useRef<() => void>(() => { });
    const recordActionRef = useRef<(action: GameAction) => void>(() => { });

    // ── REPLACE the existing useHardwareSignaling call with this ──────────────────
    // The useCallback here means cbRef inside useHardwareSignaling always gets
    // the latest hwMode without re-subscribing to the Supabase channel.
    const handleHwSignal = useCallback((signal: any) => {
        // In web-only mode, ignore all ESP32 signals
        if (hwMode === 'web') {
            console.log('[HW] Ignored — web has control');
            return;
        }

        console.log('[HW] Handling:', signal.action);

        switch (signal.action) {
            // ── Scoring: short press ──────────────────────────────────────────────
            case 'ADD_SCORE_A':
                updateScore('A', 1);
                recordActionRef.current({ type: 'score', team: 'A', value: 1, timestamp: Date.now() });
                break;
            case 'ADD_SCORE_B':
                updateScore('B', 1);
                recordActionRef.current({ type: 'score', team: 'B', value: 1, timestamp: Date.now() });
                break;
            case 'SUB_SCORE_A':
                updateScore('A', -1);
                recordActionRef.current({ type: 'score', team: 'A', value: -1, timestamp: Date.now() });
                break;
            case 'SUB_SCORE_B':
                updateScore('B', -1);
                recordActionRef.current({ type: 'score', team: 'B', value: -1, timestamp: Date.now() });
                break;

            // ── Scoring: hold press ───────────────────────────────────────────────
            case 'ADD_SCORE_A_2':
                updateScore('A', 2);
                recordActionRef.current({ type: 'score', team: 'A', value: 2, timestamp: Date.now() });
                break;
            case 'ADD_SCORE_B_2':
                updateScore('B', 2);
                recordActionRef.current({ type: 'score', team: 'B', value: 2, timestamp: Date.now() });
                break;

            // ── Fouls ─────────────────────────────────────────────────────────────
            case 'ADD_FOUL_A':
                updateFouls('A', 1);
                recordActionRef.current({ type: 'foul', team: 'A', value: 1, timestamp: Date.now() });
                break;
            case 'ADD_FOUL_B':
                updateFouls('B', 1);
                recordActionRef.current({ type: 'foul', team: 'B', value: 1, timestamp: Date.now() });
                break;

            // ── Clock ─────────────────────────────────────────────────────────────
            case 'TOGGLE_CLOCK':
                timer.toggleClock();
                break;
            case 'RESET_SHOT_CLOCK_24':
            case 'RESET_CLOCK':
                timer.resetShotClock24();
                break;
            case 'RESET_SHOT_CLOCK_14':
                timer.resetShotClock14();
                break;

            // ── Game flow ─────────────────────────────────────────────────────────
            case 'NEXT_PERIOD':
                timer.nextPeriod();
                break;
            case 'TOGGLE_POSSESSION':
                togglePossession();
                break;

            // ── Undo ──────────────────────────────────────────────────────────────
            case 'UNDO':
                handleUndoRef.current();
                break;

            // ── Full state sync (sent after undo chain) ───────────────────────────
            // When firmware sends SCORE_STATE it includes current scoreA/scoreB.
            // We trust it and set directly (avoids double-counting).
            case 'SCORE_STATE':
                if (signal.scoreA !== undefined) updateScore('A', signal.scoreA - (game?.teamA?.score ?? 0));
                if (signal.scoreB !== undefined) updateScore('B', signal.scoreB - (game?.teamB?.score ?? 0));
                break;

            default:
                console.log('[HW] Unknown action:', signal.action);
        }
    }, [hwMode, updateScore, updateFouls, timer, togglePossession, game]);

    // Subscribe — stable channel, latest handler via ref inside the hook
    const { sendToHardware } = useHardwareSignaling(gameCode || '', handleHwSignal);

    useEffect(() => {
        if (hwMode === 'web' && hwDeviceId) {
            sendToHardware({
                action: 'SCORE_STATE',
                scoreA: game?.teamA?.score ?? 0,
                scoreB: game?.teamB?.score ?? 0
            });
        }
    }, [game?.teamA?.score, game?.teamB?.score, hwMode, hwDeviceId, sendToHardware, game?.teamA, game?.teamB]);

    // ── WRAP web score buttons to record action history ────────────────────────────
    const handleWebScore = useCallback((team: 'A' | 'B', points: number, playerId?: string) => {
        updateScore(team, points);
        recordActionRef.current({ type: 'score', team, value: points, playerId, timestamp: Date.now() });
    }, [updateScore]);


    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndoRef.current(); }
            else if (e.key === ' ') { e.preventDefault(); handleTimerToggle(null); }
            else if (e.key.toLowerCase() === 'r') { handleResetShot(null, 24); }
            else if (e.key.toLowerCase() === 't') { handleResetShot(null, 14); }
            else if (e.key.toLowerCase() === 'p') { handleTogglePossession(null); }
            else if (e.key.toLowerCase() === 'h') { setShowHelp(prev => !prev); }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [actionHistory, timer.gameRunning]);

    // ── Action history helpers ────────────────────────────────────────────────
    const recordAction = (action: GameAction) => {
        setActionHistory(prev => [...prev.slice(-9), action]);
    };
    recordActionRef.current = recordAction; // Sync ref so useCallback uses latest state

    // ── Helper to check if a team has players ─────────────────────────────────
    const getTeamPlayers = (team: 'A' | 'B') => {
        const roster = team === 'A' ? game?.teamA?.players : game?.teamB?.players;
        return roster?.filter((p: any) => p.name) || [];
    };

    // ── Score / Foul with player selection (or bypass if empty) ───────────────
    const handleScoreWithPlayer = (e: React.MouseEvent | null, team: 'A' | 'B', points: number) => {
        e?.stopPropagation();
        const players = getTeamPlayers(team);

        if (players.length === 0) {
            // Bypass popup if no players (or Standard Timer mode)
            handleWebScore(team, points);
        } else {
            setPendingAction({ team, type: 'points', value: points });
            setShowPlayerPopup(true);
        }
    };

    const handleFoulWithPlayer = (e: React.MouseEvent | null, team: 'A' | 'B') => {
        e?.stopPropagation();
        const players = getTeamPlayers(team);

        if (players.length === 0) {
            // Bypass popup if no players
            recordActionRef.current({ type: 'foul', team, value: 1, timestamp: Date.now() });
            updateFouls(team, 1);
            if (timer.gameRunning) timer.stopClock();
        } else {
            setPendingAction({ team, type: 'foul', value: 1 });
            setShowPlayerPopup(true);
        }
    };

    const confirmPlayerAction = (player: Player) => {
        if (!pendingAction) return;
        const { team, type, value } = pendingAction;

        if (type === 'points') {
            handleWebScore(team, value, player.id);
        } else if (type === 'foul') {
            recordAction({ type: 'foul', team, value, playerId: player.id, timestamp: Date.now() });
            updateFouls(team, 1);
            if (timer.gameRunning) timer.stopClock();
        }

        setShowPlayerPopup(false);
        setPendingAction(null);
    };

    const skipPlayerSelection = () => {
        if (!pendingAction) return;
        const { team, type, value } = pendingAction;

        if (type === 'points') {
            handleWebScore(team, value);
        } else if (type === 'foul') {
            recordAction({ type: 'foul', team, value, timestamp: Date.now() });
            updateFouls(team, 1);
            if (timer.gameRunning) timer.stopClock();
        }

        setShowPlayerPopup(false);
        setPendingAction(null);
    };

    const handleTimeout = (e: React.MouseEvent | null, team: 'A' | 'B') => {
        e?.stopPropagation();
        recordAction({ type: 'timeout', team, value: -1, timestamp: Date.now() });
        updateTimeouts(team, -1);
        if (timer.gameRunning) timer.stopClock();
    };

    const handleResetShot = (e: React.MouseEvent | null, val: number) => {
        e?.stopPropagation();
        if (val === 14) timer.resetShotClock14();
        else timer.resetShotClock24();
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
        const last = actionHistory[actionHistory.length - 1];
        if (last.type === 'score') updateScore(last.team, -last.value);
        else if (last.type === 'foul') updateFouls(last.team, -1);
        else if (last.type === 'timeout') updateTimeouts(last.team, 1);
        setActionHistory(prev => prev.slice(0, -1));
    };
    handleUndoRef.current = handleUndo; // Sync ref for Hardware handler

    // ── Header actions ────────────────────────────────────────────────────────
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
        const rowsA = game.teamA.players.filter((p: any) => p.name).map((p: any) => `"${game.teamA.name}","${p.name}",${p.number},${p.points},${p.fouls}`).join("\n");
        const rowsB = game.teamB.players.filter((p: any) => p.name).map((p: any) => `"${game.teamB.name}","${p.name}",${p.number},${p.points},${p.fouls}`).join("\n");
        const csvContent = "data:text/csv;charset=utf-8," + headers + rowsA + "\n" + rowsB;
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${game.settings.gameName}_stats.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEndGame = async () => {
        if (window.confirm("⚠️ END GAME?\n\nThis will permanently end the session.\n\nContinue?")) {
            try {
                await stopAllCastsForGame(gameCode!);
                await deleteGame(gameCode!);
                navigate('/dashboard');
            } catch {
                alert("Failed to end game.");
            }
        }
    };

    if (!game || game.hostId === 'loading') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center animate-pulse">
                    <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
            <style>{CONSOLE_CSS}</style>

            {/* ── HEADER ────────────────────────────────────────────────────── */}
            <header className="h-16 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center px-4 lg:px-6 shrink-0 z-50 relative">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowBackConfirm(true)}
                        className="w-9 h-9 rounded-full bg-black border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-95"
                    >
                        ←
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="w-9 h-9 rounded-full bg-black border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-95 text-sm"
                        title="Settings"
                    >
                        ⚙️
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
                                    <button onClick={openWatchLink} className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-900 transition-colors">
                                        <span className="text-blue-400">↗</span> Open in New Tab
                                    </button>
                                    <div className="h-px bg-zinc-800"></div>
                                    <button onClick={shareWatchLink} className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-900 transition-colors">
                                        🔗 Share Link
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => setShowCastModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 14px',
                            background: castingActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${castingActive ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 8, cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: castingActive ? '#22c55e' : 'rgba(255,255,255,0.3)',
                            boxShadow: castingActive ? '0 0 6px #22c55e' : 'none',
                            animation: castingActive ? 'cpPulse 2s infinite' : 'none',
                        }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: castingActive ? '#22c55e' : 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                            {castingActive ? 'LIVE' : 'CAST'}
                        </span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {hwDeviceId && (
                        <div className="relative">
                            <button
                                onClick={() => setIsDeviceMenuOpen(!isDeviceMenuOpen)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${deviceOnline
                                    ? 'bg-green-900/20 border-green-800/50 hover:bg-green-900/40 text-green-400'
                                    : 'bg-red-900/20 border-red-800/50 hover:bg-red-900/40 text-red-400'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${deviceOnline ? 'bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]' : 'bg-red-500'}`} />
                                <span className="text-[10px] font-bold uppercase tracking-widest font-mono hidden md:block">
                                    {deviceOnline ? 'ESP-ONLINE' : 'ESP-OFFLINE'}
                                </span>
                            </button>

                            {isDeviceMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsDeviceMenuOpen(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded shadow-2xl overflow-hidden z-50">
                                        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Connected Device</div>
                                            <div className="font-mono text-sm text-white">CTRL-{hwDeviceId}</div>
                                        </div>
                                        <button
                                            onClick={handleDisconnectDevice}
                                            className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-900/20 transition-colors flex items-center gap-2"
                                        >
                                            <span>🔌</span> Disconnect Controller
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    <button onClick={() => setShowHelp(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                        <span className="text-sm">?</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Help</span>
                    </button>
                    <button onClick={handleExportStats} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                        <span className="text-sm">⬇</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Export</span>
                    </button>
                    <button onClick={handleEndGame} className="px-4 py-1.5 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 text-red-500 hover:text-red-400 rounded text-[10px] font-bold uppercase tracking-widest transition-all">
                        End
                    </button>
                </div>
            </header>

            {/* ── JUMBOTRON SCOREBOARD ──────────────────────────────────────── */}
            <div className="flex-1 relative flex flex-col justify-center bg-black overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 to-black pointer-events-none"></div>

                <div className="relative z-10 w-full max-w-7xl mx-auto p-4 lg:p-6">
                    <div className="grid grid-cols-12 gap-4 lg:gap-8 h-full max-h-[600px] min-h-[400px]">

                        {/* TEAM A PANEL */}
                        <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden">
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
                                <div className={`relative z-10 flex items-baseline gap-1 transition-colors duration-300 ${timer.gameRunning ? 'text-white' : 'text-zinc-400'}`}>
                                    <span className="text-[6rem] lg:text-[8.5rem] font-mono font-bold leading-none tracking-tight tabular-nums drop-shadow-xl">
                                        {formatTime(timer.minutes)}:{formatTime(timer.seconds)}
                                    </span>
                                </div>
                            </div>

                            <div className="h-40 grid grid-cols-2 gap-4">
                                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm">
                                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Period</span>
                                    <span className="text-6xl font-black italic text-white">{getPeriodName(timer.period)}</span>
                                </div>
                                <div className="bg-black border-2 border-zinc-800 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-lg">
                                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Shot Clock</span>
                                    <span className={`text-7xl font-mono font-bold leading-none relative z-10 tabular-nums ${timer.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                                        {timer.shotClock}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* TEAM B PANEL */}
                        <div className="col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden">
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
                                            <div key={i} className={`w-3 h-5 rounded-sm transition-all ${i < game.teamB.timeouts ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-zinc-800/50'}`}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* ── PRO CONTROL DECK ──────────────────────────────────────────── */}
            <div className="relative">
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
                                <TactileBtn label="+1" color={game.teamA.color} isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleScoreWithPlayer(e, 'A', 1); }} />
                                <TactileBtn label="+2" color={game.teamA.color} isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleScoreWithPlayer(e, 'A', 2); }} />
                                <TactileBtn label="+3" color={game.teamA.color} isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleScoreWithPlayer(e, 'A', 3); }} />
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                <AdminBtn label="FOUL" value={game.teamA.fouls} type="danger" isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleFoulWithPlayer(e, 'A'); }} />
                                <AdminBtn label="TIMEOUT" value={game.teamA.timeouts} type="warning" isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleTimeout(e, 'A'); }} />
                            </div>
                        </div>

                        {/* CENTER CONSOLE */}
                        <div className="col-span-6 bg-zinc-900/50 rounded-xl border border-zinc-800 p-2 flex flex-col gap-2">
                            {hwDeviceId && (
                                <div className="bg-black border border-zinc-800 rounded-lg p-1 flex items-center justify-between mb-2 shadow-inner">
                                    <div className="flex items-center gap-2 pl-2">
                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${hwMode === 'hardware' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Input Source</span>
                                    </div>
                                    <div className="flex bg-zinc-900 border border-zinc-800 rounded p-0.5">
                                        <button
                                            onClick={() => handleModeSwitch('hardware')}
                                            className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all flex items-center gap-1.5
                                                ${hwMode === 'hardware' ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.3)]' : 'text-zinc-600 hover:text-zinc-400'}`}
                                        >
                                            ESP32 Controller
                                        </button>
                                        <button
                                            onClick={() => handleModeSwitch('web')}
                                            className={`px-4 py-1.5 text-[10px] font-black uppercase rounded transition-all flex items-center gap-1.5
                                                ${hwMode === 'web' ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'text-zinc-600 hover:text-zinc-400'}`}
                                        >
                                            Web Console
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 grid grid-cols-12 gap-2">
                                <div className="col-span-5 flex flex-col gap-1">
                                    <button
                                        onClick={(e) => { if (!isWebLocked) handleTimerToggle(e); }}
                                        className={`flex-1 rounded border-2 transition-all flex flex-col items-center justify-center active:scale-95 shadow-lg ${timer.gameRunning
                                            ? 'bg-red-900/20 border-red-600/50 hover:bg-red-900/40 text-red-500'
                                            : 'bg-green-900/20 border-green-600/50 hover:bg-green-900/40 text-green-500'
                                            }`}
                                    >
                                        <span className="text-2xl font-black uppercase italic tracking-wider">
                                            {timer.gameRunning ? 'STOP' : 'START'}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => { if (!isWebLocked) handleUndo(); }}
                                        disabled={actionHistory.length === 0}
                                        className="h-8 bg-black border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                                    >
                                        <Icons.Undo />
                                        UNDO {actionHistory.length > 0 && `(${actionHistory.length})`}
                                    </button>
                                </div>
                                <div className="col-span-3 flex flex-col gap-1 border-x border-zinc-800 px-2">
                                    <button
                                        onClick={(e) => { if (!isWebLocked) handleResetShot(e, 24); }}
                                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded font-black text-xl shadow-md active:scale-95"
                                    >
                                        24
                                    </button>
                                    <button
                                        onClick={(e) => { if (!isWebLocked) handleResetShot(e, 14); }}
                                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 rounded font-black text-xl shadow-md active:scale-95"
                                    >
                                        14
                                    </button>
                                </div>
                                <div className="col-span-4 flex flex-col gap-1">
                                    <button
                                        onClick={(e) => { if (!isWebLocked) handleTogglePossession(e); }}
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
                                <TactileBtn label="+3" color={game.teamB.color} isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleScoreWithPlayer(e, 'B', 3); }} />
                                <TactileBtn label="+2" color={game.teamB.color} isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleScoreWithPlayer(e, 'B', 2); }} />
                                <TactileBtn label="+1" color={game.teamB.color} isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleScoreWithPlayer(e, 'B', 1); }} />
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                <AdminBtn label="TIMEOUT" value={game.teamB.timeouts} type="warning" isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleTimeout(e, 'B'); }} />
                                <AdminBtn label="FOUL" value={game.teamB.fouls} type="danger" isLocked={isWebLocked} onClick={(e: React.MouseEvent) => { if (!isWebLocked) handleFoulWithPlayer(e, 'B'); }} />
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* ── HELP MODAL ────────────────────────────────────────────────── */}
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
                        <button onClick={() => setShowHelp(false)} className="mt-6 w-full py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-zinc-200 rounded">
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* ── PLAYER SELECTION POPUP ────────────────────────────────────── */}
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
                            <button onClick={() => setShowPlayerPopup(false)} className="text-zinc-500 hover:text-white text-2xl transition-colors">
                                &times;
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {activePlayers.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-zinc-500 mb-4">No players in roster</p>
                                    <button onClick={skipPlayerSelection} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-wider rounded transition-colors">
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
                                                        <div className="text-sm font-bold text-white truncate">{player.name}</div>
                                                        <div className="text-[10px] text-zinc-600 uppercase tracking-wider">{player.position || 'Player'}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 text-[10px] text-zinc-600">
                                                    <span>PTS: {player.points || 0}</span>
                                                    <span>FOULS: {player.fouls || 0}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={skipPlayerSelection} className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded transition-colors">
                                        Skip Player Selection
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showCastModal && (
                <CastModal
                    gameCode={gameCode!}
                    gameName={game?.settings?.gameName}
                    onClose={() => setShowCastModal(false)}
                />
            )}

            {/* BACK CONFIRMATION MODAL */}
            {showBackConfirm && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <span className="text-amber-500">⚠️</span> Pause & Exit
                            </h3>
                            <button onClick={() => setShowBackConfirm(false)} className="text-zinc-500 hover:text-white transition-colors">&times;</button>
                        </div>
                        <div className="p-6">
                            <p className="text-zinc-400 text-sm mb-6">
                                Are you sure you want to leave the console? The game clock will be paused and you will return to the dashboard.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowBackConfirm(false)}
                                    className="flex-1 py-3 rounded border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-bold uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (timer.gameRunning) timer.stopClock();
                                        navigate('/dashboard');
                                    }}
                                    className="flex-1 py-3 rounded bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-widest transition-all"
                                >
                                    Yes, Exit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SETTINGS MODAL */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <span>⚙️</span> Match Settings
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white transition-colors">&times;</button>
                        </div>
                        <div className="p-8 text-center">
                            <span className="text-4xl grayscale opacity-50 mb-4 block">🛠️</span>
                            <h4 className="text-white font-bold mb-2">Advanced Settings</h4>
                            <p className="text-zinc-500 text-xs">This feature is currently under development. You will be able to edit team names, colors, and game rules here soon.</p>
                        </div>
                        <div className="p-4 bg-black border-t border-zinc-800">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-full py-3 rounded bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

// ─── Helper Components ────────────────────────────────────────────────────────

const TactileBtn = ({ label, color, isLocked, onClick }: { label: string; color: string; isLocked?: boolean; onClick: (e: React.MouseEvent) => void }) => (
    <button
        onClick={onClick}
        disabled={isLocked}
        className={`h-full rounded border hover:border-zinc-500 transition-all relative overflow-hidden shadow-sm flex items-center justify-center
            ${isLocked ? 'bg-zinc-950/50 border-zinc-800/50 opacity-50 cursor-not-allowed grayscale' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 active:scale-95 active:bg-white group'}`}
        style={{ borderBottom: isLocked ? '1px solid #333' : `3px solid ${color}` }}
    >
        {isLocked && <span className="absolute top-1 right-1 text-[8px] opacity-50">🔒</span>}
        <span className={`relative z-10 text-xl font-black italic ${isLocked ? 'text-zinc-600' : 'text-white group-active:text-black'}`}>{label}</span>
    </button>
);

const AdminBtn = ({ label, value, type, isLocked, onClick }: { label: string; value: number; type: 'danger' | 'warning'; isLocked?: boolean; onClick: (e: React.MouseEvent) => void }) => {
    const styles = {
        danger: isLocked ? "text-red-900 border-red-900/10 bg-black" : "text-red-500 border-red-900/30 hover:bg-red-900/20 bg-black",
        warning: isLocked ? "text-yellow-900 border-yellow-900/10 bg-black" : "text-yellow-500 border-yellow-900/30 hover:bg-yellow-900/20 bg-black",
    };
    return (
        <button
            onClick={onClick}
            disabled={isLocked}
            className={`h-8 rounded border ${styles[type]} flex items-center justify-between px-2 transition-all relative
                ${isLocked ? 'opacity-50 cursor-not-allowed grayscale' : 'active:scale-95 group'}`}
        >
            {isLocked && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] opacity-20">🔒</span>}
            <span className={`text-[9px] font-bold uppercase tracking-widest ${isLocked ? 'opacity-30' : 'opacity-70 group-hover:opacity-100'}`}>{label}</span>
            <span className={`font-mono font-bold text-sm ${isLocked ? 'opacity-50' : ''}`}>{value}</span>
        </button>
    );
};

export default HostConsole;