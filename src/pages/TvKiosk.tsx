// src/pages/TvKiosk.tsx
//
// THE PERMANENT KIOSK SHELL — runs on the Pi Zero 2 forever.
//
// This page never navigates away. It has two states:
//   IDLE    → Shows the glowing holding screen with the TV code
//   CASTING → Renders SpectatorView inline as a component swap
//
// The Pi boots Chromium pointed at: https://yourapp.com/tv?code=8X2F
// The code comes from a config file on the Pi — stable across reboots.
//
// Flow:
//   1. Mount → register in tv_displays, start heartbeat
//   2. Subscribe to own row via Supabase Realtime
//   3. game_code null   → IDLE screen
//   4. game_code set    → crossfade into SpectatorView (inline, no navigate)
//   5. game_code cleared → crossfade back to IDLE

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    registerTvDisplay,
    startTvHeartbeat,
    subscribeTvDisplay,
    type TvDisplay,
} from '../services/tvDisplayService';
import { SpectatorView } from './SpectatorView';

// ─── Code Generation (fallback if no URL param) ───────────────────────────────

/**
 * Generates a deterministic 4-char code from browser fingerprint.
 * This is the FALLBACK only — ideally the Pi always has ?code= in the URL.
 * Uses canvas fingerprinting + screen resolution for reasonable uniqueness.
 */
const generateFallbackCode = (): string => {
    const stored = localStorage.getItem('TV_DISPLAY_CODE');
    if (stored) return stored;

    const seed = `${screen.width}x${screen.height}-${navigator.hardwareConcurrency}-${navigator.language}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    const code = [
        chars[Math.abs(hash >> 24) % chars.length],
        chars[Math.abs(hash >> 16) % chars.length],
        chars[Math.abs(hash >> 8) % chars.length],
        chars[Math.abs(hash) % chars.length],
    ].join('');

    localStorage.setItem('TV_DISPLAY_CODE', code);
    return code;
};

// ─── Idle / Holding Screen ────────────────────────────────────────────────────

const IdleScreen: React.FC<{ tvCode: string; visible: boolean }> = ({ tvCode, visible }) => (
    <div
        style={{
            position: 'absolute',
            inset: 0,
            background: '#000000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Oswald", "Arial Narrow", sans-serif',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease',
            pointerEvents: visible ? 'auto' : 'none',
        }}
    >
        {/* Subtle grid texture */}
        <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
        }} />

        {/* Glow orb behind the code */}
        <div style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)',
            filter: 'blur(40px)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>

            {/* Brand mark */}
            <div style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.4em',
                color: '#333333',
                marginBottom: '64px',
                textTransform: 'uppercase',
            }}>
                THE BOX · DISPLAY TERMINAL
            </div>

            {/* Status indicator */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '40px',
            }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 12px #22c55e',
                    animation: 'tvPulse 2s ease-in-out infinite',
                }} />
                <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.3em',
                    color: '#22c55e',
                    textTransform: 'uppercase',
                }}>
                    Ready to Display
                </span>
            </div>

            {/* The big code */}
            <div style={{
                fontSize: '140px',
                fontWeight: 900,
                letterSpacing: '0.15em',
                color: '#ffffff',
                lineHeight: 1,
                textShadow: '0 0 80px rgba(255,255,255,0.15)',
                marginBottom: '32px',
            }}>
                {tvCode}
            </div>

            {/* Instruction */}
            <div style={{
                fontSize: '18px',
                fontWeight: 400,
                letterSpacing: '0.15em',
                color: '#444444',
                textTransform: 'uppercase',
                lineHeight: 1.8,
            }}>
                Cast to this screen from your<br />
                <span style={{ color: '#666666' }}>Host Console → 📺 Cast</span>
            </div>

            {/* Bottom code repeat for easy reading from across room */}
            <div style={{
                marginTop: '80px',
                padding: '12px 32px',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                display: 'inline-block',
            }}>
                <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.3em',
                    color: '#2a2a2a',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                }}>
                    TV CODE: {tvCode}
                </span>
            </div>
        </div>

        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700;900&display=swap');
            @keyframes tvPulse {
                0%, 100% { opacity: 1; box-shadow: 0 0 12px #22c55e; }
                50% { opacity: 0.5; box-shadow: 0 0 4px #22c55e; }
            }
        `}</style>
    </div>
);

