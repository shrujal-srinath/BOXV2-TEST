// src/components/refereebox/LockedScoreboard.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Referee Live Scoreboard v4
// Broadcast-grade FUI aesthetic. Scores are the hero.
// Fully responsive. Compresses to header when popup is open.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';

interface TeamState { name: string; score: number; fouls: number; timeouts: number; color?: string; }
interface ClockState { gameMs: number; shotMs: number; isRunning: boolean; period: number; totalPeriods: number; }

interface LiveScoreboardProps {
    teamA: TeamState;
    teamB: TeamState;
    clock: ClockState;
    possession: 'A' | 'B' | null;
    lastAction?: string;
    canUndo: boolean;
    teamAColor?: string;
    teamBColor?: string;
    isConnected?: boolean;
    isTouchUnlocked?: boolean;
    undoFlash?: boolean;
    settingsFlash?: boolean | null;
    isCompressed?: boolean;
    gameMode?: 'quick' | 'stats' | 'advanced';
    picoConnected?: boolean;
}

const formatGameClock = (ms: number): string => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const formatShotClock = (ms: number): number => Math.ceil(ms / 1000);

const getPeriodLabel = (period: number, total: number): string => {
    if (total === 2) return period <= 2 ? `H${period}` : `OT${period - 2}`;
    return period <= 4 ? `Q${period}` : `OT${period - 4}`;
};

// ── Foul dots (upgraded) ──
const FoulDots: React.FC<{ count: number; color: string }> = ({ count, color }) => (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%',
                background: i < count ? (i >= 4 ? '#F97316' : color) : 'rgba(255,255,255,0.04)',
                border: `2px solid ${i < count ? (i >= 4 ? '#F97316' : color) : 'rgba(255,255,255,0.08)'}`,
                boxShadow: i < count ? `0 0 10px ${i >= 4 ? '#F97316' : color}55, inset 0 0 4px rgba(255,255,255,0.2)` : 'none',
                transition: 'all 0.25s ease',
            }} />
        ))}
    </div>
);

// ── Timeout squares (upgraded) ──
const TimeoutDots: React.FC<{ used: number; total?: number; color: string }> = ({ used, total = 3, color }) => (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        {Array.from({ length: total }).map((_, i) => {
            const remaining = total - used;
            const isActive = i < remaining;
            return (
                <div key={i} style={{
                    width: 14, height: 14, borderRadius: '3px',
                    background: isActive ? color : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${isActive ? color : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: isActive ? `0 0 8px ${color}44` : 'none',
                    transition: 'all 0.25s ease',
                }} />
            );
        })}
    </div>
);

// ── Score display with flash ──
const ScoreDisplay: React.FC<{ score: number; color: string; size: string }> = ({ score, color, size }) => {
    const [flash, setFlash] = useState(false);
    const prevScore = useRef(score);

    useEffect(() => {
        if (score !== prevScore.current) {
            setFlash(true);
            setTimeout(() => setFlash(false), 500);
            prevScore.current = score;
        }
    }, [score]);

    return (
        <div style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: size,
            color: flash ? color : '#fff',
            textShadow: flash
                ? `0 0 60px ${color}, 0 0 120px ${color}44`
                : `0 2px 4px rgba(0,0,0,0.6), 0 0 20px rgba(255,255,255,0.05)`,
            transition: 'color 0.15s, text-shadow 0.25s',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            transform: flash ? 'scale(1.05)' : 'scale(1)',
        }}>
            {score}
        </div>
    );
};

