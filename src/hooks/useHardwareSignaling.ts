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
    foulsA?: number;
    foulsB?: number;
    minutes?: number;
    seconds?: number;
    shotClock?: number;
    period?: number;
    gameRunning?: boolean;
    possession?: 'A' | 'B';
    clockStartedAt?: number;
    clockValueAtStart?: number;
    shotStartedAt?: number;
    shotValueAtStart?: number;
}

export type SignalHandler = (signal: HardwareSignal) => void;

// ── Constants ─────────────────────────────────────────────────────

const WS_PORT = 81;
const WS_CONNECT_TIMEOUT = 1500;   // ms — if no connect in 1.5s, don't wait longer
const WS_RECONNECT_DELAY = 1500;   // ms — retry after disconnect (faster LAN recovery)
const WS_PING_INTERVAL = 15000;  // ms — keep-alive ping to ESP32

const RELAY_HOST = 'wss://thebox-relay-production.up.railway.app';
const RELAY_PATH = (deviceCode: string) =>
    `${RELAY_HOST}/?role=browser&id=${deviceCode}`;

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
    const [relayConnected, setRelayConnected] = useState(false);
    const relayReadyCallbackRef = useRef<(() => void) | null>(null);
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
                const raw = JSON.parse(event.data);
                // New firmware sends { t: "state", seq, score, fouls, period, poss, 
                // paused, clockSync, shotSync }
                if (raw?.t === 'state') {
                    const signal: HardwareSignal = {
                        action: 'SCORE_STATE',
                        scoreA: raw.score?.[0] ?? 0,
                        scoreB: raw.score?.[1] ?? 0,
                        foulsA: raw.fouls?.[0] ?? 0,
                        foulsB: raw.fouls?.[1] ?? 0,
                        period: raw.period ?? 1,
                        gameRunning: raw.clockSync?.running ?? false,
                        possession: raw.poss === 0 ? 'A' : 'B',
                        clockStartedAt: raw.clockSync?.startedAt ?? 0,
                        clockValueAtStart: raw.clockSync?.valueAtStart ?? 600,
                        shotStartedAt: raw.shotSync?.startedAt ?? 0,
                        shotValueAtStart: raw.shotSync?.valueAtStart ?? 24,
                        timestamp: raw.seq,
                    };
                    handleSignal(signal);
                    return;
                }
                // Legacy format fallback
                if (raw?.payload) handleSignal(raw.payload as HardwareSignal);
            } catch { }
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
            setRelayConnected(true);
            console.log('[RELAY] Connected');

            if (relayReadyCallbackRef.current) {
                relayReadyCallbackRef.current();
                relayReadyCallbackRef.current = null;
            }

            // Request full state from ESP32
            ws.send(JSON.stringify({ event: 'requestState' }));
        };

        ws.onmessage = (event) => {
            try {
                const raw = JSON.parse(event.data);
                // New firmware sends { t: "state", seq, score, fouls, period, poss, 
                // paused, clockSync, shotSync }
                if (raw?.t === 'state') {
                    const signal: HardwareSignal = {
                        action: 'SCORE_STATE',
                        scoreA: raw.score?.[0] ?? 0,
                        scoreB: raw.score?.[1] ?? 0,
                        foulsA: raw.fouls?.[0] ?? 0,
                        foulsB: raw.fouls?.[1] ?? 0,
                        period: raw.period ?? 1,
                        gameRunning: raw.clockSync?.running ?? false,
                        possession: raw.poss === 0 ? 'A' : 'B',
                        clockStartedAt: raw.clockSync?.startedAt ?? 0,
                        clockValueAtStart: raw.clockSync?.valueAtStart ?? 600,
                        shotStartedAt: raw.shotSync?.startedAt ?? 0,
                        shotValueAtStart: raw.shotSync?.valueAtStart ?? 24,
                        timestamp: raw.seq,
                    };
                    handleSignal(signal);
                    return;
                }
                // Legacy format fallback
                if (raw?.payload) handleSignal(raw.payload as HardwareSignal);
            } catch { }
        };

        ws.onclose = () => {
            relayActiveRef.current = false;
            relayWsRef.current = null;
            setRelayConnected(false);
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
    // Sends via LAN WS if available, relay as fallback.
    // NOTE: The firmware's handleInboundWsMessage only accepts event="pairing".
    // Feedback is currently display-only via Supabase realtime; the local WS
    // feedback path is kept for future firmware support.
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

    // Push pairing/activation events directly to ESP32 over WS.
    // The firmware listens for event="pairing" with payload.status:
    //   "paired"      → device acknowledged
    //   "active"      → game started (gameId, teamA, teamB, controlMode)
    //   "mode_change" → controlMode switched
    // The payload shape here must match handleInboundWsMessage in the firmware.
    const sendPairingPush = useCallback((pushPayload: any) => {
        let msg = JSON.stringify({ event: 'pairing', payload: pushPayload });
        
        if (pushPayload.status === 'active') {
            msg = JSON.stringify({
                t: 'cmd',
                action: 'activate',
                teamA: pushPayload.teamA || 'HOME',
                teamB: pushPayload.teamB || 'AWAY',
                colorA: pushPayload.colorA || '#ffffff',
                colorB: pushPayload.colorB || '#ffffff'
            });
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(msg);
        } else if (relayWsRef.current?.readyState === WebSocket.OPEN) {
            relayWsRef.current.send(msg);
        }
    }, []);

    const sendActivateCommand = useCallback((teamA: string, teamB: string, colorA = '#c0392b', colorB = '#eab308') => {
        const msg = JSON.stringify({
            t: 'cmd',
            action: 'activate',
            teamA,
            teamB,
            colorA,
            colorB,
        });
        if (relayWsRef.current?.readyState === WebSocket.OPEN) {
            relayWsRef.current.send(msg);
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(msg);
        }
    }, []);

    return {
        sendToHardware,
        lanConnected, // reactive useState — triggers re-renders on connect/disconnect
        relayConnected,
        retryLan,     // force a new LAN connection attempt
        sendPairingPush,
        sendActivateCommand,
        relayReadyCallbackRef,
    };
}