// src/core/types/Game.ts

export type ScoringMode = 'timer-points' | 'sets-points' | 'innings-runs' | 'simple-score';

/**
 * The bridge between a live game and the Tournament Bracket.
 * The tournament engine ONLY reads this object.
 */
export interface NormalizedResult {
    isComplete: boolean;
    winner: 'A' | 'B' | 'DRAW' | null;
    displayScore: string;               // e.g., "76 - 72", "2 - 1"
    teamAScore: number;                 // Used for seeding/tie-breakers
    teamBScore: number;
    completedAt?: number;               // Epoch timestamp of completion
    metadata?: Record<string, unknown>; // Escape hatch for sport-specific stats (e.g., wickets)
}

/**
 * Universal Game State properties that apply to ALL sports.
 */
export interface BaseGameState {
    gameRunning: boolean;
    startedAt?: number | null; // Used for precise clock drift synchronization
}

/**
 * Universal Team properties.
 */
export interface BaseTeam {
    name: string;
    color: string;
    score: number; // The primary score (points, sets won, etc.)
}

/**
 * THE MASTER GAME TYPE
 * This matches our Postgres Hybrid Schema (Relational + JSONB).
 */
export interface Game<TState extends BaseGameState, TRules> {
    // --- Relational Columns (Fast Querying) ---
    id: string;             // UUID
    code: string;           // e.g., '123456' or 'LOCAL-ABC'
    hostId: string;         // UUID of the scorer
    sportId: string;        // e.g., 'basketball'
    status: 'live' | 'completed' | 'archived';
    createdAt: number;
    lastUpdate: number;

    // --- JSONB Columns (Flexible Plugin Data) ---
    rules: TRules;          // e.g., { periods: 4, periodDuration: 10 }
    state: TState;          // e.g., { period: 1, foulsA: 2 }
    teamA: BaseTeam;        // Rosters and universal team stats
    teamB: BaseTeam;
}