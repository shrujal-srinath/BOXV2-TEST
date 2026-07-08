// src/pages/LanControlPage.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Direct Link CONTROLLER (phone/laptop → Pi LED)
//
// Reached by scanning the QR on the Pi's "Direct Link" tab. Runs the
// full advanced scoring flow on the operator's own device and pushes a
// live game snapshot to the Pi over LAN (zero latency, WebRTC), while
// best-effort mirroring to Supabase so the public website still sees it.
//
//   • Deck UI       → reuse PiTouchScoringScreen (scores/fouls/timeouts/
//                     clock/possession/shot-clock/period).
//   • Shot chart    → reuse PiAdvancedShotFlow (court → player → context)
//                     on a made basket, writing shot_events.
//   • Clock engine  → useSupabaseBroadcast(isHost) (also mirrors clock to
//                     cloud spectators).
//   • LAN feed      → useDirectLinkHost.sendSnapshot.
//   • Cloud mirror  → useMirrorQueue (coalesced state + appended events),
//                     guarded by navigator.onLine so offline never blocks.
//
// BETA: tuned for the Pi's landscape deck; usable on a phone in landscape.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import PiTouchScoringScreen from '../components/refereebox/PiTouchScoringScreen';
import AdvancedFlowHost from '../components/refereebox/AdvancedFlowHost';
import type { ScorePendingEvent, Player } from '../hooks/useRefereeBox';
import type { ShotZoneId } from '../components/shotchart/types/shotTypes';
import { useSupabaseBroadcast } from '../hooks/useSupabaseBroadcast';
import { useDirectLinkHost, useMirrorQueue, type DirectLinkSnapshot } from '../hooks/useLanGameLink';
import { subscribeToGame, batchUpdateGame } from '../services/supabaseGameService';
import { broadcastScoreUpdate } from '../services/supabaseBroadcastService';
import { createShotEvent } from '../services/shotService';

interface TeamModel {
    name: string;
    score: number;
    fouls: number;
    timeouts: number;
    color: string;
    players: Player[];
}

const DEFAULTS = { periodMinutes: 10, shotClockSeconds: 24, totalPeriods: 4 };

type ConnMode = 'trying' | 'direct' | 'webrtc' | 'cloud';

