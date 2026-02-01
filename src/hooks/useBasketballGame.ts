import { useState, useEffect, useCallback } from 'react';
import { BasketballGame, Player, GameTime, TeamData } from '../types';
import { updateGameField, subscribeToGame } from '../services/gameService';

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
  disqualified: false, // NEW: Initialize disqualification status
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
  timeouts: 2, // FIXED: FIBA starts with 2 timeouts in first half (was 7 - NBA)
  timeoutsFirstHalf: 2, // NEW: Track first half allocation
  timeoutsSecondHalf: 3, // NEW: Track second half allocation
  fouls: 0,
  foulsThisQuarter: 0, // NEW: Track quarter fouls for bonus/penalty
  players: Array.from({ length: 12 }, (_, i) => createDefaultPlayer(`player-${i + 1}`)),
});

export const useBasketballGame = (gameCode: string, gameType: 'local' | 'online') => {
  const [game, setGame] = useState<BasketballGame>({
    gameCode,
    teamA: createDefaultTeam('Team A', '#FF0000'),
    teamB: createDefaultTeam('Team B', '#0000FF'),
    gameState: {
      period: 1,
      gameTime: { minutes: 10, seconds: 0, tenths: 0 },
      shotClock: 24,
      gameRunning: false,
      shotClockRunning: false,
    },
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    gameType,
  });

  // Subscribe to game updates for online games
  useEffect(() => {
    if (gameType === 'online') {
      const unsubscribe = subscribeToGame(gameCode, (updatedGame) => {
        if (updatedGame) {
          setGame(updatedGame);
        }
      });
      return unsubscribe;
    }
  }, [gameCode, gameType]);

  // Toggle game timer
  const toggleTimer = useCallback(() => {
    updateGameField(gameCode, 'gameState.gameRunning', !game.gameState.gameRunning);
  }, [gameCode, game.gameState.gameRunning]);

  // Toggle shot clock
  const toggleShotClock = useCallback(() => {
    updateGameField(gameCode, 'gameState.shotClockRunning', !game.gameState.shotClockRunning);
  }, [gameCode, game.gameState.shotClockRunning]);

  // Update game time (called by Scoreboard timer)
  const updateGameTime = useCallback((minutes: number, seconds: number, shotClock: number) => {
    updateGameField(gameCode, 'gameState', {
      ...game.gameState,
      gameTime: { minutes, seconds, tenths: 0 },
      shotClock: Math.max(0, shotClock),
    });
  }, [gameCode, game.gameState]);

  // Reset shot clock
  const resetShotClock = useCallback((value: number = 24) => {
    updateGameField(gameCode, 'gameState.shotClock', value);
  }, [gameCode]);

  // FIXED: Set period with proper FIBA rules
  const setPeriod = useCallback((newPeriod: number) => {
    const updates: any = {
      'gameState.period': newPeriod,
      'gameState.gameRunning': false,
    };

    // Reset quarter fouls at the start of each quarter
    if (newPeriod >= 1 && newPeriod <= 4) {
      updates['teamA.foulsThisQuarter'] = 0;
      updates['teamB.foulsThisQuarter'] = 0;
    }

    // FIXED: Halftime timeout reset (Q3 starts)
    if (newPeriod === 3) {
      updates['teamA.timeouts'] = 3; // FIBA: 3 timeouts for second half
      updates['teamB.timeouts'] = 3;
      updates['teamA.timeoutsSecondHalf'] = 3;
      updates['teamB.timeoutsSecondHalf'] = 3;
    }

    // FIXED: Overtime rules
    if (newPeriod > 4) {
      // Force 5-minute overtime period
      updates['gameState.gameTime'] = { minutes: 5, seconds: 0, tenths: 0 };

      // FIBA: 1 timeout per overtime period
      updates['teamA.timeouts'] = 1;
      updates['teamB.timeouts'] = 1;

      // Reset quarter fouls for overtime
      updates['teamA.foulsThisQuarter'] = 0;
      updates['teamB.foulsThisQuarter'] = 0;

      // NOTE: Total fouls carry over from regulation
    }

    // Regular period time (10 minutes for FIBA)
    if (newPeriod >= 1 && newPeriod <= 4) {
      updates['gameState.gameTime'] = { minutes: 10, seconds: 0, tenths: 0 };
    }

    // Apply all updates
    Object.entries(updates).forEach(([path, value]) => {
      updateGameField(gameCode, path as any, value);
    });
  }, [gameCode]);

  // Update score
  const updateScore = useCallback((team: 'A' | 'B', points: number) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
    const currentScore = game[teamKey].score;
    updateGameField(gameCode, `${teamKey}.score`, currentScore + points);
  }, [gameCode, game]);

  // FIXED: Update fouls with quarter tracking and bonus indicator
  const updateFouls = useCallback((team: 'A' | 'B', increment: number = 1) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
    const currentFouls = game[teamKey].fouls;
    const currentQuarterFouls = game[teamKey].foulsThisQuarter;

    // Update both total fouls and quarter fouls
    updateGameField(gameCode, `${teamKey}.fouls`, currentFouls + increment);
    updateGameField(gameCode, `${teamKey}.foulsThisQuarter`, currentQuarterFouls + increment);

    // FIBA: Bonus/penalty at 4 team fouls per quarter
    const newQuarterFouls = currentQuarterFouls + increment;
    if (newQuarterFouls >= 4) {
      // Team is now in bonus/penalty situation
      console.log(`Team ${team} is in penalty - ${newQuarterFouls} fouls this quarter`);
    }
  }, [gameCode, game]);

  // Update timeouts with FIBA validation
  const updateTimeouts = useCallback((team: 'A' | 'B', increment: number = -1) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
    const currentTimeouts = game[teamKey].timeouts;
    const newTimeouts = currentTimeouts + increment;

    // Prevent going negative or exceeding max
    const period = game.gameState.period;
    let maxTimeouts = 2; // Default first half

    if (period >= 3 && period <= 4) {
      maxTimeouts = 3; // Second half
    } else if (period > 4) {
      maxTimeouts = 1; // Overtime
    }

    if (newTimeouts >= 0 && newTimeouts <= maxTimeouts) {
      updateGameField(gameCode, `${teamKey}.timeouts`, newTimeouts);
    }
  }, [gameCode, game]);

  // FIXED: Update player stats with disqualification at 5 fouls
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

    // CRITICAL FIX: Auto-disqualify player at 5 fouls
    if (stat === 'fouls' && value >= 5 && !player.disqualified) {
      updatedPlayer.disqualified = true;

      // Alert the user
      alert(`Player Disqualified: ${player.name || player.number} - 5 Fouls`);

      console.log(`🚨 PLAYER DISQUALIFIED: ${player.name} (#${player.number}) - 5 fouls`);
    }

    const updatedPlayers = [...players];
    updatedPlayers[playerIndex] = updatedPlayer;

    updateGameField(gameCode, `${teamKey}.players`, updatedPlayers);
  }, [gameCode, game]);

  // Update team data (name, color)
  const updateTeamData = useCallback((
    team: 'A' | 'B',
    field: keyof TeamData,
    value: any
  ) => {
    const teamKey = `team${team}` as 'teamA' | 'teamB';
    updateGameField(gameCode, `${teamKey}.${field}`, value);
  }, [gameCode]);

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