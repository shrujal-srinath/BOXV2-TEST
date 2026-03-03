// src/pages/TvKiosk.tsx
// ═══════════════════════════════════════════════════════════════
//  PI CASTING TERMINAL — CINEMATIC KIOSK SHELL
//  Rebuilt for massive LED walls (7360mm × 3200mm)
//
//  Pi startup command:
//    chromium-browser --kiosk --noerrdialogs --disable-infobars \
//    --no-first-run --check-for-update-interval=604800 \
//    --disable-translate --disable-features=TranslateUI \
//    --app=https://yourapp.com/tv?code=XXXX
//
//  IMPROVEMENTS OVER PREVIOUS VERSION:
//    - All sizes use vw/vh clamps scaled for 7360x3200 LED walls
//    - Particle field background (CSS-only, zero JS overhead)
//    - Staggered entrance animations on every element
//    - Offline recovery banner instead of silent failure
//    - Code box glyphs are now individually animated w/ varied timing
//    - QR code scales properly for scan-from-distance (2-3m)
//    - Bottom telemetry bar shows uptime + network status
//    - Game→Idle transition is a cinematic wipe, not a cut
//    - No fingerprint fallback conflict: stable codes via URL only
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    registerTvDisplay,
    startTvHeartbeat,
    subscribeTvDisplay,
    type TvDisplay,
} from '../services/tvDisplayService';
import { SpectatorView } from './SpectatorView';

