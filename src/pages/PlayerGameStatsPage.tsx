// src/pages/PlayerGameStatsPage.tsx
// Page wrapper for the v2 (design-system) individual player game stats view.

import { useParams, useNavigate } from 'react-router-dom';
import { PlayerGameViewV2 } from '../components/stats/player/PlayerGameViewV2';

export const PlayerGameStatsPage = () => {
  const { playerId, code } = useParams<{ playerId: string; code: string }>();
  const navigate = useNavigate();

  if (!playerId || !code) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F0EEE9] dark:bg-zinc-950">
        <div className="text-slate-500 dark:text-zinc-400">Invalid parameters</div>
      </div>
    );
  }

  return (
    <PlayerGameViewV2
      gameCode={code}
      playerId={playerId}
      onBack={() => navigate(-1)}
      onViewGame={() => navigate(`/game/${code}/stats`)}
    />
  );
};
