import { useEffect, useRef, useCallback } from 'react';
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
const WS_RECONNECT_DELAY = 3000;   // ms — retry after disconnect
const WS_PING_INTERVAL = 15000;  // ms — keep-alive ping to ESP32

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
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);
    const onSignalRef = useRef(onSignal);
    const localIpRef = useRef<string | null>(null);

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
            console.log('[WS] LAN WebSocket connected —', url);

            // Keep-alive ping
            pingTimerRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send('ping');
            }, WS_PING_INTERVAL);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data?.payload) handleSignal(data.payload);
            } catch { /* ignore malformed */ }
        };

        ws.onerror = () => {
            if (!settled) { settled = true; clearTimeout(connectTimeout); }
            // Don't log — silent fallback to Supabase
        };

        ws.onclose = () => {
            if (!settled) { settled = true; clearTimeout(connectTimeout); }
            lanActiveRef.current = false;
            wsRef.current = null;
            if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null; }

            if (!mountedRef.current) return;
            // Auto-reconnect
            console.log('[WS] LAN WebSocket closed, reconnecting in', WS_RECONNECT_DELAY, 'ms');
            reconnectTimerRef.current = setTimeout(() => {
                if (mountedRef.current && localIpRef.current) connectLanWs(localIpRef.current);
            }, WS_RECONNECT_DELAY);
        };
    }, [closeLanWs, handleSignal]);

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

        // 2. Always subscribe to Supabase channel (backup + non-LAN fallback)
        const channel = supabase
            .channel(`hw-${gameCode}`)
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                // If LAN WS is active, skip Supabase duplicate
                // (ESP32 sends to both — avoid double-processing)
                if (lanActiveRef.current) return;
                handleSignal(payload as HardwareSignal);
            })
            .subscribe((status) => {
                console.log('[Supabase] hw channel status:', status);
            });

        return () => {
            mountedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            closeLanWs();
            supabase.removeChannel(channel);
        };
    }, [gameCode, deviceCode, connectLanWs, closeLanWs, handleSignal]);

    // ── sendToHardware — feedback from website → ESP32 display ────
    // Sends via LAN WS if available, otherwise skip (non-critical)
    const sendToHardware = useCallback((state: object) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ event: 'feedback', payload: state }));
        }
        // Could also POST to Supabase broadcast here if you want cloud feedback,
        // but for display latency, LAN is the only path that matters.
    }, []);

    return {
        sendToHardware,
        lanConnected: lanActiveRef.current,
    };
}