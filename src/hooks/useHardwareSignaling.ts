import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../services/supabase';

// ── Types ─────────────────────────────────────────────────────────

export interface HardwareSignal {
    action: string;
    deviceId?: string;
    gameId?: string;
    timestamp?: number;
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
const WS_CONNECT_TIMEOUT = 1500;
const WS_PING_INTERVAL = 15000;

// FIXED: relay uses /device/XXXX — NOT /?role=browser&id=XXXX
const RELAY_HOST = 'wss://thebox-relay-production.up.railway.app';
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
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(data.local_ip)) return null;
    return data.local_ip;
}

// ── Main hook ─────────────────────────────────────────────────────

export function useHardwareSignaling(
    gameCode: string,
    deviceCode: string,
    onSignal: SignalHandler,
) {
    const wsRef = useRef<WebSocket | null>(null);
    const relayWsRef = useRef<WebSocket | null>(null);
    const lanActiveRef = useRef(false);
    const relayActiveRef = useRef(false);
    const [lanConnected, setLanConnected] = useState(false);
    const [relayConnected, setRelayConnected] = useState(false);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);
    const onSignalRef = useRef(onSignal);
    const localIpRef = useRef<string | null>(null);
    const mountTimeRef = useRef(Date.now());
    const backoffRef = useRef(1500);
    const transportModeRef = useRef<'LAN' | 'FALLBACK' | 'RECOVERING'>('FALLBACK');
    // One-shot callback fired when relay first opens — used to send activate immediately
    const relayReadyCallbackRef = useRef<(() => void) | null>(null);
    const lastTimestampRef = useRef<number>(0);

    useEffect(() => { onSignalRef.current = onSignal; }, [onSignal]);

    // ── Signal deduplication ───────────────────────────────────────
    const handleSignal = useCallback((payload: HardwareSignal) => {
        if (!payload?.action) return;
        if (payload.timestamp && payload.timestamp === lastTimestampRef.current) return;
        if (payload.timestamp) lastTimestampRef.current = payload.timestamp;
        onSignalRef.current(payload);
    }, []);

    // ── Parse raw firmware message → HardwareSignal ───────────────
    const parseFirmwareMessage = useCallback((raw: any): HardwareSignal | null => {
        if (!raw) return null;
        // New firmware: { t: "state", seq, score, fouls, period, poss, paused, clockSync, shotSync }
        if (raw.t === 'state') {
            return {
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
        }
        // Legacy format
        if (raw.payload) return raw.payload as HardwareSignal;
        return null;
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
        console.log('[WS] Attempting LAN:', url);

        let settled = false;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        const connectTimeout = setTimeout(() => {
            if (!settled) { settled = true; ws.close(); }
        }, WS_CONNECT_TIMEOUT);

        ws.onopen = () => {
            settled = true;
            clearTimeout(connectTimeout);
            if (!mountedRef.current) { ws.close(); return; }
            lanActiveRef.current = true;
            transportModeRef.current = 'LAN';
            setLanConnected(true);
            backoffRef.current = 1500;
            console.log('[WS] LAN connected');
            pingTimerRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping', ts: Date.now() }));
            }, WS_PING_INTERVAL);
        };

        ws.onmessage = (event) => {
            try {
                const raw = JSON.parse(event.data);
                const signal = parseFirmwareMessage(raw);
                if (signal) handleSignal(signal);
            } catch { }
        };

        ws.onerror = () => {
            if (!settled) { settled = true; clearTimeout(connectTimeout); }
        };

        ws.onclose = () => {
            if (!settled) { settled = true; clearTimeout(connectTimeout); }
            lanActiveRef.current = false;
            transportModeRef.current = 'FALLBACK';
            setLanConnected(false);
            wsRef.current = null;
            if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null; }
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
    }, [closeLanWs, handleSignal, parseFirmwareMessage, deviceCode]);

    // ── Relay WebSocket ────────────────────────────────────────────

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
        console.log('[RELAY] Connecting:', url);
        const ws = new WebSocket(url);
        relayWsRef.current = ws;

        ws.onopen = () => {
            if (!mountedRef.current) { ws.close(); return; }
            relayActiveRef.current = true;
            setRelayConnected(true);
            console.log('[RELAY] Connected ✓');
            // Fire one-shot callback (used to send activate command immediately on open)
            if (relayReadyCallbackRef.current) {
                relayReadyCallbackRef.current();
                relayReadyCallbackRef.current = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const raw = JSON.parse(event.data);
                const signal = parseFirmwareMessage(raw);
                if (signal) handleSignal(signal);
            } catch { }
        };

        ws.onclose = () => {
            relayActiveRef.current = false;
            relayWsRef.current = null;
            setRelayConnected(false);
            if (!mountedRef.current) return;
            console.log('[RELAY] Disconnected — reconnecting in 3s');
            setTimeout(() => {
                if (mountedRef.current) connectRelayWs(code);
            }, 3000);
        };

        ws.onerror = () => {
            console.log('[RELAY] Connection error');
        };
    }, [handleSignal, parseFirmwareMessage]);

    // ── Main effect — starts relay immediately, LAN when IP available ──
    useEffect(() => {
        // deviceCode is required — gameCode is optional (relay uses device code not game code)
        if (!deviceCode) return;
        mountedRef.current = true;
        mountTimeRef.current = Date.now();

        // Always start relay immediately — this is the primary path
        connectRelayWs(deviceCode);

        // Try LAN if we can get the IP from Supabase
        fetchEsp32LocalIp(deviceCode).then((ip) => {
            if (!mountedRef.current) return;
            if (ip) {
                localIpRef.current = ip;
                connectLanWs(ip);
            }
        });

        // Supabase as last-resort fallback only
        if (!gameCode) return;
        const channel = supabase
            .channel(`hw-${gameCode}`)
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                if (Date.now() - mountTimeRef.current < 2000) return;
                if (lanActiveRef.current || relayActiveRef.current) return;
                if (payload?.action && payload.action !== 'SCORE_STATE') return;
                handleSignal(payload as HardwareSignal);
            })
            .subscribe();

        return () => {
            mountedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            closeLanWs();
            if (relayWsRef.current) {
                relayWsRef.current.onopen = null;
                relayWsRef.current.onmessage = null;
                relayWsRef.current.onerror = null;
                relayWsRef.current.onclose = null;
                relayWsRef.current.close();
                relayWsRef.current = null;
            }
            if (gameCode) supabase.removeChannel(channel);
        };
    }, [deviceCode, gameCode, connectLanWs, connectRelayWs, closeLanWs, handleSignal]);

    // ── Outbound helpers ───────────────────────────────────────────

    const sendToHardware = useCallback((state: object) => {
        const msg = JSON.stringify({ event: 'feedback', payload: state });
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(msg);
        } else if (relayWsRef.current?.readyState === WebSocket.OPEN) {
            relayWsRef.current.send(msg);
        }
    }, []);

    const retryLan = useCallback(() => {
        if (!localIpRef.current) return;
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        closeLanWs();
        connectLanWs(localIpRef.current);
    }, [closeLanWs, connectLanWs]);

    const sendPairingPush = useCallback((pushPayload: any) => {
        let msg: string;
        if (pushPayload.status === 'active') {
            msg = JSON.stringify({
                t: 'cmd',
                action: 'activate',
                teamA: pushPayload.teamA || 'HOME',
                teamB: pushPayload.teamB || 'AWAY',
                colorA: pushPayload.colorA || '#c0392b',
                colorB: pushPayload.colorB || '#eab308',
            });
        } else {
            msg = JSON.stringify({ event: 'pairing', payload: pushPayload });
        }
        if (relayWsRef.current?.readyState === WebSocket.OPEN) relayWsRef.current.send(msg);
        if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(msg);
    }, []);

    const sendActivateCommand = useCallback((
        teamA: string, teamB: string,
        colorA = '#c0392b', colorB = '#eab308'
    ) => {
        const msg = JSON.stringify({
            t: 'cmd',
            action: 'activate',
            teamA,
            teamB,
            colorA,
            colorB,
        });
        console.log('[ACTIVATE] Sending activate command:', msg);
        if (relayWsRef.current?.readyState === WebSocket.OPEN) {
            relayWsRef.current.send(msg);
            console.log('[ACTIVATE] Sent via relay ✓');
        } else {
            console.warn('[ACTIVATE] Relay not open — readyState:',
                relayWsRef.current?.readyState);
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(msg);
            console.log('[ACTIVATE] Sent via LAN ✓');
        }
    }, []);

    // SINGLE return statement — no old version below this
    return {
        sendToHardware,
        lanConnected,
        relayConnected,
        retryLan,
        sendPairingPush,
        sendActivateCommand,
        relayReadyCallbackRef,
    };
}