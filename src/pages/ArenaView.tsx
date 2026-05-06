// src/pages/ArenaView.tsx
// ═══════════════════════════════════════════════════════════════
//  ARENA DISPLAY — Multi-Court LED Wall View
//
//  Route: /arena/:arenaCode (public, no auth)
//  Purpose: Displays 1–6 live game scoreboards simultaneously.
//  Always dark/black — designed for LED walls and large TVs.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    fetchArenaSession,
    subscribeToArenaSession,
    type ArenaSession,
    type PendingRequest,
} from '../services/arenaSessionService';
import { subscribeToGameBroadcast } from '../services/supabaseBroadcastService';
import { subscribeToGame } from '../services/supabaseGameService';
import type { BasketballGame } from '../types';

// ─── Global Styles ────────────────────────────────────────────────────────────

const ARENA_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;700;900&display=swap');
  html, body, #root { margin: 0; padding: 0; background: #000; overflow: hidden; }
  @keyframes arena-pulse { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
  @keyframes arena-spin  { to{transform:rotate(360deg)} }
  @keyframes arena-score { 0%{transform:scale(1)} 15%{transform:scale(1.12)} 100%{transform:scale(1)} }
  @keyframes arena-slot-in { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
  @keyframes arena-pending-blink { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveScore {
    teamAScore: number;
    teamBScore: number;
    teamAName: string;
    teamBName: string;
    teamAColor: string;
    teamBColor: string;
    minutes: number;
    seconds: number;
    period: number;
    isRunning: boolean;
    shotClock: number;
}

// ─── Grid Layout ──────────────────────────────────────────────────────────────

const getGridStyle = (count: number): React.CSSProperties => {
    if (count <= 1) return { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    if (count === 2) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
    if (count <= 4) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    return { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
};

const getScoreFontSize = (count: number): string => {
    if (count <= 1) return '8rem';
    if (count === 2) return '7rem';
    if (count <= 4) return '5rem';
    return '3rem';
};

// ─── ArenaScoreCard ───────────────────────────────────────────────────────────

const ArenaScoreCard: React.FC<{ gameCode: string; courtNumber: number; totalCourts: number }> = ({
    gameCode,
    courtNumber,
    totalCourts,
}) => {
    const [live, setLive] = useState<LiveScore>({
        teamAScore: 0, teamBScore: 0,
        teamAName: 'TEAM A', teamBName: 'TEAM B',
        teamAColor: '#DC2626', teamBColor: '#2563EB',
        minutes: 10, seconds: 0, period: 1, isRunning: false, shotClock: 24,
    });
    const [pulseA, setPulseA] = useState(false);
    const [pulseB, setPulseB] = useState(false);

    const scoreSize = getScoreFontSize(totalCourts);
    const teamFontSize = totalCourts <= 2 ? '1.4rem' : totalCourts <= 4 ? '1rem' : '0.75rem';
    const metaFontSize = totalCourts <= 2 ? '0.9rem' : '0.65rem';
    const courtLabelSize = totalCourts <= 2 ? '0.7rem' : '0.55rem';

    useEffect(() => {
        // Subscribe to game row for team names/colors
        const unsubGame = subscribeToGame(gameCode, (game: BasketballGame | null) => {
            if (!game) return;
            setLive(prev => ({
                ...prev,
                teamAName: (game.teamA?.name || 'TEAM A').toUpperCase(),
                teamBName: (game.teamB?.name || 'TEAM B').toUpperCase(),
                teamAColor: game.teamA?.color || '#DC2626',
                teamBColor: game.teamB?.color || '#2563EB',
                teamAScore: game.teamA?.score ?? prev.teamAScore,
                teamBScore: game.teamB?.score ?? prev.teamBScore,
            }));
        });

        // Subscribe to live broadcast for clock + score
        const unsubBcast = subscribeToGameBroadcast(gameCode, {
            onScoreUpdate: (score) => {
                setLive(prev => {
                    if (score.teamA !== prev.teamAScore) { setPulseA(true); setTimeout(() => setPulseA(false), 800); }
                    if (score.teamB !== prev.teamBScore) { setPulseB(true); setTimeout(() => setPulseB(false), 800); }
                    return { ...prev, teamAScore: score.teamA, teamBScore: score.teamB };
                });
            },
            onClockTick: (p) => {
                setLive(prev => ({ ...prev, minutes: p.minutes, seconds: p.seconds, shotClock: p.shotClock }));
            },
            onClockStart: (clock) => {
                setLive(prev => ({ ...prev, minutes: clock.minutes, seconds: clock.seconds, period: clock.period, isRunning: true, shotClock: clock.shotClock }));
            },
            onClockStop: (clock) => {
                setLive(prev => ({ ...prev, minutes: clock.minutes, seconds: clock.seconds, period: clock.period, isRunning: false, shotClock: clock.shotClock }));
            },
            onPeriodChange: (clock) => {
                setLive(prev => ({ ...prev, period: clock.period, minutes: clock.minutes, seconds: clock.seconds }));
            },
            onGameSnapshot: (snapshot) => {
                const { clock, score } = snapshot;
                setLive(prev => ({
                    ...prev,
                    teamAScore: score.teamA, teamBScore: score.teamB,
                    minutes: clock.minutes, seconds: clock.seconds,
                    period: clock.period, isRunning: clock.gameRunning,
                    shotClock: clock.shotClock,
                }));
            },
        });

        return () => { unsubGame(); unsubBcast(); };
    }, [gameCode]);

    const pad = (n: number) => String(n).padStart(2, '0');
    const periodLabel = live.period <= 4 ? `Q${live.period}` : `OT${live.period - 4}`;

    return (
        <div style={{
            position: 'relative', background: '#050505',
            borderRight: '1px solid #111', borderBottom: '1px solid #111',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'arena-slot-in 0.4s ease both',
        }}>
            {/* Team color strips */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: live.teamAColor, opacity: 0.7 }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 4, height: '100%', background: live.teamBColor, opacity: 0.7 }} />

            {/* Court label bar */}
            <div style={{
                background: '#0a0a0a', borderBottom: '1px solid #1a1a1a',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${totalCourts <= 2 ? '6px 16px' : '4px 10px'}`,
                flexShrink: 0,
            }}>
                <span style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: courtLabelSize, letterSpacing: '0.3em', color: '#444', textTransform: 'uppercase' }}>
                    COURT {courtNumber}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {live.isRunning && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'arena-pulse 1s ease-in-out infinite' }} />
                    )}
                    <span style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: courtLabelSize, letterSpacing: '0.25em', color: '#333' }}>
                        {periodLabel} {pad(live.minutes)}:{pad(live.seconds)}
                    </span>
                </div>
            </div>

            {/* Main score area */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', minHeight: 0 }}>
                {/* Team A */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: totalCourts <= 2 ? '1.5rem' : '0.75rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 20% 50%, ${live.teamAColor}0A 0%, transparent 70%)`, pointerEvents: 'none' }} />
                    <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: teamFontSize, color: live.teamAColor, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '0.4rem', lineHeight: 1.1, textShadow: `0 0 20px ${live.teamAColor}40` }}>
                        {live.teamAName}
                    </div>
                    <div style={{
                        fontFamily: 'Oswald, monospace', fontWeight: 900, fontSize: scoreSize,
                        color: '#fff', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
                        textShadow: pulseA ? `0 0 40px ${live.teamAColor}, 0 0 80px ${live.teamAColor}66` : `0 0 20px ${live.teamAColor}22`,
                        animation: pulseA ? 'arena-score 0.6s ease' : 'none',
                        transition: 'text-shadow 0.4s ease',
                    }}>
                        {pad(live.teamAScore)}
                    </div>
                </div>

                {/* Center divider */}
                <div style={{ width: 1, background: 'linear-gradient(to bottom, transparent, #1e1e1e 20%, #1e1e1e 80%, transparent)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 0.5rem', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: metaFontSize, color: '#2a2a2a', letterSpacing: '0.1em' }}>VS</span>
                </div>
                <div style={{ width: 1, background: 'linear-gradient(to bottom, transparent, #1e1e1e 20%, #1e1e1e 80%, transparent)', flexShrink: 0 }} />

                {/* Team B */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: totalCourts <= 2 ? '1.5rem' : '0.75rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 80% 50%, ${live.teamBColor}0A 0%, transparent 70%)`, pointerEvents: 'none' }} />
                    <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: teamFontSize, color: live.teamBColor, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '0.4rem', lineHeight: 1.1, textShadow: `0 0 20px ${live.teamBColor}40` }}>
                        {live.teamBName}
                    </div>
                    <div style={{
                        fontFamily: 'Oswald, monospace', fontWeight: 900, fontSize: scoreSize,
                        color: '#fff', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
                        textShadow: pulseB ? `0 0 40px ${live.teamBColor}, 0 0 80px ${live.teamBColor}66` : `0 0 20px ${live.teamBColor}22`,
                        animation: pulseB ? 'arena-score 0.6s ease' : 'none',
                        transition: 'text-shadow 0.4s ease',
                    }}>
                        {pad(live.teamBScore)}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Pending Court Placeholder ────────────────────────────────────────────────

const PendingCourtTile: React.FC<{ courtNumber: number; request: PendingRequest }> = ({ courtNumber, request }) => (
    <div style={{
        position: 'relative', background: '#050505',
        borderRight: '1px solid #111', borderBottom: '1px solid #111',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        border: '1px dashed #222',
    }}>
        <div style={{ width: 2, height: '60%', background: 'linear-gradient(to bottom, transparent, #222, transparent)', position: 'absolute', left: '50%' }} />
        <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.35em', color: '#333', textTransform: 'uppercase' }}>
            COURT {courtNumber}
        </div>
        <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: '0.55rem', letterSpacing: '0.2em', color: '#2a2a2a', animation: 'arena-pending-blink 2s ease-in-out infinite', textTransform: 'uppercase' }}>
            Awaiting Approval
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.5rem', color: '#1e1e1e', letterSpacing: '0.1em' }}>
            {request.game_name}
        </div>
    </div>
);

