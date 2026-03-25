// src/components/referee/PreGameConfirm.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — PRE-GAME CONFIRMATION
//
// Shows matchup + the game code assigned by the Pi.
// Spectators use this code on the website to watch live.
// Referee taps BEGIN to go to live scoreboard.
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import type { GameConfig } from '../../hooks/useRefereeBox';

interface PreGameConfirmProps {
    config: GameConfig;
    gameCode: string;       // NEW — assigned by daemon after createGame()
    onStart: () => void;
    onBack: () => void;
}

const PreGameConfirm: React.FC<PreGameConfirmProps> = ({ config, gameCode, onStart, onBack }) => {
    const [isStarting, setIsStarting] = useState(false);

    const handleStart = () => {
        setIsStarting(true);
        setTimeout(onStart, 300);
    };

    const periodLabel = config.periodType === 'half'
        ? `2 × ${config.periodMinutes} MIN HALVES`
        : `4 × ${config.periodMinutes} MIN QUARTERS`;

    return (
        <div style={{
            width: '1024px', height: '600px',
            background: '#000',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative',
        }}>
            {/* Starting flash overlay */}
            {isStarting && (
                <div style={{
                    position: 'absolute', inset: 0, background: '#000',
                    zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.25s ease',
                }}>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '32px', fontWeight: 700,
                        letterSpacing: '0.3em', color: '#F59E0B',
                    }}>
                        GAME ON
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 28px', borderBottom: '1px solid #0f0f0f', flexShrink: 0,
            }}>
                <div style={{
                    fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                    fontSize: '20px', letterSpacing: '0.25em', color: '#fff',
                }}>
                    THE BOX
                </div>
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px', letterSpacing: '0.15em', color: '#333',
                }}>
                    READY TO START
                </div>
                <button onClick={onBack} style={{
                    background: 'none', border: '1px solid #222',
                    borderRadius: '6px', color: '#444',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px', letterSpacing: '0.1em',
                    padding: '6px 14px', cursor: 'pointer',
                }}>
                    ← BACK
                </button>
            </div>

            {/* Main matchup */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '48px', padding: '20px 40px',
            }}>
                {/* Team A */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '16px',
                        background: config.teamAColor + '22',
                        border: `3px solid ${config.teamAColor}`,
                        margin: '0 auto 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '28px', color: config.teamAColor,
                    }}>
                        {config.teamAName.charAt(0)}
                    </div>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '32px', letterSpacing: '0.08em', color: '#fff',
                    }}>
                        {config.teamAName}
                    </div>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px', color: '#444',
                        letterSpacing: '0.15em', marginTop: '4px',
                    }}>
                        HOME
                    </div>
                </div>

                {/* Center column — VS + game code + rules */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '16px', flexShrink: 0,
                }}>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '40px', color: '#1a1a1a', letterSpacing: '0.1em',
                    }}>
                        VS
                    </div>

                    {/* Game code card */}
                    <div style={{
                        background: '#0a0a0a', border: '1px solid #1e1e1e',
                        borderRadius: '10px', padding: '12px 20px', textAlign: 'center',
                    }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px', color: '#444',
                            letterSpacing: '0.2em', marginBottom: '6px',
                        }}>
                            GAME CODE
                        </div>
                        <div style={{
                            fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                            fontSize: '28px', letterSpacing: '0.3em', color: '#F59E0B',
                        }}>
                            {gameCode}
                        </div>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '9px', color: '#333',
                            letterSpacing: '0.08em', marginTop: '4px',
                        }}>
                            SPECTATORS: /watch/{gameCode.toLowerCase()}
                        </div>
                    </div>

                    {/* Rules summary */}
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px', color: '#333',
                        letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.9,
                    }}>
                        {periodLabel}<br />
                        {config.shotClockSeconds > 0
                            ? `${config.shotClockSeconds}s SHOT CLOCK`
                            : 'NO SHOT CLOCK'}<br />
                        {config.timeoutsPerTeam || 2} TIMEOUTS / TEAM
                    </div>
                </div>

                {/* Team B */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '16px',
                        background: config.teamBColor + '22',
                        border: `3px solid ${config.teamBColor}`,
                        margin: '0 auto 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '28px', color: config.teamBColor,
                    }}>
                        {config.teamBName.charAt(0)}
                    </div>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '32px', letterSpacing: '0.08em', color: '#fff',
                    }}>
                        {config.teamBName}
                    </div>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px', color: '#444',
                        letterSpacing: '0.15em', marginTop: '4px',
                    }}>
                        AWAY
                    </div>
                </div>
            </div>

            {/* BEGIN button */}
            <div style={{
                padding: '16px 28px 24px',
                display: 'flex', justifyContent: 'center', flexShrink: 0,
            }}>
                <button
                    onClick={handleStart}
                    disabled={isStarting}
                    style={{
                        padding: '20px 100px',
                        background: isStarting ? '#333' : '#F59E0B',
                        border: 'none', borderRadius: '12px', color: '#000',
                        fontFamily: "'Oswald', sans-serif", fontSize: '22px',
                        fontWeight: 700, letterSpacing: '0.25em', cursor: 'pointer',
                        transition: 'all 0.15s ease', WebkitTapHighlightColor: 'transparent',
                    }}
                    onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                    {isStarting ? 'STARTING...' : 'BEGIN ▶'}
                </button>
            </div>

            <style>{`@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }`}</style>
        </div>
    );
};

export default PreGameConfirm;