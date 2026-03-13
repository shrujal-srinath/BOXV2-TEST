// src/hooks/useHardwareBridge.ts
//
// THE BOX — Hardware Bridge Hook
// BMSCE Sports Tech Division
//
// v3.0 — Simplified to 2 modes: 'hardware' | 'web'
//
// Central hook for tracking ESP32 controller connection state.
// Used by: Dashboard, HostConsole, GameSetup, ConnectControllerModal
//
// Returns:
//   isConnected   → true if ESP32 heartbeat is live
//   controlMode   → 'web' | 'hardware'
//   transport     → 'supabase' | 'none'
//   setAuthority  → function to switch control mode
//   pushGameState → no-op (ESP32 pulls state, we don't push)

import { useState, useEffect } from 'react';
import {
    subscribeToDeviceHeartbeat,
    subscribeToControlMode,
    setControlMode,
    HW_SESSION_KEY,
    type ControlMode,
} from '../services/handheldService';

interface HardwareBridgeReturn {
    isConnected: boolean;
    transport: 'supabase' | 'none';
    remoteState: null;
    controlMode: ControlMode;
    pushGameState: (..._args: any[]) => void;
    setAuthority: (mode: ControlMode) => Promise<void>;
}

export const useHardwareBridge = (): HardwareBridgeReturn => {
    const [isConnected, setIsConnected] = useState(false);
    const [controlMode, setControlModeState] = useState<ControlMode>('hardware');

    const deviceId = sessionStorage.getItem(HW_SESSION_KEY);

    useEffect(() => {
        if (!deviceId) {
            setIsConnected(false);
            return;
        }

        const unsubHeartbeat = subscribeToDeviceHeartbeat(deviceId, (online) => {
            setIsConnected(online);
        });

        const unsubControlMode = subscribeToControlMode(deviceId, (mode) => {
            setControlModeState(mode);
        });

        return () => {
            unsubHeartbeat();
            unsubControlMode();
        };
    }, [deviceId]);

    /**
     * Switch control authority between hardware and web modes.
     * Writes to Supabase → ESP32 polls and obeys on its next cycle (~2s).
     */
    const setAuthority = async (mode: ControlMode): Promise<void> => {
        if (!deviceId) return;
        await setControlMode(deviceId, mode);
    };

    return {
        isConnected,
        transport: isConnected ? 'supabase' : 'none',
        remoteState: null,
        controlMode,
        pushGameState: () => { },
        setAuthority,
    };
};