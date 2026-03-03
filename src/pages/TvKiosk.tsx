// src/pages/TvKiosk.tsx
// ═══════════════════════════════════════════════════════════════
//  PI CASTING TERMINAL — CINEMATIC KIOSK SHELL
//  Pi startup command:
//    chromium-browser --kiosk --noerrdialogs --disable-infobars \
//    --no-first-run --check-for-update-interval=604800 \
//    --app=https://yourapp.com/tv?code=XXXX
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    registerTvDisplay, startTvHeartbeat, subscribeTvDisplay, type TvDisplay,
} from '../services/tvDisplayService';
import { SpectatorView } from './SpectatorView';

// ─── Stable Code Resolution ───────────────────────────────────────────────────
const resolveTerminalCode = (urlParam: string | null): string => {
    if (urlParam) {
        const clean = urlParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        if (clean.length === 4) {
            localStorage.setItem('TERMINAL_CODE_STABLE', clean);
            return clean;
        }
    }
    const stored = localStorage.getItem('TERMINAL_CODE_STABLE');
    if (stored && stored.length === 4) return stored;
    // Fingerprint fallback (dev only)
    const seed = `${screen.width}x${screen.height}.${navigator.hardwareConcurrency}.${navigator.language}`;
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = [h >>> 24, h >>> 16, h >>> 8, h].map(b => chars[Math.abs(b) % chars.length]).join('');
    localStorage.setItem('TERMINAL_CODE_STABLE', code);
    return code;
};

// ─── CSS Keyframes ────────────────────────────────────────────────────────────
const KIOSK_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap');

@keyframes radarRing {
    0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 0.5; }
    100% { transform: translate(-50%,-50%) scale(5);   opacity: 0; }
}
@keyframes gridPulse {
    0%,100% { opacity: 0.025; }
    50%      { opacity: 0.07; }
}
@keyframes charGlow {
    0%,60%,100% { color:#fff; text-shadow: 0 0 30px rgba(220,38,38,0.5), 0 0 60px rgba(220,38,38,0.2); }
    30%          { color:#ff5555; text-shadow: 0 0 50px rgba(255,80,80,1), 0 0 100px rgba(220,38,38,0.5), 0 0 2px #fff; }
}
@keyframes scanBar {
    0%   { top: -2px; }
    100% { top: 100vh; }
}
@keyframes fadeUp {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0); }
}
@keyframes statusPulse {
    0%,100% { opacity:1; box-shadow:0 0 6px #22c55e; }
    50%      { opacity:0.35; box-shadow:0 0 2px #22c55e; }
}
@keyframes spinLoader {
    to { transform: rotate(360deg); }
}
@keyframes qrFadeIn {
    from { opacity:0; transform:scale(0.88) rotate(-2deg); filter:blur(4px); }
    to   { opacity:1; transform:scale(1) rotate(0deg); filter:blur(0); }
}
@keyframes cardBorderGlow {
    0%,100% { border-color: rgba(220,38,38,0.2); }
    50%      { border-color: rgba(220,38,38,0.5); }
}
`;

// ─── Radar Background ─────────────────────────────────────────────────────────
const RadarBG: React.FC = () => (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Grid */}
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)`,
            backgroundSize: '72px 72px',
            animation: 'gridPulse 7s ease-in-out infinite',
        }} />
        {/* Vignette */}
        <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 20%, rgba(0,0,0,0.92) 100%)',
        }} />
        {/* Radar rings */}
        {[0, 1.1, 2.2, 3.3, 4.4].map((delay, i) => (
            <div key={i} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 280, height: 280,
                marginTop: -140, marginLeft: -140,
                borderRadius: '50%',
                border: `1px solid rgba(220,38,38,${0.3 - i * 0.04})`,
                animation: `radarRing 5.5s ${delay}s ease-out infinite`,
            }} />
        ))}
        {/* Scanline */}
        <div style={{
            position: 'absolute', left: 0, right: 0, height: 1,
            background: 'linear-gradient(transparent, rgba(220,38,38,0.12), transparent)',
            animation: 'scanBar 10s linear infinite',
        }} />
    </div>
);

