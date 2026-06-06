// src/pages/ArenaView.tsx
// ═══════════════════════════════════════════════════════════════
//  ARENA DISPLAY — Multi-Court LED Wall View
//
//  Route: /arena/:arenaCode (public, no auth)
//  Purpose: Displays 1–6 live game scoreboards simultaneously.
//  Always dark/black — designed for LED walls and large TVs.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
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

const getArenaStyles = (isLight: boolean) => `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;700;900&display=swap');
  html, body, #root { margin: 0; padding: 0; background: ${isLight ? '#F0EEE9' : '#000000'}; overflow: hidden; }
  @keyframes arena-pulse { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
  @keyframes arena-spin  { to{transform:rotate(360deg)} }
  @keyframes arena-score { 0%{transform:scale(1)} 15%{transform:scale(1.12)} 100%{transform:scale(1)} }
  @keyframes arena-slot-in { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
  @keyframes arena-pending-blink { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
  @keyframes spotlight-border-pulse { 0%,100%{box-shadow:0 0 0 2px #DC2626} 50%{box-shadow:0 0 0 2px #DC2626,0 0 16px 2px #DC262644} }
`;

// ─── Theme Tokens ──────────────────────────────────────────────────────────────

interface ArenaColors {
    pageBg: string; cardBg: string; cardBorder: string;
    labelBarBg: string; labelBarBorder: string; courtLabel: string;
    clockText: string; scoreTxt: string; vsTxt: string; divider: string;
    emptyBg: string; emptyBorder: string; emptyTxt: string;
    pendingTxt: string; idleSubTxt: string;
    headerBg: string; headerBorder: string; headerTxt: string; spinnerBorder: string;
}

const LIGHT_ARENA: ArenaColors = {
    pageBg: '#F0EEE9', cardBg: '#ffffff', cardBorder: '#e2e8f0',
    labelBarBg: '#f8fafc', labelBarBorder: '#e2e8f0', courtLabel: '#334155',
    clockText: '#64748b', scoreTxt: '#0f172a', vsTxt: '#94a3b8', divider: '#f1f5f9',
    emptyBg: '#F5F3EF', emptyBorder: '#f1f5f9', emptyTxt: '#cbd5e1',
    pendingTxt: '#94a3b8', idleSubTxt: '#94a3b8',
    headerBg: '#ffffff', headerBorder: '#e2e8f0', headerTxt: '#0f172a', spinnerBorder: '#e2e8f0',
};

const DARK_ARENA: ArenaColors = {
    pageBg: '#000000', cardBg: '#050505', cardBorder: '#111111',
    labelBarBg: '#0a0a0a', labelBarBorder: '#1a1a1a', courtLabel: '#444444',
    clockText: '#333333', scoreTxt: '#ffffff', vsTxt: '#2a2a2a', divider: '#1e1e1e',
    emptyBg: '#030303', emptyBorder: '#111111', emptyTxt: '#1e1e1e',
    pendingTxt: '#2a2a2a', idleSubTxt: '#2a2a2a',
    headerBg: '#050505', headerBorder: '#0d0d0d', headerTxt: '#ffffff', spinnerBorder: '#1a1a1a',
};

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

