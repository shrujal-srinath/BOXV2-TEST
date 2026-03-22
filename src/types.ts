// src/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Unified Type Definitions (v5.0 — CANONICAL)
//
// THIS FILE IS THE SINGLE SOURCE OF TRUTH.
//
// History of type conflicts this resolves:
//   - Old types.ts: status 'finished', 3-sport SportType, scorerPin inline,
//     config: TournamentConfig, no DivisionConfig/GenderCategory
//   - v4.1 types.ts: status 'completed', 8-sport SchedulableSport, scorerPin
//     in tournament_secrets, sportConfig + divisions, full bracket topology
//   - core/types/Game.ts: Game<TState, TRules> generic with BaseTeam (no players)
//   - CreateTournamentModal.tsx: inline duplicate types with different shapes
//
// Rules:
//   1. EVERY component imports from THIS file. No inline type definitions.
//   2. If a type exists in core/types/Game.ts, re-export it from here.
//   3. Legacy aliases are clearly marked @deprecated with migration notes.
//   4. `sportId` is the canonical field name. `sport` is a legacy alias only.
// ─────────────────────────────────────────────────────────────────────────────

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  1. RE-EXPORTS FROM CORE (the v2 generic game engine types)              ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// These are the "real" types the game engine uses. Re-exporting so that
// components can import everything from '../types' without knowing about
// the core/ directory structure.
export type {
  ScoringMode,
  NormalizedResult,
  BaseGameState,
  BaseTeam,
  Game,
} from './core/types/Game';

export type {
  SportManifest,
  SportComponentProps,
  SpectatorProps,
  WallCardProps,
} from './core/types/Manifest';

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  2. PLAYER & TEAM DATA (basketball-specific detailed stats)              ║
// ╚════════════════════════════════════════════════════════════════════════════╝

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

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  3. GAME SETTINGS & STATE                                                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

export interface GameSettings {
  gameName: string;
  periodDuration: number;
  shotClockDuration: number;
  periodType: 'quarter' | 'half';
  gameMode?: 'quick' | 'stats' | 'advanced';
  periods?: number;
  courtNumber?: string;
  tournamentId?: string;
  /** Links this game back to its bracket fixture (set when launched from tournament) */
  fixtureId?: string;
}

export interface GameState {
  period: number;
  gameTime: { minutes: number; seconds: number; tenths: number };
  shotClock: number;
  gameRunning: boolean;
  shotClockRunning: boolean;
  possession: 'A' | 'B';
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  4. BASKETBALL GAME (the "legacy flat" type used by HostConsole,         ║
// ║     SpectatorView, Dashboard, and supabaseGameService)                   ║
// ║                                                                          ║
// ║  NOTE: The v2 Game<TState, TRules> from core/types/Game.ts is the        ║
// ║  forward-looking type. BasketballGame is the shape stored in Supabase    ║
// ║  `games.data` JSONB. These two need a mapping layer (see normalizers     ║
// ║  in supabaseGameService.ts).                                             ║
// ╚════════════════════════════════════════════════════════════════════════════╝

export interface BasketballGame {
  code: string;
  hostId: string;
  /**
   * CANONICAL sport identifier. Always use this field.
   * Stored as `sportId` in the Supabase `games` table column.
   */
  sportId: string;
  /**
   * @deprecated Legacy alias for sportId. Kept for backward compat with older
   * DB rows and components that haven't migrated. ALWAYS prefer `sportId`.
   * The normalizeGameData() function in supabaseGameService ensures both are set.
   */
  sport: string;
  /** 'live' | 'completed' | 'archived'. NEVER 'finished' — use normalizeGameData(). */
  status: 'live' | 'completed' | 'archived';
  gameType: 'local' | 'online';
  createdAt: number;
  lastUpdate: number;
  settings: GameSettings;
  gameState: GameState;
  teamA: TeamData;
  teamB: TeamData;
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  5. TOURNAMENT ARCHITECTURE — CORE TYPES                                 ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/** All sports that can be scheduled in a tournament */
export type SchedulableSport =
  | 'basketball'
  | 'badminton'
  | 'volleyball'
  | 'football'
  | 'kabaddi'
  | 'tabletennis'
  | 'cricket'
  | 'general';

/**
 * Alias kept for import compatibility across the codebase.
 * Both names refer to the exact same type.
 */
export type SportType = SchedulableSport;

/** Gender categories for tournament divisions */
export type GenderCategory = 'men' | 'women' | 'mixed';

/**
 * Competition bracket formats.
 * NOTE: 'random' and 'league' were in the old types — they mapped to
 * 'knockout' and 'roundrobin' respectively. Only canonical values below.
 */
export type TournamentFormat = 'knockout' | 'roundrobin' | 'group+knockout';

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  6. DIVISION CONFIG                                                      ║
// ╚════════════════════════════════════════════════════════════════════════════╝

export interface DivisionConfig {
  /** Deterministic ID: `{sport}_{gender}` e.g. "basketball_men" */
  id: string;
  sport: SportType;
  gender: GenderCategory;
  isActive: boolean;
  format: TournamentFormat;
  /** Power-of-2 bracket size (4, 8, 16, 32, 64) — knockout only */
  bracketSize?: number;
  /** Division lifecycle status */
  status: 'setup_required' | 'draft' | 'published' | 'completed';
  /** Final winner team name — set when division completes */
  champion?: string;
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  7. TOURNAMENT DOCUMENT                                                  ║
// ║                                                                          ║
// ║  v4.1+ schema: scorerPin moved to `tournament_secrets` table.            ║
// ║  Use getAdminPin() RPC to read it, NEVER read it from this object.       ║
// ╚════════════════════════════════════════════════════════════════════════════╝

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
  /** Per-sport court configuration: e.g. { basketball: { courts: 2 } } */
  sportConfig: {
    [key in SportType]?: {
      courts: number;
    };
  };
  /** All divisions keyed by divisionId: e.g. "basketball_men" */
  divisions: {
    [divisionId: string]: DivisionConfig;
  };
  /** User IDs approved to score matches */
  approvedScorers: string[];
  /** Pending join requests from volunteers */
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

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  8. TOURNAMENT FIXTURE (bracket node)                                    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

export interface TournamentFixture {
  id: string;
  tournamentId: string;
  /** Which division this fixture belongs to: e.g. "basketball_men" */
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
  /** Links to the live BasketballGame.code when match is started */
  gameCode?: string;

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
  /** UID of the assigned scorer volunteer */
  scorerId?: string;
  actualStartTime?: number;
  actualEndTime?: number;
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  9. LEGACY ALIASES — @deprecated                                         ║
// ║                                                                          ║
// ║  These exist ONLY so old components don't break on import.               ║
// ║  They should be migrated away over time.                                 ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * @deprecated Use Tournament.sportConfig + Tournament.divisions instead.
 * Kept for CreateTournamentModal.tsx backward compat.
 * Old shape: config.sports[sport].isActive / .courts
 */
export interface TournamentConfig {
  sports: {
    [key in SportType]?: {
      isActive: boolean;
      courts: number;
    };
  };
}