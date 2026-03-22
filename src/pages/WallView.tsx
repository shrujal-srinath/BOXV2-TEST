// src/pages/WallView.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subscribeToGame, toGenericGame } from '../services/supabaseGameService';
import { SPORT_REGISTRY, isSportSupported } from '../sports/registry';
import { Game } from '../core/types/Game';
import type { GameContext } from '../core/types/Manifest';

// ─── DYNAMIC COURT CARD ──────────────────────────────────────────────────────

const DynamicCourtCard = ({ gameCode }: { gameCode: string }) => {
    const [game, setGame] = useState<Game<any, any> | null>(null);

    // 1. Live subscription to the database row
    useEffect(() => {
        if (!gameCode) return;
        const unsub = subscribeToGame(gameCode, (data) => {
            // Mapping incoming database row to our generic Game type
            if (data) setGame(toGenericGame(data as any));
        });
        return unsub;
    }, [gameCode]);

    if (!game) return <div className="bg-zinc-900/50 animate-pulse rounded-lg h-64"></div>;

    // 2. Identify the sport and find its manifest
    const resolvedSportId = game.sportId || (game as any).sport || 'basketball';
    if (!isSportSupported(resolvedSportId)) {
        return (
            <div className="bg-zinc-900 border border-red-900/50 p-4 rounded-lg h-64 flex items-center justify-center text-red-500 text-xs text-center">
                UNSUPPORTED SPORT: {resolvedSportId}
            </div>
        );
    }

    const manifest = SPORT_REGISTRY[resolvedSportId];
    const WallCard = manifest.components.WallCard;

    // Build GameContext from the generic Game object
    const context: GameContext = {
        gameCode: game.code,
        teamA: game.teamA,
        teamB: game.teamB,
        sportLabel: manifest.label,
    };

    // 3. Render the Sport-Specific Wall Display
    return (
        <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden flex flex-col shadow-2xl relative group">
            {/* Wrapper to maintain consistent card styling around diverse sport UIs */}
            <div className="p-1">
                <WallCard state={game.state} context={context} />
            </div>

            {/* Universal Overlay: Team Names (Reliable metadata) */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    <span>{game.teamA.name}</span>
                    <span>VS</span>
                    <span>{game.teamB.name}</span>
                </div>
            </div>
        </div>
    );
};

// ─── MULTI-SPORT WALL VIEW ───────────────────────────────────────────────────

export const WallView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const gameCodes = searchParams.get('games')?.split(',').filter(Boolean) || [];

    if (gameCodes.length === 0) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-500 font-mono text-sm gap-4">
                <div className="text-zinc-700 text-4xl font-black italic uppercase">Box Arena</div>
                <div className="animate-pulse">WAITING FOR COURT CONFIGURATION...</div>
                <div className="text-xs text-zinc-600 mt-4">Add ?games=CODE1,CODE2 to the URL</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
            <header className="mb-8 flex justify-between items-end border-b border-zinc-800 pb-4">
                <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
                    Arena <span className="text-red-600">Wall</span>
                </h1>
                <div className="flex flex-col items-end">
                    <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Live Streams</div>
                    <div className="text-white font-mono text-xl leading-none">{gameCodes.length}</div>
                </div>
            </header>

            {/* Masonry-style Grid for mixed sport cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {gameCodes.map(code => (
                    <DynamicCourtCard key={code} gameCode={code} />
                ))}
            </div>
        </div>
    );
};