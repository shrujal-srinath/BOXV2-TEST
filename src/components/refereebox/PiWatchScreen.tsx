// src/components/refereebox/PiWatchScreen.tsx
// THE BOX — Pi Watch Screen
// Shows casting code + option to enter a game code manually.
// Hardware: UNDO = back to dashboard.

import React, { useState } from 'react';

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;1,700;1,800&family=JetBrains+Mono:wght@400;600;700&display=swap');

@keyframes ws-code-pulse {
  0%, 100% { text-shadow: 0 0 24px #3B82F630; }
  50%       { text-shadow: 0 0 48px #3B82F660, 0 0 80px #3B82F620; }
}
@keyframes ws-ring-expand {
  0%   { transform: scale(1);   opacity: 0.5; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes ws-dot-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}
@keyframes ws-slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

interface PiWatchScreenProps {
    onBack: () => void;
    castCode?: string;
}

const PiWatchScreen: React.FC<PiWatchScreenProps> = ({
    onBack,
    castCode = 'A3K7',
}) => {
    const [showCodeEntry, setShowCodeEntry] = useState(false);
    const [enteredCode, setEnteredCode] = useState('');

    const NAVY       = '#0F1F35';
    const NAVY_DARK  = '#0a1728';
    const BLUE       = '#3B82F6';
    const BLUE_DIM   = '#1e3a6a';
    const WHITE      = '#FFFFFF';

    if (showCodeEntry) {
        return (
            <>
                <style>{FONT_CSS}</style>
                <div style={{
                    width: '100vw', height: '100vh',
                    background: NAVY,
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    userSelect: 'none',
                }}>
                    {/* Header */}
                    <div style={{
                        flexShrink: 0, height: 46,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 28px',
                        borderBottom: '1px solid #ffffff0e',
                        background: `${NAVY_DARK}cc`,
                    }}>
                        <button
                            onClick={() => setShowCodeEntry(false)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 8,
                                color: '#ffffff55',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10, letterSpacing: '0.2em', padding: 0,
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M19 12H5M12 5l-7 7 7 7" />
                            </svg>
                            BACK
                        </button>
                        <span style={{
                            fontWeight: 800, fontStyle: 'italic', fontSize: 16,
                            letterSpacing: '0.12em', color: WHITE, textTransform: 'uppercase',
                        }}>THE BOX</span>
                        <span style={{ width: 60 }} />
                    </div>

                    {/* Code entry body */}
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 28,
                        animation: 'ws-slide-up 0.25s ease-out',
                    }}>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, letterSpacing: '0.35em',
                            color: `${BLUE}99`, textTransform: 'uppercase',
                        }}>
                            ENTER GAME CODE
                        </div>

                        {/* Code input display */}
                        <div style={{
                            display: 'flex', gap: 12,
                        }}>
                            {Array.from({ length: 4 }).map((_, i) => {
                                const ch = enteredCode[i] ?? '';
                                const isActive = i === enteredCode.length;
                                return (
                                    <div key={i} style={{
                                        width: 64, height: 80,
                                        borderRadius: 12,
                                        background: ch ? `${BLUE}18` : `${NAVY_DARK}`,
                                        border: `2px solid ${isActive ? BLUE : ch ? `${BLUE}40` : '#ffffff12'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: 36, fontWeight: 700,
                                        color: ch ? WHITE : 'transparent',
                                        position: 'relative',
                                        transition: 'all 150ms ease',
                                    }}>
                                        {ch || ''}
                                        {isActive && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 14, left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: 2, height: 20,
                                                background: BLUE,
                                                borderRadius: 1,
                                                animation: 'ws-dot-blink 1s step-end infinite',
                                            }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Soft keyboard */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                ['1','2','3','4','5','6','7','8','9','0'],
                                ['Q','W','E','R','T','Y','U','I','O','P'],
                                ['A','S','D','F','G','H','J','K','L'],
                                ['Z','X','C','V','B','N','M'],
                            ].map((row, ri) => (
                                <div key={ri} style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                    {row.map(ch => (
                                        <button
                                            key={ch}
                                            onClick={() => enteredCode.length < 4 && setEnteredCode(p => p + ch)}
                                            style={{
                                                width: 36, height: 36, borderRadius: 8,
                                                background: '#ffffff08',
                                                border: '1px solid #ffffff10',
                                                color: '#ffffff88',
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: 13, fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'background 80ms, color 80ms',
                                            }}
                                            onTouchStart={(e) => {
                                                (e.currentTarget as HTMLElement).style.background = `${BLUE}30`;
                                                (e.currentTarget as HTMLElement).style.color = WHITE;
                                            }}
                                            onTouchEnd={(e) => {
                                                (e.currentTarget as HTMLElement).style.background = '#ffffff08';
                                                (e.currentTarget as HTMLElement).style.color = '#ffffff88';
                                            }}
                                            onMouseDown={(e) => {
                                                (e.currentTarget as HTMLElement).style.background = `${BLUE}30`;
                                                (e.currentTarget as HTMLElement).style.color = WHITE;
                                            }}
                                            onMouseUp={(e) => {
                                                (e.currentTarget as HTMLElement).style.background = '#ffffff08';
                                                (e.currentTarget as HTMLElement).style.color = '#ffffff88';
                                            }}
                                        >
                                            {ch}
                                        </button>
                                    ))}
                                    {ri === 3 && (
                                        <button
                                            onClick={() => setEnteredCode(p => p.slice(0, -1))}
                                            style={{
                                                width: 52, height: 36, borderRadius: 8,
                                                background: '#ffffff08', border: '1px solid #ffffff10',
                                                color: '#ffffff55',
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: 11, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'background 80ms',
                                            }}
                                        >
                                            ⌫
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Join button */}
                        <button
                            disabled={enteredCode.length < 4}
                            style={{
                                padding: '13px 48px',
                                borderRadius: 12,
                                background: enteredCode.length === 4 ? BLUE : '#ffffff08',
                                border: `1.5px solid ${enteredCode.length === 4 ? BLUE : '#ffffff12'}`,
                                color: enteredCode.length === 4 ? WHITE : '#ffffff30',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 12, fontWeight: 700,
                                letterSpacing: '0.2em', cursor: enteredCode.length === 4 ? 'pointer' : 'default',
                                transition: 'all 180ms ease',
                            }}
                        >
                            JOIN GAME →
                        </button>
                    </div>

                    {/* Bottom hint */}
                    <div style={{
                        flexShrink: 0, height: 34,
                        borderTop: '1px solid #ffffff08',
                        background: `${NAVY_DARK}99`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9, color: '#ffffff20', letterSpacing: '0.1em',
                        }}>
                            UNDO = BACK TO DASHBOARD
                        </span>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{FONT_CSS}</style>
            <div style={{
                width: '100vw',
                height: '100vh',
                background: NAVY,
                backgroundImage: `radial-gradient(ellipse at 50% 40%, ${BLUE}0a 0%, transparent 60%)`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontFamily: "'Barlow Condensed', sans-serif",
                userSelect: 'none',
            }}>

                {/* ── Header ── */}
                <div style={{
                    flexShrink: 0, height: 46,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 28px',
                    borderBottom: '1px solid #ffffff0e',
                    background: `${NAVY_DARK}cc`,
                }}>
                    <button
                        onClick={onBack}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            color: '#ffffff40',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, letterSpacing: '0.2em', padding: 0,
                            transition: 'color 150ms',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ffffff80'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ffffff40'; }}
                        onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.color = '#ffffff80'; }}
                        onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.color = '#ffffff40'; onBack(); }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M19 12H5M12 5l-7 7 7 7" />
                        </svg>
                        BACK
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 5, height: 18, borderRadius: 2,
                            background: `linear-gradient(to bottom, #DC2626, ${BLUE})`,
                        }} />
                        <span style={{
                            fontWeight: 800, fontStyle: 'italic', fontSize: 16,
                            letterSpacing: '0.12em', color: WHITE, textTransform: 'uppercase',
                        }}>THE BOX</span>
                    </div>

                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9, letterSpacing: '0.25em',
                        color: '#ffffff20', textTransform: 'uppercase',
                    }}>
                        WATCH MODE
                    </span>
                </div>

                {/* ── Main body ── */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 0,
                }}>
                    {/* Pulsing ring stack */}
                    <div style={{ position: 'relative', width: 88, height: 88, marginBottom: 36 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                position: 'absolute', inset: 0,
                                borderRadius: '50%',
                                border: `1px solid ${BLUE}`,
                                opacity: 0,
                                animation: `ws-ring-expand 2.4s ease-out ${i * 0.7}s infinite`,
                            }} />
                        ))}
                        <div style={{
                            position: 'absolute', inset: 0,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${BLUE_DIM}, #0a1628)`,
                            border: `1.5px solid ${BLUE}50`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                                stroke={BLUE} strokeWidth="1.5" strokeLinecap="round">
                                <path d="M2 12C4.5 7 8 4.5 12 4.5S19.5 7 22 12c-2.5 5-6 7.5-10 7.5S4.5 17 2 12z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </div>
                    </div>

                    {/* Label */}
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10, letterSpacing: '0.35em',
                        color: `${BLUE}80`, textTransform: 'uppercase',
                        marginBottom: 14,
                    }}>
                        CAST CODE
                    </div>

                    {/* Big casting code */}
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: 96,
                        lineHeight: 1,
                        letterSpacing: '0.22em',
                        color: WHITE,
                        animation: 'ws-code-pulse 3s ease-in-out infinite',
                        marginBottom: 20,
                    }}>
                        {castCode}
                    </div>

                    {/* Instruction */}
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        letterSpacing: '0.22em',
                        color: '#ffffff40',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        lineHeight: 1.8,
                        marginBottom: 36,
                    }}>
                        Enter this code on the app<br />to cast to this screen
                    </div>

                    {/* OR divider */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 16,
                        width: 260, marginBottom: 28,
                    }}>
                        <div style={{ flex: 1, height: 1, background: '#ffffff12' }} />
                        <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, color: '#ffffff25', letterSpacing: '0.2em',
                        }}>
                            OR
                        </span>
                        <div style={{ flex: 1, height: 1, background: '#ffffff12' }} />
                    </div>

                    {/* Enter code button */}
                    <button
                        onClick={() => setShowCodeEntry(true)}
                        style={{
                            padding: '13px 40px',
                            borderRadius: 12,
                            background: `${BLUE}18`,
                            border: `1.5px solid ${BLUE}40`,
                            color: BLUE,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11, fontWeight: 700,
                            letterSpacing: '0.22em', cursor: 'pointer',
                            transition: 'all 180ms ease',
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = `${BLUE}28`;
                            (e.currentTarget as HTMLElement).style.borderColor = `${BLUE}70`;
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = `${BLUE}18`;
                            (e.currentTarget as HTMLElement).style.borderColor = `${BLUE}40`;
                        }}
                        onTouchStart={(e) => {
                            (e.currentTarget as HTMLElement).style.background = `${BLUE}30`;
                        }}
                        onTouchEnd={(e) => {
                            (e.currentTarget as HTMLElement).style.background = `${BLUE}18`;
                            setShowCodeEntry(true);
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        ENTER GAME CODE
                    </button>

                    {/* Live indicator */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginTop: 32,
                    }}>
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: BLUE,
                            animation: 'ws-dot-blink 1.6s ease-in-out infinite',
                        }} />
                        <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9, letterSpacing: '0.2em',
                            color: '#ffffff25',
                        }}>
                            WAITING FOR CAST
                        </span>
                    </div>
                </div>

                {/* ── Bottom hint ── */}
                <div style={{
                    flexShrink: 0, height: 34,
                    borderTop: '1px solid #ffffff08',
                    background: `${NAVY_DARK}99`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9, color: '#ffffff20', letterSpacing: '0.1em',
                    }}>
                        UNDO = BACK TO DASHBOARD
                    </span>
                </div>
            </div>
        </>
    );
};

export default PiWatchScreen;
