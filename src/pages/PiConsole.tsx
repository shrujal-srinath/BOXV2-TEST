// src/pages/PiConsole.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — PiConsole: touch-first 1024×600 scoring console.
//
// Shares the same engine + DB as the website (useGameEngine + usePersistEngine +
// useSupabaseBroadcast timer + shot_events via shotService). This is purely a
// touch-optimised presentation layer — no hover, fingertip-sized targets.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { subscribeToGame } from '../services/supabaseGameService';
import { createShotEvent, createGameAction, subscribeToShots } from '../services/shotService';
import { useGameEngine } from '../core/engine/useGameEngine';
import { usePersistEngine } from '../hooks/usePersistEngine';
import { useSupabaseBroadcast } from '../hooks/useSupabaseBroadcast';
import { SPORT_REGISTRY } from '../sports/registry';
import { useConsoleAnalytics } from '../hooks/useConsoleAnalytics';

import { AdvancedCourtHex } from '../components/shotchart/AdvancedCourtHex';
import type { CourtTheme, HoverInfo } from '../components/shotchart/AdvancedCourtHex';
import { COURT } from '../components/shotchart/courtZones';
import type { ShotEvent, ShotZoneId, ShotType, GameActionType } from '../components/shotchart/types/shotTypes';
import { classifyZone } from '../components/shotchart/courtZones';
import type { Player } from '../types';

import { AndOnePopup } from '../components/scoring/AndOnePopup';
import { QEndBanner } from '../components/scoring/QEndBanner';
import { PredictiveFollowup } from '../components/scoring/PredictiveFollowup';
import { PiScoreboard } from '../components/pi/PiScoreboard';
import { PiPlayerRail } from '../components/pi/PiPlayerRail';
import { PiActionRail } from '../components/pi/PiActionRail';
import type { PendingKind } from '../components/pi/PiActionRail';
import { PiOpsBar } from '../components/pi/PiOpsBar';
import { PiBenchDrawer } from '../components/pi/PiBenchDrawer';
import { PiCourtHUD } from '../components/pi/PiCourtHUD';

const BARLOW = '"Barlow Condensed", system-ui, sans-serif';
const qLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);

interface Pending { side: 'A' | 'B'; points: 1 | 2 | 3; made: boolean; shotType: ShotType; playerId: string | null; playerName: string | null; }

