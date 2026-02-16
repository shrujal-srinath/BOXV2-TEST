// src/types.ts
//
// CHANGE LOG (RTDB clock migration):
//   - GameState now includes startedAt and shotClockStartedAt
//     These are written to RTDB (not Firestore) by rtdbClockService.
//     They are optional so existing Firestore documents don't break.
//   - All other types unchanged.

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
  sport?: string;
}

// ══════════════════════════════════════════════
// 4. GAME STATE
//
// NOTE: startedAt and shotClockStartedAt are RTDB-only fields.
// They are never stored in Firestore game documents.
// They are typed here so TypeScript doesn't complain when
// RTDBClockState (which extends this shape) includes them.
// ══════════════════════════════════════════════
export interface GameState {
  period: number;
  gameTime: { minutes: number; seconds: number; tenths: number };
  shotClock: number;
  gameRunning: boolean;
  shotClockRunning: boolean;
  possession: 'A' | 'B';

  // RTDB clock anchor fields — present in RTDB, absent in Firestore
  // Optional so existing Firestore documents remain valid
  startedAt?: number | null;
  shotClockStartedAt?: number | null;
}

// ══════════════════════════════════════════════
// 5. BASKETBALL GAME (Firestore document shape)
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
// 6. SPORT TYPE
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
// 7. DIVISION CONFIG
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
}

// ══════════════════════════════════════════════
// 10. BACKWARD COMPAT
// ══════════════════════════════════════════════
export interface TournamentConfig {
  sports: { [key in SportType]?: { isActive: boolean; courts: number } };
}