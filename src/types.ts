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
  SportDevStatus,
  SportCategory,
  SportSetupPageProps,
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

/**
 * @deprecated This is the legacy flat type. New code should use Game<TState, TRules> from core/types/Game.ts
 * 
 * MIGRATION PATH:
 * 1. If you're reading from Supabase, use toGenericGame() to convert
 * 2. If you're displaying UI, use the sport manifest's components
 * 3. If you're writing new features, use Game<TState, TRules> directly
 * 
 * This type will be removed in v6.0 (target: Q2 2026)
 */
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
  // ── Core sports (always shown on Dashboard) ──────────────────────────────
  | 'basketball'
  | 'badminton'
  | 'volleyball'
  | 'kabaddi'
  | 'tabletennis'
  | 'general'
  // ── Extended sports ("More Sports" section) ───────────────────────────────
  | 'cricket'
  | 'football'
  | 'hockey'
  | 'khokho'
  | 'netball'
  | 'tennis'
  | 'handball'
  | 'throwball'
  | 'chess'
  | 'carrom'
  | 'athletics';

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

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  10. PLAYER PASSPORT — full athlete identity system                      ║
// ╚════════════════════════════════════════════════════════════════════════════╝

export interface PlayerProfile {
  id: string;
  auth_user_id: string | null;

  // Identity
  full_name: string;
  display_name: string | null;
  date_of_birth: string | null;       // ISO date 'YYYY-MM-DD'
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;

  // Contact
  phone_number: string | null;
  email: string | null;

  // Academic
  usn: string | null;
  college_name: string | null;
  college_roll_no: string | null;

  // Physical
  height_cm: number | null;
  weight_kg: number | null;
  dominant_hand: 'left' | 'right' | 'ambidextrous' | null;

  // Athletic defaults
  primary_position: string | null;
  jersey_number: string | null;
  sport_ids: string[];

  // Profile
  bio: string | null;
  profile_photo_url: string | null;

  // Extended athletic
  secondary_position: string | null;
  wingspan_cm: number | null;
  vertical_leap_cm: number | null;
  shuttle_run_sec: number | null;
  bench_press_kg: number | null;
  achievements: string[] | null;

  // Media / social
  highlight_video_url: string | null;
  instagram_handle: string | null;
  youtube_channel: string | null;
  twitter_handle: string | null;

  // Academic extended
  academic_year: string | null;
  graduation_year: number | null;

  // Passport
  player_code: string;
  is_verified: boolean;
  is_claimed: boolean;
  registered_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface PlayerTeam {
  id: string;
  player_id: string;
  team_type: 'college' | 'club' | 'school' | 'state' | 'national' | 'pickup';
  team_name: string;
  jersey_number: string | null;
  position: string | null;
  role: 'player' | 'captain' | 'vice_captain' | 'coach' | null;
  season_from: string | null;
  season_to: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PlayerSportStats {
  id: string;
  player_id: string;
  sport_id: string;
  games_played: number;
  total_score: number;
  stats: Record<string, any>;
  last_played_at: string | null;
  updated_at: string;
}

export interface PlayerGameLog {
  id: string;
  player_id: string;
  game_code: string;
  sport_id: string;
  tournament_id: string | null;
  team_side: 'A' | 'B' | null;
  team_name: string | null;
  score_contribution: number;
  sport_stats: Record<string, any>;
  input_method: string;
  created_at: string;
}

export interface PlayerLeaderboardRow {
  player_id: string;
  full_name: string;
  display_name: string | null;
  jersey_number: string | null;
  player_code: string;
  college_name: string | null;
  profile_photo_url: string | null;
  sport_ids: string[];
  sport_id: string;
  games_played: number;
  total_score: number;
  stats: Record<string, any>;
}

/** @deprecated — alias kept for any code that may still reference PlayerPassport */
export type PlayerPassport = PlayerProfile;