export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  points: number;
  assists: number;
  rebounds: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  disqualified: boolean; // NEW: Track player disqualification at 5 fouls
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
  timeoutsFirstHalf: number; // NEW: Track first half timeouts (FIBA: 2)
  timeoutsSecondHalf: number; // NEW: Track second half timeouts (FIBA: 3)
  fouls: number;
  foulsThisQuarter: number; // NEW: Track fouls per quarter for bonus/penalty
  players: Player[];
}

export interface GameTime {
  minutes: number;
  seconds: number;
  tenths: number;
}

export interface GameState {
  period: number;
  gameTime: GameTime;
  shotClock: number;
  gameRunning: boolean;
  shotClockRunning: boolean;
}

export interface BasketballGame {
  gameCode: string;
  teamA: TeamData;
  teamB: TeamData;
  gameState: GameState;
  createdAt: number;
  lastUpdated: number;
  gameType: 'local' | 'online';
}

export interface GameAction {
  type: 'SCORE' | 'FOUL' | 'TIMEOUT' | 'SUBSTITUTION' | 'STAT_UPDATE' | 'PERIOD_CHANGE';
  timestamp: number;
  team: 'A' | 'B';
  playerId?: string;
  data: any;
}