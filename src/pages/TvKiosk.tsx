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

// ─── Cinematic Idle Screen (Hardware Accelerated for Pi) ─────────────────────
const IdleScreen: React.FC<{ tvCode: string; visible: boolean }> = ({ tvCode, visible }) => (
    <div
        className={`absolute inset-0 bg-black flex flex-col items-center justify-center font-sans transition-opacity duration-1000 ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
        {/* HIGH-PERFORMANCE MESH BACKGROUND (Zero CSS Blur) */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(153,27,27,0.3)_0%,transparent_50%)] animate-pulse"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(30,58,138,0.2)_0%,transparent_50%)]" style={{ animation: 'pulse 8s infinite alternate' }}></div>
        </div>

        {/* Scanlines Overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)' }}></div>

        <div className="relative z-10 flex flex-col items-center text-center">
            {/* Brand mark */}
            <div className="mb-16">
                <div className="text-zinc-600 text-sm font-black tracking-[0.5em] uppercase mb-2">BMSCE Sports Tech</div>
                <div className="w-24 h-px bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto"></div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-3 mb-10 bg-zinc-900/80 px-6 py-2 rounded-full border border-zinc-800 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_10px_#22c55e]"></span>
                </div>
                <span className="text-green-500 text-sm font-bold tracking-[0.3em] uppercase">Awaiting Broadcast Signal</span>
            </div>

            {/* The Big Code (Optimized Glow) */}
            <div className="relative group">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.3)_0%,transparent_70%)] scale-150 pointer-events-none"></div>
                <div className="text-[12rem] md:text-[16rem] font-black tracking-widest text-white leading-none tabular-nums relative z-10 drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                    {tvCode}
                </div>
            </div>

            {/* Instruction */}
            <div className="mt-12 text-zinc-400 text-2xl font-light tracking-[0.2em] uppercase">
                Enter code in Host Console to cast
            </div>
        </div>

        {/* Bottom Bar */}
        <div className="absolute bottom-0 left-0 w-full p-8 flex justify-between items-end border-t border-zinc-900/50 bg-black/80">
            <div className="text-zinc-600 text-xs font-mono tracking-widest">
                TERMINAL ID: <span className="text-zinc-400">{tvCode}</span>
            </div>
            <div className="text-zinc-600 text-xs font-mono tracking-widest">
                SYSTEM VER 4.0
            </div>
        </div>
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

const SpectatorViewWrapper: React.FC<{ gameCode: string }> = ({ gameCode }) => {
    return <SpectatorView gameCode={gameCode} />;
};

export default TvKiosk;