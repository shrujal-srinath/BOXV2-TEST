// src/pages/PlayerSeasonStatsPage.tsx
// Page wrapper for player season stats view

import { useParams, useNavigate } from 'react-router-dom';
import { PlayerSeasonView } from '../components/stats/player/PlayerSeasonView';

export const PlayerSeasonStatsPage = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();

  if (!playerId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400">Invalid player ID</div>
      </div>
    );
  }

  return (
    <PlayerSeasonView
      playerId={playerId}
      onBack={() => navigate(-1)}
    />
  );
};
