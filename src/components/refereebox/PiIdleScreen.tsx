// src/components/refereebox/PiIdleScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Pi Idle / Cast-Waiting Screen
//
// Shown immediately after the splash animation completes.
// Two paths:
//   QR scan → theboxbybmsce.in/cast?tv={tvCode}
//             Pi listens for Supabase cast signal → /pi-display/:code
//   Enter   → onEnter() → mode_select (scoring dashboard)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
    registerTvDisplay,
    startTvHeartbeat,
    subscribeTvDisplay,
    subscribeCastSignal,
    type TvDisplay,
} from '../../services/tvDisplayService';

// ── Props ──────────────────────────────────────────────────────

interface PiIdleScreenProps {
    onEnter: () => void;    // → setScreen('mode_select')
    isOnline: boolean;      // internet connectivity flag from RefereeScreen
}

// ── TV code helper ─────────────────────────────────────────────

function getOrCreateTvCode(): string {
    const saved = localStorage.getItem('tv_kiosk_code');
    if (saved) return saved;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    localStorage.setItem('tv_kiosk_code', code);
    return code;
}

// ── Component ──────────────────────────────────────────────────

const PiIdleScreen: React.FC<PiIdleScreenProps> = ({ onEnter, isOnline }) => {
    const navigate = useNavigate();
    const onEnterRef = useRef(onEnter);
    useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);

    const [tvCode] = useState<string>(getOrCreateTvCode);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [castStatus, setCastStatus] = useState<'waiting' | 'receiving'>('waiting');
    const [registered, setRegistered] = useState(false);

    // ── Generate real QR pointing to cast setup page ───────────
    useEffect(() => {
        const url = `https://theboxbybmsce.in/cast?tv=${tvCode.toUpperCase()}`;
        QRCode.toDataURL(url, {
            width: 200,
            margin: 2,
            color: { dark: '#FFFFFF', light: '#000000' },
            errorCorrectionLevel: 'M',
        }).then(setQrDataUrl).catch(console.error);
    }, [tvCode]);

    // ── Navigate to PiDisplay on cast received ─────────────────
    const handleCast = useCallback((gameCode: string) => {
        setCastStatus('receiving');
        // Brief flash so user sees "CASTING RECEIVED" before nav
        setTimeout(() => navigate(`/pi-display/${gameCode.toUpperCase()}`), 800);
    }, [navigate]);

    // ── Supabase registration + subscriptions ──────────────────
    useEffect(() => {
        let stopHB: (() => void) | null = null;
        let unsubDisplay: (() => void) | null = null;
        let unsubSignal: (() => void) | null = null;
        let alive = true;

        const boot = async () => {
            try {
                const current = await registerTvDisplay(tvCode);
                if (!alive) return;
                setRegistered(true);

                // Already casting from a previous session — jump straight in
                if (current.game_code && current.status === 'casting') {
                    handleCast(current.game_code);
                    return;
                }

                stopHB = startTvHeartbeat(tvCode);

                unsubDisplay = subscribeTvDisplay(tvCode, (d: TvDisplay) => {
                    if (!alive) return;
                    if (d.game_code && d.status === 'casting') handleCast(d.game_code);
                });

                unsubSignal = subscribeCastSignal(
                    tvCode,
                    (gameCode) => { if (alive) handleCast(gameCode); },
                    () => { /* stop signal — stay on idle */ },
                );
            } catch (err) {
                console.warn('[PiIdleScreen] Supabase boot failed, retrying in 5s', err);
                if (alive) setTimeout(boot, 5000);
            }
        };

        boot();

        return () => {
            alive = false;
            stopHB?.();
            unsubDisplay?.();
            unsubSignal?.();
        };
    }, [tvCode, handleCast]);

    // ── Keyboard: Enter / Space → dashboard ───────────────────
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') onEnterRef.current();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    // ── Render ─────────────────────────────────────────────────
    const receiving = castStatus === 'receiving';

    return (
        <div style={{
            position: 'fixed', inset: 0, background: '#000',
            overflow: 'hidden', userSelect: 'none',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}>
            <style>{`
                @keyframes idle-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
                @keyframes idle-blink { 50%{background:rgba(239,43,45,.15)} }
                @keyframes idle-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
                @keyframes idle-cast {
                    0%{color:#1d6bff} 50%{color:#22e07a} 100%{color:#22e07a}
                }
            `}</style>

            {/* Background grid */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)',
                backgroundSize: '36px 36px',
                WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 50%,#000 30%,transparent 95%)',
                maskImage: 'radial-gradient(ellipse 85% 75% at 50% 50%,#000 30%,transparent 95%)',
            }} />

            {/* Vignette */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 100% 90% at 50% 50%,transparent 50%,rgba(0,0,0,.9) 100%)',
            }} />

            {/* Scanlines */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30,
                backgroundImage: 'repeating-linear-gradient(to bottom,rgba(255,255,255,.018) 0px,rgba(255,255,255,.018) 1px,transparent 1px,transparent 3px)',
                mixBlendMode: 'overlay', opacity: .5,
            }} />

            {/* Corner brackets */}
            {([
                { top: 24, left: 24,  borderRight: 'none', borderBottom: 'none' },
                { top: 24, right: 24, borderLeft: 'none',  borderBottom: 'none' },
                { bottom: 24, left: 24,  borderRight: 'none', borderTop: 'none' },
                { bottom: 24, right: 24, borderLeft: 'none',  borderTop: 'none' },
            ] as const).map((s, i) => (
                <div key={i} style={{
                    position: 'absolute', width: 22, height: 22,
                    border: '2px solid #ef2b2d', pointerEvents: 'none', zIndex: 5, ...s,
                }} />
            ))}

            {/* ── Top rail ── */}
            <div style={{
                position: 'absolute', top: 34, left: 48, right: 48, zIndex: 6,
                display: 'flex', alignItems: 'center', gap: 18, whiteSpace: 'nowrap',
                fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#6a6a6a',
                pointerEvents: 'none',
            }}>
                <div style={{ width: 6, height: 6, background: '#ef2b2d', flexShrink: 0 }} />
                <span style={{ color: '#fff', fontWeight: 700 }}>THE BOX</span>
                <span style={{ color: '#6a6a6a' }}>·</span>
                <span style={{ color: registered ? '#22e07a' : '#6a6a6a' }}>
                    {receiving ? 'CASTING' : 'IDLE'}
                </span>
                <div style={{ flex: 1, height: 1, background: '#262626' }} />
                <span>TV&nbsp;<span style={{ color: '#fff', fontWeight: 700 }}>{tvCode.toUpperCase()}</span></span>
                <span>v3.0_FIELD</span>
            </div>

            {/* ── Main split body ── */}
            <div style={{
                position: 'absolute', top: 72, bottom: 72, left: 48, right: 48,
                display: 'flex', gap: 0,
            }}>

                {/* ─── LEFT PANEL (55%) ─── */}
                <div style={{
                    flex: '0 0 55%', display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', paddingRight: 48, gap: 0,
                }}>

                    {/* Wordmark */}
                    <div style={{
                        fontFamily: "'Archivo', sans-serif", fontStyle: 'italic', fontWeight: 900,
                        fontSize: 'clamp(52px,8vw,82px)', lineHeight: .88,
                        letterSpacing: '-.02em', color: '#fff', textTransform: 'uppercase',
                        marginBottom: 14,
                    }}>
                        THE BOX
                    </div>

                    {/* Subtitle */}
                    <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.38em', textTransform: 'uppercase', color: '#6a6a6a' }}>
                            TABLE-TOP&nbsp;·&nbsp;REFEREE&nbsp;SCORING&nbsp;DEVICE
                        </div>
                        <div style={{ fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#444' }}>
                            BMSCE SPORTS DEPT &amp; ROBOTICS LAB
                        </div>
                    </div>

                    {/* TV Code box */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{
                            fontSize: 9, letterSpacing: '0.38em', textTransform: 'uppercase',
                            color: '#6a6a6a', marginBottom: 8,
                        }}>
                            SCREEN&nbsp;CODE&nbsp;—&nbsp;SHARE WITH HOST TO CAST
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 16,
                            border: '2px solid #1d6bff', background: 'rgba(29,107,255,.07)',
                            padding: '10px 22px',
                        }}>
                            <div style={{
                                width: 8, height: 8, background: '#1d6bff', borderRadius: '50%',
                                animation: registered ? 'none' : 'idle-pulse 1.4s ease-in-out infinite',
                                flexShrink: 0,
                            }} />
                            <span style={{
                                fontFamily: "'Archivo', sans-serif", fontStyle: 'italic', fontWeight: 900,
                                fontSize: 'clamp(38px,5vw,52px)', letterSpacing: '0.1em',
                                color: '#fff', lineHeight: 1,
                            }}>
                                {tvCode.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Cast status line */}
                    <div style={{
                        fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
                        color: receiving ? '#22e07a' : '#1d6bff',
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 28,
                        animation: receiving ? 'idle-cast .6s ease forwards' : 'none',
                    }}>
                        <div style={{
                            width: 5, height: 5,
                            background: receiving ? '#22e07a' : '#1d6bff',
                            borderRadius: '50%',
                            animation: receiving ? 'none' : 'idle-pulse 1.4s ease-in-out infinite',
                            flexShrink: 0,
                        }} />
                        {receiving
                            ? 'CASTING RECEIVED — LOADING…'
                            : 'WAITING FOR CAST SIGNAL…'}
                    </div>

                    {/* Connection indicators */}
                    <div style={{
                        display: 'flex', gap: 20, alignItems: 'center',
                        fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: isOnline ? '#22e07a' : '#6a6a6a' }}>
                            <div style={{
                                width: 4, height: 4, borderRadius: '50%',
                                background: isOnline ? '#22e07a' : '#3a3a3a',
                                boxShadow: isOnline ? '0 0 0 2px rgba(34,224,122,.2)' : 'none',
                            }} />
                            <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: registered ? '#22e07a' : '#6a6a6a' }}>
                            <div style={{
                                width: 4, height: 4, borderRadius: '50%',
                                background: registered ? '#22e07a' : '#3a3a3a',
                                boxShadow: registered ? '0 0 0 2px rgba(34,224,122,.2)' : 'none',
                                animation: !registered ? 'idle-pulse 1.4s ease-in-out infinite' : 'none',
                            }} />
                            <span>{registered ? 'REGISTERED' : 'REGISTERING…'}</span>
                        </div>
                    </div>
                </div>

                {/* ─── Vertical divider ─── */}
                <div style={{
                    width: 1, background: '#1e1e1e', alignSelf: 'stretch',
                    flexShrink: 0, margin: '0 0',
                }} />

                {/* ─── RIGHT PANEL (45%) ─── */}
                <div style={{
                    flex: '0 0 45%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', paddingLeft: 48, gap: 0,
                }}>

                    {/* QR block */}
                    <div style={{
                        position: 'relative', marginBottom: 10,
                        animation: 'idle-fadein .5s ease-out .2s both',
                    }}>
                        <div style={{
                            border: '1px solid #1d6bff',
                            padding: 14,
                            background: 'rgba(29,107,255,.05)',
                            position: 'relative',
                        }}>
                            {/* SETUP_KEY label */}
                            <span style={{
                                position: 'absolute', top: 0, left: 10,
                                transform: 'translateY(-50%)',
                                background: '#000', padding: '0 6px',
                                fontSize: 8, letterSpacing: '0.3em',
                                color: '#1d6bff', textTransform: 'uppercase',
                            }}>
                                SETUP_KEY
                            </span>

                            {qrDataUrl ? (
                                <img
                                    src={qrDataUrl}
                                    width={160} height={160}
                                    style={{ display: 'block', imageRendering: 'pixelated' }}
                                    alt="Setup QR"
                                />
                            ) : (
                                /* Loading placeholder */
                                <div style={{
                                    width: 160, height: 160,
                                    background: 'rgba(29,107,255,.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, letterSpacing: '.2em', color: '#1d6bff',
                                    textTransform: 'uppercase',
                                }}>
                                    GENERATING…
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{
                        fontSize: 9, letterSpacing: '0.32em', color: '#1d6bff',
                        textTransform: 'uppercase', textAlign: 'center', marginBottom: 4,
                    }}>
                        SCAN TO SETUP OR CAST A GAME
                    </div>
                    <div style={{
                        fontSize: 8, letterSpacing: '0.24em', color: '#3a3a3a',
                        textTransform: 'uppercase', textAlign: 'center', marginBottom: 24,
                    }}>
                        theboxbybmsce.in/cast?tv={tvCode.toUpperCase()}
                    </div>

                    {/* OR divider */}
                    <div style={{
                        width: '70%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
                    }}>
                        <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
                        <span style={{ fontSize: 9, letterSpacing: '0.3em', color: '#444' }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
                    </div>

                    {/* Enter Dashboard button */}
                    <button
                        onClick={onEnter}
                        style={{
                            border: '1px solid #ef2b2d',
                            background: 'rgba(239,43,45,.08)',
                            padding: '14px 24px',
                            cursor: 'pointer',
                            fontSize: 11, letterSpacing: '0.32em',
                            textTransform: 'uppercase', color: '#fff',
                            fontFamily: "'JetBrains Mono', monospace",
                            display: 'flex', flexDirection: 'column',
                            gap: 6, alignItems: 'center',
                            minWidth: 180,
                            animation: 'idle-fadein .5s ease-out .4s both',
                        }}
                    >
                        <span style={{
                            border: '1px solid #ef2b2d',
                            padding: '4px 10px',
                            fontSize: 13, letterSpacing: '0.2em',
                            color: '#ef2b2d', fontWeight: 700,
                            boxShadow: 'inset 0 -2px 0 rgba(239,43,45,.4)',
                            animation: 'idle-blink 1.4s steps(2) infinite',
                        }}>
                            ⏎ ENTER
                        </span>
                        <span>ENTER DASHBOARD</span>
                        <small style={{ color: '#6a6a6a', fontSize: 9, letterSpacing: '0.28em' }}>
                            OR PRESS ANY BUTTON
                        </small>
                    </button>
                </div>
            </div>

            {/* ── Bottom rail ── */}
            <div style={{
                position: 'absolute', bottom: 34, left: 48, right: 48, zIndex: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase',
                color: '#6a6a6a', pointerEvents: 'none',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 6, height: 6, background: '#1d6bff', flexShrink: 0 }} />
                    <span>BMSCE&nbsp;·&nbsp;SPORTS DEPT &amp; ROBOTICS LAB</span>
                </div>
                <div style={{ flex: 1, height: 1, background: '#262626', margin: '0 18px' }} />
                <span>theboxbybmsce.in</span>
            </div>
        </div>
    );
};

export default PiIdleScreen;
