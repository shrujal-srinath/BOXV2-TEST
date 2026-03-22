// src/hooks/useBasketballGame.ts
import { useState, useEffect, useCallback } from 'react';
import type { BasketballGame, TeamData, Player } from '../types';
import { updateGameField, batchUpdateGame, subscribeToGame, recordGameEvent } from '../services/supabaseGameService';
import { supabase } from '../services/supabase';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const createDefaultPlayer = (id: string): Player => ({
  id, name: '', number: '', position: '',
  points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0,
  turnovers: 0, fouls: 0, disqualified: false,
  fieldGoalsMade: 0, fieldGoalsAttempted: 0,
  threePointsMade: 0, threePointsAttempted: 0,
  freeThrowsMade: 0, freeThrowsAttempted: 0,
});

const createDefaultTeam = (name: string, color: string): TeamData => ({
  name, color, score: 0,
  timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3,
  fouls: 0, foulsThisQuarter: 0,
  players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useBasketballGame = (
  code: string,
  gameType: 'local' | 'online' = 'online'
) => {
  const [game, setGame] = useState<BasketballGame>({
    code,
    hostId: 'loading',
    teamA: createDefaultTeam('HOME', '#DC2626'),
    teamB: createDefaultTeam('AWAY', '#2563EB'),
    gameState: {
      period: 1,
      gameTime: { minutes: 10, seconds: 0, tenths: 0 },
      shotClock: 24,
      gameRunning: false,
      shotClockRunning: false,
      possession: 'A',
    },
    settings: {
      gameName: 'Loading...',
      periodDuration: 10,
      shotClockDuration: 24,
      periodType: 'quarter',
      periods: 4,
    },
    sportId: 'basketball',
    sport: 'basketball',  // @deprecated — legacy alias for sportId
    status: 'live',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    gameType,
  });

  // Subscribe to Supabase for durable state (scores, fouls, rosters)
  useEffect(() => {
    if (!code) return;
    const unsubscribe = subscribeToGame(code, (updatedGame) => {
      if (updatedGame) setGame(updatedGame);
    });
    return unsubscribe;
  }, [code]);




  // ─── Score ────────────────────────────────────────────────────────────────

  // NOTE: For online games, usePersistEngine is the SOLE owner of DB writes.
  // This function only updates local React state. The persist engine detects the
  // state change and handles both broadcasting and DB persistence.
  // recordGameEvent is called separately from HostConsole for the audit trail.
  const updateScore = useCallback((team: 'A' | 'B', points: number) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const newScore = Math.max(0, game[teamKey].score + points);
    setGame(prev => ({ ...prev, [teamKey]: { ...prev[teamKey], score: newScore } }));
  }, [game]);

  // ─── Fouls ────────────────────────────────────────────────────────────────

  const updateFouls = useCallback((team: 'A' | 'B', increment = 1) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    setGame(prev => ({
      ...prev,
      [teamKey]: {
        ...prev[teamKey],
        fouls: Math.max(0, prev[teamKey].fouls + increment),
        foulsThisQuarter: Math.max(0, prev[teamKey].foulsThisQuarter + increment),
      },
    }));
  }, []);

  // ─── Timeouts ─────────────────────────────────────────────────────────────

  const updateTimeouts = useCallback((team: 'A' | 'B', increment = -1) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    setGame(prev => ({
      ...prev,
      [teamKey]: {
        ...prev[teamKey],
        timeouts: Math.max(0, prev[teamKey].timeouts + increment),
      },
    }));
  }, []);

  // ─── Possession ───────────────────────────────────────────────────────────

  const togglePossession = useCallback(() => {
    setGame(prev => ({
      ...prev,
      gameState: {
        ...prev.gameState,
        possession: prev.gameState.possession === 'A' ? 'B' : 'A',
      },
    }));
  }, []);

  // ─── Period Transition ────────────────────────────────────────────────────
  const advancePeriodFirestore = useCallback((newPeriod: number) => {
    batchUpdateGame(code, {
      'gameState.period': newPeriod,
      'gameState.gameRunning': false,
      'gameState.shotClockRunning': false,
      'gameState.gameTime': {
        minutes: game.settings.periodDuration || 10,
        seconds: 0,
        tenths: 0,
      },
      'gameState.shotClock': game.settings.shotClockDuration || 24,
      'teamA.foulsThisQuarter': 0,
      'teamB.foulsThisQuarter': 0,
    });
  }, [code, game.settings]);

  // ─── Roster/Player Updates ────────────────────────────────────────────────

  const updateTeamData = useCallback((
    team: 'A' | 'B',
    field: keyof TeamData,
    value: unknown
  ) => {
    updateGameField(code, `${team === 'A' ? 'teamA' : 'teamB'}.${field}`, value);
  }, [code]);

  const updatePlayerData = useCallback((
    team: 'A' | 'B',
    playerId: string,
    updates: Partial<Player>
  ) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const playerIndex = game[teamKey].players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const updatedPlayers = [...game[teamKey].players];
    updatedPlayers[playerIndex] = { ...updatedPlayers[playerIndex], ...updates };
    updateGameField(code, `${teamKey}.players`, updatedPlayers);
  }, [code, game]);

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  const finishGame = useCallback(() => {
    batchUpdateGame(code, {
      status: 'completed',
      'gameState.gameRunning': false,
      'gameState.shotClockRunning': false,
    });
  }, [code]);

  // ─── Legacy Handler (for generic components) ──────────────────────────────

  const handleAction = useCallback((
    team: 'A' | 'B',
    type: 'points' | 'foul' | 'timeout',
    value: number
  ) => {
    if (type === 'points') updateScore(team, value);
    else if (type === 'foul') updateFouls(team, value);
    else if (type === 'timeout') updateTimeouts(team, value);
  }, [updateScore, updateFouls, updateTimeouts]);

  return {
    game,
    updateScore,
    updateFouls,
    updateTimeouts,
    togglePossession,
    handleAction,
    advancePeriodFirestore,
    updateTeamData,
    updatePlayerData,
    finishGame,
  };
};