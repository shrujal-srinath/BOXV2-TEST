// src/components/shotchart/AdvancedConsole.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Advanced Console v3: Industrial Design Language
//
// Design rules matched to existing codebase:
//   - TactileBtn pattern: bg-zinc-900, border-zinc-800, borderBottom: 3px team color
//   - AdminBtn pattern: bg-black, border, label+value, danger/warning colors
//   - Font: Barlow Condensed italic bold for display, monospace for numbers
//   - NO colored button backgrounds — dark surfaces + colored accents only
//   - active:scale-95 on everything
//   - text-[9px] font-bold uppercase tracking-widest for all labels
//   - "A piece of hardware that happens to run in a browser"
//
// v3 changes:
//   - Top bar taller (76px) with all clock controls
//   - Bottom bar taller (52px) with Cast, Export, Share, End Game
//   - Player stats drawer (slide-out from sidebar)
//   - Buttons use TactileBtn style (dark bg + bottom color border)
//   - Shot dots fade out over 15s after placement
//   - FT auto-finalizes at FT line (no court tap needed)
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
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800&family=Barlow:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
@keyframes acPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
@keyframes acRibbonSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes acStatsSlide { from{transform:translateX(-100%)} to{transform:translateX(0)} }
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

// Compute per-player stats from shot events
function computePlayerStats(shots: ShotEvent[], players: Player[]) {
    const stats = new Map<string, { pts: number; fgm: number; fga: number; threePm: number; threePa: number; ftm: number; fta: number }>();
    for (const p of players) {
        stats.set(p.id, { pts: 0, fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0 });
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
    const [pending, setPending] = useState<PendingShot | null>(null);
    const [dots, setDots] = useState<ConfirmedDot[]>([]);
    const [attrs, setAttrs] = useState<ShotAttribute[]>([]);
    const [heatMap, setHeatMap] = useState(false);
    const [lastAct, setLastAct] = useState('');
    const [showStats, setShowStats] = useState<'A' | 'B' | null>(null);
    const pendRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Court graphics settings ──
    const [courtTheme, setCourtTheme] = useState<CourtTheme>('dark');
    const [hexOpacity, setHexOpacity] = useState(0);
    const [showZoneHL, setShowZoneHL] = useState(true);
    const [fullCourt, setFullCourt] = useState(false);
    const [hexRadius, setHexRadius] = useState(1.9);

    // ── New component state ──
    const [deferredShot, setDeferredShot] = useState<{
        x: number; y: number; zone: string;
        points: 1 | 2 | 3; shotType: string; teamSide: 'A' | 'B';
    } | null>(null);
    const [showJumpBall, setShowJumpBall] = useState(() => {
        return period === 1 && !gameRunning;
    });
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
            // FT: auto-finalize at FT line
            onShotRecorded({ teamSide: side, playerId: pid, points: 1, made: true, shotType: st, x: 50, y: COURT.paintTop, zone: 'mid_top', attributes: attrs });
            setAttrs([]);
        } else {
            setPending(shot);
        }
        setLastAct(`+${pts} ${side === 'A' ? teamAName : teamBName}${getNum(pid) ? ` #${getNum(pid)}` : ''}`);
    }, [isWebLocked, pending, selA, selB, pA, pB, onScoreChange, onShotRecorded, attrs, teamAName, teamBName]);

    const handleMiss = useCallback((side: 'A' | 'B', pts: 2 | 3, st: ShotType) => {
        if (isWebLocked) return;
        if (pending) finalize(null, null, 'unlocated');
        const pid = getSel(side);
        setPending({ teamSide: side, points: pts, made: false, shotType: st, playerId: pid, playerName: getName(side, pid) });
        setLastAct(`MISS ${pts}PT ${side === 'A' ? teamAName : teamBName}`);
    }, [isWebLocked, pending, selA, selB, pA, pB, teamAName, teamBName]);

    const handleMissFT = useCallback((side: 'A' | 'B') => {
        if (isWebLocked) return;
        if (pending) finalize(null, null, 'unlocated');
        const pid = getSel(side);
        onShotRecorded({ teamSide: side, playerId: pid, points: 1, made: false, shotType: 'free_throw', x: 50, y: COURT.paintTop, zone: 'mid_top', attributes: attrs });
        setAttrs([]);
        setLastAct(`MISS FT ${side === 'A' ? teamAName : teamBName}`);
    }, [isWebLocked, pending, selA, selB, pA, pB, onShotRecorded, attrs, teamAName, teamBName]);

    const handleCourtTap = useCallback((x: number, y: number) => {
        // Deferred attribution: if no player selected and no pending shot, show popup
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
        let fx = x, fy = y, zone = classifyZone(x, y);
        finalize(fx, fy, zone);
    }, [pending, finalize, selA, selB]);

    // ── Keyboard ──
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.code === 'Space') { e.preventDefault(); onToggleClock(); }
            if (e.key === 'r' || e.key === 'R') onResetShotClock(e.shiftKey ? 14 : 24);
            if (e.key === 'p' || e.key === 'P') onTogglePossession();
            if (e.key === 'n' || e.key === 'N') onNextPeriod();
            if (e.key === 'Escape') { if (deferredShot) setDeferredShot(null); else if (showStats) setShowStats(null); else if (pending) { setPending(null); setAttrs([]); } }
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && onUndo) onUndo();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onToggleClock, onResetShotClock, onTogglePossession, onNextPeriod, pending, onUndo, showStats]);

    const ac = pending?.teamSide === 'A' ? teamAColor : pending?.teamSide === 'B' ? teamBColor : '#555';

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════════════════

    return (
        <div className="h-screen flex flex-col bg-black overflow-hidden select-none" style={{ fontFamily: '"Barlow", sans-serif' }}>
            <style>{CSS}</style>

            {/* ═══ TOP BAR — 76px ═══ */}
            <div className="shrink-0 bg-black border-b-2 border-zinc-800 px-3 z-50" style={{ height: 76 }}>
                <div className="h-full max-w-[2000px] mx-auto flex items-center gap-3">
                    {/* Back */}
                    {onBack && (
                        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-500 text-zinc-500 hover:text-white transition-all active:scale-95 shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                    )}

                    {/* Team A score block */}
                    <TeamScoreBlock side="A" name={teamAName} color={teamAColor} score={teamAScore} fouls={teamAFouls} timeouts={teamATimeouts} possession={possession} onStatsClick={() => setShowStats(showStats === 'A' ? null : 'A')} />

                    {/* ── CENTER CLOCK CLUSTER ── */}
                    <div className="flex-1 flex items-center justify-center gap-3">
                        <ClockBtn label="24" onClick={() => onResetShotClock(24)} />
                        <ClockBtn label="14" onClick={() => onResetShotClock(14)} />

                        {/* Main clock */}
                        <button onClick={onToggleClock}
                            className="flex items-center gap-3 px-5 py-2.5 rounded-lg border-2 transition-all active:scale-95"
                            style={{
                                background: gameRunning ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.02)',
                                borderColor: gameRunning ? 'rgba(220,38,38,0.35)' : 'rgba(255,255,255,0.1)',
                                borderBottom: gameRunning ? '3px solid rgba(220,38,38,0.6)' : '3px solid rgba(255,255,255,0.08)',
                            }}>
                            <span className="text-4xl font-bold tabular-nums text-white leading-none" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                                {fmt(minutes)}:{fmt(seconds)}
                            </span>
                            {gameRunning
                                ? <svg width="14" height="18" viewBox="0 0 14 18" fill="#EF4444"><rect x="0" y="0" width="4.5" height="18" rx="1.5" /><rect x="9.5" y="0" width="4.5" height="18" rx="1.5" /></svg>
                                : <svg width="14" height="18" viewBox="0 0 14 18" fill="#22C55E"><path d="M0 0L14 9L0 18Z" /></svg>
                            }
                        </button>

                        {/* Period + Shot clock */}
                        <div className="flex flex-col items-center gap-1">
                            <button onClick={onNextPeriod} className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-500 text-sm font-black italic text-white uppercase tracking-wider transition-all active:scale-95" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                                {qLabel(period)}
                            </button>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Shot</span>
                                <span className="text-xl font-bold tabular-nums leading-none" style={{
                                    fontFamily: '"JetBrains Mono", monospace',
                                    color: shotClock <= 5 ? '#EF4444' : shotClock <= 10 ? '#FBBF24' : '#a1a1aa',
                                }}>{shotClock}</span>
                            </div>
                        </div>

                        {/* Possession */}
                        <button onClick={onTogglePossession} className="px-3 py-2 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-500 transition-all active:scale-95 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full transition-all" style={{ background: possession === 'A' ? teamAColor : 'transparent', border: `2px solid ${teamAColor}40` }} />
                            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="#555" strokeWidth="1.5"><path d="M1 5H15M12 2l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <div className="w-3 h-3 rounded-full transition-all" style={{ background: possession === 'B' ? teamBColor : 'transparent', border: `2px solid ${teamBColor}40` }} />
                        </button>
                    </div>

                    {/* Team B score block */}
                    <TeamScoreBlock side="B" name={teamBName} color={teamBColor} score={teamBScore} fouls={teamBFouls} timeouts={teamBTimeouts} possession={possession} onStatsClick={() => setShowStats(showStats === 'B' ? null : 'B')} />

                    {gameCode && <span className="text-[9px] font-mono text-zinc-700 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 shrink-0">{gameCode}</span>}
                </div>
            </div>

            {/* ═══ MAIN WORKSPACE ═══ */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">

                {/* Left sidebar */}
                <TeamSidebar side="A" color={teamAColor} name={teamAName} players={pA} selId={selA} setSel={setSelA}
                    onMade={(p, t) => handleMade('A', p, t)} onMiss={(p, t) => handleMiss('A', p, t)} onMissFT={() => handleMissFT('A')}
                    onSec={(a) => onSecondaryAction('A', a)} onSub={() => setShowSubPanel('A')} isPending={pending?.teamSide === 'A'} locked={!!isWebLocked}
                    courtSettings={
                        <div className="mt-auto pt-1 space-y-2">
                            <div className="border-t border-zinc-800" />
                            <div className="flex items-center gap-1.5 px-1">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                                <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Court</span>
                            </div>
                            {/* Theme */}
                            <div className="space-y-1">
                                <span className="text-[8px] text-zinc-700 uppercase tracking-widest px-1">Theme</span>
                                <div className="flex gap-1">
                                    {(['dark', 'wooden', 'white'] as CourtTheme[]).map(t => (
                                        <button key={t} onClick={() => setCourtTheme(t)}
                                            className={`flex-1 py-1 rounded text-[8px] font-bold uppercase tracking-wide transition-all active:scale-95 ${courtTheme === t ? 'bg-violet-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-zinc-300'}`}>
                                            {t === 'wooden' ? 'Wood' : t[0].toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Court view */}
                            <div className="space-y-1">
                                <span className="text-[8px] text-zinc-700 uppercase tracking-widest px-1">View</span>
                                <div className="flex gap-1">
                                    <button onClick={() => setFullCourt(false)}
                                        className={`flex-1 h-7 rounded text-[8px] font-bold uppercase tracking-wide transition-all active:scale-95 ${!fullCourt ? 'bg-violet-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-zinc-300'}`}>
                                        Half
                                    </button>
                                    <button onClick={() => setFullCourt(true)}
                                        className={`flex-1 h-7 rounded text-[8px] font-bold uppercase tracking-wide transition-all active:scale-95 ${fullCourt ? 'bg-violet-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-zinc-300'}`}>
                                        Full
                                    </button>
                                </div>
                            </div>
                            {/* Zones + Heat */}
                            <div className="flex gap-1">
                                <button onClick={() => setShowZoneHL(v => !v)}
                                    className={`flex-1 h-7 rounded text-[8px] font-bold uppercase tracking-wide transition-all active:scale-95 ${showZoneHL ? 'bg-violet-600/20 text-violet-400 border border-violet-700/40' : 'bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}>
                                    Zones
                                </button>
                                <button onClick={() => setHeatMap(v => !v)}
                                    className={`flex-1 h-7 rounded text-[8px] font-bold uppercase tracking-wide transition-all active:scale-95 ${heatMap ? 'bg-orange-600/20 text-orange-400 border border-orange-700/40' : 'bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}>
                                    Heat
                                </button>
                            </div>
                            {/* Hex size */}
                            <div className="space-y-1 px-0.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] text-zinc-700 uppercase tracking-widest">Hex Size</span>
                                    <span className="text-[8px] font-mono text-zinc-500 tabular-nums">{hexRadius.toFixed(1)}</span>
                                </div>
                                <input type="range" min="0.8" max="3.0" step="0.1" value={hexRadius}
                                    onChange={e => setHexRadius(Number(e.target.value))}
                                    className="w-full cursor-pointer accent-violet-500" style={{ height: 2 }}
                                />
                            </div>
                            {/* Grid opacity */}
                            <div className="space-y-1 px-0.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] text-zinc-700 uppercase tracking-widest">Grid</span>
                                    <span className="text-[8px] font-mono text-zinc-500 tabular-nums">{Math.round(hexOpacity * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={Math.round(hexOpacity * 100)}
                                    onChange={e => setHexOpacity(Number(e.target.value) / 100)}
                                    className="w-full cursor-pointer accent-violet-500" style={{ height: 2 }}
                                />
                            </div>
                        </div>
                    }
                />

                {/* Court center */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Pending shot indicator */}
                    {pending && (
                        <div className="shrink-0 flex items-center gap-2 px-4 py-1.5" style={{ animation: 'acPulse 1.5s infinite' }}>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ac }} />
                            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ac, fontFamily: '"Barlow Condensed", sans-serif' }}>
                                {pending.made ? '+' : 'MISS '}{pending.points}PT{pending.playerName ? ` — ${pending.playerName}` : ''} — TAP COURT
                            </span>
                            <button onClick={() => finalize(null, null, 'unlocated')}
                                className="text-[9px] font-bold uppercase text-zinc-500 hover:text-white px-2 py-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-500 rounded transition-all active:scale-95">
                                Skip
                            </button>
                        </div>
                    )}

                    {/* Court */}
                    <div className={`flex-1 relative mx-3 mb-2 rounded-lg overflow-hidden border transition-all duration-300 ${pending ? 'border-zinc-600' : 'border-zinc-800/50'}`}
                        style={{ boxShadow: pending ? `0 0 40px ${ac}10` : 'none' }}>
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
                        <div className="shrink-0 px-4 py-2 flex flex-wrap items-center gap-1.5" style={{ animation: 'acRibbonSlide 0.2s ease-out' }}>
                            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em] mr-1">Tags</span>
                            {SHOT_ATTRIBUTES.map(a => {
                                const on = attrs.includes(a.id);
                                return (
                                    <button key={a.id} onClick={() => setAttrs(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])}
                                        className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider border transition-all active:scale-95
                                            ${on ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-600 border-zinc-800 hover:border-zinc-600 hover:text-zinc-400'}`}
                                        style={{ borderColor: on ? `${ac}50` : undefined }}>{a.label}</button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right sidebar */}
                <TeamSidebar side="B" color={teamBColor} name={teamBName} players={pB} selId={selB} setSel={setSelB}
                    onMade={(p, t) => handleMade('B', p, t)} onMiss={(p, t) => handleMiss('B', p, t)} onMissFT={() => handleMissFT('B')}
                    onSec={(a) => onSecondaryAction('B', a)} onSub={() => setShowSubPanel('B')} isPending={pending?.teamSide === 'B'} locked={!!isWebLocked} />

                {/* ── PLAYER STATS DRAWER ── */}
                {showStats && (
                    <div className="absolute inset-0 z-50 flex">
                        <div className="absolute inset-0 bg-black/60" onClick={() => setShowStats(null)} />
                        <div className="relative w-[400px] bg-zinc-950 border-r border-zinc-800 overflow-y-auto p-4" style={{ animation: 'acStatsSlide 0.2s ease-out' }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black italic uppercase tracking-widest" style={{ color: teamColor(showStats), fontFamily: '"Barlow Condensed", sans-serif' }}>
                                    {showStats === 'A' ? teamAName : teamBName} — Player Stats
                                </h3>
                                <button onClick={() => setShowStats(null)} className="text-zinc-600 hover:text-white text-lg transition-colors">x</button>
                            </div>
                            <div className="space-y-1">
                                {/* Header row */}
                                <div className="grid grid-cols-8 gap-1 text-[8px] font-bold text-zinc-600 uppercase tracking-widest px-2 pb-1 border-b border-zinc-800">
                                    <span className="col-span-2">Player</span>
                                    <span className="text-center">PTS</span>
                                    <span className="text-center">FG</span>
                                    <span className="text-center">FG%</span>
                                    <span className="text-center">3P</span>
                                    <span className="text-center">3P%</span>
                                    <span className="text-center">FT</span>
                                </div>
                                {(showStats === 'A' ? pA : pB).map(p => {
                                    const s = (showStats === 'A' ? playerStatsA : playerStatsB).get(p.id);
                                    if (!s) return null;
                                    const fgPct = s.fga > 0 ? Math.round((s.fgm / s.fga) * 100) : 0;
                                    const tpPct = s.threePa > 0 ? Math.round((s.threePm / s.threePa) * 100) : 0;
                                    return (
                                        <div key={p.id} className="grid grid-cols-8 gap-1 text-xs font-mono px-2 py-1.5 rounded hover:bg-zinc-900 transition-colors">
                                            <span className="col-span-2 font-bold text-white truncate" style={{ fontFamily: '"Barlow", sans-serif' }}>#{p.number} {p.name}</span>
                                            <span className="text-center font-bold text-white">{s.pts}</span>
                                            <span className="text-center text-zinc-400">{s.fgm}/{s.fga}</span>
                                            <span className="text-center" style={{ color: fgPct >= 45 ? '#22C55E' : fgPct >= 30 ? '#FBBF24' : '#EF4444' }}>{fgPct}%</span>
                                            <span className="text-center text-zinc-400">{s.threePm}/{s.threePa}</span>
                                            <span className="text-center" style={{ color: tpPct >= 35 ? '#22C55E' : tpPct >= 25 ? '#FBBF24' : s.threePa > 0 ? '#EF4444' : '#3f3f46' }}>{s.threePa > 0 ? `${tpPct}%` : '-'}</span>
                                            <span className="text-center text-zinc-400">{s.ftm}/{s.fta}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ BOTTOM BAR — 52px ═══ */}
            <div className="shrink-0 bg-black border-t-2 border-zinc-800 px-4 z-50" style={{ height: 52 }}>
                <div className="h-full max-w-[2000px] mx-auto flex items-center justify-between">
                    {/* Left: last action + undo */}
                    <div className="flex items-center gap-3">
                        {lastAct && <span className="text-[10px] text-zinc-600 font-mono tabular-nums">{lastAct}</span>}
                        {onUndo && <BarBtn label="Undo" sub="Ctrl+Z" onClick={onUndo} />}
                    </div>
                    {/* Right: game actions */}
                    <div className="flex items-center gap-2">
                        {onCast && <BarBtn label="Cast" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 16.1A5 5 0 015.9 20M2 12.05A9 9 0 019.95 20M2 8V6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2h-6" /><line x1="2" y1="20" x2="2.01" y2="20" /></svg>} onClick={onCast} />}
                        {onExport && <BarBtn label="Export" onClick={onExport} />}
                        {onEndGame && (
                            <button onClick={onEndGame} className="h-8 px-4 rounded bg-black border border-red-900/40 text-red-800 hover:text-red-500 hover:border-red-700 text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95">End Game</button>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ INTEGRATED MODALS ═══ */}

            {deferredShot && (
                <TimedPlayerPopup
                    shotInfo={deferredShot as any}
                    players={deferredShot.teamSide === 'A' ? pA : pB}
                    teamColor={deferredShot.teamSide === 'A' ? teamAColor : teamBColor}
                    onSelectPlayer={(playerId) => {
                        onShotRecorded({
                            teamSide: deferredShot.teamSide,
                            playerId,
                            points: deferredShot.points,
                            made: true,
                            shotType: deferredShot.shotType as ShotType,
                            x: deferredShot.x,
                            y: deferredShot.y,
                            zone: deferredShot.zone as ShotZoneId,
                            attributes: [],
                        });
                        onScoreChange(deferredShot.teamSide, deferredShot.points);
                        setDeferredShot(null);
                    }}
                    onSkip={() => {
                        onShotRecorded({
                            teamSide: deferredShot.teamSide,
                            playerId: null,
                            points: deferredShot.points,
                            made: true,
                            shotType: deferredShot.shotType as ShotType,
                            x: deferredShot.x,
                            y: deferredShot.y,
                            zone: deferredShot.zone as ShotZoneId,
                            attributes: [],
                        });
                        onScoreChange(deferredShot.teamSide, deferredShot.points);
                        setDeferredShot(null);
                    }}
                    onCancel={() => setDeferredShot(null)}
                />
            )}

            {showJumpBall && (
                <JumpBallModal
                    teamAName={teamAName}
                    teamAColor={teamAColor}
                    teamAPlayers={pA}
                    teamBName={teamBName}
                    teamBColor={teamBColor}
                    teamBPlayers={pB}
                    onComplete={(result) => {
                        console.log('Jump ball won by team', result.winner);
                        setShowJumpBall(false);
                    }}
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
                    onConfirm={(activeIds) => {
                        console.log('Updated roster for team', showSubPanel, activeIds);
                        setShowSubPanel(null);
                    }}
                    onCancel={() => setShowSubPanel(null)}
                />
            )}

        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS — Industrial Design
// ═══════════════════════════════════════════════════════════════════════════════

/* Team score in top bar */
const TeamScoreBlock: React.FC<{ side: 'A' | 'B'; name: string; color: string; score: number; fouls: number; timeouts: number; possession: 'A' | 'B'; onStatsClick: () => void }> = ({ side, name, color, score, fouls, timeouts, possession, onStatsClick }) => {
    const hasPoss = possession === side;
    return (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-all ${side === 'B' ? 'flex-row-reverse' : ''}`}
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: hasPoss ? `${color}30` : 'rgba(255,255,255,0.05)', borderBottom: hasPoss ? `3px solid ${color}` : '3px solid transparent' }}>
            <div className={`flex flex-col ${side === 'B' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[90px]" style={{ color: hasPoss ? color : '#71717a', fontFamily: '"Barlow Condensed", sans-serif' }}>{name}</span>
                <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-bold">
                    <span className={fouls >= 4 ? 'text-red-500' : ''}>F:{fouls}</span>
                    <span>T:{timeouts}</span>
                    <button onClick={onStatsClick} className="text-zinc-700 hover:text-white transition-colors" title="Player stats">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
                    </button>
                </div>
            </div>
            <span className="text-5xl font-black tabular-nums text-white leading-none" style={{ fontFamily: '"Barlow Condensed", sans-serif', fontStyle: 'italic', textShadow: hasPoss ? `0 0 30px ${color}30` : 'none' }}>{score}</span>
        </div>
    );
};

/* Team sidebar — TactileBtn style */
const TeamSidebar: React.FC<{ side: 'A' | 'B'; color: string; name: string; players: Player[]; selId: string | null; setSel: (id: string | null) => void; onMade: (p: 1 | 2 | 3, t: ShotType) => void; onMiss: (p: 2 | 3, t: ShotType) => void; onMissFT: () => void; onSec: (a: GameActionType) => void; onSub: (side: 'A' | 'B') => void; isPending?: boolean; locked: boolean }> = ({ side, color, name, players, selId, setSel, onMade, onMiss, onMissFT, onSec, onSub, isPending, locked }) => (
    <div className={`w-[200px] shrink-0 bg-black ${side === 'A' ? 'border-r' : 'border-l'} border-zinc-800 flex flex-col gap-2 p-2.5 overflow-y-auto`}
        style={{ opacity: locked ? 0.3 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-2 py-1.5" style={{ borderLeft: side === 'A' ? `3px solid ${color}` : 'none', borderRight: side === 'B' ? `3px solid ${color}` : 'none' }}>
            <span className="text-[10px] font-black uppercase tracking-widest truncate" style={{ color, fontFamily: '"Barlow Condensed", sans-serif' }}>{name}</span>
            {isPending && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />}
        </div>

        {/* Player chips */}
        {players.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
                {players.map(p => (
                    <button key={p.id} onClick={() => setSel(p.id === selId ? null : p.id)}
                        className="w-10 h-10 rounded flex items-center justify-center text-sm font-black italic transition-all active:scale-90"
                        style={{
                            fontFamily: '"Barlow Condensed", sans-serif',
                            background: p.id === selId ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                            border: p.id === selId ? `2px solid ${color}` : '1.5px solid rgba(255,255,255,0.06)',
                            borderBottom: p.id === selId ? `3px solid ${color}` : '1.5px solid rgba(255,255,255,0.06)',
                            color: p.id === selId ? '#fff' : 'rgba(255,255,255,0.35)',
                        }} title={p.name}>{p.number || '?'}</button>
                ))}
                <button onClick={() => onSub(side)}
                    className="w-10 h-10 rounded flex items-center justify-center text-[8px] font-bold uppercase tracking-wider text-yellow-500 hover:text-yellow-400 transition-all active:scale-90"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1.5px solid rgba(234,179,8,0.2)' }}
                    title="Substitution">SUB</button>
            </div>
        )}

        {/* MADE — TactileBtn style: dark bg, bottom border accent */}
        <div className="grid grid-cols-3 gap-1.5 mt-1">
            {[{ l: '+1', s: 'FT', p: 1 as const, t: 'free_throw' as ShotType }, { l: '+2', s: null, p: 2 as const, t: 'field_goal' as ShotType }, { l: '+3', s: null, p: 3 as const, t: 'field_goal' as ShotType }].map(b => (
                <button key={b.l} onClick={() => onMade(b.p, b.t)}
                    className="rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-500 transition-all active:scale-95 active:bg-white group relative overflow-hidden"
                    style={{ minHeight: 56, borderBottom: `3px solid ${color}` }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                    <span className="relative z-10 text-xl font-black italic text-white group-active:text-black" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>{b.l}</span>
                    {b.s && <span className="block relative z-10 text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{b.s}</span>}
                </button>
            ))}
        </div>

        {/* MISS — danger style */}
        <div className="grid grid-cols-3 gap-1.5">
            {[{ l: 'X FT', fn: () => onMissFT() }, { l: 'X 2', fn: () => onMiss(2, 'field_goal') }, { l: 'X 3', fn: () => onMiss(3, 'field_goal') }].map((b, i) => (
                <button key={i} onClick={b.fn}
                    className="h-10 rounded bg-black border border-red-900/30 hover:bg-red-900/20 flex items-center justify-center transition-all active:scale-95 group">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-red-500 opacity-70 group-hover:opacity-100" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>{b.l}</span>
                </button>
            ))}
        </div>

        <div className="border-t border-zinc-800 my-1" />

        {/* Secondary — AdminBtn-like */}
        <div className="grid grid-cols-2 gap-1.5">
            {[
                { l: 'Rebound', a: 'rebound' as GameActionType }, { l: 'Assist', a: 'assist' as GameActionType },
                { l: 'Steal', a: 'steal' as GameActionType }, { l: 'Block', a: 'block' as GameActionType },
                { l: 'Turnover', a: 'turnover' as GameActionType },
            ].map(b => (
                <button key={b.a} onClick={() => onSec(b.a)}
                    className="h-9 rounded bg-black border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 active:bg-zinc-800">
                    {b.l}
                </button>
            ))}
            <button onClick={() => onSec('foul')}
                className="h-9 rounded bg-black border border-red-900/30 hover:bg-red-900/20 text-red-500 text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95">
                Foul
            </button>
        </div>
    </div>
);

/* Bottom bar button */
const BarBtn: React.FC<{ label: string; sub?: string; icon?: React.ReactNode; onClick: () => void }> = ({ label, sub, icon, onClick }) => (
    <button onClick={onClick} className="h-8 px-3 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-500 text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-all active:scale-95 flex items-center gap-2">
        {icon}
        <span>{label}</span>
        {sub && <span className="text-zinc-700 text-[8px]">{sub}</span>}
    </button>
);

/* Clock control button */
const ClockBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button onClick={onClick} className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-500 text-sm font-bold text-zinc-400 hover:text-white transition-all active:scale-95 flex items-center justify-center" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        {label}
    </button>
);

export default AdvancedConsole;