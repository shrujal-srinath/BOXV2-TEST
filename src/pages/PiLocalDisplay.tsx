// src/pages/PiLocalDisplay.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — LOCAL SPECTATOR DISPLAY (HDMI 2)
//
// Connects directly to the Pi daemon via Socket.io (LAN-only, no
// internet required). Designed for large LED screens and projectors.
// Full-screen cinematic scoreboard — scores dominate, clock below.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// ── Types (mirrors daemon state shape) ─────────────────────────
interface TeamState { name: string; score: number; fouls: number; timeouts: number; color: string; }
interface ClockState {
    gameMs: number; shotMs: number; isRunning: boolean;
    period: number; totalPeriods: number;
    periodMinutes: number; shotClockSeconds: number;
}
interface GameState {
    teamA: TeamState; teamB: TeamState;
    clock: ClockState;
    possession: 'A' | 'B' | null;
    meta: { gameCode: string | null; gameActive: boolean; periodType: 'quarter' | 'half'; };
}

// ── Theme ───────────────────────────────────────────────────────
const BG      = '#000000';
const SURFACE = '#0a0a0a';
const WHITE   = '#FFFFFF';
const DIM     = 'rgba(255,255,255,0.38)';
const AMBER   = '#F59E0B';
const ORANGE  = '#F97316';
const GREEN   = '#22C55E';
const OSW     = "'Oswald', sans-serif";
const RM      = "'JetBrains Mono', monospace";

const DAEMON_URL = 'http://localhost:3001';

// ── Helpers ─────────────────────────────────────────────────────
const fmtClock = (ms: number): string => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtShot = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));
const periodLabel = (period: number, total: number): string => {
    if (total === 2) return period <= 2 ? `HALF ${period}` : `OT ${period - 2}`;
    return period <= total ? `Q${period}` : `OT ${period - total}`;
};

// ── Flash on score change ───────────────────────────────────────
function useScoreFlash(score: number, color: string) {
    const [flash, setFlash] = useState(false);
    const prev = useRef(score);
    const t = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (prev.current !== score) {
            prev.current = score;
            setFlash(true);
            if (t.current) clearTimeout(t.current);
            t.current = setTimeout(() => setFlash(false), 600);
        }
        return () => { if (t.current) clearTimeout(t.current); };
    }, [score]);
    return flash;
}

