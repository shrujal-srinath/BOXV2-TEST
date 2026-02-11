// src/pages/TournamentWallView.tsx
// PREMIUM MULTI-COURT STADIUM DISPLAY
// Zero risk - New isolated page

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeToGame } from '../services/gameService';
import type { BasketballGame } from '../types';

// Simplified Scoreboard Component (embedded SpectatorView)
const CourtScoreboard: React.FC<{ gameCode: string; courtNumber: string }> = ({ gameCode, courtNumber }) => {
    const [game, setGame] = useState<BasketballGame | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToGame(gameCode, setGame);
        return () => unsubscribe();
    }, [gameCode]);

    if (!game) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-zinc-950 rounded-xl border border-zinc-900">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-zinc-600 text-sm font-bold">Loading {courtNumber}...</p>
                </div>
            </div>
        );
    }

    const getPeriodName = () => {
        const p = game.gameState.period;
        return p <= 4 ? `Q${p}` : `OT${p - 4}`;
    };

    return (
        <div className="w-full h-full bg-gradient-to-br from-zinc-950 via-black to-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex flex-col relative">
            {/* Court Label - Floating Badge */}
            <div className="absolute top-4 left-4 z-10 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg">
                <span className="font-black text-sm uppercase tracking-wider">{courtNumber}</span>
            </div>

            {/* Live Indicator */}
            {game.gameState.gameRunning && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-red-900/80 backdrop-blur-sm border border-red-500 px-3 py-2 rounded-lg shadow-lg">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                    <span className="text-xs font-black uppercase tracking-widest text-red-400">Live</span>
                </div>
            )}

            {/* Main Scoreboard */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                {/* Game Name */}
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-black italic uppercase text-white/80 tracking-tight">
                        {game.settings.gameName}
                    </h2>
                    <div className="text-sm text-zinc-600 uppercase tracking-widest mt-1">
                        {getPeriodName()} • {Math.floor(game.gameState.timeLeft / 60)}:{(game.gameState.timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                </div>

                {/* Score Display */}
                <div className="grid grid-cols-3 gap-8 w-full max-w-4xl items-center">
                    {/* TEAM A */}
                    <div className="text-center">
                        <div
                            className="text-8xl font-black mb-4"
                            style={{ color: game.teamA.color }}
                        >
                            {game.teamA.score}
                        </div>
                        <div className="text-2xl font-black uppercase tracking-wide text-white truncate">
                            {game.teamA.name}
                        </div>
                        {game.gameState.possessionTeam === 'A' && (
                            <div className="mt-2 inline-block px-3 py-1 bg-white/10 rounded-full">
                                <span className="text-xs font-bold text-white">POSSESSION ⚫</span>
                            </div>
                        )}
                    </div>

                    {/* VS DIVIDER */}
                    <div className="text-center">
                        <div className="text-4xl font-black text-zinc-700">VS</div>
                    </div>

                    {/* TEAM B */}
                    <div className="text-center">
                        <div
                            className="text-8xl font-black mb-4"
                            style={{ color: game.teamB.color }}
                        >
                            {game.teamB.score}
                        </div>
                        <div className="text-2xl font-black uppercase tracking-wide text-white truncate">
                            {game.teamB.name}
                        </div>
                        {game.gameState.possessionTeam === 'B' && (
                            <div className="mt-2 inline-block px-3 py-1 bg-white/10 rounded-full">
                                <span className="text-xs font-bold text-white">POSSESSION ⚫</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Shot Clock (if active) */}
                {game.gameState.shotClockActive && (
                    <div className="mt-8 text-center">
                        <div className="text-sm text-zinc-600 uppercase tracking-widest mb-1">Shot Clock</div>
                        <div className={`text-4xl font-mono font-black ${game.gameState.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-white'
                            }`}>
                            {game.gameState.shotClock}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Info Bar */}
            <div className="bg-black/40 backdrop-blur-sm border-t border-zinc-800 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-xs text-zinc-600 uppercase tracking-widest">
                        {game.settings.sport === 'basketball' ? '🏀' : '⚽'} {game.settings.sport.toUpperCase()}
                    </div>
                </div>
                <div className="text-xs text-zinc-600 uppercase tracking-widest">
                    {game.settings.periodType === 'quarter' ? '4 Quarters' : '2 Halves'} • {game.settings.periodDuration}min
                </div>
            </div>
        </div>
    );
};

// Main Tournament Wall Component
export const TournamentWallView: React.FC = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const [liveGames, setLiveGames] = useState<BasketballGame[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tournamentId) return;

        // Subscribe to all live games in this tournament
        const gamesQuery = query(
            collection(db, 'games'),
            where('settings.tournamentId', '==', tournamentId),
            where('status', '==', 'live')
        );

        const unsubscribe = onSnapshot(
            gamesQuery,
            (snapshot) => {
                const games: BasketballGame[] = [];
                snapshot.forEach(doc => {
                    games.push(doc.data() as BasketballGame);
                });
                setLiveGames(games);
                setLoading(false);
            },
            (error) => {
                console.error('Failed to subscribe to live games:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tournamentId]);

    // Dynamic grid layout based on number of active games
    const gridLayout = useMemo(() => {
        const count = liveGames.length;
        if (count === 0) return 'grid-cols-1';
        if (count === 1) return 'grid-cols-1';
        if (count === 2) return 'grid-cols-2';
        if (count === 3) return 'grid-cols-3';
        if (count === 4) return 'grid-cols-2 grid-rows-2';
        if (count === 5 || count === 6) return 'grid-cols-3 grid-rows-2';
        return 'grid-cols-3 grid-rows-3';  // 7-9 games
    }, [liveGames.length]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white font-bold text-xl mb-2">Loading Tournament Display...</p>
                    <p className="text-zinc-600 text-sm">Connecting to live games</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-2 overflow-hidden">
            {liveGames.length === 0 ? (
                // No active games
                <div className="h-screen flex flex-col items-center justify-center">
                    <div className="text-center max-w-2xl">
                        <div className="text-9xl mb-8 opacity-20">🏀</div>
                        <h1 className="text-6xl font-black italic uppercase tracking-tight mb-4 text-white/80">
                            THE BOX
                        </h1>
                        <p className="text-2xl font-bold uppercase tracking-wider text-zinc-600 mb-8">
                            Tournament Display
                        </p>
                        <div className="inline-block px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-full">
                            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                                ⏳ Waiting for matches to start...
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                // Active games grid
                <div className={`grid ${gridLayout} gap-2 h-screen`}>
                    {liveGames.map(game => (
                        <CourtScoreboard
                            key={game.code}
                            gameCode={game.code}
                            courtNumber={game.settings.courtNumber}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};