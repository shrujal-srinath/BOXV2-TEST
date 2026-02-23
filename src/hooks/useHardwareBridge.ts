// src/hooks/useHardwareBridge.ts
//
// THE BOX — Hardware Bridge Hook
// BMSCE Sports Tech Division
//
// Central hook for tracking ESP32 controller connection state.
// Used by: Dashboard, HostConsole, GameSetup, ConnectControllerModal
//
// Returns:
//   isConnected   → true if ESP32 heartbeat is live
//   controlMode   → 'web' | 'hardware' | 'shared'
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

    // Read device ID from session storage (set during pairing)
    // We read this once — it doesn't change during a session
    const deviceId = sessionStorage.getItem(HW_SESSION_KEY);

    useEffect(() => {
        if (!deviceId) {
            // No device paired — stay disconnected
            setIsConnected(false);
            return;
        }

        // Subscribe to heartbeat — updates whenever ESP32 pings Supabase
        const unsubHeartbeat = subscribeToDeviceHeartbeat(deviceId, (online) => {
            setIsConnected(online);
        });

        // Subscribe to control mode changes — updates when operator switches modes
        const unsubControlMode = subscribeToControlMode(deviceId, (mode) => {
            setControlModeState(mode);
        });

        return () => {
            unsubHeartbeat();
            unsubControlMode();
        };
    }, [deviceId]);

    /**
     * Switch control authority between hardware, web, and shared modes.
     * Writes to Supabase → ESP32 polls and obeys on its next cycle (~2s).
     */
    const setAuthority = async (mode: ControlMode): Promise<void> => {
        if (!deviceId) return;
        await setControlMode(deviceId, mode);
    };

    return {
        isConnected,
        // 'supabase' when connected so components know what transport is active
        transport: isConnected ? 'supabase' : 'none',
        remoteState: null,
        controlMode,
        // ESP32 pulls game state from Supabase itself — no push needed from web
        pushGameState: () => { },
        setAuthority,
    };
};