// src/hooks/useHardwareBridge.ts
//
// The Hardware Bridge connects the website to the ESP32 controller.
//
// TRANSPORT HIERARCHY (fastest first):
//
//   1. LOCAL WebSocket  ws://192.168.x.x:81
//      • Sub-10ms latency when on same WiFi
//      • Used for: pause/play, shot clock reset (time-critical)
//      • Auto-detected — no manual IP needed if WS is available
//
//   2. Firebase Realtime Database
//      • 30–80ms latency over internet
//      • Used for: all events when WS unavailable
//      • Also used for: screen mirror, heartbeat, non-time-critical events
//
// BUGS FIXED vs original:
// - Session key mismatch: now uses HW_SESSION_KEY from handheldService
// - Collection name mismatch: same
// - Missing game binding
// - No debounce on updateScreen (would flood Firestore)
// - No heartbeat detection (no way to know if device went offline)

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
    // Latency of last round-trip ping (ms), null if unknown
    latencyMs: number | null;
}

// ─── Constants ───────────────────────────────────────────────────

// ESP32 WebSocket port (must match firmware: WebSocketsServer ws(81))
const WS_PORT = 81;

// How long without a heartbeat before we consider device offline (ms)
const HEARTBEAT_TIMEOUT = 15_000;

// Debounce delay for screen mirror writes to RTDB (ms)
const SCREEN_DEBOUNCE = 400;

