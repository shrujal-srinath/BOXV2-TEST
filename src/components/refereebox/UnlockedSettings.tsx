// src/components/referee/SettingsPanel.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — SETTINGS / MANUAL OVERRIDE MODE
// Accessible ONLY when physical SETTINGS button is pressed.
// Orange border = visual alarm that touch is active.
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';

interface TeamState {
    name: string;
    score: number;
    fouls: number;
    timeouts: number;
}

interface ClockState {
    gameMs: number;
    shotMs: number;
    isRunning: boolean;
    period: number;
}

interface SettingsPanelProps {
    teamA: TeamState;
    teamB: TeamState;
    clock: ClockState;
    teamAColor?: string;
    teamBColor?: string;
    sendAction: (type: string, payload?: any) => void;
}

// ── Touch adjustment button ──
const AdjustBtn: React.FC<{
    label: string;
    onClick: () => void;
    color: string;
    size?: 'normal' | 'large';
}> = ({ label, onClick, color, size = 'normal' }) => (
    <div
        onClick={onClick}
        style={{
            width: size === 'large' ? '48px' : '40px',
            height: size === 'large' ? '48px' : '40px',
            background: '#111',
            border: `1.5px solid #2a2a2a`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
            fontFamily: "'Barlow', sans-serif",
            fontSize: size === 'large' ? '22px' : '18px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'transform 0.08s, background 0.1s',
        }}
        onTouchStart={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = 'scale(0.9)';
            el.style.background = '#1a1a1a';
        }}
        onTouchEnd={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = 'scale(1)';
            el.style.background = '#111';
        }}
    >
        {label}
    </div>
);

// ── Stat row with +/- ──
const StatRow: React.FC<{
    label: string;
    value: number | string;
    onDecrement: () => void;
    onIncrement: () => void;
    color: string;
    valueColor?: string;
    valueFontSize?: string;
}> = ({ label, value, onDecrement, onIncrement, color, valueColor = '#fff', valueFontSize = '28px' }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    }}>
        <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            color: '#555',
            letterSpacing: '0.12em',
            width: '56px',
            textAlign: 'right',
        }}>
            {label}
        </div>
        <AdjustBtn label="−" onClick={onDecrement} color={color} />
        <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: valueFontSize,
            color: valueColor,
            minWidth: '56px',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
        }}>
            {value}
        </div>
        <AdjustBtn label="+" onClick={onIncrement} color={color} />
    </div>
);

