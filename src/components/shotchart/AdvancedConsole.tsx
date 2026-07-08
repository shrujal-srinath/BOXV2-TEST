// src/components/shotchart/AdvancedConsole.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Advanced Console v4: Arcade Design Language
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AdvancedCourtHex } from './AdvancedCourtHex';
import type { CourtTheme, HoverInfo } from './AdvancedCourtHex';
import { classifyZone, SHOT_ATTRIBUTES, ZONES } from './courtZones';
import { useShotAttribution } from '../../hooks/useShotAttribution';
import type { AttributedShotPayload } from '../../services/shotAttribution';
import type {
    ShotEvent, ShotAttribute, ShotZoneId, PersistedZone, ShotType, GameActionType,
} from './types/shotTypes';
import type { Player } from '../../types';
import { JumpBallModal } from './JumpBallModal';
import { SubstitutionPanel } from './SubstitutionPanel';
import { useConsoleAnalytics } from '../../hooks/useConsoleAnalytics';
import { computeXPPA, playerZoneStats } from '../../lib/xppa';
import { AndOnePopup } from '../scoring/AndOnePopup';
import { QEndBanner } from '../scoring/QEndBanner';
import { PredictiveFollowup } from '../scoring/PredictiveFollowup';

// ── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --bg-primary:       #07090E;
  --surface-primary:  #0D1320;
  --surface-elevated: #152032;
  --surface-overlay:  #1C2B44;
  --border-subtle:    #1B2640;
  --border-medium:    #2B3E5A;
  --text-primary:     #F0F4FF;
  --text-secondary:   #8D97AA;
  --text-tertiary:    #5E6B7D;
  --success:          #22C55E;
  --warning:          #F59E0B;
  --danger:           #EF4444;
}

@keyframes acPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
@keyframes acRibbonSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes acStatsSlide { from{transform:translateX(-100%)} to{transform:translateX(0)} }
@keyframes acFeedSlide { from{transform:translateX(100%)} to{transform:translateX(0)} }

