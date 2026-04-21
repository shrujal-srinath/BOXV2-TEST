// src/sports/tabletennis/manifest.tsx
// Status: beta — UI stubs use placeholder screens. Logic to be added.
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface TableTennisRules {
  gamesToWin: number;   // e.g. 4 (best of 7)
  pointsToWin: number;  // e.g. 11
}

export interface TableTennisState {
  gameRunning: boolean;
  scoreA: number;
  scoreB: number;
  gamesWonA: number;
  gamesWonB: number;
  currentGame: number;
}

export type TableTennisAction =
  | { type: 'ADD_POINT'; team: 'A' | 'B' }
  | { type: 'NEXT_GAME' };

const components = createUnderDevelopmentComponents('🏓', 'Table Tennis');

export const tabletennisManifest: SportManifest<TableTennisState, TableTennisAction, TableTennisRules> = {
  id: 'tabletennis',
  label: 'Table Tennis',
  icon: '🏓',
  description: 'Best of 7 games to 11, ITTF deuce rules',
  category: 'core',
  accent: 'bg-blue-500',
  devStatus: 'beta',
  scoringMode: 'sets-points',
  rules: { gamesToWin: 4, pointsToWin: 11 },
  createInitialState: () => ({
    gameRunning: false,
    scoreA: 0,
    scoreB: 0,
    gamesWonA: 0,
    gamesWonB: 0,
    currentGame: 1,
  }),
  reducer: (state) => state,
  normalizeResult: (state): NormalizedResult => ({
    isComplete: false,
    winner: state.gamesWonA > state.gamesWonB ? 'A' : state.gamesWonB > state.gamesWonA ? 'B' : null,
    displayScore: `${state.gamesWonA} - ${state.gamesWonB}`,
    teamAScore: state.gamesWonA,
    teamBScore: state.gamesWonB,
  }),
  canAdminOverride: true,
  components,
};
