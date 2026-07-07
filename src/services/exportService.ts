// src/services/exportService.ts
// Export stats to PDF, CSV, and JSON formats

import type { PlayerGameStats, SeasonStats } from './statsService';

/**
 * Generate CSV content from player game stats
 */
export const generateGameStatsCSV = (
  playerStats: Record<string, PlayerGameStats>,
  gameCode: string
): string => {
  const headers = [
    'Player',
    'Jersey',
    'PTS',
    'FGM',
    'FGA',
    'FG%',
    '3PM',
    '3PA',
    '3P%',
    'FTM',
    'FTA',
    'FT%',
    'REB',
    'AST',
    'TO',
    'STL',
    'BLK',
    'TS%',
  ];

  const rows = Object.values(playerStats).map((stats) => [
    stats.playerName || `Player ${stats.playerId.slice(0, 8)}`,
    stats.jerseyNumber || '',
    stats.pts,
    stats.fgm,
    stats.fga,
    stats.fgPct.toFixed(1),
    stats.tpm,
    stats.tpa,
    stats.tpPct.toFixed(1),
    stats.ftm,
    stats.fta,
    stats.ftPct.toFixed(1),
    stats.reb,
    stats.ast,
    stats.to,
    stats.stl,
    stats.blk,
    stats.tsPct.toFixed(1),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  return csv;
};

/**
 * Generate CSV content from player season stats
 */
export const generateSeasonStatsCSV = (
  seasonStats: SeasonStats,
  playerName: string
): string => {
  const lines = [
    `Player,${playerName}`,
    `Games Played,${seasonStats.totalGames}`,
    '',
    'Season Averages',
    'Stat,Value',
    `PPG,${seasonStats.seasonAverages.ppg.toFixed(1)}`,
    `APG,${seasonStats.seasonAverages.apg.toFixed(1)}`,
    `RPG,${seasonStats.seasonAverages.rpg.toFixed(1)}`,
    `FG%,${seasonStats.seasonAverages.fgPct.toFixed(1)}`,
    `3P%,${seasonStats.seasonAverages.tpPct.toFixed(1)}`,
    `FT%,${seasonStats.seasonAverages.ftPct.toFixed(1)}`,
    `TS%,${seasonStats.seasonAverages.tsPct.toFixed(1)}`,
    '',
    'Career Highs',
    `Highest Scoring Game,${seasonStats.careerHighs.points.value} pts vs ${seasonStats.careerHighs.points.opponent}`,
    `Most Assists,${seasonStats.careerHighs.assists.value} ast vs ${seasonStats.careerHighs.assists.opponent}`,
    `Most Rebounds,${seasonStats.careerHighs.rebounds.value} reb vs ${seasonStats.careerHighs.rebounds.opponent}`,
    `Best FG%,${seasonStats.careerHighs.fgPct.value.toFixed(1)}% vs ${seasonStats.careerHighs.fgPct.opponent}`,
    '',
    'Game Log',
    'Game #,Opponent,PTS,AST,REB,FG%,3P%,FGM/FGA,FTM/FTA,TO',
  ];

  seasonStats.gameLogs.forEach((game) => {
    lines.push(
      `${game.gameNum},${game.opponent},${game.pts},${game.ast},${game.reb},${game.fgPct.toFixed(
        1
      )},${game.tpPct.toFixed(1)},${game.fgm}/${game.fga},${game.ftm}/${game.fta},${game.to}`
    );
  });

  return lines.join('\n');
};

/**
 * Download content as file
 */
export const downloadFile = (
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export game stats as CSV
 */
export const exportGameStatsAsCSV = (
  playerStats: Record<string, PlayerGameStats>,
  gameCode: string
): void => {
  const csv = generateGameStatsCSV(playerStats, gameCode);
  downloadFile(csv, `game-${gameCode}-stats.csv`, 'text/csv');
};

/**
 * Export game stats as JSON
 */
export const exportGameStatsAsJSON = (
  playerStats: Record<string, PlayerGameStats>,
  gameCode: string,
  gameInfo?: any
): void => {
  const data = {
    game: {
      code: gameCode,
      date: gameInfo?.created_at || new Date().toISOString(),
      teamA: gameInfo?.team_a?.name || 'Team A',
      teamB: gameInfo?.team_b?.name || 'Team B',
    },
    players: Object.values(playerStats),
  };

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `game-${gameCode}-stats.json`, 'application/json');
};

/**
 * Export season stats as CSV
 */
export const exportSeasonStatsAsCSV = (
  seasonStats: SeasonStats,
  playerName: string
): void => {
  const csv = generateSeasonStatsCSV(seasonStats, playerName);
  downloadFile(csv, `${playerName.toLowerCase().replace(/\s+/g, '-')}-season-stats.csv`, 'text/csv');
};

/**
 * Export season stats as JSON
 */
export const exportSeasonStatsAsJSON = (
  seasonStats: SeasonStats,
  playerName: string
): void => {
  const data = {
    player: playerName,
    seasonStats,
  };

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${playerName.toLowerCase().replace(/\s+/g, '-')}-season-stats.json`, 'application/json');
};

/**
 * Generate HTML for PDF export
 */
export const generateGameStatsHTML = (
  playerStats: Record<string, PlayerGameStats>,
  gameCode: string,
  gameInfo?: any
): string => {
  const teamAStats = Object.values(playerStats).filter(
    (p) => Object.values(playerStats).indexOf(p) < Object.keys(playerStats).length / 2
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Game Stats - ${gameCode}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: white; }
        h1 { color: #333; border-bottom: 3px solid #dc2626; padding-bottom: 10px; }
        h2 { color: #666; margin-top: 20px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f3f4f6; padding: 10px; text-align: left; border: 1px solid #e5e7eb; font-weight: bold; }
        td { padding: 10px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        .stat-value { font-weight: bold; color: #dc2626; }
        .game-header { text-align: center; margin-bottom: 30px; }
        .score { font-size: 2em; color: #333; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="game-header">
        <h1>Game Statistics - ${gameCode}</h1>
        <p>${new Date().toLocaleDateString()}</p>
      </div>

      <h2>${gameInfo?.team_a?.name || 'Team A'}</h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>PTS</th>
            <th>FG%</th>
            <th>3P%</th>
            <th>AST</th>
            <th>REB</th>
            <th>TO</th>
            <th>TS%</th>
          </tr>
        </thead>
        <tbody>
          ${teamAStats
            .map(
              (stats) => `
            <tr>
              <td>${stats.playerName || 'Unknown'}</td>
              <td class="stat-value">${stats.pts}</td>
              <td>${stats.fgPct.toFixed(1)}%</td>
              <td>${stats.tpPct.toFixed(1)}%</td>
              <td>${stats.ast}</td>
              <td>${stats.reb}</td>
              <td>${stats.to}</td>
              <td>${stats.tsPct.toFixed(1)}%</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  return html;
};

/**
 * Export game stats as PDF (basic HTML-based)
 */
export const exportGameStatsAsPDF = async (
  playerStats: Record<string, PlayerGameStats>,
  gameCode: string,
  gameInfo?: any
): Promise<void> => {
  try {
    // Dynamic import to reduce bundle size
    const html2pdf = (await import('html2pdf.js')).default;

    const html = generateGameStatsHTML(playerStats, gameCode, gameInfo);
    const element = document.createElement('div');
    element.innerHTML = html;

    const options: any = {
      margin: 10,
      filename: `game-${gameCode}-stats.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' },
    };

    html2pdf().set(options).from(element).save();
  } catch (error) {
    console.error('[exportService] PDF export failed:', error);
    alert('PDF export not available. Please use CSV or JSON instead.');
  }
};

/**
 * Export season stats as PDF (basic HTML-based)
 */
export const exportSeasonStatsAsPDF = async (
  seasonStats: SeasonStats,
  playerName: string
): Promise<void> => {
  try {
    const html2pdf = (await import('html2pdf.js')).default;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Season Stats - ${playerName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: white; }
          h1 { color: #333; border-bottom: 3px solid #dc2626; padding-bottom: 10px; }
          h2 { color: #666; margin-top: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #f3f4f6; padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-weight: bold; }
          td { padding: 8px; border: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .stat-value { font-weight: bold; color: #dc2626; }
          .header { text-align: center; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${playerName} - Season Statistics</h1>
          <p>Total Games: ${seasonStats.totalGames}</p>
        </div>

        <h2>Season Averages</h2>
        <table>
          <tr>
            <th>PPG</th>
            <th>APG</th>
            <th>RPG</th>
            <th>FG%</th>
            <th>3P%</th>
            <th>TS%</th>
          </tr>
          <tr>
            <td class="stat-value">${seasonStats.seasonAverages.ppg.toFixed(1)}</td>
            <td>${seasonStats.seasonAverages.apg.toFixed(1)}</td>
            <td>${seasonStats.seasonAverages.rpg.toFixed(1)}</td>
            <td>${seasonStats.seasonAverages.fgPct.toFixed(1)}%</td>
            <td>${seasonStats.seasonAverages.tpPct.toFixed(1)}%</td>
            <td>${seasonStats.seasonAverages.tsPct.toFixed(1)}%</td>
          </tr>
        </table>

        <h2>Career Highs</h2>
        <table>
          <tr>
            <th>Category</th>
            <th>Value</th>
            <th>Opponent</th>
          </tr>
          <tr>
            <td>Highest Scoring Game</td>
            <td class="stat-value">${seasonStats.careerHighs.points.value} PTS</td>
            <td>${seasonStats.careerHighs.points.opponent}</td>
          </tr>
          <tr>
            <td>Most Assists</td>
            <td>${seasonStats.careerHighs.assists.value}</td>
            <td>${seasonStats.careerHighs.assists.opponent}</td>
          </tr>
          <tr>
            <td>Most Rebounds</td>
            <td>${seasonStats.careerHighs.rebounds.value}</td>
            <td>${seasonStats.careerHighs.rebounds.opponent}</td>
          </tr>
          <tr>
            <td>Best FG%</td>
            <td>${seasonStats.careerHighs.fgPct.value.toFixed(1)}%</td>
            <td>${seasonStats.careerHighs.fgPct.opponent}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const element = document.createElement('div');
    element.innerHTML = html;

    const options: any = {
      margin: 10,
      filename: `${playerName.toLowerCase().replace(/\s+/g, '-')}-season-stats.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    };

    html2pdf().set(options).from(element).save();
  } catch (error) {
    console.error('[exportService] PDF export failed:', error);
    alert('PDF export not available. Please use CSV or JSON instead.');
  }
};
