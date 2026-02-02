import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { useLocalGame } from '../hooks/useLocalGame';

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Detect if this is a local game (starts with LOCAL-)
    const isLocalGame = gameCode?.startsWith('LOCAL-');

    console.log('[HostConsole] Game code:', gameCode, '| Is local:', isLocalGame);

    // Use appropriate hook based on game type
    const firebaseGame = useBasketballGame(
        !isLocalGame && gameCode ? gameCode : '',
        'online'
    );

    const localGame = useLocalGame(
        isLocalGame && gameCode ? gameCode : ''
    );

    // UNIFY THE INTERFACE
    // We need to map both hooks to a common interface that the UI expects
    const game = isLocalGame ? localGame.game : firebaseGame.game;

    // Actions - Adapter
    const handleAction = isLocalGame ? localGame.handleAction : firebaseGame.handleAction;

    // Timer
    const toggleTimer = isLocalGame ? localGame.toggleGameClock : firebaseGame.toggleTimer;

    // Shot Clock
    const resetShotClockIn = isLocalGame ? localGame.resetShotClock : firebaseGame.resetShotClock;
    const resetShotClock = () => resetShotClockIn(24); // Fix signature mismatch

    // Helper Wrappers for UI (restoring missing helpers using handleAction)
    const handleScoreAction = (team: 'teamA' | 'teamB', points: number) => {
        const teamCode = team === 'teamA' ? 'A' : 'B';
        handleAction(teamCode, 'points', points);
    };

    const handleFoulAction = (team: 'teamA' | 'teamB') => {
        const teamCode = team === 'teamA' ? 'A' : 'B';
        handleAction(teamCode, 'foul', 1);
    };

    const addTimeout = (team: 'teamA' | 'teamB') => {
        const teamCode = team === 'teamA' ? 'A' : 'B';
        handleAction(teamCode, 'timeout', -1); // Decrement available timeouts
    };

    const endPeriod = () => {
        if (isLocalGame) {
            localGame.nextPeriod();
        } else {
            // Online game might need explicit period setting or different handling
            if (game) firebaseGame.setPeriod(game.gameState.period + 1);
        }
    };

    useEffect(() => {
        const unsub = subscribeToAuth((user) => {
            setCurrentUser(user);
        });
        return () => unsub();
    }, []);

    if (!game) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">🏀</div>
                    <div className="text-white font-bold text-xl mb-2">Loading Game...</div>
                    <div className="text-zinc-500 text-sm">
                        {isLocalGame ? '📱 Local Game' : '☁️ Cloud Game'} • {gameCode}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans">

            {/* GUEST MODE BANNER - Show for localStorage games without auth */}
            {isLocalGame && !currentUser && (
                <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/30 border-b border-amber-900/50 p-4 sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <span className="text-xl">⚡</span>
                            </div>
                            <div>
                                <div className="font-black text-white uppercase text-sm tracking-tight">
                                    Guest Mode - Local Game
                                </div>
                                <div className="text-xs text-amber-400 leading-relaxed">
                                    This game is saved locally on this device. Sign in to access from anywhere.
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/', { state: { showSignIn: true } })}
                            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-widest rounded transition-all hover:-translate-y-0.5 shadow-lg"
                        >
                            Sign In & Sync
                        </button>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <header className="bg-black/90 backdrop-blur border-b border-zinc-800 p-4 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(currentUser ? '/dashboard' : '/')}
                            className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:bg-white hover:text-black hover:border-white transition-all text-xl"
                        >
                            ←
                        </button>
                        <div>
                            <h1 className="text-xl font-black italic uppercase tracking-tight text-white">
                                Host Console
                            </h1>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                {isLocalGame ? '📱 Local Mode' : '☁️ Cloud Mode'} • {gameCode}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Timer Controls */}
                        <button
                            onClick={toggleTimer}
                            className={`px-6 py-2.5 rounded font-bold text-sm uppercase tracking-widest transition-all ${game.gameState.gameRunning
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : 'bg-green-600 hover:bg-green-500 text-white'
                                }`}
                        >
                            {game.gameState.gameRunning ? '⏸ Pause' : '▶ Start'}
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN SCOREBOARD */}
            <main className="max-w-7xl mx-auto p-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 mb-6">
                    <div className="grid grid-cols-3 gap-8 items-center">

                        {/* Team A */}
                        <div className="text-center">
                            <div
                                className="text-sm font-bold uppercase tracking-widest mb-2"
                                style={{ color: game.teamA.color }}
                            >
                                {game.teamA.name}
                            </div>
                            <div className="text-7xl font-black text-white font-mono">
                                {game.teamA.score}
                            </div>
                        </div>

                        {/* Center - Time & Period */}
                        <div className="text-center">
                            <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-2">
                                {game.gameState.period <= 4 ? `Quarter ${game.gameState.period}` : `OT ${game.gameState.period - 4}`}
                            </div>
                            <div className="text-5xl font-mono font-black text-white mb-2">
                                {game.gameState.gameTime.minutes}:{String(game.gameState.gameTime.seconds).padStart(2, '0')}
                            </div>
                            {game.settings.shotClockDuration > 0 && (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <span className="text-xs text-zinc-500 uppercase tracking-widest">Shot Clock:</span>
                                    <span className="text-2xl font-mono font-bold text-amber-500">
                                        {game.gameState.shotClock}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Team B */}
                        <div className="text-center">
                            <div
                                className="text-sm font-bold uppercase tracking-widest mb-2"
                                style={{ color: game.teamB.color }}
                            >
                                {game.teamB.name}
                            </div>
                            <div className="text-7xl font-black text-white font-mono">
                                {game.teamB.score}
                            </div>
                        </div>
                    </div>
                </div>

                {/* QUICK CONTROLS */}
                <div className="grid grid-cols-2 gap-4 mb-6">

                    {/* Team A Controls */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3
                            className="text-lg font-black uppercase mb-4"
                            style={{ color: game.teamA.color }}
                        >
                            {game.teamA.name} Controls
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => handleScoreAction('teamA', 1)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded uppercase transition-all"
                            >
                                +1
                            </button>
                            <button
                                onClick={() => handleScoreAction('teamA', 2)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded uppercase transition-all"
                            >
                                +2
                            </button>
                            <button
                                onClick={() => handleScoreAction('teamA', 3)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded uppercase transition-all"
                            >
                                +3
                            </button>
                        </div>
                        <button
                            onClick={() => handleFoulAction('teamA')}
                            className="w-full mt-3 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-900 text-amber-400 font-bold py-3 rounded uppercase transition-all"
                        >
                            Add Foul ({game.teamA.fouls})
                        </button>
                    </div>

                    {/* Team B Controls */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3
                            className="text-lg font-black uppercase mb-4"
                            style={{ color: game.teamB.color }}
                        >
                            {game.teamB.name} Controls
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => handleScoreAction('teamB', 1)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded uppercase transition-all"
                            >
                                +1
                            </button>
                            <button
                                onClick={() => handleScoreAction('teamB', 2)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded uppercase transition-all"
                            >
                                +2
                            </button>
                            <button
                                onClick={() => handleScoreAction('teamB', 3)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded uppercase transition-all"
                            >
                                +3
                            </button>
                        </div>
                        <button
                            onClick={() => handleFoulAction('teamB')}
                            className="w-full mt-3 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-900 text-amber-400 font-bold py-3 rounded uppercase transition-all"
                        >
                            Add Foul ({game.teamB.fouls})
                        </button>
                    </div>
                </div>

                {/* GAME CONTROLS */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-black uppercase mb-4 text-white">Game Controls</h3>
                    <div className="grid grid-cols-4 gap-3">
                        <button
                            onClick={resetShotClock}
                            disabled={game.settings.shotClockDuration === 0}
                            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold py-4 rounded uppercase transition-all"
                        >
                            Reset Shot Clock
                        </button>
                        <button
                            onClick={() => addTimeout('teamA')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded uppercase transition-all"
                        >
                            Timeout A
                        </button>
                        <button
                            onClick={() => addTimeout('teamB')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded uppercase transition-all"
                        >
                            Timeout B
                        </button>
                        <button
                            onClick={endPeriod}
                            className="bg-red-900/30 hover:bg-red-900/50 border border-red-900 text-red-400 font-bold py-4 rounded uppercase transition-all"
                        >
                            End Period
                        </button>
                    </div>
                </div>

                {/* INFO BANNER */}
                <div className="mt-6 bg-blue-900/20 border border-blue-900/50 rounded-xl p-4 text-center">
                    <div className="text-xs text-blue-400">
                        {isLocalGame ? (
                            <>
                                💾 <strong>Local Game</strong> - Data saved on this device only.
                                {!currentUser && <span className="ml-2">Spectators can watch using game code.</span>}
                            </>
                        ) : (
                            <>
                                ☁️ <strong>Cloud Game</strong> - Data synced in real-time. Access from any device.
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};