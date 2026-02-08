import React, { useState, useEffect } from 'react';
import { subscribeToLiveGames } from '../services/gameService';
import type { BasketballGame } from '../types';

export const WallView: React.FC = () => {
    const [games, setGames] = useState<BasketballGame[]>([]);

    useEffect(() => {
        const unsub = subscribeToLiveGames(setGames);
        return () => unsub();
    }, []);

    // Helper to find game for a specific court
    const getGameForCourt = (courtNum: string) => {
        return games.find(g => g.settings.courtNumber === courtNum && g.status === 'live');
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans p-2 overflow-hidden">
            {/* 2 Rows x 3 Columns Grid for 6 Courts */}
            <div className="grid grid-cols-3 grid-rows-2 h-[100vh] gap-2">
                {['1', '2', '3', '4', '5', '6'].map(courtNum => (
                    <CourtCard key={courtNum} courtNum={courtNum} game={getGameForCourt(courtNum)} />
                ))}
            </div>
        </div>
    );
};

// MINI SCORECARD COMPONENT
const CourtCard = ({ courtNum, game }: { courtNum: string, game?: BasketballGame }) => {
    if (!game) {
        return (
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-4 left-4 bg-zinc-900 px-3 py-1 rounded border border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    Court {courtNum}
                </div>
                <div className="text-zinc-800 text-6xl font-black opacity-20">THE BOX</div>
                <div className="text-zinc-600 text-xs font-bold uppercase tracking-[0.2em] mt-2">Next Match Soon</div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl relative overflow-hidden flex flex-col">
            {/* Header: Court & Time */}
            <div className="bg-black/40 p-4 flex justify-between items-center border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        Court {courtNum}
                    </div>
                    <div className="text-zinc-400 text-xs font-bold uppercase tracking-wider truncate max-w-[150px]">
                        {game.settings.gameName}
                    </div>
                </div>
                <div className={`font-mono font-bold text-xl ${game.gameState.gameRunning ? 'text-white' : 'text-red-500'}`}>
                    {game.gameState.gameTime.minutes}:{String(game.gameState.gameTime.seconds).padStart(2, '0')}
                </div>
            </div>

            {/* Scores */}
            <div className="flex-1 flex flex-col justify-center gap-2 p-4">

                {/* Team A */}
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-12 rounded-full" style={{ background: game.teamA.color }}></div>
                        <span className="text-2xl font-black uppercase text-white truncate max-w-[200px]">{game.teamA.name}</span>
                    </div>
                    <span className="text-5xl font-mono font-black text-white tabular-nums">{game.teamA.score}</span>
                </div>

                {/* Team B */}
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-12 rounded-full" style={{ background: game.teamB.color }}></div>
                        <span className="text-2xl font-black uppercase text-white truncate max-w-[200px]">{game.teamB.name}</span>
                    </div>
                    <span className="text-5xl font-mono font-black text-white tabular-nums">{game.teamB.score}</span>
                </div>

            </div>

            {/* Footer: Status */}
            <div className="bg-black/40 p-2 flex justify-center items-center gap-4">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    {game.gameState.period <= 3 ? `Set ${game.gameState.period}` : 'Match Point'}
                </span>
            </div>
        </div>
    );
};