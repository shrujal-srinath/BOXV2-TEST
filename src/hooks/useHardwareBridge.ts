// src/hooks/useHardwareBridge.ts
import { useState, useEffect } from 'react';
import {
    subscribeToDeviceHeartbeat,
    subscribeToControlMode,
    setControlMode,
    HW_SESSION_KEY,
    type ControlMode,
} from '../services/handheldService';

export const useHardwareBridge = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [controlMode, setControlModeState] = useState<ControlMode>('web');
    const deviceId = sessionStorage.getItem(HW_SESSION_KEY);

    useEffect(() => {
        if (!deviceId) return;

        const unsubHB = subscribeToDeviceHeartbeat(deviceId, (online) => {
            setIsConnected(online);
        });

        const unsubCM = subscribeToControlMode(deviceId, (mode) => {
            setControlModeState(mode);
        });

        return () => {
            unsubHB();
            unsubCM();
        };
    }, [deviceId]);

    const setAuthority = async (mode: ControlMode) => {
        if (!deviceId) return;
        await setControlMode(deviceId, mode);
    };

    return {
        isConnected,
        transport: isConnected ? 'supabase' as const : 'none' as const,
        remoteState: null,
        controlMode,
        pushGameState: () => { }, // ESP32 pulls state, no push needed
        setAuthority,
    };
};