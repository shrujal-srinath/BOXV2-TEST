// src/hooks/useRefereeBox.ts
// ═══════════════════════════════════════════════════════════════
// THE BOX — Referee Hardware Hook v2
//
// Manages the Socket.io connection to the local Pi daemon on :3001.
// Handles reconnection automatically with exponential backoff.
//
// Events sent TO daemon:
//   setup_game  — start a new game with config
//   ui_action   — score/foul edits (only when screen unlocked)
//   end_game    — finish the current game
//
// Events received FROM daemon:
//   state_update — full game state (on connect + after every action)
//   clock_sync   — clock-only update (10x/sec while running)
//   game_ready   — emitted after setup_game, carries { gameCode }
//   game_ended   — emitted after end_game
//   setup_error  — if game creation failed
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── Types ────────────────────────────────────────────────────

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

export interface GameState {
    teamA: TeamState;
    teamB: TeamState;
    clock: ClockState;
    ui: { isTouchUnlocked: boolean };
    meta: {
        gameCode: string | null;
        gameActive: boolean;
        periodType: 'quarter' | 'half';
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
    /** Online path only — game already exists in Supabase, daemon adopts it instead of creating */
    existingGameCode?: string;
}

// ─── Constants ────────────────────────────────────────────────

const SOCKET_URL = 'http://localhost:3001';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

// ─── Hook ─────────────────────────────────────────────────────

export function useRefereeBox() {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [setupError, setSetupError] = useState<string | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    // ── Connection ──────────────────────────────────────────────

    const connect = useCallback(() => {
        if (!mountedRef.current) return;
        if (socketRef.current?.connected) return;

        // Clean up any existing socket before creating a new one
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
        }

        const socket = io(SOCKET_URL, {
            reconnection: false,    // We handle reconnection manually for full control
            timeout: 5000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            if (!mountedRef.current) return;
            console.log('✅ Connected to BOX daemon');
            setIsConnected(true);
            reconnectAttemptRef.current = 0;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        });

        socket.on('disconnect', (reason) => {
            if (!mountedRef.current) return;
            console.warn('🔌 Daemon disconnected:', reason);
            setIsConnected(false);
            scheduleReconnect();
        });

        socket.on('connect_error', () => {
            if (!mountedRef.current) return;
            setIsConnected(false);
            scheduleReconnect();
        });

        socket.on('state_update', (newState: GameState) => {
            if (!mountedRef.current) return;
            setGameState(newState);
            // Sync game code from state in case of reconnect mid-game
            if (newState.meta?.gameCode) setGameCode(newState.meta.gameCode);
        });

        socket.on('clock_sync', (clockData: ClockState) => {
            if (!mountedRef.current) return;
            setGameState(prev => prev ? { ...prev, clock: clockData } : null);
        });

        socket.on('game_ready', ({ gameCode: code }: { gameCode: string }) => {
            if (!mountedRef.current) return;
            console.log(`🎮 Game ready: ${code}`);
            setGameCode(code);
            setIsSettingUp(false);
            setSetupError(null);
        });

        socket.on('game_ended', () => {
            if (!mountedRef.current) return;
            console.log('🏁 Game ended');
            setGameCode(null);
        });

        socket.on('setup_error', ({ message }: { message: string }) => {
            if (!mountedRef.current) return;
            console.error('❌ Setup error:', message);
            setSetupError(message);
            setIsSettingUp(false);
        });
    }, []);

    const scheduleReconnect = useCallback(() => {
        if (!mountedRef.current) return;
        if (reconnectTimerRef.current) return; // already scheduled

        const attempt = reconnectAttemptRef.current;
        // Exponential backoff: 1s, 2s, 4s, 8s, 15s, 15s, ...
        const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
        reconnectAttemptRef.current += 1;

        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${attempt + 1})`);

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

    // ── Actions ─────────────────────────────────────────────────

    /**
     * Called from SetupScreen when referee taps "Start Game".
     * Daemon creates the Supabase game and responds with game_ready.
     */
    const setupGame = useCallback((config: GameConfig) => {
        if (!socketRef.current?.connected) {
            setSetupError('Not connected to hardware daemon');
            return;
        }
        setIsSettingUp(true);
        setSetupError(null);
        socketRef.current.emit('setup_game', config);
    }, []);

    /**
     * Touch UI action — only works when screen is unlocked by physical button.
     */
    const sendAction = useCallback((type: string, payload: Record<string, unknown> = {}) => {
        socketRef.current?.emit('ui_action', { type, payload });
    }, []);

    /**
     * Ends the current game — marks completed in Supabase and resets daemon.
     */
    const endGame = useCallback(() => {
        socketRef.current?.emit('end_game');
    }, []);

    // ── Formatters ──────────────────────────────────────────────

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
        setupGame,
        sendAction,
        endGame,
        formatGameClock,
        formatShotClock,
    };
}