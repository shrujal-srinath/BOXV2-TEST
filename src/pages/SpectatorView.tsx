import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToGame } from '../services/gameService';
import { getLocalGame } from '../services/localGameService';
import { BasketballGame } from '../types';

export const SpectatorView: React.FC = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<BasketballGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLocalGame = gameCode?.startsWith('LOCAL-');

  useEffect(() => {
    if (!gameCode) {
      setError('No game code provided');
      setLoading(false);
      return;
    }

    if (isLocalGame) {
      const loadGame = () => {
        const metadata = getLocalGame(gameCode);
        if (metadata && metadata.game) {
          setGame(metadata.game);
          setLoading(false);
          setError(null);
        } else if (loading) {
          setError('Game not found');
          setLoading(false);
        }
      };

      loadGame();
      const interval = setInterval(loadGame, 1000);
      return () => clearInterval(interval);

    } else {
      const unsubscribe = subscribeToGame(gameCode, (gameData) => {
        if (gameData) {
          setGame(gameData);
          setLoading(false);
          setError(null);
        } else {
          setError('Game not found');
          setLoading(false);
        }
      });
      return () => unsubscribe();
    }
  }, [gameCode, isLocalGame, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏀</div>
          <div className="text-white font-bold text-xl mb-2">Connecting...</div>
          <div className="text-zinc-500 text-sm">{gameCode}</div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4 opacity-30">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Game Not Found</h2>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded transition-all">Return to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      <header className="bg-black/90 backdrop-blur border-b border-zinc-800 p-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:bg-white hover:text-black hover:border-white transition-all text-xl">←</button>
            <div>
              <h1 className="text-xl font-black italic uppercase tracking-tight text-white">Spectator View</h1>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-2">
                {isLocalGame ? <span className="text-amber-500">📱 Local Game</span> : <span className="text-blue-500">☁️ Cloud Game</span>}
                <span>• {gameCode}</span>
              </div>
            </div>
          </div>
          {game.gameState.gameRunning && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-900 px-4 py-2 rounded">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span></span>
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">Live</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black italic uppercase text-white mb-2">{game.settings.gameName}</h2>
          <div className="text-sm text-zinc-500 uppercase tracking-widest">{game.gameState.period <= 4 ? `Quarter ${game.gameState.period}` : `Overtime ${game.gameState.period - 4}`}</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 mb-6">
          <div className="grid grid-cols-3 gap-8 items-center">
            <div className="text-center">
              <div className="text-lg font-bold uppercase tracking-widest mb-3" style={{ color: game.teamA.color }}>{game.teamA.name}</div>
              <div className="text-8xl font-black text-white font-mono mb-2">{game.teamA.score}</div>
              <div className="text-xs text-zinc-600 uppercase tracking-widest">Fouls: {game.teamA.fouls} | Timeouts: {game.teamA.timeouts}</div>
            </div>

            <div className="text-center">
              <div className="text-6xl font-mono font-black text-white mb-4">
                {game.gameState.gameTime.minutes}:{String(game.gameState.gameTime.seconds).padStart(2, '0')}
              </div>
              {game.settings.shotClockDuration > 0 && (
                <div className="bg-black border border-zinc-800 rounded-lg p-4 inline-block">
                  <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Shot Clock</div>
                  <div className="text-3xl font-mono font-bold text-amber-500">{game.gameState.shotClock}</div>
                </div>
              )}
            </div>

            <div className="text-center">
              <div className="text-lg font-bold uppercase tracking-widest mb-3" style={{ color: game.teamB.color }}>{game.teamB.name}</div>
              <div className="text-8xl font-black text-white font-mono mb-2">{game.teamB.score}</div>
              <div className="text-xs text-zinc-600 uppercase tracking-widest">Fouls: {game.teamB.fouls} | Timeouts: {game.teamB.timeouts}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};