// ─── Code Box ─────────────────────────────────────────────────────────────────
const CodeBox: React.FC<{ code: string }> = ({ code }) => (
    <div style={{ display: 'flex', gap: 'clamp(6px,0.8vw,14px)', justifyContent: 'center' }}>
        {code.split('').map((char, i) => (
            <div key={i} style={{
                width: 'clamp(64px,7vw,108px)', height: 'clamp(72px,8vw,122px)',
                background: 'rgba(220,38,38,0.04)',
                border: '1px solid rgba(220,38,38,0.22)',
                borderBottom: '3px solid rgba(220,38,38,0.55)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"SF Mono","JetBrains Mono","Fira Code",monospace',
                fontSize: 'clamp(2.2rem,4.5vw,4.5rem)',
                fontWeight: 900,
                color: '#fff',
                animation: `charGlow 3.2s ${i * 0.75}s ease-in-out infinite`,
                position: 'relative', overflow: 'hidden',
                userSelect: 'none',
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
                    background: 'linear-gradient(rgba(220,38,38,0.07),transparent)',
                    borderRadius: '12px 12px 0 0',
                }} />
                {char}
            </div>
        ))}
    </div>
);

// ─── QR Code ─────────────────────────────────────────────────────────────────
const QrPanel: React.FC<{ tvCode: string }> = ({ tvCode }) => {
    const castUrl = `${window.location.origin}/?cast=${tvCode}`;
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=000000&color=DC2626&qzone=2&data=${encodeURIComponent(castUrl)}`;
    const [loaded, setLoaded] = useState(false);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'qrFadeIn 0.8s 1.4s both' }}>
            <div style={{
                width: 'clamp(88px,9vw,148px)', height: 'clamp(88px,9vw,148px)',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: 12, padding: 8, background: '#000',
                position: 'relative', overflow: 'hidden',
                animation: 'cardBorderGlow 3s ease-in-out infinite',
            }}>
                {/* Corner marks */}
                {[{ top: 4, left: 4, borderTop: '2px solid rgba(220,38,38,0.6)', borderLeft: '2px solid rgba(220,38,38,0.6)' },
                { top: 4, right: 4, borderTop: '2px solid rgba(220,38,38,0.6)', borderRight: '2px solid rgba(220,38,38,0.6)' },
                { bottom: 4, left: 4, borderBottom: '2px solid rgba(220,38,38,0.6)', borderLeft: '2px solid rgba(220,38,38,0.6)' },
                { bottom: 4, right: 4, borderBottom: '2px solid rgba(220,38,38,0.6)', borderRight: '2px solid rgba(220,38,38,0.6)' }
                ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...s }} />)}
                <img src={src} alt="cast qr" onLoad={() => setLoaded(true)}
                    style={{ width: '100%', height: '100%', borderRadius: 6, opacity: loaded ? 1 : 0, transition: 'opacity 0.4s', imageRendering: 'pixelated' }} />
                {!loaded && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 20, height: 20, border: '2px solid #222', borderTopColor: '#DC2626', borderRadius: '50%', animation: 'spinLoader 0.8s linear infinite' }} />
                    </div>
                )}
            </div>
            <div style={{ fontSize: 'clamp(7px,0.65vw,9px)', fontFamily: 'monospace', color: 'rgba(220,38,38,0.45)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                SCAN TO CAST
            </div>
        </div>
    );
};

// ─── Idle Screen ──────────────────────────────────────────────────────────────
const IdleScreen: React.FC<{ tvCode: string; visible: boolean; registered: boolean }> = ({ tvCode, visible, registered }) => {
    const [online, setOnline] = useState(navigator.onLine);
    const [uptime, setUptime] = useState(0);

    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        const tick = setInterval(() => setUptime(u => u + 1), 1000);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(tick); };
    }, []);

    const fmtTime = (s: number) =>
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div style={{
            position: 'absolute', inset: 0, background: '#000000',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: visible ? 1 : 0,
            transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: visible ? 'auto' : 'none',
            overflow: 'hidden',
        }}>
            <RadarBG />

            {/* Main block */}
            <div style={{
                position: 'relative', zIndex: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                animation: 'fadeUp 0.9s 0.2s both',
                padding: '0 2rem', textAlign: 'center',
            }}>
                {/* Brand label */}
                <div style={{
                    fontSize: 'clamp(8px,0.75vw,11px)', fontFamily: 'monospace', fontWeight: 700,
                    letterSpacing: '0.55em', color: 'rgba(220,38,38,0.65)',
                    textTransform: 'uppercase', marginBottom: 'clamp(2rem,3.5vw,5rem)',
                }}>
                    LED SCORE SYSTEM
                </div>

                {/* Ready badge */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 'clamp(1rem,2vw,2rem)',
                }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: registered && online ? '#22c55e' : '#444',
                        boxShadow: registered && online ? '0 0 8px #22c55e' : 'none',
                        animation: registered && online ? 'statusPulse 2s ease-in-out infinite' : 'none',
                    }} />
                    <span style={{
                        fontSize: 'clamp(8px,0.7vw,10px)', fontFamily: 'monospace',
                        color: registered && online ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.2)',
                        letterSpacing: '0.35em', textTransform: 'uppercase',
                    }}>
                        {!registered ? 'INITIALIZING' : online ? 'READY TO RECEIVE' : 'RECONNECTING...'}
                    </span>
                </div>

                {/* Code + QR row */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: 'clamp(2rem,5vw,6rem)',
                    flexWrap: 'wrap', justifyContent: 'center',
                    marginBottom: 'clamp(1.5rem,3vw,3.5rem)',
                }}>
                    <CodeBox code={tvCode} />
                    <QrPanel tvCode={tvCode} />
                </div>

                {/* Divider */}
                <div style={{
                    width: 'clamp(120px,20vw,280px)', height: 1,
                    background: 'linear-gradient(90deg,transparent,rgba(220,38,38,0.25),transparent)',
                    marginBottom: 'clamp(1rem,2vw,2rem)',
                }} />

                {/* Instruction */}
                <div style={{
                    fontFamily: '"Oswald",sans-serif', fontWeight: 400,
                    fontSize: 'clamp(10px,1.1vw,17px)',
                    letterSpacing: '0.3em', color: 'rgba(255,255,255,0.28)',
                    textTransform: 'uppercase', lineHeight: 1.6,
                }}>
                    ENTER CODE IN HOST CONSOLE TO CAST
                </div>
                <div style={{
                    fontSize: 'clamp(8px,0.68vw,10px)', fontFamily: 'monospace',
                    color: 'rgba(255,255,255,0.1)', letterSpacing: '0.2em',
                    textTransform: 'uppercase', marginTop: '0.4rem',
                }}>
                    OR SCAN QR CODE FROM YOUR PHONE
                </div>
            </div>

            {/* Bottom bar */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: 'clamp(0.75rem,1.2vw,1.5rem) clamp(1.5rem,2vw,3rem)',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: online ? '#22c55e' : '#ef4444',
                        animation: online ? 'statusPulse 2s ease-in-out infinite' : 'none',
                    }} />
                    <span style={{ fontSize: 8, fontFamily: 'monospace', color: online ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                        {online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </div>
                <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                    TERMINAL · {tvCode}
                </div>
                <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.15em' }}>
                    UP {fmtTime(uptime)}
                </div>
            </div>
        </div>
    );
};

// ─── Transition Overlay ───────────────────────────────────────────────────────
const Transition: React.FC<{ visible: boolean }> = ({ visible }) => (
    <div style={{
        position: 'absolute', inset: 0, background: '#000',
        opacity: visible ? 1 : 0,
        transition: visible ? 'opacity 0.2s ease-in' : 'opacity 0.6s ease-out',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
        {visible && <div style={{ width: 36, height: 36, border: '2px solid #1a1a1a', borderTopColor: '#DC2626', borderRadius: '50%', animation: 'spinLoader 0.7s linear infinite' }} />}
    </div>
);

// ─── Root ─────────────────────────────────────────────────────────────────────
export const TvKiosk: React.FC = () => {
    const [searchParams] = useSearchParams();
    const tvCode = resolveTerminalCode(searchParams.get('code'));

    const [gameCode, setGameCode] = useState<string | null>(null);
    const [showGame, setShowGame] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [registered, setRegistered] = useState(false);
    const prevGame = useRef<string | null>(null);

    const handleUpdate = useCallback((newCode: string | null) => {
        if (newCode === prevGame.current) return;
        prevGame.current = newCode;

        if (newCode && !showGame) {
            setTransitioning(true);
            setTimeout(() => { setGameCode(newCode); setShowGame(true); setTransitioning(false); }, 500);
        } else if (!newCode && showGame) {
            setTransitioning(true);
            setTimeout(() => { setShowGame(false); setGameCode(null); setTransitioning(false); }, 700);
        } else if (newCode && showGame) {
            setTransitioning(true);
            setTimeout(() => { setGameCode(newCode); setTransitioning(false); }, 350);
        }
    }, [showGame]);

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
            <style>{KIOSK_CSS}</style>
            <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>
                <IdleScreen tvCode={tvCode} visible={!showGame && !transitioning} registered={registered} />
                {gameCode && (
                    <div style={{ position: 'absolute', inset: 0, opacity: showGame && !transitioning ? 1 : 0, transition: 'opacity 1s cubic-bezier(0.4,0,0.2,1)' }}>
                        <SpectatorView gameCode={gameCode} />
                    </div>
                )}
                <Transition visible={transitioning} />
            </div>
        </>
    );
};

export default TvKiosk;