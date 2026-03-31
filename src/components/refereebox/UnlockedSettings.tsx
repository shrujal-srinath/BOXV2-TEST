// src/components/refereebox/UnlockedSettings.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — SETTINGS / MANUAL OVERRIDE MODE v3
//
// Broadcast-grade control panel. All controls visible at once.
// No hidden tabs. Quick-action buttons for fouls & timeouts.
// Touch-active orange warning border.
// ═══════════════════════════════════════════════════════════════

import React from 'react';

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
    totalPeriods: number;
}

interface SettingsPanelProps {
    teamA: TeamState;
    teamB: TeamState;
    clock: ClockState;
    possession: 'A' | 'B' | null;
    teamAColor?: string;
    teamBColor?: string;
    sendAction: (type: string, payload?: Record<string, unknown>) => void;
    onEndGame?: () => void;
}

// ── Tactile button ──
const TactileBtn: React.FC<{
    label: string;
    onClick: () => void;
    color?: string;
    bg?: string;
    borderColor?: string;
    size?: number;
    fontSize?: number;
    disabled?: boolean;
    fullWidth?: boolean;
}> = ({ label, onClick, color = '#fff', bg = 'rgba(255,255,255,0.03)', borderColor = 'rgba(255,255,255,0.08)', size = 48, fontSize = 18, disabled = false, fullWidth = false }) => (
    <div
        onClick={disabled ? undefined : onClick}
        style={{
            width: fullWidth ? '100%' : size,
            height: size,
            background: bg,
            border: `1.5px solid ${borderColor}`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: disabled ? 'rgba(255,255,255,0.1)' : color,
            fontFamily: "'Barlow', sans-serif",
            fontSize, fontWeight: 700,
            cursor: disabled ? 'default' : 'pointer',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.06s, background 0.1s',
            opacity: disabled ? 0.3 : 1,
        }}
        onTouchStart={(e) => {
            if (!disabled) (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
        }}
        onTouchEnd={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >
        {label}
    </div>
);

// ── Stat row ──
const StatRow: React.FC<{
    label: string;
    value: number | string;
    onDecrement: () => void;
    onIncrement: () => void;
    color: string;
    valueColor?: string;
    valueFontSize?: string;
}> = ({ label, value, onDecrement, onIncrement, color, valueColor = '#fff', valueFontSize = '28px' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px', color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.12em', width: '48px', textAlign: 'right',
            fontWeight: 600,
        }}>
            {label}
        </div>
        <TactileBtn label="−" onClick={onDecrement} color={color} borderColor={`${color}33`} />
        <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, fontSize: valueFontSize,
            color: valueColor, minWidth: '52px',
            textAlign: 'center', fontVariantNumeric: 'tabular-nums',
        }}>
            {value}
        </div>
        <TactileBtn label="+" onClick={onIncrement} color={color} borderColor={`${color}33`} />
    </div>
);

