// src/sports/chess/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface ChessRules { rounds: number; }
export interface ChessState {
  gameRunning: boolean; pointsA: number; pointsB: number; round: number;
}
export type ChessAction = { type: 'RESULT'; winner: 'A' | 'B' | 'draw' } | { type: 'NEXT_ROUND' };

const components = createUnderDevelopmentComponents('♟️', 'Chess');

export const chessManifest: SportManifest<ChessState, ChessAction, ChessRules> = {
  id: 'chess', label: 'Chess', icon: '♟️',
  description: 'Match points: 1 win, 0.5 draw, 0 loss',
  category: 'extended', accent: 'bg-stone-600', devStatus: 'under-development',
  scoringMode: 'simple-score',
  rules: { rounds: 7 },
  createInitialState: () => ({ gameRunning: false, pointsA: 0, pointsB: 0, round: 1 }),
  reducer: (state) => state,
  normalizeResult: (state): NormalizedResult => ({
    isComplete: false,
    winner: state.pointsA > state.pointsB ? 'A' : state.pointsB > state.pointsA ? 'B' : null,
    displayScore: `${state.pointsA} - ${state.pointsB}`,
    teamAScore: state.pointsA,
    teamBScore: state.pointsB,
  }),
  canAdminOverride: true, components,
};
