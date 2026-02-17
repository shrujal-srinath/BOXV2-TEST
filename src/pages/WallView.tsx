// src/pages/WallView.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getGameByCode } from '../services/gameService';
import { useRTDBTimer } from '../hooks/useRTDBTimer';
import type { BasketballGame } from '../types';

// INDIVIDUAL COURT COMPONENT
// Handles its own high-frequency timer subscription
const CourtCard = ({ gameCode }: { gameCode: string }) => {
    const [game, setGame] = useState<BasketballGame | null>(null);

    // Fetch static data (names, colors) once
    useEffect(() => {
        getGameByCode(gameCode).then(setGame);
    }, [gameCode]);

    // Subscribe to HOT data (Timer)
    const timer = useRTDBTimer({
        gameCode,
        isHost: false,
        periodDuration: 10, // Defaults, will correct when game loads
        shotClockDuration: 24
    });

    if (!game) return <div className="bg-zinc-900/50 animate-pulse rounded-lg h-64"></div>;

    // Tenths logic: Show if under 1 minute
    const showTenths = timer.minutes === 0 && timer.tenths !== undefined;
    const timeString = showTenths
        ? `${timer.seconds}.${timer.tenths}`
        : `${timer.minutes}:${timer.seconds.toString().padStart(2, '0')}`;

    return (
        <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden flex flex-col shadow-2xl relative group">
            {/* HEADER: Period & Time */}
            <div className="bg-zinc-900/80 p-4 flex justify-between items-center border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Period</span>
                    <span className="text-yellow-500 font-mono font-bold text-xl">{timer.period}</span>
                </div>
                <div className={`font-mono font-black text-3xl tracking-tight ${timer.minutes === 0 ? 'text-red-500' : 'text-white'}`}>
                    {timeString}
                </div>
                {/* Active Indicator */}
                <div className={`w-3 h-3 rounded-full ${timer.gameRunning ? 'bg-green-500 animate-pulse' : 'bg-red-900'}`}></div>
            </div>

            {/* TEAMS */}
            <div className="flex-1 flex items-center justify-between p-6">
                {/* TEAM A */}
                <div className="text-center w-1/3">
                    <h3 className="text-white font-black italic text-2xl uppercase leading-none mb-2">{game.teamA.name}</h3>
                    <div className="text-6xl font-black text-white" style={{ textShadow: `0 0 30px ${game.teamA.color}` }}>
                        {game.teamA.score}
                    </div>
                </div>

                <div className="text-zinc-700 font-black text-xl">VS</div>

                {/* TEAM B */}
                <div className="text-center w-1/3">
                    <h3 className="text-white font-black italic text-2xl uppercase leading-none mb-2">{game.teamB.name}</h3>
                    <div className="text-6xl font-black text-white" style={{ textShadow: `0 0 30px ${game.teamB.color}` }}>
                        {game.teamB.score}
                    </div>
                </div>
            </div>

            {/* FOOTER: Shot Clock & Fouls */}
            <div className="bg-zinc-950 p-3 flex justify-between items-center text-xs font-mono text-zinc-500 border-t border-zinc-900">
                <div>Fouls: <span className="text-white">{game.teamA.fouls}</span> - <span className="text-white">{game.teamB.fouls}</span></div>
                <div className="flex items-center gap-2">
                    <span>SC:</span>
                    <span className={`text-xl font-bold ${timer.shotClock < 5 ? 'text-red-500' : 'text-yellow-500'}`}>
                        {timer.shotClock}
                    </span>
                </div>
            </div>
        </div>
    );
}

export const WallView: React.FC = () => {
    const [searchParams] = useSearchParams();
    // e.g., ?games=CODE1,CODE2,CODE3
    const gameCodes = searchParams.get('games')?.split(',') || [];

    if (gameCodes.length === 0) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-sm">
                NO GAMES CONFIGURED. ADD ?games=CODE1,CODE2 TO URL.
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
            <header className="mb-8 flex justify-between items-end border-b border-zinc-800 pb-4">
                <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
                    Arena <span className="text-red-600">Wall</span>
                </h1>
                <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                    Live Feeds: {gameCodes.length}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {gameCodes.map(code => (
                    <CourtCard key={code} gameCode={code} />
                ))}
            </div>
        </div>
    );
};