// ── Shot clock ring ──
const ShotClockRing: React.FC<{ value: number; max: number; isCritical: boolean; isWarning: boolean; isRunning: boolean }> = ({ value, max, isCritical, isWarning, isRunning }) => {
    const pct = max > 0 ? (value / max) * 100 : 100;
    const circumference = 2 * Math.PI * 52;
    const dashoffset = circumference * (1 - pct / 100);
    const ringColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#F59E0B';

    return (
        <div style={{ position: 'relative', width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="130" height="130" viewBox="0 0 130 130" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                {/* Background ring */}
                <circle cx="65" cy="65" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
                {/* Progress ring */}
                <circle cx="65" cy="65" r="52" fill="none"
                    stroke={ringColor} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashoffset}
                    style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
                />
            </svg>
            {/* Value */}
            <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: 'clamp(42px, 7vw, 64px)',
                color: isCritical ? '#EF4444' : isWarning ? '#F97316' : '#F59E0B',
                animation: isCritical && isRunning ? 'criticalPulse 0.5s ease-in-out infinite' : 'none',
                textShadow: isCritical ? '0 0 30px #EF4444' : isWarning ? '0 0 20px #F97316' : '0 0 10px rgba(245,158,11,0.3)',
                zIndex: 2,
            }}>
                {value}
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════
// COMPRESSED HEADER — shown when popup is open
// ════════════════════════════════════════════════════
export const CompressedHeader: React.FC<{
    teamA: TeamState; teamB: TeamState; clock: ClockState;
    teamAColor: string; teamBColor: string;
}> = ({ teamA, teamB, clock, teamAColor, teamBColor }) => {
    const shotVal = formatShotClock(clock.shotMs);
    const isCritical = shotVal <= 5 && clock.isRunning;

    return (
        <div style={{
            width: '100%', height: '56px',
            background: 'linear-gradient(180deg, #0a0a0a, #050505)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center',
            padding: '0 20px', gap: '16px',
            flexShrink: 0,
        }}>
            {/* Team A */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div style={{ width: 6, height: 28, borderRadius: 3, background: teamAColor, boxShadow: `0 0 8px ${teamAColor}44` }} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {teamA.name}
                </span>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 24, color: '#fff', marginLeft: 6 }}>
                    {teamA.score}
                </span>
            </div>

            {/* Center clocks */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: 140 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 20, color: clock.isRunning ? '#fff' : '#555' }}>
                        {formatGameClock(clock.gameMs)}
                    </span>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: clock.isRunning ? '#22C55E' : '#333', boxShadow: clock.isRunning ? '0 0 8px #22C55E' : 'none' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 18, color: isCritical ? '#EF4444' : '#F59E0B' }}>
                        {shotVal}
                    </span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>
                    {getPeriodLabel(clock.period, clock.totalPeriods || 4)}
                </span>
            </div>

            {/* Team B */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 24, color: '#fff', marginRight: 6 }}>
                    {teamB.score}
                </span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {teamB.name}
                </span>
                <div style={{ width: 6, height: 28, borderRadius: 3, background: teamBColor, boxShadow: `0 0 8px ${teamBColor}44` }} />
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════
// MAIN SCOREBOARD — broadcast-grade FUI dashboard
// ════════════════════════════════════════════════════
const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
    teamA, teamB, clock, possession, lastAction, canUndo,
    teamAColor = '#3B82F6', teamBColor = '#EF4444',
    isConnected = true, isTouchUnlocked = false,
    undoFlash = false, settingsFlash = null,
    gameMode = 'quick', picoConnected,
}) => {
    const shotVal = formatShotClock(clock.shotMs);
    const isShotCritical = shotVal <= 5 && clock.isRunning;
    const isShotWarning = shotVal <= 10 && clock.isRunning;
    const isGameClockLow = clock.gameMs <= 60000 && clock.isRunning;
    const periodLabel = getPeriodLabel(clock.period, clock.totalPeriods || 4);
    const shotMax = clock.shotMs > 14000 ? 24 : 14; // auto-detect 24s vs 14s context

    return (
        <div style={{
            width: '100vw', height: '100vh',
            background: '#000',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative',
            fontFamily: "'Oswald', sans-serif",
        }}>
            {/* Ambient grid overlay */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, opacity: 0.015,
                backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
                backgroundSize: '60px 60px',
            }} />

            {/* Scanlines */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px)', pointerEvents: 'none', zIndex: 10 }} />

            {/* FUI corner brackets */}
            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => {
                const isTop = corner.includes('top');
                const isLeft = corner.includes('left');
                return (
                    <div key={corner} style={{
                        position: 'absolute',
                        [isTop ? 'top' : 'bottom']: 6,
                        [isLeft ? 'left' : 'right']: 6,
                        width: 20, height: 20,
                        borderTop: isTop ? '2px solid rgba(255,255,255,0.08)' : 'none',
                        borderBottom: !isTop ? '2px solid rgba(255,255,255,0.08)' : 'none',
                        borderLeft: isLeft ? '2px solid rgba(255,255,255,0.08)' : 'none',
                        borderRight: !isLeft ? '2px solid rgba(255,255,255,0.08)' : 'none',
                        zIndex: 20, pointerEvents: 'none',
                    }} />
                );
            })}

            {/* Settings unlock flash overlay */}
            {settingsFlash !== null && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none',
                    border: `3px solid ${settingsFlash ? '#F59E0B' : '#3B82F6'}`,
                    boxShadow: `inset 0 0 60px ${settingsFlash ? '#F59E0B15' : '#3B82F615'}`,
                    animation: 'settingsFlash 0.3s ease',
                }} />
            )}

            {/* Undo flash overlay */}
            {undoFlash && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none', background: 'rgba(59, 130, 246, 0.06)', animation: 'undoFlash 0.6s ease' }} />
            )}

            {/* ── STATUS BAR ── */}
            <div style={{
                height: '36px',
                background: 'linear-gradient(180deg, #0c0c0c, #080808)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 18px', flexShrink: 0,
                zIndex: 5,
            }}>
                {/* Left: Period + progress */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '4px', padding: '2px 10px',
                    }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12, color: '#fff', letterSpacing: '0.15em' }}>
                            {periodLabel}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                        {Array.from({ length: clock.totalPeriods || 4 }).map((_, i) => (
                            <div key={i} style={{
                                width: 14, height: 4, borderRadius: 2,
                                background: i < clock.period - 1 ? '#22C55E' : i === clock.period - 1 ? '#F59E0B' : 'rgba(255,255,255,0.06)',
                                boxShadow: i < clock.period - 1 ? '0 0 4px #22C55E44' : i === clock.period - 1 ? '0 0 4px #F59E0B44' : 'none',
                                transition: 'all 0.3s',
                            }} />
                        ))}
                    </div>
                </div>

                {/* Center: Brand + mode badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.25em', fontWeight: 700 }}>
                        THE BOX
                    </span>
                    <div style={{
                        padding: '1px 8px', borderRadius: '3px', fontSize: 8,
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: '0.1em',
                        background: gameMode === 'advanced' ? '#8B5CF615' : gameMode === 'stats' ? '#3B82F615' : 'rgba(255,255,255,0.03)',
                        color: gameMode === 'advanced' ? '#8B5CF6' : gameMode === 'stats' ? '#3B82F6' : 'rgba(255,255,255,0.2)',
                        border: `1px solid ${gameMode === 'advanced' ? '#8B5CF633' : gameMode === 'stats' ? '#3B82F633' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                        {gameMode.toUpperCase()}
                    </div>
                </div>

                {/* Right: System indicators */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: canUndo ? 1 : 0.25 }}>
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: canUndo ? '#3B82F6' : 'rgba(255,255,255,0.2)', fontWeight: 600 }}>↩ UNDO</span>
                    </div>
                    <div style={{
                        padding: '1px 8px', borderRadius: '3px',
                        background: isTouchUnlocked ? '#F59E0B15' : 'transparent',
                        border: `1px solid ${isTouchUnlocked ? '#F59E0B33' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: isTouchUnlocked ? '#F59E0B' : 'rgba(255,255,255,0.15)', letterSpacing: '0.08em', fontWeight: 600 }}>
                            {isTouchUnlocked ? '🔓' : '🔒'}
                        </span>
                    </div>
                    {/* Pico status */}
                    {picoConnected !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: picoConnected ? '#22C55E' : '#EF4444', boxShadow: picoConnected ? '0 0 6px #22C55E' : 'none' }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: picoConnected ? '#22C55E' : '#EF4444', fontWeight: 600 }}>HW</span>
                        </div>
                    )}
                    {/* Daemon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#22C55E' : '#EF4444', boxShadow: isConnected ? '0 0 8px #22C55E' : 'none' }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: isConnected ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                            {isConnected ? 'LIVE' : 'OFF'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── MAIN BODY ── */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'hidden', minHeight: 0, position: 'relative', zIndex: 2 }}>

                {/* ── TEAM A PANEL ── */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '12px 20px', gap: '12px',
                    background: possession === 'A'
                        ? `linear-gradient(135deg, ${teamAColor}08 0%, ${teamAColor}03 50%, transparent 100%)`
                        : 'transparent',
                    borderRight: '1px solid rgba(255,255,255,0.03)',
                    transition: 'background 0.4s ease',
                    position: 'relative',
                }}>
                    {/* Team color edge accent */}
                    <div style={{
                        position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3,
                        background: `linear-gradient(to bottom, transparent, ${teamAColor}88, transparent)`,
                        borderRadius: '0 2px 2px 0',
                    }} />

                    {/* Possession indicator */}
                    <div style={{ height: 18, display: 'flex', alignItems: 'center' }}>
                        {possession === 'A' && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '2px 12px', borderRadius: '100px',
                                background: `${teamAColor}15`, border: `1px solid ${teamAColor}33`,
                                animation: 'possessionPulse 1.5s ease-in-out infinite',
                            }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: teamAColor, boxShadow: `0 0 8px ${teamAColor}` }} />
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: teamAColor, letterSpacing: '0.15em' }}>POSS</span>
                            </div>
                        )}
                    </div>

                    {/* Team name */}
                    <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                        fontSize: 'clamp(14px, 2vw, 18px)', color: teamAColor,
                        letterSpacing: '0.3em', textTransform: 'uppercase', textAlign: 'center',
                        opacity: 0.8,
                    }}>
                        {teamA.name}
                    </div>

                    {/* SCORE */}
                    <ScoreDisplay score={teamA.score} color={teamAColor} size="clamp(80px, 14vw, 140px)" />

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', fontWeight: 600 }}>FOULS</span>
                            <FoulDots count={teamA.fouls} color={teamAColor} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', fontWeight: 600 }}>T.O.</span>
                            <TimeoutDots used={3 - teamA.timeouts} total={3} color={teamAColor} />
                        </div>
                    </div>
                </div>

                {/* ── CENTER PANEL ── */}
                <div style={{
                    width: 'clamp(170px, 24vw, 260px)', flexShrink: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '16px', padding: '16px 8px',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.01), transparent, rgba(255,255,255,0.01))',
                }}>
                    {/* Game clock */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.25em', fontWeight: 600 }}>GAME CLOCK</span>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: 'clamp(36px, 5vw, 56px)',
                            color: isGameClockLow ? '#EF4444' : clock.isRunning ? '#fff' : 'rgba(255,255,255,0.35)',
                            letterSpacing: '0.05em',
                            animation: isGameClockLow ? 'criticalPulse 1s ease-in-out infinite' : 'none',
                            textShadow: clock.isRunning ? '0 0 20px rgba(255,255,255,0.15)' : 'none',
                            padding: '4px 16px',
                            border: `1px solid ${clock.isRunning ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`,
                            borderRadius: '8px',
                            background: clock.isRunning ? 'rgba(255,255,255,0.02)' : 'transparent',
                            transition: 'all 0.3s ease',
                        }}>
                            {formatGameClock(clock.gameMs)}
                        </div>
                        {/* Running indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: clock.isRunning ? '#22C55E' : 'rgba(255,255,255,0.08)',
                                boxShadow: clock.isRunning ? '0 0 10px #22C55E' : 'none',
                                transition: 'all 0.3s',
                            }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: clock.isRunning ? '#22C55E' : 'rgba(255,255,255,0.15)', letterSpacing: '0.1em', fontWeight: 600 }}>
                                {clock.isRunning ? 'RUNNING' : 'STOPPED'}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: '70%', height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)' }} />

                    {/* Shot clock with ring */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.25em', fontWeight: 600 }}>SHOT CLOCK</span>
                        <ShotClockRing value={shotVal} max={shotMax} isCritical={isShotCritical} isWarning={isShotWarning} isRunning={clock.isRunning} />
                    </div>

                    {/* Possession indicator */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.25em', fontWeight: 600 }}>POSSESSION</span>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{
                                width: 12, height: 12, borderRadius: '50%',
                                background: possession === 'A' ? teamAColor : 'rgba(255,255,255,0.04)',
                                boxShadow: possession === 'A' ? `0 0 12px ${teamAColor}` : 'none',
                                border: `2px solid ${possession === 'A' ? teamAColor : 'rgba(255,255,255,0.08)'}`,
                                transition: 'all 0.3s',
                            }} />
                            <div style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                            <div style={{
                                width: 12, height: 12, borderRadius: '50%',
                                background: possession === 'B' ? teamBColor : 'rgba(255,255,255,0.04)',
                                boxShadow: possession === 'B' ? `0 0 12px ${teamBColor}` : 'none',
                                border: `2px solid ${possession === 'B' ? teamBColor : 'rgba(255,255,255,0.08)'}`,
                                transition: 'all 0.3s',
                            }} />
                        </div>
                    </div>
                </div>

                {/* ── TEAM B PANEL ── */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '12px 20px', gap: '12px',
                    background: possession === 'B'
                        ? `linear-gradient(225deg, ${teamBColor}08 0%, ${teamBColor}03 50%, transparent 100%)`
                        : 'transparent',
                    transition: 'background 0.4s ease',
                    position: 'relative',
                }}>
                    {/* Team color edge accent */}
                    <div style={{
                        position: 'absolute', right: 0, top: '15%', bottom: '15%', width: 3,
                        background: `linear-gradient(to bottom, transparent, ${teamBColor}88, transparent)`,
                        borderRadius: '2px 0 0 2px',
                    }} />

                    {/* Possession indicator */}
                    <div style={{ height: 18, display: 'flex', alignItems: 'center' }}>
                        {possession === 'B' && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '2px 12px', borderRadius: '100px',
                                background: `${teamBColor}15`, border: `1px solid ${teamBColor}33`,
                                animation: 'possessionPulse 1.5s ease-in-out infinite',
                            }}>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, color: teamBColor, letterSpacing: '0.15em' }}>POSS</span>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: teamBColor, boxShadow: `0 0 8px ${teamBColor}` }} />
                            </div>
                        )}
                    </div>

                    {/* Team name */}
                    <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                        fontSize: 'clamp(14px, 2vw, 18px)', color: teamBColor,
                        letterSpacing: '0.3em', textTransform: 'uppercase', textAlign: 'center',
                        opacity: 0.8,
                    }}>
                        {teamB.name}
                    </div>

                    {/* SCORE */}
                    <ScoreDisplay score={teamB.score} color={teamBColor} size="clamp(80px, 14vw, 140px)" />

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', fontWeight: 600 }}>FOULS</span>
                            <FoulDots count={teamB.fouls} color={teamBColor} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', fontWeight: 600 }}>T.O.</span>
                            <TimeoutDots used={3 - teamB.timeouts} total={3} color={teamBColor} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── FOOTER BAR ── */}
            <div style={{
                height: '32px',
                background: 'linear-gradient(180deg, #080808, #0a0a0a)',
                borderTop: '1px solid rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 18px', flexShrink: 0,
                zIndex: 5,
            }}>
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    color: 'rgba(255,255,255,0.15)', letterSpacing: '0.05em',
                    maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {lastAction || 'AWAITING INPUT'}
                </span>
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                    color: 'rgba(255,255,255,0.1)', letterSpacing: '0.08em',
                }}>
                    {isTouchUnlocked ? 'SETTINGS BTN → LOCK' : 'SETTINGS BTN → UNLOCK TOUCH'}
                </span>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Barlow+Condensed:wght@700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
                @keyframes criticalPulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
                @keyframes possessionPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
                @keyframes settingsFlash { 0% { opacity:0; } 50% { opacity:1; } 100% { opacity:0; } }
                @keyframes undoFlash { 0% { opacity:0; } 30% { opacity:1; } 100% { opacity:0; } }
            `}</style>
        </div>
    );
};

export default LiveScoreboard;