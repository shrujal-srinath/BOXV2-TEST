// src/components/refereebox/PiDashboard.tsx
// THE BOX — Pi Dashboard (navy / red / white / blue theme)
// Hardware: SCORE A = highlight WATCH, SCORE B = highlight START, SHOT CLOCK = confirm.

import React, { useState } from 'react';

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;1,700;1,800&family=JetBrains+Mono:wght@400;600;700&display=swap');

@keyframes db-top-pulse-red {
  0%, 100% { opacity: 1; box-shadow: 0 0 12px 2px #DC262640; }
  50%       { opacity: 0.85; box-shadow: 0 0 24px 4px #DC262660; }
}
@keyframes db-top-pulse-blue {
  0%, 100% { opacity: 1; box-shadow: 0 0 12px 2px #3B82F640; }
  50%       { opacity: 0.85; box-shadow: 0 0 24px 4px #3B82F660; }
}
@keyframes db-scan {
  0%   { top: -2px; }
  100% { top: 100%; }
}
@keyframes db-badge-in {
  from { opacity: 0; transform: scale(0.7); }
  to   { opacity: 1; transform: scale(1); }
}
`;

interface PiDashboardProps {
    onSelectWatch: () => void;
    onSelectStart: () => void;
    selectedIndex?: number; // 0 = watch, 1 = start (default)
}

const PiDashboard: React.FC<PiDashboardProps> = ({
    onSelectWatch,
    onSelectStart,
    selectedIndex = 1,
}) => {
    const [pressed, setPressed] = useState<0 | 1 | null>(null);

    const handleSelect = (idx: 0 | 1) => {
        setPressed(idx);
        setTimeout(() => {
            setPressed(null);
            if (idx === 0) onSelectWatch();
            else onSelectStart();
        }, 130);
    };

    const watchSel = selectedIndex === 0;
    const startSel = selectedIndex === 1;

    const NAVY      = '#0F1F35';
    const NAVY_CARD = '#0a1728';
    const BLUE      = '#3B82F6';
    const RED       = '#DC2626';
    const WHITE     = '#FFFFFF';
    const DIM       = '#1a2a3a';

    return (
        <>
            <style>{FONT_CSS}</style>
            <div style={{
                width: '100vw',
                height: '100vh',
                background: NAVY,
                backgroundImage: [
                    `radial-gradient(ellipse at 20% 50%, ${BLUE}08 0%, transparent 55%)`,
                    `radial-gradient(ellipse at 80% 50%, ${RED}08 0%, transparent 55%)`,
                ].join(', '),
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontFamily: "'Barlow Condensed', sans-serif",
                userSelect: 'none',
            }}>

                {/* ── Header ── */}
                <div style={{
                    flexShrink: 0,
                    height: 46,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 28px',
                    borderBottom: `1px solid #ffffff0e`,
                    background: `${NAVY_CARD}cc`,
                    backdropFilter: 'blur(8px)',
                }}>
                    {/* Wordmark */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 6,
                            height: 22,
                            borderRadius: 3,
                            background: `linear-gradient(to bottom, ${RED}, ${BLUE})`,
                            flexShrink: 0,
                        }} />
                        <span style={{
                            fontWeight: 800,
                            fontStyle: 'italic',
                            fontSize: 18,
                            letterSpacing: '0.12em',
                            color: WHITE,
                            textTransform: 'uppercase',
                        }}>
                            THE BOX
                        </span>
                    </div>

                    {/* Device label */}
                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        letterSpacing: '0.25em',
                        color: '#ffffff22',
                        textTransform: 'uppercase',
                    }}>
                        TABLETOP UNIT
                    </span>
                </div>

                {/* ── Cards row ── */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>

                    {/* Center divider */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: `linear-gradient(to bottom, transparent, #ffffff14 20%, #ffffff14 80%, transparent)`,
                        zIndex: 3,
                        transform: 'translateX(-50%)',
                        pointerEvents: 'none',
                    }} />

                    {/* ── WATCH card (left, blue) ── */}
                    <div
                        onClick={() => handleSelect(0)}
                        onTouchStart={() => setPressed(0)}
                        onTouchEnd={() => handleSelect(0)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: watchSel
                                ? `linear-gradient(170deg, #0d1e38 0%, #071428 100%)`
                                : `#07101c`,
                            transform: pressed === 0 ? 'scale(0.983)' : 'scale(1)',
                            transition: 'background 220ms ease, transform 100ms ease',
                        }}
                    >
                        {/* Top accent bar */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0,
                            height: 4,
                            background: BLUE,
                            opacity: watchSel ? 1 : 0.12,
                            transition: 'opacity 220ms ease',
                            animation: watchSel ? 'db-top-pulse-blue 2.8s ease-in-out infinite' : 'none',
                        }} />

                        {/* Radial glow behind icon */}
                        <div style={{
                            position: 'absolute',
                            top: '38%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 280,
                            height: 280,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${BLUE}${watchSel ? '12' : '05'} 0%, transparent 70%)`,
                            pointerEvents: 'none',
                            transition: 'background 220ms ease',
                        }} />

                        {/* Scan line */}
                        {watchSel && (
                            <div style={{
                                position: 'absolute',
                                left: 0, right: 0,
                                height: 1,
                                background: `linear-gradient(90deg, transparent, ${BLUE}28, transparent)`,
                                animation: 'db-scan 3.2s linear infinite',
                                pointerEvents: 'none',
                            }} />
                        )}

                        {/* Icon container */}
                        <div style={{
                            width: 60,
                            height: 60,
                            borderRadius: 16,
                            background: watchSel ? `${BLUE}18` : `#ffffff06`,
                            border: `1.5px solid ${watchSel ? `${BLUE}40` : '#ffffff0a'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 220ms ease',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                                stroke={watchSel ? BLUE : '#ffffff18'}
                                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                                style={{ transition: 'stroke 220ms ease' }}>
                                <path d="M2 12C4.5 7 8 4.5 12 4.5S19.5 7 22 12c-2.5 5-6 7.5-10 7.5S4.5 17 2 12z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </div>

                        {/* Big label */}
                        <div style={{
                            fontWeight: 800,
                            fontStyle: 'italic',
                            fontSize: 96,
                            lineHeight: 0.9,
                            color: watchSel ? WHITE : '#ffffff14',
                            letterSpacing: '-0.01em',
                            transition: 'color 220ms ease',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            WATCH
                        </div>

                        {/* Subtitle */}
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: 10,
                            letterSpacing: '0.3em',
                            color: watchSel ? `${BLUE}cc` : '#ffffff18',
                            textTransform: 'uppercase',
                            transition: 'color 220ms ease',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            RECEIVE &amp; DISPLAY
                        </div>

                        {/* Description */}
                        <div style={{
                            fontWeight: 400,
                            fontSize: 13,
                            color: watchSel ? '#ffffff55' : '#ffffff10',
                            textAlign: 'center',
                            letterSpacing: '0.06em',
                            lineHeight: 1.45,
                            maxWidth: 190,
                            transition: 'color 220ms ease',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            Watch a live game<br />cast to this screen
                        </div>

                        {/* SELECTED badge */}
                        {watchSel && (
                            <div style={{
                                position: 'absolute',
                                top: 16, right: 16,
                                padding: '4px 12px',
                                borderRadius: 20,
                                background: `${BLUE}18`,
                                border: `1px solid ${BLUE}40`,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 8,
                                fontWeight: 700,
                                color: BLUE,
                                letterSpacing: '0.18em',
                                zIndex: 2,
                                animation: 'db-badge-in 0.2s ease-out',
                            }}>
                                SELECTED
                            </div>
                        )}

                        {/* Bottom color bar (selected) */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0, left: 0, right: 0,
                            height: 3,
                            background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)`,
                            opacity: watchSel ? 0.6 : 0,
                            transition: 'opacity 220ms ease',
                        }} />
                    </div>

                    {/* ── START card (right, red) ── */}
                    <div
                        onClick={() => handleSelect(1)}
                        onTouchStart={() => setPressed(1)}
                        onTouchEnd={() => handleSelect(1)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: startSel
                                ? `linear-gradient(170deg, #1e0d0d 0%, #150808 100%)`
                                : `#100707`,
                            transform: pressed === 1 ? 'scale(0.983)' : 'scale(1)',
                            transition: 'background 220ms ease, transform 100ms ease',
                        }}
                    >
                        {/* Top accent bar */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0,
                            height: 4,
                            background: RED,
                            opacity: startSel ? 1 : 0.12,
                            transition: 'opacity 220ms ease',
                            animation: startSel ? 'db-top-pulse-red 2.8s ease-in-out infinite' : 'none',
                        }} />

                        {/* Radial glow */}
                        <div style={{
                            position: 'absolute',
                            top: '38%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 280,
                            height: 280,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${RED}${startSel ? '10' : '04'} 0%, transparent 70%)`,
                            pointerEvents: 'none',
                            transition: 'background 220ms ease',
                        }} />

                        {/* Scan line */}
                        {startSel && (
                            <div style={{
                                position: 'absolute',
                                left: 0, right: 0,
                                height: 1,
                                background: `linear-gradient(90deg, transparent, ${RED}20, transparent)`,
                                animation: 'db-scan 3.6s linear infinite',
                                pointerEvents: 'none',
                            }} />
                        )}

                        {/* Icon container */}
                        <div style={{
                            width: 60,
                            height: 60,
                            borderRadius: 16,
                            background: startSel ? `${RED}18` : `#ffffff06`,
                            border: `1.5px solid ${startSel ? `${RED}40` : '#ffffff0a'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 220ms ease',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                                stroke={startSel ? RED : '#ffffff18'}
                                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                style={{ transition: 'stroke 220ms ease' }}>
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        </div>

                        {/* Big label */}
                        <div style={{
                            fontWeight: 800,
                            fontStyle: 'italic',
                            fontSize: 96,
                            lineHeight: 0.9,
                            color: startSel ? WHITE : '#ffffff14',
                            letterSpacing: '-0.01em',
                            transition: 'color 220ms ease',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            START
                        </div>

                        {/* Subtitle */}
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: 10,
                            letterSpacing: '0.3em',
                            color: startSel ? `${RED}cc` : '#ffffff18',
                            textTransform: 'uppercase',
                            transition: 'color 220ms ease',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            RUN THE GAME
                        </div>

                        {/* Description */}
                        <div style={{
                            fontWeight: 400,
                            fontSize: 13,
                            color: startSel ? '#ffffff55' : '#ffffff10',
                            textAlign: 'center',
                            letterSpacing: '0.06em',
                            lineHeight: 1.45,
                            maxWidth: 190,
                            transition: 'color 220ms ease',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            Set up teams, clock,<br />and score live
                        </div>

                        {/* SELECTED badge */}
                        {startSel && (
                            <div style={{
                                position: 'absolute',
                                top: 16, right: 16,
                                padding: '4px 12px',
                                borderRadius: 20,
                                background: `${RED}18`,
                                border: `1px solid ${RED}40`,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 8,
                                fontWeight: 700,
                                color: RED,
                                letterSpacing: '0.18em',
                                zIndex: 2,
                                animation: 'db-badge-in 0.2s ease-out',
                            }}>
                                SELECTED
                            </div>
                        )}

                        {/* Bottom color bar */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0, left: 0, right: 0,
                            height: 3,
                            background: `linear-gradient(90deg, transparent, ${RED}, transparent)`,
                            opacity: startSel ? 0.6 : 0,
                            transition: 'opacity 220ms ease',
                        }} />
                    </div>
                </div>

                {/* ── Hardware hint bar ── */}
                <div style={{
                    flexShrink: 0,
                    height: 34,
                    borderTop: `1px solid #ffffff08`,
                    background: `${NAVY_CARD}99`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0,
                }}>
                    {[
                        ['SCORE A', 'WATCH'],
                        ['SCORE B', 'START'],
                        ['SHOT CLOCK', 'ENTER'],
                        ['HOLD SETTINGS', 'QUICK GAME'],
                    ].map(([key, val], i, arr) => (
                        <React.Fragment key={key}>
                            <span style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 9,
                                color: '#ffffff22',
                                letterSpacing: '0.08em',
                            }}>
                                <span style={{ color: '#ffffff40' }}>{key}</span>
                                {' = '}
                                {val}
                            </span>
                            {i < arr.length - 1 && (
                                <span style={{
                                    color: '#ffffff10',
                                    fontSize: 9,
                                    margin: '0 16px',
                                }}>•</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>

            </div>
        </>
    );
};

export default PiDashboard;