const ArenaScoreCard: React.FC<{ gameCode: string; courtNumber: number; totalCourts: number; onScoreEvent?: (gameCode: string) => void; c: ArenaColors }> = ({
    gameCode,
    courtNumber,
    totalCourts,
    onScoreEvent,
    c,
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
                onScoreEvent?.(gameCode);
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
            position: 'relative', background: c.cardBg,
            borderRight: `1px solid ${c.cardBorder}`, borderBottom: `1px solid ${c.cardBorder}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'arena-slot-in 0.4s ease both',
        }}>
            {/* Team color strips */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: live.teamAColor, opacity: 0.7 }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 4, height: '100%', background: live.teamBColor, opacity: 0.7 }} />

            {/* Court label bar */}
            <div style={{
                background: c.labelBarBg, borderBottom: `1px solid ${c.labelBarBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${totalCourts <= 2 ? '6px 16px' : '4px 10px'}`,
                flexShrink: 0,
            }}>
                <span style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: courtLabelSize, letterSpacing: '0.3em', color: c.courtLabel, textTransform: 'uppercase' }}>
                    COURT {courtNumber}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {live.isRunning && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'arena-pulse 1s ease-in-out infinite' }} />
                    )}
                    <span style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: courtLabelSize, letterSpacing: '0.25em', color: c.clockText }}>
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
                        color: c.scoreTxt, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
                        textShadow: pulseA ? `0 0 40px ${live.teamAColor}, 0 0 80px ${live.teamAColor}66` : `0 0 20px ${live.teamAColor}22`,
                        animation: pulseA ? 'arena-score 0.6s ease' : 'none',
                        transition: 'text-shadow 0.4s ease',
                    }}>
                        {pad(live.teamAScore)}
                    </div>
                </div>

                {/* Center divider */}
                <div style={{ width: 1, background: `linear-gradient(to bottom, transparent, ${c.divider} 20%, ${c.divider} 80%, transparent)`, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 0.5rem', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: metaFontSize, color: c.vsTxt, letterSpacing: '0.1em' }}>VS</span>
                </div>
                <div style={{ width: 1, background: `linear-gradient(to bottom, transparent, ${c.divider} 20%, ${c.divider} 80%, transparent)`, flexShrink: 0 }} />

                {/* Team B */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: totalCourts <= 2 ? '1.5rem' : '0.75rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 80% 50%, ${live.teamBColor}0A 0%, transparent 70%)`, pointerEvents: 'none' }} />
                    <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: teamFontSize, color: live.teamBColor, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '0.4rem', lineHeight: 1.1, textShadow: `0 0 20px ${live.teamBColor}40` }}>
                        {live.teamBName}
                    </div>
                    <div style={{
                        fontFamily: 'Oswald, monospace', fontWeight: 900, fontSize: scoreSize,
                        color: c.scoreTxt, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
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

const PendingCourtTile: React.FC<{ courtNumber: number; request: PendingRequest; c: ArenaColors }> = ({ courtNumber, request, c }) => (
    <div style={{
        position: 'relative', background: c.cardBg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        border: `1px dashed ${c.pendingTxt}`,
    }}>
        <div style={{ width: 2, height: '60%', background: `linear-gradient(to bottom, transparent, ${c.pendingTxt}, transparent)`, position: 'absolute', left: '50%' }} />
        <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.35em', color: c.courtLabel, textTransform: 'uppercase' }}>
            COURT {courtNumber}
        </div>
        <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: '0.55rem', letterSpacing: '0.2em', color: c.pendingTxt, animation: 'arena-pending-blink 2s ease-in-out infinite', textTransform: 'uppercase' }}>
            Awaiting Approval
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.5rem', color: c.emptyTxt, letterSpacing: '0.1em' }}>
            {request.game_name}
        </div>
    </div>
);

// ─── Sidebar Court Row (Spotlight mode) ──────────────────────────────────────

const SidebarCourtRow: React.FC<{ gameCode: string; courtNumber: number }> = ({ gameCode, courtNumber }) => {
    const [live, setLive] = useState<LiveScore>({
        teamAScore: 0, teamBScore: 0,
        teamAName: 'TEAM A', teamBName: 'TEAM B',
        teamAColor: '#DC2626', teamBColor: '#2563EB',
        minutes: 10, seconds: 0, period: 1, isRunning: false, shotClock: 24,
    });

    useEffect(() => {
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
        const unsubBcast = subscribeToGameBroadcast(gameCode, {
            onScoreUpdate: (score) => setLive(prev => ({ ...prev, teamAScore: score.teamA, teamBScore: score.teamB })),
            onClockTick: (p) => setLive(prev => ({ ...prev, minutes: p.minutes, seconds: p.seconds })),
            onClockStart: (clock) => setLive(prev => ({ ...prev, minutes: clock.minutes, seconds: clock.seconds, period: clock.period, isRunning: true })),
            onClockStop: (clock) => setLive(prev => ({ ...prev, minutes: clock.minutes, seconds: clock.seconds, period: clock.period, isRunning: false })),
            onPeriodChange: (clock) => setLive(prev => ({ ...prev, period: clock.period, minutes: clock.minutes, seconds: clock.seconds })),
            onGameSnapshot: (snapshot) => {
                const { clock, score } = snapshot;
                setLive(prev => ({ ...prev, teamAScore: score.teamA, teamBScore: score.teamB, minutes: clock.minutes, seconds: clock.seconds, period: clock.period, isRunning: clock.gameRunning }));
            },
        });
        return () => { unsubGame(); unsubBcast(); };
    }, [gameCode]);

    const pad = (n: number) => String(n).padStart(2, '0');
    const periodLabel = live.period <= 4 ? `Q${live.period}` : `OT${live.period - 4}`;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #0d0d0d', background: '#050505' }}>
            <div style={{ fontFamily: 'Oswald, monospace', fontSize: '0.45rem', fontWeight: 700, letterSpacing: '0.3em', color: '#2a2a2a', flexShrink: 0, textTransform: 'uppercase' }}>
                C{courtNumber}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Oswald, monospace', fontSize: '0.55rem', fontWeight: 700, color: live.teamAColor, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{live.teamAName}</span>
                    <span style={{ fontFamily: 'Oswald, monospace', fontSize: '0.75rem', fontWeight: 900, color: '#fff', flexShrink: 0 }}>{pad(live.teamAScore)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Oswald, monospace', fontSize: '0.55rem', fontWeight: 700, color: live.teamBColor, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{live.teamBName}</span>
                    <span style={{ fontFamily: 'Oswald, monospace', fontSize: '0.75rem', fontWeight: 900, color: '#fff', flexShrink: 0 }}>{pad(live.teamBScore)}</span>
                </div>
            </div>
            <div style={{ fontFamily: 'Oswald, monospace', fontSize: '0.4rem', fontWeight: 400, color: '#2a2a2a', letterSpacing: '0.15em', flexShrink: 0, textAlign: 'right' }}>
                <div>{periodLabel}</div>
                <div>{pad(live.minutes)}:{pad(live.seconds)}</div>
            </div>
        </div>
    );
};