// ─── Empty Court Slot ─────────────────────────────────────────────────────────

const EmptyCourtTile: React.FC<{ courtNumber: number }> = ({ courtNumber }) => (
    <div style={{
        position: 'relative', background: '#030303',
        borderRight: '1px solid #0d0d0d', borderBottom: '1px solid #0d0d0d',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        border: '1px dashed #111',
    }}>
        <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: '0.55rem', letterSpacing: '0.35em', color: '#1e1e1e', textTransform: 'uppercase' }}>
            COURT {courtNumber}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.5rem', color: '#181818', letterSpacing: '0.15em', animation: 'arena-pulse 3s ease-in-out infinite' }}>
            Waiting for cast...
        </div>
    </div>
);

// ─── Idle State ───────────────────────────────────────────────────────────────

const IdleScreen: React.FC<{ arenaCode: string; label?: string }> = ({ arenaCode, label }) => (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', fontFamily: 'Oswald, monospace' }}>
        <style>{ARENA_STYLES}</style>
        <div style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.4em', color: '#DC2626' }}>THE BOX</div>
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 400, letterSpacing: '0.3em', color: '#333', marginBottom: '0.75rem' }}>ARENA</div>
            <div style={{ fontSize: '5rem', fontWeight: 900, letterSpacing: '0.5em', color: '#fff', fontVariantNumeric: 'tabular-nums', padding: '0 1rem' }}>
                {arenaCode}
            </div>
        </div>
        <div style={{ fontSize: '0.65rem', fontWeight: 400, letterSpacing: '0.25em', color: '#2a2a2a', animation: 'arena-pulse 2s ease-in-out infinite' }}>
            Waiting for courts to connect...
        </div>
        {label && (
            <div style={{ position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Oswald, monospace', fontSize: '0.55rem', letterSpacing: '0.25em', color: '#1e1e1e', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {label}
            </div>
        )}
    </div>
);

// ─── Loading State ────────────────────────────────────────────────────────────

const LoadingScreen: React.FC = () => (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{ARENA_STYLES}</style>
        <div style={{ width: 48, height: 48, border: '2px solid #1a1a1a', borderTopColor: '#DC2626', borderRadius: '50%', animation: 'arena-spin 0.8s linear infinite' }} />
    </div>
);

// ─── Not Found State ──────────────────────────────────────────────────────────

const NotFoundScreen: React.FC<{ arenaCode: string }> = ({ arenaCode }) => (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', fontFamily: 'Oswald, monospace' }}>
        <style>{ARENA_STYLES}</style>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.35em', color: '#DC2626', textTransform: 'uppercase' }}>Arena Not Found</div>
        <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '0.4em', color: '#1a1a1a' }}>{arenaCode}</div>
        <div style={{ fontSize: '0.55rem', letterSpacing: '0.2em', color: '#222' }}>Check the arena code and try again</div>
    </div>
);

