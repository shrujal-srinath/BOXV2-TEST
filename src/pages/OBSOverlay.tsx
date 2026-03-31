// src/pages/OBSOverlay.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — OBS STREAM OVERLAY
//
// Route: /overlay?game=XXXX
// Transparent background — add as OBS Browser Source.
// Recommended source size: 1920×120 (top bar) or 1920×1080 (full)
//
// URL params:
//   game=XXXX          — game code (required)
//   position=top|bottom — default top
//   theme=dark|light    — default dark
//   size=sm|md|lg       — default md
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

// ── Types ─────────────────────────────────────────────────────

interface TeamState { name: string; score: number; fouls: number; timeouts: number; color: string; }
interface ClockState { gameMs: number; shotMs: number; isRunning: boolean; period: number; totalPeriods: number; }
interface GameState {
    teamA: TeamState; teamB: TeamState; clock: ClockState;
    meta: { gameActive: boolean; periodType: string; };
}

// ── Helpers ───────────────────────────────────────────────────

const formatGame = (ms: number): string => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const formatShot = (ms: number): number => Math.ceil(ms / 1000);

const getPeriodLabel = (period: number, total: number, type: string): string => {
    if (type === 'half') return period <= 2 ? `H${period}` : `OT${period - 2}`;
    return period <= 4 ? `Q${period}` : `OT${period - 4}`;
};

// ── Scoreboard sizes ──────────────────────────────────────────

