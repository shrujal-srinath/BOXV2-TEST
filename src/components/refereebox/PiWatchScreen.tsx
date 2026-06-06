// src/components/refereebox/PiWatchScreen.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    registerTvDisplay,
    startTvHeartbeat,
    subscribeTvDisplay,
    subscribeCastSignal,
    type TvDisplay,
} from '../../services/tvDisplayService';

// ── Colour tokens ────────────────────────────────────────────────────────────
const BG         = '#080808';
const SURFACE    = '#0a0a0a';
const RED        = '#dc2626';
const WHITE      = '#ffffff';
const MUTED      = '#555555';
const MUTED2     = '#888888';
const BORDER     = '#333333';
const SG         = "'Space Grotesk', sans-serif";
const JBM        = "'JetBrains Mono', monospace";

// ── Font + animations ────────────────────────────────────────────────────────
const FONT_CSS = `
@keyframes hud-grid {
  0%   { opacity: 0.5; }
  100% { opacity: 0.5; }
}
@keyframes scanlines {
  0%   { background-position: 0 0; }
  100% { background-position: 0 100%; }
}
@keyframes codePulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.7; }
}
@keyframes livePulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1; }
}
@keyframes castReceived {
  0%   { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1);    opacity: 1; }
}
@keyframes keyFlash {
  0%   { background: #dc2626; color: #000; }
  100% { background: #1a1a1a; color: #fff; }
}
`;

// ── TV code ──────────────────────────────────────────────────────────────────
function getOrCreateTvCode(): string {
    const saved = localStorage.getItem('tv_kiosk_code');
    if (saved) return saved;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++)
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    localStorage.setItem('tv_kiosk_code', code);
    return code;
}

// ── Keyboard (omits O, I, 0, 1) ──────────────────────────────────────────────
const KEYBOARD_ROWS: string[][] = [
    ['A','B','C','D','E','F','G','H','J','K','L','M'],
    ['N','P','Q','R','S','T','U','V','W','X','Y','Z'],
    ['2','3','4','5','6','7','8','9'],
];

// ── Props ────────────────────────────────────────────────────────────────────
interface PiWatchScreenProps {
    onBack: () => void;
    castCode?: string;
}

