import { useState, useEffect, useCallback } from 'react';
import { BasketballGame, Player, TeamData } from '../types';
import { updateGameField, subscribeToGame } from '../services/gameService';

const createDefaultPlayer = (id: string): Player => ({
  id, name: '', number: '', position: '', points: 0, assists: 0, rebounds: 0,
  steals: 0, blocks: 0, turnovers: 0, fouls: 0, disqualified: false,
  fieldGoalsMade: 0, fieldGoalsAttempted: 0, threePointsMade: 0,
  threePointsAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0,
});

const createDefaultTeam = (name: string, color: string): TeamData => ({
  name, color, score: 0, timeouts: 2, timeoutsFirstHalf: 2, timeoutsSecondHalf: 3,
  fouls: 0, foulsThisQuarter: 0,
  players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
});

export const useBasketballGame = (code: string, gameType: 'local' | 'online' = 'online') => {
  // Initial state (safe default)
  const [game, setGame] = useState<BasketballGame>({
    code,
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
      periodType: 'quarter'
    },
    sport: 'basketball',
    status: 'live',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    gameType,
  });

  // Subscribe to service updates
  useEffect(() => {
    const unsubscribe = subscribeToGame(code, (updatedGame) => {
      if (updatedGame) {
        setGame(updatedGame);
      }
    });
    return unsubscribe;
  }, [code]);

  // --- ACTIONS ---

  const toggleTimer = useCallback(() => {
    const newState = !game.gameState.gameRunning;
    updateGameField(code, 'gameState.gameRunning', newState);
    updateGameField(code, 'gameState.shotClockRunning', newState);
  }, [code, game.gameState.gameRunning]);

  const toggleShotClock = useCallback(() => {
    updateGameField(code, 'gameState.shotClockRunning', !game.gameState.shotClockRunning);
  }, [code, game.gameState.shotClockRunning]);

  const updateGameTime = useCallback((minutes: number, seconds: number, shotClock: number) => {
    updateGameField(code, 'gameState.gameTime', { minutes, seconds, tenths: 0 });
    updateGameField(code, 'gameState.shotClock', Math.max(0, shotClock));
  }, [code]);

  const resetShotClock = useCallback((value: number = 24) => {
    updateGameField(code, 'gameState.shotClock', value);
  }, [code]);

  const setPeriod = useCallback((newPeriod: number) => {
    const updates: any = {
      'gameState.period': newPeriod,
      'gameState.gameRunning': false,
      'gameState.shotClockRunning': false,
      'gameState.gameTime': { minutes: game.settings.periodDuration || 10, seconds: 0, tenths: 0 },
      'gameState.shotClock': game.settings.shotClockDuration || 24,
      'teamA.foulsThisQuarter': 0,
      'teamB.foulsThisQuarter': 0
    };
    Object.entries(updates).forEach(([path, value]) => {
      updateGameField(code, path, value);
    });
  }, [code, game.settings]);

  const updateScore = useCallback((team: 'A' | 'B', points: number) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const currentScore = game[teamKey].score;
    updateGameField(code, `${teamKey}.score`, Math.max(0, currentScore + points));
  }, [code, game]);

  const updateFouls = useCallback((team: 'A' | 'B', increment: number = 1) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    updateGameField(code, `${teamKey}.fouls`, Math.max(0, game[teamKey].fouls + increment));
    updateGameField(code, `${teamKey}.foulsThisQuarter`, Math.max(0, game[teamKey].foulsThisQuarter + increment));
  }, [code, game]);

  const updateTimeouts = useCallback((team: 'A' | 'B', increment: number = -1) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    updateGameField(code, `${teamKey}.timeouts`, Math.max(0, game[teamKey].timeouts + increment));
  }, [code, game]);

  const togglePossession = useCallback(() => {
    const nextPos = game.gameState.possession === 'A' ? 'B' : 'A';
    updateGameField(code, 'gameState.possession', nextPos);
  }, [code, game.gameState.possession]);

  const updateTeamData = useCallback((team: 'A' | 'B', field: keyof TeamData, value: any) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    updateGameField(code, `${teamKey}.${field}`, value);
  }, [code]);

  return {
    game,
    toggleTimer,
    toggleShotClock,
    updateGameTime,
    resetShotClock,
    setPeriod,
    updateScore,
    updateFouls,
    updateTimeouts,
    updateTeamData,
    togglePossession,
    // Generic Action Handler
    handleAction: (team: 'A' | 'B', type: 'points' | 'foul' | 'timeout', value: number) => {
      if (type === 'points') updateScore(team, value);
      else if (type === 'foul') updateFouls(team, value);
      else if (type === 'timeout') updateTimeouts(team, value);
    }
  };
};