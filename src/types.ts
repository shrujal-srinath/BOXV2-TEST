// src/types.ts
// COMPLETE FILE - Ready to replace your existing types.ts

// ==========================================
// 1. PLAYER & TEAM DATA
// ==========================================

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

// ==========================================
// 2. GAME SETTINGS & STATE
// ==========================================

export interface GameSettings {
  gameName: string;
  periodDuration: number;
  shotClockDuration: number;
  periodType: 'quarter' | 'half';
  courtNumber?: string;
  tournamentId?: string;  // Link to tournament (if part of one)
  sport?: string;
}

export interface GameState {
  period: number;
  gameTime: { minutes: number; seconds: number; tenths: number };
  shotClock: number;
  gameRunning: boolean;
  shotClockRunning: boolean;
  shotClockActive: boolean;
  possessionTeam: 'A' | 'B';
  timeLeft: number;
}

// ==========================================
// 3. BASKETBALL GAME
// ==========================================

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

// ==========================================
// 4. TOURNAMENT ARCHITECTURE
// ==========================================

export type SportType = 'basketball' | 'badminton' | 'volleyball' | 'kabaddi' | 'football' | 'cricket';
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

  // Bracket Logic
  round?: number;
  matchNumber?: number;
  nextMatchId?: string | null;
  bracketParent?: 'A' | 'B';
  winnerSide?: 'A' | 'B';
  isBye?: boolean;

  // NEW FIELDS - Tournament Features (all optional for backwards compatibility)
  actualStartTime?: number;      // Timestamp when scorer started the match
  actualEndTime?: number;        // Timestamp when scorer finished the match
  scorerId?: string;             // UID of the scorer who started the match
  finalScore?: {                 // Final score after match completion
    teamA: number;
    teamB: number;
  };
}

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
    [key in SportType]?: {
      courts: number;
    }
  };

  divisions: {
    [divisionId: string]: DivisionConfig;
  };

  approvedScorers: string[];

  // UPDATED PENDING REQUEST STRUCTURE
  pendingRequests: {
    [userId: string]: {
      displayName: string;
      email: string;
      timestamp: number;
      status: 'pending' | 'approved' | 'rejected';
      // NEW FIELDS
      requestType: 'all' | 'specific';
      requestedSports?: SportType[]; // Only if requestType is 'specific'
    }
  };
  createdAt: number;
}