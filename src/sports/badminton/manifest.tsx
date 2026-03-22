// src/sports/badminton/manifest.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Badminton Sport Manifest (v3 — BWF Rules + GameContext)
//
// FIXES:
//   [1] BWF scoring: first to 21, deuce win-by-2, hard cap 30, auto-advance
//   [2] NEXT_GAME blocks on tied scores
//   [3] Match-complete guard blocks scoring after win
//   [4] Team names from GameContext (not hardcoded, not in state)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type {
    SportManifest,
    WallCardProps,
    SpectatorProps,
    SportComponentProps,
    GameContext,
} from '../../core/types/Manifest';
import type { BaseGameState, NormalizedResult } from '../../core/types/Game';

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
}

export type BadmintonAction =
    | { type: 'ADD_POINTS'; team: 'A' | 'B'; amount: number }
    | { type: 'SUB_POINTS'; team: 'A' | 'B' }
    | { type: 'NEXT_GAME' };

// ─── 2. Engine Logic ──────────────────────────────────────────────────────────

const reducer = (
    state: BadmintonState,
    action: BadmintonAction,
    _rules: BadmintonRules
): BadmintonState => {
    // Block all actions if match is already won (SUB_POINTS allowed for corrections)
    const matchWon = state.gamesWonA >= _rules.gamesToWin || state.gamesWonB >= _rules.gamesToWin;
    if (matchWon && action.type !== 'SUB_POINTS') return state;

    switch (action.type) {
        case 'ADD_POINTS': {
            const newScoreA = action.team === 'A' ? state.scoreA + action.amount : state.scoreA;
            const newScoreB = action.team === 'B' ? state.scoreB + action.amount : state.scoreB;

            const target = _rules.pointsToWin; // 21
            const isDeuce = newScoreA >= (target - 1) && newScoreB >= (target - 1);
            const hardCap = 30;

            let gameWon: 'A' | 'B' | null = null;

            if (newScoreA >= hardCap || newScoreB >= hardCap) {
                gameWon = newScoreA >= hardCap ? 'A' : 'B';
            } else if (isDeuce) {
                if (newScoreA - newScoreB >= 2) gameWon = 'A';
                else if (newScoreB - newScoreA >= 2) gameWon = 'B';
            } else {
                if (newScoreA >= target) gameWon = 'A';
                else if (newScoreB >= target) gameWon = 'B';
            }

            if (gameWon) {
                return {
                    ...state,
                    scoreA: 0,
                    scoreB: 0,
                    currentGame: state.currentGame + 1,
                    gamesWonA: state.gamesWonA + (gameWon === 'A' ? 1 : 0),
                    gamesWonB: state.gamesWonB + (gameWon === 'B' ? 1 : 0),
                };
            }

            return { ...state, scoreA: newScoreA, scoreB: newScoreB };
        }

        case 'SUB_POINTS':
            return action.team === 'A'
                ? { ...state, scoreA: Math.max(0, state.scoreA - 1) }
                : { ...state, scoreB: Math.max(0, state.scoreB - 1) };

        case 'NEXT_GAME': {
            if (state.scoreA === state.scoreB) return state;

            const winnerA = state.scoreA > state.scoreB;
            return {
                ...state,
                scoreA: 0,
                scoreB: 0,
                currentGame: state.currentGame + 1,
                gamesWonA: state.gamesWonA + (winnerA ? 1 : 0),
                gamesWonB: state.gamesWonB + (!winnerA ? 1 : 0),
            };
        }

        default:
            return state;
    }
};

const normalizeResult = (state: BadmintonState, rules: BadmintonRules): NormalizedResult => {
    const isComplete =
        state.gamesWonA === rules.gamesToWin || state.gamesWonB === rules.gamesToWin;
    return {
        isComplete,
        winner: isComplete ? (state.gamesWonA > state.gamesWonB ? 'A' : 'B') : null,
        displayScore: `Sets: ${state.gamesWonA}–${state.gamesWonB}  (Game ${state.currentGame}: ${state.scoreA}–${state.scoreB})`,
        teamAScore: state.gamesWonA,
        teamBScore: state.gamesWonB,
    };
};

// ─── 3. UI Components ─────────────────────────────────────────────────────────

