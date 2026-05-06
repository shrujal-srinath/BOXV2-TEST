// src/components/shotchart/AdvancedConsole.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Advanced Console v4: Arcade Design Language
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AdvancedCourtHex } from './AdvancedCourtHex';
import type { CourtTheme } from './AdvancedCourtHex';
import { classifyZone, SHOT_ATTRIBUTES, COURT } from './courtZones';
import type {
    ShotEvent, ShotAttribute, ShotZoneId, ShotType, GameActionType,
} from './types/shotTypes';
import type { Player } from '../../types';
import { TimedPlayerPopup } from './TimedPlayerPopup';
import { JumpBallModal } from './JumpBallModal';
import { SubstitutionPanel } from './SubstitutionPanel';

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
    onShotRecorded: (shot: { teamSide: 'A' | 'B'; playerId: string | null; points: 1 | 2 | 3; made: boolean; shotType: ShotType; x: number | null; y: number | null; zone: ShotZoneId; attributes: ShotAttribute[] }) => void;
    onSecondaryAction: (team: 'A' | 'B', action: GameActionType) => void;
    onToggleClock: () => void; onNextPeriod: () => void;
    onResetShotClock: (v: number) => void; onTogglePossession: () => void;
    existingShots: ShotEvent[];
    gameName?: string; gameCode?: string;
    onUndo?: () => void; onCast?: () => void; onExport?: () => void;
    onEndGame?: () => void; onBack?: () => void;
    hwMode?: 'web' | 'hardware'; isWebLocked?: boolean;
}

interface PendingShot { teamSide: 'A' | 'B'; points: 1 | 2 | 3; made: boolean; shotType: ShotType; playerId: string | null; playerName: string | null; }
interface ConfirmedDot { id: string; x: number; y: number; made: boolean; points: 1 | 2 | 3; zone: ShotZoneId; ts: number; }

const fmt = (n: number) => n.toString().padStart(2, '0');
const qLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);
const shortName = (name: string) => name.slice(0, 3).toUpperCase();