const SIZES = {
    sm: { height: 72, scoreFontSize: 40, nameFontSize: 11, clockFontSize: 22, shotFontSize: 16, padding: '0 16px' },
    md: { height: 96, scoreFontSize: 56, nameFontSize: 13, clockFontSize: 28, shotFontSize: 18, padding: '0 24px' },
    lg: { height: 120, scoreFontSize: 72, nameFontSize: 15, clockFontSize: 34, shotFontSize: 22, padding: '0 32px' },
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function OBSOverlay() {
    const [params] = useSearchParams();
    const gameParam = params.get('game');
    const position = params.get('position') || 'top';
    const theme = params.get('theme') || 'dark';
    const sizeKey = (params.get('size') || 'md') as 'sm' | 'md' | 'lg';
    const size = SIZES[sizeKey] || SIZES.md;

    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastScore, setLastScore] = useState<{ team: 'A' | 'B'; points: number } | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const scoreFlashRef = useRef<NodeJS.Timeout | null>(null);

    // ── Connect to local daemon via Socket.io ─────────────────
    useEffect(() => {
        const socket = io('http://localhost:3001', {
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socketRef.current = socket;

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.on('state_update', (state: GameState) => {
            setGameState(prev => {
                // Detect score change for flash
                if (prev && state.teamA.score !== prev.teamA.score) {
                    setLastScore({ team: 'A', points: state.teamA.score - prev.teamA.score });
                    if (scoreFlashRef.current) clearTimeout(scoreFlashRef.current);
                    scoreFlashRef.current = setTimeout(() => setLastScore(null), 1500);
                }
                if (prev && state.teamB.score !== prev.teamB.score) {
                    setLastScore({ team: 'B', points: state.teamB.score - prev.teamB.score });
                    if (scoreFlashRef.current) clearTimeout(scoreFlashRef.current);
                    scoreFlashRef.current = setTimeout(() => setLastScore(null), 1500);
                }
                return state;
            });
        });

        socket.on('clock_sync', (clock: ClockState) => {
            setGameState(prev => prev ? { ...prev, clock } : prev);
        });

        return () => { socket.disconnect(); };
    }, []);

    // ── No game / not connected ───────────────────────────────
    if (!gameState || !gameState.meta.gameActive) {
        return (
            <div style={{
                width: '100vw', minHeight: size.height, background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {/* Completely transparent when no game — OBS sees nothing */}
            </div>
        );
    }

    const { teamA, teamB, clock, meta } = gameState;
    const periodLabel = getPeriodLabel(clock.period, clock.totalPeriods, meta.periodType);
    const shotVal = formatShot(clock.shotMs);
    const isShotCritical = shotVal <= 5 && clock.isRunning;
    const isGameLow = clock.gameMs <= 60000 && clock.isRunning;

    // ── Colors ────────────────────────────────────────────────
    const bg = theme === 'dark'
        ? 'rgba(0, 0, 0, 0.88)'
        : 'rgba(255, 255, 255, 0.92)';
    const textPrimary = theme === 'dark' ? '#ffffff' : '#000000';
    const textSecondary = theme === 'dark' ? '#888888' : '#555555';
    const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
    const dividerColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

    return (
        <>
            <style>{`
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { background: transparent !important; overflow: hidden; }
                @keyframes scoreFlash {
                    0% { transform: scale(1.4); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes clockPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=JetBrains+Mono:wght@700&display=swap');
            `}</style>

            <div style={{
                width: '100vw',
                height: size.height,
                background: bg,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${borderColor}`,
                borderRadius: position === 'top' ? '0 0 12px 12px' : '12px 12px 0 0',
                display: 'flex',
                alignItems: 'center',
                padding: size.padding,
                gap: '0',
                overflow: 'hidden',
                fontFamily: "'Oswald', sans-serif",
            }}>

                {/* Team A */}
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                    justifyContent: 'flex-start',
                }}>
                    {/* Color bar */}
                    <div style={{
                        width: 4, height: size.height * 0.5, borderRadius: 2,
                        background: teamA.color || '#3B82F6',
                        flexShrink: 0,
                    }} />
                    <div>
                        <div style={{
                            fontSize: size.nameFontSize, fontWeight: 700,
                            color: textSecondary, letterSpacing: '0.15em',
                            textTransform: 'uppercase', lineHeight: 1.2,
                        }}>
                            {teamA.name}
                        </div>
                        {teamA.fouls > 0 && (
                            <div style={{
                                fontSize: 10, color: '#EF4444',
                                fontFamily: "'JetBrains Mono', monospace",
                                letterSpacing: '0.1em',
                            }}>
                                {teamA.fouls} FOULS
                            </div>
                        )}
                    </div>
                    <div style={{
                        fontSize: size.scoreFontSize, fontWeight: 700,
                        lineHeight: 1,
                        marginLeft: 'auto',
                        animation: lastScore?.team === 'A' ? 'scoreFlash 0.4s ease-out' : 'none',
                        color: lastScore?.team === 'A' ? (teamA.color || '#3B82F6') : textPrimary,
                        transition: 'color 0.3s',
                    }}>
                        {teamA.score}
                    </div>
                </div>

                {/* Center — clocks */}
                <div style={{
                    width: 200, flexShrink: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '4px',
                    borderLeft: `1px solid ${dividerColor}`,
                    borderRight: `1px solid ${dividerColor}`,
                    padding: '0 16px', margin: '0 16px',
                }}>
                    {/* Game clock */}
                    <div style={{
                        fontSize: size.clockFontSize, fontWeight: 700,
                        color: isGameLow ? '#EF4444' : textPrimary,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '-0.02em', lineHeight: 1,
                        animation: isGameLow && clock.isRunning ? 'clockPulse 1s infinite' : 'none',
                    }}>
                        {formatGame(clock.gameMs)}
                    </div>

                    {/* Period + shot clock row */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: textSecondary, letterSpacing: '0.1em',
                            fontFamily: "'JetBrains Mono', monospace",
                        }}>
                            {periodLabel}
                        </span>
                        <div style={{
                            width: 4, height: 4, borderRadius: '50%',
                            background: clock.isRunning ? '#22C55E' : '#333',
                            boxShadow: clock.isRunning ? '0 0 6px #22C55E' : 'none',
                        }} />
                        <span style={{
                            fontSize: size.shotFontSize, fontWeight: 700,
                            color: isShotCritical ? '#EF4444' : '#F59E0B',
                            fontFamily: "'JetBrains Mono', monospace",
                            animation: isShotCritical && clock.isRunning ? 'clockPulse 0.5s infinite' : 'none',
                        }}>
                            {shotVal}
                        </span>
                    </div>

                    {/* THE BOX watermark */}
                    <div style={{
                        fontSize: 8, color: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                        letterSpacing: '0.2em', fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        THE BOX
                    </div>
                </div>

                {/* Team B */}
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                    justifyContent: 'flex-end',
                }}>
                    <div style={{
                        fontSize: size.scoreFontSize, fontWeight: 700,
                        lineHeight: 1, marginRight: 'auto',
                        animation: lastScore?.team === 'B' ? 'scoreFlash 0.4s ease-out' : 'none',
                        color: lastScore?.team === 'B' ? (teamB.color || '#EF4444') : textPrimary,
                        transition: 'color 0.3s',
                    }}>
                        {teamB.score}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            fontSize: size.nameFontSize, fontWeight: 700,
                            color: textSecondary, letterSpacing: '0.15em',
                            textTransform: 'uppercase', lineHeight: 1.2,
                        }}>
                            {teamB.name}
                        </div>
                        {teamB.fouls > 0 && (
                            <div style={{
                                fontSize: 10, color: '#EF4444',
                                fontFamily: "'JetBrains Mono', monospace",
                                letterSpacing: '0.1em',
                            }}>
                                {teamB.fouls} FOULS
                            </div>
                        )}
                    </div>
                    {/* Color bar */}
                    <div style={{
                        width: 4, height: size.height * 0.5, borderRadius: 2,
                        background: teamB.color || '#EF4444',
                        flexShrink: 0,
                    }} />
                </div>
            </div>
        </>
    );
}