.ac-press { transition: transform 80ms ease-out, opacity 80ms; }
.ac-press:active { transform: scale(0.95); opacity: 0.85; }
.ac-no-scrollbar::-webkit-scrollbar { display: none; }
.ac-no-scrollbar { scrollbar-width: none; }
`;

// ── Types ────────────────────────────────────────────────────────────────────

interface AdvancedConsoleProps {
    teamAName: string; teamAColor: string; teamAPlayers: Player[];
    teamAScore: number; teamAFouls: number; teamATimeouts: number;
    teamBName: string; teamBColor: string; teamBPlayers: Player[];
    teamBScore: number; teamBFouls: number; teamBTimeouts: number;
    period: number; minutes: number; seconds: number;
    shotClock: number; gameRunning: boolean; possession: 'A' | 'B';
    onScoreChange: (team: 'A' | 'B', points: number) => void;
    onShotRecorded: (shot: { teamSide: 'A' | 'B'; playerId: string | null; points: 1 | 2 | 3; made: boolean; shotType: ShotType; x: number | null; y: number | null; zone: PersistedZone; attributes: ShotAttribute[] }) => void;
    onSecondaryAction: (team: 'A' | 'B', action: GameActionType) => void;
    onToggleClock: () => void; onNextPeriod: () => void;
    onResetShotClock: (v: number) => void; onTogglePossession: () => void;
    existingShots: ShotEvent[];
    gameName?: string; gameCode?: string;
    onUndo?: () => void; onCast?: () => void; onExport?: () => void;
    onEndGame?: () => void; onBack?: () => void;
    hwMode?: 'web' | 'hardware'; isWebLocked?: boolean;
}

interface ConfirmedDot { id: string; x: number; y: number; made: boolean; points: 1 | 2 | 3; zone: ShotZoneId; ts: number; }

const fmt = (n: number) => n.toString().padStart(2, '0');
const qLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);
const shortName = (name: string) => name.slice(0, 3).toUpperCase();

function computeZoneHeat(shots: ShotEvent[]) {
    const m = new Map<ShotZoneId, { fgm: number; fga: number; pct: number }>();
    for (const s of shots) {
        if (s.zone === 'unlocated' || s.zone === 'free_throw') continue;
        const c = m.get(s.zone) || { fgm: 0, fga: 0, pct: 0 };
        c.fga++; if (s.made) c.fgm++;
        c.pct = c.fga > 0 ? Math.round((c.fgm / c.fga) * 100) : 0;
        m.set(s.zone, c);
    }
    return m;
}

function computePlayerStats(shots: ShotEvent[], players: Player[]) {
    const stats = new Map<string, { pts: number; fgm: number; fga: number; threePm: number; threePa: number; ftm: number; fta: number; reb: number; ast: number }>();
    for (const p of players) {
        stats.set(p.id, { pts: 0, fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0, reb: 0, ast: 0 });
    }
    for (const s of shots) {
        if (!s.playerId) continue;
        const st = stats.get(s.playerId);
        if (!st) continue;
        if (s.shotType === 'free_throw') {
            st.fta++;
            if (s.made) { st.ftm++; st.pts += 1; }
        } else {
            st.fga++;
            if (s.points === 3) st.threePa++;
            if (s.made) {
                st.fgm++; st.pts += s.points;
                if (s.points === 3) st.threePm++;
            }
        }
    }
    return stats;
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const arcCard: React.CSSProperties = {
    background: 'var(--surface-primary)',
    borderRadius: 18,
    border: '0.5px solid var(--border-subtle)',
};

const arcElevatedBtn: React.CSSProperties = {
    background: 'var(--surface-elevated)',
    border: '0.5px solid var(--border-subtle)',
    borderRadius: 10,
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontFamily: 'Inter, sans-serif',
};

// ═══════════════════════════════════════════════════════════════════════════════

export const AdvancedConsole: React.FC<AdvancedConsoleProps> = (props) => {
    const {
        teamAName, teamAColor, teamAPlayers, teamAScore, teamAFouls, teamATimeouts,
        teamBName, teamBColor, teamBPlayers, teamBScore, teamBFouls, teamBTimeouts,
        period, minutes, seconds, shotClock, gameRunning, possession,
        onScoreChange, onShotRecorded, onSecondaryAction,
        onToggleClock, onNextPeriod, onResetShotClock, onTogglePossession,
        existingShots, gameCode,
        onUndo, onCast, onExport, onEndGame, onBack, isWebLocked,
    } = props;

    const [selA, setSelA] = useState<string | null>(null);
    const [selB, setSelB] = useState<string | null>(null);
    const [activeSide, setActiveSide] = useState<'A' | 'B'>('A');
    const [dots, setDots] = useState<ConfirmedDot[]>([]);
    const [heatMap, setHeatMap] = useState(false);
    const [lastAct, setLastAct] = useState('');
    const [eventLog, setEventLog] = useState<string[]>([]);
    const [showStats, setShowStats] = useState<'A' | 'B' | null>(null);
    const [feedOpen, setFeedOpen] = useState(false);

    const [courtTheme, setCourtTheme] = useState<CourtTheme>(() => (localStorage.getItem('boxv2-console-theme') as CourtTheme) || 'dark');
    const [gridMode, setGridMode] = useState<'off' | 'hover' | 'always'>(() => (localStorage.getItem('boxv2-console-grid') as 'off' | 'hover' | 'always') || 'hover');
    const [verbose, setVerbose] = useState<boolean>(() => localStorage.getItem('boxv2-console-verbose') === '1');
    useEffect(() => { localStorage.setItem('boxv2-console-theme', courtTheme); }, [courtTheme]);
    useEffect(() => { localStorage.setItem('boxv2-console-grid', gridMode); }, [gridMode]);
    useEffect(() => { localStorage.setItem('boxv2-console-verbose', verbose ? '1' : '0'); }, [verbose]);
    // gridMode → existing AdvancedCourtHex props (no court edits):
    //   off   → no hexes, no zone highlight
    //   hover → hexes hidden, zone highlight reveals on hover (the "on hover" mode)
    //   always→ hexes always tinted + zone highlight
    const hexOpacity = gridMode === 'always' ? 0.18 : 0;
    const showZoneHL = gridMode !== 'off';
    const [fullCourt, setFullCourt] = useState(false);
    const [hexRadius, setHexRadius] = useState(1.9);
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
    const [courtSpec, setCourtSpec] = useState<'fiba' | 'nba'>('fiba');
    const [showLineToRim, setShowLineToRim] = useState(false);

    // Court-first tap awaiting a team pick (replaces the old x<50 team GUESS).
    const [teamAsk, setTeamAsk] = useState<{ x: number; y: number; zone: string } | null>(null);
    // Pre-selected roster player per queued event id; deferred events carry no entry.
    const preSelectRef = useRef(new Map<string, { id: string; name: string | null } | null>());
    // Deferred (court-first) event ids — their score applies on resolution, not enqueue.
    const deferredIdsRef = useRef(new Set<string>());
    const [showJumpBall, setShowJumpBall] = useState(() => period === 1 && !gameRunning);
    const [showSubPanel, setShowSubPanel] = useState<'A' | 'B' | null>(null);

    const teamColor = (s: 'A' | 'B') => s === 'A' ? teamAColor : teamBColor;
    const pA = useMemo(() => teamAPlayers.filter(p => p.name), [teamAPlayers]);
    const pB = useMemo(() => teamBPlayers.filter(p => p.name), [teamBPlayers]);

    const courtDots = useMemo(() => {
        const ex = existingShots.filter(s => s.zone !== 'unlocated').map(s => ({ id: s.id, x: s.x, y: s.y, made: s.made, points: s.points as 1 | 2 | 3 }));
        return [...ex, ...dots.map(d => ({ id: d.id, x: d.x, y: d.y, made: d.made, points: d.points, isLatest: true }))];
    }, [existingShots, dots]);

    const zoneOverlays = useMemo(() => {
        if (!heatMap) return undefined;
        return Array.from(computeZoneHeat(existingShots).entries()).map(([z, d]) => ({ zoneId: z, fgPct: d.pct, fga: d.fga, label: `${d.pct}%` }));
    }, [heatMap, existingShots]);

    const playerStatsA = useMemo(() => computePlayerStats(existingShots.filter(s => s.teamSide === 'A'), pA), [existingShots, pA]);
    const playerStatsB = useMemo(() => computePlayerStats(existingShots.filter(s => s.teamSide === 'B'), pB), [existingShots, pB]);

    const analytics = useConsoleAnalytics({
        period, minutes, seconds, possession,
        teamAPlayers: pA, teamBPlayers: pB, teamAColor, teamBColor,
    });

    const activeZoneStats = useMemo(
        () => playerZoneStats(existingShots, activeSide === 'A' ? selA : selB),
        [existingShots, activeSide, selA, selB],
    );
    const hoverXPPA = useMemo(
        () => (verbose && hoverInfo ? computeXPPA(hoverInfo.zone, activeZoneStats) : null),
        [verbose, hoverInfo, activeZoneStats],
    );

    // ── Shot flow ──
    const getSel = (s: 'A' | 'B') => s === 'A' ? selA : selB;
    const getName = (s: 'A' | 'B', id: string | null) => { if (!id) return null; return (s === 'A' ? pA : pB).find(p => p.id === id)?.name || null; };
    const getNum = (id: string | null) => { if (!id) return ''; return pA.concat(pB).find(p => p.id === id)?.number || '?'; };

    const logEvent = (msg: string) => {
        setLastAct(msg);
        setEventLog(prev => [msg, ...prev].slice(0, 50));
    };

    // ── The attribution machine (PLAN-S1-WIRING Part 1) ──
    // Web config: no context step (tags toggle pre-tap on the ribbon instead),
    // court 10s → unlocated (old pending timeout), player 8s (old popup timer).
    const onAttributed = useCallback((pay: AttributedShotPayload) => {
        const located = pay.x !== undefined && pay.y !== undefined && pay.zone !== 'unlocated';
        if (located) {
            const d: ConfirmedDot = { id: `d-${Date.now()}-${pay.eventId}`, x: pay.x!, y: pay.y!, made: pay.made, points: pay.points, zone: pay.zone as ShotZoneId, ts: Date.now() };
            setDots(prev => [...prev.slice(-30), d]);
            setTimeout(() => setDots(prev => prev.filter(dd => dd.id !== d.id)), 15000);
        }
        onShotRecorded({
            teamSide: pay.team, playerId: pay.playerId, points: pay.points, made: pay.made,
            shotType: 'field_goal', x: pay.x ?? null, y: pay.y ?? null,
            zone: pay.zone as PersistedZone, attributes: pay.attributes as ShotAttribute[],
        });
        // Court-first events apply score on resolution (score-first applied at enqueue).
        if (deferredIdsRef.current.has(pay.eventId)) {
            deferredIdsRef.current.delete(pay.eventId);
            if (pay.made) onScoreChange(pay.team, pay.points);
            logEvent(`+${pay.points} ${pay.team === 'A' ? teamAName : teamBName}${pay.playerName ? ` — ${pay.playerName}` : ''}`);
        }
        preSelectRef.current.delete(pay.eventId);
        if (located) {
            if (pay.made) analytics.registerMade(pay.team, pay.playerId, pay.playerName);
            analytics.triggerFollowup({ team: pay.team, made: pay.made, shooterPlayerId: pay.playerId });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onShotRecorded, onScoreChange, analytics, teamAName, teamBName]);

    const attribution = useShotAttribution(
        { showContext: false, courtSec: 10, playerSec: 8 },
        onAttributed,
    );

    // Score-first events resolve the player step from the pre-selection
    // (covers tap, Skip, and the court timeout uniformly). Deferred events
    // have no map entry — the roster rails become the picker.
    useEffect(() => {
        const active = attribution.activeEvent;
        if (attribution.step !== 'player' || !active) return;
        const pre = preSelectRef.current.get(active.id);
        if (pre === undefined) return;                     // deferred → show picker
        if (pre) attribution.selectPlayer(pre.id, pre.name);
        else attribution.unattributed();                   // parity: no selection = instant unattributed
    }, [attribution.step, attribution.activeEvent, attribution]);

    const enqueueShot = useCallback((side: 'A' | 'B', pts: 1 | 2 | 3, made: boolean) => {
        const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const pid = getSel(side);
        preSelectRef.current.set(id, pid ? { id: pid, name: getName(side, pid) } : null);
        attribution.enqueue({
            id, team: side, points: pts, made,
            period, gameClockSec: minutes * 60 + seconds, ts: Date.now(),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attribution, period, minutes, seconds, selA, selB, pA, pB]);

    const handleMade = useCallback((side: 'A' | 'B', pts: 1 | 2 | 3, st: ShotType) => {
        if (isWebLocked) return;
        const pid = getSel(side);
        if (st === 'free_throw') {
            onScoreChange(side, pts);
            onShotRecorded({ teamSide: side, playerId: pid, points: 1, made: true, shotType: st, x: null, y: null, zone: 'free_throw', attributes: [] });
        } else {
            onScoreChange(side, pts);
            enqueueShot(side, pts, true);
        }
        logEvent(`+${pts} ${side === 'A' ? teamAName : teamBName}${getNum(pid) ? ` #${getNum(pid)}` : ''}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWebLocked, selA, selB, pA, pB, onScoreChange, onShotRecorded, enqueueShot, teamAName, teamBName]);

    const handleMiss = useCallback((side: 'A' | 'B', pts: 2 | 3) => {
        if (isWebLocked) return;
        enqueueShot(side, pts, false);
        logEvent(`MISS ${pts}PT ${side === 'A' ? teamAName : teamBName}`);
    }, [isWebLocked, enqueueShot, teamAName, teamBName]);

    const handleMissFT = useCallback((side: 'A' | 'B') => {
        if (isWebLocked) return;
        const pid = getSel(side);
        onShotRecorded({ teamSide: side, playerId: pid, points: 1, made: false, shotType: 'free_throw', x: null, y: null, zone: 'free_throw', attributes: [] });
        logEvent(`MISS FT ${side === 'A' ? teamAName : teamBName}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWebLocked, selA, selB, pA, pB, onShotRecorded, teamAName, teamBName]);

    const handleCourtTap = useCallback((x: number, y: number) => {
        if (attribution.step === 'court') {
            attribution.tapCourt(classifyZone(x, y), x, y);
            return;
        }
        // Idle court-first tap: the OPERATOR names the team (never guessed
        // from geometry — the old x<50 heuristic mis-credited points).
        if (!attribution.activeEvent) {
            setTeamAsk({ x, y, zone: classifyZone(x, y) });
        }
    }, [attribution]);

    const commitTeamAsk = useCallback((side: 'A' | 'B') => {
        if (!teamAsk) return;
        const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        deferredIdsRef.current.add(id);
        attribution.enqueue({
            id, team: side, made: true,
            points: teamAsk.zone.startsWith('three_') ? 3 : 2,
            period, gameClockSec: minutes * 60 + seconds,
            prefill: { zone: teamAsk.zone, x: teamAsk.x, y: teamAsk.y },
            ts: Date.now(),
        });
        setTeamAsk(null);
    }, [teamAsk, attribution, period, minutes, seconds]);

    // ── Keyboard ──
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.code === 'Space') { e.preventDefault(); onToggleClock(); }
            if (e.key === 'r' || e.key === 'R') onResetShotClock(e.shiftKey ? 14 : 24);
            if (e.key === 'p' || e.key === 'P') onTogglePossession();
            if (e.key === 'n' || e.key === 'N') onNextPeriod();
            if (e.key === 'Escape') { if (teamAsk) setTeamAsk(null); else if (showStats) setShowStats(null); else if (feedOpen) setFeedOpen(false); else if (attribution.activeEvent) attribution.dismiss(); }
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && onUndo) onUndo();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onToggleClock, onResetShotClock, onTogglePossession, onNextPeriod, onUndo, showStats, teamAsk, feedOpen, attribution]);

    const activeEv = attribution.activeEvent;
    const ac = activeEv ? (activeEv.team === 'A' ? teamAColor : teamBColor) : '#555';
    const activeTeamName = activeEv ? (activeEv.team === 'A' ? teamAName : teamBName) : '';
    const secondsLeft = attribution.state.secondsLeft;

    // Active player info for control deck header
    const activeSelId = activeSide === 'A' ? selA : selB;
    const activePlayers = activeSide === 'A' ? pA : pB;
    const activePlayer = activePlayers.find(p => p.id === activeSelId);
    const activeStats = (activeSide === 'A' ? playerStatsA : playerStatsB).get(activeSelId || '');

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════════════════

    return (
        <div className="h-screen flex flex-col overflow-hidden select-none" style={{
            background: 'radial-gradient(ellipse at 50% 0%, #1A0010 0%, #07090E 60%)',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: 'var(--text-primary)',
        }}>
            <style>{CSS}</style>

            {/* ═══ TOP: Scoreboard ═══ */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                gap: 16, padding: '12px 18px 8px', alignItems: 'center', flexShrink: 0,
            }}>
                {/* Left: back + Team A */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {onBack && (
                        <button onClick={onBack} className="ac-press" style={{
                            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0,
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                    )}
                    <ArcTeamHeader
                        side="left" name={teamAName} color={teamAColor} score={teamAScore}
                        fouls={teamAFouls} timeouts={teamATimeouts} possession={possession}
                        onStats={() => setShowStats(showStats === 'A' ? null : 'A')}
                    />
                </div>

                {/* Center: clock */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                        padding: '3px 12px', borderRadius: 100,
                        background: 'rgba(232,17,45,0.12)', color: '#E8112D',
                        fontSize: 9, letterSpacing: 1.4, fontWeight: 800,
                    }}>● LIVE · {qLabel(period)}</div>
                    <button onClick={onToggleClock} className="ac-press" style={{
                        fontWeight: 900, fontSize: 44, letterSpacing: -1.5, lineHeight: 1,
                        fontFamily: '"JetBrains Mono", monospace',
                        color: gameRunning ? 'var(--text-primary)' : '#22C55E',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        textShadow: gameRunning ? 'none' : '0 0 20px rgba(34,197,94,0.4)',
                    }}>
                        {fmt(minutes)}:{fmt(seconds)}
                    </button>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 1.4, fontWeight: 700 }}>
                        SHOT{' '}
                        <span style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            color: shotClock <= 5 ? '#EF4444' : shotClock <= 10 ? '#F59E0B' : 'var(--text-secondary)',
                        }}>{shotClock}s</span>
                    </div>
                    {gameCode && (
                        <div style={{ fontSize: 8, color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>
                            {gameCode}
                        </div>
                    )}
                </div>

                {/* Right: Team B */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ArcTeamHeader
                        side="right" name={teamBName} color={teamBColor} score={teamBScore}
                        fouls={teamBFouls} timeouts={teamBTimeouts} possession={possession}
                        onStats={() => setShowStats(showStats === 'B' ? null : 'B')}
                    />
                </div>
            </div>

            {/* ═══ MIDDLE: Roster | Court | Roster ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 240px', gap: 10, padding: '0 14px', flex: 1, minHeight: 0 }}>

                {/* Team A Roster */}
                <ArcRoster
                    side="A" color={teamAColor} name={teamAName} players={pA}
                    selId={selA}
                    onSelect={(id) => {
                        if (attribution.step === 'player' && activeEv?.team === 'A' && id) {
                            attribution.selectPlayer(id, getName('A', id));
                            return;
                        }
                        setSelA(id); setActiveSide('A');
                    }}
                    onSub={() => setShowSubPanel('A')}
                    playerStats={playerStatsA}
                    isActiveSide={activeSide === 'A'}
                />

                {/* Court card */}
                <div style={{ ...arcCard, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>

                    {/* ── HUD Readout Bar ── */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: verbose ? '1.4fr 1fr 1fr 1fr 1fr 1.5fr' : '1.4fr 1fr 1fr 1fr 1fr',
                        gap: 0, borderRadius: 10, overflow: 'hidden', flexShrink: 0, minHeight: 64,
                        background: '#040810',
                        border: '0.5px solid rgba(34,197,94,0.15)',
                        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
                        position: 'relative',
                    }}>
                        {/* Green scanline overlay */}
                        <div style={{
                            position: 'absolute', inset: 0, pointerEvents: 'none',
                            background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(34,197,94,0.03) 3px, rgba(34,197,94,0.03) 4px)',
                        }} />
                        {/* Zone */}
                        <div style={{ padding: '8px 12px', borderRight: '0.5px solid rgba(34,197,94,0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, position: 'relative' }}>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: 'rgba(34,197,94,0.5)', textTransform: 'uppercase' }}>Zone</div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: hoverInfo ? '#22C55E' : 'rgba(34,197,94,0.25)', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1, letterSpacing: 0.5 }}>
                                {hoverInfo ? hoverInfo.zone.replace(/_/g, ' ').toUpperCase() : '— — —'}
                            </div>
                        </div>
                        {/* Dist · Rim (m) */}
                        <div style={{ padding: '8px 10px', borderRight: '0.5px solid rgba(34,197,94,0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: 'rgba(34,197,94,0.5)', textTransform: 'uppercase' }}>Rim</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                <span style={{ fontSize: 18, fontWeight: 900, fontFamily: '"JetBrains Mono", monospace', color: hoverInfo ? '#F0F4FF' : 'rgba(240,244,255,0.2)', lineHeight: 1 }}>
                                    {hoverInfo ? hoverInfo.dist.meters.toFixed(1) : '—'}
                                </span>
                                <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(34,197,94,0.5)' }}>m</span>
                            </div>
                        </div>
                        {/* Dist · Rim (ft) */}
                        <div style={{ padding: '8px 10px', borderRight: '0.5px solid rgba(34,197,94,0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: 'rgba(34,197,94,0.5)', textTransform: 'uppercase' }}>Feet</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                <span style={{ fontSize: 18, fontWeight: 900, fontFamily: '"JetBrains Mono", monospace', color: hoverInfo ? '#F0F4FF' : 'rgba(240,244,255,0.2)', lineHeight: 1 }}>
                                    {hoverInfo ? hoverInfo.dist.feet.toFixed(1) : '—'}
                                </span>
                                <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(34,197,94,0.5)' }}>ft</span>
                            </div>
                        </div>
                        {/* X / Y Coords */}
                        <div style={{ padding: '8px 10px', borderRight: '0.5px solid rgba(34,197,94,0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: 'rgba(34,197,94,0.5)', textTransform: 'uppercase' }}>Coord</div>
                            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 700, color: hoverInfo ? '#F0F4FF' : 'rgba(240,244,255,0.2)', lineHeight: 1.3 }}>
                                {hoverInfo ? `X ${hoverInfo.x.toFixed(1)}` : 'X —'}
                                <br />
                                {hoverInfo ? `Y ${hoverInfo.y.toFixed(1)}` : 'Y —'}
                            </div>
                        </div>
                        {/* Point Value */}
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 4 }}>
                            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: 'rgba(34,197,94,0.5)', textTransform: 'uppercase' }}>Pts</div>
                            {hoverInfo ? (() => {
                                const is3 = hoverInfo.zone.startsWith('three') || hoverInfo.zone.startsWith('three_corner');
                                return (
                                    <div style={{
                                        padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 900, fontFamily: '"JetBrains Mono", monospace',
                                        background: is3 ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)',
                                        color: is3 ? '#60A5FA' : '#FBBF24',
                                        border: `0.5px solid ${is3 ? 'rgba(59,130,246,0.5)' : 'rgba(245,158,11,0.5)'}`,
                                    }}>{is3 ? '3PT' : '2PT'}</div>
                                );
                            })() : (
                                <div style={{ fontSize: 13, fontWeight: 900, color: 'rgba(240,244,255,0.2)', fontFamily: '"JetBrains Mono", monospace' }}>—</div>
                            )}
                        </div>
                        {/* xPPA (verbose only) */}
                        {verbose && (
                            <div style={{ padding: '8px 12px', borderLeft: '0.5px solid rgba(34,197,94,0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
                                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: 'rgba(34,197,94,0.5)', textTransform: 'uppercase' }}>xPPA · Expected</div>
                                {hoverXPPA ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                            <span style={{
                                                fontSize: 18, fontWeight: 900, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1,
                                                color: hoverXPPA.ppa >= 1.0 ? '#22C55E' : hoverXPPA.ppa >= 0.85 ? '#F59E0B' : '#EF4444',
                                            }}>{hoverXPPA.ppa.toFixed(2)}</span>
                                            <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(34,197,94,0.5)' }}>pts</span>
                                        </div>
                                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}>
                                            {hoverXPPA.playerAtt > 0 && hoverXPPA.playerPct !== null
                                                ? `${Math.round(hoverXPPA.playerPct * 100)}% on ${hoverXPPA.playerAtt} · lg ${Math.round(hoverXPPA.leaguePct * 100)}%`
                                                : `lg prior ${Math.round(hoverXPPA.leaguePct * 100)}%`}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ fontSize: 13, fontWeight: 900, color: 'rgba(240,244,255,0.2)', fontFamily: '"JetBrains Mono", monospace' }}>—</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Always-visible control bar ── */}
                    <div style={{
                        display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
                        padding: '6px 10px', borderRadius: 10, flexShrink: 0,
                        background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)',
                    }}>
                        {/* Theme */}
                        <div style={{ display: 'flex', gap: 3 }}>
                            {(['dark', 'wooden', 'white'] as CourtTheme[]).map(t => (
                                <button key={t} onClick={() => setCourtTheme(t)} className="ac-press" style={{
                                    padding: '3px 8px', borderRadius: 7, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, cursor: 'pointer',
                                    background: courtTheme === t ? 'rgba(139,92,246,0.25)' : 'transparent',
                                    border: `0.5px solid ${courtTheme === t ? 'rgba(139,92,246,0.6)' : 'var(--border-subtle)'}`,
                                    color: courtTheme === t ? '#c4b5fd' : 'var(--text-tertiary)',
                                }}>{t === 'wooden' ? 'WOOD' : t.toUpperCase()}</button>
                            ))}
                        </div>
                        <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', flexShrink: 0 }} />
                        {/* Court */}
                        <div style={{ display: 'flex', gap: 3 }}>
                            <button onClick={() => setFullCourt(false)} className="ac-press" style={{
                                padding: '3px 8px', borderRadius: 7, fontSize: 8, fontWeight: 800, cursor: 'pointer',
                                background: !fullCourt ? 'rgba(139,92,246,0.25)' : 'transparent',
                                border: `0.5px solid ${!fullCourt ? 'rgba(139,92,246,0.6)' : 'var(--border-subtle)'}`,
                                color: !fullCourt ? '#c4b5fd' : 'var(--text-tertiary)',
                            }}>HALF</button>
                            <button onClick={() => setFullCourt(true)} className="ac-press" style={{
                                padding: '3px 8px', borderRadius: 7, fontSize: 8, fontWeight: 800, cursor: 'pointer',
                                background: fullCourt ? 'rgba(139,92,246,0.25)' : 'transparent',
                                border: `0.5px solid ${fullCourt ? 'rgba(139,92,246,0.6)' : 'var(--border-subtle)'}`,
                                color: fullCourt ? '#c4b5fd' : 'var(--text-tertiary)',
                            }}>FULL</button>
                        </div>
                        <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', flexShrink: 0 }} />
                        {/* Spec */}
                        <div style={{ display: 'flex', gap: 3 }}>
                            {(['fiba', 'nba'] as const).map(s => (
                                <button key={s} onClick={() => setCourtSpec(s)} className="ac-press" style={{
                                    padding: '3px 8px', borderRadius: 7, fontSize: 8, fontWeight: 800, cursor: 'pointer',
                                    background: courtSpec === s ? 'rgba(139,92,246,0.25)' : 'transparent',
                                    border: `0.5px solid ${courtSpec === s ? 'rgba(139,92,246,0.6)' : 'var(--border-subtle)'}`,
                                    color: courtSpec === s ? '#c4b5fd' : 'var(--text-tertiary)',
                                }}>{s.toUpperCase()}</button>
                            ))}
                        </div>
                        <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', flexShrink: 0 }} />
                        {/* Hex grid mode */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 800, letterSpacing: 0.8 }}>GRID</span>
                            <div style={{ display: 'flex', gap: 3 }}>
                                {(['off', 'hover', 'always'] as const).map(g => (
                                    <button key={g} onClick={() => setGridMode(g)} className="ac-press" style={{
                                        padding: '3px 8px', borderRadius: 7, fontSize: 8, fontWeight: 800, letterSpacing: 0.6, cursor: 'pointer',
                                        background: gridMode === g ? 'rgba(139,92,246,0.25)' : 'transparent',
                                        border: `0.5px solid ${gridMode === g ? 'rgba(139,92,246,0.6)' : 'var(--border-subtle)'}`,
                                        color: gridMode === g ? '#c4b5fd' : 'var(--text-tertiary)',
                                    }}>{g === 'hover' ? 'HOVER' : g.toUpperCase()}</button>
                                ))}
                            </div>
                        </div>
                        {/* Heat */}
                        <button onClick={() => setHeatMap(v => !v)} className="ac-press" style={{
                            padding: '3px 8px', borderRadius: 7, fontSize: 8, fontWeight: 800, cursor: 'pointer',
                            background: heatMap ? 'rgba(232,17,45,0.15)' : 'transparent',
                            border: `0.5px solid ${heatMap ? 'rgba(232,17,45,0.5)' : 'var(--border-subtle)'}`,
                            color: heatMap ? '#f87171' : 'var(--text-tertiary)',
                        }}>HEAT</button>
                        {/* Line to rim */}
                        <button onClick={() => setShowLineToRim(v => !v)} className="ac-press" style={{
                            padding: '3px 8px', borderRadius: 7, fontSize: 8, fontWeight: 800, cursor: 'pointer',
                            background: showLineToRim ? 'rgba(139,92,246,0.25)' : 'transparent',
                            border: `0.5px solid ${showLineToRim ? 'rgba(139,92,246,0.6)' : 'var(--border-subtle)'}`,
                            color: showLineToRim ? '#c4b5fd' : 'var(--text-tertiary)',
                        }}>LINE</button>
                        <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', flexShrink: 0 }} />
                        {/* Hex size */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 800, letterSpacing: 0.8 }}>HEX</span>
                            <input type="range" min="0.8" max="3.0" step="0.1" value={hexRadius}
                                onChange={e => setHexRadius(Number(e.target.value))}
                                style={{ width: 50, cursor: 'pointer', accentColor: '#a78bfa', height: 2 }} />
                            <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-tertiary)', minWidth: 20 }}>{hexRadius.toFixed(1)}</span>
                        </div>
                        <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', flexShrink: 0 }} />
                        {/* Verbose analytics */}
                        <button onClick={() => setVerbose(v => !v)} className="ac-press"
                            title="Show xPPA / advanced analytics" style={{
                            padding: '3px 8px', borderRadius: 7, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, cursor: 'pointer',
                            background: verbose ? 'rgba(34,197,94,0.18)' : 'transparent',
                            border: `0.5px solid ${verbose ? 'rgba(34,197,94,0.6)' : 'var(--border-subtle)'}`,
                            color: verbose ? '#4ADE80' : 'var(--text-tertiary)',
                        }}>VERBOSE</button>
                    </div>

                    {/* Attribution ribbon (machine-driven) */}
                    {activeEv && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                            borderRadius: 10, background: `${ac}15`, border: `0.5px solid ${ac}40`,
                            animation: 'acPulse 1.5s infinite', flexShrink: 0,
                        }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ac, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: ac, letterSpacing: 0.5 }}>
                                {attribution.step === 'court'
                                    ? `${activeEv.made ? `+${activeEv.points}PT` : `MISS ${activeEv.points}PT`} — TAP COURT${secondsLeft != null ? ` · ${secondsLeft}s` : ''}`
                                    : `WHO SCORED? — TAP A ${shortName(activeTeamName)} PLAYER${secondsLeft != null ? ` · ${secondsLeft}s` : ''}`}
                            </span>
                            {attribution.queuedCount > 0 && (
                                <span style={{
                                    padding: '2px 8px', borderRadius: 100, fontSize: 9, fontWeight: 900,
                                    background: 'rgba(245,158,11,0.15)', border: '0.5px solid rgba(245,158,11,0.4)', color: '#F59E0B',
                                }}>+{attribution.queuedCount} QUEUED</span>
                            )}
                            {attribution.step === 'court' ? (
                                <button onClick={attribution.skipStep} className="ac-press" style={{
                                    marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                    background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)', color: 'var(--text-secondary)',
                                }}>Skip</button>
                            ) : (
                                <button onClick={attribution.unattributed} className="ac-press" style={{
                                    marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                    background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)', color: 'var(--text-secondary)',
                                }}>Unattributed</button>
                            )}
                        </div>
                    )}

                    {/* Court with corner frame decorations */}
                    <div style={{
                        flex: 1, position: 'relative', borderRadius: 12, overflow: 'hidden', minHeight: 0,
                        boxShadow: activeEv ? `0 0 30px ${ac}18` : 'none',
                        border: `0.5px solid ${activeEv ? `${ac}50` : 'var(--border-subtle)'}`,
                        transition: 'box-shadow 0.3s, border-color 0.3s',
                    }}>
                        {/* Corner L-brackets */}
                        {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
                            <span key={c} style={{
                                position: 'absolute', zIndex: 10, width: 14, height: 14, pointerEvents: 'none',
                                top: c.startsWith('t') ? 6 : undefined,
                                bottom: c.startsWith('b') ? 6 : undefined,
                                left: c.endsWith('l') ? 6 : undefined,
                                right: c.endsWith('r') ? 6 : undefined,
                                borderTop: c.startsWith('t') ? '1.5px solid rgba(34,197,94,0.5)' : undefined,
                                borderBottom: c.startsWith('b') ? '1.5px solid rgba(34,197,94,0.5)' : undefined,
                                borderLeft: c.endsWith('l') ? '1.5px solid rgba(34,197,94,0.5)' : undefined,
                                borderRight: c.endsWith('r') ? '1.5px solid rgba(34,197,94,0.5)' : undefined,
                            }} />
                        ))}
                        <AdvancedCourtHex
                            shots={courtDots}
                            zoneOverlays={heatMap ? zoneOverlays : undefined}
                            onCourtTap={handleCourtTap}
                            onHoverChange={setHoverInfo}
                            interactive={attribution.step === 'court' || !activeEv}
                            activeColor={ac}
                            activeEdge={activeEv ? activeEv.team : null}
                            pendingInfo={activeEv && attribution.step === 'court' ? { made: activeEv.made, points: activeEv.points } : null}
                            courtTheme={courtTheme}
                            hexOpacity={hexOpacity}
                            showZoneHL={showZoneHL}
                            fullCourt={fullCourt}
                            hexRadius={hexRadius}
                            courtSpec={courtSpec}
                            showLineToRim={showLineToRim}
                        />
                        {analytics.qEndBanner && (
                            <QEndBanner
                                periodLabel={qLabel(period)}
                                nextLabel={qLabel(period + 1)}
                                onAdvance={() => { analytics.dismissQEnd(); onNextPeriod(); }}
                                onDismiss={analytics.dismissQEnd}
                            />
                        )}
                        {analytics.andOneOffer?.foulLogged && (
                            <AndOnePopup
                                offer={analytics.andOneOffer}
                                onMade={() => {
                                    const o = analytics.andOneOffer!;
                                    onShotRecorded({ teamSide: o.team, playerId: o.playerId, points: 1, made: true, shotType: 'free_throw', x: null, y: null, zone: 'free_throw', attributes: [] });
                                    onScoreChange(o.team, 1);
                                    analytics.clearAndOne();
                                }}
                                onMiss={() => {
                                    const o = analytics.andOneOffer!;
                                    onShotRecorded({ teamSide: o.team, playerId: o.playerId, points: 1, made: false, shotType: 'free_throw', x: null, y: null, zone: 'free_throw', attributes: [] });
                                    analytics.clearAndOne();
                                }}
                                onDismiss={analytics.clearAndOne}
                            />
                        )}
                    </div>

                    {/* Attribute ribbon */}
                    {activeEv && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0, animation: 'acRibbonSlide 0.2s ease-out' }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', alignSelf: 'center', marginRight: 2 }}>Tags</span>
                            {SHOT_ATTRIBUTES.map(a => {
                                const on = attribution.state.attrs.includes(a.id);
                                return (
                                    <button key={a.id} onClick={() => attribution.toggleAttr(a.id)}
                                        className="ac-press" style={{
                                            padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                                            letterSpacing: 0.8, textTransform: 'uppercase',
                                            background: on ? `${ac}20` : 'var(--surface-elevated)',
                                            border: `0.5px solid ${on ? `${ac}60` : 'var(--border-subtle)'}`,
                                            color: on ? ac : 'var(--text-tertiary)',
                                        }}>{a.label}</button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Team B Roster */}
                <ArcRoster
                    side="B" color={teamBColor} name={teamBName} players={pB}
                    selId={selB}
                    onSelect={(id) => {
                        if (attribution.step === 'player' && activeEv?.team === 'B' && id) {
                            attribution.selectPlayer(id, getName('B', id));
                            return;
                        }
                        setSelB(id); setActiveSide('B');
                    }}
                    onSub={() => setShowSubPanel('B')}
                    playerStats={playerStatsB}
                    isActiveSide={activeSide === 'B'}
                />
            </div>

            {/* ═══ BOTTOM: Control Deck ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 200px', gap: 10, padding: '10px 14px 14px', flexShrink: 0 }}>

                {/* Clock Bay */}
                <div style={{ ...arcCard, padding: 12, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center' }}>
                    {/* Big play/pause */}
                    <button onClick={onToggleClock} className="ac-press" style={{
                        width: 72, height: 72, borderRadius: 16, border: 'none', cursor: 'pointer',
                        background: gameRunning ? '#E8112D' : '#22C55E',
                        color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900,
                        boxShadow: gameRunning ? '0 6px 20px rgba(232,17,45,0.5)' : '0 6px 20px rgba(34,197,94,0.4)',
                    }}>
                        {gameRunning
                            ? <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="5" height="14" rx="1.5"/><rect x="10" y="1" width="5" height="14" rx="1.5"/></svg>
                            : <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1l11 7-11 7z"/></svg>
                        }
                    </button>

                    {/* Shot clock + resets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => onResetShotClock(24)} className="ac-press" style={{
                                flex: 1, padding: '7px 8px', borderRadius: 10, cursor: 'pointer',
                                background: shotClock <= 5 ? 'rgba(232,17,45,0.15)' : 'var(--surface-elevated)',
                                border: `0.5px solid ${shotClock <= 5 ? '#E8112D' : 'var(--border-subtle)'}`,
                                color: shotClock <= 5 ? '#E8112D' : 'var(--text-primary)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                            }}>
                                <span style={{ fontSize: 20, fontWeight: 900, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>{shotClock}</span>
                                <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 800, opacity: 0.7 }}>24s</span>
                            </button>
                            <button onClick={() => onResetShotClock(14)} className="ac-press" style={{
                                flex: 1, padding: '7px 8px', borderRadius: 10, cursor: 'pointer',
                                background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                            }}>
                                <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>14</span>
                                <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 800, opacity: 0.7 }}>RESET</span>
                            </button>
                        </div>
                        <button onClick={onTogglePossession} className="ac-press" style={{
                            padding: '5px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                            background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)',
                            color: possession === 'A' ? teamAColor : teamBColor,
                        }}>
                            POSS: {possession === 'A' ? shortName(teamAName) : shortName(teamBName)} {possession === 'A' ? '→' : '←'}
                        </button>
                    </div>
                </div>

                {/* Scoring + Stats */}
                <div style={{ ...arcCard, padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {/* Action context */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 10, letterSpacing: 1.2, fontWeight: 800, color: 'var(--text-tertiary)' }}>
                            ACTION{' '}
                            <span style={{
                                padding: '2px 8px', borderRadius: 100, fontSize: 9, fontWeight: 900,
                                background: `${teamColor(activeSide)}18`, color: teamColor(activeSide),
                                border: `0.5px solid ${teamColor(activeSide)}40`,
                            }}>
                                {activeSide === 'A' ? shortName(teamAName) : shortName(teamBName)}
                                {activePlayer ? ` #${activePlayer.number}` : ''}
                            </span>
                        </div>
                        {activeEv && attribution.step === 'court' && (
                            <div style={{
                                padding: '3px 10px', borderRadius: 100, background: `${ac}15`, color: ac,
                                fontSize: 9, fontWeight: 800, letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6,
                                animation: 'acPulse 1.5s infinite',
                            }}>
                                ► TAP COURT FOR {activeEv.made ? `+${activeEv.points}` : `MISS ${activeEv.points}`}
                                <button onClick={attribution.dismiss} title="Record without details" style={{ background: 'transparent', border: 'none', color: ac, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                            </div>
                        )}
                        {/* Team toggle */}
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => setActiveSide('A')} className="ac-press" style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                background: activeSide === 'A' ? `${teamAColor}20` : 'var(--surface-elevated)',
                                border: `0.5px solid ${activeSide === 'A' ? teamAColor : 'var(--border-subtle)'}`,
                                color: activeSide === 'A' ? teamAColor : 'var(--text-tertiary)',
                            }}>{shortName(teamAName)}</button>
                            <button onClick={() => setActiveSide('B')} className="ac-press" style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                background: activeSide === 'B' ? `${teamBColor}20` : 'var(--surface-elevated)',
                                border: `0.5px solid ${activeSide === 'B' ? teamBColor : 'var(--border-subtle)'}`,
                                color: activeSide === 'B' ? teamBColor : 'var(--text-tertiary)',
                            }}>{shortName(teamBName)}</button>
                        </div>
                    </div>

                    {/* Scoring buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                        {/* +1 FT */}
                        <button onClick={() => handleMade(activeSide, 1, 'free_throw')} className="ac-press" style={arcScoreBtn('#22C55E', false)}>
                            <span style={{ fontSize: 22, fontWeight: 900 }}>+1</span>
                            <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 800, opacity: 0.85 }}>FT MADE</span>
                        </button>
                        {/* +2 */}
                        <button onClick={() => handleMade(activeSide, 2, 'field_goal')} className="ac-press"
                            style={arcScoreBtn(teamColor(activeSide), activeEv?.points === 2 && activeEv.made && activeEv.team === activeSide)}>
                            <span style={{ fontSize: 26, fontWeight: 900 }}>+2</span>
                            <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 800, opacity: 0.85 }}>TWO</span>
                        </button>
                        {/* +3 */}
                        <button onClick={() => handleMade(activeSide, 3, 'field_goal')} className="ac-press"
                            style={arcScoreBtn(teamColor(activeSide), activeEv?.points === 3 && activeEv.made && activeEv.team === activeSide)}>
                            <span style={{ fontSize: 26, fontWeight: 900 }}>+3</span>
                            <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 800, opacity: 0.85 }}>THREE</span>
                        </button>
                        {/* FT Miss */}
                        <button onClick={() => handleMissFT(activeSide)} className="ac-press" style={arcMissBtn}>
                            <span style={{ fontSize: 14, fontWeight: 900 }}>FT</span>
                            <span style={{ fontSize: 9, letterSpacing: 1, fontWeight: 800, color: '#EF4444' }}>MISS</span>
                        </button>
                        {/* FG Miss */}
                        <button onClick={() => handleMiss(activeSide, 2)} className="ac-press"
                            style={{ ...arcMissBtn, borderColor: (activeEv && !activeEv.made && activeEv.team === activeSide) ? '#EF4444' : 'rgba(239,68,68,0.3)' }}>
                            <span style={{ fontSize: 14, fontWeight: 900 }}>FG</span>
                            <span style={{ fontSize: 9, letterSpacing: 1, fontWeight: 800, color: '#EF4444' }}>MISS</span>
                        </button>
                    </div>

                    {/* Stat buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                        {([
                            ['REB', 'rebound'], ['AST', 'assist'], ['STL', 'steal'],
                            ['BLK', 'block'], ['TO', 'turnover', '#F59E0B'], ['FOUL', 'foul', '#EF4444'],
                        ] as [string, GameActionType, string?][]).map(([label, action, clr]) => (
                            <button key={action} onClick={() => { onSecondaryAction(activeSide, action); if (action === 'foul') analytics.registerFoul(activeSide); }} className="ac-press" style={{
                                height: 34, borderRadius: 9, cursor: 'pointer',
                                background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)',
                                fontSize: 9, fontWeight: 800, letterSpacing: 1, color: clr || 'var(--text-primary)',
                            }}>{label}</button>
                        ))}
                    </div>
                </div>

                {/* Period + Util */}
                <div style={{ ...arcCard, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button onClick={onNextPeriod} className="ac-press" style={{
                        ...arcUtilBtn, gridColumn: '1 / -1',
                        background: 'rgba(232,17,45,0.1)', color: '#E8112D', border: '0.5px solid rgba(232,17,45,0.4)',
                    }}>
                        <span style={{ fontSize: 13, fontWeight: 900 }}>END {qLabel(period)}</span>
                        <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 700, opacity: 0.7 }}>NEXT</span>
                    </button>
                    {onUndo && (
                        <button onClick={onUndo} className="ac-press" style={arcUtilBtn}>
                            <span style={{ fontSize: 13, fontWeight: 900 }}>↶ UNDO</span>
                        </button>
                    )}
                    <button onClick={() => setFeedOpen(v => !v)} className="ac-press" style={{
                        ...arcUtilBtn,
                        background: feedOpen ? 'rgba(139,92,246,0.12)' : 'var(--surface-elevated)',
                        color: feedOpen ? '#a78bfa' : 'var(--text-secondary)',
                        border: `0.5px solid ${feedOpen ? 'rgba(139,92,246,0.4)' : 'var(--border-subtle)'}`,
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}>≡ FEED</span>
                    </button>
                    <button onClick={() => onSecondaryAction('A', 'timeout')} className="ac-press" style={arcUtilBtn}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: teamAColor }}>{shortName(teamAName)} TO</span>
                        <span style={{ fontSize: 8, opacity: 0.6, fontFamily: '"JetBrains Mono", monospace' }}>{teamATimeouts} left</span>
                    </button>
                    <button onClick={() => onSecondaryAction('B', 'timeout')} className="ac-press" style={arcUtilBtn}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: teamBColor }}>{shortName(teamBName)} TO</span>
                        <span style={{ fontSize: 8, opacity: 0.6, fontFamily: '"JetBrains Mono", monospace' }}>{teamBTimeouts} left</span>
                    </button>
                    {onCast && (
                        <button onClick={onCast} className="ac-press" style={arcUtilBtn}>
                            <span style={{ fontSize: 10, fontWeight: 900 }}>⬡ CAST</span>
                        </button>
                    )}
                    {onExport && (
                        <button onClick={onExport} className="ac-press" style={arcUtilBtn}>
                            <span style={{ fontSize: 10, fontWeight: 900 }}>↑ EXPORT</span>
                        </button>
                    )}
                    {onEndGame && (
                        <button onClick={onEndGame} className="ac-press" style={{
                            ...arcUtilBtn, gridColumn: '1 / -1',
                            background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '0.5px solid rgba(239,68,68,0.3)',
                        }}>
                            <span style={{ fontSize: 10, fontWeight: 900 }}>END GAME</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ═══ OVERLAYS & MODALS ═══ */}

            {/* Player stats drawer */}
            {showStats && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,9,14,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setShowStats(null)} />
                    <div style={{
                        position: 'relative', width: 420,
                        background: 'var(--surface-primary)', borderRight: '0.5px solid var(--border-subtle)',
                        overflowY: 'auto', padding: 18,
                        animation: 'acStatsSlide 0.2s ease-out',
                        boxShadow: '12px 0 32px rgba(0,0,0,0.4)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, color: teamColor(showStats), margin: 0, textTransform: 'uppercase' }}>
                                {showStats === 'A' ? teamAName : teamBName} — Stats
                            </h3>
                            <button onClick={() => setShowStats(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                        </div>
                        {/* Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(7, auto)', gap: 6, padding: '0 8px 8px', borderBottom: '0.5px solid var(--border-subtle)', fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                            <span style={{ textAlign: 'left' }}>Player</span>
                            <span>PTS</span><span>FG</span><span>FG%</span><span>3P</span><span>3P%</span><span>FT</span><span>FT%</span>
                        </div>
                        {(showStats === 'A' ? pA : pB).map(p => {
                            const s = (showStats === 'A' ? playerStatsA : playerStatsB).get(p.id);
                            if (!s) return null;
                            const fgPct = s.fga > 0 ? Math.round((s.fgm / s.fga) * 100) : 0;
                            const tpPct = s.threePa > 0 ? Math.round((s.threePm / s.threePa) * 100) : 0;
                            const ftPct = s.fta > 0 ? Math.round((s.ftm / s.fta) * 100) : 0;
                            return (
                                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(7, auto)', gap: 6, padding: '8px', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'center', fontSize: 12, textAlign: 'center' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left' }}>#{p.number} {p.name}</span>
                                    <span style={{ fontWeight: 900, color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>{s.pts}</span>
                                    <span style={{ color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{s.fgm}/{s.fga}</span>
                                    <span style={{ color: fgPct >= 45 ? '#22C55E' : fgPct >= 30 ? '#F59E0B' : '#EF4444', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{s.fga > 0 ? `${fgPct}%` : '—'}</span>
                                    <span style={{ color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{s.threePm}/{s.threePa}</span>
                                    <span style={{ color: tpPct >= 35 ? '#22C55E' : tpPct >= 25 ? '#F59E0B' : s.threePa > 0 ? '#EF4444' : 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{s.threePa > 0 ? `${tpPct}%` : '—'}</span>
                                    <span style={{ color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{s.ftm}/{s.fta}</span>
                                    <span style={{ color: ftPct >= 75 ? '#22C55E' : ftPct >= 50 ? '#F59E0B' : s.fta > 0 ? '#EF4444' : 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{s.fta > 0 ? `${ftPct}%` : '—'}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Play-by-play feed */}
            {feedOpen && (
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, zIndex: 40, animation: 'acFeedSlide 0.2s ease-out', display: 'flex', flexDirection: 'column', background: 'var(--surface-primary)', borderLeft: '0.5px solid var(--border-subtle)', boxShadow: '-12px 0 32px rgba(0,0,0,0.4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: 700, color: 'var(--text-secondary)' }}>PLAY BY PLAY</div>
                        <button onClick={() => setFeedOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                    </div>
                    <div className="ac-no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                        {eventLog.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Events will appear as the game progresses.</div>
                        ) : eventLog.map((e, i) => (
                            <div key={i} style={{
                                padding: '8px 12px', borderRadius: 8, marginBottom: 4, fontSize: 12,
                                background: e.startsWith('+') ? 'rgba(34,197,94,0.05)' : 'transparent',
                                borderLeft: e.startsWith('+') ? '2px solid #22C55E' : e.startsWith('MISS') ? '2px solid var(--border-subtle)' : '2px solid #E8112D',
                                color: 'var(--text-primary)',
                            }}>{e}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* Court-first: operator names the team (never geometry-guessed) */}
            {teamAsk && (
                <div
                    onClick={() => setTeamAsk(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(4,6,10,0.55)', backdropFilter: 'blur(2px)',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            ...arcCard, padding: '18px 20px', minWidth: 340,
                            display: 'flex', flexDirection: 'column', gap: 14,
                            animation: 'acRibbonSlide 0.18s ease-out',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: 'var(--text-primary)' }}>
                                WHO SCORED?
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 0.6 }}>
                                {(ZONES[teamAsk.zone as ShotZoneId]?.label ?? teamAsk.zone).toUpperCase()} · +{teamAsk.zone.startsWith('three_') ? 3 : 2}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            {(['A', 'B'] as const).map(sd => {
                                const c = sd === 'A' ? teamAColor : teamBColor;
                                const nm = sd === 'A' ? teamAName : teamBName;
                                return (
                                    <button key={sd} onClick={() => commitTeamAsk(sd)} className="ac-press" style={{
                                        flex: 1, padding: '14px 10px', borderRadius: 12, cursor: 'pointer',
                                        fontSize: 13, fontWeight: 900, letterSpacing: 0.8, color: '#fff',
                                        background: `linear-gradient(180deg, ${c}, ${c}CC)`,
                                        border: `0.5px solid ${c}`,
                                        boxShadow: `0 4px 18px ${c}30`,
                                    }}>{shortName(nm)}</button>
                                );
                            })}
                        </div>
                        <button onClick={() => setTeamAsk(null)} className="ac-press" style={{
                            padding: '7px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)', color: 'var(--text-tertiary)',
                        }}>CANCEL — accidental tap</button>
                    </div>
                </div>
            )}

            {showJumpBall && (
                <JumpBallModal
                    teamAName={teamAName} teamAColor={teamAColor} teamAPlayers={pA}
                    teamBName={teamBName} teamBColor={teamBColor} teamBPlayers={pB}
                    onComplete={(result) => { console.log('Jump ball won by team', result.winner); setShowJumpBall(false); }}
                    onSkip={() => setShowJumpBall(false)}
                />
            )}

            {showSubPanel && (
                <SubstitutionPanel
                    teamSide={showSubPanel}
                    teamName={showSubPanel === 'A' ? teamAName : teamBName}
                    teamColor={showSubPanel === 'A' ? teamAColor : teamBColor}
                    allPlayers={showSubPanel === 'A' ? pA : pB}
                    activePlayerIds={(showSubPanel === 'A' ? pA : pB).slice(0, 5).map(p => p.id)}
                    onConfirm={(activeIds) => { console.log('Updated roster', showSubPanel, activeIds); setShowSubPanel(null); }}
                    onCancel={() => setShowSubPanel(null)}
                />
            )}

            <PredictiveFollowup
                followup={analytics.followup}
                onResolve={(p) => {
                    if (analytics.followup) {
                        onSecondaryAction(p.teamSide, analytics.followup.kind === 'assist' ? 'assist' : 'rebound');
                    }
                    analytics.resolveFollowup();
                }}
                onSkip={analytics.skipFollowup}
            />
        </div>
    );
};

// ── Style constants ───────────────────────────────────────────────────────────

function arcScoreBtn(color: string, active: boolean): React.CSSProperties {
    return {
        height: 68, borderRadius: 14, cursor: 'pointer', border: 'none',
        background: active ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'var(--surface-elevated)',
        color: active ? '#FFF' : 'var(--text-primary)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        boxShadow: active ? `0 6px 20px ${color}55` : '0 2px 8px rgba(0,0,0,0.3)',
    };
}

const arcMissBtn: React.CSSProperties = {
    height: 68, borderRadius: 14, cursor: 'pointer',
    background: 'var(--surface-elevated)', border: '0.5px solid rgba(239,68,68,0.3)',
    color: 'var(--text-primary)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

const arcUtilBtn: React.CSSProperties = {
    borderRadius: 10, border: '0.5px solid var(--border-subtle)', cursor: 'pointer',
    background: 'var(--surface-elevated)', color: 'var(--text-primary)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    padding: 6, fontFamily: 'Inter, sans-serif', minHeight: 44,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS — Arcade Design
// ═══════════════════════════════════════════════════════════════════════════════

const ArcTeamHeader: React.FC<{
    side: 'left' | 'right'; name: string; color: string; score: number;
    fouls: number; timeouts: number; possession: 'A' | 'B'; onStats: () => void; onBack?: () => void;
}> = ({ side, name, color, score, fouls, timeouts, possession, onStats }) => {
    const teamId = side === 'left' ? 'A' : 'B';
    const hasPoss = possession === teamId;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
            {/* Badge */}
            {side === 'left' && (
                <div style={{
                    width: 56, height: 56, borderRadius: 13, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: hasPoss ? color : 'var(--surface-elevated)',
                    color: hasPoss ? '#FFF' : color,
                    border: `1.5px solid ${color}`,
                    fontWeight: 900, fontSize: 18, letterSpacing: -0.5,
                    boxShadow: hasPoss ? `0 0 22px ${color}44` : 'none',
                    transition: 'all 0.3s',
                }}>{shortName(name)}</div>
            )}
            <div style={{ textAlign: side === 'right' ? 'right' : 'left' }}>
                <div style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: 800, color: color, marginBottom: 2 }}>{name}</div>
                <div style={{
                    fontWeight: 900, fontSize: 58, lineHeight: 1, letterSpacing: -2,
                    fontFamily: '"JetBrains Mono", monospace',
                    color: hasPoss ? color : 'var(--text-primary)',
                    textShadow: hasPoss ? `0 0 28px ${color}55` : 'none',
                    transition: 'color 0.3s, text-shadow 0.3s',
                }}>{score}</div>
                <div style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: 'var(--text-tertiary)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: side === 'right' ? 'flex-end' : 'flex-start', marginTop: 2 }}>
                    <span style={{ color: fouls >= 4 ? '#EF4444' : 'inherit' }}>FOULS {fouls}</span>
                    <span>·</span>
                    <span>TO {timeouts}</span>
                    <button onClick={onStats} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex', alignItems: 'center' }} title="Player stats">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
                    </button>
                </div>
            </div>
            {side === 'right' && (
                <div style={{
                    width: 56, height: 56, borderRadius: 13, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: hasPoss ? color : 'var(--surface-elevated)',
                    color: hasPoss ? '#FFF' : color,
                    border: `1.5px solid ${color}`,
                    fontWeight: 900, fontSize: 18, letterSpacing: -0.5,
                    boxShadow: hasPoss ? `0 0 22px ${color}44` : 'none',
                    transition: 'all 0.3s',
                }}>{shortName(name)}</div>
            )}
        </div>
    );
};

const ArcRoster: React.FC<{
    side: 'A' | 'B'; color: string; name: string; players: Player[];
    selId: string | null; onSelect: (id: string | null) => void; onSub: () => void;
    playerStats: Map<string, { pts: number; fgm: number; fga: number; threePm: number; threePa: number; ftm: number; fta: number; reb: number; ast: number }>;
    isActiveSide: boolean;
}> = ({ side, color, name, players, selId, onSelect, onSub, playerStats, isActiveSide }) => {
    return (
        <div style={{
            ...arcCard, padding: 10,
            display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, letterSpacing: 1.4, fontWeight: 800, color: isActiveSide ? color : 'var(--text-tertiary)' }}>
                    {shortName(name)} · ON COURT
                </span>
                <button onClick={onSub} style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, cursor: 'pointer',
                    background: 'rgba(245,158,11,0.1)', border: '0.5px solid rgba(245,158,11,0.3)', color: '#F59E0B',
                }}>SUB</button>
            </div>

            {/* Players */}
            <div className="ac-no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {players.map(p => {
                    const stats = playerStats.get(p.id);
                    const sel = selId === p.id;
                    return (
                        <button key={p.id} onClick={() => onSelect(sel ? null : p.id)} className="ac-press" style={{
                            display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'center', gap: 7,
                            padding: 8, borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                            background: sel ? `linear-gradient(135deg, ${color}28, ${color}10)` : 'var(--surface-elevated)',
                            border: `0.5px solid ${sel ? color : 'transparent'}`,
                            color: 'var(--text-primary)', width: '100%',
                        }}>
                            {/* Jersey badge */}
                            <div style={{
                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                background: sel ? color : 'var(--bg-primary, #07090E)',
                                color: sel ? '#FFF' : color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, fontSize: 13,
                            }}>{p.number || '?'}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}>
                                    {p.position || '—'} · {stats?.reb ?? 0}r {stats?.ast ?? 0}a
                                </div>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: sel ? color : 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
                                {stats?.pts ?? 0}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AdvancedConsole;
