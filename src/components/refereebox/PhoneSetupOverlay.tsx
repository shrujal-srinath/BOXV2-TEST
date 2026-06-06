// src/components/refereebox/PhoneSetupOverlay.tsx
// Full-screen kiosk overlay shown while a phone is controlling setup.
// Pure prop-driven — no internal state. Updates live as config-update events arrive.

import React from 'react';
import type { GameConfig } from '../../hooks/useRefereeBox';

interface PhoneSetupOverlayProps {
    liveConfig: Partial<GameConfig>;
    tvCode: string;
    onCancel: () => void;
}

const BG      = '#080808';
const CARD    = '#161616';
const BDR     = '#333333';
const RED     = '#DC2626';
const BLUE    = '#3B82F6';
const TXT     = '#F0F0F0';
const TXT_DIM = '#888888';
const TXT_MUT = '#444444';
const RM      = "'JetBrains Mono', monospace";
const OSW     = "'Oswald', sans-serif";
const SG      = "'Space Grotesk', sans-serif";

const MODE_LABELS: Record<string, string> = {
    quick: 'QUICK',
    stats: 'STATS',
    advanced: 'ADVANCED',
};

const PhoneSetupOverlay: React.FC<PhoneSetupOverlayProps> = ({ liveConfig, tvCode, onCancel }) => {
    const { gameMode, teamAName, teamBName, teamAColor, teamBColor, periods, periodMinutes, shotClockSeconds } = liveConfig;

    const hasTeams = teamAName || teamBName;
    const hasParams = periods && periodMinutes;

    return (
        <>
            <style>{`
                @keyframes overlayPulse {
                    0%,100% { border-color: ${RED}; box-shadow: 0 0 0 0 rgba(220,38,38,0); }
                    50%     { border-color: #222;   box-shadow: 0 0 32px rgba(220,38,38,0.12); }
                }
                @keyframes pipPulse {
                    0%,100% { opacity: 1; }
                    50%     { opacity: 0.25; }
                }
                @keyframes dotBounce {
                    0%,80%,100% { transform: scale(0.7); opacity: 0.35; }
                    40%         { transform: scale(1); opacity: 1; }
                }
            `}</style>

            <div style={{
                position: 'fixed', inset: 0,
                background: BG,
                border: `2px solid ${RED}`,
                animation: 'overlayPulse 2s ease-in-out infinite',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden', userSelect: 'none',
                fontFamily: RM,
            }}>

                {/* ── Header ── */}
                <div style={{
                    height: 36, flexShrink: 0,
                    borderBottom: `1px solid ${BDR}`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 8, height: 8, background: RED,
                            animation: 'pipPulse 1.2s ease-in-out infinite', flexShrink: 0,
                        }} />
                        <span style={{
                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                            fontSize: 14, color: RED, letterSpacing: '0.05em', textTransform: 'uppercase',
                        }}>
                            SETUP IN PROGRESS
                        </span>
                        <span style={{ color: BDR, fontSize: 10 }}>·</span>
                        <span style={{ fontFamily: RM, fontSize: 9, color: TXT_DIM, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                            CONTROLLED FROM PHONE
                        </span>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{
                            background: 'none', border: `1px solid ${BDR}`, cursor: 'pointer',
                            fontFamily: RM, fontSize: 9, color: TXT_MUT,
                            letterSpacing: '0.15em', textTransform: 'uppercase',
                            padding: '4px 12px', borderRadius: 0,
                        }}
                    >
                        CANCEL
                    </button>
                </div>

                {/* ── Main content ── */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 24, padding: '24px 32px',
                }}>

                    {/* Mode badge */}
                    {gameMode && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            border: `1px solid ${RED}`, background: 'rgba(220,38,38,0.1)',
                            padding: '5px 18px',
                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                            fontSize: 13, color: RED, letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                        }}>
                            {MODE_LABELS[gameMode] ?? gameMode.toUpperCase()}
                        </div>
                    )}

                    {/* Teams preview */}
                    {hasTeams && (
                        <div style={{
                            border: `1px solid ${BDR}`, background: CARD,
                            width: '100%', maxWidth: 480,
                        }}>
                            {/* Team A */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 16px',
                                borderBottom: `1px solid ${BDR}`,
                            }}>
                                <div style={{
                                    width: 20, height: 20, flexShrink: 0,
                                    background: teamAColor ?? '#555',
                                    border: `1px solid rgba(255,255,255,0.15)`,
                                }} />
                                <span style={{
                                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                    fontSize: 15, color: teamAName ? TXT : TXT_MUT,
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>
                                    {teamAName || '—'}
                                </span>
                                <span style={{ marginLeft: 'auto', fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.2em' }}>
                                    TEAM A
                                </span>
                            </div>
                            {/* Team B */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 16px',
                            }}>
                                <div style={{
                                    width: 20, height: 20, flexShrink: 0,
                                    background: teamBColor ?? '#555',
                                    border: `1px solid rgba(255,255,255,0.15)`,
                                }} />
                                <span style={{
                                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                    fontSize: 15, color: teamBName ? TXT : TXT_MUT,
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>
                                    {teamBName || '—'}
                                </span>
                                <span style={{ marginLeft: 'auto', fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.2em' }}>
                                    TEAM B
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Match params summary */}
                    {hasParams && (
                        <div style={{
                            fontFamily: RM, fontSize: 10, color: TXT_DIM,
                            letterSpacing: '0.28em', textTransform: 'uppercase',
                        }}>
                            {periods}×{periodMinutes} MIN
                            {shotClockSeconds ? ` · ${shotClockSeconds}S CLOCK` : ' · NO CLOCK'}
                        </div>
                    )}

                    {/* No data yet — show waiting message */}
                    {!hasTeams && !gameMode && (
                        <div style={{
                            fontFamily: RM, fontSize: 10, color: TXT_MUT,
                            letterSpacing: '0.28em', textTransform: 'uppercase',
                        }}>
                            WAITING FOR PHONE INPUT…
                        </div>
                    )}

                    {/* Bouncing dots */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: 6, height: 6, background: RED,
                                animation: `dotBounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                            }} />
                        ))}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div style={{
                    height: 44, flexShrink: 0,
                    borderTop: `1px solid ${BDR}`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '0 20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            border: `1px solid ${BLUE}`, background: 'rgba(59,130,246,0.07)',
                            padding: '3px 12px',
                        }}>
                            <div style={{ width: 6, height: 6, background: BLUE, flexShrink: 0 }} />
                            <span style={{ fontFamily: RM, fontSize: 9, color: TXT_DIM, letterSpacing: '0.2em' }}>
                                TV&nbsp;<span style={{ color: TXT, fontWeight: 600 }}>{tvCode.toUpperCase()}</span>
                            </span>
                        </div>
                    </div>
                    <span style={{
                        fontFamily: SG, fontSize: 9, color: TXT_MUT,
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                    }}>
                        WAITING FOR CONFIRMATION…
                    </span>
                </div>

            </div>
        </>
    );
};

export default PhoneSetupOverlay;
