// src/hooks/useHardwareBridge.ts
//
// THE BOX — Hardware Bridge
//
// FIX SUMMARY:
//   - REMOVED "stale timestamp" check for inputs (fixes ESP32 uptime mismatch)
//   - Inputs are now accepted immediately if 'handled' is false
//   - Keeps the dual-transport (WebSocket + RTDB) logic

import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, update, off, type DatabaseReference } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { HW_SESSION_KEY } from '../services/handheldService';

// ─── Types ────────────────────────────────────────────────────────

export type TransportMode = 'websocket' | 'rtdb' | 'disconnected';

export interface HardwareInputEvent {
    button: 'A' | 'B' | 'C' | 'UNDO' | 'QUARTER' | 'PAUSE' | string;
    timestamp: number;
    handled: boolean;
}

export interface HardwareBridgeState {
    isConnected: boolean;
    transport: TransportMode;
    hardwareId: string | null;
    lastInput: HardwareInputEvent | null;
    latencyMs: number | null;
}

// ─── Constants ───────────────────────────────────────────────────

const WS_PORT = 81;
const HEARTBEAT_TIMEOUT = 15_000;
const SCREEN_DEBOUNCE = 150; // Lowered for snappier response
const WS_RECONNECT_INTERVAL = 5_000;

// ─────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────

export const useHardwareBridge = () => {
    const [state, setState] = useState<HardwareBridgeState>({
        isConnected: false,
        transport: 'disconnected',
        hardwareId: null,
        lastInput: null,
        latencyMs: null,
    });

    const wsRef = useRef<WebSocket | null>(null);
    const wsIpRef = useRef<string | null>(null);
    const wsReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const screenDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rtdbInputRef = useRef<DatabaseReference | null>(null);
    const rtdbHeartbeatRef = useRef<DatabaseReference | null>(null);
    const rtdbIpRef = useRef<DatabaseReference | null>(null);
    const pingSentAt = useRef<number>(0);

    // ─────────────────────────────────────────────────────────────
    // HEARTBEAT MONITOR
    // ─────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────
    // PROCESS INPUT EVENT
    // ─────────────────────────────────────────────────────────────
    const processInput = useCallback((input: HardwareInputEvent) => {
        // If handled is true, we ignore it (it's an old event)
        if (!input || input.handled) return;

        console.log('[HardwareBridge] Input Received:', input.button);
        resetHeartbeat();
        setState(prev => ({ ...prev, lastInput: input }));
    }, [resetHeartbeat]);

    // ─────────────────────────────────────────────────────────────
    // WEBSOCKET TRANSPORT
    // ─────────────────────────────────────────────────────────────
    const connectWebSocket = useCallback((ip: string) => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }

        const url = `ws://${ip}:${WS_PORT}`;
        console.log(`[HardwareBridge] WS connecting → ${url}`);

        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch {
            return;
        }

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
            } catch { }
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

    // ─────────────────────────────────────────────────────────────
    // RTDB TRANSPORT
    // ─────────────────────────────────────────────────────────────
    const connectRTDB = useCallback((deviceId: string) => {
        if (!rtdb) return;

        // ── Input events ──────────────────────────────────────────
        const inputRef = ref(rtdb, `hardware/${deviceId}/input`);
        rtdbInputRef.current = inputRef;

        onValue(inputRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.val();

            // ⚠️ FIX: Removed the "10 second age" check here.
            // ESP32 sends millis(), which looks "old" compared to Date.now().
            // We simply trust that if handled === false, it's a new press.

            // Set connected if not already on WS
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

        // ── Heartbeat ─────────────────────────────────────────────
        const hbRef = ref(rtdb, `hardware/${deviceId}/heartbeat`);
        rtdbHeartbeatRef.current = hbRef;

        onValue(hbRef, (snapshot) => {
            if (!snapshot.exists()) return;
            // Just receiving a heartbeat is enough to stay alive
            resetHeartbeat();
            setState(prev => ({
                ...prev,
                isConnected: true,
                transport: wsRef.current?.readyState === WebSocket.OPEN ? 'websocket' : 'rtdb',
            }));
        });

        // ── IP address → attempt WS upgrade ──────────────────────
        const ipRef = ref(rtdb, `hardware/${deviceId}/meta/localIp`);
        rtdbIpRef.current = ipRef;

        onValue(ipRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const ip = snapshot.val() as string;
            if (!ip || ip === wsIpRef.current) return;
            connectWebSocket(ip);
        });

    }, [resetHeartbeat, processInput, connectWebSocket]);

    // ─────────────────────────────────────────────────────────────
    // INIT ON MOUNT
    // ─────────────────────────────────────────────────────────────
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
        };
    }, [connectRTDB]);

    // ─────────────────────────────────────────────────────────────
    // PUBLIC METHODS
    // ─────────────────────────────────────────────────────────────
    const sendCommand = useCallback((cmd: Record<string, unknown>): void => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'CMD', ...cmd }));
            return;
        }
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (!rtdb || !deviceId) return;
        set(ref(rtdb, `hardware/${deviceId}/command`), { ...cmd, ts: Date.now() })
            .catch(console.error);
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
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (rtdb && deviceId) {
            update(ref(rtdb, `hardware/${deviceId}/input`), { handled: true }).catch(console.error);
        }
        setState(prev => ({
            ...prev,
            lastInput: prev.lastInput ? { ...prev.lastInput, handled: true } : null,
        }));
    }, []);

    const disconnect = useCallback((): void => {
        if (wsRef.current) wsRef.current.close();
        sessionStorage.removeItem(HW_SESSION_KEY);
        setState({
            isConnected: false,
            transport: 'disconnected',
            hardwareId: null,
            lastInput: null,
            latencyMs: null,
        });
    }, []);

    return {
        isConnected: state.isConnected,
        transport: state.transport,
        hardwareId: state.hardwareId,
        lastInput: state.lastInput,
        latencyMs: state.latencyMs,
        sendCommand,
        updateScreen,
        ackInput,
        disconnect,
    };
};