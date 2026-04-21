// src/sports/carrom/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface CarromRules { pointsToWin: number; boardsPerMatch: number; }
export interface CarromState {
  gameRunning: boolean; scoreA: number; scoreB: number; board: number;
}
export type CarromAction = { type: 'ADD_POINTS'; team: 'A' | 'B'; pts: number } | { type: 'NEXT_BOARD' };

const components = createUnderDevelopmentComponents('🎯', 'Carrom');

export const carromManifest: SportManifest<CarromState, CarromAction, CarromRules> = {
  id: 'carrom', label: 'Carrom', icon: '🎯',
  description: 'Board scoring — pieces and queen points',
  category: 'extended', accent: 'bg-teal-600', devStatus: 'under-development',
  scoringMode: 'simple-score',
  rules: { pointsToWin: 25, boardsPerMatch: 3 },
  createInitialState: () => ({ gameRunning: false, scoreA: 0, scoreB: 0, board: 1 }),
  reducer: (state) => state,
  normalizeResult: (state): NormalizedResult => ({
    isComplete: false,
    winner: state.scoreA > state.scoreB ? 'A' : state.scoreB > state.scoreA ? 'B' : null,
    displayScore: `${state.scoreA} - ${state.scoreB}`,
    teamAScore: state.scoreA,
    teamBScore: state.scoreB,
  }),
  canAdminOverride: true, components,
};