// ─── Empty Court Slot ─────────────────────────────────────────────────────────

const EmptyCourtTile: React.FC<{ courtNumber: number; c: ArenaColors }> = ({ courtNumber, c }) => (
    <div style={{
        position: 'relative', background: c.emptyBg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        border: `1px dashed ${c.emptyBorder}`,
    }}>
        <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: '0.55rem', letterSpacing: '0.35em', color: c.emptyTxt, textTransform: 'uppercase' }}>
            COURT {courtNumber}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.5rem', color: c.emptyTxt, letterSpacing: '0.15em', animation: 'arena-pulse 3s ease-in-out infinite' }}>
            Waiting for cast...
        </div>
    </div>
);

// ─── Idle State ───────────────────────────────────────────────────────────────

const IdleScreen: React.FC<{ arenaCode: string; label?: string; c: ArenaColors; isLight: boolean }> = ({ arenaCode, label, c, isLight }) => (
    <div style={{ width: '100vw', height: '100vh', background: c.pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', fontFamily: 'Oswald, monospace' }}>
        <style>{getArenaStyles(isLight)}</style>
        <div style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.4em', color: '#DC2626' }}>THE BOX</div>
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 400, letterSpacing: '0.3em', color: c.idleSubTxt, marginBottom: '0.75rem' }}>ARENA</div>
            <div style={{ fontSize: '5rem', fontWeight: 900, letterSpacing: '0.5em', color: c.scoreTxt, fontVariantNumeric: 'tabular-nums', padding: '0 1rem' }}>
                {arenaCode}
            </div>
        </div>
        <div style={{ fontSize: '0.65rem', fontWeight: 400, letterSpacing: '0.25em', color: c.idleSubTxt, animation: 'arena-pulse 2s ease-in-out infinite' }}>
            Waiting for courts to connect...
        </div>
        {label && (
            <div style={{ position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Oswald, monospace', fontSize: '0.55rem', letterSpacing: '0.25em', color: c.emptyTxt, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {label}
            </div>
        )}
    </div>
);

// ─── Loading State ────────────────────────────────────────────────────────────

const LoadingScreen: React.FC<{ c: ArenaColors; isLight: boolean }> = ({ c, isLight }) => (
    <div style={{ width: '100vw', height: '100vh', background: c.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{getArenaStyles(isLight)}</style>
        <div style={{ width: 48, height: 48, border: `2px solid ${c.spinnerBorder}`, borderTopColor: '#DC2626', borderRadius: '50%', animation: 'arena-spin 0.8s linear infinite' }} />
    </div>
);

// ─── Not Found State ──────────────────────────────────────────────────────────

const NotFoundScreen: React.FC<{ arenaCode: string; c: ArenaColors; isLight: boolean }> = ({ arenaCode, c, isLight }) => (
    <div style={{ width: '100vw', height: '100vh', background: c.pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', fontFamily: 'Oswald, monospace' }}>
        <style>{getArenaStyles(isLight)}</style>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.35em', color: '#DC2626', textTransform: 'uppercase' }}>Arena Not Found</div>
        <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '0.4em', color: c.scoreTxt }}>{arenaCode}</div>
        <div style={{ fontSize: '0.55rem', letterSpacing: '0.2em', color: c.idleSubTxt }}>Check the arena code and try again</div>
    </div>
);

// ─── Main Arena View ──────────────────────────────────────────────────────────

export const ArenaView: React.FC = () => {
    const { arenaCode } = useParams<{ arenaCode: string }>();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const c = isLight ? LIGHT_ARENA : DARK_ARENA;
    const [session, setSession] = useState<ArenaSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Carousel state
    const [activeIndex, setActiveIndex] = useState(0);
    const [countdown, setCountdown] = useState(15);

    // Spotlight state
    const lastEventTimestamps = useRef<Record<string, number>>({});
    const [featuredCode, setFeaturedCode] = useState('');

    const code = (arenaCode || '').toUpperCase();

    useEffect(() => {
        if (!code) { setNotFound(true); setLoading(false); return; }

        fetchArenaSession(code).then((s) => {
            if (!s) { setNotFound(true); }
            else {
                setSession(s);
                setCountdown(s.carousel_interval_sec ?? 15);
                if (s.game_codes.length > 0) setFeaturedCode(s.game_codes[0]);
            }
            setLoading(false);
        });

        const unsub = subscribeToArenaSession(code, (updated) => {
            setSession(updated);
            if (updated.game_codes.length > 0) {
                setFeaturedCode(prev => prev && updated.game_codes.includes(prev) ? prev : updated.game_codes[0]);
            }
        });

        return unsub;
    }, [code]);

    const handleScoreEvent = useRef((gameCode: string) => {
        lastEventTimestamps.current[gameCode] = Date.now();
        const top = Object.entries(lastEventTimestamps.current).sort((a, b) => b[1] - a[1])[0];
        if (top) setFeaturedCode(prev => top[0] !== prev ? top[0] : prev);
    });

    const back = <BackToReferee onClick={() => navigate('/referee')} />;
    if (loading) return <>{back}<LoadingScreen c={c} isLight={isLight} /></>;
    if (notFound || !session) return <>{back}<NotFoundScreen arenaCode={code} c={c} isLight={isLight} /></>;

    const activeCodes = session.game_codes;
    const pendingRequests = session.pending_requests;
    const totalSlots = session.max_slots;
    const displayMode = (session.display_mode as string | undefined) ?? 'grid';
    const carouselIntervalSec = session.carousel_interval_sec ?? 15;

    // No games yet — idle
    if (activeCodes.length === 0 && pendingRequests.length === 0) {
        return <>{back}<IdleScreen arenaCode={code} label={session.label} c={c} isLight={isLight} /></>;
    }

    // Build slot array: active courts + pending placeholders + empty slots
    const slots: Array<{ type: 'active'; gameCode: string } | { type: 'pending'; request: PendingRequest } | { type: 'empty' }> = [];

    activeCodes.forEach(gc => slots.push({ type: 'active', gameCode: gc }));
    pendingRequests.forEach(r => slots.push({ type: 'pending', request: r }));

    const filled = slots.length;
    const targetCount = Math.max(filled, Math.min(totalSlots, filled <= 2 ? filled : filled <= 4 ? 4 : 6));
    for (let i = filled; i < targetCount; i++) slots.push({ type: 'empty' });

    const displayCount = slots.length;

    // ── Header (shared across all modes) ──
    const header = (
        <div style={{ background: c.headerBg, borderBottom: `1px solid ${c.headerBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: 36, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', boxShadow: '0 0 6px #DC2626', animation: 'arena-pulse 1.5s ease-in-out infinite' }} />
                <span style={{ fontFamily: 'Oswald, monospace', fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.35em', color: '#DC2626' }}>THE BOX</span>
            </div>
            <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: '0.55rem', letterSpacing: '0.3em', color: c.clockText }}>
                ARENA {code} · {session.label.toUpperCase()} · {activeCodes.length}/{totalSlots} COURTS LIVE
            </div>
            <div style={{ fontFamily: 'Oswald, monospace', fontWeight: 400, fontSize: '0.55rem', letterSpacing: '0.2em', color: c.idleSubTxt, textTransform: 'uppercase' }}>
                {displayMode} mode
            </div>
        </div>
    );

    // ── Row mode ──
    if (displayMode === 'row') {
        const rowGrid: React.CSSProperties = {
            display: 'grid',
            gridTemplateColumns: `repeat(${displayCount}, 1fr)`,
            gridTemplateRows: '1fr',
        };
        return (
            <>
                <style>{getArenaStyles(isLight)}</style>
                <div style={{ width: '100vw', height: '100vh', background: c.pageBg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {header}
                    <div style={{ flex: 1, ...rowGrid, minHeight: 0 }}>
                        {slots.map((slot, i) => {
                            if (slot.type === 'active') return <ArenaScoreCard key={slot.gameCode} gameCode={slot.gameCode} courtNumber={i + 1} totalCourts={displayCount} onScoreEvent={handleScoreEvent.current} c={c} />;
                            if (slot.type === 'pending') return <PendingCourtTile key={slot.request.game_code} courtNumber={i + 1} request={slot.request} c={c} />;
                            return <EmptyCourtTile key={`empty-${i}`} courtNumber={i + 1} c={c} />;
                        })}
                    </div>
                </div>
            </>
        );
    }

    // ── Carousel mode ──
    if (displayMode === 'carousel') {
        const safeActive = Math.min(activeIndex, Math.max(0, activeCodes.length - 1));
        return (
            <>
                <style>{getArenaStyles(isLight)}</style>
                <CarouselView
                    header={header}
                    slots={slots}
                    activeCodes={activeCodes}
                    activeIndex={safeActive}
                    setActiveIndex={setActiveIndex}
                    countdown={countdown}
                    setCountdown={setCountdown}
                    carouselIntervalSec={carouselIntervalSec}
                    onScoreEvent={handleScoreEvent.current}
                    c={c}
                />
            </>
        );
    }

    // ── Spotlight mode ──
    if (displayMode === 'spotlight') {
        const effectiveFeatured = featuredCode && activeCodes.includes(featuredCode) ? featuredCode : activeCodes[0] || '';
        const sidebarCodes = activeCodes.filter(gc => gc !== effectiveFeatured);
        const featuredIndex = activeCodes.indexOf(effectiveFeatured);

        return (
            <>
                <style>{getArenaStyles(isLight)}</style>
                <div style={{ width: '100vw', height: '100vh', background: c.pageBg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {header}
                    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                        {/* Featured court — 65% */}
                        <div style={{ flex: '0 0 65%', position: 'relative', animation: 'spotlight-border-pulse 2s ease-in-out infinite', zIndex: 1 }}>
                            {effectiveFeatured && (
                                <ArenaScoreCard
                                    key={effectiveFeatured}
                                    gameCode={effectiveFeatured}
                                    courtNumber={featuredIndex + 1}
                                    totalCourts={1}
                                    onScoreEvent={handleScoreEvent.current}
                                    c={c}
                                />
                            )}
                        </div>
                        {/* Sidebar — 35% */}
                        <div style={{ flex: '0 0 35%', borderLeft: `1px solid ${c.cardBorder}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${c.headerBorder}`, fontFamily: 'Oswald, monospace', fontSize: '0.45rem', fontWeight: 700, letterSpacing: '0.3em', color: c.clockText, textTransform: 'uppercase' }}>
                                Other Courts
                            </div>
                            {sidebarCodes.map((gc) => {
                                const courtIdx = activeCodes.indexOf(gc);
                                return <SidebarCourtRow key={gc} gameCode={gc} courtNumber={courtIdx + 1} />;
                            })}
                            {sidebarCodes.length === 0 && (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Oswald, monospace', fontSize: '0.5rem', color: c.emptyTxt, letterSpacing: '0.2em' }}>
                                    NO OTHER COURTS
                                </div>
                            )}
                            {/* Pending rows */}
                            {pendingRequests.map((r, i) => (
                                <PendingCourtTile key={r.game_code} courtNumber={activeCodes.length + i + 1} request={r} c={c} />
                            ))}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ── Grid mode (default) ──
    const gridStyle = getGridStyle(displayCount);
    return (
        <>
            <style>{getArenaStyles(isLight)}</style>
            {back}
            <div style={{ width: '100vw', height: '100vh', background: c.pageBg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {header}
                <div style={{ flex: 1, ...gridStyle, minHeight: 0 }}>
                    {slots.map((slot, i) => {
                        if (slot.type === 'active') return <ArenaScoreCard key={slot.gameCode} gameCode={slot.gameCode} courtNumber={i + 1} totalCourts={displayCount} onScoreEvent={handleScoreEvent.current} c={c} />;
                        if (slot.type === 'pending') return <PendingCourtTile key={slot.request.game_code} courtNumber={i + 1} request={slot.request} c={c} />;
                        return <EmptyCourtTile key={`empty-${i}`} courtNumber={i + 1} c={c} />;
                    })}
                </div>
            </div>
        </>
    );
};

// ── Floating "back to /referee" button (Pi-tabletop affordance) ─────
// Shown at top-left across every arena state so the Pi can always
// return home without browser chrome.
const BackToReferee: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div
        onClick={onClick}
        style={{
            position: 'fixed', top: 12, left: 12, zIndex: 1000,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
        }}
        onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'; }}
        onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.6)'; }}
    >
        <span style={{ fontSize: 14 }}>←</span>
        <span>REFEREE</span>
    </div>
);

// ─── Carousel View (extracted to isolate interval effects) ────────────────────

const CarouselView: React.FC<{
    header: React.ReactNode;
    slots: Array<{ type: 'active'; gameCode: string } | { type: 'pending'; request: PendingRequest } | { type: 'empty' }>;
    activeCodes: string[];
    activeIndex: number;
    setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
    countdown: number;
    setCountdown: React.Dispatch<React.SetStateAction<number>>;
    carouselIntervalSec: number;
    onScoreEvent: (gc: string) => void;
    c: ArenaColors;
}> = ({ header, slots, activeCodes, activeIndex, setActiveIndex, countdown, setCountdown, carouselIntervalSec, onScoreEvent, c }) => {
    useEffect(() => {
        if (activeCodes.length <= 1) return;
        const advance = setInterval(() => {
            setActiveIndex(i => (i + 1) % activeCodes.length);
            setCountdown(carouselIntervalSec);
        }, carouselIntervalSec * 1000);
        return () => clearInterval(advance);
    }, [activeCodes.length, carouselIntervalSec, setActiveIndex, setCountdown]);

    useEffect(() => {
        if (activeCodes.length <= 1) return;
        const tick = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? carouselIntervalSec : prev - 1));
        }, 1000);
        return () => clearInterval(tick);
    }, [activeCodes.length, carouselIntervalSec, setCountdown]);

    return (
        <div style={{ width: '100vw', height: '100vh', background: c.pageBg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {header}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                {slots.map((slot, i) => {
                    const isActive = i === activeIndex;
                    return (
                        <div key={slot.type === 'active' ? slot.gameCode : slot.type === 'pending' ? slot.request.game_code : `empty-${i}`}
                            style={{
                                position: 'absolute', inset: 0,
                                opacity: isActive ? 1 : 0,
                                transform: isActive ? 'scale(1)' : 'scale(0.96)',
                                transition: 'opacity 0.8s ease, transform 0.8s ease',
                                pointerEvents: isActive ? 'auto' : 'none',
                            }}>
                            {slot.type === 'active' && <ArenaScoreCard gameCode={slot.gameCode} courtNumber={i + 1} totalCourts={1} onScoreEvent={onScoreEvent} c={c} />}
                            {slot.type === 'pending' && <PendingCourtTile courtNumber={i + 1} request={slot.request} c={c} />}
                            {slot.type === 'empty' && <EmptyCourtTile courtNumber={i + 1} c={c} />}
                        </div>
                    );
                })}

                {/* Countdown */}
                {activeCodes.length > 1 && (
                    <div style={{ position: 'absolute', top: 8, right: 14, fontFamily: 'Oswald, monospace', fontSize: '0.5rem', letterSpacing: '0.2em', color: c.vsTxt, zIndex: 10 }}>
                        {countdown}s
                    </div>
                )}

                {/* Dot indicators */}
                {activeCodes.length > 1 && (
                    <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 10 }}>
                        {activeCodes.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => { setActiveIndex(i); setCountdown(carouselIntervalSec); }}
                                style={{ width: 8, height: 8, borderRadius: '50%', background: i === activeIndex ? c.scoreTxt : c.emptyTxt, border: 'none', cursor: 'pointer', padding: 0, transition: 'background 0.3s ease' }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArenaView;
