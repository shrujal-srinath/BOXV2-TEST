import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBasketballGame } from '../hooks/useBasketballGame';
import { ControlDeckClassic } from '../components/ControlDeckClassic';

export const HostConsole: React.FC = () => {
    const { gameCode } = useParams();
    const navigate = useNavigate();

    // Use the hook to get game state and actions
    const {
        game,
        handleAction,
        toggleTimer,
        resetShotClock,
        togglePossession,
        setPeriod,
        updateGameTime
    } = useBasketballGame(gameCode || 'DEMO', 'online');

    const [copyFeedback, setCopyFeedback] = useState(false);
    const timerRef = useRef<number | null>(null);

    // --- MASTER TIMER LOOP ---
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);

        if (game.gameState.gameRunning) {
            timerRef.current = window.setInterval(() => {
                const { gameTime, shotClock, shotClockRunning } = game.gameState;
                const totalSec = (gameTime.minutes * 60) + gameTime.seconds;

                if (totalSec > 0) {
                    const newTotal = totalSec - 1;
                    const newMin = Math.floor(newTotal / 60);
                    const newSec = newTotal % 60;

                    let newShot = shotClock;
                    if (shotClockRunning && shotClock > 0) newShot -= 1;

                    updateGameTime(newMin, newSec, newShot);
                } else {
                    toggleTimer(); // Stop if time is up
                }
            }, 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [game.gameState.gameRunning, game.gameState.gameTime, game.gameState.shotClock]);

    // --- HANDLERS ---
    const formatTime = (m: number, s: number) => `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    const copyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/watch/${gameCode}`);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    return (
        <div className="h-screen bg-black text-white flex flex-col font-sans overflow-hidden">

            {/* 1. TOP HEADER (Navigation) */}
            <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center px-4 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="text-zinc-400 hover:text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        <span>←</span> Exit
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-700"></div>
                    <div className="text-xs font-mono text-green-500 font-bold tracking-wider">{gameCode}</div>
                </div>
                <div className="flex gap-3">
                    <button onClick={copyLink} className="bg-black hover:bg-zinc-800 border border-zinc-700 text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-widest transition-colors">
                        {copyFeedback ? 'Copied!' : 'Copy Link 🔗'}
                    </button>
                    <Link to={`/watch/${gameCode}`} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-widest transition-colors flex items-center gap-2">
                        Spectator View ↗
                    </Link>
                </div>
            </div>

            {/* 2. LIVE MONITOR (Top Half) */}
            <div className="h-[40vh] bg-black border-b-4 border-zinc-800 flex items-center justify-center p-4 relative">
                <div className="absolute top-2 left-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">Live Output</span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-8 w-full max-w-5xl items-center">
                    {/* Home */}
                    <div className="text-center">
                        <h2 className="text-2xl font-black uppercase mb-1" style={{ color: game.teamA.color }}>{game.teamA.name}</h2>
                        <div className="text-8xl font-mono font-bold text-white leading-none">{game.teamA.score}</div>
                        <div className="flex justify-center gap-4 mt-2 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                            <div>Fouls: <span className="text-white text-lg">{game.teamA.foulsThisQuarter}</span></div>
                            <div>TO: <span className="text-white text-lg">{game.teamA.timeouts}</span></div>
                        </div>
                    </div>

                    {/* Clock */}
                    <div className="flex flex-col items-center">
                        <div className="bg-zinc-800 px-3 py-0.5 rounded-full text-[10px] font-bold text-zinc-400 tracking-[0.2em] mb-2">
                            PERIOD {game.gameState.period}
                        </div>
                        <div className={`text-7xl font-mono font-bold leading-none tracking-tight ${game.gameState.gameTime.minutes === 0 ? 'text-red-500' : 'text-white'}`}>
                            {formatTime(game.gameState.gameTime.minutes, game.gameState.gameTime.seconds)}
                        </div>
                        <div className="mt-2 bg-zinc-900 border border-zinc-700 px-4 py-1 rounded text-center">
                            <div className="text-[8px] uppercase font-bold text-zinc-500">Shot Clock</div>
                            <div className="text-2xl font-mono font-bold text-amber-500">{game.gameState.shotClock}</div>
                        </div>
                    </div>

                    {/* Away */}
                    <div className="text-center">
                        <h2 className="text-2xl font-black uppercase mb-1" style={{ color: game.teamB.color }}>{game.teamB.name}</h2>
                        <div className="text-8xl font-mono font-bold text-white leading-none">{game.teamB.score}</div>
                        <div className="flex justify-center gap-4 mt-2 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                            <div>Fouls: <span className="text-white text-lg">{game.teamB.foulsThisQuarter}</span></div>
                            <div>TO: <span className="text-white text-lg">{game.teamB.timeouts}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. CONTROL DECK (Bottom Half) */}
            <div className="flex-1 bg-zinc-950 overflow-y-auto">
                <ControlDeckClassic
                    teamA={game.teamA}
                    teamB={game.teamB}
                    gameState={game.gameState}
                    onAction={handleAction}
                    onGameClock={(action) => action === 'toggle' && toggleTimer()}
                    onShotClock={(action) => resetShotClock(action === 'reset-24' ? 24 : 14)}
                    onPossession={togglePossession}
                    onUndo={() => { }}
                    onSwitchMode={() => setPeriod(game.gameState.period + 1)}
                />
            </div>

        </div>
    );
};