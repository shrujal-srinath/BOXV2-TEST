// src/types.ts
//
// HYBRID ARCHITECTURE TYPES
// Merges Tournament System + Live Game Engine (Firestore/RTDB)

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
  // Optional/Contextual fields
  periods?: number;      // Total periods (e.g., 4)
  venue?: string;        // Venue name
  courtNumber?: string;
  tournamentId?: string;
  sport?: string;
}

// ══════════════════════════════════════════════
// 4. GAME TIME
// ══════════════════════════════════════════════
export interface GameTime {
  minutes: number;
  seconds: number;
  tenths: number;
}

// ══════════════════════════════════════════════
// 5. GAME STATE
// ══════════════════════════════════════════════
export interface GameState {
  period: number;
  gameTime: GameTime;
  shotClock: number;
  gameRunning: boolean;
  shotClockRunning: boolean;
  possession: 'A' | 'B' | null;

  // ─── RTDB / HYBRID FIELDS ───
  // These are used by rtdbClockService to calculate precise drift.
  // Optional so Firestore docs without them don't break TS.
  startedAt?: number | null;
  shotClockStartedAt?: number | null;
  timerStartEpoch?: number | null; // Legacy/Backup
}

// ══════════════════════════════════════════════
// 6. BASKETBALL GAME (Firestore document shape)
// ══════════════════════════════════════════════
export interface BasketballGame {
  code: string;
  hostId: string;
  sport: string;
  status: 'live' | 'completed' | 'finished'; // Normalized status
  gameType: 'local' | 'online';
  createdAt: number;
  lastUpdate: number;
  settings: GameSettings;
  gameState: GameState;
  teamA: TeamData;
  teamB: TeamData;
}

// ══════════════════════════════════════════════
// 7. SPORT TYPES & TOURNAMENT CONFIGS
// ══════════════════════════════════════════════
export type SportType =
  | 'basketball'
  | 'badminton'
  | 'volleyball'
  | 'kabaddi'
  | 'football'
  | 'cricket'
  | 'tabletennis'
  | 'general';

export type TournamentFormat = 'random' | 'knockout' | 'league';
export type GenderCategory = 'men' | 'women' | 'mixed';

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
  finalScore?: { teamA: number; teamB: number };
  round?: number;
  matchNumber?: number;
  nextMatchId?: string | null;
  bracketParent?: 'A' | 'B';
  winnerSide?: 'A' | 'B';
  isBye?: boolean;
}

// ══════════════════════════════════════════════
// 9. TOURNAMENT
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
  sportConfig: {
    [key in SportType]?: { courts: number };
  };
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
  accessCode?: string; // Legacy/Helper field
}

// ══════════════════════════════════════════════
// 10. UTILITY / COMPAT
// ══════════════════════════════════════════════
export interface TournamentConfig {
  sports: { [key in SportType]?: { isActive: boolean; courts: number } };
}