// WebSocket reconnect interval when disconnected (ms)
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

    // ── Internal refs (don't trigger re-renders) ──────────────────
    const wsRef = useRef<WebSocket | null>(null);
    const wsIpRef = useRef<string | null>(null);
    const wsReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const screenDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rtdbInputRef = useRef<DatabaseReference | null>(null);
    const rtdbHeartbeatRef = useRef<DatabaseReference | null>(null);
    const pingSentAt = useRef<number>(0);

    // ─────────────────────────────────────────────────────────────
    // HEARTBEAT MONITOR
    // Resets every time we receive data from the device (any transport)
    // ─────────────────────────────────────────────────────────────
    const resetHeartbeat = useCallback(() => {
        if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
        heartbeatTimer.current = setTimeout(() => {
            // Device hasn't sent anything in HEARTBEAT_TIMEOUT ms
            setState(prev => ({ ...prev, isConnected: false, transport: 'disconnected', latencyMs: null }));
        }, HEARTBEAT_TIMEOUT);
    }, []);

    // ─────────────────────────────────────────────────────────────
    // PROCESS INPUT EVENT (from either transport)
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
        // Clean up any existing connection
        if (wsRef.current) {
            wsRef.current.onclose = null; // Prevent auto-reconnect during intentional close
            wsRef.current.close();
            wsRef.current = null;
        }

        const url = `ws://${ip}:${WS_PORT}`;
        console.log(`[HardwareBridge] WS connecting to ${url}`);

        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch {
            console.warn('[HardwareBridge] WS constructor failed (non-secure context or bad IP)');
            return;
        }

        ws.onopen = () => {
            console.log('[HardwareBridge] WS connected ✓');
            wsRef.current = ws;
            wsIpRef.current = ip;
            setState(prev => ({ ...prev, isConnected: true, transport: 'websocket' }));
            resetHeartbeat();

            // Send a ping immediately to measure latency
            pingSentAt.current = Date.now();
            ws.send(JSON.stringify({ type: 'PING', ts: pingSentAt.current }));
        };

        ws.onmessage = (event) => {
            resetHeartbeat();
            try {
                const msg = JSON.parse(event.data);

                if (msg.type === 'PONG') {
                    const latencyMs = Date.now() - pingSentAt.current;
                    setState(prev => ({ ...prev, latencyMs }));
                    return;
                }

                if (msg.type === 'INPUT') {
                    processInput({
                        button: msg.button,
                        timestamp: msg.ts || Date.now(),
                        handled: false,
                    });
                }

                if (msg.type === 'HEARTBEAT') {
                    setState(prev => ({ ...prev, isConnected: true, transport: 'websocket' }));
                }
            } catch {
                // Non-JSON message — ignore
            }
        };

        ws.onerror = () => {
            console.warn('[HardwareBridge] WS error — will fall back to RTDB');
        };

        ws.onclose = () => {
            console.log('[HardwareBridge] WS closed — scheduling reconnect');
            wsRef.current = null;

            // If RTDB is available, fall back immediately
            if (rtdb) {
                setState(prev => ({
                    ...prev,
                    transport: prev.isConnected ? 'rtdb' : 'disconnected',
                }));
            } else {
                setState(prev => ({ ...prev, isConnected: false, transport: 'disconnected' }));
            }

            // Try to reconnect WS after delay
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
            console.warn('[HardwareBridge] RTDB not available (databaseURL not configured)');
            return;
        }

        console.log(`[HardwareBridge] RTDB listening on hardware/${deviceId}`);

        // ── Input events listener ─────────────────────────────────
        const inputRef = ref(rtdb, `hardware/${deviceId}/input`);
        rtdbInputRef.current = inputRef;

        onValue(inputRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.val();
            resetHeartbeat();

            // Only switch transport label if WS is not currently connected
            setState(prev => ({
                ...prev,
                isConnected: true,
                transport: wsRef.current?.readyState === WebSocket.OPEN ? 'websocket' : 'rtdb',
            }));

            processInput({
                button: data.button,
                timestamp: data.timestamp || Date.now(),
                handled: data.handled || false,
            });
        });

        // ── Heartbeat listener ────────────────────────────────────
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

        // ── IP address — if ESP32 reports it, attempt WS upgrade ─
        const ipRef = ref(rtdb, `hardware/${deviceId}/meta/localIp`);
        onValue(ipRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const ip = snapshot.val() as string;
            if (ip && ip !== wsIpRef.current) {
                console.log(`[HardwareBridge] ESP32 reported IP ${ip} — attempting WS upgrade`);
                connectWebSocket(ip);
            }
        });

    }, [resetHeartbeat, processInput, connectWebSocket]);

    // ─────────────────────────────────────────────────────────────
    // INIT ON MOUNT
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (!deviceId) return;

        setState(prev => ({ ...prev, hardwareId: deviceId }));

        // Always start RTDB listener (reliable, works over internet)
        connectRTDB(deviceId);

        return () => {
            // Cleanup
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
            if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
            if (screenDebounceTimer.current) clearTimeout(screenDebounceTimer.current);

            if (rtdbInputRef.current) off(rtdbInputRef.current);
            if (rtdbHeartbeatRef.current) off(rtdbHeartbeatRef.current);
        };
    }, [connectRTDB]);

    // ─────────────────────────────────────────────────────────────
    // PUBLIC: SEND COMMAND TO ESP32
    // Prefers WS (instant), falls back to RTDB
    // ─────────────────────────────────────────────────────────────
    const sendCommand = useCallback((cmd: Record<string, unknown>): void => {
        // Try WebSocket first (sub-10ms)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'CMD', ...cmd }));
            return;
        }

        // Fall back to RTDB (~30-80ms)
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (!rtdb || !deviceId) return;

        set(ref(rtdb, `hardware/${deviceId}/command`), {
            ...cmd,
            ts: Date.now(),
        }).catch(err => console.error('[HardwareBridge] RTDB command error:', err));
    }, []);

    // ─────────────────────────────────────────────────────────────
    // PUBLIC: UPDATE ESP32 SCREEN
    // Debounced — safe to call on every keystroke
    // Always goes via RTDB (screen updates are not time-critical)
    // ─────────────────────────────────────────────────────────────
    const updateScreen = useCallback((line1: string, line2: string, footer: string): void => {
        if (screenDebounceTimer.current) clearTimeout(screenDebounceTimer.current);

        screenDebounceTimer.current = setTimeout(() => {
            // Try WS first for instant screen update
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'SCREEN',
                    l1: line1.substring(0, 10).toUpperCase(),
                    l2: line2.substring(0, 10).toUpperCase(),
                    ft: footer.substring(0, 14).toUpperCase(),
                }));
                return;
            }

            // RTDB fallback
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
    // Mark the last button press as handled so it won't re-fire
    // ─────────────────────────────────────────────────────────────
    const ackInput = useCallback((): void => {
        // WS: tell ESP32 directly
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ACK' }));
        }

        // RTDB: flip the handled flag
        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (!rtdb || !deviceId) return;

        update(ref(rtdb, `hardware/${deviceId}/input`), { handled: true })
            .catch(err => console.error('[HardwareBridge] Ack error:', err));

        // Also clear local state
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
        // State
        isConnected: state.isConnected,
        transport: state.transport,
        hardwareId: state.hardwareId,
        lastInput: state.lastInput,
        latencyMs: state.latencyMs,
        // Actions
        sendCommand,
        updateScreen,
        ackInput,
        disconnect,
    };
};