export default function LanControlPage() {
    const { gameCode = '' } = useParams();
    const code = gameCode.toUpperCase();
    const navigate = useNavigate();

    const searchParams = new URLSearchParams(window.location.search);
    const piIp = searchParams.get('pi');

    const [teamA, setTeamA] = useState<TeamModel>({ name: 'TEAM A', score: 0, fouls: 0, timeouts: 4, color: '#2563EB', players: [] });
    const [teamB, setTeamB] = useState<TeamModel>({ name: 'TEAM B', score: 0, fouls: 0, timeouts: 4, color: '#DC2626', players: [] });
    const [possession, setPossession] = useState<'A' | 'B' | null>('A');
    const [settings, setSettings] = useState(DEFAULTS);
    const [scorePending, setScorePending] = useState<ScorePendingEvent | null>(null);
    const [connMode, setConnMode] = useState<ConnMode>(piIp ? 'trying' : 'webrtc');
    const seededRef = useRef(false);
    const directSocketRef = useRef<Socket | null>(null);

    // Try direct Socket.io connection if Pi IP is in URL
    useEffect(() => {
        if (!piIp || connMode !== 'trying') {
            return;
        }

        const sock = io(`http://${piIp}:3001`, { timeout: 2500, reconnection: false });
        directSocketRef.current = sock;

        const handleConnect = () => {
            console.log('✓ Connected to Pi daemon via Socket.io');
            setConnMode('direct');
        };

        const handleStateUpdate = (s: any) => {
            setTeamA(t => ({ ...t, score: s.teamA.score, fouls: s.teamA.fouls, timeouts: s.teamA.timeouts }));
            setTeamB(t => ({ ...t, score: s.teamB.score, fouls: s.teamB.fouls, timeouts: s.teamB.timeouts }));
        };

        const handleConnectError = (err: any) => {
            console.log('✗ Direct connection failed, falling back to WebRTC:', err.message);
            sock.disconnect();
            setConnMode('webrtc');
        };

        sock.on('connect', handleConnect);
        sock.on('state_update', handleStateUpdate);
        sock.on('connect_error', handleConnectError);

        const cleanup = () => {
            sock.off('connect', handleConnect);
            sock.off('state_update', handleStateUpdate);
            sock.off('connect_error', handleConnectError);
            sock.disconnect();
        };

        return cleanup;
    }, [piIp, connMode]);

    // Clock engine (host). Also mirrors the clock to Supabase for cloud spectators.
    const timer = useSupabaseBroadcast({
        gameCode: code,
        isHost: true,
        periodDuration: settings.periodMinutes,
        shotClockDuration: settings.shotClockSeconds,
    });

    // LAN transport + best-effort cloud mirror (only for WebRTC mode).
    const { sendSnapshot, peerCount } = useDirectLinkHost(code);
    const { coalesce, append, pending } = useMirrorQueue();

    // ── Seed once from the game the Pi created ──────────────────
    useEffect(() => {
        if (!code) return;
        const unsub = subscribeToGame(code, (g: any) => {
            if (!g || seededRef.current) return;
            seededRef.current = true;
            const s = g.settings || {};
            setSettings({
                periodMinutes: s.periodDuration ?? DEFAULTS.periodMinutes,
                shotClockSeconds: s.shotClockDuration ?? DEFAULTS.shotClockSeconds,
                totalPeriods: s.periods ?? DEFAULTS.totalPeriods,
            });
            if (g.teamA) setTeamA(t => ({
                ...t,
                name: g.teamA.name ?? t.name,
                color: g.teamA.color ?? t.color,
                score: g.teamA.score ?? 0,
                fouls: g.teamA.fouls ?? 0,
                timeouts: g.teamA.timeouts ?? t.timeouts,
                players: Array.isArray(g.teamA.players) ? g.teamA.players : [],
            }));
            if (g.teamB) setTeamB(t => ({
                ...t,
                name: g.teamB.name ?? t.name,
                color: g.teamB.color ?? t.color,
                score: g.teamB.score ?? 0,
                fouls: g.teamB.fouls ?? 0,
                timeouts: g.teamB.timeouts ?? t.timeouts,
                players: Array.isArray(g.teamB.players) ? g.teamB.players : [],
            }));
        });
        return unsub;
    }, [code]);

    // ── Keep a fresh ref of everything the snapshot needs ───────
    const stateRef = useRef({ teamA, teamB, possession, settings, timer });
    useEffect(() => {
        stateRef.current = { teamA, teamB, possession, settings, timer };
    });

    const buildSnapshot = useCallback((): DirectLinkSnapshot => {
        const { teamA, teamB, possession, settings, timer } = stateRef.current;
        return {
            v: 1,
            gameCode: code,
            teamA: { name: teamA.name, score: teamA.score, fouls: teamA.fouls, timeouts: teamA.timeouts, color: teamA.color },
            teamB: { name: teamB.name, score: teamB.score, fouls: teamB.fouls, timeouts: teamB.timeouts, color: teamB.color },
            clock: {
                gameMs: timer.minutes * 60_000 + timer.seconds * 1_000 + timer.tenths * 100,
                shotMs: timer.shotClock * 1_000,
                isRunning: timer.gameRunning,
                period: timer.period,
                totalPeriods: settings.totalPeriods,
            },
            possession,
            ts: Date.now(),
        };
    }, [code]);

    // Steady cadence keeps the LED clock fresh + drift-free and resyncs
    // late-joining receivers within 250ms.
    useEffect(() => {
        const iv = setInterval(() => sendSnapshot(buildSnapshot()), 250);
        return () => clearInterval(iv);
    }, [sendSnapshot, buildSnapshot]);

    // ── Cloud mirror (best-effort, offline-safe) ────────────────
    const mirrorState = useCallback(() => {
        coalesce('state', async () => {
            if (!navigator.onLine) throw new Error('offline'); // retry later
            const { teamA, teamB, possession, timer } = stateRef.current;
            await batchUpdateGame(code, {
                'teamA.score': teamA.score, 'teamA.fouls': teamA.fouls, 'teamA.timeouts': teamA.timeouts,
                'teamB.score': teamB.score, 'teamB.fouls': teamB.fouls, 'teamB.timeouts': teamB.timeouts,
                'gameState.possession': possession ?? 'A',
                'gameState.period': timer.period,
            });
            await broadcastScoreUpdate(
                code, teamA.score, teamB.score, teamA.fouls, teamB.fouls,
                teamA.timeouts, teamB.timeouts, possession ?? 'A',
            );
        });
    }, [code, coalesce]);

    // Push to LAN (WebRTC) or direct Socket.io + queue mirror whenever scoreboard state changes.
    useEffect(() => {
        const snapshot = buildSnapshot();
        if (connMode === 'direct' && directSocketRef.current?.connected) {
            directSocketRef.current.emit('ui_action_state', snapshot);
        } else {
            sendSnapshot(snapshot);
            mirrorState();
        }
    }, [teamA, teamB, possession, connMode, buildSnapshot, sendSnapshot, mirrorState]);

    // ── Score helpers ───────────────────────────────────────────
    const applyScore = useCallback((side: 'A' | 'B', delta: number) => {
        const set = side === 'A' ? setTeamA : setTeamB;
        set(t => ({ ...t, score: Math.max(0, t.score + delta) }));
    }, []);

    const handleAttribute = useCallback((data: {
        team: 'A' | 'B'; points: number;
        playerId: string | null; playerName: string | null;
        zone?: string; x?: number; y?: number;
        period?: number; gameClockSec?: number; attributes?: string[];
    }) => {
        const pts = data.points as 1 | 2 | 3;
        applyScore(data.team, pts);
        append(async () => {
            if (!navigator.onLine) throw new Error('offline');
            await createShotEvent({
                gameCode: code,
                playerId: data.playerId ?? null,
                teamSide: data.team,
                x: data.x ?? null,
                y: data.y ?? null,
                zone: (data.zone as ShotZoneId) ?? 'unlocated',
                made: true,
                points: pts,
                shotType: pts === 1 ? 'free_throw' : 'field_goal',
                period: data.period ?? stateRef.current.timer.period,
                gameClockSec: data.gameClockSec ?? null,
                attributes: (data.attributes as any) ?? [],
                inputMethod: 'live',
            });
        });
        setScorePending(null);
    }, [applyScore, append, code]);

    // Skip attribution but still count the basket (the make already happened).
    const handleSkip = useCallback(() => {
        setScorePending(cur => {
            if (cur) applyScore(cur.team, cur.points);
            return null;
        });
    }, [applyScore]);

    // ── Deck action dispatch ────────────────────────────────────
    const handleAction = useCallback((type: string, payload?: Record<string, unknown>) => {
        // In direct Socket.io mode, emit to daemon and let it drive the state
        if (connMode === 'direct' && directSocketRef.current?.connected) {
            directSocketRef.current.emit('ui_action', { type, payload });
            return;
        }

        // Otherwise, local state mutation (WebRTC/cloud mode)
        const teamKey = payload?.team as ('teamA' | 'teamB' | 'A' | 'B' | undefined);
        const side: 'A' | 'B' = teamKey === 'teamB' || teamKey === 'B' ? 'B' : 'A';
        const amount = Number(payload?.amount ?? 0);

        switch (type) {
            case 'CLOCK_TOGGLE': timer.toggleClock(); break;
            case 'NEXT_PERIOD': timer.nextPeriod(); break;
            case 'SET_SHOT_CLOCK':
                if (Number(payload?.ms) === 14000) timer.resetShotClock14();
                else timer.resetShotClock24();
                break;
            case 'SET_POSSESSION':
                setPossession((payload?.team === 'B') ? 'B' : 'A');
                break;
            case 'EDIT_FOULS': {
                const set = side === 'A' ? setTeamA : setTeamB;
                set(t => ({ ...t, fouls: Math.max(0, t.fouls + amount) }));
                break;
            }
            case 'EDIT_TIMEOUTS': {
                const set = side === 'A' ? setTeamA : setTeamB;
                set(t => ({ ...t, timeouts: Math.max(0, t.timeouts + amount) }));
                break;
            }
            case 'EDIT_SCORE':
                if (amount > 0 && amount <= 3) {
                    // Made basket → advanced attribution flow.
                    const players = side === 'A' ? stateRef.current.teamA.players : stateRef.current.teamB.players;
                    setScorePending({ team: side, points: amount as 1 | 2 | 3, players, gameMode: 'advanced' });
                } else if (amount !== 0) {
                    applyScore(side, amount); // correction (e.g. −1)
                }
                break;
            case 'TRIGGER_BUZZER': /* no horn on the controller */ break;
            default: break;
        }
    }, [connMode, timer, applyScore]);

    // ── Render ──────────────────────────────────────────────────
    const gameMs = timer.minutes * 60_000 + timer.seconds * 1_000 + timer.tenths * 100;
    const shotMs = timer.shotClock * 1_000;

    return (
        <AdvancedFlowHost
            event={scorePending}
            onConsumed={handleSkip}
            teamA={{ name: teamA.name, score: teamA.score, fouls: teamA.fouls, timeouts: teamA.timeouts, color: teamA.color }}
            teamB={{ name: teamB.name, score: teamB.score, fouls: teamB.fouls, timeouts: teamB.timeouts, color: teamB.color }}
            teamAColor={teamA.color}
            teamBColor={teamB.color}
            clock={{
                gameMs, shotMs, isRunning: timer.gameRunning,
                period: timer.period, totalPeriods: settings.totalPeriods,
                periodMinutes: settings.periodMinutes, shotClockSeconds: settings.shotClockSeconds,
            }}
            gameCode={code}
            onAttribute={handleAttribute}
            fallback={<>
            <PiTouchScoringScreen
                teamA={{ name: teamA.name, score: teamA.score, fouls: teamA.fouls, timeouts: teamA.timeouts }}
                teamB={{ name: teamB.name, score: teamB.score, fouls: teamB.fouls, timeouts: teamB.timeouts }}
                clock={{ gameMs, shotMs, isRunning: timer.gameRunning, period: timer.period, totalPeriods: settings.totalPeriods }}
                possession={possession}
                teamAColor={teamA.color}
                teamBColor={teamB.color}
                isConnected={connMode === 'direct' || peerCount > 0}
                gameCode={code}
                sendAction={handleAction}
                onClose={() => navigate('/')}
            />

            {/* Status pill — shows connection mode */}
            <div style={{
                position: 'fixed', top: 6, left: '50%', transform: 'translateX(-50%)',
                zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
                padding: '4px 12px', background: 'rgba(8,10,14,0.86)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                pointerEvents: 'none', userSelect: 'none',
            }}>
                {connMode === 'direct' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#22C55E' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
                        {`DIRECT · ${piIp}`}
                    </span>
                ) : connMode === 'trying' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#F59E0B' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', animation: 'pulse 1.2s ease-in-out infinite' }} />
                        {`CONNECTING · ${piIp}`}
                    </span>
                ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: peerCount > 0 ? '#22C55E' : '#F59E0B' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: peerCount > 0 ? '#22C55E' : '#F59E0B' }} />
                        {peerCount > 0 ? `WEBRTC · ${code}` : `LINKING · ${code}`}
                    </span>
                )}
                {connMode !== 'direct' && (
                    <span style={{ color: pending > 0 ? '#F59E0B' : 'rgba(255,255,255,0.4)' }}>
                        {pending > 0 ? `SYNC ${pending}` : 'SYNCED'}
                    </span>
                )}
                <style>{`@keyframes pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }`}</style>
            </div>
        </>}
        />
    );
}
