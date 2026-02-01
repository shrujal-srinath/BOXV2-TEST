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
  possession: 'A' | 'B';
}

export interface GameSettings {
  gameName: string;
  periodDuration: number;
  shotClockDuration: number;
  periodType: 'quarter' | 'half';
}

export interface BasketballGame {
  code: string;       // Standardized ID field
  hostId?: string;    // ID of the user hosting the game
  teamA: TeamData;
  teamB: TeamData;
  gameState: GameState;
  settings: GameSettings; // Added settings
  sport: string;      // Added sport type
  status: 'live' | 'final' | 'scheduled';
  createdAt: number;
  lastUpdate: number; // Standardized timestamp
  gameType: 'local' | 'online' | 'pro';
}

export interface GameAction {
  type: 'SCORE' | 'FOUL' | 'TIMEOUT' | 'SUBSTITUTION' | 'STAT_UPDATE' | 'PERIOD_CHANGE';
  timestamp: number;
  team: 'A' | 'B';
  playerId?: string;
  data: any;
}

export interface LocalGameMetadata {
  id: string;                    // LOCAL-ABC123
  createdAt: number;             // Timestamp
  lastModified: number;          // Timestamp
  synced: boolean;               // Has been uploaded to cloud
  cloudId: string | null;        // Firebase game code (if synced)
  game: BasketballGame;          // Full game data
}

export interface LocalGameLibrary {
  games: LocalGameMetadata[];
  activeGameId: string | null;
}

export interface AppSettings {
  autoSync: boolean;
  keepSyncedGames: boolean;
  vibrationEnabled: boolean;
  defaultPeriodDuration: number;
  defaultShotClock: number;
}