export default function PiConsole() {
    const { gameCode } = useParams<{ gameCode: string }>();

    // ── Data layer (mirrors HostConsole's basketball wiring) ──────────────────
    const [dbGame, setDbGame] = useState<any>(null);
    useEffect(() => {
        if (!gameCode) return;
        return subscribeToGame(gameCode, (data) => { if (data) setDbGame(data); });
    }, [gameCode]);

    const manifest = SPORT_REGISTRY['basketball'];
    const engineInitialState = dbGame ? {
        scoreA: dbGame.teamA?.score ?? 0, scoreB: dbGame.teamB?.score ?? 0,
        foulsA: dbGame.teamA?.fouls ?? 0, foulsB: dbGame.teamB?.fouls ?? 0,
        timeoutsA: dbGame.teamA?.timeouts ?? 0, timeoutsB: dbGame.teamB?.timeouts ?? 0,
        possession: dbGame.gameState?.possession ?? 'A',
    } : manifest.createInitialState(manifest.rules);

    const { state, dispatch } = useGameEngine(
        gameCode || '',
        { ...(dbGame || {}), rules: manifest.rules, state: engineInitialState, code: gameCode },
        manifest,
        true,
    );
    usePersistEngine(gameCode || null, dbGame, state, !!dbGame && !!gameCode);

    const timer = useSupabaseBroadcast({
        gameCode: gameCode || '', isHost: true,
        periodDuration: dbGame?.settings?.periodDuration ?? 10,
        shotClockDuration: dbGame?.settings?.shotClockDuration ?? 24,
    });

    const teamA = dbGame?.teamA ?? {};
    const teamB = dbGame?.teamB ?? {};
    const teamAColor = teamA.color || '#E8112D';
    const teamBColor = teamB.color || '#3B82F6';
    const teamAName = teamA.name || 'TEAM A';
    const teamBName = teamB.name || 'TEAM B';
    const pA: Player[] = useMemo(() => (teamA.players || []).filter((p: Player) => p.name), [teamA.players]);
    const pB: Player[] = useMemo(() => (teamB.players || []).filter((p: Player) => p.name), [teamB.players]);

    const updateScore = (team: 'A' | 'B', value: number) => dispatch({ type: 'ADD_POINTS', team, amount: value });
    const updateFouls = (team: 'A' | 'B') => dispatch({ type: 'ADD_FOUL', team });
    const updateTimeouts = (team: 'A' | 'B') => dispatch({ type: 'USE_TIMEOUT', team });
    const togglePossession = () => dispatch({ type: 'SET_POSSESSION', team: state.possession === 'A' ? 'B' : 'A' });

    // ── Shot events ───────────────────────────────────────────────────────────
    const [gameShotEvents, setGameShotEvents] = useState<ShotEvent[]>([]);
    useEffect(() => {
        if (!gameCode) return;
        return subscribeToShots(gameCode, setGameShotEvents);
    }, [gameCode]);

    const recordShot = useCallback(async (shot: {
        teamSide: 'A' | 'B'; playerId: string | null; points: 1 | 2 | 3; made: boolean;
        shotType: ShotType; x: number | null; y: number | null; zone: ShotZoneId;
    }) => {
        if (!gameCode) return;
        await createShotEvent({
            gameCode, playerId: shot.playerId, teamSide: shot.teamSide,
            x: shot.x, y: shot.y, zone: shot.zone, made: shot.made, points: shot.points,
            shotType: shot.shotType, period: timer.period,
            gameClockSec: timer.minutes * 60 + timer.seconds,
            shotClockSec: timer.shotClock, attributes: [],
        });
    }, [gameCode, timer]);

    const secondaryAction = useCallback(async (team: 'A' | 'B', action: GameActionType) => {
        if (action === 'foul') { updateFouls(team); if (timer.gameRunning) timer.stopClock(); }
        else if (action === 'timeout') { updateTimeouts(team); if (timer.gameRunning) timer.stopClock(); }
        if (!gameCode) return;
        await createGameAction({
            gameCode, playerId: null, teamSide: team, actionType: action,
            period: timer.period, gameClockSec: timer.minutes * 60 + timer.seconds,
        });
    }, [gameCode, timer]);

    // ── Console analytics (And-1 / Q-end / predictive) ────────────────────────
    const analytics = useConsoleAnalytics({
        period: timer.period, minutes: timer.minutes, seconds: timer.seconds,
        possession: state.possession, teamAPlayers: pA, teamBPlayers: pB, teamAColor, teamBColor,
    });

    // ── UI / interaction state ────────────────────────────────────────────────
    const [activeSide, setActiveSide] = useState<'A' | 'B'>('A');
    const [selA, setSelA] = useState<string | null>(null);
    const [selB, setSelB] = useState<string | null>(null);
    const [pending, setPending] = useState<Pending | null>(null);
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
    const [benchSide, setBenchSide] = useState<'A' | 'B' | null>(null);
    const [feedOpen, setFeedOpen] = useState(false);
    const [eventLog, setEventLog] = useState<string[]>([]);
    const [timeoutPicker, setTimeoutPicker] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const [courtTheme, setCourtTheme] = useState<CourtTheme>(() => (localStorage.getItem('boxv2-console-theme') as CourtTheme) || 'dark');
    const [hexRadius, setHexRadius] = useState<number>(() => parseFloat(localStorage.getItem('boxv2-console-hex') || '1.9'));
    const [showZoneHL, setShowZoneHL] = useState<boolean>(() => localStorage.getItem('boxv2-console-zone') !== 'false');
    const [showLineToRim, setShowLineToRim] = useState<boolean>(() => localStorage.getItem('boxv2-console-line') === 'true');
    const [showHeatmap, setShowHeatmap] = useState<boolean>(() => localStorage.getItem('boxv2-console-heat') === 'false');
    const [fullCourt, setFullCourt] = useState<boolean>(() => localStorage.getItem('boxv2-console-full') === 'false');

    useEffect(() => { localStorage.setItem('boxv2-console-theme', courtTheme); }, [courtTheme]);
    useEffect(() => { localStorage.setItem('boxv2-console-hex', hexRadius.toString()); }, [hexRadius]);
    useEffect(() => { localStorage.setItem('boxv2-console-zone', showZoneHL.toString()); }, [showZoneHL]);
    useEffect(() => { localStorage.setItem('boxv2-console-line', showLineToRim.toString()); }, [showLineToRim]);
    useEffect(() => { localStorage.setItem('boxv2-console-heat', showHeatmap.toString()); }, [showHeatmap]);
    useEffect(() => { localStorage.setItem('boxv2-console-full', fullCourt.toString()); }, [fullCourt]);

    const [pendingShotType, setPendingShotType] = useState<string>('JUMPER');

    const activeColor = activeSide === 'A' ? teamAColor : teamBColor;
    const activeSel = activeSide === 'A' ? selA : selB;
    const activePlayers = activeSide === 'A' ? pA : pB;
    const nameOf = (id: string | null) => activePlayers.find(p => p.id === id)?.name ?? null;
    const log = (m: string) => setEventLog(prev => [m, ...prev].slice(0, 60));

    const pendingKind: PendingKind = pending
        ? (!pending.made ? 'miss' : pending.points === 3 ? 'made3' : 'made2')
        : null;

    const courtShots = useMemo(
        () => gameShotEvents.filter(s => s.zone !== 'unlocated').map(s => ({ id: s.id, x: s.x, y: s.y, made: s.made, points: s.points as 1 | 2 | 3 })),
        [gameShotEvents],
    );

    // ── Scoring flow ──────────────────────────────────────────────────────────
    const armFG = (points: 2 | 3, made: boolean) => {
        const pid = activeSel;
        if (made) updateScore(activeSide, points);
        setPending({ side: activeSide, points, made, shotType: 'field_goal', playerId: pid, playerName: nameOf(pid) });
        log(`${made ? `+${points}` : `MISS ${points}`} ${activeSide === 'A' ? teamAName : teamBName}`);
    };
    const ftMade = () => {
        const pid = activeSel;
        updateScore(activeSide, 1);
        void recordShot({ teamSide: activeSide, playerId: pid, points: 1, made: true, shotType: 'free_throw', x: 50, y: COURT.paintTop, zone: 'mid_top' });
        log(`+1 FT ${activeSide === 'A' ? teamAName : teamBName}`);
    };

    const onCourtTap = useCallback((x: number, y: number) => {
        if (!pending) return;
        const zone = classifyZone(x, y);
        void recordShot({ teamSide: pending.side, playerId: pending.playerId, points: pending.points, made: pending.made, shotType: pendingShotType as ShotType, x, y, zone });
        if (pending.made) analytics.registerMade(pending.side, pending.playerId, pending.playerName);
        analytics.triggerFollowup({ team: pending.side, made: pending.made, shooterPlayerId: pending.playerId });
        setPending(null);
    }, [pending, pendingShotType, recordShot, analytics]);

    const onFoul = () => { void secondaryAction(activeSide, 'foul'); analytics.registerFoul(activeSide); log(`FOUL ${activeSide === 'A' ? teamAName : teamBName}`); };
    const onTo = () => { void secondaryAction(activeSide, 'turnover'); log(`TO ${activeSide === 'A' ? teamAName : teamBName}`); };

    // ── Wake lock + viewport lock + no-select (Pi ergonomics) ─────────────────
    useEffect(() => {
        let lock: any = null;
        (async () => { try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* unsupported */ } })();
        const meta = document.querySelector('meta[name="viewport"]');
        const prev = meta?.getAttribute('content') ?? null;
        meta?.setAttribute('content', 'width=1024, initial-scale=1, user-scalable=no');
        return () => {
            try { lock?.release?.(); } catch { /* noop */ }
            if (meta && prev !== null) meta.setAttribute('content', prev);
        };
    }, []);

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#07090E', color: '#F0F4FF',
            fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase',
            display: 'grid', gridTemplateRows: '60px 1fr 60px', overflow: 'hidden',
            userSelect: 'none', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        }}>
            <PiScoreboard
                teamAName={teamAName} teamAColor={teamAColor} teamAScore={state.scoreA} teamAFouls={state.foulsA} teamATimeouts={state.timeoutsA}
                teamBName={teamBName} teamBColor={teamBColor} teamBScore={state.scoreB} teamBFouls={state.foulsB} teamBTimeouts={state.timeoutsB}
                period={timer.period} minutes={timer.minutes} seconds={timer.seconds} shotClock={timer.shotClock}
                gameRunning={timer.gameRunning} possession={state.possession}
                onToggleClock={() => timer.toggleClock()} onTogglePossession={togglePossession}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 96px', minHeight: 0 }}>
                {/* Left rail — active team roster + A/B toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid #1B2640' }}>
                    <div style={{ display: 'flex', gap: 4, padding: 6 }}>
                        {(['A', 'B'] as const).map(s => (
                            <button key={s} onClick={() => setActiveSide(s)} style={{
                                flex: 1, height: 28, borderRadius: 8, cursor: 'pointer', fontFamily: BARLOW, fontStyle: 'italic', fontWeight: 800, fontSize: 12,
                                background: activeSide === s ? `${s === 'A' ? teamAColor : teamBColor}22` : '#152032',
                                border: `1px solid ${activeSide === s ? (s === 'A' ? teamAColor : teamBColor) : '#1B2640'}`,
                                color: activeSide === s ? (s === 'A' ? teamAColor : teamBColor) : '#5E6B7D',
                            }}>{s === 'A' ? teamAName.slice(0, 3) : teamBName.slice(0, 3)}</button>
                        ))}
                    </div>
                    <PiPlayerRail
                        color={activeColor} players={activePlayers} selId={activeSel} period={timer.period}
                        onSelect={(id) => { if (activeSide === 'A') setSelA(id); else setSelB(id); }}
                        onSub={() => setBenchSide(activeSide)}
                    />
                </div>

                {/* Court */}
                <div style={{ position: 'relative', minHeight: 0 }}>
                    <AdvancedCourtHex
                        shots={courtShots}
                        onCourtTap={onCourtTap}
                        onHoverChange={setHoverInfo}
                        interactive={!!pending}
                        activeColor={activeColor}
                        activeEdge={pending ? pending.side : null}
                        pendingInfo={pending ? { made: pending.made, points: pending.points } : null}
                        courtTheme={courtTheme}
                        showZoneHL={showZoneHL}
                        showHeatmap={showHeatmap}
                        showLineToRim={showLineToRim}
                        fullCourt={fullCourt}
                        hexRadius={hexRadius}
                        touchMode
                    />
                    <PiCourtHUD
                        hoverZone={hoverInfo?.zone ?? null}
                        distM={hoverInfo?.dist?.meters ?? null}
                        distFt={hoverInfo?.dist?.feet ?? null}
                        pendingShotType={pendingShotType}
                        onShotTypeChange={setPendingShotType}
                    />
                    {analytics.qEndBanner && (
                        <QEndBanner periodLabel={qLabel(timer.period)} nextLabel={qLabel(timer.period + 1)}
                            onAdvance={() => { analytics.dismissQEnd(); timer.nextPeriod(); }} onDismiss={analytics.dismissQEnd} />
                    )}
                    {analytics.andOneOffer?.foulLogged && (
                        <AndOnePopup
                            offer={analytics.andOneOffer}
                            onMade={() => { const o = analytics.andOneOffer!; updateScore(o.team, 1); void recordShot({ teamSide: o.team, playerId: o.playerId, points: 1, made: true, shotType: 'free_throw', x: 50, y: COURT.paintTop, zone: 'mid_top' }); analytics.clearAndOne(); }}
                            onMiss={() => { const o = analytics.andOneOffer!; void recordShot({ teamSide: o.team, playerId: o.playerId, points: 1, made: false, shotType: 'free_throw', x: 50, y: COURT.paintTop, zone: 'mid_top' }); analytics.clearAndOne(); }}
                            onDismiss={analytics.clearAndOne}
                        />
                    )}
                </div>

                {/* Action rail */}
                <div style={{ borderLeft: '1px solid #1B2640' }}>
                    <PiActionRail
                        color={activeColor} pending={pendingKind}
                        onFt={ftMade} onTwo={() => armFG(2, true)} onThree={() => armFG(3, true)}
                        onMiss={() => armFG(pending?.points === 3 ? 3 : 2, false)}
                        onFoul={onFoul} onTo={onTo}
                    />
                </div>
            </div>

            <PiOpsBar
                period={timer.period}
                onUndo={() => { /* engine undo not exposed on broadcast timer; no-op placeholder */ }}
                onEndQ={() => { analytics.dismissQEnd(); timer.nextPeriod(); }}
                onTimeout={() => setTimeoutPicker(true)}
                onFeed={() => setFeedOpen(true)}
                onSettings={() => setShowSettings(true)}
            />

            {/* Predictive followup (touch-sized) */}
            <PredictiveFollowup
                followup={analytics.followup} touchMode
                onResolve={(p) => { if (analytics.followup) void secondaryAction(p.teamSide, analytics.followup.kind === 'assist' ? 'assist' : 'rebound'); analytics.resolveFollowup(); }}
                onSkip={analytics.skipFollowup}
            />

            {/* Bench drawer */}
            <PiBenchDrawer
                open={benchSide !== null}
                teamName={benchSide === 'B' ? teamBName : teamAName}
                color={benchSide === 'B' ? teamBColor : teamAColor}
                players={benchSide === 'B' ? pB : pA}
                onConfirm={(outId, inId) => { void secondaryAction(benchSide || 'A', 'substitution'); log(`SUB ${outId.slice(0, 4)}→${inId.slice(0, 4)}`); }}
                onClose={() => setBenchSide(null)}
            />

            {/* Timeout team picker */}
            {timeoutPicker && (
                <div onClick={() => setTimeoutPicker(false)} style={{ position: 'absolute', inset: 0, zIndex: 75, background: 'rgba(7,9,14,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    {(['A', 'B'] as const).map(s => (
                        <button key={s} onClick={(e) => { e.stopPropagation(); void secondaryAction(s, 'timeout'); setTimeoutPicker(false); }} style={{
                            minWidth: 200, height: 96, borderRadius: 16, cursor: 'pointer', fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase', fontWeight: 800, fontSize: 22,
                            background: `${s === 'A' ? teamAColor : teamBColor}22`, border: `2px solid ${s === 'A' ? teamAColor : teamBColor}`, color: s === 'A' ? teamAColor : teamBColor,
                        }}>{s === 'A' ? teamAName : teamBName}<div style={{ fontSize: 12, color: '#8D97AA' }}>Timeout</div></button>
                    ))}
                </div>
            )}

            {/* Feed */}
            {feedOpen && (
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, zIndex: 78, background: '#0D1320', borderLeft: '1px solid #1B2640', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #1B2640' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#8D97AA', letterSpacing: 1.4 }}>Play by Play</span>
                        <button onClick={() => setFeedOpen(false)} style={{ width: 44, height: 44, background: 'transparent', border: 'none', color: '#8D97AA', fontSize: 22, cursor: 'pointer' }}>×</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                        {eventLog.length === 0
                            ? <div style={{ padding: 24, textAlign: 'center', color: '#5E6B7D', fontSize: 13 }}>Events appear as the game progresses.</div>
                            : eventLog.map((e, i) => <div key={i} style={{ padding: '8px 12px', fontSize: 14, color: '#F0F4FF' }}>{e}</div>)}
                    </div>
                </div>
            )}

            {/* Settings */}
            {showSettings && (
                <div onClick={() => setShowSettings(false)} style={{ position: 'absolute', inset: 0, zIndex: 78, background: 'rgba(7,9,14,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: '#0D1320', border: '1px solid #2B3E5A', borderRadius: 16, padding: 20, minWidth: 400 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#F0F4FF', letterSpacing: 1 }}>COURT SETTINGS</div>
                            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#8D97AA', cursor: 'pointer', fontSize: 20 }}>×</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <div style={{ fontSize: 13, color: '#8D97AA', marginBottom: 6 }}>COURT THEME</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {([['dark', 'VOID'], ['wooden', 'HARDWOOD'], ['white', 'BLUEPRINT']] as [CourtTheme, string][]).map(([v, l]) => (
                                        <button key={v} onClick={() => setCourtTheme(v)} style={{
                                            flex: 1, height: 40, borderRadius: 8, cursor: 'pointer', fontFamily: BARLOW, fontStyle: 'italic', fontWeight: 800, fontSize: 13,
                                            background: courtTheme === v ? 'rgba(34,197,94,0.18)' : '#152032',
                                            border: `1px solid ${courtTheme === v ? '#22C55E' : '#1B2640'}`, color: courtTheme === v ? '#4ADE80' : '#8D97AA',
                                        }}>{l}</button>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                <div style={{ fontSize: 13, color: '#8D97AA', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                                    <span>HEX SIZE</span>
                                    <span>{hexRadius.toFixed(1)}</span>
                                </div>
                                <input type="range" min="1.0" max="3.5" step="0.1" value={hexRadius} onChange={e => setHexRadius(parseFloat(e.target.value))} style={{ width: '100%' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button onClick={() => setShowZoneHL(p => !p)} style={{
                                    height: 40, borderRadius: 8, cursor: 'pointer', fontFamily: BARLOW, fontStyle: 'italic', fontWeight: 800, fontSize: 13,
                                    background: showZoneHL ? 'rgba(34,197,94,0.18)' : '#152032', border: `1px solid ${showZoneHL ? '#22C55E' : '#1B2640'}`, color: showZoneHL ? '#4ADE80' : '#8D97AA',
                                }}>ZONE HIGHLIGHTS</button>
                                <button onClick={() => setShowHeatmap(p => !p)} style={{
                                    height: 40, borderRadius: 8, cursor: 'pointer', fontFamily: BARLOW, fontStyle: 'italic', fontWeight: 800, fontSize: 13,
                                    background: showHeatmap ? 'rgba(34,197,94,0.18)' : '#152032', border: `1px solid ${showHeatmap ? '#22C55E' : '#1B2640'}`, color: showHeatmap ? '#4ADE80' : '#8D97AA',
                                }}>HEATMAP TINT</button>
                                <button onClick={() => setShowLineToRim(p => !p)} style={{
                                    height: 40, borderRadius: 8, cursor: 'pointer', fontFamily: BARLOW, fontStyle: 'italic', fontWeight: 800, fontSize: 13,
                                    background: showLineToRim ? 'rgba(34,197,94,0.18)' : '#152032', border: `1px solid ${showLineToRim ? '#22C55E' : '#1B2640'}`, color: showLineToRim ? '#4ADE80' : '#8D97AA',
                                }}>LINE TO RIM</button>
                                <button onClick={() => setFullCourt(p => !p)} style={{
                                    height: 40, borderRadius: 8, cursor: 'pointer', fontFamily: BARLOW, fontStyle: 'italic', fontWeight: 800, fontSize: 13,
                                    background: fullCourt ? 'rgba(34,197,94,0.18)' : '#152032', border: `1px solid ${fullCourt ? '#22C55E' : '#1B2640'}`, color: fullCourt ? '#4ADE80' : '#8D97AA',
                                }}>FULL COURT</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
