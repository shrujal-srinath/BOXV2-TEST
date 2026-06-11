// src/hooks/useLanGameLink.ts
// ═══════════════════════════════════════════════════════════════
// THE BOX — Direct Link (LAN scoring → LED) transport
//
// A dedicated WebRTC channel that carries the FULL game snapshot
// peer-to-peer over the local WiFi, so the LED updates with zero
// latency even when gym internet is slow or down.
//
//   Controller (phone/laptop)  ── useDirectLinkHost ──►  LAN P2P
//   Pi receiver (LED)          ── useDirectLinkReceiver ◄──
//
// Signaling (the tiny SDP/ICE handshake) rides Supabase realtime on
// channel `webrtc-lan-{code}` — deliberately a DIFFERENT channel from
// the clock hook's `webrtc-{code}` so the two never collide. Once the
// RTCDataChannel is up, the live feed never touches the cloud again.
//
// The Supabase MIRROR (so the public website still sees the game) is a
// separate, best-effort concern handled by useMirrorQueue: it queues
// writes, coalesces state persists, preserves event inserts, and retries
// when connectivity returns — never blocking the LAN feed or the UI.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { HostWebRTCManager, SpectatorWebRTCManager } from '../services/webrtcSync';

/** One team's live line in a Direct Link snapshot. */
export interface SnapTeam {
    name: string;
    score: number;
    fouls: number;
    timeouts: number;
    color: string;
}

/** The full game snapshot pushed over LAN on every change + heartbeat. */
export interface DirectLinkSnapshot {
    v: 1;
    gameCode: string;
    teamA: SnapTeam;
    teamB: SnapTeam;
    clock: {
        gameMs: number;
        shotMs: number;
        isRunning: boolean;
        period: number;
        totalPeriods: number;
    };
    possession: 'A' | 'B' | null;
    ts: number;
}

// Distinct signaling channel from the clock hook's `webrtc-{code}`.
const lanCode = (gameCode: string) => `lan-${gameCode.toUpperCase()}`;

// ─── CONTROLLER (host) ───────────────────────────────────────────
/**
 * Owns the WebRTC host for Direct Link. Returns `sendSnapshot` (push a FRESH
 * full state over LAN) and a live `peerCount`.
 *
 * NOTE on clock correctness: the caller is expected to push fresh snapshots on
 * a steady cadence (e.g. every ~250ms) so each carries the TRUE current clock.
 * The receiver re-anchors its interpolation to every snapshot, so re-sending a
 * stale snapshot would make a running clock jump backwards — therefore this
 * hook does NOT auto-resend; it only polls peer count.
 */
export function useDirectLinkHost(gameCode: string | null) {
    const hostRef = useRef<HostWebRTCManager | null>(null);
    const [peerCount, setPeerCount] = useState(0);

    useEffect(() => {
        if (!gameCode) return;
        const mgr = new HostWebRTCManager(lanCode(gameCode));
        hostRef.current = mgr;

        const hb = setInterval(() => setPeerCount(mgr.connectedCount), 1000);

        return () => {
            clearInterval(hb);
            mgr.cleanup();
            hostRef.current = null;
        };
    }, [gameCode]);

    const sendSnapshot = useCallback((snap: DirectLinkSnapshot) => {
        hostRef.current?.broadcastReliable(JSON.stringify(snap));
    }, []);

    return { sendSnapshot, peerCount };
}

// ─── RECEIVER (Pi / LED) ─────────────────────────────────────────
/**
 * Owns the WebRTC spectator for Direct Link. Calls `onSnapshot` for each
 * full snapshot received over LAN. `linked` flips true once the first
 * snapshot arrives (drives the "LINKED" UI state).
 */
export function useDirectLinkReceiver(
    gameCode: string | null,
    onSnapshot: (s: DirectLinkSnapshot) => void,
) {
    const cbRef = useRef(onSnapshot);
    useEffect(() => { cbRef.current = onSnapshot; }, [onSnapshot]);

    const [linked, setLinked] = useState(false);

    useEffect(() => {
        if (!gameCode) return;
        setLinked(false);
        const spec = new SpectatorWebRTCManager(lanCode(gameCode), (msg) => {
            try {
                const data = JSON.parse(msg) as DirectLinkSnapshot;
                if (data && data.v === 1 && data.teamA && data.teamB) {
                    setLinked(true);
                    cbRef.current(data);
                }
            } catch { /* non-snapshot frame (e.g. stray clock msg) — ignore */ }
        });
        return () => { spec.cleanup(); setLinked(false); };
    }, [gameCode]);

    return { linked };
}

// ─── MIRROR QUEUE (best-effort Supabase sync) ────────────────────
type Job = () => Promise<void>;

/**
 * Best-effort write queue for the cloud mirror. Two lanes:
 *   • coalesced(key, job) — latest-wins (e.g. the game-state persist; only
 *     the most recent matters, so stale ones are dropped).
 *   • append(job)         — preserved in order (e.g. shot_events inserts,
 *     each a distinct row that must all eventually land).
 *
 * On failure (offline/slow) the queue pauses and retries every few seconds,
 * so scoring never blocks on the network. `pending` drives a sync indicator.
 */
export function useMirrorQueue() {
    const coalescedRef = useRef<Map<string, Job>>(new Map());
    const appendRef = useRef<Job[]>([]);
    const runningRef = useRef(false);
    const [pending, setPending] = useState(0);

    const recount = useCallback(() => {
        setPending(coalescedRef.current.size + appendRef.current.length);
    }, []);

    const pump = useCallback(async () => {
        if (runningRef.current) return;
        runningRef.current = true;
        try {
            // Coalesced lane first (latest game state).
            for (const [key, job] of Array.from(coalescedRef.current.entries())) {
                try {
                    await job();
                    // Only clear if a newer job for this key hasn't replaced it.
                    if (coalescedRef.current.get(key) === job) coalescedRef.current.delete(key);
                } catch {
                    runningRef.current = false;
                    recount();
                    return; // offline — stop, retry later
                }
            }
            // Append lane (events, in order).
            while (appendRef.current.length) {
                const job = appendRef.current[0];
                try {
                    await job();
                    appendRef.current.shift();
                } catch {
                    runningRef.current = false;
                    recount();
                    return;
                }
            }
        } finally {
            runningRef.current = false;
            recount();
        }
    }, [recount]);

    const coalesce = useCallback((key: string, job: Job) => {
        coalescedRef.current.set(key, job);
        recount();
        void pump();
    }, [pump, recount]);

    const append = useCallback((job: Job) => {
        appendRef.current.push(job);
        recount();
        void pump();
    }, [pump, recount]);

    // Retry stuck jobs when connectivity returns.
    useEffect(() => {
        const iv = setInterval(() => {
            if (coalescedRef.current.size || appendRef.current.length) void pump();
        }, 4000);
        return () => clearInterval(iv);
    }, [pump]);

    return { coalesce, append, pending };
}