const formatClock = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    teamA, teamB, clock, teamAColor = '#3B82F6', teamBColor = '#EF4444', sendAction,
}) => {
    const [showEndConfirm, setShowEndConfirm] = useState(false);

    return (
        <div style={{
            width: '1024px',
            height: '600px',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '3px solid #F97316',
            borderRadius: '4px',
        }}>
            {/* ── WARNING HEADER ── */}
            <div style={{
                height: '40px',
                background: 'linear-gradient(90deg, #1a0800 0%, #2a1400 50%, #1a0800 100%)',
                borderBottom: '2px solid #F97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                flexShrink: 0,
            }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#F97316',
                    animation: 'dotPulse 1s infinite',
                }} />
                <span style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: '16px',
                    letterSpacing: '0.2em',
                    color: '#F97316',
                }}>
                    MANUAL OVERRIDE — TOUCH ACTIVE
                </span>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#F97316',
                    animation: 'dotPulse 1s infinite',
                }} />
            </div>

            {/* ── MAIN EDIT AREA ── */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 220px 1fr',
                minHeight: 0,
                padding: '16px 20px',
                gap: '16px',
            }}>
                {/* TEAM A EDITS */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                }}>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '18px',
                        letterSpacing: '0.1em',
                        color: teamAColor,
                    }}>
                        {teamA.name}
                    </div>
                    <StatRow
                        label="SCORE"
                        value={teamA.score}
                        onDecrement={() => sendAction('EDIT_SCORE', { team: 'teamA', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_SCORE', { team: 'teamA', amount: 1 })}
                        color={teamAColor}
                        valueFontSize="36px"
                    />
                    <StatRow
                        label="FOULS"
                        value={teamA.fouls}
                        onDecrement={() => sendAction('EDIT_FOULS', { team: 'teamA', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_FOULS', { team: 'teamA', amount: 1 })}
                        color={teamAColor}
                    />
                    <StatRow
                        label="T.O."
                        value={teamA.timeouts}
                        onDecrement={() => sendAction('EDIT_TIMEOUTS', { team: 'teamA', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_TIMEOUTS', { team: 'teamA', amount: 1 })}
                        color={teamAColor}
                    />
                </div>

                {/* CENTER — CLOCKS + SYSTEM */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                    borderLeft: '1px solid #1a1a1a',
                    borderRight: '1px solid #1a1a1a',
                    padding: '0 16px',
                }}>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px',
                        color: '#555',
                        letterSpacing: '0.2em',
                    }}>
                        CLOCKS
                    </div>
                    <StatRow
                        label="GAME"
                        value={formatClock(clock.gameMs)}
                        onDecrement={() => sendAction('EDIT_GAME_CLOCK', { amount: -1 })}
                        onIncrement={() => sendAction('EDIT_GAME_CLOCK', { amount: 1 })}
                        color="#22C55E"
                        valueColor="#22C55E"
                        valueFontSize="24px"
                    />
                    <StatRow
                        label="SHOT"
                        value={Math.ceil(clock.shotMs / 1000)}
                        onDecrement={() => sendAction('EDIT_SHOT_CLOCK', { amount: -1 })}
                        onIncrement={() => sendAction('EDIT_SHOT_CLOCK', { amount: 1 })}
                        color="#F59E0B"
                        valueColor="#F59E0B"
                        valueFontSize="24px"
                    />
                    <StatRow
                        label="PERIOD"
                        value={clock.period}
                        onDecrement={() => sendAction('EDIT_PERIOD', { amount: -1 })}
                        onIncrement={() => sendAction('EDIT_PERIOD', { amount: 1 })}
                        color="#fff"
                    />

                    {/* Divider */}
                    <div style={{ width: '80%', height: '1px', background: '#1a1a1a' }} />

                    {/* End game */}
                    {!showEndConfirm ? (
                        <div
                            onClick={() => setShowEndConfirm(true)}
                            style={{
                                width: '100%',
                                height: '44px',
                                background: '#1a0808',
                                border: '1.5px solid #3a1a1a',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: "'Barlow', sans-serif",
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#EF4444',
                                letterSpacing: '0.1em',
                                cursor: 'pointer',
                            }}
                        >
                            END GAME
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            width: '100%',
                        }}>
                            <div
                                onClick={() => setShowEndConfirm(false)}
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    background: '#111',
                                    border: '1.5px solid #2a2a2a',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontFamily: "'Barlow', sans-serif",
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#666',
                                    cursor: 'pointer',
                                }}
                            >
                                CANCEL
                            </div>
                            <div
                                onClick={() => sendAction('END_GAME')}
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    background: '#EF4444',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontFamily: "'Barlow', sans-serif",
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#fff',
                                    cursor: 'pointer',
                                }}
                            >
                                CONFIRM
                            </div>
                        </div>
                    )}
                </div>

                {/* TEAM B EDITS */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                }}>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '18px',
                        letterSpacing: '0.1em',
                        color: teamBColor,
                    }}>
                        {teamB.name}
                    </div>
                    <StatRow
                        label="SCORE"
                        value={teamB.score}
                        onDecrement={() => sendAction('EDIT_SCORE', { team: 'teamB', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_SCORE', { team: 'teamB', amount: 1 })}
                        color={teamBColor}
                        valueFontSize="36px"
                    />
                    <StatRow
                        label="FOULS"
                        value={teamB.fouls}
                        onDecrement={() => sendAction('EDIT_FOULS', { team: 'teamB', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_FOULS', { team: 'teamB', amount: 1 })}
                        color={teamBColor}
                    />
                    <StatRow
                        label="T.O."
                        value={teamB.timeouts}
                        onDecrement={() => sendAction('EDIT_TIMEOUTS', { team: 'teamB', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_TIMEOUTS', { team: 'teamB', amount: 1 })}
                        color={teamBColor}
                    />
                </div>
            </div>

            {/* ── FOOTER ── */}
            <div style={{
                height: '36px',
                background: '#0a0500',
                borderTop: '1px solid #F97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}>
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    color: '#F97316',
                    letterSpacing: '0.15em',
                    fontWeight: 600,
                }}>
                    PRESS SETTINGS BUTTON TO LOCK & RETURN
                </span>
            </div>
        </div>
    );
};

export default SettingsPanel;