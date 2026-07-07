// src/pages/GameStatsPage.tsx
// Wrapper page for the v2 mode-aware game stats hub.

import { useParams, useNavigate } from 'react-router-dom';
import { StatsHub } from '../components/stats/StatsHub';

export const GameStatsPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  if (!code) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F0EEE9] dark:bg-zinc-950">
        <div className="text-slate-500 dark:text-zinc-400">Invalid game code</div>
      </div>
    );
  }

  return (
    <StatsHub
      gameCode={code}
      onBack={() => navigate(-1)}
      onPlayerClick={(playerId) => navigate(`/player/${playerId}/game/${code}`)}
    />
  );
};
