// src/contexts/HardwareContext.tsx
//
// THE BOX — Centralized Hardware State Provider
// BMSCE Sports Tech Division — v5.0
//
// PURPOSE:
//   Eliminates redundant Supabase Realtime subscriptions. Previously, each
//   component (HostConsole, ControllerStatusBar, GameSetup, Dashboard) created
//   its own heartbeat + control mode subscriptions — 6+ channels for the same
//   device. This provider creates ONE subscription set at the app root, and
//   all components consume from context.
//
// PROVIDES:
//   - deviceId          → The paired device code (or null)
//   - isConnected       → Live heartbeat status
//   - controlMode       → Current 'web' | 'hardware' mode
//   - lastSeenAt        → Timestamp of last heartbeat
//   - isPaired          → True if any device is stored (even if offline)
//   - pair()            → Triggers pairing flow
//   - unpair()          → Triggers unpairing
//   - setMode()         → Switch control mode
//   - activateGame()    → Transition device to active + game
//   - autoReconnect()   → Check stored pairing on app boot
//
// USAGE:
//   // In App.tsx or layout root:
//   <HardwareProvider userId={user.id}>
//       <AppRoutes />
//   </HardwareProvider>
//
//   // In any child component:
//   const { isConnected, controlMode, setMode } = useHardware();

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
    getDeviceId,
    getStoredPairing,
    tryAutoReconnect,
    pairHandheldDevice,
    unpairHandheldDevice,
    subscribeToDeviceHeartbeat,
    subscribeToControlMode,
    setControlMode,
    activateGameOnDevice,
    type ControlMode,
} from '../services/handheldService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HardwareState {
    /** The 4-char device code, or null if no device is paired */
    deviceId: string | null;
    /** True if ESP32 heartbeat is actively ticking */
    isConnected: boolean;
    /** Current control authority */
    controlMode: ControlMode;
    /** Timestamp of last heartbeat received (Date.now() when received) */
    lastSeenAt: number;
    /** True if a device ID is stored (even if currently offline) */
    isPaired: boolean;
    /** True during auto-reconnect check on boot */
    isReconnecting: boolean;
}

interface HardwareActions {
    /** Run the pairing flow. Returns the phase callback for UI animation. */
    pair: (
        code: string,
        userId: string,
        onPhase: (phase: string) => void
    ) => Promise<{ success: boolean; message: string }>;

    /** Unpair the current device */
    unpair: (userId: string) => Promise<void>;

    /** Switch control mode (hardware ↔ web) */
    setMode: (mode: ControlMode, teamAName?: string, teamBName?: string) => Promise<void>;

    /** Activate a game on the paired device */
    activateGame: (
        gameCode: string,
        teamAName: string,
        teamBName: string,
        initialMode?: ControlMode,
        userId?: string
    ) => Promise<void>;

    /** Force re-check of stored pairing against DB */
    autoReconnect: (userId: string) => Promise<void>;
}

