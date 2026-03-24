// src/components/referee/PreGameConfirm.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — PRE-GAME CONFIRMATION
// Final review screen before the game begins.
// Shows team matchup in broadcast-style layout + rules summary.
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';

interface GameConfig {
    teamAName: string;
    teamBName: string;
    teamAColor: string;
    teamBColor: string;
    periodMinutes: number;
    shotClockSeconds: number;
    periods: number;
}

interface PreGameConfirmProps {
    config: GameConfig;
    onStart: () => void;
    onBack: () => void;
}

const PreGameConfirm: React.FC<PreGameConfirmProps> = ({ config, onStart, onBack }) => {
    const [isStarting, setIsStarting] = useState(false);

    const handleStart = () => {
        setIsStarting(true);
        // Brief delay for dramatic effect, then start
        setTimeout(onStart, 400);
    };

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
            {/* Starting overlay */}
            {isStarting && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#000',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'fadeIn 0.3s ease',
                }}>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '48px',
                        letterSpacing: '0.2em',
                        color: '#22C55E',
                        animation: 'breathe 0.8s infinite',
                    }}>
                        GAME ON
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{
                padding: '16px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #1a1a1a',
                flexShrink: 0,
            }}>
                <div
                    onClick={onBack}
                    style={{
                        fontFamily: "'Barlow', sans-serif",
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#666',
                        cursor: 'pointer',
                        padding: '8px 0',
                    }}
                >
                    ← EDIT
                </div>
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px',
                    color: '#555',
                    letterSpacing: '0.15em',
                }}>
                    CONFIRM & START
                </div>
                <div style={{ width: '60px' }} />
            </div>

            {/* Matchup display */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                padding: '0 40px',
            }}>
                {/* Team A */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '20px',
                        background: config.teamAColor + '20',
                        border: `3px solid ${config.teamAColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '36px',
                        color: config.teamAColor,
                    }}>
                        {config.teamAName.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '32px',
                        letterSpacing: '0.08em',
                        color: config.teamAColor,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                    }}>
                        {config.teamAName}
                    </div>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: '#555',
                        letterSpacing: '0.1em',
                    }}>
                        HOME / LEFT
                    </div>
                </div>

                {/* VS */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '0 40px',
                }}>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '48px',
                        color: '#222',
                        letterSpacing: '0.1em',
                    }}>
                        VS
                    </div>

                    {/* Rules summary */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'center',
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                        }}>
                            <RulePill label="PERIOD" value={`${config.periodMinutes}:00`} />
                            <RulePill label="SHOT" value={`${config.shotClockSeconds}s`} />
                            <RulePill label="FORMAT" value={config.periods === 4 ? '4Q' : '2H'} />
                        </div>
                    </div>
                </div>

                {/* Team B */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '20px',
                        background: config.teamBColor + '20',
                        border: `3px solid ${config.teamBColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '36px',
                        color: config.teamBColor,
                    }}>
                        {config.teamBName.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '32px',
                        letterSpacing: '0.08em',
                        color: config.teamBColor,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                    }}>
                        {config.teamBName}
                    </div>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: '#555',
                        letterSpacing: '0.1em',
                    }}>
                        AWAY / RIGHT
                    </div>
                </div>
            </div>

            {/* Start button */}
            <div style={{
                padding: '16px 32px 24px',
                borderTop: '1px solid #1a1a1a',
                flexShrink: 0,
            }}>
                <div
                    onClick={handleStart}
                    style={{
                        width: '100%',
                        height: '64px',
                        background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'transform 0.1s',
                    }}
                    onTouchStart={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
                    }}
                    onTouchEnd={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <polygon points="5,3 19,12 5,21" />
                    </svg>
                    <span style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '24px',
                        letterSpacing: '0.2em',
                        color: '#fff',
                    }}>
                        START GAME
                    </span>
                </div>
            </div>
        </div>
    );
};

// ── Rule pill sub-component ──
const RulePill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 16px',
        background: '#0a0a0a',
        border: '1px solid #1a1a1a',
        borderRadius: '8px',
        minWidth: '80px',
    }}>
        <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            color: '#555',
            letterSpacing: '0.15em',
            marginBottom: '4px',
        }}>
            {label}
        </div>
        <div style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: '20px',
            fontWeight: 700,
            color: '#fff',
        }}>
            {value}
        </div>
    </div>
);

export default PreGameConfirm;