// ═══════════════════════════════════════════════════════════════
// TEAM SCORE PANEL — one side of the scoreboard
// ═══════════════════════════════════════════════════════════════
const TeamPanel: React.FC<{
    team: TeamState;
    align: 'left' | 'right';
    hasPossession: boolean;
    inBonus: boolean;
}> = ({ team, align, hasPossession, inBonus }) => {
    const color = team.color || (align === 'left' ? '#2563EB' : '#DC2626');
    const flash = useScoreFlash(team.score, color);
    const isLeft = align === 'left';

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: isLeft ? 'flex-start' : 'flex-end',
            justifyContent: 'center',
            padding: isLeft ? '0 40px 0 60px' : '0 60px 0 40px',
            background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, ${color}12 0%, transparent 80%)`,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Team name */}
            <div style={{
                fontFamily: OSW,
                fontStyle: 'italic',
                fontWeight: 700,
                fontSize: 'clamp(36px, 5vw, 64px)',
                color: WHITE,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textAlign: align,
                textShadow: `0 0 40px ${color}44`,
                marginBottom: 8,
            }}>{team.name}</div>

            {/* Score — the hero element */}
            <div style={{
                fontFamily: OSW,
                fontStyle: 'italic',
                fontWeight: 700,
                fontSize: 'clamp(140px, 22vw, 280px)',
                lineHeight: 0.85,
                color: flash ? WHITE : color,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.04em',
                textShadow: flash
                    ? `0 0 80px ${color}, 0 0 40px ${color}cc, 0 0 16px ${color}`
                    : `0 0 40px ${color}55, 0 0 16px ${color}77`,
                transition: 'color 0.6s, text-shadow 0.6s',
            }}>{team.score}</div>

            {/* Fouls + bonus */}
            <div style={{
                display: 'flex',
                flexDirection: isLeft ? 'row' : 'row-reverse',
                alignItems: 'center',
                gap: 16,
                marginTop: 12,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isLeft ? 'row' : 'row-reverse' }}>
                    <span style={{ fontFamily: RM, fontSize: 'clamp(12px, 1.4vw, 18px)', color: DIM, letterSpacing: '0.2em', fontWeight: 600 }}>FOULS</span>
                    <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(20px, 2.5vw, 32px)', color: WHITE }}>{team.fouls}</span>
                </div>
                {inBonus && (
                    <div style={{
                        padding: '4px 14px',
                        background: ORANGE,
                        fontFamily: RM, fontSize: 'clamp(10px, 1.2vw, 14px)',
                        fontWeight: 700, color: '#000',
                        letterSpacing: '0.2em', textTransform: 'uppercase',
                        boxShadow: `0 0 16px ${ORANGE}88`,
                    }}>BONUS</div>
                )}
            </div>

            {/* Possession indicator */}
            {hasPossession && (
                <div style={{
                    position: 'absolute',
                    [isLeft ? 'right' : 'left']: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}>
                    <div style={{
                        width: 0, height: 0,
                        borderTop: '18px solid transparent',
                        borderBottom: '18px solid transparent',
                        [isLeft ? 'borderLeft' : 'borderRight']: `28px solid ${color}`,
                        filter: `drop-shadow(0 0 8px ${color})`,
                    }} />
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// CENTER COLUMN — clock + shot clock + period
// ═══════════════════════════════════════════════════════════════
const CenterColumn: React.FC<{ clock: ClockState }> = ({ clock }) => {
    const live = clock.isRunning;
    const shotMs = clock.shotMs ?? 0;
    const shotLow = shotMs > 0 && shotMs <= 5000;
    const shotColor = shotLow ? '#DC2626' : AMBER;

    return (
        <div style={{
            width: 'clamp(240px, 28vw, 400px)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            background: SURFACE,
        }}>
            {/* Period */}
            <div style={{
                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                fontSize: 'clamp(18px, 2.5vw, 30px)',
                color: DIM, letterSpacing: '0.12em',
                textTransform: 'uppercase',
            }}>{periodLabel(clock.period, clock.totalPeriods)}</div>

            {/* Game clock */}
            <div style={{
                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                fontSize: 'clamp(72px, 10vw, 130px)',
                lineHeight: 1,
                color: live ? WHITE : 'rgba(255,255,255,0.55)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.03em',
                textShadow: live
                    ? '0 0 30px rgba(255,255,255,0.6), 0 0 10px rgba(255,255,255,0.8)'
                    : '0 0 10px rgba(255,255,255,0.12)',
                transition: 'color 0.3s, text-shadow 0.3s',
            }}>{fmtClock(clock.gameMs)}</div>

            {/* Live / paused indicator */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 18px',
                border: `1px solid ${live ? GREEN : AMBER}44`,
                background: `${live ? GREEN : AMBER}0f`,
            }}>
                <div style={{
                    width: 8, height: 8,
                    background: live ? GREEN : AMBER,
                    animation: live ? 'localPulse 1.2s infinite' : 'none',
                }} />
                <span style={{
                    fontFamily: RM, fontSize: 'clamp(9px, 1.1vw, 13px)',
                    color: live ? GREEN : AMBER,
                    letterSpacing: '0.28em', fontWeight: 700,
                }}>{live ? 'LIVE' : 'PAUSED'}</span>
            </div>

            {/* Shot clock */}
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 28px',
                border: `1px solid ${shotColor}55`,
                background: `${shotColor}0d`,
                animation: shotLow ? 'localBlink 0.5s infinite' : 'none',
            }}>
                <span style={{
                    fontFamily: RM, fontSize: 'clamp(8px, 1vw, 12px)',
                    color: shotColor, letterSpacing: '0.3em', fontWeight: 700,
                }}>SHOT CLOCK</span>
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 'clamp(40px, 6vw, 80px)', lineHeight: 1,
                    color: shotColor,
                    fontVariantNumeric: 'tabular-nums',
                    textShadow: `0 0 18px ${shotColor}cc`,
                }}>{fmtShot(shotMs)}</span>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// IDLE SCREEN — shown when no game is active
// ═══════════════════════════════════════════════════════════════
const IdleScreen: React.FC<{ connected: boolean }> = ({ connected }) => (
    <div style={{
        width: '100vw', height: '100vh',
        background: BG,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24,
    }}>
        <div style={{
            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: 'clamp(60px, 10vw, 120px)',
            color: 'rgba(255,255,255,0.08)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>THE BOX</div>
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 28px',
            border: `1px solid ${connected ? GREEN : ORANGE}44`,
            background: `${connected ? GREEN : ORANGE}0d`,
        }}>
            <div style={{
                width: 10, height: 10,
                background: connected ? GREEN : ORANGE,
                animation: 'localPulse 1.8s infinite',
            }} />
            <span style={{
                fontFamily: RM, fontSize: 'clamp(11px, 1.5vw, 16px)',
                color: connected ? GREEN : ORANGE,
                letterSpacing: '0.28em', fontWeight: 700,
            }}>{connected ? 'CONNECTED · WAITING FOR GAME' : 'CONNECTING TO SCORER\'S TABLE...'}</span>
        </div>
        <div style={{
            fontFamily: RM, fontSize: 'clamp(9px, 1.1vw, 13px)',
            color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em',
        }}>LOCAL DISPLAY · LAN MODE</div>
    </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
const PiLocalDisplay: React.FC = () => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const socket = io(DAEMON_URL, {
            reconnection: true,
            reconnectionDelay: 1500,
            reconnectionAttempts: Infinity,
        });
        socketRef.current = socket;

        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        socket.on('state_update', (state: GameState) => {
            setGameState(state);
        });

        // clock_sync only updates clock fields (more frequent, lighter)
        socket.on('clock_sync', (clock: ClockState) => {
            setGameState(prev => prev ? { ...prev, clock } : prev);
        });

        return () => { socket.disconnect(); };
    }, []);

    const isActive = gameState?.meta?.gameActive ?? false;

    if (!isActive) {
        return (
            <>
                <style>{`
                    @keyframes localPulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
                    @keyframes localBlink { 0%,100%{opacity:1} 50%{opacity:0.4} }
                `}</style>
                <IdleScreen connected={connected} />
            </>
        );
    }

    const { teamA, teamB, clock, possession } = gameState!;
    const inBonusA = teamA.fouls >= 5;
    const inBonusB = teamB.fouls >= 5;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=JetBrains+Mono:wght@600;700&display=swap');
                @keyframes localPulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
                @keyframes localBlink { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
                * { box-sizing: border-box; margin: 0; padding: 0; }
            `}</style>

            <div style={{
                width: '100vw', height: '100vh',
                background: BG, color: WHITE,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden', userSelect: 'none',
            }}>
                {/* ── MAIN SCOREBOARD ── */}
                <div style={{
                    flex: 1, minHeight: 0,
                    display: 'flex',
                    alignItems: 'stretch',
                }}>
                    <TeamPanel
                        team={teamA}
                        align="left"
                        hasPossession={possession === 'A'}
                        inBonus={inBonusA}
                    />
                    <CenterColumn clock={clock} />
                    <TeamPanel
                        team={teamB}
                        align="right"
                        hasPossession={possession === 'B'}
                        inBonus={inBonusB}
                    />
                </div>

                {/* ── BOTTOM STATUS BAR ── */}
                <div style={{
                    height: 36, flexShrink: 0,
                    background: SURFACE,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 7, height: 7,
                            background: connected ? GREEN : ORANGE,
                            boxShadow: `0 0 6px ${connected ? GREEN : ORANGE}88`,
                            animation: 'localPulse 2s infinite',
                        }} />
                        <span style={{
                            fontFamily: RM, fontSize: 10, fontWeight: 600,
                            color: DIM, letterSpacing: '0.18em', textTransform: 'uppercase',
                        }}>THE BOX · LOCAL DISPLAY</span>
                    </div>
                    {gameState?.meta?.gameCode && (
                        <span style={{
                            fontFamily: RM, fontSize: 10, fontWeight: 600,
                            color: DIM, letterSpacing: '0.22em', textTransform: 'uppercase',
                        }}>GAME · {gameState.meta.gameCode.toUpperCase()}</span>
                    )}
                    <span style={{
                        fontFamily: RM, fontSize: 10, fontWeight: 600,
                        color: DIM, letterSpacing: '0.18em', textTransform: 'uppercase',
                    }}>LAN · NO INTERNET REQUIRED</span>
                </div>
            </div>
        </>
    );
};

export default PiLocalDisplay;
