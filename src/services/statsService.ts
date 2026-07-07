// src/services/statsService.ts
// Compute player stats from shot_events and game_actions

import type { ShotEvent, GameAction } from '../components/shotchart/types/shotTypes';

export interface PlayerGameStats {
  playerId: string;
  playerName?: string;
  jerseyNumber?: number;
  // Counting stats
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  to: number;
  pf: number;
  stl: number;
  blk: number;
  minutesPlayed: number;
  // Efficiency
  fgPct: number;
  tpPct: number;
  ftPct: number;
  tsPct: number;
  // Breakdown by period
  statsByPeriod: Record<number, {
    pts: number;
    fga: number;
    fgm: number;
  }>;
  // Zone breakdown
  shotsByZone: Record<string, {
    fgm: number;
    fga: number;
    fgPct: number;
    pts: number;
  }>;
}

export interface ZoneStats {
  zone: string;
  fgm: number;
  fga: number;
  fgPct: number;
  pts: number;
  distance?: string;
}

export const ZONES_DISTANCE: Record<string, string> = {
  at_rim: '0-3 ft',
  paint: '3-15 ft',
  mid_range: '15-23 ft',
  three_corner_left: '23 ft',
  three_corner_right: '23 ft',
  three_top_left: '24 ft',
  three_top_center: '24 ft',
  three_top_right: '24 ft',
};

/**
 * Compute player game stats from shots and actions
 */
export const computePlayerGameStats = (
  playerId: string,
  shots: ShotEvent[],
  actions: GameAction[],
  playerName?: string,
  jerseyNumber?: number
): PlayerGameStats => {
  const playerShots = shots.filter(s => s.playerId === playerId);
  const playerActions = actions.filter(a => a.playerId === playerId);

  // Counting stats
  const fgm = playerShots.filter(s => s.made && s.points !== 1).length;
  const fga = playerShots.filter(s => s.points !== 1).length;
  const tpm = playerShots.filter(s => s.made && s.points === 3).length;
  const tpa = playerShots.filter(s => s.points === 3).length;
  // Free throws are tracked in shot_events as shotType === 'free_throw'
  const ftm = playerShots.filter(s => s.made && s.shotType === 'free_throw').length;
  const fta = playerShots.filter(s => s.shotType === 'free_throw').length;
  const pts = playerShots.reduce((sum, s) => sum + (s.made ? s.points : 0), 0);

  const reb = playerActions.filter(a => a.actionType === 'rebound').length;
  const ast = playerActions.filter(a => a.actionType === 'assist').length;
  const to = playerActions.filter(a => a.actionType === 'turnover').length;
  const pf = playerActions.filter(a => a.actionType === 'foul').length;
  const stl = playerActions.filter(a => a.actionType === 'steal').length;
  const blk = playerActions.filter(a => a.actionType === 'block').length;

  // Efficiency percentages
  const fgPct = fga > 0 ? (fgm / fga) * 100 : 0;
  const tpPct = tpa > 0 ? (tpm / tpa) * 100 : 0;
  const ftPct = fta > 0 ? (ftm / fta) * 100 : 0;

  // True Shooting % = PTS / (2 * (FGA + 0.44*FTA))
  const tsPct = fga + fta > 0 ? (pts / (2 * (fga + 0.44 * fta))) * 100 : 0;

  // Minutes played (approximate from quarters)
  const periods = new Set([...playerShots.map(s => s.period), ...playerActions.map(a => a.period)]);
  const minutesPlayed = periods.size * 8; // Assuming 8 min quarters

  // Stats by period
  const statsByPeriod: Record<number, any> = {};
  for (let p = 1; p <= 4; p++) {
    const pShots = playerShots.filter(s => s.period === p);
    const periodPts = pShots.reduce((sum, s) => sum + (s.made ? s.points : 0), 0);
    const periodFga = pShots.filter(s => s.points !== 1).length;
    const periodFgm = pShots.filter(s => s.made && s.points !== 1).length;
    statsByPeriod[p] = {
      pts: periodPts,
      fga: periodFga,
      fgm: periodFgm,
    };
  }

  // Shots by zone
  const shotsByZone: Record<string, any> = {};
  playerShots.forEach(shot => {
    if (!shotsByZone[shot.zone]) {
      shotsByZone[shot.zone] = { fgm: 0, fga: 0, pts: 0 };
    }
    shotsByZone[shot.zone].fga++;
    if (shot.made) {
      shotsByZone[shot.zone].fgm++;
      shotsByZone[shot.zone].pts += shot.points;
    }
  });

  // Calculate zone percentages
  Object.keys(shotsByZone).forEach(zone => {
    const data = shotsByZone[zone];
    data.fgPct = data.fga > 0 ? (data.fgm / data.fga) * 100 : 0;
  });

  return {
    playerId,
    playerName,
    jerseyNumber,
    pts,
    fgm,
    fga,
    tpm,
    tpa,
    ftm,
    fta,
    reb,
    ast,
    to,
    pf,
    stl,
    blk,
    minutesPlayed,
    fgPct,
    tpPct,
    ftPct,
    tsPct,
    statsByPeriod,
    shotsByZone,
  };
};

