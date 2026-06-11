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
import PiTouchScoringScreen from '../components/refereebox/PiTouchScoringScreen';
import PiAdvancedShotFlow from '../components/refereebox/PiAdvancedShotFlow';
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

export default function LanControlPage() {
    const { gameCode = '' } = useParams();
    const code = gameCode.toUpperCase();
    const navigate = useNavigate();

    const [teamA, setTeamA] = useState<TeamModel>({ name: 'TEAM A', score: 0, fouls: 0, timeouts: 4, color: '#2563EB', players: [] });
    const [teamB, setTeamB] = useState<TeamModel>({ name: 'TEAM B', score: 0, fouls: 0, timeouts: 4, color: '#DC2626', players: [] });
    const [possession, setPossession] = useState<'A' | 'B' | null>('A');
    const [settings, setSettings] = useState(DEFAULTS);
    const [scorePending, setScorePending] = useState<ScorePendingEvent | null>(null);
    const seededRef = useRef(false);

    // Clock engine (host). Also mirrors the clock to Supabase for cloud spectators.
    const timer = useSupabaseBroadcast({
        gameCode: code,
        isHost: true,
        periodDuration: settings.periodMinutes,
        shotClockDuration: settings.shotClockSeconds,
    });

    // LAN transport + best-effort cloud mirror.
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

    // Push to LAN + queue mirror whenever scoreboard state changes.
    useEffect(() => {
        sendSnapshot(buildSnapshot());
        mirrorState();
    }, [teamA, teamB, possession, sendSnapshot, buildSnapshot, mirrorState]);

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
    }, [timer, applyScore]);

    // ── Render ──────────────────────────────────────────────────
    const gameMs = timer.minutes * 60_000 + timer.seconds * 1_000 + timer.tenths * 100;
    const shotMs = timer.shotClock * 1_000;

    if (scorePending) {
        return (
            <PiAdvancedShotFlow
                key={`${scorePending.team}-${scorePending.points}-${teamA.score}-${teamB.score}`}
                event={scorePending}
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
                onSkip={handleSkip}
            />
        );
    }

    return (
        <>
            <PiTouchScoringScreen
                teamA={{ name: teamA.name, score: teamA.score, fouls: teamA.fouls, timeouts: teamA.timeouts }}
                teamB={{ name: teamB.name, score: teamB.score, fouls: teamB.fouls, timeouts: teamB.timeouts }}
                clock={{ gameMs, shotMs, isRunning: timer.gameRunning, period: timer.period, totalPeriods: settings.totalPeriods }}
                possession={possession}
                teamAColor={teamA.color}
                teamBColor={teamB.color}
                isConnected={peerCount > 0}
                gameCode={code}
                sendAction={handleAction}
                onClose={() => navigate('/')}
            />

            {/* Direct Link status pill — LED link + cloud-mirror backlog */}
            <div style={{
                position: 'fixed', top: 6, left: '50%', transform: 'translateX(-50%)',
                zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
                padding: '4px 12px', background: 'rgba(8,10,14,0.86)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                pointerEvents: 'none', userSelect: 'none',
            }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: peerCount > 0 ? '#22C55E' : '#F59E0B' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: peerCount > 0 ? '#22C55E' : '#F59E0B' }} />
                    {peerCount > 0 ? `LED LINKED · ${code}` : `LINKING · ${code}`}
                </span>
                <span style={{ color: pending > 0 ? '#F59E0B' : 'rgba(255,255,255,0.4)' }}>
                    {pending > 0 ? `SYNC ${pending}` : 'SYNCED'}
                </span>
            </div>
        </>
    );
}
