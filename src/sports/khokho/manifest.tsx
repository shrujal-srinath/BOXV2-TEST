// src/sports/khokho/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface KhoKhoRules { turnDurationMin: number; }
export interface KhoKhoState {
  gameRunning: boolean; scoreA: number; scoreB: number; turn: number;
}
export type KhoKhoAction = { type: 'ADD_POINT'; team: 'A' | 'B' } | { type: 'NEXT_TURN' };

const components = createUnderDevelopmentComponents('🏃', 'Kho Kho');

export const khokhoManifest: SportManifest<KhoKhoState, KhoKhoAction, KhoKhoRules> = {
  id: 'khokho', label: 'Kho Kho', icon: '🏃',
  description: 'Indian tag sport — chasing and tagging',
  category: 'extended', accent: 'bg-amber-600', devStatus: 'under-development',
  scoringMode: 'timer-points',
  rules: { turnDurationMin: 7 },
  createInitialState: () => ({ gameRunning: false, scoreA: 0, scoreB: 0, turn: 1 }),
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
