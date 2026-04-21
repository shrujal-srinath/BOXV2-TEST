// src/sports/throwball/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface ThrowballRules { setsToWin: number; pointsToWin: number; }
export interface ThrowballState {
  gameRunning: boolean; scoreA: number; scoreB: number;
  setsWonA: number; setsWonB: number; currentSet: number;
}
export type ThrowballAction = { type: 'ADD_POINT'; team: 'A' | 'B' } | { type: 'NEXT_SET' };

const components = createUnderDevelopmentComponents('🏐', 'Throwball');

export const throwballManifest: SportManifest<ThrowballState, ThrowballAction, ThrowballRules> = {
  id: 'throwball', label: 'Throwball', icon: '🏐',
  description: 'Best of 3 sets to 25, popular in VTU',
  category: 'extended', accent: 'bg-cyan-600', devStatus: 'under-development',
  scoringMode: 'sets-points',
  rules: { setsToWin: 2, pointsToWin: 25 },
  createInitialState: () => ({ gameRunning: false, scoreA: 0, scoreB: 0, setsWonA: 0, setsWonB: 0, currentSet: 1 }),
  reducer: (state) => state,
  normalizeResult: (state): NormalizedResult => ({
    isComplete: false,
    winner: state.setsWonA > state.setsWonB ? 'A' : state.setsWonB > state.setsWonA ? 'B' : null,
    displayScore: `${state.setsWonA} - ${state.setsWonB}`,
    teamAScore: state.setsWonA,
    teamBScore: state.setsWonB,
  }),
  canAdminOverride: true, components,
};
