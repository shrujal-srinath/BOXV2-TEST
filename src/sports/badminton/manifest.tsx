// src/sports/badminton/manifest.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Badminton Sport Manifest (v4)
//
// v4 changes:
//   [1] serviceSide added to BadmintonState — BWF auto-track (rally winner serves)
//   [2] Full BadmintonHostConsole — replaces stub controller
//   [3] setupPage wired to BadmintonSetupPage
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
    SportManifest,
    WallCardProps,
    SpectatorProps,
    SportComponentProps,
    GameContext,
} from '../../core/types/Manifest';
import type { BaseGameState, NormalizedResult } from '../../core/types/Game';
import { BadmintonSetupPage } from './SetupPage';
import { deleteGame } from '../../services/supabaseGameService';
import { stopAllCastsForGame } from '../../services/tvDisplayService';

// ─── 1. Rules & State ─────────────────────────────────────────────────────────

export interface BadmintonRules {
    gamesToWin: number;   // e.g. 2 (best of 3)
    pointsToWin: number;  // e.g. 21
}

export interface BadmintonState extends BaseGameState {
    scoreA: number;
    scoreB: number;
    gamesWonA: number;
    gamesWonB: number;
    currentGame: number;
    serviceSide: 'A' | 'B'; // BWF: rally winner earns service
}

export type BadmintonAction =
    | { type: 'ADD_POINTS'; team: 'A' | 'B'; amount: number }
    | { type: 'SUB_POINTS'; team: 'A' | 'B' }
    | { type: 'NEXT_GAME' }
    | { type: 'SET_SERVICE'; side: 'A' | 'B' };

// ─── 2. Engine Logic ──────────────────────────────────────────────────────────

const reducer = (
    state: BadmintonState,
    action: BadmintonAction,
    rules: BadmintonRules
): BadmintonState => {
    const matchWon = state.gamesWonA >= rules.gamesToWin || state.gamesWonB >= rules.gamesToWin;
    if (matchWon && action.type !== 'SUB_POINTS') return state;

    switch (action.type) {
        case 'ADD_POINTS': {
            const newA = action.team === 'A' ? state.scoreA + action.amount : state.scoreA;
            const newB = action.team === 'B' ? state.scoreB + action.amount : state.scoreB;
            const target = rules.pointsToWin;
            const hardCap = target + 9;
            const isDeuce = newA >= target - 1 && newB >= target - 1;

            let gameWon: 'A' | 'B' | null = null;
            if (newA >= hardCap) gameWon = 'A';
            else if (newB >= hardCap) gameWon = 'B';
            else if (isDeuce) {
                if (newA - newB >= 2) gameWon = 'A';
                else if (newB - newA >= 2) gameWon = 'B';
            } else {
                if (newA >= target) gameWon = 'A';
                else if (newB >= target) gameWon = 'B';
            }

            if (gameWon) {
                return {
                    ...state,
                    scoreA: 0,
                    scoreB: 0,
                    currentGame: state.currentGame + 1,
                    gamesWonA: state.gamesWonA + (gameWon === 'A' ? 1 : 0),
                    gamesWonB: state.gamesWonB + (gameWon === 'B' ? 1 : 0),
                    serviceSide: gameWon, // game winner serves first in next game
                };
            }

            // Rally winner earns service (BWF rule)
            return { ...state, scoreA: newA, scoreB: newB, serviceSide: action.team };
        }

        case 'SUB_POINTS':
            return action.team === 'A'
                ? { ...state, scoreA: Math.max(0, state.scoreA - 1) }
                : { ...state, scoreB: Math.max(0, state.scoreB - 1) };

        case 'NEXT_GAME': {
            if (state.scoreA === state.scoreB) return state;
            const winner: 'A' | 'B' = state.scoreA > state.scoreB ? 'A' : 'B';
            return {
                ...state,
                scoreA: 0,
                scoreB: 0,
                currentGame: state.currentGame + 1,
                gamesWonA: state.gamesWonA + (winner === 'A' ? 1 : 0),
                gamesWonB: state.gamesWonB + (winner === 'B' ? 1 : 0),
                serviceSide: winner,
            };
        }

        case 'SET_SERVICE':
            return { ...state, serviceSide: action.side };

        default:
            return state;
    }
};

const normalizeResult = (state: BadmintonState, rules: BadmintonRules): NormalizedResult => {
    const isComplete = state.gamesWonA === rules.gamesToWin || state.gamesWonB === rules.gamesToWin;
    return {
        isComplete,
        winner: isComplete ? (state.gamesWonA > state.gamesWonB ? 'A' : 'B') : null,
        displayScore: `${state.gamesWonA}–${state.gamesWonB}`,
        teamAScore: state.gamesWonA,
        teamBScore: state.gamesWonB,
    };
};

// ─── 3. Shared Scoreboard ─────────────────────────────────────────────────────

