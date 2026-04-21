// src/sports/netball/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface NetballRules { quarterDurationMin: number; }
export interface NetballState {
  gameRunning: boolean; scoreA: number; scoreB: number; quarter: number;
}
export type NetballAction = { type: 'GOAL'; team: 'A' | 'B' } | { type: 'NEXT_QUARTER' };

const components = createUnderDevelopmentComponents('🥅', 'Netball');

export const netballManifest: SportManifest<NetballState, NetballAction, NetballRules> = {
  id: 'netball', label: 'Netball', icon: '🥅',
  description: '4 quarters, goal shooting scoring',
  category: 'extended', accent: 'bg-pink-600', devStatus: 'under-development',
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
