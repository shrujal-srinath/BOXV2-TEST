// src/sports/tennis/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface TennisRules { setsToWin: number; }
export interface TennisState {
  gameRunning: boolean;
  setsWonA: number; setsWonB: number;
  gamesA: number; gamesB: number;
  currentSet: number;
}
export type TennisAction = { type: 'GAME_WIN'; team: 'A' | 'B' } | { type: 'NEXT_SET' };

const components = createUnderDevelopmentComponents('🎾', 'Tennis');

export const tennisManifest: SportManifest<TennisState, TennisAction, TennisRules> = {
  id: 'tennis', label: 'Tennis', icon: '🎾',
  description: 'Sets & games scoring, ATP/WTA rules',
  category: 'extended', accent: 'bg-yellow-600', devStatus: 'under-development',
  scoringMode: 'sets-points',
  rules: { setsToWin: 2 },
  createInitialState: () => ({ gameRunning: false, setsWonA: 0, setsWonB: 0, gamesA: 0, gamesB: 0, currentSet: 1 }),
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
