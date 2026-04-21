// src/sports/football/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface FootballRules { halfDurationMin: number; }
export interface FootballState {
  gameRunning: boolean; scoreA: number; scoreB: number; half: number;
}
export type FootballAction = { type: 'GOAL'; team: 'A' | 'B' } | { type: 'NEXT_HALF' };

const components = createUnderDevelopmentComponents('⚽', 'Football');

export const footballManifest: SportManifest<FootballState, FootballAction, FootballRules> = {
  id: 'football', label: 'Football', icon: '⚽',
  description: 'Goal scoring with two 45-min halves',
  category: 'extended', accent: 'bg-emerald-600', devStatus: 'under-development',
  scoringMode: 'timer-points',
  rules: { halfDurationMin: 45 },
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
