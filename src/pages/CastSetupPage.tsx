// src/pages/CastSetupPage.tsx
// Mobile wizard opened when a user scans the kiosk QR code.
// URL: /cast?tv=XXXX
// Tailwind CSS, dark mobile-first design.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { openPhoneControlChannel } from '../services/castControlService';
import type { PhoneControlChannel } from '../services/castControlService';
import { castGameToTv } from '../services/tvDisplayService';
import { subscribeToLiveGames } from '../services/supabaseGameService';
import type { BasketballGame } from '../types';
import type { GameConfig, Player } from '../hooks/useRefereeBox';

// ── Constants ─────────────────────────────────────────────────

const COLOR_PRESETS = ['#DC2626', '#3B82F6', '#22C55E', '#8B5CF6', '#F97316', '#FFFFFF'] as const;

type GameMode = 'quick' | 'stats' | 'advanced';
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = ['', 'MODE', 'TEAMS', 'PARAMS', 'ROSTER', 'CONFIRM'];
const SETUP_STEPS: WizardStep[] = [1, 2, 3, 4, 5];

// ── Component ─────────────────────────────────────────────────

export default function CastSetupPage() {
    const tvCode = new URLSearchParams(window.location.search).get('tv')?.toUpperCase() ?? '';

    // Connection
    const channelRef = useRef<PhoneControlChannel | null>(null);
    const phoneIdRef = useRef<string>(crypto.randomUUID());
    const [connected, setConnected] = useState(false);

    // Navigation
    const [step, setStep] = useState<WizardStep>(0);
    const [mode, setMode] = useState<'setup' | 'watch'>('setup');

    // Game config state
    const [gameMode, setGameMode] = useState<GameMode>('quick');
    const [teamAName, setTeamAName] = useState('');
    const [teamBName, setTeamBName] = useState('');
    const [teamAColor, setTeamAColor] = useState('#DC2626');
    const [teamBColor, setTeamBColor] = useState('#3B82F6');
    const [periods, setPeriods] = useState(4);
    const [periodMinutes, setPeriodMinutes] = useState(10);
    const [shotClockEnabled, setShotClockEnabled] = useState(true);
    const [shotClockSeconds, setShotClockSeconds] = useState(24);
    const [timeoutsPerTeam, setTimeoutsPerTeam] = useState(2);
    const [playersA, setPlayersA] = useState<Player[]>([]);
    const [playersB, setPlayersB] = useState<Player[]>([]);
    const [activeRosterTab, setActiveRosterTab] = useState<0 | 1>(0);
    const [rosterNameA, setRosterNameA] = useState('');
    const [rosterNumA, setRosterNumA] = useState('');
    const [rosterNameB, setRosterNameB] = useState('');
    const [rosterNumB, setRosterNumB] = useState('');

    // Watch path
    const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);
    const [liveGamesLoading, setLiveGamesLoading] = useState(false);
    const [watchSent, setWatchSent] = useState(false);

    // Submit state
    const [sent, setSent] = useState(false);

    // ── Channel lifecycle ──────────────────────────────────────

    useEffect(() => {
        if (!tvCode) return;
        const channel = openPhoneControlChannel(tvCode);
        channelRef.current = channel;
        // Brief delay to let channel subscribe, then announce
        const t = setTimeout(() => {
            channel.sendEvent({ event: 'phone-connected', phoneId: phoneIdRef.current, timestamp: Date.now() });
            setConnected(true);
        }, 600);
        return () => {
            clearTimeout(t);
            channel.sendEvent({ event: 'phone-disconnected', phoneId: phoneIdRef.current, timestamp: Date.now() });
            setTimeout(() => channel.disconnect(), 300);
        };
    }, [tvCode]);

    // ── Send config-update on state changes (debounced for text) ──

    const sendConfigUpdate = useCallback((overrides?: Partial<GameConfig>) => {
        channelRef.current?.sendEvent({
            event: 'config-update',
            config: {
                gameMode,
                teamAName: teamAName.trim().toUpperCase() || undefined,
                teamBName: teamBName.trim().toUpperCase() || undefined,
                teamAColor,
                teamBColor,
                periods,
                periodMinutes,
                periodType: periods === 2 ? 'half' : 'quarter',
                shotClockSeconds: shotClockEnabled ? shotClockSeconds : 0,
                timeoutsPerTeam,
                playersA,
                playersB,
                ...overrides,
            },
            step,
            timestamp: Date.now(),
        });
    }, [gameMode, teamAName, teamBName, teamAColor, teamBColor, periods, periodMinutes,
        shotClockEnabled, shotClockSeconds, timeoutsPerTeam, playersA, playersB, step]);

    // Debounce text input updates
    useEffect(() => {
        if (step < 2) return;
        const t = setTimeout(() => sendConfigUpdate(), 300);
        return () => clearTimeout(t);
    }, [teamAName, teamBName]);

    // Immediate updates for discrete selections
    useEffect(() => {
        if (step < 1) return;
        sendConfigUpdate();
    }, [gameMode, teamAColor, teamBColor, periods, periodMinutes,
        shotClockEnabled, shotClockSeconds, timeoutsPerTeam, playersA, playersB]);

    // ── Helpers ───────────────────────────────────────────────

    const buildFinalConfig = (): GameConfig => ({
        teamAName: teamAName.trim().toUpperCase() || 'TEAM A',
        teamBName: teamBName.trim().toUpperCase() || 'TEAM B',
        teamAColor,
        teamBColor,
        periods,
        periodMinutes,
        periodType: periods === 2 ? 'half' : 'quarter',
        shotClockSeconds: shotClockEnabled ? shotClockSeconds : 0,
        timeoutsPerTeam,
        gameMode,
        playersA,
        playersB,
    });

    const handleBeginMatch = () => {
        const config = buildFinalConfig();
        channelRef.current?.sendEvent({ event: 'setup-start', config, timestamp: Date.now() });
        setSent(true);
    };

    const handleWatchSelect = async (gameCode: string) => {
        if (!tvCode) return;
        setWatchSent(true);
        try {
            await castGameToTv(tvCode, gameCode);
            channelRef.current?.sendEvent({ event: 'watch-game', gameCode, timestamp: Date.now() });
        } catch (e) {
            console.error('[CastSetup] castGameToTv failed:', e);
            setWatchSent(false);
        }
    };

    const goToWatch = () => {
        setMode('watch');
        setLiveGamesLoading(true);
        const unsub = subscribeToLiveGames((games) => {
            setLiveGames(games);
            setLiveGamesLoading(false);
        });
        // Unsubscribe after first fetch (we don't need live updates here)
        setTimeout(unsub, 5000);
    };

    const addPlayerA = () => {
        if (!rosterNameA.trim() || !rosterNumA.trim() || playersA.length >= 12) return;
        setPlayersA(p => [...p, { id: `pa-${Date.now()}`, name: rosterNameA.trim().toUpperCase(), number: rosterNumA.trim() }]);
        setRosterNameA(''); setRosterNumA('');
    };

    const addPlayerB = () => {
        if (!rosterNameB.trim() || !rosterNumB.trim() || playersB.length >= 12) return;
        setPlayersB(p => [...p, { id: `pb-${Date.now()}`, name: rosterNameB.trim().toUpperCase(), number: rosterNumB.trim() }]);
        setRosterNameB(''); setRosterNumB('');
    };

    const canGoNext = (): boolean => {
        if (step === 2) return teamAName.trim().length > 0 && teamBName.trim().length > 0;
        return true;
    };

    const totalSteps = gameMode === 'quick' ? 4 : 5; // quick skips roster
    const visibleSteps = gameMode === 'quick'
        ? [1, 2, 3, 5] as WizardStep[]
        : [1, 2, 3, 4, 5] as WizardStep[];

    const nextStep = () => {
        const idx = visibleSteps.indexOf(step);
        if (idx < visibleSteps.length - 1) setStep(visibleSteps[idx + 1]);
    };

    const prevStep = () => {
        const idx = visibleSteps.indexOf(step);
        if (idx > 0) setStep(visibleSteps[idx - 1]);
        else setStep(0);
    };

    // ── Render ────────────────────────────────────────────────

    if (!tvCode) {
        return (
            <div className="min-h-dvh bg-black flex items-center justify-center p-6">
                <div className="text-center space-y-3">
                    <div className="text-red-500 font-mono text-xs uppercase tracking-widest">ERROR</div>
                    <div className="text-white font-black italic uppercase text-2xl">No Screen Code</div>
                    <div className="text-zinc-500 font-mono text-xs">Scan the QR code on the kiosk screen.</div>
                </div>
            </div>
        );
    }

    // ── Watch game path ────────────────────────────────────────

    if (mode === 'watch') {
        return (
            <div className="min-h-dvh bg-black flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-900">
                    <button onClick={() => setMode('setup')} className="text-zinc-500 font-mono text-xs uppercase tracking-widest">← BACK</button>
                    <div className="flex-1" />
                    <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                        SCREEN <span className="text-white font-bold">{tvCode}</span>
                    </span>
                </div>

                <div className="flex-1 px-5 py-6 space-y-3">
                    <h2 className="text-white font-black italic uppercase text-xl tracking-tight mb-5">LIVE GAMES</h2>

                    {watchSent ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <div className="text-white font-black italic uppercase text-lg">Casting to Screen</div>
                            <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Check the kiosk</div>
                        </div>
                    ) : liveGamesLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-zinc-600 font-mono text-xs uppercase tracking-widest animate-pulse">LOADING LIVE GAMES…</div>
                        </div>
                    ) : liveGames.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                            <div className="text-zinc-600 font-mono text-xs uppercase tracking-widest">NO LIVE GAMES</div>
                            <div className="text-zinc-700 font-mono text-[10px]">Start a game on the kiosk first</div>
                        </div>
                    ) : (
                        liveGames.map(game => (
                            <button
                                key={game.code}
                                onClick={() => handleWatchSelect(game.code)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform text-left"
                            >
                                <div>
                                    <div className="text-white font-bold text-sm">
                                        {game.teamA?.name ?? '—'} vs {game.teamB?.name ?? '—'}
                                    </div>
                                    <div className="font-mono text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">{game.code}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-black tabular-nums text-lg">
                                        {game.teamA?.score ?? 0} – {game.teamB?.score ?? 0}
                                    </div>
                                    <div className="font-mono text-[9px] text-red-500 uppercase tracking-widest">● LIVE</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // ── Landing (step 0) ──────────────────────────────────────

    if (step === 0) {
        return (
            <div className="min-h-dvh bg-black flex flex-col">
                {/* Top bar */}
                <div className="flex items-center justify-end px-5 py-4 border-b border-zinc-900">
                    <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                        SCREEN <span className="text-white font-bold">{tvCode}</span>
                    </span>
                </div>

                {/* Main */}
                <div className="flex-1 flex flex-col items-center justify-center gap-10 px-5 pb-10">
                    <div className="text-center space-y-2">
                        <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.3em] mb-3">THE BOX · REMOTE SETUP</div>
                        <h1 className="text-5xl font-black italic uppercase tracking-tight text-white leading-none">
                            SETUP<br />THIS<br />SCREEN
                        </h1>
                        <p className="text-zinc-500 text-sm font-mono mt-4">
                            {connected ? (
                                <span className="flex items-center gap-2 justify-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                    Connected to kiosk
                                </span>
                            ) : (
                                <span className="animate-pulse">Connecting…</span>
                            )}
                        </p>
                    </div>

                    <div className="w-full max-w-sm space-y-3">
                        <button
                            onClick={() => setStep(1)}
                            className="w-full py-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black italic uppercase tracking-tight text-xl rounded-xl active:scale-[0.98] transition-all"
                        >
                            START GAME
                        </button>
                        <button
                            onClick={goToWatch}
                            className="w-full py-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-white font-bold uppercase tracking-widest text-sm rounded-xl active:scale-[0.98] transition-all"
                        >
                            WATCH GAME
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Setup wizard (steps 1–5) ──────────────────────────────

    return (
        <div className="min-h-dvh bg-black flex flex-col">

            {/* ── Sticky header + step indicator ── */}
            <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-zinc-900">
                {/* Title bar */}
                <div className="flex items-center justify-between px-5 py-3">
                    <div>
                        <div className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest">THE BOX · REMOTE SETUP</div>
                        <div className="text-white font-black italic uppercase text-base leading-tight">{STEP_LABELS[step]}</div>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-700 uppercase tracking-widest">
                        {tvCode}
                    </span>
                </div>

                {/* Step indicator */}
                <div className="flex items-center px-5 pb-3 gap-0">
                    {visibleSteps.map((s, i) => {
                        const stepIdx = visibleSteps.indexOf(step);
                        const isDone = i < stepIdx;
                        const isActive = s === step;
                        return (
                            <React.Fragment key={s}>
                                <div className={`
                                    w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0 transition-all
                                    ${isDone ? 'bg-red-600 text-white' : ''}
                                    ${isActive ? 'bg-red-600 text-white ring-4 ring-red-600/20' : ''}
                                    ${!isDone && !isActive ? 'bg-zinc-900 text-zinc-600 border border-zinc-800' : ''}
                                `}>
                                    {isDone ? (
                                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : i + 1}
                                </div>
                                {i < visibleSteps.length - 1 && (
                                    <div className={`flex-1 h-[2px] mx-1 transition-all ${isDone ? 'bg-red-600' : 'bg-zinc-800'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* ── Scrollable step content ── */}
            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-36 space-y-4">

                {/* STEP 1 — Game Mode */}
                {step === 1 && (
                    <div className="space-y-3">
                        <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-4">SELECT GAME MODE</p>
                        {([
                            { value: 'quick' as GameMode, label: 'QUICK MATCH', desc: 'Score + clock only. Zero overhead.', sub: 'No player tracking' },
                            { value: 'stats' as GameMode, label: 'STATS MODE', desc: 'Track individual player points.', sub: 'Player rosters required' },
                            { value: 'advanced' as GameMode, label: 'ADVANCED', desc: 'Full shot chart + court analytics.', sub: 'Full tracking enabled' },
                        ] as const).map(({ value, label, desc, sub }) => (
                            <button
                                key={value}
                                onClick={() => setGameMode(value)}
                                className={`
                                    w-full p-5 rounded-xl border-2 text-left flex items-start gap-4 transition-all active:scale-[0.98]
                                    ${gameMode === value ? 'border-red-600 bg-red-600/10' : 'border-zinc-800 bg-zinc-900'}
                                `}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className={`font-black italic uppercase tracking-tight text-lg leading-tight ${gameMode === value ? 'text-white' : 'text-zinc-400'}`}>
                                        {label}
                                    </div>
                                    <div className="text-zinc-500 text-xs font-mono mt-1">{desc}</div>
                                    <div className="text-zinc-700 text-[10px] font-mono mt-0.5 uppercase tracking-widest">{sub}</div>
                                </div>
                                {gameMode === value && (
                                    <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* STEP 2 — Teams */}
                {step === 2 && (
                    <div className="space-y-4">
                        {([
                            {
                                label: 'TEAM A', name: teamAName, color: teamAColor,
                                setName: setTeamAName, setColor: setTeamAColor,
                                nameId: 'nameA' as const,
                            },
                            {
                                label: 'TEAM B', name: teamBName, color: teamBColor,
                                setName: setTeamBName, setColor: setTeamBColor,
                                nameId: 'nameB' as const,
                            },
                        ]).map(({ label, name, color, setName, setColor }) => (
                            <div
                                key={label}
                                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
                                style={{ borderLeftWidth: 4, borderLeftColor: color }}
                            >
                                <div className="px-4 py-3 border-b border-zinc-800">
                                    <span className="font-black italic uppercase text-white text-sm tracking-tight">{label}</span>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">TEAM NAME</label>
                                        <input
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="ENTER TEAM NAME"
                                            maxLength={16}
                                            autoComplete="off"
                                            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm font-mono focus:border-red-500 focus:outline-none transition-colors placeholder:text-zinc-600 uppercase"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">JERSEY COLOR</label>
                                        <div className="flex gap-3 flex-wrap">
                                            {COLOR_PRESETS.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setColor(c)}
                                                    className="w-12 h-12 rounded-lg transition-all active:scale-90 flex-shrink-0"
                                                    style={{
                                                        background: c,
                                                        border: c === '#FFFFFF' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                                                        outline: color === c ? '3px solid white' : '3px solid transparent',
                                                        outlineOffset: '2px',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* STEP 3 — Match Parameters */}
                {step === 3 && (
                    <div className="space-y-4">
                        {/* Period count */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block mb-3">PERIODS</label>
                            <div className="flex gap-2">
                                {([4, 2, 1] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriods(p)}
                                        className={`
                                            flex-1 py-3 rounded-lg font-mono text-sm uppercase tracking-widest transition-all active:scale-95
                                            ${periods === p ? 'bg-red-600 text-white border border-red-600' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}
                                        `}
                                    >
                                        {p === 4 ? '4 QTR' : p === 2 ? '2 HLV' : '1 PRD'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Period duration */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block mb-3">PERIOD DURATION</label>
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setPeriodMinutes(m => Math.max(1, m - 1))}
                                    className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-xl font-bold active:scale-95 transition-all flex items-center justify-center"
                                >−</button>
                                <div className="text-center">
                                    <span className="text-white font-black italic text-4xl tabular-nums">{periodMinutes}</span>
                                    <span className="text-zinc-500 font-mono text-sm ml-2">MIN</span>
                                </div>
                                <button
                                    onClick={() => setPeriodMinutes(m => Math.min(40, m + 1))}
                                    className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-xl font-bold active:scale-95 transition-all flex items-center justify-center"
                                >+</button>
                            </div>
                        </div>

                        {/* Shot clock */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">SHOT CLOCK</label>
                                <button
                                    onClick={() => setShotClockEnabled(e => !e)}
                                    className={`
                                        relative w-12 h-6 rounded-full transition-all
                                        ${shotClockEnabled ? 'bg-red-600' : 'bg-zinc-700'}
                                    `}
                                >
                                    <div className={`
                                        absolute top-1 w-4 h-4 rounded-full bg-white transition-all
                                        ${shotClockEnabled ? 'left-7' : 'left-1'}
                                    `} />
                                </button>
                            </div>
                            {shotClockEnabled && (
                                <div className="flex gap-2">
                                    {([24, 12] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setShotClockSeconds(s)}
                                            className={`
                                                flex-1 py-3 rounded-lg font-mono text-sm uppercase tracking-widest transition-all active:scale-95
                                                ${shotClockSeconds === s ? 'bg-red-600 text-white border border-red-600' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}
                                            `}
                                        >
                                            {s}S
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Timeouts */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <label className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block mb-3">TIMEOUTS PER TEAM</label>
                            <div className="flex gap-2">
                                {([1, 2, 3] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTimeoutsPerTeam(t)}
                                        className={`
                                            flex-1 py-3 rounded-lg font-mono text-lg font-bold transition-all active:scale-95
                                            ${timeoutsPerTeam === t ? 'bg-red-600 text-white border border-red-600' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}
                                        `}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4 — Roster (stats/advanced only) */}
                {step === 4 && (
                    <div>
                        {/* Tabs */}
                        <div className="flex border-b border-zinc-800 mb-4">
                            {(['TEAM A', 'TEAM B'] as const).map((label, i) => (
                                <button
                                    key={label}
                                    onClick={() => setActiveRosterTab(i as 0 | 1)}
                                    className={`
                                        flex-1 py-3 font-mono text-xs uppercase tracking-widest border-b-2 transition-colors
                                        ${activeRosterTab === i ? 'border-red-600 text-white' : 'border-transparent text-zinc-500'}
                                    `}
                                    style={{ borderBottomColor: activeRosterTab === i ? (i === 0 ? teamAColor : teamBColor) : undefined }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Team A roster */}
                        {activeRosterTab === 0 && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        value={rosterNameA}
                                        onChange={e => setRosterNameA(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addPlayerA()}
                                        placeholder="PLAYER NAME"
                                        autoComplete="off"
                                        className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-3 text-sm font-mono focus:border-red-500 focus:outline-none transition-colors placeholder:text-zinc-700"
                                        disabled={playersA.length >= 12}
                                    />
                                    <input
                                        value={rosterNumA}
                                        onChange={e => setRosterNumA(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addPlayerA()}
                                        placeholder="NO."
                                        autoComplete="off"
                                        className="w-16 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-3 text-sm font-mono text-center focus:border-red-500 focus:outline-none transition-colors placeholder:text-zinc-700"
                                        disabled={playersA.length >= 12}
                                    />
                                    <button
                                        onClick={addPlayerA}
                                        disabled={playersA.length >= 12}
                                        className="px-4 py-3 bg-red-600 text-white rounded-lg font-bold text-sm disabled:opacity-30 active:scale-95 transition-all"
                                    >+</button>
                                </div>
                                <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">{playersA.length}/12 PLAYERS</div>
                                <div className="space-y-2">
                                    {playersA.map(p => (
                                        <div key={p.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">
                                            <span className="font-mono text-sm text-zinc-300">#{p.number} {p.name}</span>
                                            <button onClick={() => setPlayersA(prev => prev.filter(x => x.id !== p.id))} className="text-zinc-600 font-mono text-xs active:scale-90">[×]</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Team B roster */}
                        {activeRosterTab === 1 && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        value={rosterNameB}
                                        onChange={e => setRosterNameB(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addPlayerB()}
                                        placeholder="PLAYER NAME"
                                        autoComplete="off"
                                        className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-3 text-sm font-mono focus:border-red-500 focus:outline-none transition-colors placeholder:text-zinc-700"
                                        disabled={playersB.length >= 12}
                                    />
                                    <input
                                        value={rosterNumB}
                                        onChange={e => setRosterNumB(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addPlayerB()}
                                        placeholder="NO."
                                        autoComplete="off"
                                        className="w-16 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-3 text-sm font-mono text-center focus:border-red-500 focus:outline-none transition-colors placeholder:text-zinc-700"
                                        disabled={playersB.length >= 12}
                                    />
                                    <button
                                        onClick={addPlayerB}
                                        disabled={playersB.length >= 12}
                                        className="px-4 py-3 bg-red-600 text-white rounded-lg font-bold text-sm disabled:opacity-30 active:scale-95 transition-all"
                                    >+</button>
                                </div>
                                <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">{playersB.length}/12 PLAYERS</div>
                                <div className="space-y-2">
                                    {playersB.map(p => (
                                        <div key={p.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">
                                            <span className="font-mono text-sm text-zinc-300">#{p.number} {p.name}</span>
                                            <button onClick={() => setPlayersB(prev => prev.filter(x => x.id !== p.id))} className="text-zinc-600 font-mono text-xs active:scale-90">[×]</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 5 — Summary + Confirm */}
                {step === 5 && (
                    <div className="space-y-4">
                        <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-4">CONFIRM AND SEND TO KIOSK</p>

                        {/* Config summary card */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            {/* Mode */}
                            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">MODE</span>
                                <span className="text-red-500 font-black italic uppercase text-sm">{gameMode.toUpperCase()}</span>
                            </div>
                            {/* Teams */}
                            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: teamAColor }} />
                                    <span className="text-white font-bold uppercase text-sm">{teamAName || 'TEAM A'}</span>
                                </div>
                                <span className="text-zinc-600 font-mono text-xs">VS</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-bold uppercase text-sm">{teamBName || 'TEAM B'}</span>
                                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: teamBColor }} />
                                </div>
                            </div>
                            {/* Params */}
                            <div className="px-4 py-3 flex items-center justify-between">
                                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">PARAMS</span>
                                <span className="text-zinc-300 font-mono text-xs">
                                    {periods}×{periodMinutes}MIN · {shotClockEnabled ? `${shotClockSeconds}S` : 'NO'} CLOCK · {timeoutsPerTeam} TO
                                </span>
                            </div>
                            {/* Roster counts */}
                            {gameMode !== 'quick' && (
                                <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
                                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">ROSTERS</span>
                                    <span className="text-zinc-300 font-mono text-xs">
                                        {playersA.length} / {playersB.length} players
                                    </span>
                                </div>
                            )}
                        </div>

                        {sent && (
                            <div className="flex items-center gap-3 bg-green-950 border border-green-800 rounded-xl px-4 py-4">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                                <div>
                                    <div className="text-green-400 font-black italic uppercase text-sm">Sent to Kiosk</div>
                                    <div className="text-green-700 font-mono text-[10px] mt-0.5">Game is starting on the screen…</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* ── Fixed bottom nav bar ── */}
            <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-zinc-900 px-5 py-4 flex gap-3">
                <button
                    onClick={prevStep}
                    className="flex-shrink-0 px-5 py-4 bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-xs uppercase tracking-widest rounded-xl active:scale-95 transition-all"
                >
                    ← BACK
                </button>

                {step < 5 ? (
                    <button
                        onClick={nextStep}
                        disabled={!canGoNext()}
                        className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black italic uppercase tracking-tight text-base rounded-xl active:scale-[0.98] transition-all"
                    >
                        NEXT →
                    </button>
                ) : (
                    <button
                        onClick={handleBeginMatch}
                        disabled={sent}
                        className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black italic uppercase tracking-tight text-base rounded-xl active:scale-[0.98] transition-all"
                    >
                        {sent ? 'SENDING…' : '▶ BEGIN MATCH'}
                    </button>
                )}
            </div>

        </div>
    );
}
