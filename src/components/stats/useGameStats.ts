// src/components/stats/useGameStats.ts
// Loads a game (games.data JSONB) + shot_events + game_actions and runs the
// stats engine. Single hook backing the mode-aware StatsHub and all sub-views.

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { getShotsForGame, getActionsForGame } from '../../services/shotService';
import {
  buildGameBoxScore,
  reconstructScoreTimeline,
  detectScoringRuns,
  biggestLeads,
  buildTeamComparison,
  buildRosterIndex,
} from '../../services/statsEngine';
import { resolveGameMode } from '../../services/gameMode';
import type { ShotEvent, GameAction } from '../shotchart/types/shotTypes';
import type {
  GameMode,
  GameBoxScore,
  ScoreTimelinePoint,
  ScoringRun,
  TeamComparisonRow,
} from './types';

export interface GameStatsData {
  loading: boolean;
  error: string | null;
  notFound: boolean;
  gameCode: string;
  gameData: any | null;            // games.data (BasketballGame)
  mode: GameMode;
  shots: ShotEvent[];
  actions: GameAction[];
  box: GameBoxScore | null;
  timeline: ScoreTimelinePoint[];
  runs: ScoringRun[];
  leads: { a: number; b: number };
  comparison: TeamComparisonRow[];
  rosterIndex: Map<string, { name: string; number: string }>;
}

const EMPTY: GameStatsData = {
  loading: true, error: null, notFound: false, gameCode: '', gameData: null,
  mode: 'quick', shots: [], actions: [], box: null, timeline: [], runs: [],
  leads: { a: 0, b: 0 }, comparison: [], rosterIndex: new Map(),
};

export const useGameStats = (gameCode: string): GameStatsData => {
  const [state, setState] = useState<GameStatsData>({ ...EMPTY, gameCode });

  useEffect(() => {
    let alive = true;
    setState({ ...EMPTY, gameCode });

    (async () => {
      try {
        const [{ data: gameRow, error: gameErr }, shots, actions] = await Promise.all([
          supabase.from('games').select('data').eq('code', gameCode).single(),
          getShotsForGame(gameCode),
          getActionsForGame(gameCode),
        ]);

        if (!alive) return;

        if (gameErr || !gameRow?.data) {
          setState(s => ({ ...s, loading: false, notFound: true }));
          return;
        }

        const gameData = gameRow.data;
        const mode = resolveGameMode(gameData);
        const box = buildGameBoxScore(gameData, shots, actions);

        const periodDurationSec = (gameData?.settings?.periodDuration ?? 10) * 60;
        const periodType = gameData?.settings?.periodType ?? 'quarter';
        const timeline = reconstructScoreTimeline(shots, { periodDurationSec, periodType });
        const runs = detectScoringRuns(timeline);
        const leads = biggestLeads(timeline);
        const comparison = buildTeamComparison(box);
        const rosterIndex = buildRosterIndex(gameData);

        setState({
          loading: false, error: null, notFound: false, gameCode, gameData, mode,
          shots, actions, box, timeline, runs, leads, comparison, rosterIndex,
        });
      } catch (e: any) {
        if (!alive) return;
        setState(s => ({ ...s, loading: false, error: e?.message ?? 'Failed to load game stats' }));
      }
    })();

    return () => { alive = false; };
  }, [gameCode]);

  return state;
};
