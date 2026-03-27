// src/components/refereebox/LockedScoreboard.tsx
// THE BOX — Referee Live Scoreboard (Redesigned v3)
// Fully responsive. Scores are the hero. Compresses to header when popup is open.

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
    isCompressed?: boolean; // true when popup is open
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

// ── Foul dots ──
const FoulDots: React.FC<{ count: number; color: string; size?: number }> = ({ count, color, size = 14 }) => (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
                width: size, height: size, borderRadius: '50%',
                background: i < count ? (i >= 4 ? '#F97316' : color) : '#1a1a1a',
                border: `1.5px solid ${i < count ? (i >= 4 ? '#F97316' : color) : '#2a2a2a'}`,
                boxShadow: i < count ? `0 0 6px ${i >= 4 ? '#F97316' : color}66` : 'none',
                transition: 'all 0.2s',
            }} />
        ))}
    </div>
);

// ── Timeout squares ──
const TimeoutDots: React.FC<{ used: number; total?: number; color: string }> = ({ used, total = 3, color }) => (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
                width: 12, height: 12, borderRadius: '2px',
                background: i < (total - used) ? color : '#1a1a1a',
                border: `1.5px solid ${i < (total - used) ? color : '#2a2a2a'}`,
                transition: 'all 0.2s',
            }} />
        ))}
    </div>
);

