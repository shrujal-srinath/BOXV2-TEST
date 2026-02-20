// src/sports/basketball/manifest.ts
import React from 'react';
import { SportManifest, SportComponentProps, WallCardProps, SpectatorProps } from '../../core/types/Manifest';
import { BaseGameState, NormalizedResult } from '../../core/types/Game';

// ══════════════════════════════════════════════
// 1. TYPES & RULES
// ══════════════════════════════════════════════
export interface BasketballRules {
    periods: number;               // e.g., 4 quarters
    periodDurationMin: number;     // e.g., 10 minutes
    shotClockSec: number;          // e.g., 24 seconds
    timeoutsPerHalf: number;
}

export interface BasketballState extends BaseGameState {
    scoreA: number;
    scoreB: number;
    period: number;
    shotClock: number;
    shotClockRunning: boolean;
    possession: 'A' | 'B' | null;
    foulsA: number;
    foulsB: number;
    timeoutsA: number;
    timeoutsB: number;
}

export type BasketballAction =
    | { type: 'ADD_POINTS'; team: 'A' | 'B'; amount: number }
    | { type: 'ADD_FOUL'; team: 'A' | 'B' }
    | { type: 'USE_TIMEOUT'; team: 'A' | 'B' }
    | { type: 'NEXT_PERIOD' }
    | { type: 'TOGGLE_MAIN_CLOCK' }
    | { type: 'RESET_SHOT_CLOCK' };

// ══════════════════════════════════════════════
// 2. THE REDUCER (The Logic Engine)
// ══════════════════════════════════════════════
const reducer = (state: BasketballState, action: BasketballAction, rules: BasketballRules): BasketballState => {
    switch (action.type) {
        case 'ADD_POINTS':
            return {
                ...state,
                scoreA: action.team === 'A' ? Math.max(0, state.scoreA + action.amount) : state.scoreA,
                scoreB: action.team === 'B' ? Math.max(0, state.scoreB + action.amount) : state.scoreB,
            };
        case 'ADD_FOUL':
            return {
                ...state,
                foulsA: action.team === 'A' ? state.foulsA + 1 : state.foulsA,
                foulsB: action.team === 'B' ? state.foulsB + 1 : state.foulsB,
            };
        case 'NEXT_PERIOD':
            return {
                ...state,
                period: state.period + 1,
                foulsA: 0, // Team fouls reset every period
                foulsB: 0,
                gameRunning: false, // Stop clock on period end
            };
        case 'TOGGLE_MAIN_CLOCK':
            return {
                ...state,
                gameRunning: !state.gameRunning,
                startedAt: !state.gameRunning ? Date.now() : null, // Used for drift calculation
            };
        default:
            return state;
    }
};

// ══════════════════════════════════════════════
// 3. THE TOURNAMENT BRIDGE
// ══════════════════════════════════════════════
const normalizeResult = (state: BasketballState, rules: BasketballRules): NormalizedResult => {
    // Game is complete if we are past the final period AND it's not a tie
    const isComplete = state.period > rules.periods && state.scoreA !== state.scoreB;

    let winner: 'A' | 'B' | 'DRAW' | null = null;
    if (isComplete) {
        winner = state.scoreA > state.scoreB ? 'A' : 'B';
    }

    return {
        isComplete,
        winner,
        displayScore: `${state.scoreA} - ${state.scoreB}`,
        teamAScore: state.scoreA,
        teamBScore: state.scoreB,
        metadata: {
            totalFouls: state.foulsA + state.foulsB
        }
    };
};

// ══════════════════════════════════════════════
// 4. PLACEHOLDER COMPONENTS (To be replaced with your real UI)
// ══════════════════════════════════════════════
const TabletController: React.FC<SportComponentProps<BasketballState, BasketballAction>> = ({ state, dispatch }) => (
    <div className="p-4 bg-gray-900 text-white">
        <h2>Basketball Controller</h2>
        <div className="flex gap-4">
            <button onClick={() => dispatch({ type: 'ADD_POINTS', team: 'A', amount: 1 })}>Team A +1</button>
            <button onClick={() => dispatch({ type: 'ADD_POINTS', team: 'B', amount: 1 })}>Team B +1</button>
        </div>
        <p>Score: {state.scoreA} - {state.scoreB}</p>
    </div>
);


const WallCard: React.FC<WallCardProps<BasketballState>> = ({ state }) => (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 font-sans">
        <div className="w-full max-w-5xl grid grid-cols-[1fr_auto_1fr] gap-12 items-center px-8">
            {/* Team A */}
            <div className="flex flex-col items-center">
                <div className="text-3xl font-black uppercase tracking-tight text-red-500 mb-4">HOME</div>
                <div className="text-[14rem] font-bold leading-none font-mono text-white drop-shadow-[0_0_25px_rgba(220,38,38,0.4)]">
                    {state.scoreA}
                </div>
            </div>
            {/* Center */}
            <div className="flex flex-col items-center gap-6">
                <div className="bg-zinc-900 px-6 py-2 rounded-full border border-zinc-700 text-zinc-400 font-bold tracking-widest text-xl">
                    {state.period <= 4 ? `Q${state.period}` : `OT${state.period - 4}`}
                </div>
                <div className={`text-8xl font-mono font-bold tabular-nums ${state.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                    {state.shotClock}
                </div>
                <div className="text-xs text-zinc-600 uppercase tracking-widest">Shot Clock</div>
            </div>
            {/* Team B */}
            <div className="flex flex-col items-center">
                <div className="text-3xl font-black uppercase tracking-tight text-blue-500 mb-4">AWAY</div>
                <div className="text-[14rem] font-bold leading-none font-mono text-white drop-shadow-[0_0_25px_rgba(37,99,235,0.4)]">
                    {state.scoreB}
                </div>
            </div>
        </div>
    </div>
);

// ══════════════════════════════════════════════
// 5. THE EXPORTED MANIFEST
// ══════════════════════════════════════════════
export const basketballManifest: SportManifest<BasketballState, BasketballAction, BasketballRules> = {
    id: 'basketball',
    label: 'Basketball',
    scoringMode: 'timer-points',
    rules: {
        periods: 4,
        periodDurationMin: 10,
        shotClockSec: 24,
        timeoutsPerHalf: 3,
    },
    createInitialState: (rules) => ({
        gameRunning: false,
        scoreA: 0,
        scoreB: 0,
        period: 1,
        shotClock: rules.shotClockSec,
        shotClockRunning: false,
        possession: null,
        foulsA: 0,
        foulsB: 0,
        timeoutsA: rules.timeoutsPerHalf,
        timeoutsB: rules.timeoutsPerHalf,
    }),
    reducer,
    normalizeResult,
    canAdminOverride: true,
    components: {
        TabletController,
        HostConsole: TabletController, // Reusing for now
        WallCard,
        SpectatorView: WallCard, // Reusing for now
    }
};