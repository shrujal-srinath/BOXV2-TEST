// src/hooks/useHardwareBridge.ts
import { useState, useEffect, useRef } from 'react';
import {
    subscribeToDeviceHeartbeat,
    subscribeToControlMode,
    setControlMode,
    HW_SESSION_KEY,
    type ControlMode,
} from '../services/handheldService';

// Explicitly defining the return type prevents TypeScript from throwing "No Overlap" errors in the UI
export interface HardwareBridgeReturn {
    isConnected: boolean;
    transport: 'none' | 'websocket' | 'rtdb' | 'supabase';
    remoteState: any;
    controlMode: ControlMode;
    pushGameState: () => void;
    setAuthority: (mode: ControlMode) => Promise<void>;
}

export const useHardwareBridge = (): HardwareBridgeReturn => {
    const [isConnected, setIsConnected] = useState(false);
    const [controlMode, setControlModeState] = useState<ControlMode>('web');
    const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
    const isConnectedRef = useRef(false);

    useEffect(() => {
        if (!deviceId) return;
        let fallbackTimer: NodeJS.Timeout;

        const unsubHB = subscribeToDeviceHeartbeat(deviceId, (online) => {
            setIsConnected(online);
            isConnectedRef.current = online;

            // Auto-Fallback: If device dies while in hardware mode, reclaim control to web after 15s
            if (!online) {
                fallbackTimer = setTimeout(() => {
                    if (!isConnectedRef.current) {
                        console.warn("[Hardware] Device lost. Auto-reclaiming Web control.");
                        setControlMode(deviceId, 'web');
                    }
                }, 15000);
            } else {
                clearTimeout(fallbackTimer);
            }
        });

        const unsubCM = subscribeToControlMode(deviceId, (mode) => {
            setControlModeState(mode);
        });

        return () => {
            unsubHB();
            unsubCM();
            clearTimeout(fallbackTimer);
        };
    }, [deviceId]);

    const setAuthority = async (mode: ControlMode) => {
        if (!deviceId) return;
        await setControlMode(deviceId, mode);
    };

    return {
        isConnected,
        transport: isConnected ? 'supabase' : 'none',
        remoteState: null,
        controlMode,
        pushGameState: () => { }, // ESP32 pulls state, no push needed
        setAuthority,
    };
};