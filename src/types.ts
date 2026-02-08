// src/types.ts

// ==========================================
// 1. PLAYER & TEAM TYPES
// ==========================================

export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  // Stats
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
  courtNumber?: string;   // e.g. "1", "2" (Used for Wall View)
  tournamentId?: string;  // Links this game to a specific Tournament
}

export interface GameState {
  period: number;
  gameTime: { minutes: number; seconds: number; tenths: number };
  shotClock: number;
  gameRunning: boolean;
  shotClockRunning: boolean;
  possession: 'A' | 'B';
}

// ==========================================
// 3. MAIN GAME OBJECT
// ==========================================

export interface BasketballGame {
  code: string;           // The unique 6-digit Game Code
  hostId: string;         // User ID of the creator
  sport: string;          // 'basketball', 'badminton', etc.
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
      courts: number; // Number of active courts for this sport (e.g. 6)
    };
  };
}

export interface Tournament {
  id: string;             // e.g. "KREE26"
  adminId: string;        // The Creator's User ID
  name: string;           // "Kreedotsav 2026"
  logoUrl?: string;       // Optional URL for branding
  scorerPin: string;      // "8899" - Shared access code for volunteers
  status: 'draft' | 'active' | 'archived';

  // Infrastructure Map (Which sports are active & how many courts)
  config: TournamentConfig;

  // Security & Permissions
  approvedScorers: string[]; // List of User IDs allowed to score games
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