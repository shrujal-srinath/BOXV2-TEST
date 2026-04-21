// src/sports/kabaddi/manifest.tsx
// Status: beta — UI stubs use placeholder screens. Logic to be added.
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface KabaddiRules {
  halfDurationMin: number;  // e.g. 20 min halves
}

export interface KabaddiState {
  gameRunning: boolean;
  scoreA: number;
  scoreB: number;
  half: number;
  raidTeam: 'A' | 'B' | null;
}

export type KabaddiAction =
  | { type: 'RAID_POINT'; team: 'A' | 'B'; points: number }
  | { type: 'TACKLE_POINT'; team: 'A' | 'B' }
  | { type: 'NEXT_HALF' };

const components = createUnderDevelopmentComponents('🤼', 'Kabaddi');

export const kabaddiManifest: SportManifest<KabaddiState, KabaddiAction, KabaddiRules> = {
  id: 'kabaddi',
  label: 'Kabaddi',
  icon: '🤼',
  description: 'Raid & tackle scoring, two 20-min halves',
  category: 'core',
  accent: 'bg-red-600',
  devStatus: 'beta',
  scoringMode: 'timer-points',
  rules: { halfDurationMin: 20 },
  createInitialState: () => ({
    gameRunning: false,
    scoreA: 0,
    scoreB: 0,
    half: 1,
    raidTeam: null,
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
