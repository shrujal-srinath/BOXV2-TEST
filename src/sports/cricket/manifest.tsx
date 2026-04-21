// src/sports/cricket/manifest.tsx — under development
import { SportManifest } from '../../core/types/Manifest';
import { NormalizedResult } from '../../core/types/Game';
import { createUnderDevelopmentComponents } from '../_shared/UnderDevelopment';

export interface CricketRules { overs: number; }
export interface CricketState {
  gameRunning: boolean;
  runsA: number; wicketsA: number; oversA: number;
  runsB: number; wicketsB: number; oversB: number;
  innings: 1 | 2;
}
export type CricketAction = { type: 'ADD_RUNS'; team: 'A' | 'B'; runs: number } | { type: 'WICKET'; team: 'A' | 'B' };

const components = createUnderDevelopmentComponents('🏏', 'Cricket');

export const cricketManifest: SportManifest<CricketState, CricketAction, CricketRules> = {
  id: 'cricket', label: 'Cricket', icon: '🏏',
  description: 'T20 / limited overs run scoring',
  category: 'extended', accent: 'bg-lime-600', devStatus: 'under-development',
  scoringMode: 'innings-runs',
  rules: { overs: 20 },
  createInitialState: () => ({ gameRunning: false, runsA: 0, wicketsA: 0, oversA: 0, runsB: 0, wicketsB: 0, oversB: 0, innings: 1 }),
  reducer: (state) => state,
  normalizeResult: (state): NormalizedResult => ({
    isComplete: false,
    winner: state.runsA > state.runsB ? 'A' : state.runsB > state.runsA ? 'B' : null,
    displayScore: `${state.runsA} - ${state.runsB}`,
    teamAScore: state.runsA,
    teamBScore: state.runsB,
  }),
  canAdminOverride: true, components,
};
