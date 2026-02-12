// src/types.ts  ← REPLACE ENTIRELY
// Fixes all errors from both Vercel build attempts.

export interface Player {
  id: string; name: string; number: string; position: string;
  points: number; fouls: number; assists: number; rebounds: number;
  steals: number; blocks: number; turnovers: number; disqualified: boolean;
  fieldGoalsMade: number; fieldGoalsAttempted: number;
  threePointsMade: number; threePointsAttempted: number;
  freeThrowsMade: number; freeThrowsAttempted: number;
}

export interface TeamData {
  name: string; color: string; score: number;
  timeouts: number; timeoutsFirstHalf: number; timeoutsSecondHalf: number;
  fouls: number; foulsThisQuarter: number; players: Player[];
}

export interface GameSettings {
  gameName: string; periodDuration: number; shotClockDuration: number;
  periodType: 'quarter' | 'half'; courtNumber?: string; tournamentId?: string;
  sport?: string; // used by tournamentService.startTournamentMatch
}

export interface GameState {
  period: number;
  gameTime: { minutes: number; seconds: number; tenths: number };
  shotClock: number;
  gameRunning: boolean;
  shotClockRunning: boolean;
  possession: 'A' | 'B'; // DO NOT REMOVE — used by 10+ components
}

export interface BasketballGame {
  code: string; hostId: string; sport: string;
  status: 'live' | 'finished'; gameType: 'local' | 'online';
  createdAt: number; lastUpdate: number;
  settings: GameSettings; gameState: GameState;
  teamA: TeamData; teamB: TeamData;
}

export type SportType = 'basketball' | 'badminton' | 'volleyball' | 'kabaddi' | 'football' | 'cricket';
export type TournamentFormat = 'random' | 'knockout' | 'league';
export type GenderCategory = 'men' | 'women' | 'mixed';

export interface DivisionConfig {
  id: string; sport: SportType; gender: GenderCategory;
  isActive: boolean; format: TournamentFormat; bracketSize?: number;
  status: 'setup_required' | 'draft' | 'published' | 'completed';
}

export interface TournamentFixture {
  id: string; tournamentId: string; divisionId: string;
  sport: SportType; gender: GenderCategory;
  teamA: string; teamB: string; court: string; time: string; date?: string;
  status: 'scheduled' | 'live' | 'completed'; gameCode?: string;
  finalScore?: { teamA: number; teamB: number }; // optional, written on completion
  round?: number; matchNumber?: number; nextMatchId?: string | null;
  bracketParent?: 'A' | 'B'; winnerSide?: 'A' | 'B'; isBye?: boolean;
}

export interface Tournament {
  id: string; adminId: string; name: string; logoUrl?: string;
  organizer?: string; location?: string; startDate?: string; endDate?: string;
  scorerPin: string; status: 'draft' | 'active' | 'archived';
  sportConfig: { [key in SportType]?: { courts: number } };
  divisions: { [divisionId: string]: DivisionConfig };
  approvedScorers: string[];
  pendingRequests: {
    [userId: string]: {
      displayName: string; email: string; timestamp: number;
      status: 'pending' | 'approved' | 'rejected';
    };
  };
  createdAt: number;
}

// Backward-compat: CreateTournamentModal + old TournamentSetup import this
export interface TournamentConfig {
  sports: { [key in SportType]?: { isActive: boolean; courts: number } };
}