const BadmintonScoreboard: React.FC<{ state: BadmintonState; context: GameContext }> = ({ state, context }) => {
    const rules = context as any; // rules injected by manifest at runtime via normalizeResult
    const matchWon = state.gamesWonA >= 2 || state.gamesWonB >= 2;
    const matchWinner = matchWon ? (state.gamesWonA > state.gamesWonB ? context.teamA.name : context.teamB.name) : null;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 font-sans px-6">
            {matchWon && (
                <div className="px-6 py-2 bg-white/10 border border-white/20 rounded-full">
                    <span className="text-white text-sm font-black uppercase tracking-widest">
                        Match Won — {matchWinner}
                    </span>
                </div>
            )}
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-[0.3em] font-mono">
                Game {state.currentGame} · Sets {state.gamesWonA}–{state.gamesWonB}
            </div>
            <div className="w-full max-w-3xl grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
                <div className="flex flex-col items-center gap-3">
                    <p className="text-xl font-black uppercase tracking-tight" style={{ color: context.teamA.color || '#DC2626' }}>
                        {context.teamA.name}
                    </p>
                    <p className="text-[10rem] font-bold leading-none font-mono">{state.scoreA}</p>
                    <div className="flex gap-1.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="w-3 h-3 rounded-full" style={i < state.gamesWonA ? { background: context.teamA.color || '#DC2626' } : { background: '#27272a' }} />
                        ))}
                    </div>
                    {state.serviceSide === 'A' && (
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-zinc-700 px-3 py-1">
                            SERVING
                        </div>
                    )}
                </div>
                <div className="text-4xl font-black text-zinc-700">VS</div>
                <div className="flex flex-col items-center gap-3">
                    <p className="text-xl font-black uppercase tracking-tight" style={{ color: context.teamB.color || '#2563EB' }}>
                        {context.teamB.name}
                    </p>
                    <p className="text-[10rem] font-bold leading-none font-mono">{state.scoreB}</p>
                    <div className="flex gap-1.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="w-3 h-3 rounded-full" style={i < state.gamesWonB ? { background: context.teamB.color || '#2563EB' } : { background: '#27272a' }} />
                        ))}
                    </div>
                    {state.serviceSide === 'B' && (
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-zinc-700 px-3 py-1">
                            SERVING
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── 4. Wall Card & Spectator ─────────────────────────────────────────────────

const BadmintonWallCard: React.FC<WallCardProps<BadmintonState>> = ({ state, context }) => (
    <BadmintonScoreboard state={state} context={context} />
);

const BadmintonSpectator: React.FC<SpectatorProps<BadmintonState>> = ({ state, context }) => (
    <BadmintonScoreboard state={state} context={context} />
);

// ─── 5. Host Console ──────────────────────────────────────────────────────────

const BadmintonHostConsole: React.FC<SportComponentProps<BadmintonState, BadmintonAction>> = ({
    gameId, state, dispatch, context,
}) => {
    const navigate = useNavigate();
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [copied, setCopied] = useState(false);

    const matchWon = state.gamesWonA >= 2 || state.gamesWonB >= 2;
    const matchWinner = matchWon
        ? (state.gamesWonA > state.gamesWonB ? context.teamA.name : context.teamB.name)
        : null;

    const canEndGame = state.scoreA !== state.scoreB;

    const copyCode = () => {
        navigator.clipboard.writeText(gameId).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleEndGame = async () => {
        try {
            await stopAllCastsForGame(gameId);
            await deleteGame(gameId);
            navigate('/dashboard');
        } catch {
            alert('Failed to end game.');
        }
    };

    // Derive rules from context (injected at engine level via manifest.rules)
    const totalGames = state.gamesWonA + state.gamesWonB + (state.scoreA > 0 || state.scoreB > 0 ? 1 : 0);

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">

            {/* ── Header ───────────────────────────────────────────────── */}
            <header className="h-14 flex items-center justify-between px-4 shrink-0 bg-black border-b border-zinc-900 z-20">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        ←
                    </button>
                    <button
                        type="button"
                        onClick={copyCode}
                        className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded transition-colors hover:bg-zinc-800 cursor-pointer"
                    >
                        <span className="text-xs font-mono font-bold text-zinc-400 tracking-wider">{gameId}</span>
                        <span className="text-[10px] text-zinc-600">{copied ? '✓' : '⧉'}</span>
                    </button>
                    <a
                        href={`/watch/${gameId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white border border-zinc-800 px-3 py-1.5 rounded transition-colors hidden sm:flex items-center gap-1.5"
                    >
                        <span>Watch</span>
                        <span>↗</span>
                    </a>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hidden sm:block">
                        🏸 Badminton
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowEndConfirm(true)}
                        className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-zinc-800 text-zinc-500 hover:border-red-900 hover:text-red-500 transition-colors cursor-pointer rounded"
                    >
                        End Game
                    </button>
                </div>
            </header>

            {/* ── Body ─────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col p-4 gap-4 max-w-2xl mx-auto w-full">

                {/* Match status bar */}
                <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                        Game {state.currentGame}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Games won dots */}
                        <div className="flex gap-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="w-2.5 h-2.5 rounded-full" style={i < state.gamesWonA ? { background: context.teamA.color || '#DC2626' } : { background: '#3f3f46' }} />
                            ))}
                        </div>
                        <span className="text-xs font-black text-white font-mono">
                            {state.gamesWonA} – {state.gamesWonB}
                        </span>
                        <div className="flex gap-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="w-2.5 h-2.5 rounded-full" style={i < state.gamesWonB ? { background: context.teamB.color || '#2563EB' } : { background: '#3f3f46' }} />
                            ))}
                        </div>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                        Sets
                    </div>
                </div>

                {/* Scoreboard */}
                <div className="flex-1 grid grid-cols-[1fr_40px_1fr] gap-3 items-center min-h-0">
                    {/* Team A */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                            <p className="font-black text-sm uppercase tracking-widest text-center leading-tight truncate" style={{ color: context.teamA.color || '#DC2626' }}>
                                {context.teamA.name}
                            </p>
                            {state.serviceSide === 'A' && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded shrink-0">SRV</span>
                            )}
                        </div>
                        <div className="text-[clamp(5rem,18vw,9rem)] font-bold font-mono leading-none text-white">
                            {state.scoreA}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="flex flex-col items-center justify-center gap-1">
                        <div className="text-zinc-800 text-xs font-black">–</div>
                    </div>

                    {/* Team B */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                            {state.serviceSide === 'B' && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded shrink-0">SRV</span>
                            )}
                            <p className="font-black text-sm uppercase tracking-widest text-center leading-tight truncate" style={{ color: context.teamB.color || '#2563EB' }}>
                                {context.teamB.name}
                            </p>
                        </div>
                        <div className="text-[clamp(5rem,18vw,9rem)] font-bold font-mono leading-none text-white">
                            {state.scoreB}
                        </div>
                    </div>
                </div>

                {/* Match won banner */}
                {matchWon && (
                    <div className="bg-white/5 border border-white/20 rounded-xl px-6 py-4 text-center">
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-400 mb-1">Match Complete</p>
                        <p className="font-black text-xl uppercase text-white">{matchWinner} Wins</p>
                    </div>
                )}

                {/* Score buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'ADD_POINTS', team: 'A', amount: 1 })}
                        disabled={matchWon}
                        className="py-6 rounded-xl font-black text-xl uppercase tracking-wider bg-zinc-900 border-2 border-zinc-700 hover:border-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        style={{ color: context.teamA.color || '#DC2626' }}
                    >
                        +1
                        <span className="block text-xs font-bold text-zinc-500 mt-1 normal-case tracking-normal">
                            {context.teamA.name}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'ADD_POINTS', team: 'B', amount: 1 })}
                        disabled={matchWon}
                        className="py-6 rounded-xl font-black text-xl uppercase tracking-wider bg-zinc-900 border-2 border-zinc-700 hover:border-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        style={{ color: context.teamB.color || '#2563EB' }}
                    >
                        +1
                        <span className="block text-xs font-bold text-zinc-500 mt-1 normal-case tracking-normal">
                            {context.teamB.name}
                        </span>
                    </button>
                </div>

                {/* Correction row */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'SUB_POINTS', team: 'A' })}
                        className="py-3 rounded-xl text-sm font-bold text-zinc-500 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 transition-all active:scale-[0.97] cursor-pointer"
                    >
                        −1 {context.teamA.name}
                    </button>
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'SUB_POINTS', team: 'B' })}
                        className="py-3 rounded-xl text-sm font-bold text-zinc-500 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 transition-all active:scale-[0.97] cursor-pointer"
                    >
                        −1 {context.teamB.name}
                    </button>
                </div>

                {/* Game control */}
                {!matchWon && (
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'NEXT_GAME' })}
                        disabled={!canEndGame}
                        className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer"
                    >
                        {canEndGame ? `End Game ${state.currentGame} →` : 'Score must not be tied to end game'}
                    </button>
                )}
            </div>

            {/* ── End game confirm modal ────────────────────────────────── */}
            {showEndConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl">
                        <h3 className="font-black text-white uppercase text-lg mb-2">End Game?</h3>
                        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                            This will permanently end the session and return you to the dashboard.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowEndConfirm(false)}
                                className="flex-1 py-3 border border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleEndGame}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
                            >
                                End Game
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── 6. Manifest Export ───────────────────────────────────────────────────────

export const badmintonManifest: SportManifest<BadmintonState, BadmintonAction, BadmintonRules> = {
    id: 'badminton',
    label: 'Badminton',
    icon: '🏸',
    description: 'BWF rules: best of 3 games to 21 with deuce',
    category: 'core',
    accent: 'bg-green-500',
    devStatus: 'live',
    scoringMode: 'sets-points',
    rules: { gamesToWin: 2, pointsToWin: 21 },
    createInitialState: (_rules: BadmintonRules): BadmintonState => ({
        gameRunning: false,
        scoreA: 0,
        scoreB: 0,
        gamesWonA: 0,
        gamesWonB: 0,
        currentGame: 1,
        serviceSide: 'A',
    }),
    reducer,
    normalizeResult,
    canAdminOverride: true,
    setupPage: BadmintonSetupPage,
    components: {
        TabletController: BadmintonHostConsole,
        HostConsole: BadmintonHostConsole,
        WallCard: BadmintonWallCard,
        SpectatorView: BadmintonSpectator,
    },
};
