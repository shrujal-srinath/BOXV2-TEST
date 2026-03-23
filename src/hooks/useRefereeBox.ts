import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export interface GameState {
    teamA: { name: string; score: number; fouls: number; timeouts: number };
    teamB: { name: string; score: number; fouls: number; timeouts: number };
    clock: { gameMs: number; shotMs: number; isRunning: boolean; period: number };
    ui: { isTouchUnlocked: boolean };
}

const SOCKET_URL = 'http://localhost:3001';
let socketInstance: Socket | null = null;

export function useRefereeBox() {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!socketInstance) {
            socketInstance = io(SOCKET_URL);
        }

        socketInstance.on('connect', () => {
            console.log('✅ Connected to BOX Hardware Daemon');
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            setIsConnected(false);
        });

        socketInstance.on('state_update', (newState: GameState) => {
            setGameState(newState);
        });

        socketInstance.on('clock_sync', (clockData) => {
            setGameState((prevState) => {
                if (!prevState) return null;
                return { ...prevState, clock: clockData };
            });
        });

        return () => {
            // Intentionally not disconnecting here so it persists across hot reloads
            socketInstance?.off('connect');
            socketInstance?.off('disconnect');
            socketInstance?.off('state_update');
            socketInstance?.off('clock_sync');
        };
    }, []);

    const sendAction = (type: string, payload: any = {}) => {
        if (socketInstance && isConnected) {
            socketInstance.emit('ui_action', { type, payload });
        }
    };

    const formatGameClock = (ms: number) => {
        const totalSeconds = Math.ceil(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const formatShotClock = (ms: number) => {
        return Math.ceil(ms / 1000).toString();
    };

    return {
        gameState,
        isConnected,
        formatGameClock,
        formatShotClock,
        sendAction
    };
}