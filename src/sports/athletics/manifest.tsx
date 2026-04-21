// src/sports/athletics/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface AthleticsRules { event: string; }
export interface AthleticsState {
  gameRunning: boolean; scoreA: number; scoreB: number;
}
export type AthleticsAction = { type: 'ADD_POINT'; team: 'A' | 'B' };

const components = createUnderDevelopmentComponents('🏅', 'Athletics');

export const athleticsManifest: SportManifest<AthleticsState, AthleticsAction, AthleticsRules> = {
  id: 'athletics', label: 'Athletics', icon: '🏅',
  description: 'Track & field event point scoring',
  category: 'extended', accent: 'bg-indigo-600', devStatus: 'under-development',
  scoringMode: 'simple-score',
  rules: { event: 'track' },
  createInitialState: () => ({ gameRunning: false, scoreA: 0, scoreB: 0 }),
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