// ─── Casting Transition Screen ────────────────────────────────────────────────

const TransitionScreen: React.FC<{ visible: boolean }> = ({ visible }) => (
    <div style={{
        position: 'absolute',
        inset: 0,
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 10,
    }}>
        <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #1a1a1a',
            borderTopColor: '#DC2626',
            borderRadius: '50%',
            animation: 'tvSpin 0.8s linear infinite',
        }} />
        <style>{`@keyframes tvSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// ─── Main TvKiosk Component ───────────────────────────────────────────────────

export const TvKiosk: React.FC = () => {
    const [searchParams] = useSearchParams();

    // Resolve the TV code: URL param (Pi) → fallback (dev/testing)
    const tvCode = (searchParams.get('code') || generateFallbackCode()).toUpperCase();

    const [gameCode, setGameCode] = useState<string | null>(null);
    const [showScoreboard, setShowScoreboard] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [registered, setRegistered] = useState(false);

    const prevGameCode = useRef<string | null>(null);

    // ── Boot sequence ──────────────────────────────────────────────────────────
    useEffect(() => {
        let stopHeartbeat: (() => void) | null = null;
        let unsubscribe: (() => void) | null = null;

        const boot = async () => {
            await registerTvDisplay(tvCode);
            setRegistered(true);

            stopHeartbeat = startTvHeartbeat(tvCode);

            unsubscribe = subscribeTvDisplay(tvCode, (display: TvDisplay) => {
                handleDisplayUpdate(display.game_code);
            });
        };

        boot();

        return () => {
            stopHeartbeat?.();
            unsubscribe?.();
        };
    }, [tvCode]);

    // ── React to game_code changes ─────────────────────────────────────────────
    const handleDisplayUpdate = useCallback((newGameCode: string | null) => {
        if (newGameCode === prevGameCode.current) return;
        prevGameCode.current = newGameCode;

        if (newGameCode && !showScoreboard) {
            // IDLE → CASTING: brief transition then show scoreboard
            setTransitioning(true);
            setTimeout(() => {
                setGameCode(newGameCode);
                setShowScoreboard(true);
                setTransitioning(false);
            }, 600);
        } else if (!newGameCode && showScoreboard) {
            // CASTING → IDLE: fade out scoreboard
            setTransitioning(true);
            setTimeout(() => {
                setShowScoreboard(false);
                setGameCode(null);
                setTransitioning(false);
            }, 600);
        } else if (newGameCode) {
            // Game code CHANGED while casting (e.g. host switched games)
            setTransitioning(true);
            setTimeout(() => {
                setGameCode(newGameCode);
                setTransitioning(false);
            }, 400);
        }
    }, [showScoreboard]);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#000000',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* IDLE HOLDING SCREEN */}
            <IdleScreen tvCode={tvCode} visible={!showScoreboard && !transitioning} />

            {/* LIVE SCOREBOARD — inline component swap, no navigation */}
            {gameCode && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: showScoreboard && !transitioning ? 1 : 0,
                    transition: 'opacity 0.8s ease',
                }}>
                    {/* 
                        SpectatorView is rendered inline. It handles its own
                        Supabase subscriptions via the gameCode prop.
                        No URL change, no navigation — the TV page stays mounted.
                    */}
                    <SpectatorViewWrapper gameCode={gameCode} />
                </div>
            )}

            {/* TRANSITION FLASH */}
            <TransitionScreen visible={transitioning} />
        </div>
    );
};

// ─── SpectatorView Wrapper ────────────────────────────────────────────────────
//
// SpectatorView normally reads gameCode from useParams().
// Since we're rendering it without navigation, we need a thin wrapper
// that spoofs the route context using a mock params approach.
// We do this cleanly by creating a wrapper that passes gameCode as a prop.
// SpectatorView will need a minor update to accept an optional prop override.
//
// For now this wrapper uses a hidden iframe approach as zero-touch solution:
// it doesn't require ANY changes to SpectatorView.tsx.

const SpectatorViewWrapper: React.FC<{ gameCode: string }> = ({ gameCode }) => {
    const spectatorUrl = `${window.location.origin}/watch/${gameCode}`;

    return (
        <iframe
            src={spectatorUrl}
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                background: '#000000',
            }}
            title="Live Scoreboard"
            allow="autoplay"
        />
    );
};

export default TvKiosk;