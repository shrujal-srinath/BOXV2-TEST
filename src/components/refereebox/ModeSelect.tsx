// src/components/referee/ModeSelect.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — GAME MODE SELECTION
// Two paths: Online (scan game from website) or Offline (standalone)
// Design: Two large cards, impossible to mis-tap on 7" screen
// Supports hardware-only navigation via selectedIndex prop
// ═══════════════════════════════════════════════════════════════

import React from 'react';

interface ModeSelectProps {
    onSelectOnline: () => void;
    onSelectOffline: () => void;
    isOnline: boolean;
    selectedIndex?: number; // 0 = online, 1 = offline — driven by hardware buttons
}

const ModeSelect: React.FC<ModeSelectProps> = ({ onSelectOnline, onSelectOffline, isOnline, selectedIndex }) => {
    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '20px 32px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #1a1a1a',
                flexShrink: 0,
            }}>
                <div>
                    <div style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontWeight: 700,
                        fontSize: '28px',
                        letterSpacing: '0.1em',
                        color: '#fff',
                    }}>
                        NEW GAME
                    </div>
                    <div style={{
                        fontFamily: "'Barlow', sans-serif",
                        fontSize: '13px',
                        color: '#555',
                        letterSpacing: '0.15em',
                        marginTop: '2px',
                    }}>
                        SELECT SETUP MODE
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '100px',
                    background: isOnline ? '#0a1a0a' : '#1a0a0a',
                    border: `1px solid ${isOnline ? '#1a3a1a' : '#3a1a1a'}`,
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isOnline ? '#22C55E' : '#EF4444',
                        animation: isOnline ? 'none' : 'dotPulse 2s infinite',
                    }} />
                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: isOnline ? '#22C55E' : '#EF4444',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                    }}>
                        {isOnline ? 'CLOUD CONNECTED' : 'NO INTERNET'}
                    </span>
                </div>
            </div>

            {/* Two mode cards */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                padding: '24px 32px',
            }}>
                {/* ONLINE CARD */}
                <div
                    onClick={isOnline ? onSelectOnline : undefined}
                    style={{
                        background: isOnline
                            ? 'linear-gradient(160deg, #0a1628 0%, #0a0f1a 100%)'
                            : '#0a0a0a',
                        outline: selectedIndex === 0 ? '3px solid #3B82F6' : 'none',
                        outlineOffset: '-3px',
                        border: `2px solid ${isOnline ? '#1a3a6a' : '#1a1a1a'}`,
                        borderRadius: '16px',
                        padding: '32px 28px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: isOnline ? 'pointer' : 'not-allowed',
                        opacity: isOnline ? 1 : 0.35,
                        transition: 'transform 0.1s ease, border-color 0.2s ease',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                    onTouchStart={(e) => {
                        if (isOnline) (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
                    }}
                    onTouchEnd={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                    }}
                >
                    {/* Glow accent */}
                    {isOnline && (
                        <div style={{
                            position: 'absolute',
                            top: '-40px',
                            right: '-40px',
                            width: '160px',
                            height: '160px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, #3B82F620 0%, transparent 70%)',
                            pointerEvents: 'none',
                        }} />
                    )}

                    <div>
                        {/* Icon */}
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            background: isOnline ? '#1a2a4a' : '#1a1a1a',
                            border: `1px solid ${isOnline ? '#2a4a7a' : '#2a2a2a'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '20px',
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isOnline ? '#3B82F6' : '#444'} strokeWidth="1.8">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>

                        <div style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontWeight: 700,
                            fontSize: '26px',
                            letterSpacing: '0.06em',
                            color: isOnline ? '#fff' : '#444',
                            marginBottom: '8px',
                        }}>
                            SCAN GAME
                        </div>

                        <div style={{
                            fontFamily: "'Barlow', sans-serif",
                            fontSize: '14px',
                            lineHeight: 1.5,
                            color: isOnline ? '#7a9ac4' : '#333',
                        }}>
                            Enter the 6-digit code from the website to import team names,
                            colors, rosters, and rules. Full cloud sync enabled.
                        </div>
                    </div>

                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: isOnline ? '#3a6aaa' : '#333',
                        letterSpacing: '0.1em',
                        paddingTop: '16px',
                        borderTop: `1px solid ${isOnline ? '#1a2a4a' : '#1a1a1a'}`,
                    }}>
                        TEAMS + RULES FROM WEBSITE →
                    </div>
                </div>

                {/* OFFLINE CARD */}
                <div
                    onClick={onSelectOffline}
                    style={{
                        background: 'linear-gradient(160deg, #1a1400 0%, #0f0d05 100%)',
                        border: '2px solid #3a3010',
                        outline: selectedIndex === 1 ? '3px solid #F59E0B' : 'none',
                        outlineOffset: '-3px',
                        borderRadius: '16px',
                        padding: '32px 28px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                    onTouchStart={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
                    }}
                    onTouchEnd={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                    }}
                >
                    {/* Glow accent */}
                    <div style={{
                        position: 'absolute',
                        top: '-40px',
                        right: '-40px',
                        width: '160px',
                        height: '160px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #F59E0B18 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    <div>
                        {/* Icon */}
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            background: '#2a2400',
                            border: '1px solid #4a4010',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '20px',
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                        </div>

                        <div style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontWeight: 700,
                            fontSize: '26px',
                            letterSpacing: '0.06em',
                            color: '#fff',
                            marginBottom: '8px',
                        }}>
                            OFFLINE GAME
                        </div>

                        <div style={{
                            fontFamily: "'Barlow', sans-serif",
                            fontSize: '14px',
                            lineHeight: 1.5,
                            color: '#9a8a5a',
                        }}>
                            Set up a standalone game right here. Enter team names
                            and rules manually. No internet required — works anywhere.
                        </div>
                    </div>

                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: '#6a5a2a',
                        letterSpacing: '0.1em',
                        paddingTop: '16px',
                        borderTop: '1px solid #2a2400',
                    }}>
                        FULLY STANDALONE →
                    </div>
                </div>
            </div>

            {/* Hardware navigation hint */}
            <div style={{
                height: '36px', flexShrink: 0,
                borderTop: '1px solid #1a1a1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px',
                background: '#050505',
            }}>
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px', color: '#333', letterSpacing: '0.1em',
                }}>
                    SCORE A / B = SELECT
                </span>
                <span style={{ color: '#1a1a1a' }}>•</span>
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px', color: '#333', letterSpacing: '0.1em',
                }}>
                    SHOT CLOCK = ENTER
                </span>
                <span style={{ color: '#1a1a1a' }}>•</span>
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px', color: '#333', letterSpacing: '0.1em',
                }}>
                    HOLD SETTINGS = QUICK GAME
                </span>
            </div>
        </div>
    );
};

export default ModeSelect;