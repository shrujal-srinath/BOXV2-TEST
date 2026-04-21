// src/sports/hockey/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface HockeyRules { quarterDurationMin: number; }
export interface HockeyState {
  gameRunning: boolean; scoreA: number; scoreB: number; quarter: number;
}
export type HockeyAction = { type: 'GOAL'; team: 'A' | 'B' } | { type: 'NEXT_QUARTER' };

const components = createUnderDevelopmentComponents('🏑', 'Hockey');

export const hockeyManifest: SportManifest<HockeyState, HockeyAction, HockeyRules> = {
  id: 'hockey', label: 'Hockey', icon: '🏑',
  description: 'Field hockey — 4 quarters, FIH rules',
  category: 'extended', accent: 'bg-green-700', devStatus: 'under-development',
  scoringMode: 'timer-points',
  rules: { quarterDurationMin: 15 },
  createInitialState: () => ({ gameRunning: false, scoreA: 0, scoreB: 0, quarter: 1 }),
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