// ── Component ────────────────────────────────────────────────────────────────
const PiWatchScreen: React.FC<PiWatchScreenProps> = ({ onBack }) => {
    const navigate = useNavigate();

    const [tvCode] = useState<string>(getOrCreateTvCode);
    const [activeTab, setActiveTab] = useState<'cast' | 'code'>('cast');
    const [inputCode, setInputCode] = useState('');
    const [flashedKey, setFlashedKey] = useState<string | null>(null);
    const [registered, setRegistered] = useState(false);
    const [castReceived, setCastReceived] = useState(false);

    const aliveRef = useRef(true);

    // ── Supabase registration + subscriptions ────────────────────────────────
    useEffect(() => {
        aliveRef.current = true;
        let stopHB: (() => void) | null = null;
        let unsubDisplay: (() => void) | null = null;
        let unsubSignal: (() => void) | null = null;

        const boot = async () => {
            try {
                const current = await registerTvDisplay(tvCode);
                if (!aliveRef.current) return;
                setRegistered(true);

                if (current.game_code && current.status === 'casting') {
                    navigate(`/pi-display/${current.game_code.toUpperCase()}`);
                    return;
                }

                stopHB = startTvHeartbeat(tvCode);

                unsubDisplay = subscribeTvDisplay(tvCode, (d: TvDisplay) => {
                    if (!aliveRef.current) return;
                    if (d.game_code && d.status === 'casting') {
                        navigate(`/pi-display/${d.game_code.toUpperCase()}`);
                    }
                });

                unsubSignal = subscribeCastSignal(
                    tvCode,
                    (gameCode) => {
                        if (!aliveRef.current) return;
                        setCastReceived(true);
                        setTimeout(() => {
                            navigate(`/pi-display/${gameCode.toUpperCase()}`);
                        }, 800);
                    },
                    () => { /* stop signal — already on setup screen */ },
                );
            } catch (err) {
                console.warn('[PiWatchScreen] boot failed, retrying in 5s', err);
                setTimeout(boot, 5000);
            }
        };

        boot();

        return () => {
            aliveRef.current = false;
            stopHB?.();
            unsubDisplay?.();
            unsubSignal?.();
        };
    }, [tvCode, navigate]);

    // ── Keyboard ─────────────────────────────────────────────────────────────
    const handleKeyPress = (char: string) => {
        if (inputCode.length >= 4) return;
        setFlashedKey(char);
        setTimeout(() => setFlashedKey(null), 150);
        setInputCode(prev => prev + char);
    };

    const handleConfirm = useCallback(() => {
        if (inputCode.length === 4)
            navigate(`/pi-display/${inputCode.toUpperCase()}`);
    }, [inputCode, navigate]);

    // ── Hardware button navigation ────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: Event) => {
            const msg = (e as CustomEvent<{ message: string }>).detail?.message;
            if (!msg) return;
            if (['SCORE_A_PLUS1', 'SCORE_A_PLUS2', 'SCORE_A_PLUS3'].includes(msg)) {
                setActiveTab('cast');
            } else if (['SCORE_B_PLUS1', 'SCORE_B_PLUS2', 'SCORE_B_PLUS3'].includes(msg)) {
                setActiveTab('code');
            } else if (['SHOT_CLOCK_24', 'SHOT_CLOCK_14'].includes(msg)) {
                if (activeTab === 'code' && inputCode.length === 4) handleConfirm();
            } else if (msg === 'UNDO') {
                onBack();
            }
        };
        window.addEventListener('pico_message', handler);
        return () => window.removeEventListener('pico_message', handler);
    }, [activeTab, inputCode, onBack, handleConfirm]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <style>{FONT_CSS}</style>

            {/* ROOT */}
            <div style={{
                position: 'relative',
                width: '100vw',
                height: '100vh',
                background: BG,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                userSelect: 'none',
            }}>

                {/* ── 1. HEADER ── */}
                <header style={{
                    height: 48,
                    flexShrink: 0,
                    background: BG,
                    borderBottom: `1px solid ${BORDER}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    {/* Left: wordmark */}
                    <div style={{
                        borderLeft: `1px solid ${RED}`,
                        borderRight: `1px solid ${RED}`,
                        padding: '0 20px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                    }}>
                        <span style={{
                            fontFamily: SG,
                            fontWeight: 700,
                            fontStyle: 'italic',
                            fontSize: 20,
                            letterSpacing: '0.15em',
                            color: WHITE,
                        }}>THE BOX</span>
                    </div>

                    {/* Center: hardware status tabs */}
                    <div style={{ display: 'flex', height: '100%' }}>
                        {(['RPI4', 'PICO', 'ESP32'] as const).map((tab, i) => (
                            <div key={tab} style={{
                                padding: '0 16px',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                fontFamily: SG,
                                fontWeight: 700,
                                fontSize: 11,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                color: i === 0 ? RED : MUTED,
                                borderBottom: i === 0 ? `2px solid ${RED}` : 'none',
                                boxSizing: 'border-box',
                            }}>
                                {tab}
                            </div>
                        ))}
                    </div>

                    {/* Right: 3 icon SVGs */}
                    <div style={{ display: 'flex', gap: 16, paddingRight: 20, alignItems: 'center' }}>
                        {/* Settings */}
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <line x1="2" y1="5" x2="16" y2="5" stroke="#dc2626" strokeWidth="1.5"/>
                            <circle cx="6" cy="5" r="2" fill="#080808" stroke="#dc2626" strokeWidth="1.5"/>
                            <line x1="2" y1="13" x2="16" y2="13" stroke="#dc2626" strokeWidth="1.5"/>
                            <circle cx="12" cy="13" r="2" fill="#080808" stroke="#dc2626" strokeWidth="1.5"/>
                        </svg>
                        {/* Signal */}
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M9 14 C9 14 9 14 9 14" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M6 11 C7 9.5 11 9.5 12 11" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                            <path d="M3.5 8.5 C5.5 5.5 12.5 5.5 14.5 8.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                        </svg>
                        {/* Wifi */}
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M1 6C4.5 2.5 13.5 2.5 17 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                            <path d="M3.5 8.5C5.5 6.5 12.5 6.5 14.5 8.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                            <path d="M6.5 11C7.5 10 10.5 10 11.5 11" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                            <circle cx="9" cy="14" r="1.2" fill="#dc2626"/>
                        </svg>
                    </div>
                </header>

                {/* ── 2. MAIN CONTENT AREA ── */}
                <div style={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px 24px',
                    gap: 16,
                    position: 'relative',
                }}>
                    {/* Scanlines overlay */}
                    <div style={{
                        position: 'absolute',
                        top: 0, right: 0, bottom: 0, left: 0,
                        pointerEvents: 'none',
                        zIndex: 30,
                        background: `repeating-linear-gradient(
                            to bottom,
                            transparent 0px, transparent 3px,
                            rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px
                        )`,
                    }} />

                    {/* Back button */}
                    <button
                        onClick={onBack}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: SG,
                            fontWeight: 600,
                            fontSize: 10,
                            letterSpacing: '0.2em',
                            color: MUTED,
                            textTransform: 'uppercase',
                            padding: '8px 12px',
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M8 2L4 6L8 10" stroke="#555555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        BACK
                    </button>

                    {/* Tab toggle bar */}
                    <div style={{
                        border: `1px solid ${BORDER}`,
                        padding: 3,
                        display: 'flex',
                        width: 'fit-content',
                        maxWidth: 400,
                        background: BG,
                    }}>
                        <button
                            onClick={() => setActiveTab('cast')}
                            style={{
                                fontFamily: SG,
                                fontWeight: 700,
                                fontSize: 11,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                padding: '8px 20px',
                                cursor: 'pointer',
                                border: 'none',
                                borderRadius: 4,
                                background: activeTab === 'cast' ? RED : 'transparent',
                                color: activeTab === 'cast' ? '#000' : MUTED2,
                            }}
                        >
                            CAST ONTO SCREEN
                        </button>
                        <button
                            onClick={() => setActiveTab('code')}
                            style={{
                                fontFamily: SG,
                                fontWeight: 700,
                                fontSize: 11,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                padding: '8px 20px',
                                cursor: 'pointer',
                                border: 'none',
                                borderRadius: 4,
                                background: activeTab === 'code' ? RED : 'transparent',
                                color: activeTab === 'code' ? '#000' : MUTED2,
                            }}
                        >
                            WATCH USING GAME CODE
                        </button>
                    </div>

                    {/* Main panel box */}
                    <div style={{
                        position: 'relative',
                        border: `1px solid ${BORDER}`,
                        background: SURFACE,
                        backgroundImage: [
                            'linear-gradient(to right,  rgba(255,255,255,0.04) 1px, transparent 1px)',
                            'linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
                        ].join(', '),
                        backgroundSize: '40px 40px',
                        padding: '24px 32px',
                        width: '100%',
                        maxWidth: 700,
                    }}>
                        {/* Corner reticles */}
                        <div style={{ position: 'absolute', top: 0, left: 0,  width: 8, height: 8, borderTop: `1px solid ${RED}`, borderLeft:  `1px solid ${RED}` }} />
                        <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderTop: `1px solid ${RED}`, borderRight: `1px solid ${RED}` }} />
                        <div style={{ position: 'absolute', bottom: 0, left:  0, width: 8, height: 8, borderBottom: `1px solid ${RED}`, borderLeft:  `1px solid ${RED}` }} />
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderBottom: `1px solid ${RED}`, borderRight: `1px solid ${RED}` }} />

                        {/* Module label */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            transform: 'translateY(-100%)',
                            background: BORDER,
                            color: WHITE,
                            fontFamily: JBM,
                            fontSize: 10,
                            padding: '3px 8px',
                            textTransform: 'uppercase',
                        }}>
                            {activeTab === 'cast' ? 'SYS.MODULE.CAST' : 'SYS.MODULE.STREAM'}
                        </div>

                        {/* ── TAB 0: CAST ONTO SCREEN ── */}
                        {activeTab === 'cast' && (
                            <div>
                                {/* Panel header */}
                                <div style={{
                                    textAlign: 'center',
                                    borderBottom: `1px solid ${BORDER}`,
                                    paddingBottom: 16,
                                    marginBottom: 20,
                                }}>
                                    <div style={{
                                        fontFamily: SG,
                                        fontWeight: 700,
                                        fontStyle: 'italic',
                                        fontSize: 26,
                                        letterSpacing: '-0.02em',
                                        color: WHITE,
                                        textTransform: 'uppercase',
                                    }}>CAST ONTO SCREEN</div>
                                    <div style={{
                                        fontFamily: JBM,
                                        fontSize: 10,
                                        letterSpacing: '0.2em',
                                        color: MUTED2,
                                        textTransform: 'uppercase',
                                    }}>ENTER THIS CODE IN CAST MODE</div>
                                </div>

                                {/* Auth key box */}
                                <div style={{
                                    position: 'relative',
                                    border: `1px solid ${RED}`,
                                    background: '#050505',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '20px 0',
                                    marginBottom: 20,
                                    width: '100%',
                                    maxWidth: 380,
                                    marginLeft: 'auto',
                                    marginRight: 'auto',
                                }}>
                                    {/* AUTH_KEY badge */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        transform: 'translateY(-50%)',
                                        background: RED,
                                        color: '#000',
                                        fontFamily: JBM,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        textTransform: 'uppercase',
                                    }}>AUTH_KEY</div>

                                    {/* 4-digit code */}
                                    <div style={{
                                        fontFamily: SG,
                                        fontWeight: 700,
                                        fontSize: 56,
                                        letterSpacing: '0.25em',
                                        color: WHITE,
                                        animation: 'codePulse 2.4s ease-in-out infinite',
                                    }}>
                                        {tvCode}
                                    </div>
                                </div>

                                {/* Status row */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 12,
                                }}>
                                    {/* STATUS */}
                                    <div style={{
                                        border: `1px solid ${BORDER}`,
                                        background: SURFACE,
                                        padding: 12,
                                    }}>
                                        <div style={{
                                            fontFamily: JBM,
                                            fontSize: 10,
                                            color: RED,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em',
                                            marginBottom: 6,
                                        }}>STATUS</div>
                                        <div style={{
                                            fontFamily: JBM,
                                            fontSize: 12,
                                            color: MUTED2,
                                            lineHeight: 1.5,
                                        }}>
                                            {!registered
                                                ? 'Registering with server...'
                                                : 'Awaiting cast. Show this code to the host.'}
                                        </div>
                                    </div>

                                    {/* INSTRUCTION */}
                                    <div style={{
                                        border: `1px solid ${BORDER}`,
                                        background: WHITE,
                                        padding: 12,
                                        color: '#000',
                                    }}>
                                        <div style={{
                                            fontFamily: JBM,
                                            fontSize: 10,
                                            color: '#555',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em',
                                            marginBottom: 6,
                                        }}>INSTRUCTION</div>
                                        <div style={{
                                            fontFamily: JBM,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: '#000',
                                            lineHeight: 1.5,
                                        }}>
                                            Input the 4-digit AUTH_KEY on the host console to cast this game.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 1: WATCH USING GAME CODE ── */}
                        {activeTab === 'code' && (
                            <div>
                                {/* Panel header */}
                                <div style={{
                                    textAlign: 'center',
                                    borderBottom: `1px solid ${BORDER}`,
                                    paddingBottom: 16,
                                    marginBottom: 20,
                                }}>
                                    <div style={{
                                        fontFamily: SG,
                                        fontWeight: 700,
                                        fontStyle: 'italic',
                                        fontSize: 26,
                                        letterSpacing: '-0.02em',
                                        color: WHITE,
                                        textTransform: 'uppercase',
                                    }}>STREAM USING GAME CODE</div>
                                    <div style={{
                                        fontFamily: JBM,
                                        fontSize: 10,
                                        letterSpacing: '0.2em',
                                        color: MUTED2,
                                        textTransform: 'uppercase',
                                    }}>ENTER THE 4-DIGIT CODE SHOWN ON THE WEBSITE</div>
                                </div>

                                {/* Code display row */}
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    justifyContent: 'center',
                                    marginBottom: 20,
                                }}>
                                    {[0, 1, 2, 3].map(i => {
                                        const isActive = i === inputCode.length;
                                        const char = inputCode[i];
                                        return (
                                            <div key={i} style={{
                                                width: 56,
                                                height: 68,
                                                border: `2px solid ${isActive ? RED : char ? 'rgba(220,38,38,0.4)' : BORDER}`,
                                                background: char ? 'rgba(220,38,38,0.08)' : SURFACE,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                position: 'relative',
                                            }}>
                                                {char ? (
                                                    <span style={{
                                                        fontFamily: JBM,
                                                        fontWeight: 700,
                                                        fontSize: 32,
                                                        color: WHITE,
                                                    }}>{char}</span>
                                                ) : isActive ? (
                                                    <div style={{
                                                        width: 8,
                                                        height: 20,
                                                        background: WHITE,
                                                        animation: 'codePulse 1s steps(2) infinite',
                                                    }} />
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Keyboard */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 6,
                                    alignItems: 'center',
                                }}>
                                    {KEYBOARD_ROWS.map((row, rowIdx) => (
                                        <div key={rowIdx} style={{
                                            display: 'flex',
                                            gap: 4,
                                            justifyContent: 'center',
                                        }}>
                                            {row.map(char => (
                                                <button
                                                    key={char}
                                                    onClick={() => handleKeyPress(char)}
                                                    style={{
                                                        width: 44,
                                                        height: 32,
                                                        background: '#1a1a1a',
                                                        border: `1px solid ${BORDER}`,
                                                        color: WHITE,
                                                        fontFamily: JBM,
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        borderRadius: 4,
                                                        animation: flashedKey === char ? 'keyFlash 150ms ease-out' : 'none',
                                                    }}
                                                >
                                                    {char}
                                                </button>
                                            ))}
                                            {/* Backspace at end of last row */}
                                            {rowIdx === KEYBOARD_ROWS.length - 1 && (
                                                <button
                                                    onClick={() => setInputCode(p => p.slice(0, -1))}
                                                    style={{
                                                        width: 52,
                                                        height: 32,
                                                        background: '#1a1a1a',
                                                        border: `1px solid ${BORDER}`,
                                                        color: WHITE,
                                                        fontFamily: JBM,
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        borderRadius: 4,
                                                    }}
                                                >
                                                    ⌫
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Confirm button */}
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                    <button
                                        onClick={handleConfirm}
                                        style={{
                                            width: '100%',
                                            maxWidth: 380,
                                            height: 40,
                                            background: inputCode.length === 4 ? RED : SURFACE,
                                            color: inputCode.length === 4 ? WHITE : MUTED,
                                            border: inputCode.length === 4 ? 'none' : `1px solid ${BORDER}`,
                                            cursor: inputCode.length === 4 ? 'pointer' : 'default',
                                            fontFamily: SG,
                                            fontWeight: 700,
                                            fontSize: 13,
                                            letterSpacing: '0.2em',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        CONFIRM →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Cast received overlay */}
                        {castReceived && (
                            <div style={{
                                position: 'absolute',
                                top: 0, right: 0, bottom: 0, left: 0,
                                background: 'rgba(0,0,0,0.85)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                gap: 12,
                                animation: 'castReceived 0.3s ease-out',
                            }}>
                                <div style={{
                                    fontFamily: SG,
                                    fontWeight: 700,
                                    fontSize: 28,
                                    color: RED,
                                }}>CAST RECEIVED</div>
                                <div style={{
                                    fontFamily: JBM,
                                    fontSize: 11,
                                    color: MUTED2,
                                }}>LOADING GAME...</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── 3. FOOTER ── */}
                <footer style={{
                    height: 48,
                    flexShrink: 0,
                    borderTop: `1px solid ${BORDER}`,
                    background: BG,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                }}>
                    {/* Left: LIVE + separator + SYSTEM READY */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                                width: 8,
                                height: 8,
                                background: RED,
                                animation: 'livePulse 1.4s ease-in-out infinite',
                            }} />
                            <span style={{
                                fontFamily: JBM,
                                fontSize: 10,
                                fontWeight: 700,
                                color: RED,
                                letterSpacing: '0.2em',
                            }}>LIVE</span>
                        </div>
                        <div style={{ width: 1, height: 16, background: BORDER }} />
                        <span style={{
                            fontFamily: JBM,
                            fontSize: 10,
                            fontWeight: 700,
                            color: WHITE,
                            letterSpacing: '0.2em',
                        }}>SYSTEM READY</span>
                    </div>

                    {/* Right: UPLINK + NODE */}
                    <div style={{ display: 'flex', gap: 24 }}>
                        <span style={{
                            fontFamily: JBM,
                            fontSize: 10,
                            color: MUTED,
                            letterSpacing: '0.15em',
                        }}>UPLINK: SECURE</span>
                        <span style={{
                            fontFamily: JBM,
                            fontSize: 10,
                            color: MUTED,
                            letterSpacing: '0.15em',
                        }}>NODE: {tvCode}</span>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default PiWatchScreen;
