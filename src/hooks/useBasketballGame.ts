// src/hooks/useBasketballGame.ts
//
// CHANGE LOG (RTDB clock migration):
//   - toggleTimer, updateGameTime REMOVED — clock is now controlled
//     entirely by useRTDBTimer. HostConsole calls timer.toggleClock() directly.
//   - toggleShotClock REMOVED — use timer.resetShotClock() instead.
//   - setPeriod now only writes durable state to Firestore (fouls reset,
//     period number). The clock reset is handled by useRTDBTimer.nextPeriod().
//   - updateFouls now uses batchUpdateGame (1 write instead of 2).
//   - All scoring still goes to Firestore for the permanent game record.
//
// USAGE in HostConsole:
//   const game = useBasketballGame(gameCode, 'online');   // scores, fouls, roster
//   const timer = useRTDBTimer({ gameCode, isHost: true, ... }); // clock display + controls

import { useState, useEffect, useCallback } from 'react';
import type { BasketballGame, TeamData, Player } from '../types';
import { updateGameField, batchUpdateGame, subscribeToGame } from '../services/gameService';
import { pushScoreUpdate } from '../services/rtdbClockService';

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
    },
    sport: 'basketball',
    status: 'live',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    gameType,
  });

  // Subscribe to Firestore for durable state (scores, fouls, rosters)
  // Clock display comes from useRTDBTimer, not from here
  useEffect(() => {
    if (!code) return;
    const unsubscribe = subscribeToGame(code, (updatedGame) => {
      if (updatedGame) setGame(updatedGame);
    });
    return unsubscribe;
  }, [code]);

  // ─── Helper: push score update to RTDB for instant spectator display ──────
  // This mirrors the Firestore write to RTDB so the SpectatorView
  // (which subscribes to RTDB score) gets the update in <10ms.
  const syncScoreToRTDB = useCallback((updatedGame: BasketballGame) => {
    pushScoreUpdate(
      code,
      updatedGame.teamA.score,
      updatedGame.teamB.score,
      updatedGame.teamA.fouls,
      updatedGame.teamB.fouls,
      updatedGame.teamA.timeouts,
      updatedGame.teamB.timeouts,
      updatedGame.gameState.possession
    );
  }, [code]);

  // ─── Score ────────────────────────────────────────────────────────────────

  const updateScore = useCallback((team: 'A' | 'B', points: number) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const newScore = Math.max(0, game[teamKey].score + points);

    // Write to Firestore (permanent record)
    updateGameField(code, `${teamKey}.score`, newScore);

    // Mirror to RTDB immediately (spectator display)
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

    // Single Firestore write for both foul fields
    batchUpdateGame(code, {
      [`${teamKey}.fouls`]: newFouls,
      [`${teamKey}.foulsThisQuarter`]: newFoulsThisQ,
    });

    // Mirror to RTDB
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

    // Mirror to RTDB
    pushScoreUpdate(
      code,
      game.teamA.score, game.teamB.score,
      game.teamA.fouls, game.teamB.fouls,
      game.teamA.timeouts, game.teamB.timeouts,
      nextPos
    );
  }, [code, game]);

  // ─── Period transition (Firestore only — clock handled by useRTDBTimer) ───
  // Call this AND timer.nextPeriod() from HostConsole when advancing period.
  // This handles the durable state: fouls reset, period number, gameRunning flag.
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

  // ─── Player data ──────────────────────────────────────────────────────────

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

  // ─── Finish game ──────────────────────────────────────────────────────────

  const finishGame = useCallback(() => {
    batchUpdateGame(code, {
      status: 'finished',
      'gameState.gameRunning': false,
      'gameState.shotClockRunning': false,
    });
  }, [code]);

  // ─── Generic action handler (for components that use the old API) ─────────

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
    // Scoring actions
    updateScore,
    updateFouls,
    updateTimeouts,
    togglePossession,
    handleAction,
    // Period
    advancePeriodFirestore,
    // Roster
    updateTeamData,
    updatePlayerData,
    // Game lifecycle
    finishGame,
  };
};