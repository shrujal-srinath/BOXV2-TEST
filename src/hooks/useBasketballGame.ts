import { useState, useEffect } from 'react';
import type { BasketballGame } from '../types';
import { subscribeToGame, updateGameField, createGame } from '../services/gameService';

const INITIAL_GAME: BasketballGame = {
  hostId: null,
  code: "DEMO",
  gameType: "friendly",
  sport: "basketball",
  status: "live",
  settings: { gameName: "Demo Game", periodDuration: 10, shotClockDuration: 24, periodType: "quarter" },
  teamA: { 
    name: "Team A", color: "#EA4335", score: 0, timeouts: 7, fouls: 0,
    players: [] 
  },
  teamB: { 
    name: "Team B", color: "#4285F4", score: 0, timeouts: 7, fouls: 0,
    players: [] 
  },
  gameState: { 
    period: 1, 
    gameTime: { minutes: 10, seconds: 0, tenths: 0 }, 
    shotClock: 24.0, 
    possession: "A", 
    gameRunning: false, 
    shotClockRunning: false 
  },
  lastUpdate: Date.now()
};

export const useBasketballGame = (gameCode: string) => {
  const [game, setGame] = useState<BasketballGame | null>(null);

  useEffect(() => {
    // 1. Try to create the game. If it fails (because it exists), that's fine.
    createGame(gameCode, INITIAL_GAME).catch((err) => console.log("Game check:", err));

    // 2. Subscribe to updates
    const unsubscribe = subscribeToGame(gameCode, (data) => {
      setGame(data);
    });

    return () => unsubscribe();
  }, [gameCode]);

  // If loading, return the default structure immediately so the app doesn't crash
  if (!game) return { 
    ...INITIAL_GAME, 
    updateScore: () => {}, 
    updateFouls: () => {}, 
    updateTimeouts: () => {},
    togglePossession: () => {}, 
    setPeriod: () => {},
    updateGameTime: () => {},
    resetShotClock: () => {},
    updatePlayerStats: () => {}
  };

  // --- ACTIONS ---

  const updateScore = (team: 'A' | 'B', points: number) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const newScore = Math.max(0, game[teamKey].score + points);
    updateGameField(gameCode, `${teamKey}.score`, newScore);
  };

  const updateFouls = (team: 'A' | 'B', change: number) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const newFouls = Math.max(0, game[teamKey].fouls + change);
    updateGameField(gameCode, `${teamKey}.fouls`, newFouls);
  };

  const updateTimeouts = (team: 'A' | 'B', change: number) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const newTimeouts = Math.max(0, Math.min(7, game[teamKey].timeouts + change));
    updateGameField(gameCode, `${teamKey}.timeouts`, newTimeouts);
  };

  const togglePossession = () => {
    const newPoss = game.gameState.possession === 'A' ? 'B' : 'A';
    updateGameField(gameCode, 'gameState.possession', newPoss);
  };

  const setPeriod = (newPeriod: number) => {
    updateGameField(gameCode, 'gameState.period', newPeriod);
  };

  // The Game Clock Tick
  const updateGameTime = (m: number, s: number, t: number) => {
    // 1. Calculate new Shot Clock
    let newShotClock = game.gameState.shotClock;
    if (newShotClock > 0) {
      // Decrease by 0.1s
      newShotClock = parseFloat((newShotClock - 0.1).toFixed(1));
    }

    updateGameField(gameCode, 'gameState', {
      ...game.gameState,
      gameTime: { minutes: m, seconds: s, tenths: t },
      shotClock: newShotClock
    });
  };

  const resetShotClock = (seconds: number) => {
    updateGameField(gameCode, 'gameState.shotClock', seconds);
  };

  // === NEW: Player Stats Logic ===
  const updatePlayerStats = (team: 'A' | 'B', playerId: string, points: number, fouls: number) => {
    const teamKey = team === 'A' ? 'teamA' : 'teamB';
    const currentTeam = game[teamKey];
    
    // 1. Update the specific player in the roster
    const updatedPlayers = currentTeam.players.map(p => {
      if (p.id === playerId) {
        return { 
          ...p, 
          points: p.points + points, 
          fouls: p.fouls + fouls 
        };
      }
      return p;
    });

    // 2. Update Team Totals
    const newScore = Math.max(0, currentTeam.score + points);
    const newTeamFouls = Math.max(0, currentTeam.fouls + fouls);

    // 3. Sync everything to Cloud
    updateGameField(gameCode, teamKey, {
      ...currentTeam,
      score: newScore,
      fouls: newTeamFouls,
      players: updatedPlayers
    });
  };

  return {
    ...game,
    updateScore,
    updateFouls,
    updateTimeouts,
    togglePossession,
    setPeriod,
    updateGameTime,
    resetShotClock,
    updatePlayerStats // Exported!
  };
};