// ── Score digit with flash animation ──
const ScoreDisplay: React.FC<{ score: number; color: string; size: string }> = ({ score, color, size }) => {
    const [flash, setFlash] = useState(false);
    const prevScore = useRef(score);

    useEffect(() => {
        if (score !== prevScore.current) {
            setFlash(true);
            setTimeout(() => setFlash(false), 400);
            prevScore.current = score;
        }
    }, [score]);

    return (
        <div style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: size,
            color: flash ? color : '#fff',
            textShadow: flash ? `0 0 40px ${color}` : 'none',
            transition: 'color 0.15s, text-shadow 0.15s',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
        }}>
            {score}
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
            background: '#050505',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex', alignItems: 'center',
            padding: '0 20px', gap: '16px',
            flexShrink: 0,
        }}>
            {/* Team A */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div style={{ width: 6, height: 28, borderRadius: 3, background: teamAColor }} />
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
                <div style={{ width: 6, height: 28, borderRadius: 3, background: teamBColor }} />
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════
// MAIN SCOREBOARD — full screen, scores as hero
// ════════════════════════════════════════════════════
const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
    teamA, teamB, clock, possession, lastAction, canUndo,
    teamAColor = '#3B82F6', teamBColor = '#EF4444',
    isConnected = true, isTouchUnlocked = false,
    undoFlash = false, settingsFlash = null,
}) => {
    const shotVal = formatShotClock(clock.shotMs);
    const isShotCritical = shotVal <= 5 && clock.isRunning;
    const isShotWarning = shotVal <= 10 && clock.isRunning;
    const isGameClockLow = clock.gameMs <= 60000 && clock.isRunning;
    const periodLabel = getPeriodLabel(clock.period, clock.totalPeriods || 4);

    return (
        <div style={{
            width: '100vw', height: '100vh',
            background: '#000',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative',
            fontFamily: "'Oswald', sans-serif",
        }}>
            {/* Scanlines */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px)', pointerEvents: 'none', zIndex: 10 }} />

            {/* Settings unlock flash overlay */}
            {settingsFlash !== null && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none',
                    border: `3px solid ${settingsFlash ? '#F59E0B' : '#3B82F6'}`,
                    borderRadius: 0,
                    boxShadow: `inset 0 0 40px ${settingsFlash ? '#F59E0B22' : '#3B82F622'}`,
                    animation: 'settingsFlash 0.3s ease',
                }} />
            )}

            {/* Undo flash overlay */}
            {undoFlash && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none', background: 'rgba(59, 130, 246, 0.08)', animation: 'undoFlash 0.6s ease' }} />
            )}

            {/* ── STATUS BAR ── */}
            <div style={{
                height: '32px', background: '#080808',
                borderBottom: '1px solid #111',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 18px', flexShrink: 0,
            }}>
                {/* Period + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12, color: '#fff', letterSpacing: '0.15em' }}>
                        {periodLabel}
                    </span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                        {Array.from({ length: clock.totalPeriods || 4 }).map((_, i) => (
                            <div key={i} style={{ width: 8, height: 4, borderRadius: 2, background: i < clock.period - 1 ? '#22C55E' : i === clock.period - 1 ? '#F59E0B' : '#222' }} />
                        ))}
                    </div>
                </div>

                {/* Center — game code */}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#333', letterSpacing: '0.2em' }}>
                    THE BOX
                </span>

                {/* Right — system status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Undo indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: canUndo ? 1 : 0.3 }}>
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: canUndo ? '#3B82F6' : '#333' }}>↩ UNDO</span>
                    </div>
                    {/* Lock status */}
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: isTouchUnlocked ? '#F59E0B' : '#333', letterSpacing: '0.1em' }}>
                        {isTouchUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}
                    </span>
                    {/* Daemon connection */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#22C55E' : '#EF4444', boxShadow: isConnected ? '0 0 6px #22C55E' : 'none' }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: isConnected ? '#22C55E' : '#EF4444' }}>
                            {isConnected ? 'LIVE' : 'OFFLINE'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── MAIN BODY ── */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'hidden', minHeight: 0 }}>

                {/* ── TEAM A PANEL ── */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '16px 24px', gap: '16px',
                    borderRight: '1px solid #111',
                    background: possession === 'A' ? `${teamAColor}08` : 'transparent',
                    transition: 'background 0.3s',
                }}>
                    {/* Possession arrow */}
                    <div style={{ height: 16, display: 'flex', alignItems: 'center' }}>
                        {possession === 'A' && (
                            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, color: teamAColor, letterSpacing: '0.2em', animation: 'possessionPulse 1.5s ease-in-out infinite' }}>
                                ▶ BALL
                            </div>
                        )}
                    </div>

                    {/* Team name */}
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 'clamp(14px, 2vw, 20px)', color: teamAColor, letterSpacing: '0.25em', textTransform: 'uppercase', textAlign: 'center' }}>
                        {teamA.name}
                    </div>

                    {/* SCORE — hero element */}
                    <ScoreDisplay score={teamA.score} color={teamAColor} size="clamp(80px, 14vw, 140px)" />

                    {/* Fouls */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#444', letterSpacing: '0.2em' }}>FOULS</span>
                        <FoulDots count={teamA.fouls} color={teamAColor} />
                    </div>

                    {/* Timeouts */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#444', letterSpacing: '0.2em' }}>TIMEOUTS</span>
                        <TimeoutDots used={3 - teamA.timeouts} total={3} color={teamAColor} />
                    </div>
                </div>

                {/* ── CENTER PANEL ── */}
                <div style={{
                    width: 'clamp(160px, 22vw, 240px)', flexShrink: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '20px', padding: '16px 12px',
                    borderRight: '1px solid #111',
                }}>
                    {/* Game clock */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#444', letterSpacing: '0.2em' }}>GAME CLOCK</span>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: 'clamp(32px, 5vw, 56px)',
                            color: isGameClockLow ? '#EF4444' : clock.isRunning ? '#fff' : '#666',
                            letterSpacing: '0.05em',
                            animation: isGameClockLow ? 'criticalPulse 1s ease-in-out infinite' : 'none',
                        }}>
                            {formatGameClock(clock.gameMs)}
                        </div>
                        {/* Running indicator */}
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: clock.isRunning ? '#22C55E' : '#333', boxShadow: clock.isRunning ? '0 0 8px #22C55E' : 'none', transition: 'all 0.3s' }} />
                    </div>

                    {/* Divider */}
                    <div style={{ width: '80%', height: 1, background: 'linear-gradient(to right, transparent, #222, transparent)' }} />

                    {/* Shot clock */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#444', letterSpacing: '0.2em' }}>SHOT CLOCK</span>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: 'clamp(48px, 8vw, 80px)',
                            color: isShotCritical ? '#EF4444' : isShotWarning ? '#F97316' : '#F59E0B',
                            animation: isShotCritical ? 'criticalPulse 0.5s ease-in-out infinite' : 'none',
                            textShadow: isShotCritical ? '0 0 30px #EF4444' : isShotWarning ? '0 0 20px #F97316' : 'none',
                        }}>
                            {shotVal}
                        </div>
                    </div>

                    {/* Possession */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#444', letterSpacing: '0.2em' }}>POSSESSION</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: possession === 'A' ? teamAColor : '#222', boxShadow: possession === 'A' ? `0 0 10px ${teamAColor}` : 'none', transition: 'all 0.3s' }} />
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: possession === 'B' ? teamBColor : '#222', boxShadow: possession === 'B' ? `0 0 10px ${teamBColor}` : 'none', transition: 'all 0.3s' }} />
                        </div>
                    </div>
                </div>

                {/* ── TEAM B PANEL ── */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '16px 24px', gap: '16px',
                    background: possession === 'B' ? `${teamBColor}08` : 'transparent',
                    transition: 'background 0.3s',
                }}>
                    {/* Possession arrow */}
                    <div style={{ height: 16, display: 'flex', alignItems: 'center' }}>
                        {possession === 'B' && (
                            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, color: teamBColor, letterSpacing: '0.2em', animation: 'possessionPulse 1.5s ease-in-out infinite' }}>
                                BALL ◀
                            </div>
                        )}
                    </div>

                    {/* Team name */}
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 'clamp(14px, 2vw, 20px)', color: teamBColor, letterSpacing: '0.25em', textTransform: 'uppercase', textAlign: 'center' }}>
                        {teamB.name}
                    </div>

                    {/* SCORE — hero element */}
                    <ScoreDisplay score={teamB.score} color={teamBColor} size="clamp(80px, 14vw, 140px)" />

                    {/* Fouls */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#444', letterSpacing: '0.2em' }}>FOULS</span>
                        <FoulDots count={teamB.fouls} color={teamBColor} />
                    </div>

                    {/* Timeouts */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#444', letterSpacing: '0.2em' }}>TIMEOUTS</span>
                        <TimeoutDots used={3 - teamB.timeouts} total={3} color={teamBColor} />
                    </div>
                </div>
            </div>

            {/* ── FOOTER BAR ── */}
            <div style={{
                height: '32px', background: '#080808',
                borderTop: '1px solid #111',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 18px', flexShrink: 0,
            }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#333', letterSpacing: '0.05em', maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lastAction || 'WAITING FOR INPUT'}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#222', letterSpacing: '0.1em' }}>
                    {isTouchUnlocked ? 'TOUCH ACTIVE — PRESS SETTINGS TO LOCK' : 'PRESS SETTINGS BTN TO UNLOCK TOUCH'}
                </span>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Barlow+Condensed:wght@700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
                @keyframes criticalPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
                @keyframes possessionPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
                @keyframes settingsFlash { 0% { opacity:0; } 50% { opacity:1; } 100% { opacity:0; } }
                @keyframes undoFlash { 0% { opacity:0; } 30% { opacity:1; } 100% { opacity:0; } }
            `}</style>
        </div>
    );
};

export default LiveScoreboard;