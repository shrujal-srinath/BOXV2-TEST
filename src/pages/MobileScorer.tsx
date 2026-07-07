// src/pages/MobileScorer.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Phone Scoring Deck
//
// A portrait, touch-first scorer for the website — what you get when
// you open /host/:gameCode on a phone (mirrors the tactile feel of
// the Pi referee deck). Drives the SAME cloud game as HostConsole:
// it reuses the exact engine wiring (useGameEngine + usePersistEngine
// + useSupabaseBroadcast), so scores/clock broadcast to spectators
// and persist to Supabase identically. Desktop users still get the
// full HostConsole; ScorerHost picks by viewport.
//
// Big, thumb-sized controls: +1/+2/+3, foul, timeout, possession,
// clock start/stop, shot-clock 24/14, next period, undo.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameEngine } from '../core/engine/useGameEngine';
import { SPORT_REGISTRY, isSportSupported } from '../sports/registry';
import { subscribeToGame } from '../services/supabaseGameService';
import { useSupabaseBroadcast } from '../hooks/useSupabaseBroadcast';
import { usePersistEngine } from '../hooks/usePersistEngine';
import { useGenericPersistEngine } from '../hooks/useGenericPersistEngine';
import { finishGame } from '../services/supabaseGameService';

type Side = 'A' | 'B';

interface StateSnap {
    scoreA: number; scoreB: number;
    foulsA: number; foulsB: number;
    timeoutsA: number; timeoutsB: number;
    possession: Side;
}

const hexToRgb = (hex: string): string => {
    try {
        const h = hex.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
        return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    } catch { return '124,124,124'; }
};

const fmtClock = (m: number, s: number) => `${m}:${String(s).padStart(2, '0')}`;