type HardwareContextValue = HardwareState & HardwareActions & {
    wsOpen: boolean;
    setWsOpen: (open: boolean) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const HardwareContext = createContext<HardwareContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface HardwareProviderProps {
    userId: string | null;
    children: React.ReactNode;
}

export const HardwareProvider: React.FC<HardwareProviderProps> = ({ userId, children }) => {
    const [wsOpen, setWsOpen] = useState(false);
    const [state, setState] = useState<HardwareState>({
        deviceId: getDeviceId(),
        isConnected: false,
        controlMode: 'hardware',
        lastSeenAt: 0,
        isPaired: !!getDeviceId(),
        isReconnecting: false,
    });

    // Refs to hold unsubscribe functions
    const heartbeatUnsubRef = useRef<(() => void) | null>(null);
    const controlModeUnsubRef = useRef<(() => void) | null>(null);

    // ── Subscribe to a device's heartbeat + control mode ──────────────────
    const subscribeToDevice = useCallback((deviceId: string) => {
        // Cleanup any existing subscriptions
        heartbeatUnsubRef.current?.();
        controlModeUnsubRef.current?.();

        heartbeatUnsubRef.current = subscribeToDeviceHeartbeat(
            deviceId,
            (online, lastReceivedAt) => {
                setState(prev => ({
                    ...prev,
                    isConnected: online,
                    lastSeenAt: lastReceivedAt,
                }));
            }
        );

        controlModeUnsubRef.current = subscribeToControlMode(
            deviceId,
            (mode) => {
                setState(prev => ({
                    ...prev,
                    controlMode: mode,
                }));
            }
        );
    }, []);

    // ── Cleanup subscriptions on unmount ───────────────────────────────────
    useEffect(() => {
        return () => {
            heartbeatUnsubRef.current?.();
            controlModeUnsubRef.current?.();
        };
    }, []);

    // ── Auto-subscribe when deviceId changes ──────────────────────────────
    useEffect(() => {
        if (state.deviceId) {
            subscribeToDevice(state.deviceId);
        } else {
            heartbeatUnsubRef.current?.();
            controlModeUnsubRef.current?.();
            heartbeatUnsubRef.current = null;
            controlModeUnsubRef.current = null;
        }
    }, [state.deviceId, subscribeToDevice]);

    // ── Auto-reconnect on mount ───────────────────────────────────────────
    useEffect(() => {
        if (!userId) return;

        const stored = getStoredPairing();
        if (stored) {
            setState(prev => ({ ...prev, isReconnecting: true }));
            tryAutoReconnect(userId).then(({ connected, deviceId: reconDeviceId }) => {
                setState(prev => ({
                    ...prev,
                    deviceId: reconDeviceId,
                    isPaired: connected,
                    isReconnecting: false,
                }));
            });
        }
    }, [userId]);

    // ── Actions ───────────────────────────────────────────────────────────

    const pair = useCallback(async (
        code: string,
        pairUserId: string,
        onPhase: (phase: string) => void
    ): Promise<{ success: boolean; message: string }> => {
        const result = await pairHandheldDevice(code, pairUserId, onPhase);

        if (result.success) {
            const upperCode = code.toUpperCase();
            setState(prev => ({
                ...prev,
                deviceId: upperCode,
                isPaired: true,
            }));
        }

        return result;
    }, []);

    const unpair = useCallback(async (unpairUserId: string): Promise<void> => {
        const currentDevice = state.deviceId;
        if (!currentDevice) return;

        // Optimistic: clear state immediately
        setState(prev => ({
            ...prev,
            deviceId: null,
            isConnected: false,
            isPaired: false,
            controlMode: 'hardware',
            lastSeenAt: 0,
        }));

        await unpairHandheldDevice(currentDevice, unpairUserId);
    }, [state.deviceId]);

    const setMode = useCallback(async (
        mode: ControlMode,
        teamAName?: string,
        teamBName?: string
    ): Promise<void> => {
        if (!state.deviceId) return;

        // Optimistic UI update
        setState(prev => ({ ...prev, controlMode: mode }));
        await setControlMode(state.deviceId, mode, teamAName, teamBName);
    }, [state.deviceId]);

    const activateGame = useCallback(async (
        gameCode: string,
        teamAName: string,
        teamBName: string,
        initialMode: ControlMode = 'hardware',
        actUserId?: string
    ): Promise<void> => {
        if (!state.deviceId) return;
        await activateGameOnDevice(
            state.deviceId,
            gameCode,
            teamAName,
            teamBName,
            initialMode,
            actUserId
        );
    }, [state.deviceId]);

    const autoReconnect = useCallback(async (reconUserId: string): Promise<void> => {
        setState(prev => ({ ...prev, isReconnecting: true }));
        const { connected, deviceId: reconDeviceId } = await tryAutoReconnect(reconUserId);
        setState(prev => ({
            ...prev,
            deviceId: reconDeviceId,
            isPaired: connected,
            isReconnecting: false,
        }));
    }, []);

    const isConnected = state.isConnected || wsOpen;

    const value: HardwareContextValue = {
        ...state,
        isConnected,
        pair,
        unpair,
        setMode,
        activateGame,
        autoReconnect,
        wsOpen,
        setWsOpen,
    };

    return (
        <HardwareContext.Provider value={value}>
            {children}
        </HardwareContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the centralized hardware state from any component.
 *
 * Must be used within a <HardwareProvider>.
 *
 * @example
 * const { isConnected, controlMode, setMode, pair, unpair } = useHardware();
 */
export const useHardware = (): HardwareContextValue => {
    const ctx = useContext(HardwareContext);
    if (!ctx) {
        throw new Error(
            'useHardware() must be used within a <HardwareProvider>. ' +
            'Wrap your app root with <HardwareProvider userId={...}>.'
        );
    }
    return ctx;
};

// ─── Backwards Compatibility Hook ─────────────────────────────────────────────

/**
 * Drop-in replacement for the old useHardwareBridge hook.
 * Returns the same shape so existing components don't need to change their
 * destructuring pattern.
 *
 * MIGRATION: Replace `import { useHardwareBridge } from '../hooks/useHardwareBridge'`
 *       with `import { useHardwareBridgeCompat as useHardwareBridge } from '../contexts/HardwareContext'`
 */
export const useHardwareBridgeCompat = () => {
    const hw = useHardware();

    return {
        isConnected: hw.isConnected,
        transport: hw.isConnected ? ('supabase' as const) : ('none' as const),
        remoteState: null,
        controlMode: hw.controlMode,
        pushGameState: () => { },
        setAuthority: hw.setMode,
    };
};