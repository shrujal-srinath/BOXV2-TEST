// src/types.ts

// ... (Keep Player, TeamData, GameSettings, GameState, BasketballGame as they were) ...

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

export interface GameSettings {
  gameName: string;
  periodDuration: number;
  shotClockDuration: number;
  periodType: 'quarter' | 'half';
  courtNumber?: string;
  tournamentId?: string;
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

export type SportType = 'basketball' | 'badminton' | 'volleyball';

export interface TournamentConfig {
  sports: {
    [key in SportType]?: {
      isActive: boolean;
      courts: number;
    };
  };
}

// NEW: Definition for a Scheduled Match
export interface TournamentFixture {
  id: string;
  tournamentId: string;
  sport: SportType;
  teamA: string;
  teamB: string;
  court: string; // "Court 1"
  time: string;  // "10:00 AM"
  status: 'scheduled' | 'live' | 'completed';
  gameCode?: string; // Links to the live BasketballGame when started
}

export interface Tournament {
  id: string;
  adminId: string;
  name: string;
  logoUrl?: string;
  scorerPin: string;
  status: 'draft' | 'active' | 'archived';
  config: TournamentConfig;
  approvedScorers: string[];
  pendingRequests: {
    [userId: string]: {
      displayName: string;
      email: string;
      timestamp: number;
      status: 'pending' | 'approved' | 'rejected';
    }
  };
  createdAt: number;
}