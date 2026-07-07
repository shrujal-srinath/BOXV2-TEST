// src/components/stats/player/PlayerSeasonView.tsx
// Player season stats page with trends, career highs, and game log

import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';
import { computeSeasonStats, type SeasonStats } from '../../../services/statsService';
import { SeasonTrendChart } from '../charts/SeasonTrendChart';
import { StatCard } from '../shared/StatCard';
import { StatPill } from '../shared/StatPill';
import { ExportButton } from '../shared/ExportButton';
import { StatsErrorBoundary } from '../shared/ErrorBoundary';
import {
  PlayerHeroSkeleton,
  ChartSkeleton,
  PlayerTableSkeleton,
} from '../shared/LoadingSkeletons';
import {
  exportSeasonStatsAsCSV,
  exportSeasonStatsAsJSON,
  exportSeasonStatsAsPDF,
} from '../../../services/exportService';

interface PlayerSeasonViewProps {
  playerId: string;
  playerName?: string;
  jerseyNumber?: number;
  onBack?: () => void;
}

export const PlayerSeasonView = ({
  playerId,
  playerName,
  jerseyNumber,
  onBack,
}: PlayerSeasonViewProps) => {
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeasonStats = async () => {
      try {
        setLoading(true);

        // Fetch all games for this player
        const { data: gameLogs } = await supabase
          .from('player_game_log')
          .select(`
            id,
            game_code,
            sport_stats,
            created_at,
            games (
              code,
              created_at,
              team_a,
              team_b
            )
          `)
          .eq('player_id', playerId)
          .order('created_at', { ascending: true });

        if (!gameLogs || gameLogs.length === 0) {
          setSeasonStats({
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
          });
          return;
        }

        // Transform game logs into format for season stats computation
        const gameData = gameLogs.map((log: any) => {
          const stats = log.sport_stats || {};
          const gameDate = new Date(log.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          // Try to determine opponent
          const game = log.games?.[0];
          let opponent = 'Unknown';
          if (game) {
            const teamA = typeof game.team_a === 'string' ? JSON.parse(game.team_a) : game.team_a;
            const teamB = typeof game.team_b === 'string' ? JSON.parse(game.team_b) : game.team_b;
            opponent = teamA?.name || teamB?.name || 'Unknown';
          }

          return {
            date: gameDate,
            opponent,
            pts: stats.pts || 0,
            ast: stats.ast || 0,
            reb: stats.reb || 0,
            fgm: stats.fgm || 0,
            fga: stats.fga || 0,
            tpm: stats.tpm || 0,
            tpa: stats.tpa || 0,
            ftm: stats.ftm || 0,
            fta: stats.fta || 0,
            to: stats.to || 0,
          };
        });

        const stats = computeSeasonStats(gameData);
        setSeasonStats(stats);
      } catch (error) {
        console.error('[PlayerSeasonView] Error loading season stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSeasonStats();
  }, [playerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-end mb-6">
            <div className="h-8 bg-zinc-800 rounded w-20"></div>
          </div>
          <PlayerHeroSkeleton />
          <div className="mb-8">
            <div className="h-6 bg-zinc-700 rounded w-32 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-zinc-800 rounded"></div>
              ))}
            </div>
          </div>
          <ChartSkeleton />
          <PlayerTableSkeleton />
        </div>
      </div>
    );
  }

  if (!seasonStats) {
    return (
      <StatsErrorBoundary>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <div className="text-zinc-400">No season data available</div>
          </div>
        </div>
      </StatsErrorBoundary>
    );
  }

  return (
    <StatsErrorBoundary>
      <div className="min-h-screen bg-zinc-950 p-6">
        <div className="max-w-6xl mx-auto">
        {/* Navigation and export */}
        <div className="flex justify-between items-center mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-2"
            >
              ← Back to Player Stats
            </button>
          )}
          <ExportButton
            onExportCSV={() =>
              exportSeasonStatsAsCSV(seasonStats!, playerName || 'Player')
            }
            onExportJSON={() =>
              exportSeasonStatsAsJSON(seasonStats!, playerName || 'Player')
            }
            onExportPDF={() =>
              exportSeasonStatsAsPDF(seasonStats!, playerName || 'Player')
            }
            variant="compact"
          />
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-700 p-8 mb-8">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-black text-white">
                {jerseyNumber || '?'}
              </span>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-black text-white mb-1">
                {playerName || `Player ${playerId.slice(0, 8)}`}
              </h1>
              <p className="text-sm text-zinc-400">
                Season Statistics · {seasonStats.totalGames} Games
              </p>
            </div>
          </div>

          {/* Season average pills */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatPill
              label="PPG"
              value={seasonStats.seasonAverages.ppg.toFixed(1)}
              color="red"
              size="lg"
            />
            <StatPill
              label="APG"
              value={seasonStats.seasonAverages.apg.toFixed(1)}
              color="blue"
              size="lg"
            />
            <StatPill
              label="RPG"
              value={seasonStats.seasonAverages.rpg.toFixed(1)}
              color="green"
              size="lg"
            />
            <StatPill
              label="FG%"
              value={seasonStats.seasonAverages.fgPct.toFixed(1) + '%'}
              size="lg"
            />
            <StatPill
              label="TS%"
              value={seasonStats.seasonAverages.tsPct.toFixed(1) + '%'}
              size="lg"
            />
          </div>
        </div>

        {/* Career Highs */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-zinc-100 border-l-4 border-red-600 pl-3 mb-5">
            Career Highs
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label="Highest Scoring Game"
              value={seasonStats.careerHighs.points.value}
              subtext={`vs ${seasonStats.careerHighs.points.opponent}`}
              variant="highlight"
            />
            <StatCard
              label="Most Assists"
              value={seasonStats.careerHighs.assists.value}
              subtext={`vs ${seasonStats.careerHighs.assists.opponent}`}
              variant="highlight"
            />
            <StatCard
              label="Most Rebounds"
              value={seasonStats.careerHighs.rebounds.value}
              subtext={`vs ${seasonStats.careerHighs.rebounds.opponent}`}
              variant="highlight"
            />
            <StatCard
              label="Best FG%"
              value={`${seasonStats.careerHighs.fgPct.value.toFixed(1)}%`}
              subtext={`vs ${seasonStats.careerHighs.fgPct.opponent}`}
              variant="highlight"
            />
          </div>
        </div>

        {/* Season Trend Chart */}
        <div className="mb-8">
          <SeasonTrendChart
            data={seasonStats.gameLogs.map(g => ({
              gameNum: g.gameNum,
              date: g.date,
              ppg: g.pts,
              apg: g.ast,
              rpg: g.reb,
              fgPct: g.fgPct,
            }))}
          />
        </div>

        {/* Game Log Table */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-700">
            <h3 className="text-sm font-bold text-zinc-100">Game-by-Game Log</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Game
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Opponent
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    PTS
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    AST
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    REB
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    FG%
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    3P%
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    FG
                  </th>
                </tr>
              </thead>
              <tbody>
                {seasonStats.gameLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 text-center text-zinc-500">
                      No games played
                    </td>
                  </tr>
                ) : (
                  seasonStats.gameLogs.map((game) => (
                    <tr key={game.gameNum} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-300 font-semibold">
                        Game {game.gameNum}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {game.opponent}
                      </td>
                      <td className="text-center px-4 py-3 font-bold text-red-500">
                        {game.pts}
                      </td>
                      <td className="text-center px-4 py-3 text-zinc-300">
                        {game.ast}
                      </td>
                      <td className="text-center px-4 py-3 text-zinc-300">
                        {game.reb}
                      </td>
                      <td className="text-center px-4 py-3 text-zinc-300">
                        {game.fgPct.toFixed(1)}%
                      </td>
                      <td className="text-center px-4 py-3 text-zinc-300">
                        {game.tpPct.toFixed(1)}%
                      </td>
                      <td className="text-center px-4 py-3 text-zinc-400 text-xs">
                        {game.fgm}/{game.fga}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    </StatsErrorBoundary>
  );
};
