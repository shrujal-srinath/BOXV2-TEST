// src/hooks/useHardwareBridge.ts
//
// THE BOX — Hardware Bridge v3.0
//
// New in this version:
//   - controlMode state: 'hardware' | 'shared' | 'web'
//   - Live controlMode subscription from RTDB
//   - Cleaner heartbeat validation
//   - Stale input prevention preserved from v2.1

import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, update, off, type DatabaseReference } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { HW_SESSION_KEY, type ControlMode } from '../services/handheldService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransportMode = 'websocket' | 'rtdb' | 'disconnected';

export interface HardwareInputEvent {
    button: 'A' | 'B' | 'C' | 'UNDO' | 'QUARTER' | 'PAUSE' | 'EMERGENCY_RESET' | string;
    timestamp: number;
    handled: boolean;
}

export interface HardwareBridgeState {
    isConnected: boolean;
    transport: TransportMode;
    hardwareId: string | null;
    lastInput: HardwareInputEvent | null;
    latencyMs: number | null;
    controlMode: ControlMode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WS_PORT = 81;
const HEARTBEAT_TIMEOUT = 15_000;
const SCREEN_DEBOUNCE = 150;
const WS_RECONNECT_INTERVAL = 5_000;
const LAST_ACK_KEY = 'BOX_HW_LAST_ACK_TS';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export const useHardwareBridge = () => {
    const [state, setState] = useState<HardwareBridgeState>({
        isConnected: false,
        transport: 'disconnected',
        hardwareId: null,
        lastInput: null,
        latencyMs: null,
        controlMode: 'web',
    });

    const wsRef = useRef<WebSocket | null>(null);
    const wsIpRef = useRef<string | null>(null);
    const wsReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const screenDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pingSentAt = useRef<number>(0);

    const rtdbInputRef = useRef<DatabaseReference | null>(null);
    const rtdbHeartbeatRef = useRef<DatabaseReference | null>(null);
    const rtdbIpRef = useRef<DatabaseReference | null>(null);
    const rtdbControlRef = useRef<DatabaseReference | null>(null);

    // Persist last-ack so phantom presses survive remounts (FIX-7 preserved)
    const lastAckTsRef = useRef<number>(
        (() => {
            const stored = sessionStorage.getItem(LAST_ACK_KEY);
            return stored ? parseInt(stored, 10) : 0;
        })()
    );

    // ── Heartbeat monitor ─────────────────────────────────────────────────────
    const resetHeartbeat = useCallback(() => {
        if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
        heartbeatTimer.current = setTimeout(() => {
            console.log('[HardwareBridge] Heartbeat timeout — device offline');
            setState(prev => ({
                ...prev,
                isConnected: false,
                transport: 'disconnected',
                latencyMs: null,
            }));
        }, HEARTBEAT_TIMEOUT);
    }, []);

    // ── Process input event ───────────────────────────────────────────────────
    const processInput = useCallback((input: HardwareInputEvent) => {
        if (!input || input.handled) return;

        // Ignore stale inputs older than last ack (prevents phantom presses on remount)
        if (input.timestamp <= lastAckTsRef.current) {
            console.log('[HardwareBridge] Stale input ignored:', input.button);
            return;
        }

        console.log('[HardwareBridge] Input received:', input.button);
        resetHeartbeat();
        setState(prev => ({ ...prev, lastInput: input }));
    }, [resetHeartbeat]);

    // ── WebSocket transport ───────────────────────────────────────────────────
    const connectWebSocket = useCallback((ip: string) => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }

        const url = `ws://${ip}:${WS_PORT}`;
        console.log(`[HardwareBridge] WS connecting → ${url}`);

        let ws: WebSocket;
        try { ws = new WebSocket(url); } catch { return; }

        ws.onopen = () => {
            console.log('[HardwareBridge] WS connected ✓');
            wsRef.current = ws;
            wsIpRef.current = ip;
            setState(prev => ({ ...prev, isConnected: true, transport: 'websocket' }));
            resetHeartbeat();
            pingSentAt.current = Date.now();
            ws.send(JSON.stringify({ type: 'PING', ts: pingSentAt.current }));
        };

        ws.onmessage = (event) => {
            resetHeartbeat();
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'PONG') {
                    setState(prev => ({ ...prev, latencyMs: Date.now() - pingSentAt.current }));
                    return;
                }
                if (msg.type === 'INPUT') {
                    processInput({ button: msg.button, timestamp: msg.ts || Date.now(), handled: false });
                }
                if (msg.type === 'HEARTBEAT') {
                    setState(prev => ({ ...prev, isConnected: true, transport: 'websocket' }));
                }
            } catch { /* ignore malformed frames */ }
        };

        ws.onclose = () => {
            console.log('[HardwareBridge] WS closed');
            wsRef.current = null;
            if (rtdb) {
                setState(prev => ({
                    ...prev,
                    transport: prev.isConnected ? 'rtdb' : 'disconnected',
                }));
            }
            wsReconnectTimer.current = setTimeout(() => {
                if (wsIpRef.current) connectWebSocket(wsIpRef.current);
            }, WS_RECONNECT_INTERVAL);
        };
    }, [resetHeartbeat, processInput]);

    // ── RTDB transport ────────────────────────────────────────────────────────
    const connectRTDB = useCallback((deviceId: string) => {
        if (!rtdb) return;

        // Input events
        const inputRef = ref(rtdb, `hardware/${deviceId}/input`);
        rtdbInputRef.current = inputRef;
        onValue(inputRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.val();
            setState(prev => ({
                ...prev,
                isConnected: true,
                transport: wsRef.current?.readyState === WebSocket.OPEN ? 'websocket' : 'rtdb',
            }));
            resetHeartbeat();
            processInput({
                button: data.button,
                timestamp: data.timestamp || Date.now(),
                handled: data.handled || false,
            });
        });

        // Heartbeat
        const hbRef = ref(rtdb, `hardware/${deviceId}/heartbeat`);
        rtdbHeartbeatRef.current = hbRef;
        onValue(hbRef, (snapshot) => {
            if (!snapshot.exists()) return;
            resetHeartbeat();
            setState(prev => ({
                ...prev,
                isConnected: true,
                transport: wsRef.current?.readyState === WebSocket.OPEN ? 'websocket' : 'rtdb',
            }));
        });

        // IP → attempt WS upgrade
        const ipRef = ref(rtdb, `hardware/${deviceId}/meta/localIp`);
        rtdbIpRef.current = ipRef;
        onValue(ipRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const ip = snapshot.val() as string;
            if (!ip || ip === wsIpRef.current) return;
            connectWebSocket(ip);
        });

        // ── Control mode subscription (NEW in v3) ──────────────────────────
        const controlRef = ref(rtdb, `hardware/${deviceId}/meta/controlMode`);
        rtdbControlRef.current = controlRef;
        onValue(controlRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const mode = snapshot.val() as ControlMode;
            setState(prev => ({ ...prev, controlMode: mode }));
        });

    }, [resetHeartbeat, processInput, connectWebSocket]);

    // ── Init on mount ─────────────────────────────────────────────────────────
    useEffect(() => {
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (!deviceId) return;

        setState(prev => ({ ...prev, hardwareId: deviceId }));
        connectRTDB(deviceId);

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
            if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
            if (screenDebounceTimer.current) clearTimeout(screenDebounceTimer.current);
            if (rtdbInputRef.current) off(rtdbInputRef.current);
            if (rtdbHeartbeatRef.current) off(rtdbHeartbeatRef.current);
            if (rtdbIpRef.current) off(rtdbIpRef.current);
            if (rtdbControlRef.current) off(rtdbControlRef.current);
        };
    }, [connectRTDB]);

    // ── Public methods ────────────────────────────────────────────────────────

    const sendCommand = useCallback((cmd: Record<string, unknown>): void => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'CMD', ...cmd }));
            return;
        }
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (!rtdb || !deviceId) return;
        set(ref(rtdb, `hardware/${deviceId}/command`), { ...cmd, ts: Date.now() }).catch(console.error);
    }, []);

    const updateScreen = useCallback((line1: string, line2: string, footer: string): void => {
        if (screenDebounceTimer.current) clearTimeout(screenDebounceTimer.current);
        screenDebounceTimer.current = setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'SCREEN',
                    l1: line1.substring(0, 10).toUpperCase(),
                    l2: line2.substring(0, 10).toUpperCase(),
                    ft: footer.substring(0, 14).toUpperCase(),
                }));
                return;
            }
            const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
            if (!rtdb || !deviceId) return;
            update(ref(rtdb, `hardware/${deviceId}/display`), {
                line1: line1.substring(0, 10).toUpperCase(),
                line2: line2.substring(0, 10).toUpperCase(),
                footer: footer.substring(0, 14).toUpperCase(),
                ts: Date.now(),
            }).catch(console.error);
        }, SCREEN_DEBOUNCE);
    }, []);

    const ackInput = useCallback((): void => {
        const nowTs = Date.now();
        lastAckTsRef.current = nowTs;
        sessionStorage.setItem(LAST_ACK_KEY, String(nowTs));

        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (rtdb && deviceId) {
            update(ref(rtdb, `hardware/${deviceId}/input`), {
                handled: true,
                ackedAt: nowTs,
            }).catch(console.error);
        }
        setState(prev => ({
            ...prev,
            lastInput: prev.lastInput ? { ...prev.lastInput, handled: true } : null,
        }));
    }, []);

    const disconnect = useCallback((): void => {
        if (wsRef.current) wsRef.current.close();
        sessionStorage.removeItem(HW_SESSION_KEY);
        sessionStorage.removeItem(LAST_ACK_KEY);
        setState({
            isConnected: false,
            transport: 'disconnected',
            hardwareId: null,
            lastInput: null,
            latencyMs: null,
            controlMode: 'web',
        });
    }, []);

    return {
        isConnected: state.isConnected,
        transport: state.transport,
        hardwareId: state.hardwareId,
        lastInput: state.lastInput,
        latencyMs: state.latencyMs,
        controlMode: state.controlMode,
        sendCommand,
        updateScreen,
        ackInput,
        disconnect,
    };
};