import { useState, useEffect, useCallback, useRef } from 'react';
import { rtdb } from '../services/firebase';
import { ref, set, onValue, off, update } from 'firebase/database';
import { HW_SESSION_KEY, ControlMode, hwPath } from '../services/handheldService';

interface HardwareState {
    isConnected: boolean;
    transport: 'rtdb' | 'websocket' | 'none';
    lastInput: any | null;
    controlMode: ControlMode;
}

export interface BridgeGameState {
    scoreA: number;
    scoreB: number;
    quarter: number;
    shotClock: number;
}

export function useHardwareBridge() {
    const [state, setState] = useState<HardwareState>({
        isConnected: false,
        transport: 'none',
        lastInput: null,
        controlMode: 'web' // Initial default
    });

    const [remoteState, setRemoteState] = useState<BridgeGameState | null>(null);
    const codeRef = useRef<string | null>(null);
    const lastPushedData = useRef<BridgeGameState | null>(null);

    useEffect(() => {
        const code = sessionStorage.getItem(HW_SESSION_KEY);
        if (!code || !rtdb) return;
        codeRef.current = code;

        setState(s => ({ ...s, isConnected: true, transport: 'rtdb' }));

        // 1. Listen for Authority changes
        const modeRef = ref(rtdb, hwPath.controlMode(code));
        onValue(modeRef, (snap) => {
            if (snap.exists()) {
                setState(prev => ({ ...prev, controlMode: snap.val() as ControlMode }));
            }
        });

        // 2. Listen for scores coming FROM the ESP32
        const stateRef = ref(rtdb, hwPath.root(code) + '/gameState');
        onValue(stateRef, (snap) => {
            if (snap.exists()) {
                setRemoteState(snap.val() as BridgeGameState);
            }
        });

        return () => {
            off(modeRef);
            off(stateRef);
        };
    }, []);

    const setAuthority = useCallback(async (mode: ControlMode) => {
        if (!codeRef.current || !rtdb) return;
        await set(ref(rtdb, hwPath.controlMode(codeRef.current)), mode);
    }, []);

    // Optimized PUSH with Throttling to save Quota
    const pushGameState = useCallback((data: BridgeGameState) => {
        // Stop writing if ESP32 is the Parent
        if (!codeRef.current || !rtdb || state.controlMode === 'hardware') return;

        // Don't push if the values haven't actually changed
        if (
            lastPushedData.current?.scoreA === data.scoreA &&
            lastPushedData.current?.scoreB === data.scoreB &&
            lastPushedData.current?.shotClock === data.shotClock
        ) return;

        lastPushedData.current = data;
        update(ref(rtdb, hwPath.root(codeRef.current) + '/gameState'), data);
    }, [state.controlMode]);

    return { ...state, remoteState, pushGameState, setAuthority };
}