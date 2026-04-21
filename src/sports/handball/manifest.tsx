// src/sports/handball/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface HandballRules { halfDurationMin: number; }
export interface HandballState {
  gameRunning: boolean; scoreA: number; scoreB: number; half: number;
}
export type HandballAction = { type: 'GOAL'; team: 'A' | 'B' } | { type: 'NEXT_HALF' };

const components = createUnderDevelopmentComponents('🤾', 'Handball');

export const handballManifest: SportManifest<HandballState, HandballAction, HandballRules> = {
  id: 'handball', label: 'Handball', icon: '🤾',
  description: 'Two 30-min halves, IHF rules',
  category: 'extended', accent: 'bg-purple-600', devStatus: 'under-development',
  scoringMode: 'timer-points',
  rules: { halfDurationMin: 30 },
  createInitialState: () => ({ gameRunning: false, scoreA: 0, scoreB: 0, half: 1 }),
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
