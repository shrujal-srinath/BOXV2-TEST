// src/components/refereebox/UnlockedSettings.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — SETTINGS / MANUAL OVERRIDE MODE v2
//
// Accessible ONLY when physical SETTINGS button is pressed.
// Orange border = visual alarm that touch is active.
//
// New in v2:
//   - Period navigation panel (next / back / add OT)
//   - Possession toggle
//   - End Game moved to dedicated confirmation screen in RefereeScreen
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

// ── Touch adjustment button ──────────────────────────────────
const AdjustBtn: React.FC<{
    label: string;
    onClick: () => void;
    color: string;
    size?: 'normal' | 'large';
    danger?: boolean;
}> = ({ label, onClick, color, size = 'normal', danger = false }) => (
    <div
        onClick={onClick}
        style={{
            width: size === 'large' ? '52px' : '40px',
            height: size === 'large' ? '52px' : '40px',
            background: danger ? '#1a0000' : '#111',
            border: `1.5px solid ${danger ? '#5a0000' : '#2a2a2a'}`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: danger ? '#EF4444' : color,
            fontFamily: "'Barlow', sans-serif",
            fontSize: size === 'large' ? '22px' : '18px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'transform 0.08s, background 0.1s',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
        }}
        onTouchStart={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.88)';
        }}
        onTouchEnd={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >
        {label}
    </div>
);

// ── Stat row ──────────────────────────────────────────────────
const StatRow: React.FC<{
    label: string;
    value: number | string;
    onDecrement: () => void;
    onIncrement: () => void;
    color: string;
    valueColor?: string;
    valueFontSize?: string;
}> = ({ label, value, onDecrement, onIncrement, color, valueColor = '#fff', valueFontSize = '28px' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px', color: '#555',
            letterSpacing: '0.12em', width: '56px', textAlign: 'right',
        }}>
            {label}
        </div>
        <AdjustBtn label="−" onClick={onDecrement} color={color} />
        <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, fontSize: valueFontSize,
            color: valueColor, minWidth: '56px',
            textAlign: 'center', fontVariantNumeric: 'tabular-nums',
        }}>
            {value}
        </div>
        <AdjustBtn label="+" onClick={onIncrement} color={color} />
    </div>
);