function computeZoneHeat(shots: ShotEvent[]) {
    const m = new Map<ShotZoneId, { fgm: number; fga: number; pct: number }>();
    for (const s of shots) {
        if (s.zone === 'unlocated') continue;
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
    const [pending, setPending] = useState<PendingShot | null>(null);
    const [dots, setDots] = useState<ConfirmedDot[]>([]);
    const [attrs, setAttrs] = useState<ShotAttribute[]>([]);
    const [heatMap, setHeatMap] = useState(false);
    const [lastAct, setLastAct] = useState('');
    const [eventLog, setEventLog] = useState<string[]>([]);
    const [showStats, setShowStats] = useState<'A' | 'B' | null>(null);
    const [feedOpen, setFeedOpen] = useState(false);
    const pendRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [courtTheme, setCourtTheme] = useState<CourtTheme>('dark');
    const [hexOpacity, setHexOpacity] = useState(0);
    const [showZoneHL, setShowZoneHL] = useState(true);
    const [fullCourt, setFullCourt] = useState(false);
    const [hexRadius, setHexRadius] = useState(1.9);
    const [showCourtSettings, setShowCourtSettings] = useState(false);

    const [deferredShot, setDeferredShot] = useState<{
        x: number; y: number; zone: string;
        points: 1 | 2 | 3; shotType: string; teamSide: 'A' | 'B';
    } | null>(null);
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

    // ── Pending auto-cancel ──
    useEffect(() => {
        if (pending) {
            if (pendRef.current) clearTimeout(pendRef.current);
            pendRef.current = setTimeout(() => finalize(null, null, 'unlocated'), 10000);
        }
        return () => { if (pendRef.current) clearTimeout(pendRef.current); };
    }, [pending]);

    // ── Shot flow ──
    const getSel = (s: 'A' | 'B') => s === 'A' ? selA : selB;
    const getName = (s: 'A' | 'B', id: string | null) => { if (!id) return null; return (s === 'A' ? pA : pB).find(p => p.id === id)?.name || null; };
    const getNum = (id: string | null) => { if (!id) return ''; return pA.concat(pB).find(p => p.id === id)?.number || '?'; };

    const logEvent = (msg: string) => {
        setLastAct(msg);
        setEventLog(prev => [msg, ...prev].slice(0, 50));
    };

    const finalize = useCallback((x: number | null, y: number | null, zone: ShotZoneId) => {
        if (!pending) return;
        if (pendRef.current) clearTimeout(pendRef.current);
        if (x !== null && y !== null && zone !== 'unlocated') {
            const d: ConfirmedDot = { id: `d-${Date.now()}`, x, y, made: pending.made, points: pending.points, zone, ts: Date.now() };
            setDots(prev => [...prev.slice(-30), d]);
            setTimeout(() => setDots(prev => prev.filter(dd => dd.id !== d.id)), 15000);
        }
        onShotRecorded({ teamSide: pending.teamSide, playerId: pending.playerId, points: pending.points, made: pending.made, shotType: pending.shotType, x, y, zone, attributes: attrs });
        setPending(null); setAttrs([]);
    }, [pending, attrs, onShotRecorded]);

    const handleMade = useCallback((side: 'A' | 'B', pts: 1 | 2 | 3, st: ShotType) => {
        if (isWebLocked) return;
        if (pending) finalize(null, null, 'unlocated');
        onScoreChange(side, pts);
        const pid = getSel(side); const pn = getName(side, pid);
        const shot: PendingShot = { teamSide: side, points: pts, made: true, shotType: st, playerId: pid, playerName: pn };
        if (st === 'free_throw') {
            onShotRecorded({ teamSide: side, playerId: pid, points: 1, made: true, shotType: st, x: 50, y: COURT.paintTop, zone: 'mid_top', attributes: attrs });
            setAttrs([]);
        } else {
            setPending(shot);
        }
        logEvent(`+${pts} ${side === 'A' ? teamAName : teamBName}${getNum(pid) ? ` #${getNum(pid)}` : ''}`);
    }, [isWebLocked, pending, selA, selB, pA, pB, onScoreChange, onShotRecorded, attrs, teamAName, teamBName]);

    const handleMiss = useCallback((side: 'A' | 'B', pts: 2 | 3, st: ShotType) => {
        if (isWebLocked) return;
        if (pending) finalize(null, null, 'unlocated');
        const pid = getSel(side);
        setPending({ teamSide: side, points: pts, made: false, shotType: st, playerId: pid, playerName: getName(side, pid) });
        logEvent(`MISS ${pts}PT ${side === 'A' ? teamAName : teamBName}`);
    }, [isWebLocked, pending, selA, selB, pA, pB, teamAName, teamBName]);

    const handleMissFT = useCallback((side: 'A' | 'B') => {
        if (isWebLocked) return;
        if (pending) finalize(null, null, 'unlocated');
        const pid = getSel(side);
        onShotRecorded({ teamSide: side, playerId: pid, points: 1, made: false, shotType: 'free_throw', x: 50, y: COURT.paintTop, zone: 'mid_top', attributes: attrs });
        setAttrs([]);
        logEvent(`MISS FT ${side === 'A' ? teamAName : teamBName}`);
    }, [isWebLocked, pending, selA, selB, pA, pB, onShotRecorded, attrs, teamAName, teamBName]);

    const handleCourtTap = useCallback((x: number, y: number) => {
        const teamSide = x < 50 ? 'A' : 'B';
        const selectedPlayer = teamSide === 'A' ? selA : selB;

        if (!selectedPlayer && !pending) {
            const zone = classifyZone(x, y);
            let points: 1 | 2 | 3 = 2;
            if (zone.includes('three') || zone.includes('corner')) points = 3;
            setDeferredShot({ x, y, zone, points, shotType: 'field_goal', teamSide });
            return;
        }

        if (!pending) return;
        const zone = classifyZone(x, y);
        finalize(x, y, zone);
    }, [pending, finalize, selA, selB]);

    // ── Keyboard ──
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.code === 'Space') { e.preventDefault(); onToggleClock(); }
            if (e.key === 'r' || e.key === 'R') onResetShotClock(e.shiftKey ? 14 : 24);
            if (e.key === 'p' || e.key === 'P') onTogglePossession();
            if (e.key === 'n' || e.key === 'N') onNextPeriod();
            if (e.key === 'Escape') { if (deferredShot) setDeferredShot(null); else if (showStats) setShowStats(null); else if (feedOpen) setFeedOpen(false); else if (pending) { setPending(null); setAttrs([]); } }
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && onUndo) onUndo();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onToggleClock, onResetShotClock, onTogglePossession, onNextPeriod, pending, onUndo, showStats, deferredShot, feedOpen]);

    const ac = pending?.teamSide === 'A' ? teamAColor : pending?.teamSide === 'B' ? teamBColor : '#555';

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
                    onSelect={(id) => { setSelA(id); setActiveSide('A'); }}
                    onSub={() => setShowSubPanel('A')}
                    playerStats={playerStatsA}
                    isActiveSide={activeSide === 'A'}
                />

                {/* Court card */}
                <div style={{ ...arcCard, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
                    {/* Court header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Active player badge */}
                            <div style={{
                                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                background: activeSelId ? teamColor(activeSide) : 'var(--surface-elevated)',
                                color: activeSelId ? '#FFF' : 'var(--text-tertiary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, fontSize: 15,
                            }}>
                                {activePlayer ? (activePlayer.number || '?') : '—'}
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{activePlayer?.name || 'No player selected'}</div>
                                <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace' }}>
                                    {activeStats ? `${activeStats.pts}pts · ${activeStats.fgm}/${activeStats.fga} FG` : `${activeSide === 'A' ? teamAName : teamBName}`}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setHeatMap(v => !v)} className="ac-press" style={{
                                padding: '5px 10px', borderRadius: 100, cursor: 'pointer', fontSize: 9, fontWeight: 800, letterSpacing: 1,
                                background: heatMap ? 'rgba(232,17,45,0.12)' : 'var(--surface-elevated)',
                                border: `0.5px solid ${heatMap ? '#E8112D' : 'var(--border-subtle)'}`,
                                color: heatMap ? '#E8112D' : 'var(--text-secondary)',
                            }}>HEATMAP</button>
                            <button onClick={onTogglePossession} className="ac-press" style={{
                                padding: '5px 10px', borderRadius: 100, cursor: 'pointer', fontSize: 9, fontWeight: 800, letterSpacing: 1,
                                background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)',
                                color: possession === 'A' ? teamAColor : teamBColor,
                            }}>
                                POSS · {possession === 'A' ? shortName(teamAName) : shortName(teamBName)} {possession === 'A' ? '→' : '←'}
                            </button>
                            <button onClick={() => setShowCourtSettings(v => !v)} className="ac-press" style={{
                                padding: '5px 8px', borderRadius: 100, cursor: 'pointer', fontSize: 9, fontWeight: 800,
                                background: showCourtSettings ? 'rgba(139,92,246,0.15)' : 'var(--surface-elevated)',
                                border: `0.5px solid ${showCourtSettings ? 'rgba(139,92,246,0.5)' : 'var(--border-subtle)'}`,
                                color: showCourtSettings ? '#a78bfa' : 'var(--text-secondary)',
                            }}>⚙</button>
                        </div>
                    </div>

                    {/* Court settings (collapsible) */}
                    {showCourtSettings && (
                        <div style={{
                            display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
                            padding: '8px 10px', borderRadius: 10,
                            background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)', flexShrink: 0,
                            animation: 'acRibbonSlide 0.15s ease-out',
                        }}>
                            {/* Theme */}
                            {(['dark', 'wooden', 'white'] as CourtTheme[]).map(t => (
                                <button key={t} onClick={() => setCourtTheme(t)} className="ac-press" style={{
                                    padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 800, letterSpacing: 1, cursor: 'pointer',
                                    background: courtTheme === t ? 'rgba(139,92,246,0.2)' : 'transparent',
                                    border: `0.5px solid ${courtTheme === t ? 'rgba(139,92,246,0.5)' : 'var(--border-subtle)'}`,
                                    color: courtTheme === t ? '#a78bfa' : 'var(--text-tertiary)',
                                }}>{t === 'wooden' ? 'Wood' : t[0].toUpperCase() + t.slice(1)}</button>
                            ))}
                            <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
                            <button onClick={() => setFullCourt(false)} className="ac-press" style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                background: !fullCourt ? 'rgba(139,92,246,0.2)' : 'transparent',
                                border: `0.5px solid ${!fullCourt ? 'rgba(139,92,246,0.5)' : 'var(--border-subtle)'}`,
                                color: !fullCourt ? '#a78bfa' : 'var(--text-tertiary)',
                            }}>Half</button>
                            <button onClick={() => setFullCourt(true)} className="ac-press" style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                background: fullCourt ? 'rgba(139,92,246,0.2)' : 'transparent',
                                border: `0.5px solid ${fullCourt ? 'rgba(139,92,246,0.5)' : 'var(--border-subtle)'}`,
                                color: fullCourt ? '#a78bfa' : 'var(--text-tertiary)',
                            }}>Full</button>
                            <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
                            <button onClick={() => setShowZoneHL(v => !v)} className="ac-press" style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                background: showZoneHL ? 'rgba(139,92,246,0.2)' : 'transparent',
                                border: `0.5px solid ${showZoneHL ? 'rgba(139,92,246,0.5)' : 'var(--border-subtle)'}`,
                                color: showZoneHL ? '#a78bfa' : 'var(--text-tertiary)',
                            }}>Zones</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700 }}>HEX</span>
                                <input type="range" min="0.8" max="3.0" step="0.1" value={hexRadius}
                                    onChange={e => setHexRadius(Number(e.target.value))}
                                    style={{ width: 60, cursor: 'pointer', accentColor: '#a78bfa', height: 2 }} />
                                <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-tertiary)' }}>{hexRadius.toFixed(1)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700 }}>GRID</span>
                                <input type="range" min="0" max="100" value={Math.round(hexOpacity * 100)}
                                    onChange={e => setHexOpacity(Number(e.target.value) / 100)}
                                    style={{ width: 60, cursor: 'pointer', accentColor: '#a78bfa', height: 2 }} />
                            </div>
                        </div>
                    )}

                    {/* Pending indicator */}
                    {pending && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                            borderRadius: 10, background: `${ac}15`, border: `0.5px solid ${ac}40`,
                            animation: 'acPulse 1.5s infinite', flexShrink: 0,
                        }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ac, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: ac, letterSpacing: 0.5 }}>
                                {pending.made ? `+${pending.points}PT` : `MISS ${pending.points}PT`}
                                {pending.playerName ? ` — ${pending.playerName}` : ''} — TAP COURT
                            </span>
                            <button onClick={() => finalize(null, null, 'unlocated')} className="ac-press" style={{
                                marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                background: 'var(--surface-elevated)', border: '0.5px solid var(--border-subtle)', color: 'var(--text-secondary)',
                            }}>Skip</button>
                        </div>
                    )}

                    {/* Court */}
                    <div style={{
                        flex: 1, position: 'relative', borderRadius: 12, overflow: 'hidden', minHeight: 0,
                        boxShadow: pending ? `0 0 30px ${ac}18` : 'none',
                        border: `0.5px solid ${pending ? `${ac}50` : 'var(--border-subtle)'}`,
                        transition: 'box-shadow 0.3s, border-color 0.3s',
                    }}>
                        <AdvancedCourtHex
                            shots={courtDots}
                            zoneOverlays={heatMap ? zoneOverlays : undefined}
                            onCourtTap={handleCourtTap}
                            interactive={!!pending}
                            activeColor={ac}
                            activeEdge={pending ? pending.teamSide : null}
                            pendingInfo={pending ? { made: pending.made, points: pending.points } : null}
                            courtTheme={courtTheme}
                            hexOpacity={hexOpacity}
                            showZoneHL={showZoneHL}
                            fullCourt={fullCourt}
                            hexRadius={hexRadius}
                        />
                    </div>

                    {/* Attribute ribbon */}
                    {pending && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0, animation: 'acRibbonSlide 0.2s ease-out' }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', alignSelf: 'center', marginRight: 2 }}>Tags</span>
                            {SHOT_ATTRIBUTES.map(a => {
                                const on = attrs.includes(a.id);
                                return (
                                    <button key={a.id} onClick={() => setAttrs(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])}
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
                    onSelect={(id) => { setSelB(id); setActiveSide('B'); }}
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
                        {pending && (
                            <div style={{
                                padding: '3px 10px', borderRadius: 100, background: `${ac}15`, color: ac,
                                fontSize: 9, fontWeight: 800, letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6,
                                animation: 'acPulse 1.5s infinite',
                            }}>
                                ► TAP COURT FOR {pending.made ? `+${pending.points}` : `MISS ${pending.points}`}
                                <button onClick={() => { setPending(null); setAttrs([]); }} style={{ background: 'transparent', border: 'none', color: ac, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
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
                            style={arcScoreBtn(teamColor(activeSide), pending?.points === 2 && pending.made && pending.teamSide === activeSide)}>
                            <span style={{ fontSize: 26, fontWeight: 900 }}>+2</span>
                            <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 800, opacity: 0.85 }}>TWO</span>
                        </button>
                        {/* +3 */}
                        <button onClick={() => handleMade(activeSide, 3, 'field_goal')} className="ac-press"
                            style={arcScoreBtn(teamColor(activeSide), pending?.points === 3 && pending.made && pending.teamSide === activeSide)}>
                            <span style={{ fontSize: 26, fontWeight: 900 }}>+3</span>
                            <span style={{ fontSize: 8, letterSpacing: 1, fontWeight: 800, opacity: 0.85 }}>THREE</span>
                        </button>
                        {/* FT Miss */}
                        <button onClick={() => handleMissFT(activeSide)} className="ac-press" style={arcMissBtn}>
                            <span style={{ fontSize: 14, fontWeight: 900 }}>FT</span>
                            <span style={{ fontSize: 9, letterSpacing: 1, fontWeight: 800, color: '#EF4444' }}>MISS</span>
                        </button>
                        {/* FG Miss */}
                        <button onClick={() => handleMiss(activeSide, 2, 'field_goal')} className="ac-press"
                            style={{ ...arcMissBtn, borderColor: (!pending?.made && pending?.teamSide === activeSide) ? '#EF4444' : 'rgba(239,68,68,0.3)' }}>
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
                            <button key={action} onClick={() => onSecondaryAction(activeSide, action)} className="ac-press" style={{
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

            {/* Deferred attribution */}
            {deferredShot && (
                <TimedPlayerPopup
                    shotInfo={deferredShot as any}
                    players={deferredShot.teamSide === 'A' ? pA : pB}
                    teamColor={deferredShot.teamSide === 'A' ? teamAColor : teamBColor}
                    onSelectPlayer={(playerId) => {
                        onShotRecorded({ teamSide: deferredShot.teamSide, playerId, points: deferredShot.points, made: true, shotType: deferredShot.shotType as ShotType, x: deferredShot.x, y: deferredShot.y, zone: deferredShot.zone as ShotZoneId, attributes: [] });
                        onScoreChange(deferredShot.teamSide, deferredShot.points);
                        setDeferredShot(null);
                    }}
                    onSkip={() => {
                        onShotRecorded({ teamSide: deferredShot.teamSide, playerId: null, points: deferredShot.points, made: true, shotType: deferredShot.shotType as ShotType, x: deferredShot.x, y: deferredShot.y, zone: deferredShot.zone as ShotZoneId, attributes: [] });
                        onScoreChange(deferredShot.teamSide, deferredShot.points);
                        setDeferredShot(null);
                    }}
                    onCancel={() => setDeferredShot(null)}
                />
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
