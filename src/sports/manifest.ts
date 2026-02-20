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
    <div className= "p-4 bg-gray-900 text-white" >
    <h2>Basketball Controller</h2>
        < div className = "flex gap-4" >
            <button onClick={ () => dispatch({ type: 'ADD_POINTS', team: 'A', amount: 1 }) }> Team A + 1 </button>
                < button onClick = {() => dispatch({ type: 'ADD_POINTS', team: 'B', amount: 1 })}> Team B + 1 </button>
                    </div>
                    < p > Score: { state.scoreA } - { state.scoreB } </p>
                        </div>
);

const WallCard: React.FC<WallCardProps<BasketballState>> = ({ state }) => (
    <div className= "p-8 text-6xl font-bold text-center" >
    { state.scoreA } - { state.scoreB }
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