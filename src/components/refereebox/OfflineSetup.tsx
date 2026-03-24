// src/components/referee/OfflineSetup.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — OFFLINE GAME SETUP
// Quick form: team names + rules. Designed so the on-screen keyboard
// doesn't obscure the active input (fields are at top of screen).
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

interface OfflineSetupProps {
    onConfirm: (config: GameConfig) => void;
    onBack: () => void;
}

const COLOR_PRESETS = [
    { label: 'Blue', value: '#3B82F6' },
    { label: 'Red', value: '#EF4444' },
    { label: 'Green', value: '#22C55E' },
    { label: 'Purple', value: '#8B5CF6' },
    { label: 'Orange', value: '#F97316' },
    { label: 'Cyan', value: '#06B6D4' },
    { label: 'Pink', value: '#EC4899' },
    { label: 'Yellow', value: '#EAB308' },
];

const PERIOD_OPTIONS = [
    { label: '5 MIN', value: 5 },
    { label: '8 MIN', value: 8 },
    { label: '10 MIN', value: 10 },
    { label: '12 MIN', value: 12 },
];

const OfflineSetup: React.FC<OfflineSetupProps> = ({ onConfirm, onBack }) => {
    const [config, setConfig] = useState<GameConfig>({
        teamAName: '',
        teamBName: '',
        teamAColor: '#3B82F6',
        teamBColor: '#EF4444',
        periodMinutes: 10,
        shotClockSeconds: 24,
        periods: 4,
    });

    const isValid = config.teamAName.trim().length > 0 && config.teamBName.trim().length > 0;

    const inputStyle: React.CSSProperties = {
        width: '100%',
        height: '52px',
        background: '#111',
        border: '2px solid #2a2a2a',
        borderRadius: '10px',
        color: '#fff',
        fontFamily: "'Oswald', sans-serif",
        fontSize: '22px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '0 16px',
        outline: 'none',
        textAlign: 'center',
    };

    return (
        <div style={{
            width: '1024px',
            height: '600px',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
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
                        letterSpacing: '0.05em',
                    }}
                >
                    ← BACK
                </div>
                <div style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: '22px',
                    letterSpacing: '0.1em',
                    color: '#F59E0B',
                }}>
                    OFFLINE SETUP
                </div>
                <div style={{ width: '60px' }} />
            </div>

            {/* Form body */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: 0,
                padding: '20px 32px',
                overflow: 'hidden',
            }}>
                {/* TEAM A */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: '#555',
                        letterSpacing: '0.15em',
                    }}>
                        TEAM A (LEFT)
                    </div>

                    <input
                        type="text"
                        placeholder="TEAM NAME"
                        value={config.teamAName}
                        onChange={(e) => setConfig({ ...config, teamAName: e.target.value.slice(0, 12) })}
                        style={{
                            ...inputStyle,
                            borderColor: config.teamAColor + '60',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = config.teamAColor; }}
                        onBlur={(e) => { e.target.style.borderColor = config.teamAColor + '60'; }}
                        maxLength={12}
                        autoComplete="off"
                    />

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {COLOR_PRESETS.map((c) => (
                            <div
                                key={c.value + 'A'}
                                onClick={() => setConfig({ ...config, teamAColor: c.value })}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    background: c.value,
                                    border: config.teamAColor === c.value ? '3px solid #fff' : '3px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'border 0.15s',
                                    opacity: config.teamAColor === c.value ? 1 : 0.5,
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* VS divider */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 28px',
                }}>
                    <div style={{
                        width: '1px',
                        height: '40px',
                        background: '#1a1a1a',
                    }} />
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '28px',
                        color: '#2a2a2a',
                        margin: '12px 0',
                    }}>
                        VS
                    </div>
                    <div style={{
                        width: '1px',
                        height: '40px',
                        background: '#1a1a1a',
                    }} />
                </div>

                {/* TEAM B */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: '#555',
                        letterSpacing: '0.15em',
                    }}>
                        TEAM B (RIGHT)
                    </div>

                    <input
                        type="text"
                        placeholder="TEAM NAME"
                        value={config.teamBName}
                        onChange={(e) => setConfig({ ...config, teamBName: e.target.value.slice(0, 12) })}
                        style={{
                            ...inputStyle,
                            borderColor: config.teamBColor + '60',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = config.teamBColor; }}
                        onBlur={(e) => { e.target.style.borderColor = config.teamBColor + '60'; }}
                        maxLength={12}
                        autoComplete="off"
                    />

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {COLOR_PRESETS.map((c) => (
                            <div
                                key={c.value + 'B'}
                                onClick={() => setConfig({ ...config, teamBColor: c.value })}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    background: c.value,
                                    border: config.teamBColor === c.value ? '3px solid #fff' : '3px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'border 0.15s',
                                    opacity: config.teamBColor === c.value ? 1 : 0.5,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Rules row */}
            <div style={{
                padding: '0 32px 12px',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-end',
                flexShrink: 0,
            }}>
                {/* Period duration */}
                <div style={{ flex: 1 }}>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px',
                        color: '#555',
                        letterSpacing: '0.15em',
                        marginBottom: '8px',
                    }}>
                        PERIOD LENGTH
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {PERIOD_OPTIONS.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => setConfig({ ...config, periodMinutes: opt.value })}
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    background: config.periodMinutes === opt.value ? '#1a2a1a' : '#111',
                                    border: `1.5px solid ${config.periodMinutes === opt.value ? '#22C55E' : '#222'}`,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: config.periodMinutes === opt.value ? '#22C55E' : '#555',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shot clock */}
                <div>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px',
                        color: '#555',
                        letterSpacing: '0.15em',
                        marginBottom: '8px',
                    }}>
                        SHOT CLOCK
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[24, 30].map((sec) => (
                            <div
                                key={sec}
                                onClick={() => setConfig({ ...config, shotClockSeconds: sec })}
                                style={{
                                    width: '64px',
                                    height: '44px',
                                    background: config.shotClockSeconds === sec ? '#1a1a00' : '#111',
                                    border: `1.5px solid ${config.shotClockSeconds === sec ? '#F59E0B' : '#222'}`,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: config.shotClockSeconds === sec ? '#F59E0B' : '#555',
                                    cursor: 'pointer',
                                }}
                            >
                                {sec}s
                            </div>
                        ))}
                    </div>
                </div>

                {/* Periods */}
                <div>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px',
                        color: '#555',
                        letterSpacing: '0.15em',
                        marginBottom: '8px',
                    }}>
                        PERIODS
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[2, 4].map((p) => (
                            <div
                                key={p}
                                onClick={() => setConfig({ ...config, periods: p })}
                                style={{
                                    width: '52px',
                                    height: '44px',
                                    background: config.periods === p ? '#0a1a2a' : '#111',
                                    border: `1.5px solid ${config.periods === p ? '#3B82F6' : '#222'}`,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: config.periods === p ? '#3B82F6' : '#555',
                                    cursor: 'pointer',
                                }}
                            >
                                {p === 2 ? '2H' : '4Q'}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Start button */}
            <div style={{
                padding: '12px 32px 20px',
                borderTop: '1px solid #1a1a1a',
                flexShrink: 0,
            }}>
                <div
                    onClick={isValid ? () => onConfirm(config) : undefined}
                    style={{
                        width: '100%',
                        height: '56px',
                        background: isValid
                            ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                            : '#1a1a1a',
                        borderRadius: '12px',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: isValid ? 'pointer' : 'not-allowed',
                        transition: 'transform 0.1s, opacity 0.2s',
                        opacity: isValid ? 1 : 0.3,
                    }}
                    onTouchStart={(e) => {
                        if (isValid) (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
                    }}
                    onTouchEnd={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                    }}
                >
                    <span style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '20px',
                        letterSpacing: '0.15em',
                        color: isValid ? '#fff' : '#444',
                    }}>
                        CONFIRM SETUP
                    </span>
                    <span style={{
                        fontSize: '20px',
                        color: isValid ? '#fff' : '#444',
                    }}>
                        →
                    </span>
                </div>
            </div>
        </div>
    );
};

export default OfflineSetup;