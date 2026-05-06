// src/components/refereebox/PiAdvancedShotFlow.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Pi Advanced Mode Shot Attribution Screen
//
// Shown after a score button press in stats/advanced mode.
// Layout:  [Compressed header]
//          [Court map (55%)] | [Player grid (45%)]
//          [Skip] ──────────────────── [Record Shot]
//
// For +1 FT or stats mode: court is hidden, players take full width.
// Everything uses vw/vh — no hard pixel sizes — for display flexibility.
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { CompressedHeader } from './LockedScoreboard';
import PiCourtMap from './PiCourtMap';
import type { ScorePendingEvent, Player, TeamState, ClockState } from '../../hooks/useRefereeBox';
import type { ShotZoneId } from '../shotchart/types/shotTypes';

interface PiAdvancedShotFlowProps {
    event: ScorePendingEvent;
    teamA: TeamState;
    teamB: TeamState;
    teamAColor: string;
    teamBColor: string;
    clock: ClockState;
    onAttribute: (data: {
        team: 'A' | 'B';
        points: number;
        playerId: string | null;
        playerName: string | null;
        zone?: string;
        x?: number;
        y?: number;
        period?: number;
        gameClockSec?: number;
    }) => void;
    onSkip: () => void;
}

export default function PiAdvancedShotFlow({
    event, teamA, teamB, teamAColor, teamBColor, clock, onAttribute, onSkip,
}: PiAdvancedShotFlowProps) {
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [selectedZone, setSelectedZone] = useState<ShotZoneId | null>(null);
    const [courtX, setCourtX] = useState<number | null>(null);
    const [courtY, setCourtY] = useState<number | null>(null);

    const { team, points, players, gameMode } = event;
    const teamColor = team === 'A' ? teamAColor : teamBColor;
    const teamName = team === 'A' ? teamA.name : teamB.name;
    const isFreeThrow = points === 1;
    const showCourt = !isFreeThrow && gameMode === 'advanced';

    // At least one attribution required to enable Record
    const canRecord = selectedPlayer !== null || selectedZone !== null;

    function handleZoneSelect(zone: ShotZoneId, x: number, y: number) {
        setSelectedZone(zone);
        setCourtX(x);
        setCourtY(y);
    }

    function handleRecord() {
        const gameClockSec = Math.ceil(clock.gameMs / 1000);
        onAttribute({
            team,
            points,
            playerId: selectedPlayer?.id ?? null,
            playerName: selectedPlayer?.name ?? null,
            zone: selectedZone ?? 'unlocated',
            x: courtX ?? undefined,
            y: courtY ?? undefined,
            period: clock.period,
            gameClockSec,
        });
    }

    const numCols = players.length <= 4 ? 2 : 3;

    return (
        <div style={{
            width: '100vw', height: '100dvh',
            background: '#050505',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Oswald', sans-serif",
        }}>
            {/* ── Compressed header ── */}
            <CompressedHeader
                teamA={teamA}
                teamB={teamB}
                clock={clock}
                teamAColor={teamAColor}
                teamBColor={teamBColor}
            />

            {/* ── Pending shot banner ── */}
            <div style={{
                height: '2.8vh',
                minHeight: 22,
                background: `linear-gradient(90deg, ${teamColor}18, ${teamColor}08, ${teamColor}18)`,
                borderBottom: `1px solid ${teamColor}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1vw',
                flexShrink: 0,
            }}>
                <div style={{
                    width: '0.5vw', height: '0.5vw', minWidth: 5, minHeight: 5,
                    borderRadius: '50%', background: teamColor,
                    boxShadow: `0 0 8px ${teamColor}`,
                    animation: 'piShotPulse 1s ease-in-out infinite',
                }} />
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 'clamp(9px, 1.4vh, 13px)',
                    fontWeight: 700, letterSpacing: '0.25em',
                    color: teamColor, textTransform: 'uppercase',
                }}>
                    {teamName}
                    {' '}·{' '}
                    {isFreeThrow ? 'FREE THROW' : `+${points}PT`}
                    {' '}·{' '}
                    ATTRIBUTE SHOT
                </span>
                <div style={{
                    width: '0.5vw', height: '0.5vw', minWidth: 5, minHeight: 5,
                    borderRadius: '50%', background: teamColor,
                    boxShadow: `0 0 8px ${teamColor}`,
                    animation: 'piShotPulse 1s ease-in-out infinite 0.5s',
                }} />
            </div>

            {/* ── Body: court + players ── */}
            <div style={{
                flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0,
            }}>
                {/* Court panel */}
                {showCourt && (
                    <div style={{
                        width: '55%', borderRight: `1px solid rgba(255,255,255,0.05)`,
                        display: 'flex', flexDirection: 'column',
                        background: '#0a0a0a',
                    }}>
                        <PiCourtMap
                            teamColor={teamColor}
                            selectedZone={selectedZone}
                            selectedX={courtX}
                            selectedY={courtY}
                            onZoneSelect={handleZoneSelect}
                        />
                    </div>
                )}

                {/* Player panel */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    padding: 'clamp(8px,1.5vh,16px) clamp(8px,1.5vw,16px)',
                    gap: 'clamp(8px,1.2vh,12px)',
                    overflowY: 'auto',
                }}>
                    {/* Panel header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
                    }}>
                        <div style={{
                            width: 4, height: 'clamp(16px,2.5vh,22px)',
                            borderRadius: 2, background: teamColor,
                            boxShadow: `0 0 8px ${teamColor}55`,
                        }} />
                        <span style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 800, fontSize: 'clamp(13px,2vh,17px)',
                            color: 'rgba(255,255,255,0.85)',
                            letterSpacing: '0.15em', textTransform: 'uppercase',
                        }}>
                            {teamName} ROSTER
                        </span>
                        {selectedPlayer && (
                            <div style={{
                                marginLeft: 'auto',
                                padding: '2px 8px', borderRadius: '100px',
                                background: `${teamColor}20`, border: `1px solid ${teamColor}40`,
                            }}>
                                <span style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 'clamp(8px,1.2vh,10px)', fontWeight: 700,
                                    color: teamColor, letterSpacing: '0.1em',
                                }}>
                                    #{selectedPlayer.number}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Player grid */}
                    {players.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${numCols}, 1fr)`,
                            gap: 'clamp(6px,1vh,10px)',
                        }}>
                            {players.map(player => {
                                const isSelected = selectedPlayer?.id === player.id;
                                return (
                                    <button
                                        key={player.id}
                                        onClick={() => setSelectedPlayer(isSelected ? null : player)}
                                        style={{
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center',
                                            gap: 'clamp(2px,0.6vh,5px)',
                                            padding: 'clamp(8px,1.5vh,14px) clamp(4px,0.8vw,10px)',
                                            borderRadius: '10px',
                                            border: `2px solid ${isSelected ? teamColor : 'rgba(255,255,255,0.07)'}`,
                                            background: isSelected
                                                ? `${teamColor}20`
                                                : 'rgba(255,255,255,0.02)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            boxShadow: isSelected ? `0 0 16px ${teamColor}30` : 'none',
                                            WebkitTapHighlightColor: 'transparent',
                                            userSelect: 'none',
                                            touchAction: 'manipulation',
                                        }}
                                    >
                                        {/* Jersey number */}
                                        <div style={{
                                            fontFamily: "'Oswald', sans-serif",
                                            fontWeight: 700,
                                            fontSize: 'clamp(20px,4vh,36px)',
                                            color: isSelected ? teamColor : 'rgba(255,255,255,0.85)',
                                            lineHeight: 1,
                                            letterSpacing: '-0.02em',
                                            textShadow: isSelected ? `0 0 20px ${teamColor}` : 'none',
                                            transition: 'all 0.15s',
                                        }}>
                                            {player.number}
                                        </div>
                                        {/* Name */}
                                        <div style={{
                                            fontFamily: "'JetBrains Mono', monospace",
                                            fontWeight: 700,
                                            fontSize: 'clamp(7px,1.1vh,10px)',
                                            color: isSelected ? teamColor : 'rgba(255,255,255,0.35)',
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase',
                                            textAlign: 'center',
                                            lineHeight: 1.2,
                                            maxWidth: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {player.name}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 'clamp(9px,1.3vh,11px)', color: 'rgba(255,255,255,0.2)',
                            letterSpacing: '0.15em', textAlign: 'center',
                        }}>
                            NO ROSTER LOADED
                        </div>
                    )}

                    {/* Skip player */}
                    {players.length > 0 && (
                        <button
                            onClick={() => setSelectedPlayer(null)}
                            style={{
                                marginTop: 'auto',
                                padding: 'clamp(6px,1vh,10px)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'transparent',
                                color: 'rgba(255,255,255,0.2)',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 'clamp(8px,1.1vh,10px)', fontWeight: 700,
                                letterSpacing: '0.12em', textTransform: 'uppercase',
                                cursor: 'pointer',
                                WebkitTapHighlightColor: 'transparent',
                                touchAction: 'manipulation',
                                flexShrink: 0,
                            }}
                        >
                            {selectedPlayer ? '✕  CLEAR PLAYER' : 'SKIP PLAYER SELECTION'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Bottom action bar ── */}
            <div style={{
                height: 'clamp(52px,8vh,72px)',
                background: 'linear-gradient(180deg, #0a0a0a, #060606)',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center',
                padding: '0 clamp(12px,2vw,24px)',
                gap: 'clamp(8px,1.5vw,16px)',
                flexShrink: 0,
            }}>
                {/* Skip attribution */}
                <button
                    onClick={onSkip}
                    style={{
                        padding: 'clamp(8px,1.3vh,12px) clamp(14px,2.5vw,28px)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: '#0a0a0a',
                        color: 'rgba(255,255,255,0.3)',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 'clamp(9px,1.3vh,12px)', fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: 'pointer', flexShrink: 0,
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                    }}
                >
                    SKIP
                </button>

                {/* Status indicator */}
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '6px',
                    overflow: 'hidden',
                }}>
                    {canRecord && (
                        <>
                            {selectedPlayer && (
                                <span style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 'clamp(8px,1.1vh,10px)', color: teamColor,
                                    fontWeight: 600, letterSpacing: '0.08em',
                                    whiteSpace: 'nowrap',
                                }}>
                                    #{selectedPlayer.number}
                                </span>
                            )}
                            {selectedPlayer && selectedZone && (
                                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>·</span>
                            )}
                            {selectedZone && (
                                <span style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 'clamp(8px,1.1vh,10px)', color: 'rgba(255,255,255,0.4)',
                                    fontWeight: 600, letterSpacing: '0.05em',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {selectedZone.replace(/_/g, ' ').toUpperCase()}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Record Shot */}
                <button
                    onClick={canRecord ? handleRecord : undefined}
                    style={{
                        padding: 'clamp(8px,1.3vh,12px) clamp(16px,3vw,36px)',
                        borderRadius: '10px',
                        border: `2px solid ${canRecord ? teamColor : 'rgba(255,255,255,0.08)'}`,
                        background: canRecord ? teamColor : 'rgba(255,255,255,0.03)',
                        color: canRecord ? '#000' : 'rgba(255,255,255,0.15)',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 'clamp(10px,1.4vh,13px)', fontWeight: 700,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        cursor: canRecord ? 'pointer' : 'default', flexShrink: 0,
                        transition: 'all 0.2s ease',
                        boxShadow: canRecord ? `0 0 20px ${teamColor}40` : 'none',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                    }}
                >
                    ✓ RECORD SHOT
                </button>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Barlow+Condensed:wght@700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
                @keyframes piShotPulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
            `}</style>
        </div>
    );
}
