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
import { SPORT_REGISTRY, isSportSupported } from '../sports/registry';
import { deleteGame, subscribeToGame } from '../services/supabaseGameService';
import { useSupabaseBroadcast } from '../hooks/useSupabaseBroadcast';
import { usePersistEngine } from '../hooks/usePersistEngine';
import { useGenericPersistEngine } from '../hooks/useGenericPersistEngine';
import type { GameContext } from '../core/types/Manifest';

import { useHardwareSignaling } from '../hooks/useHardwareSignaling';
import { useHardware } from '../contexts/HardwareContext';
import { useTheme } from '../contexts/ThemeContext';
import { CastModal } from '../components/CastModal';
import { stopAllCastsForGame } from '../services/tvDisplayService';
import { supabase } from '../services/supabase';
import type { Player } from '../types';

import { AdvancedConsole } from '../components/shotchart/AdvancedConsole';
import { createShotEvent, createGameAction, subscribeToShots } from '../services/shotService';
import type { ShotEvent, ShotType, ShotZoneId, ShotAttribute, GameActionType } from '../components/shotchart/types/shotTypes';

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
@keyframes scoreFloat {
    0%   { opacity:1; transform:translateY(0) scale(1); }
    100% { opacity:0; transform:translateY(-36px) scale(1.2); }
}
@keyframes undoSlideIn {
    from { opacity:0; transform:translateY(16px) scale(0.95); }
    to   { opacity:1; transform:translateY(0) scale(1); }
}
`;

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();

    const { theme } = useTheme();
    const L = theme === 'light';

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

    const [castingCount, setCastingCount] = useState(0);
    const [undoToast, setUndoToast] = useState<{ label: string; id: number } | null>(null);
    const undoToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!gameCode) return;
        const fetchCount = () => {
            supabase.from('tv_displays')
                .select('tv_code', { count: 'exact' })
                .eq('game_code', gameCode.toUpperCase())
                .eq('status', 'casting')
                .then(({ count }) => setCastingCount(count ?? 0));
        };
        fetchCount();
        const channel = supabase.channel(`cast_status_${gameCode}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_displays' }, fetchCount)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [gameCode]);

    useEffect(() => {
        // Cleanup: stop casting when host leaves the console without ending the game
        // This handles back navigation, tab close, and refresh
        const cleanup = () => {
            if (gameCode) stopAllCastsForGame(gameCode); // fire-and-forget
        };

        window.addEventListener('beforeunload', cleanup);
        return () => {
            window.removeEventListener('beforeunload', cleanup);
            cleanup(); // also fires on React unmount (navigation)
        };
    }, [gameCode]);

    // --- 1. LIVE DB FETCH ---
    const [dbGame, setDbGame] = useState<any>(null);
    useEffect(() => {
        if (!gameCode) return;
        return subscribeToGame(gameCode, (data) => { if (data) setDbGame(data); });
    }, [gameCode]);

    // --- 2. ENGINE SWAP ---
    const sportId = dbGame?.sportId || dbGame?.sport || 'basketball';
    const manifest = isSportSupported(sportId) ? SPORT_REGISTRY[sportId] : SPORT_REGISTRY['basketball'];

    // Synthesize the engine state from the DB data, or use defaults.
    // Non-basketball sports store full state in dbGame.state — use it directly.
    // Basketball synthesizes from team-level fields (legacy flat schema).
    const engineInitialState = dbGame ? (
        sportId !== 'basketball' && dbGame.state
            ? dbGame.state
            : {
                scoreA: dbGame.teamA?.score ?? 0,
                scoreB: dbGame.teamB?.score ?? 0,
                foulsA: dbGame.teamA?.fouls ?? 0,
                foulsB: dbGame.teamB?.fouls ?? 0,
                timeoutsA: dbGame.teamA?.timeouts ?? 0,
                timeoutsB: dbGame.teamB?.timeouts ?? 0,
                possession: dbGame.gameState?.possession ?? 'A',
            }
    ) : manifest.createInitialState(manifest.rules);

    // Pass the synthesized state into the engine
    const { state, dispatch } = useGameEngine(
        gameCode || '',
        { ...(dbGame || {}), rules: manifest.rules, state: engineInitialState, code: gameCode },
        manifest,
        true
    );

    // Basketball uses the typed adapter-based persist hook.
    // All other sports use the generic state-passthrough persist hook.
    const isBasketball = sportId === 'basketball';
    usePersistEngine(gameCode || null, dbGame, state, !!dbGame && !!gameCode && isBasketball);
    useGenericPersistEngine(gameCode || null, state, !!dbGame && !!gameCode && !isBasketball);

    // --- 3. THE UI FACADE (Protects all HTML below) ---
    const game = dbGame ? {
        ...dbGame,
        teamA: { ...dbGame.teamA, score: state.scoreA, fouls: state.foulsA, timeouts: state.timeoutsA },
        teamB: { ...dbGame.teamB, score: state.scoreB, fouls: state.foulsB, timeouts: state.timeoutsB },
        gameState: { ...dbGame.gameState, possession: state.possession },
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
    const { deviceId: hwDeviceId, isConnected: deviceOnline, controlMode: hwMode, setMode, unpair, setWsOpen } = useHardware();

    const handleDisconnectDevice = async () => {
        if (hwDeviceId) {
            await unpair(game?.hostId || '');
            window.location.reload();
        }
    };

    // Web buttons locked when ESP32 has exclusive control
    const isWebLocked = hwMode === 'hardware' && !!hwDeviceId;

    const handleModeSwitch = async (mode: 'web' | 'hardware') => {
        if (!hwDeviceId || hwMode === mode) return;
        await setMode(mode, game?.teamA?.name, game?.teamB?.name);
        sendPairingPush({
            status: 'mode_change',
            controlMode: mode,
        });
    };

    // Refs to avoid hoisting issues within the useCallback hook
    const handleUndoRef = useRef<() => void>(() => { });
    const recordActionRef = useRef<(action: GameAction) => void>(() => { });
    const liveScoreRef = useRef({ a: 0, b: 0 });
    const lanConnectedRef = useRef(false);

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
                liveScoreRef.current.a += 1;
                recordActionRef.current({ type: 'score', team: 'A', value: 1, timestamp: Date.now() });
                break;
            case 'ADD_SCORE_B':
                updateScore('B', 1);
                liveScoreRef.current.b += 1;
                recordActionRef.current({ type: 'score', team: 'B', value: 1, timestamp: Date.now() });
                break;
            case 'SUB_SCORE_A':
                updateScore('A', -1);
                liveScoreRef.current.a = Math.max(0, liveScoreRef.current.a - 1);
                recordActionRef.current({ type: 'score', team: 'A', value: -1, timestamp: Date.now() });
                break;
            case 'SUB_SCORE_B':
                updateScore('B', -1);
                liveScoreRef.current.b = Math.max(0, liveScoreRef.current.b - 1);
                recordActionRef.current({ type: 'score', team: 'B', value: -1, timestamp: Date.now() });
                break;

            // ── Scoring: hold press ───────────────────────────────────────────────
            case 'ADD_SCORE_A_2':
                updateScore('A', 2);
                liveScoreRef.current.a += 2;
                recordActionRef.current({ type: 'score', team: 'A', value: 2, timestamp: Date.now() });
                break;
            case 'ADD_SCORE_B_2':
                updateScore('B', 2);
                liveScoreRef.current.b += 2;
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

            // ── Clock signals: Only process if website is parent ──────────────────
            // When ESP32 is parent, SCORE_STATE (sent every 1s) includes full clock
            // state. Processing individual clock signals would double-process and
            // cause flickering (signal starts timer → SCORE_STATE overrides 100ms later).
            case 'TOGGLE_CLOCK':
                // In hardware mode: ignored — ESP32's SCORE_STATE handles clock
                break;
            case 'RESET_SHOT_CLOCK_24':
            case 'RESET_CLOCK':
                // In hardware mode: ignored
                break;
            case 'RESET_SHOT_CLOCK_14':
                // In hardware mode: ignored
                break;

            // ── Game flow ─────────────────────────────────────────────────────────
            case 'NEXT_PERIOD':
                // In hardware mode: ignored
                break;
            case 'TOGGLE_POSSESSION':
                togglePossession();
                break;

            // ── Undo ──────────────────────────────────────────────────────────────
            case 'UNDO':
                handleUndoRef.current();
                break;

            // ── Full state sync from ESP32 (sent every 1s + after every button press)
            // ESP32 is the source of truth — we render its state directly.
            // This includes scores AND clock data so there's zero drift.
            case 'SCORE_STATE':
                // Scores — delta against liveScoreRef (not stale game state)
                if (signal.scoreA !== undefined) {
                    const delta = signal.scoreA - liveScoreRef.current.a;
                    if (delta !== 0) {
                        updateScore('A', delta);
                        liveScoreRef.current.a = signal.scoreA;
                    }
                }
                if (signal.scoreB !== undefined) {
                    const delta = signal.scoreB - liveScoreRef.current.b;
                    if (delta !== 0) {
                        updateScore('B', delta);
                        liveScoreRef.current.b = signal.scoreB;
                    }
                }

                // Clock — Browser calculates display time locally from firmware anchors
                if (signal.clockValueAtStart !== undefined && signal.clockStartedAt !== undefined) {
                    let currentSeconds = signal.clockValueAtStart;
                    let currentShot = signal.shotValueAtStart ?? timer.shotClock;

                    if (signal.gameRunning && signal.clockStartedAt > 0) {
                        currentSeconds = Math.max(0, Math.floor(signal.clockValueAtStart - ((Date.now() - signal.clockStartedAt) / 1000)));
                        if (signal.shotStartedAt !== undefined && signal.shotValueAtStart !== undefined && signal.shotStartedAt > 0) {
                            currentShot = Math.max(0, Math.floor(signal.shotValueAtStart - ((Date.now() - signal.shotStartedAt) / 1000)));
                        }
                    }

                    timer.setFromHardware({
                        minutes: Math.floor(currentSeconds / 60),
                        seconds: Math.floor(currentSeconds % 60),
                        shotClock: currentShot,
                        period: signal.period ?? timer.period,
                        gameRunning: signal.gameRunning ?? timer.gameRunning,
                    });
                } else if (!lanConnectedRef.current && signal.minutes !== undefined && signal.seconds !== undefined) {
                    timer.setFromHardware({
                        minutes: signal.minutes,
                        seconds: signal.seconds,
                        shotClock: signal.shotClock ?? timer.shotClock,
                        period: signal.period ?? timer.period,
                        gameRunning: signal.gameRunning ?? timer.gameRunning,
                    });
                }

                // Possession
                if (signal.possession === 'A' || signal.possession === 'B') {
                    if (signal.possession !== state.possession) {
                        dispatch({ type: 'SET_POSSESSION', team: signal.possession });
                    }
                }
                break;

            default:
                console.log('[HW] Unknown action:', signal.action);
        }
    }, [hwMode, updateScore, updateFouls, timer, togglePossession, game, dispatch, state.possession]);

    // Subscribe — stable channel, latest handler via ref inside the hook
    const { sendToHardware, lanConnected, relayConnected, retryLan, sendPairingPush, sendActivateCommand, relayReadyCallbackRef } = useHardwareSignaling(gameCode || '', hwDeviceId || '', handleHwSignal);

    useEffect(() => { lanConnectedRef.current = lanConnected; }, [lanConnected]);

    useEffect(() => {
        setWsOpen(lanConnected);
    }, [lanConnected, setWsOpen]);

    // ── Push activation to ESP32 over WS when LAN connects (C8) ──────────────────
    // Fires once when LAN first connects so ESP32 transitions to active state
    // without waiting for the next Supabase poll cycle.
    const activationPushedRef = useRef(false);

    useEffect(() => {
        activationPushedRef.current = false;
        relayReadyCallbackRef.current = null;
    }, [gameCode, hwDeviceId]);

    useEffect(() => {
        if (!hwDeviceId || !gameCode || !game) return;
        
        const teamA = game?.teamA?.name || 'TEAM A';
        const teamB = game?.teamB?.name || 'TEAM B';
        const colorA = game?.teamA?.color || '#c0392b';
        const colorB = game?.teamB?.color || '#eab308';

        // Always set the relay-ready callback so it fires when relay opens
        relayReadyCallbackRef.current = () => {
            sendActivateCommand(teamA, teamB, colorA, colorB);
            activationPushedRef.current = true;
        };

        // If relay is already open, send immediately
        if ((lanConnected || relayConnected) && !activationPushedRef.current) {
            sendActivateCommand(teamA, teamB, colorA, colorB);
            activationPushedRef.current = true;
        }
    }, [hwDeviceId, gameCode, game, lanConnected, relayConnected, sendActivateCommand, relayReadyCallbackRef]);

    // ── Feed live state back to ESP32 display ─────────────────────────────────────
    // Fires whenever scores, fouls, possession, or clock changes.
    // ESP32 listens for 'feedback' event on the same hw-{gameCode} channel.
    const sendToHardwareRef = useRef(sendToHardware);
    useEffect(() => { sendToHardwareRef.current = sendToHardware; }, [sendToHardware]);

    useEffect(() => {
        if (!hwDeviceId || !gameCode) return;

        sendToHardwareRef.current({
            scoreA: state.scoreA,
            scoreB: state.scoreB,
            foulsA: state.foulsA,
            foulsB: state.foulsB,
            minutes: timer.minutes,
            seconds: timer.seconds,
            shotClock: timer.shotClock,
            period: timer.period,
            gameRunning: timer.gameRunning,
            possession: state.possession,
        });
    }, [
        state.scoreA, state.scoreB,
        state.foulsA, state.foulsB,
        state.possession,
        timer.minutes, timer.seconds,
        timer.shotClock, timer.period,
        timer.gameRunning,
    ]);

    // ── Sync liveScoreRef from DB on load (only when LAN is not active) ──────────
    useEffect(() => {
        if (lanConnected) return;
        if (game?.teamA?.score !== undefined) {
            liveScoreRef.current.a = game.teamA.score;
        }
        if (game?.teamB?.score !== undefined) {
            liveScoreRef.current.b = game.teamB.score;
        }
    }, [game?.teamA?.score, game?.teamB?.score, lanConnected]);

    // ── WRAP web score buttons to record action history ────────────────────────────
    const showUndoToast = (label: string) => {
        if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
        setUndoToast({ label, id: Date.now() });
        undoToastTimerRef.current = setTimeout(() => setUndoToast(null), 8000);
    };

    const handleWebScore = useCallback((team: 'A' | 'B', points: number, playerId?: string) => {
        updateScore(team, points);
        if (team === 'A') liveScoreRef.current.a += points;
        else liveScoreRef.current.b += points;
        recordActionRef.current({ type: 'score', team, value: points, playerId, timestamp: Date.now() });
        const teamName = team === 'A' ? game?.teamA?.name : game?.teamB?.name;
        showUndoToast(`+${points} ${teamName ?? team}`);
    }, [updateScore, game]);

    // ── ADVANCED SHOT CHART STATE & HANDLERS ────────────────────────────────
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [gameShotEvents, setGameShotEvents] = useState<ShotEvent[]>([]);

    useEffect(() => {
        if (dbGame?.settings?.gameMode === 'advanced') {
            setIsAdvancedMode(true);
        }
    }, [dbGame]);

    useEffect(() => {
        if (!gameCode || !isAdvancedMode) return;
        const unsub = subscribeToShots(gameCode, setGameShotEvents);
        return unsub;
    }, [gameCode, isAdvancedMode]);

    const handleShotRecorded = useCallback(async (shot: {
        teamSide: 'A' | 'B';
        playerId: string | null;
        points: 1 | 2 | 3;
        made: boolean;
        shotType: ShotType;
        x: number | null;
        y: number | null;
        zone: ShotZoneId;
        attributes: ShotAttribute[];
    }) => {
        if (!gameCode) return;
        await createShotEvent({
            gameCode,
            playerId: shot.playerId,
            teamSide: shot.teamSide,
            x: shot.x,
            y: shot.y,
            zone: shot.zone,
            made: shot.made,
            points: shot.points,
            shotType: shot.shotType,
            period: timer.period,
            gameClockSec: timer.minutes * 60 + timer.seconds,
            attributes: shot.attributes,
        });
    }, [gameCode, timer]);

    const handleAdvancedSecondaryAction = useCallback(async (
        team: 'A' | 'B',
        action: GameActionType
    ) => {
        if (!gameCode) return;

        if (action === 'foul') {
            updateFouls(team, 1);
            if (timer.gameRunning) timer.stopClock();
        } else if (action === 'timeout') {
            updateTimeouts(team, -1);
            if (timer.gameRunning) timer.stopClock();
        }

        await createGameAction({
            gameCode,
            playerId: null,
            teamSide: team,
            actionType: action,
            period: timer.period,
            gameClockSec: timer.minutes * 60 + timer.seconds,
        });
    }, [gameCode, timer, updateFouls, updateTimeouts]);


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
            showUndoToast(`Foul — ${team === 'A' ? game?.teamA?.name : game?.teamB?.name}`);
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
            showUndoToast(`Foul — ${team === 'A' ? game?.teamA?.name : game?.teamB?.name}`);
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
            showUndoToast(`Foul — ${team === 'A' ? game?.teamA?.name : game?.teamB?.name}`);
        }

        setShowPlayerPopup(false);
        setPendingAction(null);
    };

    const handleTimeout = (e: React.MouseEvent | null, team: 'A' | 'B') => {
        e?.stopPropagation();
        if (timer.gameRunning) {
            timer.stopClock(); // FIBA: Auto-stop the clock on timeout
        }
        recordAction({ type: 'timeout', team, value: -1, timestamp: Date.now() });
        updateTimeouts(team, -1);
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

    // ── Early return: non-basketball sports use their own manifest console ──
    if (!isBasketball && game) {
        const SportConsole = manifest.components.HostConsole;
        const sportContext: GameContext = {
            gameCode: gameCode || '',
            teamA: { id: 'A', name: game.teamA.name, color: game.teamA.color, score: (state as any).scoreA ?? game.teamA.score },
            teamB: { id: 'B', name: game.teamB.name, color: game.teamB.color, score: (state as any).scoreB ?? game.teamB.score },
            sportLabel: manifest.label,
        };
        return (
            <SportConsole
                gameId={gameCode || ''}
                state={state}
                dispatch={dispatch}
                context={sportContext}
                isOffline={false}
                syncQueueCount={0}
            />
        );
    }

    // ── Early return: Advanced mode takes over the whole page ─────────────
    if (isAdvancedMode && game) {
        return (
            <AdvancedConsole
                // Team A
                teamAName={game.teamA.name}
                teamAColor={game.teamA.color}
                teamAPlayers={game.teamA.players || []}
                teamAScore={game.teamA.score}
                teamAFouls={game.teamA.fouls}
                teamATimeouts={game.teamA.timeouts}
                // Team B
                teamBName={game.teamB.name}
                teamBColor={game.teamB.color}
                teamBPlayers={game.teamB.players || []}
                teamBScore={game.teamB.score}
                teamBFouls={game.teamB.fouls}
                teamBTimeouts={game.teamB.timeouts}
                // Timer
                period={timer.period}
                minutes={timer.minutes}
                seconds={timer.seconds}
                shotClock={timer.shotClock}
                gameRunning={timer.gameRunning}
                possession={game.gameState.possession}
                // Shot chart
                existingShots={gameShotEvents}
                // Scoring handlers
                onScoreChange={(team, pts) => handleWebScore(team, pts)}
                onShotRecorded={handleShotRecorded}
                onSecondaryAction={handleAdvancedSecondaryAction}
                // Clock handlers
                onToggleClock={() => timer.toggleClock()}
                onNextPeriod={() => timer.nextPeriod()}
                onResetShotClock={(val) => {
                    if (val === 14) timer.resetShotClock14();
                    else timer.resetShotClock24();
                }}
                onTogglePossession={() => togglePossession()}
            />
        );
    }

    const teamAPlayers = game.teamA.players?.filter((p: any) => p.name) || [];
    const teamBPlayers = game.teamB.players?.filter((p: any) => p.name) || [];
    const activePlayers = pendingAction?.team === 'A' ? teamAPlayers : teamBPlayers;

    return (
        <div className={`min-h-screen font-sans flex flex-col overflow-hidden ${L ? 'bg-slate-50 text-slate-900' : 'bg-black text-white'}`}>
            <style>{CONSOLE_CSS}</style>

            {/* ── HEADER ────────────────────────────────────────────────────── */}
            <header className={`h-16 flex justify-between items-center px-4 lg:px-6 shrink-0 z-50 relative ${L ? 'bg-white/90 border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'bg-zinc-950 border-b border-zinc-800'} backdrop-blur-md`}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowBackConfirm(true)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${L ? 'bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black border border-zinc-700 text-zinc-400 hover:text-white'}`}
                    >
                        ←
                    </button>

                    <div className={`flex items-center rounded-md p-1 gap-1 ${L ? 'bg-slate-100 border border-slate-200' : 'bg-zinc-900 border border-zinc-800'}`}>
                        <div className={`px-3 py-1 rounded text-xs font-mono font-bold tracking-wider select-all ${L ? 'bg-white text-slate-500' : 'bg-black text-zinc-400'}`} title="Game Code">
                            {gameCode}
                        </div>
                        <button onClick={copyGameCode} title="Copy Code" className={`p-1.5 rounded transition-all ${L ? 'text-slate-500 hover:text-slate-900 hover:bg-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
                            {copied ? <Icons.Check /> : <span className="text-sm">📋</span>}
                        </button>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShareMenuOpen(!shareMenuOpen)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${L ? 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                        >
                            <span className="text-sm">🔗</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Share</span>
                        </button>

                        {shareMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShareMenuOpen(false)}></div>
                                <div className={`absolute left-0 top-full mt-2 w-52 rounded shadow-2xl overflow-hidden z-50 ${L ? 'bg-white border border-slate-200' : 'bg-zinc-950 border border-zinc-800'}`}>
                                    <button onClick={openWatchLink} className={`w-full px-4 py-3 text-left text-sm transition-colors ${L ? 'hover:bg-slate-100' : 'hover:bg-zinc-900'}`}>
                                        <span className="text-blue-400">↗</span> Open in New Tab
                                    </button>
                                    <div className={`h-px ${L ? 'bg-slate-100' : 'bg-zinc-800'}`}></div>
                                    <button onClick={shareWatchLink} className={`w-full px-4 py-3 text-left text-sm transition-colors ${L ? 'hover:bg-slate-100' : 'hover:bg-zinc-900'}`}>
                                        🔗 Share Link
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => setShowCastModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all active:scale-95"
                        style={{
                            background: castingCount > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${castingCount > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                    >
                        <div style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: castingCount > 0 ? '#22c55e' : 'rgba(255,255,255,0.25)',
                            boxShadow: castingCount > 0 ? '0 0 6px #22c55e' : 'none',
                            animation: castingCount > 0 ? 'cpPulse 2s infinite' : 'none',
                        }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: castingCount > 0 ? '#22c55e' : 'rgba(255,255,255,0.35)' }}>
                            {castingCount > 0 ? `${castingCount} screen${castingCount > 1 ? 's' : ''} live` : 'Cast'}
                        </span>
                        <span className="text-base leading-none" style={{ opacity: castingCount > 0 ? 0.8 : 0.4 }}>📺</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Always-visible transport indicator */}
                    {hwDeviceId && (
                        <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-mono font-bold ${
                            lanConnected
                                ? 'bg-green-950/40 border-green-800/50 text-green-400'
                                : deviceOnline
                                    ? 'bg-yellow-950/40 border-yellow-800/50 text-yellow-400'
                                    : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                        }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                                lanConnected ? 'bg-green-400' : deviceOnline ? 'bg-yellow-400' : 'bg-zinc-500'
                            }`} />
                            {lanConnected ? 'LAN' : deviceOnline ? 'CLOUD' : 'OFFLINE'}
                        </div>
                    )}
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
                                {deviceOnline && (
                                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded hidden md:block ${
                                        lanConnected
                                            ? 'bg-green-900/60 text-green-300 border border-green-700'
                                            : 'bg-yellow-900/60 text-yellow-300 border border-yellow-700'
                                    }`}>
                                        {lanConnected ? '● LAN' : '○ CLOUD'}
                                    </span>
                                )}
                            </button>

                            {isDeviceMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsDeviceMenuOpen(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-950 border border-zinc-800 rounded shadow-2xl overflow-hidden z-50">
                                        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Connected Device</div>
                                            <div className="font-mono text-sm text-white">CTRL-{hwDeviceId}</div>
                                        </div>
                                        {/* Transport status row */}
                                        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800/60">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Transport</span>
                                            <span className={`text-[10px] font-mono font-bold ${lanConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {lanConnected ? '● LAN <5ms' : '○ Cloud ~200ms'}
                                            </span>
                                        </div>
                                        {/* Switch to LAN button — only when cloud-only */}
                                        {deviceOnline && !lanConnected && (
                                            <button
                                                onClick={() => { retryLan(); setIsDeviceMenuOpen(false); }}
                                                className="w-full px-4 py-2.5 text-left hover:bg-green-900/20 transition-colors flex items-center gap-2.5 border-b border-zinc-800/60"
                                            >
                                                <span className="text-base">⚡</span>
                                                <div>
                                                    <div className="text-xs font-semibold text-green-400">Switch to LAN</div>
                                                    <div className="text-[10px] text-zinc-500">Connect directly, lower latency</div>
                                                </div>
                                            </button>
                                        )}
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
                    <button onClick={() => setShowHelp(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${L ? 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                        <span className="text-sm">?</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Help</span>
                    </button>
                    <button onClick={handleExportStats} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${L ? 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                        <span className="text-sm">⬇</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Export</span>
                    </button>
                    <button onClick={handleEndGame} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${L ? 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700' : 'bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 text-red-500 hover:text-red-400'}`}>
                        End
                    </button>
                </div>
            </header>

            {/* ── JUMBOTRON SCOREBOARD ──────────────────────────────────────── */}
            <div className={`flex-1 relative flex flex-col justify-center overflow-hidden ${L ? 'bg-slate-100' : 'bg-black'}`}>
                <div className={`absolute inset-0 pointer-events-none ${L ? 'bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.6)_0%,_transparent_70%)]' : 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 to-black'}`}></div>

                <div className="relative z-10 w-full max-w-7xl mx-auto p-4 lg:p-6">
                    <div className="grid grid-cols-12 gap-4 lg:gap-8 h-full max-h-[600px] min-h-[400px]">

                        {/* TEAM A PANEL */}
                        <div className={`col-span-4 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden ${L ? 'bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'bg-zinc-900/40 border border-zinc-800'}`}>
                            <div className="absolute top-0 left-0 w-full h-2" style={{ background: game.teamA.color }}></div>
                            <div className="flex justify-between items-start mb-2">
                                <h2 className={`text-2xl lg:text-4xl font-black italic uppercase tracking-tighter truncate max-w-[85%] ${L ? 'text-slate-900' : 'text-white'}`}>
                                    {game.teamA.name}
                                </h2>
                                {game.gameState.possession === 'A' && (
                                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_red] animate-pulse mt-2"></div>
                                )}
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <div
                                    className={`text-[8rem] lg:text-[11rem] font-mono font-bold leading-none tracking-tighter tabular-nums ${L ? 'text-slate-900' : 'text-white drop-shadow-2xl'}`}
                                    style={{ textShadow: `0 0 50px ${game.teamA.color}40` }}
                                >
                                    {game.teamA.score}
                                </div>
                            </div>
                            <div className={`flex justify-between items-end pt-3 border-t ${L ? 'border-slate-100' : 'border-zinc-800'}`}>
                                <div className="text-center">
                                    <div className={`text-[10px] font-bold uppercase tracking-widest ${L ? 'text-slate-500' : 'text-zinc-500'}`}>Fouls</div>
                                    <div className="text-4xl font-mono font-bold text-red-500 tabular-nums">{game.teamA.fouls}</div>
                                </div>
                                <div className="text-center">
                                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>
                                        Timeouts ({game.teamA.timeouts})
                                    </div>
                                    <div className="flex gap-1.5">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className={`w-3 h-5 rounded-sm transition-all ${i < game.teamA.timeouts ? (L ? 'bg-yellow-700' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]') : (L ? 'bg-slate-200' : 'bg-zinc-800/50')}`}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CENTER CLOCK TOWER */}
                        <div className="col-span-4 flex flex-col gap-4 relative z-20">
                            <div className={`flex-1 border-2 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden ${L ? 'bg-white border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'bg-black border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]'}`}>
                                <div className={`text-[10px] font-bold uppercase tracking-[0.4em] mb-2 z-10 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>Game Time</div>
                                <div className={`relative z-10 flex items-baseline gap-1 transition-colors duration-300 ${timer.gameRunning ? (L ? 'text-slate-900' : 'text-white') : (L ? 'text-slate-400' : 'text-zinc-400')}`}>
                                    <span className={`text-[6rem] lg:text-[8.5rem] font-mono font-bold leading-none tracking-tight tabular-nums ${L ? '' : 'drop-shadow-xl'}`}>
                                        {formatTime(timer.minutes)}:{formatTime(timer.seconds)}
                                    </span>
                                </div>
                            </div>

                            <div className="h-40 grid grid-cols-2 gap-4">
                                <div className={`rounded-xl flex flex-col items-center justify-center backdrop-blur-sm ${L ? 'bg-white border border-slate-200' : 'bg-zinc-900/80 border border-zinc-800'}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>Period</span>
                                    <span className={`text-6xl font-black italic ${L ? 'text-slate-900' : 'text-white'}`}>{getPeriodName(timer.period)}</span>
                                </div>
                                <div className={`border-2 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-lg ${L ? 'bg-slate-100 border-slate-200' : 'bg-black border-zinc-800'}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>Shot Clock</span>
                                    <span className={`text-7xl font-mono font-bold leading-none relative z-10 tabular-nums ${timer.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                                        {timer.shotClock}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* TEAM B PANEL */}
                        <div className={`col-span-4 rounded-2xl p-4 lg:p-6 flex flex-col relative overflow-hidden ${L ? 'bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'bg-zinc-900/40 border border-zinc-800'}`}>
                            <div className="absolute top-0 right-0 w-full h-2" style={{ background: game.teamB.color }}></div>
                            <div className="flex justify-between items-start mb-2 flex-row-reverse">
                                <h2 className={`text-2xl lg:text-4xl font-black italic uppercase tracking-tighter truncate max-w-[85%] text-right ${L ? 'text-slate-900' : 'text-white'}`}>
                                    {game.teamB.name}
                                </h2>
                                {game.gameState.possession === 'B' && (
                                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_red] animate-pulse mt-2"></div>
                                )}
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <div
                                    className={`text-[8rem] lg:text-[11rem] font-mono font-bold leading-none tracking-tighter tabular-nums ${L ? 'text-slate-900' : 'text-white drop-shadow-2xl'}`}
                                    style={{ textShadow: `0 0 50px ${game.teamB.color}40` }}
                                >
                                    {game.teamB.score}
                                </div>
                            </div>
                            <div className={`flex justify-between items-end pt-3 flex-row-reverse border-t ${L ? 'border-slate-100' : 'border-zinc-800'}`}>
                                <div className="text-center">
                                    <div className={`text-[10px] font-bold uppercase tracking-widest ${L ? 'text-slate-500' : 'text-zinc-500'}`}>Fouls</div>
                                    <div className="text-4xl font-mono font-bold text-red-500 tabular-nums">{game.teamB.fouls}</div>
                                </div>
                                <div className="text-center">
                                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>
                                        Timeouts ({game.teamB.timeouts})
                                    </div>
                                    <div className="flex gap-1.5 flex-row-reverse">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className={`w-3 h-5 rounded-sm transition-all ${i < game.teamB.timeouts ? (L ? 'bg-yellow-700' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]') : (L ? 'bg-slate-200' : 'bg-zinc-800/50')}`}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* ── PRO CONTROL DECK (Standard Mode) ──────────────────────────────────────────── */}
            <div className="relative">
                <div className={`p-4 shrink-0 relative z-40 ${L ? 'bg-white border-t-2 border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]' : 'bg-zinc-950 border-t-4 border-zinc-900 shadow-[0_-20px_50px_rgba(0,0,0,0.6)]'}`}>
                    <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-4 h-full pt-2">

                        {/* TEAM A CONTROLS */}
                        <div className="col-span-3 flex flex-col gap-2">
                            <div className={`flex justify-between items-center pb-1 border-b ${L ? 'border-slate-100' : 'border-zinc-800'}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-widest truncate pl-2 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>
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
                        <div className={`col-span-6 rounded-xl p-2 flex flex-col gap-2 ${L ? 'bg-slate-100 border border-slate-200' : 'bg-zinc-900/50 border border-zinc-800'}`}>
                            {hwDeviceId && (
                                <div className={`rounded-lg p-1 flex items-center justify-between mb-2 shadow-inner ${L ? 'bg-white border border-slate-200' : 'bg-black border border-zinc-800'}`}>
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
                                        className={`h-8 rounded text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed ${L ? 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300' : 'bg-black border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'}`}
                                    >
                                        <Icons.Undo />
                                        UNDO {actionHistory.length > 0 && `(${actionHistory.length})`}
                                    </button>
                                </div>
                                <div className={`col-span-3 flex flex-col gap-1 border-x px-2 ${L ? 'border-slate-200' : 'border-zinc-800'}`}>
                                    <button
                                        onClick={(e) => { if (!isWebLocked) handleResetShot(e, 24); }}
                                        className={`flex-1 rounded font-black text-xl shadow-md active:scale-95 ${L ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200' : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600'}`}
                                    >
                                        24
                                    </button>
                                    <button
                                        onClick={(e) => { if (!isWebLocked) handleResetShot(e, 14); }}
                                        className={`flex-1 rounded font-black text-xl shadow-md active:scale-95 ${L ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200' : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600'}`}
                                    >
                                        14
                                    </button>
                                </div>
                                <div className="col-span-4 flex flex-col gap-1">
                                    <button
                                        onClick={(e) => { if (!isWebLocked) handleTogglePossession(e); }}
                                        className={`flex-1 rounded flex items-center justify-center gap-2 transition-all group active:scale-95 ${L ? 'bg-white border border-slate-200 hover:border-slate-300' : 'bg-black border border-zinc-700 hover:border-white'}`}
                                    >
                                        <span className={`text-xl ${game.gameState.possession === 'A' ? (L ? 'text-slate-900' : 'text-white') : (L ? 'text-slate-200' : 'text-zinc-800')}`}>◀</span>
                                        <span className={`text-[10px] font-bold ${L ? 'text-slate-500 group-hover:text-slate-900' : 'text-zinc-500 group-hover:text-white'}`}>POSS</span>
                                        <span className={`text-xl ${game.gameState.possession === 'B' ? (L ? 'text-slate-900' : 'text-white') : (L ? 'text-slate-200' : 'text-zinc-800')}`}>▶</span>
                                    </button>
                                    <button
                                        onClick={() => playSound('horn')}
                                        className={`h-8 rounded text-[9px] font-black uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 ${L ? 'bg-slate-100 hover:bg-red-600 hover:text-white text-slate-500 border border-slate-200' : 'bg-zinc-800 hover:bg-white hover:text-black border border-zinc-600 text-zinc-400'}`}
                                    >
                                        SIREN 🔊
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* TEAM B CONTROLS */}
                        <div className="col-span-3 flex flex-col gap-2">
                            <div className={`flex justify-between items-center pb-1 border-b flex-row-reverse ${L ? 'border-slate-100' : 'border-zinc-800'}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-widest truncate ${L ? 'text-slate-500' : 'text-zinc-500'}`}>
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
                <div className={`fixed inset-0 z-[100] backdrop-blur flex items-center justify-center p-4 ${L ? 'bg-slate-900/30' : 'bg-black/80'}`}>
                    <div className={`p-6 max-w-md w-full shadow-2xl rounded-xl ${L ? 'bg-white border border-slate-200' : 'bg-zinc-900 border border-zinc-700'}`}>
                        <h3 className={`text-xl font-bold mb-4 uppercase tracking-widest pb-2 ${L ? 'border-b border-slate-100 text-slate-900' : 'border-b border-zinc-700'}`}>Shortcuts</h3>
                        <div className={`space-y-2 text-sm font-mono ${L ? 'text-slate-500' : 'text-zinc-400'}`}>
                            <div className="flex justify-between"><span>SPACE</span><span className={L ? 'text-slate-900' : 'text-white'}>Start/Stop Clock</span></div>
                            <div className="flex justify-between"><span>R</span><span className={L ? 'text-slate-900' : 'text-white'}>Reset Shot (24s)</span></div>
                            <div className="flex justify-between"><span>T</span><span className={L ? 'text-slate-900' : 'text-white'}>Reset Shot (14s)</span></div>
                            <div className="flex justify-between"><span>P</span><span className={L ? 'text-slate-900' : 'text-white'}>Possession</span></div>
                            <div className="flex justify-between"><span>CTRL+Z</span><span className={L ? 'text-slate-900' : 'text-white'}>Undo</span></div>
                            <div className="flex justify-between"><span>H</span><span className={L ? 'text-slate-900' : 'text-white'}>Help</span></div>
                        </div>
                        <button onClick={() => setShowHelp(false)} className={`mt-6 w-full py-3 font-bold uppercase tracking-widest rounded ${L ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-black hover:bg-zinc-200'}`}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* ── PLAYER SELECTION POPUP ────────────────────────────────────── */}
            {showPlayerPopup && pendingAction && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className={`absolute inset-0 backdrop-blur-sm ${L ? 'bg-slate-900/30' : 'bg-black/80'}`} onClick={() => setShowPlayerPopup(false)}></div>

                    <div className={`w-full max-w-2xl relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl rounded-sm ${L ? 'bg-white border border-slate-200' : 'bg-zinc-950 border border-zinc-800'}`}>
                        <div className={`flex justify-between items-center p-6 border-b ${L ? 'border-slate-100' : 'border-zinc-800'}`}>
                            <div>
                                <h3 className={`text-sm font-bold uppercase tracking-widest ${L ? 'text-slate-900' : 'text-white'}`}>
                                    {pendingAction.type === 'points' ? `+${pendingAction.value} POINT${pendingAction.value !== 1 ? 'S' : ''}` : 'FOUL'}
                                </h3>
                                <p className={`text-xs mt-1 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>
                                    Select player for {pendingAction.team === 'A' ? game.teamA.name : game.teamB.name}
                                </p>
                            </div>
                            <button onClick={() => setShowPlayerPopup(false)} className={`text-2xl transition-colors ${L ? 'text-slate-300 hover:text-slate-900' : 'text-zinc-500 hover:text-white'}`}>
                                &times;
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {activePlayers.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className={`mb-4 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>No players in roster</p>
                                    <button onClick={skipPlayerSelection} className={`px-6 py-2 font-bold uppercase tracking-wider rounded transition-colors ${L ? 'bg-slate-100 hover:bg-slate-200 text-slate-900' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
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
                                                className={`p-4 rounded-lg transition-all text-left group ${L ? 'bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300' : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700'}`}
                                            >
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className={`text-2xl font-black transition-colors ${L ? 'text-slate-300 group-hover:text-slate-900' : 'text-zinc-600 group-hover:text-white'}`}>
                                                        #{player.number || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-sm font-bold truncate ${L ? 'text-slate-900' : 'text-white'}`}>{player.name}</div>
                                                        <div className={`text-[10px] uppercase tracking-wider ${L ? 'text-slate-500' : 'text-zinc-600'}`}>{player.position || 'Player'}</div>
                                                    </div>
                                                </div>
                                                <div className={`flex gap-3 text-[10px] ${L ? 'text-slate-500' : 'text-zinc-600'}`}>
                                                    <span>PTS: {player.points || 0}</span>
                                                    <span>FOULS: {player.fouls || 0}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={skipPlayerSelection} className={`w-full py-3 font-bold text-xs uppercase tracking-wider rounded transition-colors ${L ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white'}`}>
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
                <div className={`fixed inset-0 z-[100] backdrop-blur flex items-center justify-center p-4 ${L ? 'bg-slate-900/30' : 'bg-black/80'}`}>
                    <div className={`w-full max-w-md shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200 ${L ? 'bg-white border border-slate-200' : 'bg-zinc-900 border border-zinc-700'}`}>
                        <div className={`p-4 flex justify-between items-center ${L ? 'bg-slate-50 border-b border-slate-100' : 'bg-black border-b border-zinc-800'}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${L ? 'text-slate-900' : 'text-white'}`}>
                                <span className="text-amber-500">⚠️</span> Pause & Exit
                            </h3>
                            <button onClick={() => setShowBackConfirm(false)} className={`transition-colors ${L ? 'text-slate-300 hover:text-slate-900' : 'text-zinc-500 hover:text-white'}`}>&times;</button>
                        </div>
                        <div className="p-6">
                            <p className={`text-sm mb-6 ${L ? 'text-slate-600' : 'text-zinc-400'}`}>
                                Are you sure you want to leave the console? The game clock will be paused and you will return to the dashboard.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowBackConfirm(false)}
                                    className={`flex-1 py-3 rounded text-xs font-bold uppercase tracking-widest transition-all ${L ? 'border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (timer.gameRunning) timer.stopClock();
                                        navigate('/dashboard');
                                    }}
                                    className={`flex-1 py-3 rounded text-xs font-bold uppercase tracking-widest transition-all ${L ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-black hover:bg-zinc-200'}`}
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
                <div className={`fixed inset-0 z-[100] backdrop-blur flex items-center justify-center p-4 ${L ? 'bg-slate-900/30' : 'bg-black/80'}`}>
                    <div className={`w-full max-w-md shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200 ${L ? 'bg-white border border-slate-200' : 'bg-zinc-900 border border-zinc-700'}`}>
                        <div className={`p-4 flex justify-between items-center ${L ? 'bg-slate-50 border-b border-slate-100' : 'bg-black border-b border-zinc-800'}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${L ? 'text-slate-900' : 'text-white'}`}>
                                <span>⚙️</span> Match Settings
                            </h3>
                            <button onClick={() => setShowSettings(false)} className={`transition-colors ${L ? 'text-slate-300 hover:text-slate-900' : 'text-zinc-500 hover:text-white'}`}>&times;</button>
                        </div>
                        <div className="p-8 text-center">
                            <span className="text-4xl grayscale opacity-50 mb-4 block">🛠️</span>
                            <h4 className={`font-bold mb-2 ${L ? 'text-slate-900' : 'text-white'}`}>Advanced Settings</h4>
                            <p className={`text-xs ${L ? 'text-slate-500' : 'text-zinc-500'}`}>This feature is currently under development. You will be able to edit team names, colors, and game rules here soon.</p>
                        </div>
                        <div className={`p-4 ${L ? 'bg-slate-50 border-t border-slate-100' : 'bg-black border-t border-zinc-800'}`}>
                            <button
                                onClick={() => setShowSettings(false)}
                                className={`w-full py-3 rounded text-xs font-bold uppercase tracking-widest transition-all active:scale-95 ${L ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-black hover:bg-zinc-200'}`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── FLOATING UNDO TOAST ─────────────────────────────────────── */}
            {undoToast && (
                <div
                    key={undoToast.id}
                    className={`fixed bottom-6 left-1/2 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl ${L ? 'bg-white border-slate-200' : 'bg-zinc-950 border-zinc-700'}`}
                    style={{
                        transform: 'translateX(-50%)',
                        animation: 'undoSlideIn 0.2s ease',
                        minWidth: 220,
                    }}
                >
                    <div className="flex-1 min-w-0">
                        <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-0.5 ${L ? 'text-slate-500' : 'text-zinc-500'}`}>Last action</div>
                        <div className={`text-sm font-bold truncate ${L ? 'text-slate-900' : 'text-white'}`}>{undoToast.label}</div>
                    </div>
                    <button
                        onClick={() => {
                            handleUndoRef.current();
                            setUndoToast(null);
                            if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex-shrink-0 ${L ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-black hover:bg-zinc-200'}`}
                    >
                        Undo
                    </button>
                    <button
                        onClick={() => setUndoToast(null)}
                        className={`transition-colors text-lg leading-none flex-shrink-0 ${L ? 'text-slate-300 hover:text-slate-900' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Helper Components ────────────────────────────────────────────────────────

const TactileBtn = ({ label, color, isLocked, onClick }: { label: string; color: string; isLocked?: boolean; onClick: (e: React.MouseEvent) => void }) => {
    const [popKey, setPopKey] = React.useState<number | null>(null);
    const isLight = document.documentElement.classList.contains('light');

    const handleClick = (e: React.MouseEvent) => {
        if (isLocked) return;
        setPopKey(Date.now());
        setTimeout(() => setPopKey(null), 700);
        onClick(e);
    };

    return (
        <button
            onClick={handleClick}
            disabled={isLocked}
            className={`h-full rounded border hover:border-zinc-500 transition-all relative overflow-hidden shadow-sm flex items-center justify-center
                ${isLocked
                    ? (isLight ? 'bg-slate-100 border-slate-100 opacity-50 cursor-not-allowed' : 'bg-zinc-950/50 border-zinc-800/50 opacity-50 cursor-not-allowed grayscale')
                    : (isLight
                        ? 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 group shadow-[inset_0_-1px_2px_rgba(0,0,0,0.04)]'
                        : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 active:scale-95 active:bg-white group')
                }`}
            style={{ borderBottom: isLocked ? (isLight ? '1px solid #E2DAD0' : '1px solid #333') : `3px solid ${color}` }}
        >
            {isLocked && <span className="absolute top-1 right-1 text-[8px] opacity-50">🔒</span>}
            <span className={`relative z-10 text-xl font-black italic ${isLocked
                ? (isLight ? 'text-slate-300' : 'text-zinc-600')
                : (isLight ? 'text-slate-900 group-active:text-white' : 'text-white group-active:text-black')
                }`}>{label}</span>
            {popKey && (
                <span
                    key={popKey}
                    className={`absolute inset-x-0 top-1 text-center font-black pointer-events-none select-none ${isLight ? 'text-red-600' : 'text-green-400'}`}
                    style={{ fontSize: 13, animation: 'scoreFloat 0.65s ease forwards', zIndex: 20 }}
                >
                    {label}
                </span>
            )}
        </button>
    );
};

const AdminBtn = ({ label, value, type, isLocked, onClick }: { label: string; value: number; type: 'danger' | 'warning'; isLocked?: boolean; onClick: (e: React.MouseEvent) => void }) => {
    const isLight = document.documentElement.classList.contains('light');
    const styles = isLight ? {
        danger: isLocked ? "text-red-300 border-red-200 bg-slate-50" : "text-red-600 border-red-200 hover:bg-red-50 bg-white",
        warning: isLocked ? "text-amber-300 border-amber-200 bg-slate-50" : "text-amber-700 border-amber-200 hover:bg-amber-50 bg-white",
    } : {
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