// ── Team column ───────────────────────────────────────────────
const TeamColumn: React.FC<{
    team: TeamState;
    color: string;
    sendAction: (type: string, payload?: Record<string, unknown>) => void;
    teamKey: 'teamA' | 'teamB';
}> = ({ team, color, sendAction, teamKey }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', flex: 1 }}>
        <div style={{
            fontFamily: "'Oswald', sans-serif", fontWeight: 700,
            fontSize: '13px', letterSpacing: '0.2em',
            color, textTransform: 'uppercase',
            borderBottom: `2px solid ${color}33`, paddingBottom: '6px', width: '100%', textAlign: 'center',
        }}>
            {team.name}
        </div>
        <StatRow
            label="SCORE" value={team.score}
            onDecrement={() => sendAction('EDIT_SCORE', { team: teamKey, amount: -1 })}
            onIncrement={() => sendAction('EDIT_SCORE', { team: teamKey, amount: 1 })}
            color={color} valueColor={color} valueFontSize="32px"
        />
        <StatRow
            label="FOULS" value={team.fouls}
            onDecrement={() => sendAction('EDIT_FOULS', { team: teamKey, amount: -1 })}
            onIncrement={() => sendAction('EDIT_FOULS', { team: teamKey, amount: 1 })}
            color="#EF4444"
        />
        <StatRow
            label="T.O." value={team.timeouts}
            onDecrement={() => sendAction('EDIT_TIMEOUTS', { team: teamKey, amount: -1 })}
            onIncrement={() => sendAction('EDIT_TIMEOUTS', { team: teamKey, amount: 1 })}
            color="#F59E0B"
        />
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
    // Which sub-panel is open in the center column
    type CenterTab = 'clocks' | 'period' | 'possession';
    const [centerTab, setCenterTab] = useState<CenterTab>('clocks');

    const currentPeriodLabel = getPeriodLabel(clock.period, clock.totalPeriods);
    const isOT = clock.period > clock.totalPeriods;
    const canGoBack = clock.period > 1;

    const handleNextPeriod = () => {
        sendAction('NEXT_PERIOD', {});
    };

    const handlePrevPeriod = () => {
        if (canGoBack) sendAction('EDIT_PERIOD', { amount: -1 });
    };

    const handleAddOT = () => {
        // Advance past totalPeriods into OT
        sendAction('NEXT_PERIOD', { forceOT: true });
    };

    const handleSetPossession = (team: 'A' | 'B') => {
        sendAction('SET_POSSESSION', { team });
    };

    return (
        <div style={{
            width: '100vw', height: '100vh', background: '#000',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '3px solid #F97316',
        }}>

            {/* ── WARNING HEADER ── */}
            <div style={{
                height: '40px',
                background: 'linear-gradient(90deg, #1a0800 0%, #2a1400 50%, #1a0800 100%)',
                borderBottom: '2px solid #F97316',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 20px', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: '#F97316', animation: 'dotPulse 1s infinite',
                    }} />
                    <span style={{
                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                        fontSize: '14px', letterSpacing: '0.2em', color: '#F97316',
                    }}>
                        MANUAL OVERRIDE — TOUCH ACTIVE
                    </span>
                </div>

                {/* End Game button — top right corner */}
                <div
                    onClick={onEndGame}
                    style={{
                        padding: '4px 16px', border: '1px solid #5a0000',
                        borderRadius: '6px', background: '#1a0000',
                        color: '#EF4444', fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
                        cursor: 'pointer', userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
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
                gridTemplateColumns: '1fr 260px 1fr',
                gap: '0',
                overflow: 'hidden',
            }}>

                {/* LEFT — Team A */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '16px 20px',
                    borderRight: '1px solid #1a1a1a',
                }}>
                    <TeamColumn team={teamA} color={teamAColor} sendAction={sendAction} teamKey="teamA" />
                </div>

                {/* CENTER — tabs: clocks / period / possession */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid #1a1a1a',
                }}>

                    {/* Tab bar */}
                    <div style={{
                        display: 'flex', borderBottom: '1px solid #1a1a1a',
                        flexShrink: 0,
                    }}>
                        {(['clocks', 'period', 'possession'] as CenterTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setCenterTab(tab)}
                                style={{
                                    flex: 1, padding: '10px 0',
                                    background: centerTab === tab ? '#111' : 'transparent',
                                    border: 'none',
                                    borderBottom: centerTab === tab ? '2px solid #F97316' : '2px solid transparent',
                                    color: centerTab === tab ? '#fff' : '#444',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '9px', fontWeight: 700,
                                    letterSpacing: '0.12em', textTransform: 'uppercase',
                                    cursor: 'pointer',
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '16px', gap: '14px',
                    }}>

                        {/* ── CLOCKS TAB ── */}
                        {centerTab === 'clocks' && (
                            <>
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
                                <div style={{ height: '1px', width: '80%', background: '#1a1a1a' }} />
                                <div style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '9px', color: '#333', letterSpacing: '0.1em',
                                }}>
                                    ± 1 SECOND PER TAP
                                </div>
                            </>
                        )}

                        {/* ── PERIOD TAB ── */}
                        {centerTab === 'period' && (
                            <>
                                {/* Current period display */}
                                <div style={{
                                    fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                                    fontSize: '48px', color: '#fff', letterSpacing: '0.05em',
                                    lineHeight: 1,
                                }}>
                                    {currentPeriodLabel}
                                </div>
                                <div style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '9px', color: '#333', letterSpacing: '0.15em',
                                }}>
                                    PERIOD {clock.period} OF {clock.totalPeriods}
                                </div>

                                <div style={{ height: '1px', width: '80%', background: '#1a1a1a' }} />

                                {/* Navigation buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>

                                    {/* Back */}
                                    <div
                                        onClick={handlePrevPeriod}
                                        style={{
                                            padding: '12px', borderRadius: '8px',
                                            border: `1px solid ${canGoBack ? '#2a2a2a' : '#111'}`,
                                            background: canGoBack ? '#0a0a0a' : 'transparent',
                                            color: canGoBack ? '#888' : '#222',
                                            fontFamily: "'JetBrains Mono', monospace",
                                            fontSize: '11px', fontWeight: 700,
                                            letterSpacing: '0.1em', textAlign: 'center',
                                            cursor: canGoBack ? 'pointer' : 'default',
                                            userSelect: 'none',
                                        }}
                                        onTouchStart={(e) => {
                                            if (canGoBack) (e.currentTarget as HTMLElement).style.background = '#1a1a1a';
                                        }}
                                        onTouchEnd={(e) => {
                                            if (canGoBack) (e.currentTarget as HTMLElement).style.background = '#0a0a0a';
                                        }}
                                    >
                                        ← BACK TO {canGoBack ? getPeriodLabel(clock.period - 1, clock.totalPeriods) : '—'}
                                    </div>

                                    {/* Next period (only if not past totalPeriods) */}
                                    {clock.period <= clock.totalPeriods && (
                                        <div
                                            onClick={handleNextPeriod}
                                            style={{
                                                padding: '12px', borderRadius: '8px',
                                                border: '1px solid #F59E0B44',
                                                background: '#1a1000',
                                                color: '#F59E0B',
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: '11px', fontWeight: 700,
                                                letterSpacing: '0.1em', textAlign: 'center',
                                                cursor: 'pointer', userSelect: 'none',
                                            }}
                                            onTouchStart={(e) => {
                                                (e.currentTarget as HTMLElement).style.background = '#2a1800';
                                            }}
                                            onTouchEnd={(e) => {
                                                (e.currentTarget as HTMLElement).style.background = '#1a1000';
                                            }}
                                        >
                                            NEXT → {getPeriodLabel(clock.period + 1, clock.totalPeriods)}
                                        </div>
                                    )}

                                    {/* Add OT (only shown when at or past totalPeriods) */}
                                    {clock.period >= clock.totalPeriods && (
                                        <div
                                            onClick={handleAddOT}
                                            style={{
                                                padding: '12px', borderRadius: '8px',
                                                border: '1px solid #22C55E44',
                                                background: '#001a08',
                                                color: '#22C55E',
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: '11px', fontWeight: 700,
                                                letterSpacing: '0.1em', textAlign: 'center',
                                                cursor: 'pointer', userSelect: 'none',
                                            }}
                                            onTouchStart={(e) => {
                                                (e.currentTarget as HTMLElement).style.background = '#002812';
                                            }}
                                            onTouchEnd={(e) => {
                                                (e.currentTarget as HTMLElement).style.background = '#001a08';
                                            }}
                                        >
                                            + ADD OVERTIME
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '8px', color: '#222', letterSpacing: '0.1em',
                                    textAlign: 'center',
                                }}>
                                    FOULS RESET ON NEXT PERIOD
                                </div>
                            </>
                        )}

                        {/* ── POSSESSION TAB ── */}
                        {centerTab === 'possession' && (
                            <>
                                <div style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '10px', color: '#444', letterSpacing: '0.15em',
                                }}>
                                    POSSESSION ARROW
                                </div>

                                <div style={{
                                    fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                                    fontSize: '14px', letterSpacing: '0.1em', color: '#555',
                                    textAlign: 'center',
                                }}>
                                    {possession === 'A'
                                        ? `▶  ${teamA.name}`
                                        : possession === 'B'
                                            ? `${teamB.name}  ◀`
                                            : 'NOT SET'}
                                </div>

                                <div style={{ height: '1px', width: '80%', background: '#1a1a1a' }} />

                                {/* Team A possession */}
                                <div
                                    onClick={() => handleSetPossession('A')}
                                    style={{
                                        width: '100%', padding: '14px 12px',
                                        borderRadius: '8px',
                                        border: `2px solid ${possession === 'A' ? teamAColor : '#1a1a1a'}`,
                                        background: possession === 'A' ? `${teamAColor}15` : '#0a0a0a',
                                        color: possession === 'A' ? teamAColor : '#444',
                                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                                        fontSize: '14px', letterSpacing: '0.15em',
                                        textAlign: 'center', cursor: 'pointer',
                                        userSelect: 'none', transition: 'all 0.15s',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                >
                                    ▶  {teamA.name}
                                </div>

                                {/* Team B possession */}
                                <div
                                    onClick={() => handleSetPossession('B')}
                                    style={{
                                        width: '100%', padding: '14px 12px',
                                        borderRadius: '8px',
                                        border: `2px solid ${possession === 'B' ? teamBColor : '#1a1a1a'}`,
                                        background: possession === 'B' ? `${teamBColor}15` : '#0a0a0a',
                                        color: possession === 'B' ? teamBColor : '#444',
                                        fontFamily: "'Oswald', sans-serif", fontWeight: 700,
                                        fontSize: '14px', letterSpacing: '0.15em',
                                        textAlign: 'center', cursor: 'pointer',
                                        userSelect: 'none', transition: 'all 0.15s',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}
                                >
                                    {teamB.name}  ◀
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* RIGHT — Team B */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '16px 20px',
                }}>
                    <TeamColumn team={teamB} color={teamBColor} sendAction={sendAction} teamKey="teamB" />
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