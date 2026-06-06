// src/components/refereebox/PiDashboard.tsx

import React, { useState } from 'react';

const BG           = '#080808';
const SURFACE      = '#121212';
const RED          = '#dc2626';
const WHITE        = '#ffffff';
const MUTED        = '#888888';
const BORDER       = 'rgba(255,255,255,0.15)';
const BORDER_BRIGHT = '#ffffff';

const SG = "'Space Grotesk', sans-serif";
const JB = "'JetBrains Mono', monospace";

interface PiDashboardProps {
    onSelectWatch: () => void;
    onSelectStart: () => void;
    onSelectArena?: (arenaCode: string) => void;
    selectedIndex?: number; // 0 = watch, 1 = start (default)
}

const PiDashboard: React.FC<PiDashboardProps> = ({
    onSelectWatch,
    onSelectStart,
    onSelectArena,
    selectedIndex = 1,
}) => {
    const [pressed, setPressed] = useState<0 | 1 | null>(null);
    const [showArenaPrompt, setShowArenaPrompt] = useState(false);

    const handleSelect = (idx: 0 | 1) => {
        setPressed(idx);
        setTimeout(() => {
            setPressed(null);
            if (idx === 0) onSelectWatch();
            else onSelectStart();
        }, 130);
    };

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: BG,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            userSelect: 'none',
        }}>

            {/* ── 1. HEADER ── */}
            <div style={{
                flexShrink: 0,
                height: 80,
                background: BG,
                borderBottom: `2px solid ${BORDER_BRIGHT}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 32px',
            }}>

                {/* LEFT — wordmark + attribution */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                        fontFamily: SG,
                        fontWeight: 900,
                        fontStyle: 'italic',
                        fontSize: 28,
                        letterSpacing: '-0.05em',
                        color: WHITE,
                        textTransform: 'uppercase',
                        lineHeight: 1,
                    }}>THE BOX</span>
                    <span style={{
                        fontFamily: JB,
                        fontSize: 7,
                        fontWeight: 400,
                        letterSpacing: '0.15em',
                        color: MUTED,
                        textTransform: 'uppercase',
                        lineHeight: 1,
                        marginTop: 4,
                    }}>BY BMSCE SPORTS DEPT &amp; ROBOTICS LAB</span>
                </div>

                {/* CENTER — nav labels */}
                <div style={{ display: 'flex' }}>
                    {['DASHBOARD', 'ANALYTICS', 'TEAM MANAGEMENT'].map(label => (
                        <div key={label} style={{
                            fontFamily: SG,
                            fontWeight: 700,
                            fontSize: 12,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            color: MUTED,
                            height: 80,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 16px',
                            borderBottom: '4px solid transparent',
                        }}>{label}</div>
                    ))}
                </div>

                {/* RIGHT — hardware chips + action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

                    {/* Hardware chips */}
                    <div style={{ display: 'flex', gap: 6, marginRight: 16 }}>
                        {['RPI4_OK', 'PICO_OK', 'ESP32_OK'].map(chip => (
                            <span key={chip} style={{
                                background: SURFACE,
                                border: `1px solid ${BORDER}`,
                                padding: '4px 8px',
                                fontFamily: JB,
                                fontSize: 11,
                                color: WHITE,
                            }}>{chip}</span>
                        ))}
                    </div>

                    {/* START GAME */}
                    <button
                        onClick={() => handleSelect(1)}
                        onTouchStart={() => setPressed(1)}
                        onTouchEnd={() => handleSelect(1)}
                        style={{
                            background: pressed === 1 ? WHITE : RED,
                            color: pressed === 1 ? '#000000' : WHITE,
                            border: `2px solid ${pressed === 1 ? WHITE : RED}`,
                            padding: '8px 24px',
                            fontFamily: SG,
                            fontWeight: 700,
                            fontSize: 13,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            borderRadius: 0,
                            transition: 'background 100ms, color 100ms, border-color 100ms',
                        }}>START GAME</button>

                    {/* WATCH GAME */}
                    <button
                        onClick={() => handleSelect(0)}
                        onTouchStart={() => setPressed(0)}
                        onTouchEnd={() => handleSelect(0)}
                        style={{
                            background: pressed === 0 ? WHITE : 'transparent',
                            color: pressed === 0 ? '#000000' : WHITE,
                            border: `2px solid ${BORDER_BRIGHT}`,
                            padding: '8px 24px',
                            fontFamily: SG,
                            fontWeight: 700,
                            fontSize: 13,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            borderRadius: 0,
                            transition: 'background 100ms, color 100ms',
                        }}>WATCH GAME</button>

                    {/* ARENA VIEW — opens the same multi-court kiosk used on the web */}
                    <button
                        onClick={() => onSelectArena && setShowArenaPrompt(true)}
                        disabled={!onSelectArena}
                        style={{
                            background: 'transparent',
                            color: '#1d6bff',
                            border: '2px solid #1d6bff',
                            padding: '8px 20px',
                            fontFamily: SG, fontWeight: 700,
                            fontSize: 13, letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            cursor: onSelectArena ? 'pointer' : 'default',
                            opacity: onSelectArena ? 1 : 0.4,
                            display: 'flex', alignItems: 'center', gap: 8,
                            borderRadius: 0,
                            transition: 'background 100ms, color 100ms',
                        }}
                        onMouseEnter={e => { if (onSelectArena) (e.currentTarget as HTMLElement).style.background = 'rgba(29,107,255,0.12)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                            <rect x="0" y="0" width="6" height="6" stroke="#1d6bff" strokeWidth="1.2" fill="none"/>
                            <rect x="8" y="0" width="6" height="6" stroke="#1d6bff" strokeWidth="1.2" fill="none"/>
                            <rect x="0" y="8" width="6" height="6" stroke="#1d6bff" strokeWidth="1.2" fill="none"/>
                            <rect x="8" y="8" width="6" height="6" stroke="#1d6bff" strokeWidth="1.2" fill="none"/>
                        </svg>
                        ARENA VIEW
                    </button>
                </div>
            </div>

            {/* ── 2. MAIN CONTENT AREA ── */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 32px',
                gap: 0,
            }}>

                {/* TOP TEXT BLOCK */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>

                    {/* Label chip */}
                    <div style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        fontFamily: JB,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.35em',
                        color: MUTED,
                        textTransform: 'uppercase',
                        marginBottom: 8,
                    }}>SELECT MODE</div>

                    {/* Heading */}
                    <div style={{
                        fontFamily: SG,
                        fontWeight: 900,
                        fontSize: 'clamp(52px, 7vw, 76px)',
                        letterSpacing: '-0.04em',
                        textTransform: 'uppercase',
                        color: WHITE,
                        marginBottom: 12,
                        lineHeight: 1,
                        textShadow: '0 0 80px rgba(220,38,38,0.3)',
                    }}>THE BOX</div>

                    {/* Tagline */}
                    <div style={{
                        fontFamily: JB,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.35em',
                        color: 'rgba(220,38,38,0.75)',
                        textTransform: 'uppercase',
                    }}>SCORE · CONTROL · BROADCAST</div>
                </div>

                {/* CARDS ROW */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 20,
                    width: '100%',
                    maxWidth: 920,
                }}>

                    {/* ── START GAME card (index 1) ── */}
                    <div
                        onClick={() => handleSelect(1)}
                        onTouchStart={() => setPressed(1)}
                        onTouchEnd={() => handleSelect(1)}
                        style={{
                            background: SURFACE,
                            border: `2px solid ${selectedIndex === 1 ? RED : 'rgba(220,38,38,0.35)'}`,
                            boxShadow: selectedIndex === 1 ? '0 0 40px rgba(220,38,38,0.18), 0 0 0 1px rgba(220,38,38,0.6)' : 'none',
                            padding: 32,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            minHeight: 270,
                            transform: pressed === 1 ? 'scale(0.983)' : 'scale(1)',
                            transition: 'transform 100ms',
                        }}
                    >
                        {/* Top accent bar (selected) */}
                        {selectedIndex === 1 && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 3,
                                background: RED,
                            }} />
                        )}

                        {/* Icon box */}
                        <div style={{
                            width: 76,
                            height: 76,
                            border: `2px solid ${RED}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 20,
                            flexShrink: 0,
                        }}>
                            {/* CSS triangle pointing right */}
                            <div style={{
                                width: 0,
                                height: 0,
                                borderTop: '13px solid transparent',
                                borderBottom: '13px solid transparent',
                                borderLeft: `22px solid ${RED}`,
                                marginLeft: 4,
                            }} />
                        </div>

                        {/* Heading */}
                        <div style={{
                            fontFamily: SG,
                            fontWeight: 700,
                            fontSize: 34,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: WHITE,
                            marginBottom: 12,
                        }}>START GAME</div>

                        {/* Body */}
                        <p style={{
                            fontFamily: JB,
                            fontSize: 12,
                            color: MUTED,
                            lineHeight: 1.6,
                            margin: 0,
                        }}>
                            Set up teams, configure rules, and score live.
                        </p>

                        {/* Bottom CTA row */}
                        <div style={{
                            marginTop: 'auto',
                            paddingTop: 16,
                            borderTop: '1px solid rgba(255,255,255,0.15)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                        }}>
                            <span style={{
                                fontFamily: JB,
                                fontSize: 12,
                                letterSpacing: '0.2em',
                                color: WHITE,
                                textTransform: 'uppercase',
                            }}>START SCORING</span>
                            <span style={{
                                fontFamily: JB,
                                fontSize: 20,
                                color: WHITE,
                                lineHeight: 1,
                            }}>→</span>
                        </div>
                    </div>

                    {/* ── STREAM LIVE card (index 0) ── */}
                    <div
                        onClick={() => handleSelect(0)}
                        onTouchStart={() => setPressed(0)}
                        onTouchEnd={() => handleSelect(0)}
                        style={{
                            background: SURFACE,
                            border: `2px solid ${selectedIndex === 0 ? RED : 'rgba(220,38,38,0.35)'}`,
                            boxShadow: selectedIndex === 0 ? '0 0 40px rgba(220,38,38,0.18), 0 0 0 1px rgba(220,38,38,0.6)' : 'none',
                            padding: 32,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            minHeight: 270,
                            transform: pressed === 0 ? 'scale(0.983)' : 'scale(1)',
                            transition: 'transform 100ms',
                        }}
                    >
                        {/* Top accent bar (selected) */}
                        {selectedIndex === 0 && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 3,
                                background: RED,
                            }} />
                        )}

                        {/* Icon box */}
                        <div style={{
                            width: 76,
                            height: 76,
                            border: `2px solid ${RED}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 20,
                            flexShrink: 0,
                        }}>
                            <svg width="34" height="24" viewBox="0 0 28 20" fill="none">
                                <rect x="1" y="1" width="26" height="14" stroke={RED} strokeWidth="2" />
                                <rect x="10" y="15" width="8" height="3" fill={RED} />
                                <rect x="6" y="18" width="16" height="1" fill={RED} />
                                <rect x="11" y="5" width="6" height="4" fill={RED} />
                            </svg>
                        </div>

                        {/* Heading */}
                        <div style={{
                            fontFamily: SG,
                            fontWeight: 700,
                            fontSize: 34,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: WHITE,
                            marginBottom: 12,
                        }}>STREAM LIVE</div>

                        {/* Body */}
                        <p style={{
                            fontFamily: JB,
                            fontSize: 12,
                            color: MUTED,
                            lineHeight: 1.6,
                            margin: 0,
                        }}>
                            Receive a live game cast and display it on this screen.
                        </p>

                        {/* Bottom CTA row */}
                        <div style={{
                            marginTop: 'auto',
                            paddingTop: 16,
                            borderTop: '1px solid rgba(255,255,255,0.15)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                        }}>
                            <span style={{
                                fontFamily: JB,
                                fontSize: 12,
                                letterSpacing: '0.2em',
                                color: WHITE,
                                textTransform: 'uppercase',
                            }}>STREAM LIVE</span>
                            <span style={{
                                fontFamily: JB,
                                fontSize: 20,
                                color: WHITE,
                                lineHeight: 1,
                            }}>→</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* ── ARENA CODE PROMPT ─────────────────────────────────────
               Asks for a 4-char arena code, then hands it back to the parent
               which navigates to the existing /arena/:arenaCode route. */}
            {showArenaPrompt && onSelectArena && (
                <ArenaCodePrompt
                    onCancel={() => setShowArenaPrompt(false)}
                    onConfirm={(code) => { setShowArenaPrompt(false); onSelectArena(code); }}
                />
            )}
        </div>
    );
};

// ── Arena code prompt modal ──────────────────────────────────
const ArenaCodePrompt: React.FC<{
    onConfirm: (code: string) => void;
    onCancel: () => void;
}> = ({ onConfirm, onCancel }) => {
    const [code, setCode] = useState('');
    const valid = /^[A-Z0-9]{4}$/.test(code);
    const press = (k: string) => {
        if (k === '⌫') { setCode(c => c.slice(0, -1)); return; }
        if (k === '✕') { setCode(''); return; }
        if (code.length >= 4) return;
        setCode(c => (c + k).toUpperCase());
    };
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
        }}>
            <div style={{
                width: 420, background: '#0a0a0a',
                border: '1px solid #1d6bff66',
                boxShadow: '0 0 60px rgba(29,107,255,0.3)',
                padding: 24, fontFamily: JB,
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 18,
                }}>
                    <span style={{ fontSize: 11, color: '#1d6bff', fontWeight: 700, letterSpacing: '0.28em' }}>
                        ENTER ARENA CODE
                    </span>
                    <div onClick={onCancel} style={{ cursor: 'pointer', color: MUTED, fontSize: 14, fontWeight: 700, padding: '0 6px' }}>✕</div>
                </div>

                {/* 4-char display */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 18,
                }}>
                    {[0,1,2,3].map(i => (
                        <div key={i} style={{
                            width: 56, height: 64,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1.5px solid ${code[i] ? '#1d6bff' : 'rgba(255,255,255,0.15)'}`,
                            background: code[i] ? 'rgba(29,107,255,0.1)' : 'rgba(255,255,255,0.02)',
                            fontFamily: SG, fontStyle: 'italic', fontWeight: 900,
                            fontSize: 36, color: WHITE,
                            boxShadow: code[i] ? '0 0 14px rgba(29,107,255,0.4)' : 'none',
                            transition: 'all 0.12s',
                        }}>{code[i] || ''}</div>
                    ))}
                </div>

                {/* Numpad — letters + digits */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
                    marginBottom: 16,
                }}>
                    {['1','2','3','4','5','6','7','8','9','0',
                      'A','B','C','D','E','F','G','H','J','K',
                      'L','M','N','P','Q','R','S','T','U','V',
                      'W','X','Y','Z','⌫'].map(k => (
                        <ArenaKey key={k} label={k} onClick={() => press(k)} />
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <ArenaActionBtn label="CANCEL" color={MUTED} onClick={onCancel} />
                    <ArenaActionBtn
                        label="ENTER ARENA →"
                        color="#1d6bff"
                        onClick={() => valid && onConfirm(code)}
                        primary
                        disabled={!valid}
                    />
                </div>
            </div>
        </div>
    );
};

const ArenaKey: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <div
        onClick={onClick}
        style={{
            height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: WHITE, fontFamily: SG, fontWeight: 700, fontSize: 14,
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.12s, transform 0.06s',
        }}
        onTouchStart={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(29,107,255,0.25)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
        }}
        onTouchEnd={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >{label}</div>
);

const ArenaActionBtn: React.FC<{
    label: string; color: string; onClick: () => void; primary?: boolean; disabled?: boolean;
}> = ({ label, color, onClick, primary = false, disabled = false }) => (
    <div
        onClick={disabled ? undefined : onClick}
        style={{
            flex: 1, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: primary ? `${color}1f` : 'rgba(255,255,255,0.025)',
            border: `1px solid ${primary ? color : 'rgba(255,255,255,0.15)'}`,
            color: primary ? color : MUTED,
            fontFamily: JB, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            userSelect: 'none', WebkitTapHighlightColor: 'transparent',
            boxShadow: primary && !disabled ? `0 0 14px ${color}33, inset 0 1px 0 ${color}33` : 'none',
        }}
    >{label}</div>
);

export default PiDashboard;
