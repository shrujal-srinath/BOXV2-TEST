// src/pages/TournamentWallView.tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { useSupabaseBroadcast } from '../hooks/useSupabaseBroadcast';

export const TournamentWallView: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const { game } = useBasketballGame(code || '', 'online');

    const timer = useSupabaseBroadcast({
        gameCode: code || '',
        isHost: false,
        periodDuration: game.settings.periodDuration,
        shotClockDuration: game.settings.shotClockDuration
    });

    const showTenths = timer.minutes === 0; // Show tenths in last minute
    const isLowTime = timer.minutes === 0 && timer.seconds < 10;

    if (!game) return <div className="bg-black min-h-screen"></div>;

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden flex flex-col font-sans">

            {/* HEADER: PERIOD & LOGO */}
            <div className="h-24 bg-zinc-900 flex items-center justify-between px-12 border-b-4 border-zinc-800">
                <div className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-xl">
                    {game.settings.gameName || 'TOURNAMENT MATCH'}
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-zinc-500 font-bold uppercase tracking-widest text-lg">Period</span>
                    <span className="bg-yellow-500 text-black font-black text-4xl px-6 py-1 rounded-sm">
                        {timer.period}
                    </span>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex">

                {/* TEAM A */}
                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black border-r border-zinc-800 relative">
                    <div className="absolute top-0 left-0 w-full h-4" style={{ backgroundColor: game.teamA.color }}></div>
                    <h1 className="text-6xl md:text-8xl font-black italic uppercase mb-8 text-center px-4 leading-tight">
                        {game.teamA.name}
                    </h1>
                    <div className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter" style={{ color: game.teamA.color, textShadow: '0 0 50px rgba(0,0,0,0.5)' }}>
                        {game.teamA.score}
                    </div>
                    <div className="mt-12 flex gap-12">
                        <StatBox label="FOULS" value={game.teamA.fouls} />
                        <StatBox label="TIMEOUTS" value={game.teamA.timeouts} />
                    </div>
                </div>

                {/* CENTER CLOCK COLUMN */}
                <div className="w-[30%] bg-black flex flex-col items-center justify-center border-x-4 border-zinc-900 z-10 relative">

                    {/* GAME CLOCK */}
                    <div className={`font-mono font-black text-8xl md:text-9xl mb-12 tracking-tighter ${isLowTime ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        {showTenths
                            ? `${timer.seconds}.${timer.tenths}`
                            : `${timer.minutes}:${timer.seconds.toString().padStart(2, '0')}`
                        }
                    </div>

                    {/* SHOT CLOCK */}
                    <div className="bg-zinc-900/80 p-6 rounded-2xl border-2 border-zinc-800 mb-12">
                        <div className="text-center text-zinc-500 text-sm font-bold uppercase tracking-widest mb-2">Shot Clock</div>
                        <div className={`font-mono font-black text-8xl leading-none ${timer.shotClock < 5 ? 'text-red-500' : 'text-yellow-400'}`}>
                            {timer.shotClock}
                        </div>
                    </div>

                    {/* POSSESSION ARROW */}
                    <div className="flex items-center gap-8 opacity-80">
                        <div className={`w-0 h-0 border-y-[20px] border-y-transparent border-r-[30px] transition-all duration-300 ${game.gameState.possession === 'A' ? 'border-r-red-600 scale-125' : 'border-r-zinc-800'}`}></div>
                        <div className="text-zinc-600 font-bold uppercase tracking-widest text-sm">Possession</div>
                        <div className={`w-0 h-0 border-y-[20px] border-y-transparent border-l-[30px] transition-all duration-300 ${game.gameState.possession === 'B' ? 'border-l-blue-600 scale-125' : 'border-l-zinc-800'}`}></div>
                    </div>

                </div>

                {/* TEAM B */}
                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-bl from-zinc-900 to-black border-l border-zinc-800 relative">
                    <div className="absolute top-0 right-0 w-full h-4" style={{ backgroundColor: game.teamB.color }}></div>
                    <h1 className="text-6xl md:text-8xl font-black italic uppercase mb-8 text-center px-4 leading-tight">
                        {game.teamB.name}
                    </h1>
                    <div className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter" style={{ color: game.teamB.color, textShadow: '0 0 50px rgba(0,0,0,0.5)' }}>
                        {game.teamB.score}
                    </div>
                    <div className="mt-12 flex gap-12">
                        <StatBox label="FOULS" value={game.teamB.fouls} />
                        <StatBox label="TIMEOUTS" value={game.teamB.timeouts} />
                    </div>
                </div>

            </div>
        </div>
    );
};

const StatBox = ({ label, value }: { label: string, value: number }) => (
    <div className="text-center">
        <div className="text-zinc-600 font-bold text-xs uppercase tracking-widest mb-1">{label}</div>
        <div className="text-4xl font-black text-white bg-zinc-900/50 px-4 py-2 rounded border border-zinc-800 min-w-[80px]">
            {value}
        </div>
    </div>
);