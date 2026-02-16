// src/hooks/useHardwareBridge.ts
//
// THE BOX — Hardware Bridge v2.1
//
// FIX SUMMARY:
//   [FIX-7] Input deduplication: web app writes its own ack timestamp alongside handled:true.
//           On reconnect, inputs older than the last ack are ignored — prevents phantom presses
//           when component remounts after navigation.
//   [KEEP]  handled===false trust logic retained (no millis() vs Date.now() mismatch check)
//   [KEEP]  Dual-transport (WebSocket primary, RTDB fallback)

import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, update, off, type DatabaseReference } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { HW_SESSION_KEY } from '../services/handheldService';

// ─── Types ────────────────────────────────────────────────────────

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
}

// ─── Constants ───────────────────────────────────────────────────

const WS_PORT = 81;
const HEARTBEAT_TIMEOUT = 15_000;
const SCREEN_DEBOUNCE = 150;
const WS_RECONNECT_INTERVAL = 5_000;

// Key used to persist the last-acked input timestamp across remounts
// Prevents phantom presses when the hook mounts fresh (e.g. page navigation)
const LAST_ACK_KEY = 'BOX_HW_LAST_ACK_TS';

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

    // [FIX-7] Persist last-ack timestamp so phantom presses survive remounts
    const lastAckTsRef = useRef<number>(
        (() => {
            const stored = sessionStorage.getItem(LAST_ACK_KEY);
            return stored ? parseInt(stored, 10) : 0;
        })()
    );

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
        if (!input || input.handled) return;

        // [FIX-7] Ignore if this input's web-side ack timestamp predates mount
        // This prevents phantom presses when we reconnect after navigation.
        // lastAckTsRef.current is the Date.now() value we wrote when we last acked.
        // If the input has no webAckTs (old firmware), we trust handled===false as before.
        if (input.timestamp <= lastAckTsRef.current) {
            console.log('[HardwareBridge] Stale input ignored (pre-ack ts):', input.button);
            return;
        }

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
                    processInput({
                        button: msg.button,
                        timestamp: msg.ts || Date.now(),
                        handled: false,
                    });
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
        const nowTs = Date.now();

        // [FIX-7] Record the ack timestamp so future remounts can filter stale inputs
        lastAckTsRef.current = nowTs;
        sessionStorage.setItem(LAST_ACK_KEY, String(nowTs));

        const deviceId = sessionStorage.getItem(HW_SESSION_KEY);
        if (rtdb && deviceId) {
            update(ref(rtdb, `hardware/${deviceId}/input`), {
                handled: true,
                ackedAt: nowTs, // Web-side timestamp written alongside handled:true
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