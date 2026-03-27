// src/hooks/useRefereeBox.ts — THE BOX Referee Hardware Hook v3

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface TeamState {
    name: string;
    score: number;
    fouls: number;
    timeouts: number;
    color: string;
}

export interface ClockState {
    gameMs: number;
    shotMs: number;
    isRunning: boolean;
    period: number;
    totalPeriods: number;
    periodMinutes: number;
    shotClockSeconds: number;
}

export interface Player {
    id: string;
    name: string;
    number: string;
}

export interface GameState {
    teamA: TeamState;
    teamB: TeamState;
    clock: ClockState;
    ui: { isTouchUnlocked: boolean };
    meta: {
        gameCode: string | null;
        gameActive: boolean;
        periodType: 'quarter' | 'half';
        gameMode: 'quick' | 'stats' | 'advanced';
        players: { teamA: Player[]; teamB: Player[] };
    };
}

export interface GameConfig {
    teamAName: string;
    teamBName: string;
    teamAColor: string;
    teamBColor: string;
    periodMinutes: number;
    shotClockSeconds: number;
    periods: number;
    periodType: 'quarter' | 'half';
    timeoutsPerTeam?: number;
    gameMode?: 'quick' | 'stats' | 'advanced';
    playersA?: Player[];
    playersB?: Player[];
    existingGameCode?: string;
}

// Emitted by daemon when a score button is pressed
export interface ScorePendingEvent {
    team: 'A' | 'B';
    points: 1 | 2 | 3;
    players: Player[];
    gameMode: 'quick' | 'stats' | 'advanced';
}

const SOCKET_URL = 'http://localhost:3001';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

export function useRefereeBox() {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [setupError, setSetupError] = useState<string | null>(null);

    // Score pending — shown as popup overlay
    const [scorePending, setScorePending] = useState<ScorePendingEvent | null>(null);

    // Undo flash — brief animation on screen
    const [undoFlash, setUndoFlash] = useState(false);

    // Settings unlock flash
    const [settingsFlash, setSettingsFlash] = useState<boolean | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;
        if (socketRef.current?.connected) return;

        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
        }

        const socket = io(SOCKET_URL, { reconnection: false, timeout: 5000 });
        socketRef.current = socket;

        socket.on('connect', () => {
            if (!mountedRef.current) return;
            setIsConnected(true);
            reconnectAttemptRef.current = 0;
            if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        });

        socket.on('disconnect', () => {
            if (!mountedRef.current) return;
            setIsConnected(false);
            scheduleReconnect();
        });

        socket.on('connect_error', () => {
            if (!mountedRef.current) return;
            setIsConnected(false);
            scheduleReconnect();
        });

        socket.on('state_update', (rawState: any) => {
            if (!mountedRef.current) return;
            const newState: GameState = {
                ...rawState,
                ui: rawState.ui ?? { isTouchUnlocked: false },
                meta: rawState.meta ?? { gameCode: null, gameActive: false, periodType: 'quarter', gameMode: 'quick', players: { teamA: [], teamB: [] } },
            };
            setGameState(newState);
            if (newState.meta?.gameCode) setGameCode(newState.meta.gameCode);
        });

        socket.on('clock_sync', (clockData: ClockState) => {
            if (!mountedRef.current) return;
            setGameState(prev => prev ? { ...prev, clock: clockData } : null);
        });

        socket.on('game_ready', ({ gameCode: code }: { gameCode: string }) => {
            if (!mountedRef.current) return;
            setGameCode(code);
            setIsSettingUp(false);
            setSetupError(null);
        });

        socket.on('game_ended', () => {
            if (!mountedRef.current) return;
            setGameCode(null);
            setScorePending(null);
        });

        socket.on('setup_error', ({ message }: { message: string }) => {
            if (!mountedRef.current) return;
            setSetupError(message);
            setIsSettingUp(false);
        });

        // Score button pressed — show popup based on mode
        socket.on('score_pending', (event: ScorePendingEvent) => {
            if (!mountedRef.current) return;
            // In quick mode, score already updated, no popup needed
            if (event.gameMode === 'quick') return;
            setScorePending(event);
        });

        // Undo button pressed — flash the UI
        socket.on('undo_triggered', () => {
            if (!mountedRef.current) return;
            setUndoFlash(true);
            setTimeout(() => setUndoFlash(false), 600);
        });

        // Settings toggled — flash indicator
        socket.on('settings_toggled', ({ unlocked }: { unlocked: boolean }) => {
            if (!mountedRef.current) return;
            setSettingsFlash(unlocked);
            setTimeout(() => setSettingsFlash(null), 2000);
        });

    }, []);

    const scheduleReconnect = useCallback(() => {
        if (!mountedRef.current) return;
        if (reconnectTimerRef.current) return;
        const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current), RECONNECT_MAX_MS);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
        }, delay);
    }, [connect]);

    useEffect(() => {
        mountedRef.current = true;
        connect();
        return () => {
            mountedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            socketRef.current?.removeAllListeners();
            socketRef.current?.disconnect();
            socketRef.current = null;
        };
    }, [connect]);

    const setupGame = useCallback((config: GameConfig) => {
        if (!socketRef.current?.connected) { setSetupError('Not connected to hardware daemon'); return; }
        setIsSettingUp(true);
        setSetupError(null);
        socketRef.current.emit('setup_game', config);
    }, []);

    const sendAction = useCallback((type: string, payload: Record<string, unknown> = {}) => {
        socketRef.current?.emit('ui_action', { type, payload });
    }, []);

    const endGame = useCallback(() => {
        socketRef.current?.emit('end_game');
    }, []);

    // Called when shot popup completes (player selected, court tapped, etc)
    const attributeShot = useCallback((data: {
        team: 'A' | 'B';
        points: number;
        playerId: string | null;
        playerName: string | null;
        zone?: string;
        x?: number;
        y?: number;
    }) => {
        socketRef.current?.emit('shot_attributed', data);
        setScorePending(null);
    }, []);

    // Dismiss popup without attribution
    const dismissScorePending = useCallback(() => {
        setScorePending(null);
    }, []);

    const formatGameClock = useCallback((ms: number): string => {
        const totalSeconds = Math.ceil(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }, []);

    const formatShotClock = useCallback((ms: number): string => {
        return String(Math.ceil(ms / 1000));
    }, []);

    return {
        gameState,
        isConnected,
        gameCode,
        isSettingUp,
        setupError,
        scorePending,
        undoFlash,
        settingsFlash,
        setupGame,
        sendAction,
        endGame,
        attributeShot,
        dismissScorePending,
        formatGameClock,
        formatShotClock,
    };
}