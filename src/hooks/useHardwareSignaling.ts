import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../services/supabase';

// ── Types ─────────────────────────────────────────────────────────

export interface HardwareSignal {
    action: string;
    deviceId?: string;
    gameId?: string;
    timestamp?: number;
    // Absolute state fields (SCORE_STATE action)
    scoreA?: number;
    scoreB?: number;
    minutes?: number;
    seconds?: number;
    shotClock?: number;
    period?: number;
    gameRunning?: boolean;
    possession?: 'A' | 'B';
}

export type SignalHandler = (signal: HardwareSignal) => void;

// ── Constants ─────────────────────────────────────────────────────

const WS_PORT = 81;
const WS_CONNECT_TIMEOUT = 1500;   // ms — if no connect in 1.5s, don't wait longer
const WS_RECONNECT_DELAY = 1500;   // ms — retry after disconnect (faster LAN recovery)
const WS_PING_INTERVAL = 15000;  // ms — keep-alive ping to ESP32

const RELAY_HOST = import.meta.env.VITE_RELAY_URL ||
                   'wss://thebox-relay.railway.app';
const RELAY_PATH = (deviceCode: string) =>
                   `${RELAY_HOST}/device/${deviceCode}`;

// ── Local IP fetcher ──────────────────────────────────────────────

async function fetchEsp32LocalIp(deviceCode: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('hardware_terminals')
        .select('local_ip')
        .eq('id', deviceCode.toUpperCase())
        .maybeSingle();

    if (error || !data?.local_ip) return null;
    // Validate it looks like an IP (basic check)
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(data.local_ip)) return null;
    return data.local_ip;
}

// ── Main hook ─────────────────────────────────────────────────────

/**
 * @param gameCode    Active game code (e.g. "483921")
 * @param deviceCode  Hardware terminal pairing code (e.g. "A3K9")
 * @param onSignal    Callback fired on every signal from ESP32
 * @returns           { sendToHardware, lanConnected }
 *                    sendToHardware: send feedback state back to ESP32
 *                    lanConnected: true when LAN WS is the active path
 */
