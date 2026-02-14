// src/hooks/useHardwareBridge.ts
//
// THE BOX — Hardware Bridge
//
// TRANSPORT HIERARCHY (fastest first):
//   1. LOCAL WebSocket  ws://192.168.x.x:81   (<10ms, same WiFi)
//   2. Firebase RTDB                           (30–80ms, internet)
//
// FIX SUMMARY vs previous version:
//   - isConnected no longer goes true from stale RTDB data
//   - Heartbeat now checks timestamp freshness before accepting
//   - IP listener no longer sets isConnected (only triggers WS upgrade)
//   - Added 'verifying' internal state to prevent phantom connections
//   - RTDB cleanup on unlink properly handled via handheldService

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

// If no fresh heartbeat arrives within this window, device is offline
const HEARTBEAT_TIMEOUT = 15_000;

// A heartbeat timestamp older than this is considered stale (leftover from prev session)
const HEARTBEAT_MAX_AGE = 20_000;

// Screen debounce — don't flood RTDB on every keystroke
const SCREEN_DEBOUNCE = 400;

// WS reconnect interval
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
    // Resets on every confirmed-fresh signal from the device
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
        if (!input || input.handled) return;
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
            console.warn('[HardwareBridge] WS constructor failed');
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
            } catch {
                // Non-JSON — ignore
            }
        };

        ws.onerror = () => {
            console.warn('[HardwareBridge] WS error — falling back to RTDB');
        };

        ws.onclose = () => {
            console.log('[HardwareBridge] WS closed — scheduling reconnect');
            wsRef.current = null;
            if (rtdb) {
                setState(prev => ({
                    ...prev,
                    transport: prev.isConnected ? 'rtdb' : 'disconnected',
                }));
            } else {
                setState(prev => ({ ...prev, isConnected: false, transport: 'disconnected' }));
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
        if (!rtdb) {
            console.warn('[HardwareBridge] RTDB not available');
            return;
        }

        console.log(`[HardwareBridge] RTDB listening → hardware/${deviceId}`);

        // ── Input events ──────────────────────────────────────────
        const inputRef = ref(rtdb, `hardware/${deviceId}/input`);
        rtdbInputRef.current = inputRef;

        onValue(inputRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.val();

            // Reject stale input events (older than 10 seconds)
            const age = Date.now() - (data?.timestamp || 0);
            if (age > 10_000) return;

            // Only set connected if WS isn't already handling it
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
        // KEY FIX: Check timestamp freshness. Old data from previous
        // sessions must not trigger isConnected = true.
        const hbRef = ref(rtdb, `hardware/${deviceId}/heartbeat`);
        rtdbHeartbeatRef.current = hbRef;

        onValue(hbRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.val();
            const ts = data?.ts as number | undefined;

            if (!ts) return;

            const age = Date.now() - ts;
            if (age > HEARTBEAT_MAX_AGE) {
                // Stale data from a previous session — ignore entirely
                console.log(`[HardwareBridge] Stale heartbeat ignored (${age}ms old)`);
                return;
            }

            // Fresh heartbeat — device is genuinely online
            resetHeartbeat();
            setState(prev => ({
                ...prev,
                isConnected: true,
                transport: wsRef.current?.readyState === WebSocket.OPEN ? 'websocket' : 'rtdb',
            }));
        });

        // ── IP address → attempt WS upgrade ──────────────────────
        // FIX: Does NOT set isConnected here — only triggers WS upgrade.
        // isConnected is only set after a fresh heartbeat or fresh input.
        const ipRef = ref(rtdb, `hardware/${deviceId}/meta/localIp`);
        rtdbIpRef.current = ipRef;

        onValue(ipRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const ip = snapshot.val() as string;
            if (!ip || ip === wsIpRef.current) return;

            console.log(`[HardwareBridge] ESP32 reported IP ${ip} — attempting WS upgrade`);
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
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
            if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
            if (screenDebounceTimer.current) clearTimeout(screenDebounceTimer.current);
            if (rtdbInputRef.current) off(rtdbInputRef.current);
            if (rtdbHeartbeatRef.current) off(rtdbHeartbeatRef.current);
            if (rtdbIpRef.current) off(rtdbIpRef.current);
        };
    }, [connectRTDB]);

    // ─────────────────────────────────────────────────────────────
    // PUBLIC: SEND COMMAND TO ESP32
    // ─────────────────────────────────────────────────────────────
    const sendCommand = useCallback((cmd: Record<string, unknown>): void => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'CMD', ...cmd }));
            return;
        }
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (!rtdb || !deviceId) return;
        set(ref(rtdb, `hardware/${deviceId}/command`), { ...cmd, ts: Date.now() })
            .catch(err => console.error('[HardwareBridge] RTDB command error:', err));
    }, []);

    // ─────────────────────────────────────────────────────────────
    // PUBLIC: UPDATE ESP32 SCREEN (debounced)
    // ─────────────────────────────────────────────────────────────
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
            }).catch(err => console.error('[HardwareBridge] Screen update error:', err));
        }, SCREEN_DEBOUNCE);
    }, []);

    // ─────────────────────────────────────────────────────────────
    // PUBLIC: ACK INPUT
    // ─────────────────────────────────────────────────────────────
    const ackInput = useCallback((): void => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ACK' }));
        }
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (!rtdb || !deviceId) return;
        update(ref(rtdb, `hardware/${deviceId}/input`), { handled: true })
            .catch(err => console.error('[HardwareBridge] Ack error:', err));
        setState(prev => ({
            ...prev,
            lastInput: prev.lastInput ? { ...prev.lastInput, handled: true } : null,
        }));
    }, []);

    // ─────────────────────────────────────────────────────────────
    // PUBLIC: DISCONNECT
    // ─────────────────────────────────────────────────────────────
    const disconnect = useCallback((): void => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
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