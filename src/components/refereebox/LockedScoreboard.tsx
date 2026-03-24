// src/components/referee/LiveScoreboard.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — LIVE GAME SCOREBOARD (LOCKED VIEW)
// 
// This is what the referee sees 99% of the time during a game.
// ALL input comes from physical buttons — screen is read-only.
//
// Layout (1024×600):
// ┌──────────────────────────────────────────────────────────┐
// │ STATUS BAR: period · clock status · system health    36px│
// ├────────────────┬──────────────┬──────────────────────────┤
// │                │              │                          │
// │   TEAM A       │  GAME CLOCK  │   TEAM B                 │
// │   ███ 47 ███   │   8:42       │   ███ 52 ███            │
// │                │              │                          │
// │   ●●●●○ FOULS │  SHOT CLOCK  │   ●●●○○ FOULS           │
// │   ■■□ T.O.    │     14       │   ■■■ T.O.              │
// │                │  ◄ POSS ►    │                          │
// ├────────────────┴──────────────┴──────────────────────────┤
// │ FOOTER: undo available · last action · settings hint 32px│
// └──────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';

interface TeamState {
    name: string;
    score: number;
    fouls: number;
    timeouts: number;
    color?: string;
}

interface ClockState {
    gameMs: number;
    shotMs: number;
    isRunning: boolean;
    period: number;
}

interface LiveScoreboardProps {
    teamA: TeamState;
    teamB: TeamState;
    clock: ClockState;
    possession: 'A' | 'B' | null;
    lastAction?: string;
    canUndo: boolean;
    teamAColor?: string;
    teamBColor?: string;
}

// ── Helpers ──
const formatGameClock = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatShotClock = (ms: number): number => Math.ceil(ms / 1000);

const getPeriodLabel = (period: number): string => {
    if (period <= 4) return `Q${period}`;
    return `OT${period - 4}`;
};

// ── Foul LED strip ──
const FoulIndicator: React.FC<{ count: number; max?: number; color: string }> = ({
    count, max = 5, color,
}) => (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {Array.from({ length: max }).map((_, i) => {
            const lit = i < count;
            const isBonus = i >= 4; // 5th foul = bonus in FIBA
            return (
                <div key={i} style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: lit
                        ? isBonus ? '#F97316' : color
                        : '#1a1a1a',
                    border: `1.5px solid ${lit
                        ? isBonus ? '#F97316' : color
                        : '#2a2a2a'}`,
                    boxShadow: lit ? `0 0 8px ${isBonus ? '#F9731644' : color + '44'}` : 'none',
                    transition: 'all 0.2s ease',
                }} />
            );
        })}
    </div>
);

// ── Timeout dots ──
const TimeoutIndicator: React.FC<{ used: number; total?: number; color: string }> = ({
    used, total = 3, color,
}) => {
    // Show remaining timeouts
    const remaining = Math.max(0, total - used);
    return (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {Array.from({ length: total }).map((_, i) => (
                <div key={i} style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    background: i < remaining ? color : '#1a1a1a',
                    border: `1.5px solid ${i < remaining ? color : '#2a2a2a'}`,
                    opacity: i < remaining ? 0.9 : 0.3,
                    transition: 'all 0.2s ease',
                }} />
            ))}
        </div>
    );
};

