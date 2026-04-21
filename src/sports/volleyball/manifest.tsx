// src/sports/volleyball/manifest.tsx
// Status: beta — UI stubs use placeholder screens. Logic to be added.
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface VolleyballRules {
  setsToWin: number;       // e.g. 3 (best of 5)
  pointsToWin: number;     // e.g. 25 (final set 15)
}

export interface VolleyballState {
  gameRunning: boolean;
  scoreA: number;
  scoreB: number;
  setsWonA: number;
  setsWonB: number;
  currentSet: number;
}

export type VolleyballAction =
  | { type: 'ADD_POINT'; team: 'A' | 'B' }
  | { type: 'NEXT_SET' };

const components = createUnderDevelopmentComponents('🏐', 'Volleyball');

export const volleyballManifest: SportManifest<VolleyballState, VolleyballAction, VolleyballRules> = {
  id: 'volleyball',
  label: 'Volleyball',
  icon: '🏐',
  description: 'Best of 5 sets scoring, 25 pts per set',
  category: 'core',
  accent: 'bg-yellow-500',
  devStatus: 'beta',
  scoringMode: 'sets-points',
  rules: { setsToWin: 3, pointsToWin: 25 },
  createInitialState: () => ({
    gameRunning: false,
    scoreA: 0,
    scoreB: 0,
    setsWonA: 0,
    setsWonB: 0,
    currentSet: 1,
  }),
  reducer: (state) => state,
  normalizeResult: (state): NormalizedResult => ({
    isComplete: false,
    winner: state.setsWonA > state.setsWonB ? 'A' : state.setsWonB > state.setsWonA ? 'B' : null,
    displayScore: `${state.setsWonA} - ${state.setsWonB}`,
    teamAScore: state.setsWonA,
    teamBScore: state.setsWonB,
  }),
  canAdminOverride: true,
  components,
};
