// src/pages/PiReceiverSetup.tsx
// Receiver setup — enter a game code OR wait for a cast from the website.
// No Tailwind. Inline styles only.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
    registerTvDisplay,
    startTvHeartbeat,
    subscribeTvDisplay,
    subscribeCastSignal,
    type TvDisplay,
} from '../services/tvDisplayService';

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800&display=swap');

@keyframes pr-waiting {
  0%, 100% { opacity: 0.3; }
  50%       { opacity: 0.7; }
}

@keyframes pr-scan {
  0%   { left: 0%; width: 40%; }
  50%  { left: 60%; width: 40%; }
  100% { left: 100%; width: 0%; }
}

@keyframes pr-key-flash {
  0%   { color: #F59E0B; }
  100% { color: #555; }
}
`;

// Keyboard charset matches TvKiosk's generation charset (omits O, I, 0, 1)
const KEYBOARD_ROWS: string[][] = [
    ['A','B','C','D','E','F','G','H','J','K','L','M'],
    ['N','P','Q','R','S','T','U','V','W','X','Y','Z'],
    ['2','3','4','5','6','7','8','9'],
];

const PiReceiverSetup: React.FC = () => {
    const navigate = useNavigate();

    // ── tvCode — persisted in localStorage, same key as TvKiosk ──────────────
    const [tvCode] = useState<string>(() => {
        const saved = localStorage.getItem('tv_kiosk_code');
        if (saved) return saved;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let newCode = '';
        for (let i = 0; i < 4; i++) {
            newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        localStorage.setItem('tv_kiosk_code', newCode);
        return newCode;
    });

    const [inputCode, setInputCode] = useState('');
    const [flashedKey, setFlashedKey] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [registered, setRegistered] = useState(false);

    // ── QR generation ─────────────────────────────────────────────────────────
    useEffect(() => {
        QRCode.toDataURL(tvCode, {
            width: 200,
            margin: 2,
            color: { dark: '#FFFFFF', light: '#000000' },
        }).then(setQrDataUrl).catch(console.error);
    }, [tvCode]);

    // ── Cast navigation helper ─────────────────────────────────────────────────
    const navigateToGame = useCallback((code: string) => {
        navigate(`/pi-display/${code.toUpperCase()}`);
    }, [navigate]);

    // ── Supabase registration + subscriptions ─────────────────────────────────
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

                if (current.game_code && current.status === 'casting') {
                    navigateToGame(current.game_code);
                    return;
                }

                stopHB = startTvHeartbeat(tvCode);

                unsubDisplay = subscribeTvDisplay(tvCode, (d: TvDisplay) => {
                    if (!alive) return;
                    if (d.game_code && d.status === 'casting') {
                        navigateToGame(d.game_code);
                    }
                });

                unsubSignal = subscribeCastSignal(
                    tvCode,
                    (gameCode) => { if (alive) navigateToGame(gameCode); },
                    () => { /* stop signal — we're already on setup screen */ },
                );
            } catch (err) {
                console.warn('[PiReceiverSetup] boot failed, retrying in 5s', err);
                const retryTimer = setTimeout(boot, 5000);
                return () => clearTimeout(retryTimer);
            }
        };

        boot();

        return () => {
            alive = false;
            stopHB?.();
            unsubDisplay?.();
            unsubSignal?.();
        };
    }, [tvCode, navigateToGame]);

    // ── Keyboard handlers ─────────────────────────────────────────────────────
    const handleKeyPress = (char: string) => {
        if (inputCode.length >= 4) return;
        setFlashedKey(char);
        setTimeout(() => setFlashedKey(null), 150);
        setInputCode(prev => prev + char);
    };

    const handleBackspace = () => {
        setInputCode(prev => prev.slice(0, -1));
    };

    const handleConfirm = () => {
        if (inputCode.length === 4) {
            navigate(`/pi-display/${inputCode.toUpperCase()}`);
        }
    };

    // ── Styles ────────────────────────────────────────────────────────────────
    const root: React.CSSProperties = {
        width: '100vw', height: '100vh',
        background: '#080808',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Barlow Condensed', sans-serif",
        position: 'relative',
        userSelect: 'none',
    };

    const backBtn: React.CSSProperties = {
        position: 'absolute', top: 14, left: 18, zIndex: 20,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 600, fontSize: 11,
        letterSpacing: '0.15em', color: '#222',
        background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px 8px',
    };

    const body: React.CSSProperties = {
        flex: 1, display: 'flex', minHeight: 0,
    };

    const panelBase: React.CSSProperties = {
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '28px 32px 24px',
        position: 'relative', overflow: 'hidden',
    };

    const panelHeaderStyle: React.CSSProperties = {
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 13,
        letterSpacing: '0.35em', color: '#444',
        textTransform: 'uppercase' as const,
        marginBottom: 'auto',
    };

    const bigLabelStyle = (color: string): React.CSSProperties => ({
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, fontStyle: 'italic',
        fontSize: 72, lineHeight: 0.9,
        color,
        marginBottom: 20,
    });

    return (
        <>
            <style>{FONT_CSS}</style>
            <div style={root}>
                {/* Back button */}
                <button
                    style={backBtn}
                    onClick={() => navigate('/pi-launcher')}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = '#444'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = '#222'; }}
                >
                    ← BACK
                </button>

                <div style={body}>
                    {/* ── LEFT PANEL: Enter Code ─────────────────────────────── */}
                    <div style={panelBase}>
                        <div style={{ ...panelHeaderStyle, paddingTop: 4 }}>WATCH GAME</div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 16 }}>
                            {/* Big label */}
                            <div style={bigLabelStyle('#F59E0B')}>
                                <div>ENTER</div>
                                <div>CODE</div>
                            </div>

                            {/* 4 input digit boxes */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        width: 60, height: 80,
                                        background: '#0a0a0a',
                                        border: `1px solid ${i === inputCode.length ? '#F59E0B' : '#1a1a1a'}`,
                                        borderRadius: 6,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: "'Barlow Condensed', sans-serif",
                                        fontWeight: 800, fontSize: 36,
                                        color: inputCode[i] ? '#F59E0B' : '#1a1a1a',
                                        transition: 'border-color 150ms ease',
                                    }}>
                                        {inputCode[i] || '·'}
                                    </div>
                                ))}
                            </div>

                            {/* Keyboard rows */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {KEYBOARD_ROWS.map((row, rowIdx) => (
                                    <div key={rowIdx} style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                                        {row.map(char => (
                                            <button
                                                key={char}
                                                onClick={() => handleKeyPress(char)}
                                                style={{
                                                    width: 44, height: 44,
                                                    background: '#0d0d0d',
                                                    border: '1px solid #1a1a1a',
                                                    borderRadius: 5,
                                                    fontFamily: "'Barlow Condensed', sans-serif",
                                                    fontWeight: 600, fontSize: 16,
                                                    color: flashedKey === char ? '#F59E0B' : '#555',
                                                    cursor: 'pointer',
                                                    transition: 'color 150ms ease',
                                                    padding: 0,
                                                }}
                                            >
                                                {char}
                                            </button>
                                        ))}
                                    </div>
                                ))}

                                {/* Action row */}
                                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                    <button
                                        onClick={handleBackspace}
                                        style={{
                                            width: 80, height: 44,
                                            background: '#0d0d0d',
                                            border: '1px solid #1a1a1a',
                                            borderRadius: 5,
                                            fontFamily: "'Barlow Condensed', sans-serif",
                                            fontWeight: 600, fontSize: 13,
                                            letterSpacing: '0.1em',
                                            color: '#444',
                                            cursor: 'pointer',
                                            padding: 0,
                                        }}
                                    >
                                        ← DEL
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={inputCode.length < 4}
                                        style={{
                                            flex: 1, height: 44,
                                            background: inputCode.length === 4 ? '#F59E0B' : '#0d0d0d',
                                            border: `1px solid ${inputCode.length === 4 ? '#F59E0B' : '#1a1a1a'}`,
                                            borderRadius: 5,
                                            fontFamily: "'Barlow Condensed', sans-serif",
                                            fontWeight: 700, fontSize: 14,
                                            letterSpacing: '0.2em',
                                            color: inputCode.length === 4 ? '#000' : '#222',
                                            cursor: inputCode.length === 4 ? 'pointer' : 'default',
                                            transition: 'all 150ms ease',
                                            padding: 0,
                                        }}
                                    >
                                        CONFIRM
                                    </button>
                                </div>

                                {/* LOCAL DISPLAY — connects to Pi daemon directly (LAN, no internet) */}
                                <button
                                    onClick={() => navigate('/pi-local-display')}
                                    style={{
                                        width: '100%', height: 44, marginTop: 8,
                                        background: '#0d0d0d',
                                        border: '1px solid #22c55e44',
                                        borderRadius: 5,
                                        fontFamily: "'Barlow Condensed', sans-serif",
                                        fontWeight: 700, fontSize: 12,
                                        letterSpacing: '0.22em',
                                        color: '#22c55e',
                                        cursor: 'pointer',
                                        padding: 0,
                                        textTransform: 'uppercase' as const,
                                    }}
                                >
                                    ⚡ LOCAL DISPLAY (LAN)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Panel separator */}
                    <div style={{ width: 1, background: '#111', flexShrink: 0 }} />

                    {/* ── RIGHT PANEL: Cast to this Pi ───────────────────────── */}
                    <div style={{ ...panelBase, alignItems: 'center' }}>
                        {/* Status indicator */}
                        <div style={{
                            position: 'absolute', top: 18, right: 20,
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: registered ? '#22c55e' : '#333',
                            }} />
                            <span style={{
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontWeight: 600, fontSize: 9,
                                letterSpacing: '0.25em', color: registered ? '#22c55e' : '#2a2a2a',
                                textTransform: 'uppercase' as const,
                            }}>
                                {registered ? 'ONLINE' : 'CONNECTING…'}
                            </span>
                        </div>

                        <div style={{ ...panelHeaderStyle, alignSelf: 'flex-start', paddingTop: 4 }}>CAST TO THIS SCREEN</div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, width: '100%' }}>
                            {/* Big label */}
                            <div style={{ ...bigLabelStyle('#3B82F6'), textAlign: 'center' as const }}>
                                <div>SCREEN</div>
                                <div>CODE</div>
                            </div>

                            {/* TV code large */}
                            <div style={{
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontWeight: 900, fontSize: 80,
                                color: '#fff', letterSpacing: '0.2em',
                                lineHeight: 1,
                            }}>
                                {tvCode}
                            </div>

                            {/* QR code */}
                            {qrDataUrl ? (
                                <img
                                    src={qrDataUrl}
                                    alt={`TV code ${tvCode}`}
                                    style={{
                                        width: 160, height: 160,
                                        borderRadius: 8,
                                        imageRendering: 'pixelated' as const,
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: 160, height: 160,
                                    background: '#0a0a0a',
                                    borderRadius: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <div style={{
                                        width: 20, height: 20,
                                        border: '2px solid #1a1a1a',
                                        borderTopColor: '#3B82F6',
                                        borderRadius: '50%',
                                        animation: 'pr-scan 1s linear infinite',
                                    }} />
                                </div>
                            )}

                            {/* Waiting text */}
                            <div style={{
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontWeight: 400, fontSize: 11,
                                letterSpacing: '0.2em', color: '#333',
                                textTransform: 'uppercase' as const,
                                animation: 'pr-waiting 2s ease-in-out infinite',
                            }}>
                                Waiting for cast…
                            </div>
                        </div>

                        {/* Alive indicator bar */}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            height: 4, background: 'rgba(59,130,246,0.2)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, height: '100%',
                                width: '30%', background: 'rgba(59,130,246,0.7)',
                                animation: 'pr-scan 3s linear infinite',
                            }} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PiReceiverSetup;