/**
 * Compute stats for all players in a game
 */
export const computeGameStats = (
  shots: ShotEvent[],
  actions: GameAction[],
  playerMap?: Record<string, { name: string; jerseyNumber?: number }>
): Record<string, PlayerGameStats> => {
  const playerIds = new Set([
    ...shots.map(s => s.playerId).filter(Boolean),
    ...actions.map(a => a.playerId).filter(Boolean),
  ]);

  const stats: Record<string, PlayerGameStats> = {};
  playerIds.forEach(playerId => {
    if (playerId) {
      const playerInfo = playerMap?.[playerId];
      stats[playerId] = computePlayerGameStats(
        playerId,
        shots,
        actions,
        playerInfo?.name,
        playerInfo?.jerseyNumber
      );
    }
  });

  return stats;
};

/**
 * Compute team stats
 */
export const computeTeamStats = (
  teamSide: 'A' | 'B',
  shots: ShotEvent[],
  actions: GameAction[]
) => {
  const teamShots = shots.filter(s => s.teamSide === teamSide);
  const teamActions = actions.filter(a => a.teamSide === teamSide);

  const fgm = teamShots.filter(s => s.made && s.points !== 1).length;
  const fga = teamShots.filter(s => s.points !== 1).length;
  const tpm = teamShots.filter(s => s.made && s.points === 3).length;
  const tpa = teamShots.filter(s => s.points === 3).length;
  const pts = teamShots.reduce((sum, s) => sum + (s.made ? s.points : 0), 0);
  const reb = teamActions.filter(a => a.actionType === 'rebound').length;
  const ast = teamActions.filter(a => a.actionType === 'assist').length;
  const to = teamActions.filter(a => a.actionType === 'turnover').length;
  const pf = teamActions.filter(a => a.actionType === 'foul').length;

  return {
    pts,
    fgm,
    fga,
    fgPct: fga > 0 ? (fgm / fga) * 100 : 0,
    tpm,
    tpa,
    tpPct: tpa > 0 ? (tpm / tpa) * 100 : 0,
    reb,
    ast,
    to,
    pf,
  };
};

/**
 * Get zone stats sorted by FG%
 */
export const getZoneStats = (playerStats: PlayerGameStats): ZoneStats[] => {
  return Object.entries(playerStats.shotsByZone)
    .map(([zone, data]) => ({
      zone,
      ...data,
      distance: ZONES_DISTANCE[zone] || 'unknown',
    }))
    .sort((a, b) => b.fga - a.fga);
};

/**
 * Season stats aggregated from game logs
 */
export interface SeasonStats {
  totalGames: number;
  careerHighs: {
    points: { value: number; date: string; opponent: string };
    assists: { value: number; date: string; opponent: string };
    rebounds: { value: number; date: string; opponent: string };
    fgPct: { value: number; date: string; opponent: string };
  };
  seasonAverages: {
    ppg: number;
    apg: number;
    rpg: number;
    fgPct: number;
    tpPct: number;
    ftPct: number;
    tsPct: number;
  };
  gameLogs: Array<{
    gameNum: number;
    date: string;
    opponent: string;
    pts: number;
    ast: number;
    reb: number;
    fgm: number;
    fga: number;
    tpm: number;
    tpa: number;
    ftm: number;
    fta: number;
    to: number;
    fgPct: number;
    tpPct: number;
    ftPct: number;
    tsPct: number;
  }>;
}

/**
 * Compute season stats from array of game stats
 */
