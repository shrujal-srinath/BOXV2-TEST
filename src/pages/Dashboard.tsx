import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { subscribeToUserGames, subscribeToOtherUsersGames } from '../services/gameService';
import { BasketballGame } from '../types';
import { User } from 'firebase/auth';
import './Dashboard.css';

interface GameCardProps {
  game: BasketballGame;
  isOwner: boolean;
  onControl?: () => void;
  onWatch: () => void;
}

const GameCard: React.FC<GameCardProps> = ({ game, isOwner, onControl, onWatch }) => {
  // Helper to format time
  const formatTime = (minutes: number, seconds: number): string => {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="game-card">
      <div className="game-card-header">
        <h3 className="game-card-title">
          {game.teamA.name} vs {game.teamB.name}
        </h3>
        <span className="game-card-badge">LIVE</span>
      </div>

      <div className="game-card-info">
        <div className="game-score">
          <span className="score-home">{game.teamA.score}</span>
          <span className="score-separator">-</span>
          <span className="score-away">{game.teamB.score}</span>
        </div>
        <div className="game-meta">
          <span>Q{game.gameState.period}</span>
          <span className="separator">•</span>
          <span>{formatTime(game.gameState.gameTime.minutes, game.gameState.gameTime.seconds)}</span>
          <span className="separator">•</span>
          <span className="game-code">Code: {game.code}</span>
        </div>
      </div>

      <div className="game-card-actions">
        {isOwner ? (
          // User's own games - Full control
          <>
            <button className="btn btn-primary" onClick={onControl}>
              🎮 Control Game
            </button>
            <button className="btn btn-secondary" onClick={onWatch}>
              👁️ Watch
            </button>
          </>
        ) : (
          // Other people's games - Watch only
          <button className="btn btn-watch-full" onClick={onWatch}>
            👁️ Watch Game
          </button>
        )}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [myGames, setMyGames] = useState<BasketballGame[]>([]);
  const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Subscribe to user's games
  useEffect(() => {
    if (!user) {
      setMyGames([]);
      return;
    }

    const unsubscribe = subscribeToUserGames(user.uid, (games) => {
      setMyGames(games);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to other users' games
  useEffect(() => {
    if (!user) {
      setLiveGames([]);
      return;
    }

    const unsubscribe = subscribeToOtherUsersGames(user.uid, (games) => {
      setLiveGames(games);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateGame = () => {
    navigate('/create-game');
  };

  const handleControlGame = (gameCode: string) => {
    navigate(`/host/${gameCode}`);
  };

  const handleWatchGame = (gameCode: string) => {
    navigate(`/watch/${gameCode}`);
  };

  const handleLogout = async () => {
    // Implement logout logic
    navigate('/');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard-unauthorized">
        <h2>Access Denied</h2>
        <p>Please log in to access the dashboard.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <h1 className="dashboard-title">🏀 THE BOX Dashboard</h1>
          <div className="dashboard-header-actions">
            <span className="user-info">
              {user.displayName || user.email}
            </span>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Quick Actions */}
        <section className="dashboard-section">
          <div className="quick-actions">
            <button className="btn btn-primary btn-large" onClick={handleCreateGame}>
              ➕ Create New Game
            </button>
          </div>
        </section>

        {/* My Games Section */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">
              🏀 MY GAMES
              <span className="section-count">({myGames.length})</span>
            </h2>
            <p className="section-description">
              Games you created - You have full control
            </p>
          </div>

          {myGames.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎮</div>
              <p className="empty-text">No active games</p>
              <p className="empty-subtext">Create a new game to get started!</p>
            </div>
          ) : (
            <div className="games-grid">
              {myGames.map((game) => (
                <GameCard
                  key={game.code}
                  game={game}
                  isOwner={true}
                  onControl={() => handleControlGame(game.code)}
                  onWatch={() => handleWatchGame(game.code)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Live Games Section */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">
              📺 LIVE GAMES
              <span className="section-count">({liveGames.length})</span>
            </h2>
            <p className="section-description">
              Watch games created by other users
            </p>
          </div>

          {liveGames.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📺</div>
              <p className="empty-text">No live games from other users</p>
              <p className="empty-subtext">Check back later for more games!</p>
            </div>
          ) : (
            <div className="games-grid">
              {liveGames.map((game) => (
                <GameCard
                  key={game.code}
                  game={game}
                  isOwner={false}
                  onWatch={() => handleWatchGame(game.code)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;