export default function MobileScorer({ onSwitchToDesktop }: { onSwitchToDesktop?: () => void }) {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();

    // ── Engine wiring (mirrors HostConsole) ─────────────────────
    const [dbGame, setDbGame] = useState<any>(null);
    useEffect(() => {
        if (!gameCode) return;
        return subscribeToGame(gameCode, (data) => { if (data) setDbGame(data); });
    }, [gameCode]);

    const sportId = dbGame?.sportId || dbGame?.sport || 'basketball';
    const manifest = isSportSupported(sportId) ? SPORT_REGISTRY[sportId] : SPORT_REGISTRY['basketball'];

    const engineInitialState = dbGame ? (
        sportId !== 'basketball' && dbGame.state
            ? dbGame.state
            : {
                scoreA: dbGame.teamA?.score ?? 0,
                scoreB: dbGame.teamB?.score ?? 0,
                foulsA: dbGame.teamA?.fouls ?? 0,
                foulsB: dbGame.teamB?.fouls ?? 0,
                timeoutsA: dbGame.teamA?.timeouts ?? 0,
                timeoutsB: dbGame.teamB?.timeouts ?? 0,
                possession: dbGame.gameState?.possession ?? 'A',
            }
    ) : manifest.createInitialState(manifest.rules);

    const { state, dispatch, adminPatchState } = useGameEngine(
        gameCode || '',
        { ...(dbGame || {}), rules: manifest.rules, state: engineInitialState, code: gameCode },
        manifest,
        true,
    );

    const isBasketball = sportId === 'basketball';
    usePersistEngine(gameCode || null, dbGame, state, !!dbGame && !!gameCode && isBasketball);
    useGenericPersistEngine(gameCode || null, state, !!dbGame && !!gameCode && !isBasketball);

    const timer = useSupabaseBroadcast({
        gameCode: gameCode || '',
        isHost: true,
        periodDuration: dbGame?.settings?.periodDuration ?? 10,
        shotClockDuration: dbGame?.settings?.shotClockDuration ?? 24,
    });

    // ── Undo via state snapshots (universal — covers score/foul/TO/poss) ──
    const undoStack = useRef<StateSnap[]>([]);
    const snap = (): StateSnap => ({
        scoreA: state.scoreA, scoreB: state.scoreB,
        foulsA: state.foulsA, foulsB: state.foulsB,
        timeoutsA: state.timeoutsA, timeoutsB: state.timeoutsB,
        possession: state.possession,
    });
    const [canUndo, setCanUndo] = useState(false);
    const pushUndo = () => { undoStack.current.push(snap()); setCanUndo(true); };
    const undo = () => {
        const prev = undoStack.current.pop();
        if (prev) adminPatchState(prev as any);
        setCanUndo(undoStack.current.length > 0);
    };

    // ── Actions ─────────────────────────────────────────────────
    const score = (team: Side, pts: number) => {
        pushUndo();
        dispatch({ type: 'ADD_POINTS', team, amount: pts });
    };
    const foul = (team: Side) => {
        pushUndo();
        dispatch({ type: 'ADD_FOUL', team });
        if (timer.gameRunning) timer.stopClock(); // FIBA: stop on foul
    };
    const timeout = (team: Side) => {
        pushUndo();
        dispatch({ type: 'USE_TIMEOUT', team });
        if (timer.gameRunning) timer.stopClock();
    };
    const setPossession = (team: Side) => {
        if (state.possession === team) return;
        pushUndo();
        dispatch({ type: 'SET_POSSESSION', team });
    };

    const [showEnd, setShowEnd] = useState(false);
    const endGame = async () => {
        if (gameCode) await finishGame(gameCode);
        navigate('/dashboard');
    };

    // ── Loading ─────────────────────────────────────────────────
    if (!dbGame) {
        return (
            <div className="min-h-dvh bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-zinc-500 text-xs font-mono tracking-widest uppercase">Loading game…</span>
                </div>
            </div>
        );
    }

    const aColor = dbGame.teamA?.color || '#3B82F6';
    const bColor = dbGame.teamB?.color || '#EF4444';
    const aName = dbGame.teamA?.name || 'Team A';
    const bName = dbGame.teamB?.name || 'Team B';
    const totalPeriods = dbGame.settings?.periods ?? 4;
    const periodType = dbGame.settings?.periodType ?? 'quarter';
    const periodLabel = timer.period > totalPeriods
        ? `OT${timer.period - totalPeriods}`
        : `${periodType === 'half' ? 'H' : 'Q'}${timer.period}`;

    const shotColor = timer.shotClock <= 5 ? '#EF4444' : timer.shotClock <= 10 ? '#F59E0B' : '#22C55E';

    return (
        <div className="min-h-dvh bg-zinc-950 text-white flex flex-col select-none"
            style={{ touchAction: 'manipulation' }}>

            {/* ── Header ── */}
            <header className="flex items-center justify-between px-3 h-12 border-b border-white/10 shrink-0">
                <button onClick={() => navigate(-1)}
                    className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-95">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-500 uppercase">Code</span>
                    <span className="text-sm font-mono font-bold tracking-[0.2em]">{gameCode}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {onSwitchToDesktop && (
                        <button onClick={onSwitchToDesktop}
                            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-95"
                            title="Desktop console">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </button>
                    )}
                    <button onClick={() => setShowEnd(true)}
                        className="px-3 h-9 rounded-full bg-red-600/15 border border-red-600/40 text-red-400 text-[11px] font-bold tracking-wider uppercase active:scale-95">
                        End
                    </button>
                </div>
            </header>

            {/* ── Scoreboard ── */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 px-3 py-3 shrink-0">
                {/* Team A */}
                <TeamHead name={aName} color={aColor} score={state.scoreA}
                    fouls={state.foulsA} timeouts={state.timeoutsA}
                    active={state.possession === 'A'} side="left" />
                {/* Clock cluster */}
                <div className="flex flex-col items-center justify-center px-1 min-w-[96px]">
                    <span className="text-[10px] font-mono tracking-[0.2em] text-red-500 font-bold">{periodLabel}</span>
                    <span className="text-4xl font-black tabular-nums leading-none mt-1"
                        style={{ color: timer.gameRunning ? '#22C55E' : '#fff', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtClock(timer.minutes, timer.seconds)}
                    </span>
                    <div className="mt-1.5 flex items-center gap-1">
                        <span className="text-[9px] font-mono tracking-widest text-zinc-500">SHOT</span>
                        <span className="text-xl font-black tabular-nums leading-none" style={{ color: shotColor }}>
                            {timer.shotClock}
                        </span>
                    </div>
                </div>
                {/* Team B */}
                <TeamHead name={bName} color={bColor} score={state.scoreB}
                    fouls={state.foulsB} timeouts={state.timeoutsB}
                    active={state.possession === 'B'} side="right" />
            </div>

            {/* ── Clock controls ── */}
            <div className="px-3 pb-2 grid grid-cols-[1.4fr_1fr_1fr] gap-2 shrink-0">
                <button onClick={() => timer.toggleClock()}
                    className={`h-12 rounded-xl font-bold text-sm tracking-wider uppercase active:scale-95 transition-colors ${timer.gameRunning ? 'bg-amber-500 text-black' : 'bg-green-500 text-black'}`}>
                    {timer.gameRunning ? '❚❚ Stop' : '▶ Start'}
                </button>
                <button onClick={() => timer.resetShotClock24()}
                    className="h-12 rounded-xl bg-green-500/10 border border-green-500/40 text-green-400 font-black text-lg tabular-nums active:scale-95">
                    24
                </button>
                <button onClick={() => timer.resetShotClock14()}
                    className="h-12 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 font-black text-lg tabular-nums active:scale-95">
                    14
                </button>
            </div>

            {/* ── Scoring decks ── */}
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-2 px-3 pb-2">
                <ScoreDeck color={aColor} onScore={(p) => score('A', p)}
                    onFoul={() => foul('A')} onTimeout={() => timeout('A')}
                    onPoss={() => setPossession('A')} possActive={state.possession === 'A'} />
                <ScoreDeck color={bColor} onScore={(p) => score('B', p)}
                    onFoul={() => foul('B')} onTimeout={() => timeout('B')}
                    onPoss={() => setPossession('B')} possActive={state.possession === 'B'} />
            </div>

            {/* ── Footer: next period + undo ── */}
            <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 grid grid-cols-2 gap-2 shrink-0">
                <button onClick={() => timer.nextPeriod()}
                    className="h-12 rounded-xl bg-white/5 border border-white/10 text-zinc-200 font-bold text-xs tracking-wider uppercase active:scale-95">
                    Next {periodType === 'half' ? 'Half' : 'Period'} →
                </button>
                <button onClick={undo} disabled={!canUndo}
                    className={`h-12 rounded-xl border font-bold text-xs tracking-wider uppercase active:scale-95 flex items-center justify-center gap-2 ${canUndo ? 'bg-white/5 border-white/10 text-zinc-200' : 'bg-white/[0.02] border-white/5 text-zinc-700'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    Undo
                </button>
            </div>

            {/* ── End confirm ── */}
            {showEnd && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={() => setShowEnd(false)}>
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-xs"
                        onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-1">End game?</h3>
                        <p className="text-sm text-zinc-400 mb-5">This marks the game completed. Final score: {state.scoreA}–{state.scoreB}.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowEnd(false)}
                                className="h-11 rounded-xl bg-white/5 border border-white/10 text-zinc-300 font-semibold text-sm active:scale-95">
                                Cancel
                            </button>
                            <button onClick={endGame}
                                className="h-11 rounded-xl bg-red-600 text-white font-semibold text-sm active:scale-95">
                                End game
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Team header (score + fouls + timeouts + possession) ─────────
function TeamHead({ name, color, score, fouls, timeouts, active, side }: {
    name: string; color: string; score: number; fouls: number;
    timeouts: number; active: boolean; side: 'left' | 'right';
}) {
    const rgb = hexToRgb(color);
    return (
        <div className="rounded-2xl p-2.5 flex flex-col"
            style={{
                background: `rgba(${rgb},0.08)`,
                border: `1px solid rgba(${rgb},${active ? 0.6 : 0.18})`,
                boxShadow: active ? `inset 0 -3px 0 ${color}` : 'none',
            }}>
            <div className="flex items-center gap-1.5" style={{ flexDirection: side === 'right' ? 'row-reverse' : 'row' }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color }}>{name}</span>
            </div>
            <span className="text-5xl font-black tabular-nums leading-none mt-0.5"
                style={{ textAlign: side === 'right' ? 'right' : 'left' }}>{score}</span>
            <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-zinc-400"
                style={{ justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
                <span>F:{fouls}</span>
                <span className="flex items-center gap-0.5">
                    TO
                    {Array.from({ length: Math.max(timeouts, 0) }).map((_, i) =>
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-400" />)}
                </span>
            </div>
        </div>
    );
}

// ── Per-team scoring deck ───────────────────────────────────────
function ScoreDeck({ color, onScore, onFoul, onTimeout, onPoss, possActive }: {
    color: string;
    onScore: (pts: number) => void;
    onFoul: () => void;
    onTimeout: () => void;
    onPoss: () => void;
    possActive: boolean;
}) {
    const rgb = hexToRgb(color);
    const big = "rounded-xl font-black active:scale-95 transition-transform flex flex-col items-center justify-center";
    return (
        <div className="flex flex-col gap-2 min-h-0">
            {/* +1 +2 +3 stacked, the heroes */}
            <button onClick={() => onScore(2)} className={`${big} flex-[2] text-4xl`}
                style={{ background: `rgba(${rgb},0.16)`, border: `1px solid rgba(${rgb},0.5)`, color }}>
                +2
            </button>
            <div className="grid grid-cols-2 gap-2 flex-1">
                <button onClick={() => onScore(1)} className={`${big} text-2xl`}
                    style={{ background: `rgba(${rgb},0.10)`, border: `1px solid rgba(${rgb},0.35)`, color }}>
                    +1
                </button>
                <button onClick={() => onScore(3)} className={`${big} text-2xl`}
                    style={{ background: `rgba(${rgb},0.10)`, border: `1px solid rgba(${rgb},0.35)`, color }}>
                    +3
                </button>
            </div>
            {/* foul / timeout */}
            <div className="grid grid-cols-2 gap-2 flex-1">
                <button onClick={onFoul}
                    className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-wider active:scale-95">
                    Foul
                </button>
                <button onClick={onTimeout}
                    className="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs uppercase tracking-wider active:scale-95">
                    T.O.
                </button>
            </div>
            {/* possession */}
            <button onClick={onPoss}
                className={`h-9 rounded-xl font-bold text-[11px] uppercase tracking-wider active:scale-95 transition-colors ${possActive ? 'text-black' : 'text-zinc-400 bg-white/5 border border-white/10'}`}
                style={possActive ? { background: color } : undefined}>
                ● Possession
            </button>
        </div>
    );
}