export function useHardwareSignaling(
    gameCode: string,
    deviceCode: string,
    onSignal: SignalHandler,
) {
    const wsRef = useRef<WebSocket | null>(null);
    const lanActiveRef = useRef(false);
    const [lanConnected, setLanConnected] = useState(false);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);
    const onSignalRef = useRef(onSignal);
    const localIpRef = useRef<string | null>(null);
    const mountTimeRef = useRef(Date.now());
    const backoffRef = useRef(1500);
    const lastKnownStateRef = useRef<any>(null);
    const transportModeRef = useRef<'LAN' | 'FALLBACK' | 'RECOVERING'>('FALLBACK');
    const relayWsRef = useRef<WebSocket | null>(null);
    const relayActiveRef = useRef(false);

    // Keep signal handler ref fresh without resubscribing
    useEffect(() => { onSignalRef.current = onSignal; }, [onSignal]);

    // ── Deduplication ──────────────────────────────────────────────
    // Simple seq-number dedup: ESP32 sends millis() timestamp.
    // If same timestamp seen within 200ms, skip.
    const lastTimestampRef = useRef<number>(0);
    const handleSignal = useCallback((payload: HardwareSignal) => {
        if (!payload?.action) return;
        // Dedup by timestamp (ESP32 sends millis(), unique per press)
        if (payload.timestamp && payload.timestamp === lastTimestampRef.current) return;
        if (payload.timestamp) lastTimestampRef.current = payload.timestamp;
        onSignalRef.current(payload);
    }, []);

    // ── LAN WebSocket ──────────────────────────────────────────────

    const closeLanWs = useCallback(() => {
        if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null; }
        if (wsRef.current) {
            wsRef.current.onopen = null;
            wsRef.current.onmessage = null;
            wsRef.current.onerror = null;
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        lanActiveRef.current = false;
    }, []);

    const connectLanWs = useCallback((ip: string) => {
        if (!mountedRef.current) return;
        closeLanWs();

        const url = `ws://${ip}:${WS_PORT}`;
        console.log('[WS] Attempting LAN WebSocket:', url);

        let settled = false;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        // Connection timeout — don't wait forever
        const connectTimeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                console.log('[WS] LAN connect timeout, staying on Supabase');
                ws.close();
                wsRef.current = null;
            }
        }, WS_CONNECT_TIMEOUT);

        ws.onopen = () => {
            if (!mountedRef.current) { ws.close(); return; }
            settled = true;
            clearTimeout(connectTimeout);
            lanActiveRef.current = true;
            setLanConnected(true);
            backoffRef.current = 1500;
            transportModeRef.current = 'LAN';
            console.log('[WS] LAN WebSocket connected —', url);

            // On reconnect, request full state from ESP32 immediately
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: 'requestState' }));
            }

            // Keep-alive ping
            pingTimerRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send('ping');
            }, WS_PING_INTERVAL);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!data?.payload) return;
                const payload = data.payload;

                // Always update lastKnownState from WS messages
                if (payload.scoreA !== undefined ||
                    payload.scoreB !== undefined) {
                    lastKnownStateRef.current = {
                        ...lastKnownStateRef.current,
                        scoreA:      payload.scoreA,
                        scoreB:      payload.scoreB,
                        minutes:     payload.minutes,
                        seconds:     payload.seconds,
                        shotClock:   payload.shotClock,
                        period:      payload.period,
                        gameRunning: payload.gameRunning,
                        receivedAt:  Date.now(),
                    };
                }

                // In RECOVERING mode, only process SCORE_STATE
                // to avoid applying stale individual signals
                if (transportModeRef.current === 'RECOVERING') {
                    if (payload.action === 'SCORE_STATE') {
                        transportModeRef.current = 'LAN';
                        handleSignal(payload);
                    }
                    return;
                }

                handleSignal(payload);
            } catch { /* ignore malformed */ }
        };

        ws.onerror = () => {
            if (!settled) { settled = true; clearTimeout(connectTimeout); }
            // Don't log — silent fallback to Supabase
        };

        ws.onclose = () => {
            if (!settled) { settled = true; clearTimeout(connectTimeout); }
            lanActiveRef.current = false;
            transportModeRef.current = 'FALLBACK';
            setLanConnected(false);
            wsRef.current = null;
            if (pingTimerRef.current) {
                clearInterval(pingTimerRef.current);
                pingTimerRef.current = null;
            }
            if (!mountedRef.current) return;

            const delay = backoffRef.current;
            backoffRef.current = Math.min(backoffRef.current * 2, 10000);

            reconnectTimerRef.current = setTimeout(async () => {
                if (!mountedRef.current) return;
                transportModeRef.current = 'RECOVERING';
                const freshIp = await fetchEsp32LocalIp(deviceCode);
                if (freshIp) localIpRef.current = freshIp;
                if (localIpRef.current) connectLanWs(localIpRef.current);
            }, delay);
        };
    }, [closeLanWs, handleSignal]);

    const connectRelayWs = useCallback((code: string) => {
        if (!mountedRef.current) return;
        if (relayWsRef.current) {
            relayWsRef.current.onopen = null;
            relayWsRef.current.onmessage = null;
            relayWsRef.current.onerror = null;
            relayWsRef.current.onclose = null;
            relayWsRef.current.close();
            relayWsRef.current = null;
        }

        const url = RELAY_PATH(code);
        console.log('[RELAY] Connecting to relay:', url);
        const ws = new WebSocket(url);
        relayWsRef.current = ws;

        ws.onopen = () => {
            if (!mountedRef.current) { ws.close(); return; }
            relayActiveRef.current = true;
            console.log('[RELAY] Connected');
            // Request full state from ESP32
            ws.send(JSON.stringify({ event: 'requestState' }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!data?.payload) return;
                // If LAN WS is also active, relay is backup — still process
                // because relay carries the same messages.
                // Use dedup by timestamp to prevent double processing.
                handleSignal(data.payload as HardwareSignal);
            } catch { }
        };

        ws.onclose = () => {
            relayActiveRef.current = false;
            relayWsRef.current = null;
            if (!mountedRef.current) return;
            // Reconnect relay after 3s
            setTimeout(() => {
                if (mountedRef.current) connectRelayWs(code);
            }, 3000);
        };

        ws.onerror = () => {
            console.log('[RELAY] Connection error');
        };
    }, [handleSignal]);

    // ── Supabase channel ───────────────────────────────────────────

    useEffect(() => {
        if (!gameCode || !deviceCode) return;
        mountedRef.current = true;

        // 1. Fetch local IP and try LAN WebSocket
        fetchEsp32LocalIp(deviceCode).then((ip) => {
            if (!mountedRef.current) return;
            if (ip) {
                localIpRef.current = ip;
                connectLanWs(ip);
            } else {
                console.log('[WS] No local IP found, using Supabase only');
            }
        });

        // Always connect to relay regardless of LAN
        connectRelayWs(deviceCode);

        // 2. Always subscribe to Supabase channel (backup + non-LAN fallback)
        const channel = supabase
            .channel(`hw-${gameCode}`)
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                // Drop all signals during LAN connect window (first 2s)
                if (Date.now() - mountTimeRef.current < 2000) return;
                // Drop if either direct path is active
                if (lanActiveRef.current || relayActiveRef.current) return;
                // In FALLBACK mode: only process SCORE_STATE, never
                // individual action signals — prevents double-counting
                if (payload?.action && payload.action !== 'SCORE_STATE') {
                    return;
                }
                handleSignal(payload as HardwareSignal);
            })
            .subscribe((status) => {
                console.log('[Supabase] hw channel status:', status);
            });

        return () => {
            mountedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            closeLanWs();
            // Close relay
            if (relayWsRef.current) {
                relayWsRef.current.onopen = null;
                relayWsRef.current.onmessage = null;
                relayWsRef.current.onerror = null;
                relayWsRef.current.onclose = null;
                relayWsRef.current.close();
                relayWsRef.current = null;
            }
            supabase.removeChannel(channel);
        };
    }, [gameCode, deviceCode, connectLanWs, connectRelayWs, closeLanWs, handleSignal]);

    // ── sendToHardware — feedback from website → ESP32 display ────
    // Sends via LAN WS if available, relay as fallback
    const sendToHardware = useCallback((state: object) => {
        const msg = JSON.stringify({ event: 'feedback', payload: state });
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(msg);
        } else if (relayWsRef.current?.readyState === WebSocket.OPEN) {
            relayWsRef.current.send(msg);
        }
    }, []);

    // Manual LAN retry — call this when user wants to switch from cloud to LAN
    const retryLan = useCallback(() => {
        if (!localIpRef.current) return;
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        closeLanWs();
        connectLanWs(localIpRef.current);
    }, [closeLanWs, connectLanWs]);

    // Push pairing/activation events directly to ESP32 over WS
    const sendPairingPush = useCallback((pushPayload: object) => {
        const msg = JSON.stringify({ event: 'pairing', payload: pushPayload });
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(msg);
        } else if (relayWsRef.current?.readyState === WebSocket.OPEN) {
            relayWsRef.current.send(msg);
        }
    }, []);

    return {
        sendToHardware,
        lanConnected, // reactive useState — triggers re-renders on connect/disconnect
        retryLan,     // force a new LAN connection attempt
        sendPairingPush,
    };
}