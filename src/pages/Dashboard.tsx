import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { getUserActiveGames, getOtherUsersLiveGames } from '../services/gameService';
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
  return (
    <div className="game-card">
      <div className="game-card-header">
        <h3 className="game-card-title">
          {game.homeTeam.name} vs {game.awayTeam.name}
        </h3>
        <span className="game-card-badge">LIVE</span>
      </div>

      <div className="game-card-info">
        <div className="game-score">
          <span className="score-home">{game.homeTeam.score}</span>
          <span className="score-separator">-</span>
          <span className="score-away">{game.awayTeam.score}</span>
        </div>
        <div className="game-meta">
          <span>Q{game.quarter}</span>
          <span className="separator">•</span>
          <span>{game.clock}</span>
          <span className="separator">•</span>
          <span className="game-code">Code: {game.code}</span>
        </div>
      </div>

      <div className="game-card-host">
        <span className="host-label">Host:</span>
        <span className="host-name">{game.hostName}</span>
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
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Get user's own games
        const userGames = getUserActiveGames(currentUser.uid);
        setMyGames(userGames);

        // Get other users' live games
        const otherGames = getOtherUsersLiveGames(currentUser.uid);
        setLiveGames(otherGames);
      } else {
        setMyGames([]);
        setLiveGames([]);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Refresh games every 5 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const userGames = getUserActiveGames(user.uid);
      setMyGames(userGames);

      const otherGames = getOtherUsersLiveGames(user.uid);
      setLiveGames(otherGames);
    }, 5000);

    return () => clearInterval(interval);
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