// ─── Main Arena View ──────────────────────────────────────────────────────────

export const ArenaView: React.FC = () => {
    const { arenaCode } = useParams<{ arenaCode: string }>();
    const [session, setSession] = useState<ArenaSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const code = (arenaCode || '').toUpperCase();

    useEffect(() => {
        if (!code) { setNotFound(true); setLoading(false); return; }

        fetchArenaSession(code).then((s) => {
            if (!s) { setNotFound(true); }
            else { setSession(s); }
            setLoading(false);
        });

        const unsub = subscribeToArenaSession(code, (updated) => {
            setSession(updated);
        });

        return unsub;
    }, [code]);

    if (loading) return <LoadingScreen />;
    if (notFound || !session) return <NotFoundScreen arenaCode={code} />;

    const activeCodes = session.game_codes;
    const pendingRequests = session.pending_requests;
    const totalSlots = session.max_slots;

    // No games yet — idle
    if (activeCodes.length === 0 && pendingRequests.length === 0) {
        return <IdleScreen arenaCode={code} label={session.label} />;
    }

    // Build slot array: active courts + pending placeholders + empty slots
    const slots: Array<{ type: 'active'; gameCode: string } | { type: 'pending'; request: PendingRequest } | { type: 'empty' }> = [];

    activeCodes.forEach(gc => slots.push({ type: 'active', gameCode: gc }));
    pendingRequests.forEach(r => slots.push({ type: 'pending', request: r }));

    const filled = slots.length;
    // Show empty slots only up to totalSlots (or at least fill to next grid boundary)
    const targetCount = Math.max(filled, Math.min(totalSlots, filled <= 2 ? filled : filled <= 4 ? 4 : 6));
    for (let i = filled; i < targetCount; i++) slots.push({ type: 'empty' });

    const displayCount = slots.length;
    const gridStyle = getGridStyle(displayCount);

    return (
        <>
            <style>{ARENA_STYLES}</style>
            <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header bar */}
                <div style={{ background: '#050505', borderBottom: '1px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: 36, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', boxShadow: '0 0 6px #DC2626', animation: 'arena-pulse 1.5s ease-in-out infinite' }} />
                        <span style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.35em', color: '#DC2626' }}>THE BOX</span>
                    </div>
                    <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: '0.55rem', letterSpacing: '0.3em', color: '#2a2a2a' }}>
                        ARENA {code} · {session.label.toUpperCase()} · {activeCodes.length}/{totalSlots} COURTS LIVE
                    </div>
                    <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: '0.55rem', letterSpacing: '0.2em', color: '#1e1e1e' }}>
                        MULTI-COURT DISPLAY
                    </div>
                </div>

                {/* Grid */}
                <div style={{ flex: 1, ...gridStyle, minHeight: 0 }}>
                    {slots.map((slot, i) => {
                        if (slot.type === 'active') {
                            return (
                                <ArenaScoreCard
                                    key={slot.gameCode}
                                    gameCode={slot.gameCode}
                                    courtNumber={i + 1}
                                    totalCourts={displayCount}
                                />
                            );
                        }
                        if (slot.type === 'pending') {
                            return (
                                <PendingCourtTile
                                    key={slot.request.game_code}
                                    courtNumber={i + 1}
                                    request={slot.request}
                                />
                            );
                        }
                        return <EmptyCourtTile key={`empty-${i}`} courtNumber={i + 1} />;
                    })}
                </div>
            </div>
        </>
    );
};

export default ArenaView;
