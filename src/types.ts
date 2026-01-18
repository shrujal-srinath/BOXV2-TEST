export interface Player {
  id: string;
  name: string;
  number: string;
  position: string; // NEW: e.g., "PG", "C", "F"
  points: number;
  fouls: number;
}

export interface GameState {
  period: number;
  gameTime: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  shotClock: number;
  possession: 'A' | 'B';
  gameRunning: boolean;
  shotClockRunning: boolean;
}

export interface TeamData {
  name: string;
  color: string;
  score: number;
  timeouts: number;
  fouls: number;
  players: Player[];
}

export interface BasketballGame {
  hostId: string | null;
  code: string;
  gameType: string;
  sport: 'basketball';
  status: 'live' | 'final';
  settings: {
    gameName: string;
    periodDuration: number;
    shotClockDuration: number;
    periodType: 'quarter' | 'half';
  };
  teamA: TeamData;
  teamB: TeamData;
  gameState: GameState;
  lastUpdate: number;
}