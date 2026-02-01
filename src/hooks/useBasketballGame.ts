import { useState, useEffect, useCallback } from 'react';
import { BasketballGame, Player, TeamData } from '../types';
import { updateGameField, subscribeToGame, createGame } from '../services/gameService';

// Default object creators (kept same as before, just ensured they match types)
const createDefaultPlayer = (id: string): Player => ({
  id,
  name: '',
  number: '',
  position: '',
  points: 0,
  assists: 0,
  rebounds: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  disqualified: false,
  fieldGoalsMade: 0,
  fieldGoalsAttempted: 0,
  threePointsMade: 0,
  threePointsAttempted: 0,
  freeThrowsMade: 0,
  freeThrowsAttempted: 0,
});

const createDefaultTeam = (name: string, color: string): TeamData => ({
  name,
  color,
  score: 0,
  timeouts: 2,
  timeoutsFirstHalf: 2,
  timeoutsSecondHalf: 3,
  fouls: 0,
  foulsThisQuarter: 0,
  players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
});

export const useBasketballGame = (code: string, gameType: 'local' | 'online' = 'online') => {
  // Initialize with a default structure while loading
  const [game, setGame] = useState<BasketballGame>({
    code,
    teamA: createDefaultTeam('Team A', '#FF0000'),
    teamB: createDefaultTeam('Team B', '#0000FF'),
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

  useEffect(() => {
    const unsubscribe = subscribeToGame(code, (updatedGame) => {
      if (updatedGame) {
        setGame(updatedGame);
      }
    });
    return unsubscribe;
  }, [code]);

  const toggleTimer = useCallback(() => {
    updateGameField(code, 'gameState.gameRunning', !game.gameState.gameRunning);
  }, [code, game.gameState.gameRunning]);

  const toggleShotClock = useCallback(() => {
    updateGameField(code, 'gameState.shotClockRunning', !game.gameState.shotClockRunning);
  }, [code, game.gameState.shotClockRunning]);

  const updateGameTime = useCallback((minutes: number, seconds: number, shotClock: number) => {
    updateGameField(code, 'gameState', {
      ...game.gameState,
      gameTime: { minutes, seconds, tenths: 0 },
      shotClock: Math.max(0, shotClock),
    });
  }, [code, game.gameState]);

  const resetShotClock = useCallback((value: number = 24) => {
    updateGameField(code, 'gameState.shotClock', value);
  }, [code]);

  const setPeriod = useCallback((newPeriod: number) => {
    const updates: any = {
      'gameState.period': newPeriod,
      'gameState.gameRunning': false,
    };

    if (newPeriod >= 1 && newPeriod <= 4) {
      updates['teamA.foulsThisQuarter'] = 0;
      updates['teamB.foulsThisQuarter'] = 0;
    }

    if (newPeriod === 3) {
      updates['teamA.timeouts'] = 3;
      updates['teamB.timeouts'] = 3;
      updates['teamA.timeoutsSecondHalf'] = 3;
      updates['teamB.timeoutsSecondHalf'] = 3;
    }

    if (newPeriod > 4) {
      updates['gameState.gameTime'] = { minutes: 5, seconds: 0, tenths: 0 };
      updates['teamA.timeouts'] = 1;
      updates['teamB.timeouts'] = 1;
      updates['teamA.foulsThisQuarter'] = 0;
      updates['teamB.foulsThisQuarter'] = 0;
    } else {
      updates['gameState.gameTime'] = { minutes: game.settings.periodDuration || 10, seconds: 0, tenths: 0 };
    }

    Object.entries(updates).forEach(([path, value]) => {
      updateGameField(code, path as any, value);
    });
  }, [code, game.settings.periodDuration]);

  const updateScore = useCallback((team: 'A' | 'B', points: number) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
    const currentScore = game[teamKey].score;
    updateGameField(code, `${teamKey}.score`, currentScore + points);
  }, [code, game]);

  const updateFouls = useCallback((team: 'A' | 'B', increment: number = 1) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
    const currentFouls = game[teamKey].fouls;
    const currentQuarterFouls = game[teamKey].foulsThisQuarter;

    updateGameField(code, `${teamKey}.fouls`, currentFouls + increment);
    updateGameField(code, `${teamKey}.foulsThisQuarter`, currentQuarterFouls + increment);
  }, [code, game]);

  const updateTimeouts = useCallback((team: 'A' | 'B', increment: number = -1) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
    const currentTimeouts = game[teamKey].timeouts;
    const newTimeouts = currentTimeouts + increment;

    // Validations can be added here
    updateGameField(code, `${teamKey}.timeouts`, newTimeouts);
  }, [code, game]);

  const updatePlayerStats = useCallback((
    team: 'A' | 'B',
    playerId: string,
    stat: keyof Player,
    value: number
  ) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
    const players = game[teamKey].players;
    const playerIndex = players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) return;

    const player = players[playerIndex];
    const updatedPlayer = { ...player, [stat]: value };

    if (stat === 'fouls' && value >= 5 && !player.disqualified) {
      updatedPlayer.disqualified = true;
      alert(`Player Disqualified: ${player.name || player.number} - 5 Fouls`);
    }

    const updatedPlayers = [...players];
    updatedPlayers[playerIndex] = updatedPlayer;

    updateGameField(code, `${teamKey}.players`, updatedPlayers);
  }, [code, game]);

  const updateTeamData = useCallback((
    team: 'A' | 'B',
    field: keyof TeamData,
    value: any
  ) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
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
    updatePlayerStats,
    updateTeamData,
  };
};