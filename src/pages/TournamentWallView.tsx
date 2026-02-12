// src/pages/TournamentWallView.tsx
// FIXED: replaced non-existent GameState fields with correct ones:
//   timeLeft        → gameTime.minutes / gameTime.seconds
//   possessionTeam  → possession
//   shotClockActive → shotClockRunning
//   settings.sport  → game.sport (top-level field on BasketballGame)

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { subscribeToGame } from '../services/gameService';
import type { BasketballGame } from '../types';

export const TournamentWallView: React.FC = () => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const [game, setGame] = useState<BasketballGame | null>(null);

    useEffect(() => {
        if (!gameCode) return;
        return subscribeToGame(gameCode, setGame);
    }, [gameCode]);

    if (!game) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-zinc-500 font-mono text-sm animate-pulse uppercase tracking-widest">
                    Connecting to game…
                </div>
            </div>
        );
    }

    const { gameState, teamA, teamB, settings, sport } = game;

    // ── Derived display values ────────────────────────────
    // FIX: was gameState.timeLeft — correct field is gameTime
    const minutes = gameState.gameTime.minutes;
    const seconds = gameState.gameTime.seconds;
    const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const isLowTime = minutes === 0 && seconds <= 30;

    // FIX: was gameState.possessionTeam — correct field is possession
    const possessionName = gameState.possession === 'A' ? teamA.name : teamB.name;
    const possessionColor = gameState.possession === 'A' ? teamA.color : teamB.color;

    // FIX: was gameState.shotClockActive — correct field is shotClockRunning
    const showShotClock = settings.shotClockDuration > 0;

    // FIX: was settings.sport — correct field is game.sport (top-level)
    const sportLabel = sport || 'Basketball';

    const periodLabel = () => {
        if (settings.periodType === 'half') {
            return gameState.period <= 2 ? `Half ${gameState.period}` : 'OT';
        }
        return gameState.period <= 4 ? `Q${gameState.period}` : `OT${gameState.period - 4}`;
    };

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden select-none">

            {/* Status bar */}
            <div className="flex items-center justify-between px-8 py-3 bg-zinc-950 border-b border-zinc-900">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${gameState.gameRunning ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        {gameState.gameRunning ? 'Live' : 'Paused'} · {sportLabel}
                    </span>
                </div>
                <span className="text-xs font-mono text-zinc-600 uppercase tracking-widest">
                    {periodLabel()} · {settings.gameName}
                </span>
            </div>

            {/* Main scoreboard */}
            <div className="flex items-stretch min-h-[calc(100vh-48px)]">

                {/* Team A */}
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12"
                    style={{ borderRight: `3px solid ${teamA.color}20` }}>
                    <div className="text-3xl font-black uppercase tracking-widest text-center"
                        style={{ color: teamA.color }}>
                        {teamA.name}
                    </div>
                    <div className="text-[10rem] font-black font-mono leading-none tabular-nums text-white"
                        style={{ textShadow: `0 0 60px ${teamA.color}40` }}>
                        {teamA.score}
                    </div>
                    <div className="flex gap-6 text-xs text-zinc-600 font-bold uppercase tracking-widest">
                        <span>Fouls: {teamA.fouls}</span>
                        <span>TO: {teamA.timeouts}</span>
                    </div>
                    {/* Possession indicator */}
                    {gameState.possession === 'A' && (
                        <div className="mt-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                            style={{ background: `${teamA.color}30`, color: teamA.color, border: `1px solid ${teamA.color}60` }}>
                            ◀ Possession
                        </div>
                    )}
                </div>

                {/* Center: Clock */}
                <div className="flex-none w-72 flex flex-col items-center justify-center gap-6 px-8">
                    {/* Period */}
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-[0.3em]">
                        {periodLabel()}
                    </div>

                    {/* Game clock */}
                    <div className={`text-7xl font-mono font-black tabular-nums ${isLowTime ? 'text-red-500' : 'text-white'}`}
                        style={isLowTime ? { textShadow: '0 0 30px rgba(239,68,68,0.6)' } : {}}>
                        {timeDisplay}
                    </div>

                    {/* Shot clock */}
                    {showShotClock && (
                        <div className="flex flex-col items-center gap-1">
                            <div className="text-[9px] text-zinc-600 uppercase tracking-widest">Shot Clock</div>
                            <div className={`text-4xl font-mono font-black tabular-nums ${gameState.shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                                {gameState.shotClock}
                            </div>
                        </div>
                    )}

                    {/* Possession label */}
                    <div className="text-center">
                        <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Possession</div>
                        <div className="text-sm font-black uppercase tracking-widest" style={{ color: possessionColor }}>
                            {possessionName}
                        </div>
                    </div>
                </div>

                {/* Team B */}
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12"
                    style={{ borderLeft: `3px solid ${teamB.color}20` }}>
                    <div className="text-3xl font-black uppercase tracking-widest text-center"
                        style={{ color: teamB.color }}>
                        {teamB.name}
                    </div>
                    <div className="text-[10rem] font-black font-mono leading-none tabular-nums text-white"
                        style={{ textShadow: `0 0 60px ${teamB.color}40` }}>
                        {teamB.score}
                    </div>
                    <div className="flex gap-6 text-xs text-zinc-600 font-bold uppercase tracking-widest">
                        <span>Fouls: {teamB.fouls}</span>
                        <span>TO: {teamB.timeouts}</span>
                    </div>
                    {gameState.possession === 'B' && (
                        <div className="mt-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                            style={{ background: `${teamB.color}30`, color: teamB.color, border: `1px solid ${teamB.color}60` }}>
                            Possession ▶
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};