const formatClock = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getPeriodLabel = (period: number, total: number): string => {
    if (total === 2) return period <= 2 ? `H${period}` : `OT${period - 2}`;
    return period <= 4 ? `Q${period}` : `OT${period - 4}`;
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    teamA, teamB, clock,
    possession = null,
    teamAColor = '#3B82F6', teamBColor = '#EF4444',
    sendAction, onEndGame,
}) => {
    const currentPeriodLabel = getPeriodLabel(clock.period, clock.totalPeriods);
    const canGoBack = clock.period > 1;

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '3px solid #F97316',
        }}>

            {/* ── WARNING HEADER ── */}
            <div style={{
                height: '42px',
                background: 'linear-gradient(90deg, #1a0800 0%, #2a1400 50%, #1a0800 100%)',
                borderBottom: '2px solid #F97316',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: '#F97316', animation: 'dotPulse 1s infinite',
                        boxShadow: '0 0 8px #F97316',
                    }} />
                    <span style={{
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '13px', letterSpacing: '0.2em', color: '#F97316',
                    }}>
                        MANUAL OVERRIDE
                    </span>
                </div>

                <div
                    onClick={onEndGame}
                    style={{
                        padding: '5px 16px', border: '1px solid #5a0000',
                        borderRadius: '6px', background: '#1a0000',
                        color: '#EF4444', fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                        cursor: 'pointer', userSelect: 'none',
                    }}
                    onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = '#2a0000'; }}
                    onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a0000'; }}
                >
                    END GAME
                </div>
            </div>

            {/* ── MAIN AREA ── */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 280px 1fr',
                gap: '0',
                overflow: 'hidden',
            }}>

                {/* ─── LEFT: TEAM A ─── */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '12px 14px', gap: '10px',
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                    position: 'relative',
                }}>
                    {/* Team color accent */}
                    <div style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 3, background: `linear-gradient(to bottom, transparent, ${teamAColor}88, transparent)` }} />

                    {/* Name */}
                    <div style={{
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '13px', letterSpacing: '0.2em',
                        color: teamAColor, textTransform: 'uppercase',
                        borderBottom: `2px solid ${teamAColor}33`, paddingBottom: '4px',
                        width: '100%', textAlign: 'center',
                    }}>
                        {teamA.name}
                    </div>

                    {/* Score */}
                    <StatRow
                        label="SCORE" value={teamA.score}
                        onDecrement={() => sendAction('EDIT_SCORE', { team: 'teamA', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_SCORE', { team: 'teamA', amount: 1 })}
                        color={teamAColor} valueColor={teamAColor} valueFontSize="36px"
                    />
                    <StatRow
                        label="FOULS" value={teamA.fouls}
                        onDecrement={() => sendAction('EDIT_FOULS', { team: 'teamA', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_FOULS', { team: 'teamA', amount: 1 })}
                        color="#EF4444"
                    />
                    <StatRow
                        label="T.O." value={teamA.timeouts}
                        onDecrement={() => sendAction('EDIT_TIMEOUTS', { team: 'teamA', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_TIMEOUTS', { team: 'teamA', amount: 1 })}
                        color="#F59E0B"
                    />

                    {/* Divider */}
                    <div style={{ width: '80%', height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />

                    {/* Quick Actions */}
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <div
                            onClick={() => sendAction('ADD_FOUL_A')}
                            style={{
                                flex: 1, height: 44, borderRadius: '8px',
                                background: '#EF444410', border: '1.5px solid #EF444433',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                                fontWeight: 700, color: '#EF4444', letterSpacing: '0.08em',
                                cursor: 'pointer', userSelect: 'none',
                            }}
                            onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = '#EF444420'; }}
                            onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = '#EF444410'; }}
                        >
                            + FOUL
                        </div>
                        <div
                            onClick={() => sendAction('TIMEOUT_A')}
                            style={{
                                flex: 1, height: 44, borderRadius: '8px',
                                background: '#F59E0B10', border: '1.5px solid #F59E0B33',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                                fontWeight: 700, color: '#F59E0B', letterSpacing: '0.08em',
                                cursor: 'pointer', userSelect: 'none',
                                opacity: teamA.timeouts > 0 ? 1 : 0.3,
                            }}
                            onTouchStart={(e) => { if (teamA.timeouts > 0) (e.currentTarget as HTMLElement).style.background = '#F59E0B20'; }}
                            onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = '#F59E0B10'; }}
                        >
                            TIMEOUT
                        </div>
                    </div>
                </div>

                {/* ─── CENTER: ALL CONTROLS ─── */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                    overflow: 'auto',
                }}>
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '12px 14px', gap: '10px',
                    }}>

                        {/* ── CLOCKS ── */}
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: '8px',
                            color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', fontWeight: 600,
                        }}>CLOCKS</div>
                        <StatRow
                            label="GAME" value={formatClock(clock.gameMs)}
                            onDecrement={() => sendAction('EDIT_GAME_CLOCK', { amount: -1 })}
                            onIncrement={() => sendAction('EDIT_GAME_CLOCK', { amount: 1 })}
                            color="#22C55E" valueColor="#22C55E" valueFontSize="22px"
                        />
                        <StatRow
                            label="SHOT" value={Math.ceil(clock.shotMs / 1000)}
                            onDecrement={() => sendAction('EDIT_SHOT_CLOCK', { amount: -1 })}
                            onIncrement={() => sendAction('EDIT_SHOT_CLOCK', { amount: 1 })}
                            color="#F59E0B" valueColor="#F59E0B" valueFontSize="22px"
                        />
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '8px', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.08em' }}>±1 SEC PER TAP</div>

                        {/* Divider */}
                        <div style={{ width: '80%', height: 1, background: 'rgba(255,255,255,0.04)', margin: '2px 0' }} />

                        {/* ── PERIOD ── */}
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: '8px',
                            color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', fontWeight: 600,
                        }}>PERIOD</div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '36px', color: '#fff', lineHeight: 1 }}>
                                {currentPeriodLabel}
                            </div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em' }}>
                                {clock.period} / {clock.totalPeriods}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                            {/* Back */}
                            <div
                                onClick={canGoBack ? () => sendAction('EDIT_PERIOD', { amount: -1 }) : undefined}
                                style={{
                                    flex: 1, height: 36, borderRadius: '6px',
                                    border: `1px solid ${canGoBack ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`,
                                    background: canGoBack ? 'rgba(255,255,255,0.02)' : 'transparent',
                                    color: canGoBack ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)',
                                    fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 700,
                                    letterSpacing: '0.08em', textAlign: 'center',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: canGoBack ? 'pointer' : 'default', userSelect: 'none',
                                }}
                            >
                                ← BACK
                            </div>
                            {/* Next */}
                            {clock.period <= clock.totalPeriods && (
                                <div
                                    onClick={() => sendAction('NEXT_PERIOD', {})}
                                    style={{
                                        flex: 1, height: 36, borderRadius: '6px',
                                        border: '1px solid #F59E0B33', background: '#F59E0B08',
                                        color: '#F59E0B',
                                        fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 700,
                                        letterSpacing: '0.08em', textAlign: 'center',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', userSelect: 'none',
                                    }}
                                >
                                    NEXT →
                                </div>
                            )}
                            {/* OT */}
                            {clock.period >= clock.totalPeriods && (
                                <div
                                    onClick={() => sendAction('NEXT_PERIOD', { forceOT: true })}
                                    style={{
                                        flex: 1, height: 36, borderRadius: '6px',
                                        border: '1px solid #22C55E33', background: '#22C55E08',
                                        color: '#22C55E',
                                        fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 700,
                                        letterSpacing: '0.08em', textAlign: 'center',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', userSelect: 'none',
                                    }}
                                >
                                    + OT
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div style={{ width: '80%', height: 1, background: 'rgba(255,255,255,0.04)', margin: '2px 0' }} />

                        {/* ── POSSESSION ── */}
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: '8px',
                            color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', fontWeight: 600,
                        }}>POSSESSION</div>

                        <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                            <div
                                onClick={() => sendAction('SET_POSSESSION', { team: 'A' })}
                                style={{
                                    flex: 1, height: 40, borderRadius: '8px',
                                    border: `2px solid ${possession === 'A' ? teamAColor : 'rgba(255,255,255,0.06)'}`,
                                    background: possession === 'A' ? `${teamAColor}15` : 'rgba(255,255,255,0.02)',
                                    color: possession === 'A' ? teamAColor : 'rgba(255,255,255,0.25)',
                                    fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                                    fontSize: '12px', letterSpacing: '0.12em',
                                    textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {possession === 'A' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: teamAColor, boxShadow: `0 0 6px ${teamAColor}` }} />}
                                ▶ {teamA.name}
                            </div>
                            <div
                                onClick={() => sendAction('SET_POSSESSION', { team: 'B' })}
                                style={{
                                    flex: 1, height: 40, borderRadius: '8px',
                                    border: `2px solid ${possession === 'B' ? teamBColor : 'rgba(255,255,255,0.06)'}`,
                                    background: possession === 'B' ? `${teamBColor}15` : 'rgba(255,255,255,0.02)',
                                    color: possession === 'B' ? teamBColor : 'rgba(255,255,255,0.25)',
                                    fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                                    fontSize: '12px', letterSpacing: '0.12em',
                                    textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {teamB.name} ◀
                                {possession === 'B' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: teamBColor, boxShadow: `0 0 6px ${teamBColor}` }} />}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ width: '80%', height: 1, background: 'rgba(255,255,255,0.04)', margin: '2px 0' }} />

                        {/* ── BUZZER ── */}
                        <div
                            onClick={() => sendAction('TRIGGER_BUZZER', { type: 'SHORT' })}
                            style={{
                                width: '100%', height: 40, borderRadius: '8px',
                                background: 'linear-gradient(135deg, #1a0000, #2a0800)',
                                border: '1.5px solid #F9731644',
                                color: '#F97316',
                                fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                                fontWeight: 700, letterSpacing: '0.15em',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                cursor: 'pointer', userSelect: 'none',
                            }}
                            onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #2a0000, #4a1000)'; }}
                            onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #1a0000, #2a0800)'; }}
                        >
                            🔊 BUZZER
                        </div>
                    </div>
                </div>

                {/* ─── RIGHT: TEAM B ─── */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '12px 14px', gap: '10px',
                    position: 'relative',
                }}>
                    {/* Team color accent */}
                    <div style={{ position: 'absolute', right: 0, top: '10%', bottom: '10%', width: 3, background: `linear-gradient(to bottom, transparent, ${teamBColor}88, transparent)` }} />

                    {/* Name */}
                    <div style={{
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '13px', letterSpacing: '0.2em',
                        color: teamBColor, textTransform: 'uppercase',
                        borderBottom: `2px solid ${teamBColor}33`, paddingBottom: '4px',
                        width: '100%', textAlign: 'center',
                    }}>
                        {teamB.name}
                    </div>

                    {/* Score */}
                    <StatRow
                        label="SCORE" value={teamB.score}
                        onDecrement={() => sendAction('EDIT_SCORE', { team: 'teamB', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_SCORE', { team: 'teamB', amount: 1 })}
                        color={teamBColor} valueColor={teamBColor} valueFontSize="36px"
                    />
                    <StatRow
                        label="FOULS" value={teamB.fouls}
                        onDecrement={() => sendAction('EDIT_FOULS', { team: 'teamB', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_FOULS', { team: 'teamB', amount: 1 })}
                        color="#EF4444"
                    />
                    <StatRow
                        label="T.O." value={teamB.timeouts}
                        onDecrement={() => sendAction('EDIT_TIMEOUTS', { team: 'teamB', amount: -1 })}
                        onIncrement={() => sendAction('EDIT_TIMEOUTS', { team: 'teamB', amount: 1 })}
                        color="#F59E0B"
                    />

                    {/* Divider */}
                    <div style={{ width: '80%', height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />

                    {/* Quick Actions */}
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <div
                            onClick={() => sendAction('ADD_FOUL_B')}
                            style={{
                                flex: 1, height: 44, borderRadius: '8px',
                                background: '#EF444410', border: '1.5px solid #EF444433',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                                fontWeight: 700, color: '#EF4444', letterSpacing: '0.08em',
                                cursor: 'pointer', userSelect: 'none',
                            }}
                            onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = '#EF444420'; }}
                            onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = '#EF444410'; }}
                        >
                            + FOUL
                        </div>
                        <div
                            onClick={() => sendAction('TIMEOUT_B')}
                            style={{
                                flex: 1, height: 44, borderRadius: '8px',
                                background: '#F59E0B10', border: '1.5px solid #F59E0B33',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
                                fontWeight: 700, color: '#F59E0B', letterSpacing: '0.08em',
                                cursor: 'pointer', userSelect: 'none',
                                opacity: teamB.timeouts > 0 ? 1 : 0.3,
                            }}
                            onTouchStart={(e) => { if (teamB.timeouts > 0) (e.currentTarget as HTMLElement).style.background = '#F59E0B20'; }}
                            onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = '#F59E0B10'; }}
                        >
                            TIMEOUT
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes dotPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

export default SettingsPanel;