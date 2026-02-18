// src/hooks/useBasketballGame.ts
import { useState, useEffect, useCallback } from 'react';
import type { BasketballGame, TeamData, Player } from '../types';
import { updateGameField, batchUpdateGame, subscribeToGame } from '../services/gameService';
import { pushScoreUpdate } from '../services/rtdbClockService';
import { useHardwareBridge } from './useHardwareBridge';

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
    sport: 'basketball',
    status: 'live',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    gameType,
  });

  // Subscribe to Firestore for durable state (scores, fouls, rosters)
  useEffect(() => {
    if (!code) return;
    const unsubscribe = subscribeToGame(code, (updatedGame) => {
      if (updatedGame) setGame(updatedGame);
    });
    return unsubscribe;
  }, [code]);

  // ─── HARDWARE INTEGRATION ──────────────────────────────────────────────────
  const { pushGameState, remoteState, controlMode } = useHardwareBridge();

  // 1. PUSH: Sync Web State -> ESP32 (Hardware Bridge)
  // Whenever the game state changes on the web, we push it to the hardware bridge.
  useEffect(() => {
    if (gameType === 'local') return;

    pushGameState({
      scoreA: game.teamA.score,
      scoreB: game.teamB.score,
      quarter: game.gameState.period,
      shotClock: game.gameState.shotClock,
    });
  }, [
    game.teamA.score,
    game.teamB.score,
    game.gameState.period,
    game.gameState.shotClock,
    pushGameState,
    gameType
  ]);

  // 2. PULL: Sync ESP32 -> Web State (Authority Aware)
  useEffect(() => {
    // Only accept scores from ESP32 if it is the Parent or in Shared mode
    if (!remoteState || controlMode === 'web') return;

    const updates: Record<string, any> = {};
    let hasUpdates = false;

    // Check Score A
    if (remoteState.scoreA !== game.teamA.score) {
      updates['teamA.score'] = remoteState.scoreA;
      hasUpdates = true;
    }
    // Check Score B
    if (remoteState.scoreB !== game.teamB.score) {
      updates['teamB.score'] = remoteState.scoreB;
      hasUpdates = true;
    }

    if (hasUpdates) {
      // This updates Firestore only when the ESP32 actually changes the number
      batchUpdateGame(code, updates);
    }
  }, [remoteState, controlMode, game.teamA.score, game.teamB.score, code]);


  // ─── Helper: Push to RTDB for <10ms Spectator Updates ─────────────────────
  const syncScoreToRTDB = useCallback((updatedGame: BasketballGame) => {
    if (gameType === 'local') return;
    pushScoreUpdate(
      code,
      updatedGame.teamA.score,
      updatedGame.teamB.score,
      updatedGame.teamA.fouls,
      updatedGame.teamB.fouls,
      updatedGame.teamA.timeouts,
      updatedGame.teamB.timeouts,
      updatedGame.gameState.possession || 'A'
    );
  }, [code, gameType]);

  // ─── Score ────────────────────────────────────────────────────────────────

  const updateScore = useCallback((team: 'A' | 'B', points: number) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const newScore = Math.max(0, game[teamKey].score + points);

    // 1. Durable Write (Firestore)
    updateGameField(code, `${teamKey}.score`, newScore);

    // 2. Instant Mirror (RTDB)
    const updatedGame = {
      ...game,
      [teamKey]: { ...game[teamKey], score: newScore },
    };
    syncScoreToRTDB(updatedGame);
  }, [code, game, syncScoreToRTDB]);

  // ─── Fouls ────────────────────────────────────────────────────────────────

  const updateFouls = useCallback((team: 'A' | 'B', increment = 1) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const newFouls = Math.max(0, game[teamKey].fouls + increment);
    const newFoulsThisQ = Math.max(0, game[teamKey].foulsThisQuarter + increment);

    batchUpdateGame(code, {
      [`${teamKey}.fouls`]: newFouls,
      [`${teamKey}.foulsThisQuarter`]: newFoulsThisQ,
    });

    const updatedGame = {
      ...game,
      [teamKey]: { ...game[teamKey], fouls: newFouls, foulsThisQuarter: newFoulsThisQ },
    };
    syncScoreToRTDB(updatedGame);
  }, [code, game, syncScoreToRTDB]);

  // ─── Timeouts ─────────────────────────────────────────────────────────────

  const updateTimeouts = useCallback((team: 'A' | 'B', increment = -1) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const newTimeouts = Math.max(0, game[teamKey].timeouts + increment);

    updateGameField(code, `${teamKey}.timeouts`, newTimeouts);

    const updatedGame = {
      ...game,
      [teamKey]: { ...game[teamKey], timeouts: newTimeouts },
    };
    syncScoreToRTDB(updatedGame);
  }, [code, game, syncScoreToRTDB]);

  // ─── Possession ───────────────────────────────────────────────────────────

  const togglePossession = useCallback(() => {
    const nextPos = game.gameState.possession === 'A' ? 'B' : 'A';
    updateGameField(code, 'gameState.possession', nextPos);

    // Manual sync because 'game' state might be stale in this closure
    if (gameType !== 'local') {
      pushScoreUpdate(
        code,
        game.teamA.score, game.teamB.score,
        game.teamA.fouls, game.teamB.fouls,
        game.teamA.timeouts, game.teamB.timeouts,
        nextPos
      );
    }
  }, [code, game, gameType]);

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