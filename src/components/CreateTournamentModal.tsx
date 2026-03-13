// src/types.ts
// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH — do not split across files.
//
// FIX LOG (build errors resolved):
//  ✅ GameState.possession — was missing in deployed version
//  ✅ TournamentConfig — re-exported as alias so old files don't break
//  ✅ Tournament uses sportConfig + divisions (new shape)
//  ✅ TeamData has all required fields (score, timeouts, etc.)
// ─────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════
// 1. PLAYER
// ══════════════════════════════════════════════
export interface Player {
    id: string;
    name: string;
    number: string;
    position: string;
    points: number;
    fouls: number;
    assists: number;
    rebounds: number;
    steals: number;
    blocks: number;
    turnovers: number;
    disqualified: boolean;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointsMade: number;
    threePointsAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
}

// ══════════════════════════════════════════════
// 2. TEAM
// ══════════════════════════════════════════════
export interface TeamData {
    name: string;
    color: string;
    score: number;
    timeouts: number;
    timeoutsFirstHalf: number;
    timeoutsSecondHalf: number;
    fouls: number;
    foulsThisQuarter: number;
    players: Player[];
}

// ══════════════════════════════════════════════
// 3. GAME SETTINGS
// ══════════════════════════════════════════════
export interface GameSettings {
    gameName: string;
    periodDuration: number;
    shotClockDuration: number;
    periodType: 'quarter' | 'half';
    courtNumber?: string;
    tournamentId?: string;
}

// ══════════════════════════════════════════════
// 4. GAME STATE
// FIX: possession MUST be here — used by HardwareDeck,
// HardwareUI, DiagnosticConsole, ControlDeckClassic,
// GameClock, useBasketballGame, useLocalGame, localGameService
// ══════════════════════════════════════════════
export interface GameState {
    period: number;
    gameTime: { minutes: number; seconds: number; tenths: number };
    shotClock: number;
    gameRunning: boolean;
    shotClockRunning: boolean;
    possession: 'A' | 'B'; // ← REQUIRED — do not remove
}

// ══════════════════════════════════════════════
// 5. BASKETBALL GAME (full document)
// ══════════════════════════════════════════════
export interface BasketballGame {
    code: string;
    hostId: string;
    sport: string;
    status: 'live' | 'finished';
    gameType: 'local' | 'online';
    createdAt: number;
    lastUpdate: number;
    settings: GameSettings;
    gameState: GameState;
    teamA: TeamData;
    teamB: TeamData;
}

// ══════════════════════════════════════════════
// 6. TOURNAMENT — SPORT & FORMAT TYPES
// ══════════════════════════════════════════════
export type SportType =
    | 'basketball'
    | 'badminton'
    | 'volleyball'
    | 'kabaddi'
    | 'football'
    | 'cricket';

export type TournamentFormat = 'random' | 'knockout' | 'league';
export type GenderCategory = 'men' | 'women' | 'mixed';

// ══════════════════════════════════════════════
// 7. DIVISION CONFIG (new architecture)
// ══════════════════════════════════════════════
export interface DivisionConfig {
    id: string;
    sport: SportType;
    gender: GenderCategory;
    isActive: boolean;
    format: TournamentFormat;
    bracketSize?: number;
    status: 'setup_required' | 'draft' | 'published' | 'completed';
}

// ══════════════════════════════════════════════
// 8. TOURNAMENT FIXTURE
// ══════════════════════════════════════════════
export interface TournamentFixture {
    id: string;
    tournamentId: string;
    divisionId: string;
    sport: SportType;
    gender: GenderCategory;
    teamA: string;
    teamB: string;
    court: string;
    time: string;
    date?: string;
    status: 'scheduled' | 'live' | 'completed';
    gameCode?: string;
    // Bracket logic
    round?: number;
    matchNumber?: number;
    nextMatchId?: string | null;
    bracketParent?: 'A' | 'B';
    winnerSide?: 'A' | 'B';
    isBye?: boolean;
}

// ══════════════════════════════════════════════
// 9. TOURNAMENT (new shape — sportConfig + divisions)
// ══════════════════════════════════════════════
export interface Tournament {
    id: string;
    adminId: string;
    name: string;
    logoUrl?: string;
    organizer?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    scorerPin: string;
    status: 'draft' | 'active' | 'archived';
    // New architecture: per-sport court config
    sportConfig: {
        [key in SportType]?: { courts: number };
    };
    // New architecture: per-gender/sport divisions
    divisions: {
        [divisionId: string]: DivisionConfig;
    };
    approvedScorers: string[];
    pendingRequests: {
        [userId: string]: {
            displayName: string;
            email: string;
            timestamp: number;
            status: 'pending' | 'approved' | 'rejected';
        };
    };
    createdAt: number;
}

// ══════════════════════════════════════════════
// 10. BACKWARD-COMPAT ALIAS
//
// CreateTournamentModal.tsx and TournamentSetup.tsx (old version)
// import TournamentConfig from this file.
// Keep this alias so they don't throw "has no exported member".
//
// The old modal uses: config.sports[sport].isActive / .courts
// Map that to the new sportConfig shape via the alias below.
// ══════════════════════════════════════════════
export interface TournamentConfig {
    sports: {
        [key in SportType]?: {
            isActive: boolean;
            courts: number;
        };
    };
}