export const computeSeasonStats = (
  gameStats: Array<{
    date: string;
    opponent: string;
    pts: number;
    ast: number;
    reb: number;
    fgm: number;
    fga: number;
    tpm: number;
    tpa: number;
    ftm: number;
    fta: number;
    to: number;
  }>
): SeasonStats => {
  if (gameStats.length === 0) {
    return {
      totalGames: 0,
      careerHighs: {
        points: { value: 0, date: '', opponent: '' },
        assists: { value: 0, date: '', opponent: '' },
        rebounds: { value: 0, date: '', opponent: '' },
        fgPct: { value: 0, date: '', opponent: '' },
      },
      seasonAverages: {
        ppg: 0,
        apg: 0,
        rpg: 0,
        fgPct: 0,
        tpPct: 0,
        ftPct: 0,
        tsPct: 0,
      },
      gameLogs: [],
    };
  }

  // Compute efficiency for each game
  const gameLogs = gameStats.map((stat, idx) => {
    const fgPct = stat.fga > 0 ? (stat.fgm / stat.fga) * 100 : 0;
    const tpPct = stat.tpa > 0 ? (stat.tpm / stat.tpa) * 100 : 0;
    const ftPct = stat.fta > 0 ? (stat.ftm / stat.fta) * 100 : 0;
    const tsPct = stat.fga + stat.fta > 0 ? (stat.pts / (2 * (stat.fga + 0.44 * stat.fta))) * 100 : 0;

    return {
      gameNum: idx + 1,
      date: stat.date,
      opponent: stat.opponent,
      pts: stat.pts,
      ast: stat.ast,
      reb: stat.reb,
      fgm: stat.fgm,
      fga: stat.fga,
      tpm: stat.tpm,
      tpa: stat.tpa,
      ftm: stat.ftm,
      fta: stat.fta,
      to: stat.to,
      fgPct,
      tpPct,
      ftPct,
      tsPct,
    };
  });

  // Career highs
  const highestPtsGame = gameLogs.reduce((a, b) => (a.pts > b.pts ? a : b));
  const highestAstGame = gameLogs.reduce((a, b) => (a.ast > b.ast ? a : b));
  const highestRebGame = gameLogs.reduce((a, b) => (a.reb > b.reb ? a : b));
  const highestFgPctGame = gameLogs.filter(g => g.fga >= 5).reduce((a, b) => (a.fgPct > b.fgPct ? a : b), gameLogs[0]);

  // Season averages
  const totalPts = gameLogs.reduce((sum, g) => sum + g.pts, 0);
  const totalAst = gameLogs.reduce((sum, g) => sum + g.ast, 0);
  const totalReb = gameLogs.reduce((sum, g) => sum + g.reb, 0);
  const totalFgm = gameLogs.reduce((sum, g) => sum + g.fgm, 0);
  const totalFga = gameLogs.reduce((sum, g) => sum + g.fga, 0);
  const totalTpm = gameLogs.reduce((sum, g) => sum + g.tpm, 0);
  const totalTpa = gameLogs.reduce((sum, g) => sum + g.tpa, 0);
  const totalFtm = gameLogs.reduce((sum, g) => sum + g.ftm, 0);
  const totalFta = gameLogs.reduce((sum, g) => sum + g.fta, 0);

  const numGames = gameLogs.length;

  return {
    totalGames: numGames,
    careerHighs: {
      points: { value: highestPtsGame.pts, date: highestPtsGame.date, opponent: highestPtsGame.opponent },
      assists: { value: highestAstGame.ast, date: highestAstGame.date, opponent: highestAstGame.opponent },
      rebounds: { value: highestRebGame.reb, date: highestRebGame.date, opponent: highestRebGame.opponent },
      fgPct: { value: highestFgPctGame.fgPct, date: highestFgPctGame.date, opponent: highestFgPctGame.opponent },
    },
    seasonAverages: {
      ppg: totalPts / numGames,
      apg: totalAst / numGames,
      rpg: totalReb / numGames,
      fgPct: totalFga > 0 ? (totalFgm / totalFga) * 100 : 0,
      tpPct: totalTpa > 0 ? (totalTpm / totalTpa) * 100 : 0,
      ftPct: totalFta > 0 ? (totalFtm / totalFta) * 100 : 0,
      tsPct: totalFga + totalFta > 0 ? (totalPts / (2 * (totalFga + 0.44 * totalFta))) * 100 : 0,
    },
    gameLogs,
  };
};
