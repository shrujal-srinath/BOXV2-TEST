import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAuth, logoutUser } from '../services/authService';
import { getUserActiveGames, subscribeToLiveGames } from '../services/gameService';
import { BasketballGame } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myGames, setMyGames] = useState<BasketballGame[]>([]);
  const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'my' | 'live'>('my');

  useEffect(() => {
    const unsubAuth = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (!user) {
        navigate('/');
      }
    });

    return () => unsubAuth();
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);

    setLoading(true);

    // Subscribe to ALL live games and filter locally
    const unsub = subscribeToLiveGames((games) => {
      setMyGames(games.filter(g => g.hostId === currentUser.uid));
      setLiveGames(games.filter(g => g.hostId !== currentUser.uid));
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [currentUser]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* HEADER */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto p-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter text-white">THE BOX</h1>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.3em]">Control Center</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 border border-zinc-800 bg-zinc-900 px-4 py-2 rounded-sm">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold">
                {currentUser.email?.[0].toUpperCase() || '?'}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">
                  {currentUser.email?.split('@')[0] || 'Operator'}
                </div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest">
                  Signed In
                </div>
              </div>
            </div>
            <button
              onClick={logoutUser}
              className="p-2 hover:bg-zinc-900 border border-zinc-800 rounded-sm transition-colors text-zinc-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto p-6">

        {/* ACTION BUTTONS */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* PRIMARY: Create New Game */}
          <button
            onClick={() => navigate('/setup')}
            className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 p-8 rounded-xl text-left group transition-all hover:scale-[1.02] shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_40px_rgba(220,38,38,0.5)]"
          >
            <div className="text-4xl mb-3">🏀</div>
            <div className="text-2xl font-black italic uppercase text-white mb-2">
              Create New Game
            </div>
            <div className="text-sm text-red-100/70">
              Launch a new match with full configuration
            </div>
            <div className="mt-4 text-white/80 group-hover:text-white text-2xl transition-transform group-hover:translate-x-1">
              →
            </div>
          </button>

          {/* SECONDARY: Watch Game */}
          <button
            onClick={() => {
              const code = prompt('Enter 6-digit Game Code:');
              if (code && code.length === 6) navigate(`/watch/${code}`);
            }}
            className="bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-800 hover:border-blue-600 p-8 rounded-xl text-left group transition-all"
          >
            <div className="text-4xl mb-3">👁️</div>
            <div className="text-xl font-black uppercase text-white mb-2">
              Watch Game
            </div>
            <div className="text-sm text-zinc-400">
              Join as spectator with game code
            </div>
            <div className="mt-4 text-zinc-600 group-hover:text-blue-500 text-2xl transition-all group-hover:translate-x-1">
              →
            </div>
          </button>

          {/* OPTIONAL: Tablet Mode */}
          <button
            onClick={() => navigate('/tablet/standalone')}
            className="bg-black hover:bg-zinc-900 border-2 border-zinc-800 hover:border-purple-600 p-8 rounded-xl text-left group transition-all"
          >
            <div className="text-4xl mb-3">📱</div>
            <div className="text-xl font-black uppercase text-white mb-2">
              Tablet Mode
            </div>
            <div className="text-sm text-zinc-400">
              Offline referee interface for tablets
            </div>
            <div className="mt-2 inline-block bg-purple-900/30 text-purple-400 text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider">
              Optional
            </div>
          </button>
        </div>

        {/* GAMES SECTION */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

          {/* TABS */}
          <div className="flex border-b border-zinc-800 bg-black/40">
            <button
              onClick={() => setSelectedTab('my')}
              className={`flex-1 px-6 py-4 font-bold text-sm uppercase tracking-widest transition-all relative ${selectedTab === 'my'
                ? 'text-white bg-zinc-900'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              My Games
              {myGames.length > 0 && (
                <span className="ml-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {myGames.length}
                </span>
              )}
              {selectedTab === 'my' && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600"></div>
              )}
            </button>
            <button
              onClick={() => setSelectedTab('live')}
              className={`flex-1 px-6 py-4 font-bold text-sm uppercase tracking-widest transition-all relative ${selectedTab === 'live'
                ? 'text-white bg-zinc-900'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              Live Games
              {liveGames.length > 0 && (
                <span className="ml-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {liveGames.length}
                </span>
              )}
              {selectedTab === 'live' && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-green-600"></div>
              )}
            </button>
          </div>

          {/* GAMES LIST */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="text-zinc-600 text-sm">Loading games...</div>
              </div>
            ) : selectedTab === 'my' && myGames.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">🏀</div>
                <div className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
                  No Active Games
                </div>
                <div className="text-zinc-700 text-xs mt-2">
                  Create your first game to get started
                </div>
              </div>
            ) : selectedTab === 'live' && liveGames.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">📡</div>
                <div className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
                  No Live Games
                </div>
                <div className="text-zinc-700 text-xs mt-2">
                  Waiting for active signals...
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(selectedTab === 'my' ? myGames : liveGames).map((game) => (
                  <button
                    key={game.code}
                    onClick={() =>
                      selectedTab === 'my'
                        ? navigate(`/host/${game.code}`)
                        : navigate(`/watch/${game.code}`)
                    }
                    className="bg-black border border-zinc-800 hover:border-zinc-600 p-5 rounded-lg text-left group transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                        {game.gameState.period <= 4 ? `Q${game.gameState.period}` : `OT${game.gameState.period - 4}`}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* FIX: timerRunning -> gameRunning */}
                        {game.gameState.gameRunning && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                          </span>
                        )}
                        <span className="text-xs text-zinc-600 font-mono">
                          {game.code}
                        </span>
                      </div>
                    </div>

                    <div className="text-lg font-black italic uppercase text-white mb-4 truncate">
                      {game.settings.gameName}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: game.teamA.color }}>
                          {game.teamA.name}
                        </span>
                        <span className="text-2xl font-mono font-black text-white">
                          {game.teamA.score}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: game.teamB.color }}>
                          {game.teamB.name}
                        </span>
                        <span className="text-2xl font-mono font-black text-white">
                          {game.teamB.score}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-xs text-zinc-600 font-mono">
                        {/* FIX: Time formatting using gameTime struct */}
                        {game.gameState.gameTime.minutes}:{String(game.gameState.gameTime.seconds).padStart(2, '0')}
                      </span>
                      <span className="text-zinc-600 group-hover:text-white text-xl transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};