/** Shared scoreboard — reads team names from context, NOT from state */
const BadmintonScoreboard: React.FC<{ state: BadmintonState; context: GameContext }> = ({ state, context }) => {
    const matchWon = state.gamesWonA >= 2 || state.gamesWonB >= 2;
    const nameA = context.teamA.name;
    const nameB = context.teamB.name;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 font-sans">
            {/* Match status banner */}
            {matchWon && (
                <div className="px-6 py-2 bg-emerald-900/30 border border-emerald-700/50 rounded-full">
                    <span className="text-emerald-400 text-sm font-black uppercase tracking-widest">
                        Match Won — {state.gamesWonA > state.gamesWonB ? nameA : nameB}
                    </span>
                </div>
            )}

            {/* Sets bar */}
            <div className="flex items-center gap-6 text-emerald-400 text-sm font-black uppercase tracking-widest">
                <span>Game {state.currentGame}</span>
                <span className="text-zinc-600">·</span>
                <span>Sets: {state.gamesWonA} – {state.gamesWonB}</span>
            </div>

            {/* Main scores */}
            <div className="w-full max-w-4xl grid grid-cols-[1fr_auto_1fr] gap-8 items-center px-8">
                {/* Team A */}
                <div className="flex flex-col items-center">
                    <div className="text-2xl font-black uppercase tracking-tight mb-4"
                        style={{ color: context.teamA.color || '#10b981' }}>
                        {nameA}
                    </div>
                    <div className="text-[12rem] font-bold leading-none font-mono text-white"
                        style={{ filter: `drop-shadow(0 0 30px ${context.teamA.color || '#10b981'}66)` }}>
                        {state.scoreA}
                    </div>
                    <div className="flex gap-1.5 mt-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < state.gamesWonA
                                    ? 'shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                                    : 'bg-zinc-800'
                                }`} style={i < state.gamesWonA ? { background: context.teamA.color || '#10b981' } : {}} />
                        ))}
                    </div>
                </div>

                {/* Center */}
                <div className="flex flex-col items-center gap-3">
                    <div className="text-5xl font-black text-zinc-700">VS</div>
                </div>

                {/* Team B */}
                <div className="flex flex-col items-center">
                    <div className="text-2xl font-black uppercase tracking-tight mb-4"
                        style={{ color: context.teamB.color || '#38bdf8' }}>
                        {nameB}
                    </div>
                    <div className="text-[12rem] font-bold leading-none font-mono text-white"
                        style={{ filter: `drop-shadow(0 0 30px ${context.teamB.color || '#38bdf8'}66)` }}>
                        {state.scoreB}
                    </div>
                    <div className="flex gap-1.5 mt-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < state.gamesWonB
                                    ? 'shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                                    : 'bg-zinc-800'
                                }`} style={i < state.gamesWonB ? { background: context.teamB.color || '#38bdf8' } : {}} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const BadmintonWallCard: React.FC<WallCardProps<BadmintonState>> = ({ state, context }) => (
    <BadmintonScoreboard state={state} context={context} />
);

const BadmintonSpectator: React.FC<SpectatorProps<BadmintonState>> = ({ state, context }) => (
    <BadmintonScoreboard state={state} context={context} />
);

const BadmintonController: React.FC<SportComponentProps<BadmintonState, BadmintonAction>> = ({ state, dispatch, context }) => {
    const matchWon = state.gamesWonA >= 2 || state.gamesWonB >= 2;
    const nameA = context.teamA.name;
    const nameB = context.teamB.name;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 p-8">
            <BadmintonScoreboard state={state} context={context} />
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                <button
                    onClick={() => dispatch({ type: 'ADD_POINTS', team: 'A', amount: 1 })}
                    disabled={matchWon}
                    className="py-4 bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 font-black text-lg rounded-xl transition-all active:scale-95">
                    +1 {nameA}
                </button>
                <button
                    onClick={() => dispatch({ type: 'ADD_POINTS', team: 'B', amount: 1 })}
                    disabled={matchWon}
                    className="py-4 bg-sky-700 hover:bg-sky-600 disabled:bg-zinc-800 disabled:text-zinc-600 font-black text-lg rounded-xl transition-all active:scale-95">
                    +1 {nameB}
                </button>
                <button onClick={() => dispatch({ type: 'SUB_POINTS', team: 'A' })}
                    className="py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-bold rounded-xl transition-all">
                    -1 {nameA}
                </button>
                <button onClick={() => dispatch({ type: 'SUB_POINTS', team: 'B' })}
                    className="py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-bold rounded-xl transition-all">
                    -1 {nameB}
                </button>
                <button
                    onClick={() => dispatch({ type: 'NEXT_GAME' })}
                    disabled={matchWon || state.scoreA === state.scoreB}
                    className="col-span-2 py-3 bg-zinc-900 border border-zinc-700 hover:border-white disabled:border-zinc-800 disabled:text-zinc-700 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all">
                    {matchWon ? 'Match Complete' : state.scoreA === state.scoreB ? 'Break Tie First' : 'End Game →'}
                </button>
            </div>
        </div>
    );
};

// ─── 4. Manifest Export ───────────────────────────────────────────────────────

export const badmintonManifest: SportManifest<BadmintonState, BadmintonAction, BadmintonRules> = {
    id: 'badminton',
    label: 'Badminton',
    scoringMode: 'sets-points',
    rules: { gamesToWin: 2, pointsToWin: 21 },
    createInitialState: (_rules: BadmintonRules): BadmintonState => ({
        gameRunning: false,
        scoreA: 0,
        scoreB: 0,
        gamesWonA: 0,
        gamesWonB: 0,
        currentGame: 1,
    }),
    reducer,
    normalizeResult,
    canAdminOverride: true,
    components: {
        WallCard: BadmintonWallCard,
        SpectatorView: BadmintonSpectator,
        TabletController: BadmintonController,
        HostConsole: BadmintonController,
    },
};