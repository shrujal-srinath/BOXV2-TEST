// src/sports/general/manifest.tsx
// Generic sport — simple A vs B score counter. Works for any sport not yet
// in the registry. Status: beta.
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface GeneralRules {
  winScore: number | null;  // null = no auto-win condition
}

export interface GeneralState {
  gameRunning: boolean;
  scoreA: number;
  scoreB: number;
}

export type GeneralAction =
  | { type: 'ADD_POINT'; team: 'A' | 'B'; amount?: number }
  | { type: 'SUB_POINT'; team: 'A' | 'B' }
  | { type: 'RESET' };

const components = createUnderDevelopmentComponents('🏆', 'General');

export const generalManifest: SportManifest<GeneralState, GeneralAction, GeneralRules> = {
  id: 'general',
  label: 'General',
  icon: '🏆',
  description: 'Simple score counter for any sport',
  category: 'core',
  accent: 'bg-zinc-500',
  devStatus: 'beta',
  scoringMode: 'simple-score',
  rules: { winScore: null },
  createInitialState: () => ({
    gameRunning: false,
    scoreA: 0,
    scoreB: 0,
  }),
  reducer: (state) => state,
  normalizeResult: (state): NormalizedResult => ({
    isComplete: false,
    winner: state.scoreA > state.scoreB ? 'A' : state.scoreB > state.scoreA ? 'B' : null,
    displayScore: `${state.scoreA} - ${state.scoreB}`,
    teamAScore: state.scoreA,
    teamBScore: state.scoreB,
  }),
  canAdminOverride: true,
  components,
};