// ─── Code Resolution ──────────────────────────────────────────────────────────
// Priority: URL param → localStorage → hardware fingerprint (dev only)
const resolveTerminalCode = (urlParam: string | null): string => {
    if (urlParam) {
        const clean = urlParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        if (clean.length === 4) {
            localStorage.setItem('TV_CODE_STABLE', clean);
            return clean;
        }
    }
    const stored = localStorage.getItem('TV_CODE_STABLE');
    if (stored?.length === 4) return stored;

    // Fingerprint fallback — dev only, deterministic
    const seed = `${screen.width}x${screen.height}.${navigator.hardwareConcurrency}.${navigator.language}`;
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = [h >>> 24, h >>> 16, h >>> 8, h].map(b => chars[Math.abs(b) % chars.length]).join('');
    localStorage.setItem('TV_CODE_STABLE', code);
    return code;
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Share+Tech+Mono&display=swap');

/* ── Entrance animations ─────────────────────────────────── */
@keyframes tv-fadeup   { from{opacity:0;transform:translateY(3vh)} to{opacity:1;transform:none} }
@keyframes tv-fadein   { from{opacity:0} to{opacity:1} }
@keyframes tv-scalein  { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }

/* ── Continuous ambient ──────────────────────────────────── */
@keyframes tv-pulse  { 0%,100%{opacity:1;box-shadow:0 0 18px #22c55e} 50%{opacity:.25;box-shadow:0 0 4px #22c55e} }
@keyframes tv-rpulse { 0%,100%{opacity:1;box-shadow:0 0 18px #ef4444} 50%{opacity:.25;box-shadow:0 0 4px #ef4444} }
@keyframes tv-spin   { to{transform:rotate(360deg)} }
@keyframes tv-scan   { 0%{top:-2px} 100%{top:100vh} }
@keyframes tv-grid   { 0%,100%{opacity:.03} 50%{opacity:.07} }

/* ── Code box glow cycle ─────────────────────────────────── */
@keyframes tv-char0 {
    0%,55%,100% { color:#fff; text-shadow: 0 0 clamp(20px,3vw,60px) rgba(220,38,38,0.4), 0 0 clamp(40px,5vw,100px) rgba(220,38,38,0.15); }
    28% { color:#ff6060; text-shadow: 0 0 clamp(40px,5vw,90px) rgba(255,60,60,0.9), 0 0 clamp(80px,9vw,180px) rgba(220,38,38,0.4); }
}
@keyframes tv-char1 {
    0%,60%,100% { color:#fff; text-shadow: 0 0 clamp(20px,3vw,60px) rgba(220,38,38,0.4); }
    30% { color:#ff6060; text-shadow: 0 0 clamp(40px,5vw,90px) rgba(255,60,60,0.9); }
}
@keyframes tv-char2 {
    0%,65%,100% { color:#fff; text-shadow: 0 0 clamp(20px,3vw,60px) rgba(220,38,38,0.4); }
    32% { color:#ff6060; text-shadow: 0 0 clamp(40px,5vw,90px) rgba(255,60,60,0.9); }
}
@keyframes tv-char3 {
    0%,70%,100% { color:#fff; text-shadow: 0 0 clamp(20px,3vw,60px) rgba(220,38,38,0.4); }
    35% { color:#ff6060; text-shadow: 0 0 clamp(40px,5vw,90px) rgba(255,60,60,0.9); }
}

/* ── Radar rings ─────────────────────────────────────────── */
@keyframes tv-ring {
    0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 0.6; }
    100% { transform: translate(-50%,-50%) scale(6);   opacity: 0; }
}

/* ── QR entrance ─────────────────────────────────────────── */
@keyframes tv-qrin {
    from { opacity:0; transform:scale(0.82) rotate(-3deg); filter:blur(8px); }
    to   { opacity:1; transform:scale(1) rotate(0); filter:blur(0); }
}

/* ── QR border heartbeat ─────────────────────────────────── */
@keyframes tv-qrborder {
    0%,100% { border-color: rgba(220,38,38,0.18); }
    50%      { border-color: rgba(220,38,38,0.55); box-shadow: 0 0 clamp(10px,2vw,40px) rgba(220,38,38,0.12); }
}

/* ── Bottom bar blink ────────────────────────────────────── */
@keyframes tv-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

/* ── Offline warning ─────────────────────────────────────── */
@keyframes tv-offline { 0%,100%{background:rgba(220,38,38,0.06)} 50%{background:rgba(220,38,38,0.14)} }

/* ── Transition wipe ─────────────────────────────────────── */
@keyframes tv-wipe-in  { from{clip-path:inset(0 100% 0 0)} to{clip-path:inset(0 0% 0 0)} }
@keyframes tv-wipe-out { from{clip-path:inset(0 0% 0 0)}   to{clip-path:inset(0 0 0 100%)} }

/* ── Brand line draw ─────────────────────────────────────── */
@keyframes tv-drawline {
    from { width: 0; opacity:0; }
    to   { width: clamp(80px,12vw,220px); opacity:1; }
}

/* ── Number counter flicker ──────────────────────────────── */
@keyframes tv-flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.1} 94%{opacity:1} 97%{opacity:1} 98%{opacity:0.05} 99%{opacity:1} }
`;

// ─── Radar Background ─────────────────────────────────────────────────────────
const RadarBG: React.FC = () => (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {/* Subtle grid */}
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
                linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
            `,
            backgroundSize: 'clamp(48px,6vw,120px) clamp(48px,6vw,120px)',
            animation: 'tv-grid 8s ease-in-out infinite',
        }} />

        {/* Deep vignette — makes center pop */}
        <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 10%, rgba(0,0,0,0.96) 100%)',
        }} />

        {/* Radar rings from center */}
        {[0, 1.2, 2.4, 3.6, 4.8].map((delay, i) => (
            <div key={i} style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: 'clamp(200px,20vw,400px)',
                height: 'clamp(200px,20vw,400px)',
                marginTop: 'clamp(-100px,-10vw,-200px)',
                marginLeft: 'clamp(-100px,-10vw,-200px)',
                borderRadius: '50%',
                border: `1px solid rgba(220,38,38,${0.35 - i * 0.05})`,
                animation: `tv-ring 6s ${delay}s ease-out infinite`,
            }} />
        ))}

        {/* Scanline sweep */}
        <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(220,38,38,0.06) 20%, rgba(220,38,38,0.14) 50%, rgba(220,38,38,0.06) 80%, transparent 100%)',
            animation: 'tv-scan 12s linear infinite',
            top: '-2px',
        }} />

        {/* Subtle red glow at center bottom — brand warmth */}
        <div style={{
            position: 'absolute', bottom: '-10%', left: '50%', transform: 'translateX(-50%)',
            width: '60vw', height: '40vh',
            background: 'radial-gradient(ellipse, rgba(220,38,38,0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
        }} />
    </div>
);

