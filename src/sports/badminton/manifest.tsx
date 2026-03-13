// src/sports/badminton/manifest.tsx
import React from 'react';
import type { SportManifest, WallCardProps, SpectatorProps, SportComponentProps } from '../../core/types/Manifest';
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
    switch (action.type) {
        case 'ADD_POINTS':
            return action.team === 'A'
                ? { ...state, scoreA: state.scoreA + action.amount }
                : { ...state, scoreB: state.scoreB + action.amount };
        case 'SUB_POINTS':
            return action.team === 'A'
                ? { ...state, scoreA: Math.max(0, state.scoreA - 1) }
                : { ...state, scoreB: Math.max(0, state.scoreB - 1) };
        case 'NEXT_GAME': {
            const winnerA = state.scoreA >= state.scoreB;
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

/** Shared scoreboard layout used by WallCard, SpectatorView, and tablet stubs */
const BadmintonScoreboard: React.FC<{ state: BadmintonState }> = ({ state }) => (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 font-sans">
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
                <div className="text-2xl font-black uppercase tracking-tight text-emerald-400 mb-4">HOME</div>
                <div className="text-[12rem] font-bold leading-none font-mono text-white drop-shadow-[0_0_30px_rgba(52,211,153,0.4)]">
                    {state.scoreA}
                </div>
                <div className="flex gap-1.5 mt-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full ${i < state.gamesWonA ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-zinc-800'}`} />
                    ))}
                </div>
            </div>

            {/* Center divider */}
            <div className="flex flex-col items-center gap-3">
                <div className="text-5xl font-black text-zinc-700">VS</div>
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center">
                <div className="text-2xl font-black uppercase tracking-tight text-sky-400 mb-4">AWAY</div>
                <div className="text-[12rem] font-bold leading-none font-mono text-white drop-shadow-[0_0_30px_rgba(56,189,248,0.4)]">
                    {state.scoreB}
                </div>
                <div className="flex gap-1.5 mt-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full ${i < state.gamesWonB ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-zinc-800'}`} />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const BadmintonWallCard: React.FC<WallCardProps<BadmintonState>> = ({ state }) => (
    <BadmintonScoreboard state={state} />
);

const BadmintonSpectator: React.FC<SpectatorProps<BadmintonState>> = ({ state }) => (
    <BadmintonScoreboard state={state} />
);

// Tablet / HostConsole stub — full controller can be built later
const BadmintonController: React.FC<SportComponentProps<BadmintonState, BadmintonAction>> = ({ state, dispatch }) => (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 p-8">
        <BadmintonScoreboard state={state} />
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <button onClick={() => dispatch({ type: 'ADD_POINTS', team: 'A', amount: 1 })}
                className="py-4 bg-emerald-700 hover:bg-emerald-600 font-black text-lg rounded-xl transition-all active:scale-95">
                +1 HOME
            </button>
            <button onClick={() => dispatch({ type: 'ADD_POINTS', team: 'B', amount: 1 })}
                className="py-4 bg-sky-700 hover:bg-sky-600 font-black text-lg rounded-xl transition-all active:scale-95">
                +1 AWAY
            </button>
            <button onClick={() => dispatch({ type: 'SUB_POINTS', team: 'A' })}
                className="py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-bold rounded-xl transition-all">
                −1 HOME
            </button>
            <button onClick={() => dispatch({ type: 'SUB_POINTS', team: 'B' })}
                className="py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-bold rounded-xl transition-all">
                −1 AWAY
            </button>
            <button onClick={() => dispatch({ type: 'NEXT_GAME' })}
                className="col-span-2 py-3 bg-zinc-900 border border-zinc-700 hover:border-white text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all">
                End Game →
            </button>
        </div>
    </div>
);

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
