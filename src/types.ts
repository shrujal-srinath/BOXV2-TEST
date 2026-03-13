// src/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Unified Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

// ============================================
// 1. PLAYER & TEAM DATA
// ============================================

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

// ============================================
// 2. GAME SETTINGS & STATE
// ============================================

export interface GameSettings {
  gameName: string;
  periodDuration: number;
  shotClockDuration: number;
  periodType: 'quarter' | 'half';
  periods?: number;
  courtNumber?: string;
  tournamentId?: string;
  fixtureId?: string; // Links game back to its bracket fixture
}

export interface GameState {
  period: number;
  gameTime: { minutes: number; seconds: number; tenths: number };
  shotClock: number;
  gameRunning: boolean;
  shotClockRunning: boolean;
  possession: 'A' | 'B';
}

export interface BasketballGame {
  code: string;
  hostId: string;
  sport: string;
  sportId?: string;
  status: 'live' | 'completed' | 'archived';
  gameType: 'local' | 'online';
  createdAt: number;
  lastUpdate: number;
  settings: GameSettings;
  gameState: GameState;
  teamA: TeamData;
  teamB: TeamData;
}

// ============================================
// 3. TOURNAMENT ARCHITECTURE — CORE TYPES
// ============================================

/** Sports that can be scheduled in a tournament */
export type SchedulableSport =
  | 'basketball'
  | 'badminton'
  | 'volleyball'
  | 'football'
  | 'kabaddi'
  | 'tabletennis'
  | 'cricket'
  | 'general';

/** SportType is a subset of SchedulableSport (legacy alias kept for compat) */
export type SportType = SchedulableSport;

/** Gender categories for divisions */
export type GenderCategory = 'men' | 'women' | 'mixed';

/** Competition formats */
export type TournamentFormat = 'knockout' | 'roundrobin' | 'group+knockout';

// ============================================
// 4. DIVISION CONFIG
// ============================================

export interface DivisionConfig {
  /** Deterministic ID: `{sport}_{gender}` e.g. "basketball_men" */
  id: string;
  sport: SportType;
  gender: GenderCategory;
  isActive: boolean;
  format: TournamentFormat;
  /** Power-of-2 bracket size (4, 8, 16, 32, 64) */
  bracketSize?: number;
  /** Division lifecycle status */
  status: 'setup_required' | 'draft' | 'published' | 'completed';
  /** Final winner team name — set when division completes */
  champion?: string;
}

// ============================================
// 5. TOURNAMENT DOCUMENT
// ============================================

export interface Tournament {
  id: string;
  adminId: string;
  name: string;
  logoUrl?: string;
  organizer?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  /** Tournament lifecycle status */
  status: 'draft' | 'active' | 'archived';
  /** Court config per sport: { basketball: { courts: 2 }, ... } */
  sportConfig: {
    [key in SportType]?: {
      courts: number;
    };
  };
  /** All divisions, keyed by divisionId */
  divisions: {
    [divisionId: string]: DivisionConfig;
  };
  /** User IDs that can score matches */
  approvedScorers: string[];
  /** Pending join requests */
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

// ============================================
// 6. TOURNAMENT FIXTURE (bracket node)
// ============================================

export interface TournamentFixture {
  id: string;
  tournamentId: string;
  /** Which division this fixture belongs to */
  divisionId: string;
  sport: SportType;
  gender: GenderCategory;

  /** Team names — "TBD" until bracket seeds propagate */
  teamA: string;
  teamB: string;

  /** Scheduling */
  court: string;   // "Court 1" | "Unassigned"
  time: string;    // "10:00 AM" | "Pending"
  date?: string;

  /** Game lifecycle */
  status: 'scheduled' | 'live' | 'completed';
  gameCode?: string; // Links to live BasketballGame doc

  /** Bracket topology */
  round?: number;
  matchNumber?: number;
  /** ID of the fixture in the NEXT round that the winner feeds into */
  nextMatchId?: string | null;
  /** Which slot (A or B) the winner fills in nextMatchId */
  bracketParent?: 'A' | 'B' | null;

  /** Result */
  winnerSide?: 'A' | 'B';
  finalScore?: { teamA: number; teamB: number };

  /** Scheduling metadata */
  isBye?: boolean;
  scorerId?: string; // UID of assigned scorer
  actualStartTime?: number;
  actualEndTime?: number;
}

// ============================================
// 7. LEGACY — TournamentConfig
// (kept for TournamentSetup backwards compat)
// ============================================

/** @deprecated Use Tournament.sportConfig + Tournament.divisions instead */
export interface TournamentConfig {
  sports: {
    [key in SportType]?: {
      isActive: boolean;
      courts: number;
    };
  };
}