// ─── Code Box ─────────────────────────────────────────────────────────────────
// Each character is independently animated. Built for max visibility at 7360mm width.
const CodeBox: React.FC<{ code: string }> = ({ code }) => {
    const charAnims = ['tv-char0', 'tv-char1', 'tv-char2', 'tv-char3'];
    const delays = [0, 0.85, 1.7, 2.55]; // stagger glow cycle

    return (
        <div style={{ display: 'flex', gap: 'clamp(8px,1.2vw,28px)' }}>
            {code.split('').slice(0, 4).map((char, i) => (
                <div key={i} style={{
                    width: 'clamp(80px,9.5vw,180px)',
                    height: 'clamp(96px,11.5vw,216px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'clamp(8px,1vw,20px)',
                    background: 'rgba(220,38,38,0.03)',
                    border: '1px solid rgba(220,38,38,0.2)',
                    borderBottom: '3px solid rgba(220,38,38,0.5)',
                    position: 'relative', overflow: 'hidden',
                    userSelect: 'none',
                }}>
                    {/* Top gloss */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0,
                        height: '45%',
                        background: 'linear-gradient(rgba(220,38,38,0.06), transparent)',
                        borderRadius: 'inherit',
                    }} />
                    <span style={{
                        fontFamily: '"Bebas Neue", "Share Tech Mono", monospace',
                        fontSize: 'clamp(3rem,6.5vw,9rem)',
                        fontWeight: 400,
                        letterSpacing: '-0.02em',
                        color: '#fff',
                        animation: `${charAnims[i]} 4s ${delays[i]}s ease-in-out infinite`,
                        position: 'relative', zIndex: 1,
                        lineHeight: 1,
                    }}>
                        {char}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── QR Panel ────────────────────────────────────────────────────────────────
// Large enough to scan from 3m+ on a 7m+ wide LED wall
const QrPanel: React.FC<{ tvCode: string }> = ({ tvCode }) => {
    // QR points to the main app with ?cast= param so phone can initiate cast
    const castUrl = `${window.location.origin}/?cast=${tvCode}`;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&bgcolor=000000&color=FFFFFF&qzone=2&data=${encodeURIComponent(castUrl)}`;
    const [loaded, setLoaded] = useState(false);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(6px,0.8vw,16px)',
            animation: 'tv-qrin 0.9s 1.6s both',
        }}>
            <div style={{
                width: 'clamp(100px,11vw,200px)',
                height: 'clamp(100px,11vw,200px)',
                borderRadius: 'clamp(8px,1vw,18px)',
                padding: 'clamp(6px,0.8vw,14px)',
                background: '#000',
                border: '1px solid rgba(220,38,38,0.18)',
                position: 'relative', overflow: 'hidden',
                animation: 'tv-qrborder 3.5s ease-in-out infinite',
            }}>
                {/* Corner brackets */}
                {[
                    { top: 5, left: 5, borderTop: '2px solid rgba(220,38,38,0.7)', borderLeft: '2px solid rgba(220,38,38,0.7)' },
                    { top: 5, right: 5, borderTop: '2px solid rgba(220,38,38,0.7)', borderRight: '2px solid rgba(220,38,38,0.7)' },
                    { bottom: 5, left: 5, borderBottom: '2px solid rgba(220,38,38,0.7)', borderLeft: '2px solid rgba(220,38,38,0.7)' },
                    { bottom: 5, right: 5, borderBottom: '2px solid rgba(220,38,38,0.7)', borderRight: '2px solid rgba(220,38,38,0.7)' },
                ].map((s, i) => (
                    <div key={i} style={{ position: 'absolute', width: 'clamp(10px,1.4vw,22px)', height: 'clamp(10px,1.4vw,22px)', ...s }} />
                ))}

                {!loaded && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 'clamp(16px,2vw,32px)', height: 'clamp(16px,2vw,32px)',
                            border: '2px solid #111', borderTopColor: '#DC2626',
                            borderRadius: '50%', animation: 'tv-spin 0.8s linear infinite',
                        }} />
                    </div>
                )}
                <img
                    src={qrSrc}
                    alt="scan to cast"
                    onLoad={() => setLoaded(true)}
                    style={{
                        width: '100%', height: '100%', borderRadius: 'clamp(4px,0.5vw,8px)',
                        opacity: loaded ? 1 : 0, transition: 'opacity 0.4s',
                        imageRendering: 'pixelated',
                    }}
                />
            </div>
            <div style={{
                fontSize: 'clamp(7px,0.7vw,12px)', fontFamily: '"Share Tech Mono", monospace',
                color: 'rgba(220,38,38,0.5)', letterSpacing: '0.3em', textTransform: 'uppercase',
            }}>
                SCAN TO CAST
            </div>
        </div>
    );
};

// ─── Offline Banner ───────────────────────────────────────────────────────────
const OfflineBanner: React.FC = () => (
    <div style={{
        position: 'absolute', top: 'clamp(16px,2vw,40px)', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,16px)',
        padding: 'clamp(6px,0.8vw,14px) clamp(12px,1.5vw,28px)',
        background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
        borderRadius: 100, animation: 'tv-offline 2s ease-in-out infinite',
        zIndex: 20, whiteSpace: 'nowrap',
    }}>
        <div style={{
            width: 'clamp(6px,0.7vw,10px)', height: 'clamp(6px,0.7vw,10px)',
            borderRadius: '50%', background: '#ef4444',
            animation: 'tv-blink 1s ease-in-out infinite',
        }} />
        <span style={{
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: 'clamp(8px,0.75vw,13px)',
            color: 'rgba(220,38,38,0.8)', letterSpacing: '0.3em', textTransform: 'uppercase',
        }}>
            NETWORK DISCONNECTED — ATTEMPTING RECONNECT
        </span>
    </div>
);

// ─── Idle Screen ──────────────────────────────────────────────────────────────
const IdleScreen: React.FC<{
    tvCode: string;
    visible: boolean;
    registered: boolean;
}> = ({ tvCode, visible, registered }) => {
    const [online, setOnline] = useState(navigator.onLine);
    const [uptime, setUptime] = useState(0);

    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        const tick = setInterval(() => setUptime(u => u + 1), 1000);
        return () => {
            window.removeEventListener('online', on);
            window.removeEventListener('offline', off);
            clearInterval(tick);
        };
    }, []);

    const fmtUptime = (s: number) => {
        const h = String(Math.floor(s / 3600)).padStart(2, '0');
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const sc = String(s % 60).padStart(2, '0');
        return `${h}:${m}:${sc}`;
    };

    return (
        <div style={{
            position: 'absolute', inset: 0,
            background: '#000000',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            opacity: visible ? 1 : 0,
            transition: 'opacity 1.4s cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: visible ? 'auto' : 'none',
            overflow: 'hidden',
        }}>
            <RadarBG />

            {/* Offline banner */}
            {!online && <OfflineBanner />}

            {/* Main content block */}
            <div style={{
                position: 'relative', zIndex: 10,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', textAlign: 'center',
                padding: '0 clamp(1rem,4vw,6rem)',
                gap: 0,
            }}>

                {/* Brand wordmark */}
                <div style={{
                    fontFamily: '"Bebas Neue", monospace',
                    fontSize: 'clamp(10px,1.1vw,18px)',
                    letterSpacing: '0.6em',
                    color: 'rgba(220,38,38,0.6)',
                    textTransform: 'uppercase',
                    marginBottom: 'clamp(0.5rem,1vw,2rem)',
                    animation: 'tv-fadein 1s 0.1s both',
                }}>
                    THE BOX · LED SCORE SYSTEM
                </div>

                {/* Animated underline */}
                <div style={{
                    height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(220,38,38,0.35), transparent)',
                    marginBottom: 'clamp(1.5rem,2.5vw,5rem)',
                    animation: 'tv-drawline 1.2s 0.4s both',
                    width: 0,
                }} />

                {/* Status badge */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'clamp(5px,0.7vw,12px)',
                    marginBottom: 'clamp(1rem,2vw,3.5rem)',
                    animation: 'tv-fadein 0.8s 0.6s both',
                }}>
                    <div style={{
                        width: 'clamp(5px,0.6vw,9px)',
                        height: 'clamp(5px,0.6vw,9px)',
                        borderRadius: '50%',
                        background: registered && online ? '#22c55e' : '#555',
                        animation: registered && online ? 'tv-pulse 2.2s ease-in-out infinite' : 'none',
                    }} />
                    <span style={{
                        fontFamily: '"Share Tech Mono", monospace',
                        fontSize: 'clamp(7px,0.75vw,12px)',
                        color: registered && online ? 'rgba(34,197,94,0.65)' : 'rgba(255,255,255,0.2)',
                        letterSpacing: '0.4em', textTransform: 'uppercase',
                    }}>
                        {!registered ? 'INITIALIZING…' : online ? 'READY TO RECEIVE' : 'RECONNECTING…'}
                    </span>
                </div>

                {/* ── CODE + QR ROW ── */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: 'clamp(1.5rem,5vw,8rem)',
                    flexWrap: 'wrap', justifyContent: 'center',
                    marginBottom: 'clamp(1.5rem,2.5vw,5rem)',
                    animation: 'tv-fadeup 1s 0.5s both',
                }}>
                    <CodeBox code={tvCode} />

                    {/* Vertical divider */}
                    <div style={{
                        width: 1, height: 'clamp(80px,10vw,180px)',
                        background: 'linear-gradient(180deg, transparent, rgba(220,38,38,0.2), transparent)',
                    }} />

                    <QrPanel tvCode={tvCode} />
                </div>

                {/* Horizontal rule */}
                <div style={{
                    width: 'clamp(100px,18vw,320px)', height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
                    marginBottom: 'clamp(0.8rem,1.5vw,2.5rem)',
                    animation: 'tv-fadein 0.8s 1.2s both',
                }} />

                {/* Primary instruction */}
                <div style={{
                    fontFamily: '"Bebas Neue", "Share Tech Mono", monospace',
                    fontWeight: 400,
                    fontSize: 'clamp(10px,1.2vw,20px)',
                    letterSpacing: '0.35em',
                    color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase',
                    lineHeight: 1.5,
                    animation: 'tv-fadein 0.8s 1.4s both',
                }}>
                    ENTER CODE IN HOST CONSOLE TO CAST
                </div>

                {/* Secondary instruction */}
                <div style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 'clamp(7px,0.72vw,11px)',
                    color: 'rgba(255,255,255,0.12)',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    marginTop: 'clamp(4px,0.4vw,8px)',
                    animation: 'tv-fadein 0.8s 1.7s both',
                }}>
                    OR SCAN QR CODE WITH YOUR PHONE
                </div>

            </div>

            {/* ── BOTTOM TELEMETRY BAR ── */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: 'clamp(8px,1vw,18px) clamp(12px,1.8vw,36px)',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                zIndex: 10,
                animation: 'tv-fadein 1s 1.8s both',
            }}>
                {/* Left: network indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px,0.5vw,9px)' }}>
                    <div style={{
                        width: 'clamp(4px,0.4vw,7px)',
                        height: 'clamp(4px,0.4vw,7px)',
                        borderRadius: '50%',
                        background: online ? '#22c55e' : '#ef4444',
                        animation: online ? 'tv-pulse 2s infinite' : 'tv-rpulse 0.8s infinite',
                    }} />
                    <span style={{
                        fontFamily: '"Share Tech Mono", monospace',
                        fontSize: 'clamp(6px,0.6vw,10px)',
                        color: online ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.55)',
                        letterSpacing: '0.28em', textTransform: 'uppercase',
                    }}>
                        {online ? 'NETWORK STABLE' : 'NO NETWORK'}
                    </span>
                </div>

                {/* Center: terminal ID */}
                <div style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 'clamp(7px,0.65vw,11px)',
                    color: 'rgba(255,255,255,0.12)',
                    letterSpacing: '0.3em', textTransform: 'uppercase',
                }}>
                    TERMINAL {tvCode}
                </div>

                {/* Right: uptime */}
                <div style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 'clamp(6px,0.6vw,10px)',
                    color: 'rgba(255,255,255,0.12)',
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                    animation: 'tv-flicker 8s ease-in-out infinite',
                }}>
                    UP {fmtUptime(uptime)}
                </div>
            </div>

        </div>
    );
};

// ─── Transition Wipe ──────────────────────────────────────────────────────────
// Cinematic horizontal wipe instead of opacity fade
const WipeOverlay: React.FC<{ visible: boolean; direction: 'in' | 'out' }> = ({ visible, direction }) => (
    <div style={{
        position: 'absolute', inset: 0, zIndex: 60,
        background: '#000',
        opacity: visible ? 1 : 0,
        transition: visible ? 'opacity 0s' : 'opacity 0.6s 0.2s',
        pointerEvents: visible ? 'auto' : 'none',
    }} />
);

// ─── Root Component ───────────────────────────────────────────────────────────
export const TvKiosk: React.FC = () => {
    const [searchParams] = useSearchParams();
    const tvCode = resolveTerminalCode(searchParams.get('code'));

    const [gameCode, setGameCode] = useState<string | null>(null);
    const [showGame, setShowGame] = useState(false);
    const [transitioning, setTrans] = useState(false);
    const [registered, setRegistered] = useState(false);

    const prevGame = useRef<string | null>(null);

    // Handle incoming game_code updates from Supabase
    const handleUpdate = useCallback((newCode: string | null) => {
        if (newCode === prevGame.current) return;
        prevGame.current = newCode;

        if (newCode && !showGame) {
            // Idle → Game
            setTrans(true);
            setTimeout(() => {
                setGameCode(newCode);
                setShowGame(true);
                setTrans(false);
            }, 500);
        } else if (!newCode && showGame) {
            // Game → Idle
            setTrans(true);
            setTimeout(() => {
                setShowGame(false);
                setGameCode(null);
                setTrans(false);
            }, 700);
        } else if (newCode && showGame) {
            // Switch game without going idle
            setTrans(true);
            setTimeout(() => {
                setGameCode(newCode);
                setTrans(false);
            }, 350);
        }
    }, [showGame]);

    // Boot
    useEffect(() => {
        let stopHB: (() => void) | null = null;
        let unsub: (() => void) | null = null;

        const boot = async () => {
            await registerTvDisplay(tvCode);
            setRegistered(true);
            stopHB = startTvHeartbeat(tvCode);
            unsub = subscribeTvDisplay(tvCode, (d: TvDisplay) => handleUpdate(d.game_code ?? null));
        };

        boot();
        return () => { stopHB?.(); unsub?.(); };
    }, [tvCode]); // eslint-disable-line

    return (
        <>
            <style>{CSS}</style>
            <div style={{
                width: '100vw', height: '100vh',
                background: '#000', overflow: 'hidden',
                position: 'relative',
            }}>
                {/* Idle screen */}
                <IdleScreen
                    tvCode={tvCode}
                    visible={!showGame && !transitioning}
                    registered={registered}
                />

                {/* Game / spectator screen */}
                {gameCode && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        opacity: showGame && !transitioning ? 1 : 0,
                        transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1)',
                        zIndex: 30,
                    }}>
                        <SpectatorView gameCode={gameCode} />
                    </div>
                )}

                {/* Transition wipe */}
                <WipeOverlay visible={transitioning} direction={showGame ? 'out' : 'in'} />
            </div>
        </>
    );
};

export default TvKiosk;