// ── Score with animation ──
const ScoreNumber: React.FC<{ score: number; color: string }> = ({ score, color }) => {
    const [prevScore, setPrevScore] = useState(score);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        if (score !== prevScore) {
            setAnimating(true);
            const t = setTimeout(() => {
                setAnimating(false);
                setPrevScore(score);
            }, 500);
            return () => clearTimeout(t);
        }
    }, [score, prevScore]);

    return (
        <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: '96px',
            lineHeight: 1,
            color: '#fff',
            textShadow: animating ? `0 0 40px ${color}88` : 'none',
            animation: animating ? 'scorePop 0.4s ease' : 'none',
            transition: 'text-shadow 0.3s ease',
            fontVariantNumeric: 'tabular-nums',
        }}>
            {score}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
    teamA, teamB, clock, possession, lastAction, canUndo,
    teamAColor = '#3B82F6', teamBColor = '#EF4444',
}) => {
    const shotClockValue = formatShotClock(clock.shotMs);
    const isShotClockCritical = shotClockValue <= 5 && clock.isRunning;
    const isShotClockWarning = shotClockValue <= 10 && clock.isRunning;
    const isGameClockLow = clock.gameMs <= 60000 && clock.isRunning; // last minute

    return (
        <div style={{
            width: '1024px',
            height: '600px',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Subtle scanline texture */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px)',
                pointerEvents: 'none',
                zIndex: 10,
            }} />

            {/* ── STATUS BAR ── */}
            <div style={{
                height: '36px',
                background: '#080808',
                borderBottom: '1px solid #1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                flexShrink: 0,
            }}>
                {/* Period */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '16px',
                        letterSpacing: '0.1em',
                        color: '#fff',
                    }}>
                        {getPeriodLabel(clock.period)}
                    </span>
                    {/* Period dots */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {[1, 2, 3, 4].map((p) => (
                            <div key={p} style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '2px',
                                background: p < clock.period ? '#22C55E'
                                    : p === clock.period ? '#F59E0B'
                                        : '#1a1a1a',
                                border: `1px solid ${p <= clock.period ? 'transparent' : '#2a2a2a'}`,
                            }} />
                        ))}
                    </div>
                </div>

                {/* Clock status */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: clock.isRunning ? '#22C55E' : '#F59E0B',
                        animation: clock.isRunning ? 'none' : 'dotPulse 1.5s infinite',
                    }} />
                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        fontWeight: 600,
                        color: clock.isRunning ? '#22C55E' : '#F59E0B',
                        letterSpacing: '0.1em',
                    }}>
                        {clock.isRunning ? 'RUNNING' : 'STOPPED'}
                    </span>
                </div>

                {/* System indicator */}
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px',
                    color: '#2a2a2a',
                    letterSpacing: '0.05em',
                }}>
                    TOUCH LOCKED
                </div>
            </div>

            {/* ── MAIN SCOREBOARD ── */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 240px 1fr',
                minHeight: 0,
            }}>
                {/* TEAM A PANEL */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    padding: '16px 24px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Team color glow */}
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '6px',
                        height: '100%',
                        background: `linear-gradient(to bottom, transparent, ${teamAColor}, transparent)`,
                    }} />
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '200px',
                        height: '200px',
                        background: `radial-gradient(circle at 0% 50%, ${teamAColor}10 0%, transparent 70%)`,
                        pointerEvents: 'none',
                    }} />

                    {/* Team name */}
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '22px',
                        letterSpacing: '0.12em',
                        color: teamAColor,
                        textTransform: 'uppercase',
                    }}>
                        {teamA.name}
                    </div>

                    {/* Score */}
                    <ScoreNumber score={teamA.score} color={teamAColor} />

                    {/* Fouls */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px',
                            color: '#444',
                            letterSpacing: '0.2em',
                        }}>
                            FOULS
                        </div>
                        <FoulIndicator count={teamA.fouls} color={teamAColor} />
                    </div>

                    {/* Timeouts */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px',
                            color: '#444',
                            letterSpacing: '0.2em',
                        }}>
                            TIMEOUTS
                        </div>
                        <TimeoutIndicator used={3 - teamA.timeouts} color={teamAColor} />
                    </div>
                </div>

                {/* CENTER COLUMN — Clocks */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    borderLeft: '1px solid #1a1a1a',
                    borderRight: '1px solid #1a1a1a',
                    padding: '16px 0',
                }}>
                    {/* Game Clock */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                    }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px',
                            color: '#444',
                            letterSpacing: '0.2em',
                        }}>
                            GAME CLOCK
                        </div>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: '52px',
                            lineHeight: 1,
                            color: isGameClockLow ? '#FF3030' : '#fff',
                            animation: isGameClockLow ? 'clockCritical 0.5s infinite' : 'none',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.02em',
                        }}>
                            {formatGameClock(clock.gameMs)}
                        </div>
                    </div>

                    {/* Shot Clock */}
                    <div style={{
                        padding: '10px 28px',
                        background: isShotClockCritical ? '#2a0000'
                            : isShotClockWarning ? '#1a1400'
                                : '#0a0a0a',
                        border: `2px solid ${isShotClockCritical ? '#FF3030'
                                : isShotClockWarning ? '#F59E0B'
                                    : '#222'
                            }`,
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.2s ease',
                    }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '9px',
                            color: isShotClockCritical ? '#FF6060' : '#555',
                            letterSpacing: '0.2em',
                        }}>
                            SHOT
                        </div>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: '40px',
                            lineHeight: 1,
                            color: isShotClockCritical ? '#FF3030'
                                : isShotClockWarning ? '#F59E0B'
                                    : '#fff',
                            fontVariantNumeric: 'tabular-nums',
                            animation: isShotClockCritical ? 'clockCritical 0.3s infinite' : 'none',
                        }}>
                            {String(shotClockValue).padStart(2, '0')}
                        </div>
                    </div>

                    {/* Possession arrow */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '4px',
                    }}>
                        <svg width="24" height="16" viewBox="0 0 24 16"
                            style={{ opacity: possession === 'A' ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                            <polygon points="24,8 8,0 8,16" fill={teamAColor} />
                        </svg>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px',
                            color: '#444',
                            letterSpacing: '0.15em',
                        }}>
                            POSS
                        </div>
                        <svg width="24" height="16" viewBox="0 0 24 16"
                            style={{ opacity: possession === 'B' ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                            <polygon points="0,8 16,0 16,16" fill={teamBColor} />
                        </svg>
                    </div>
                </div>

                {/* TEAM B PANEL */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    padding: '16px 24px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Team color glow */}
                    <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: '6px',
                        height: '100%',
                        background: `linear-gradient(to bottom, transparent, ${teamBColor}, transparent)`,
                    }} />
                    <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '200px',
                        height: '200px',
                        background: `radial-gradient(circle at 100% 50%, ${teamBColor}10 0%, transparent 70%)`,
                        pointerEvents: 'none',
                    }} />

                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '22px',
                        letterSpacing: '0.12em',
                        color: teamBColor,
                        textTransform: 'uppercase',
                    }}>
                        {teamB.name}
                    </div>

                    <ScoreNumber score={teamB.score} color={teamBColor} />

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px',
                            color: '#444',
                            letterSpacing: '0.2em',
                        }}>
                            FOULS
                        </div>
                        <FoulIndicator count={teamB.fouls} color={teamBColor} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px',
                            color: '#444',
                            letterSpacing: '0.2em',
                        }}>
                            TIMEOUTS
                        </div>
                        <TimeoutIndicator used={3 - teamB.timeouts} color={teamBColor} />
                    </div>
                </div>
            </div>

            {/* ── FOOTER BAR ── */}
            <div style={{
                height: '36px',
                background: '#080808',
                borderTop: '1px solid #1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                flexShrink: 0,
            }}>
                {/* Undo indicator */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}>
                    <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: canUndo ? '#3B82F6' : '#1a1a1a',
                    }} />
                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px',
                        color: canUndo ? '#3B82F6' : '#2a2a2a',
                        letterSpacing: '0.05em',
                    }}>
                        {canUndo ? 'UNDO AVAILABLE' : 'NO HISTORY'}
                    </span>
                </div>

                {/* Last action */}
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px',
                    color: '#333',
                    letterSpacing: '0.05em',
                    maxWidth: '400px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {lastAction || 'WAITING FOR INPUT'}
                </div>

                {/* Settings hint */}
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px',
                    color: '#1a1a1a',
                    letterSpacing: '0.05em',
                    padding: '3px 10px',
                    border: '1px solid #1a1a1a',
                    borderRadius: '4px',
                }}>
                    SETTINGS BTN → UNLOCK
                </div>
            </div>
        </div>
    );
};

export default LiveScoreboard;