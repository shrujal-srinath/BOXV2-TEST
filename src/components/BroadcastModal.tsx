// src/components/BroadcastModal.tsx
//
// "Broadcast on LED" — the user-facing cast panel.
// Opened from Dashboard hamburger menu → Hardware section.
//
// Two-step flow:
//   1. Shows all online Pi screens (tv_displays table) with live heartbeat status
//   2. User picks a screen → picks an active game → casts
//
// If only one screen is online, auto-selects it.
// If only one active game exists, auto-selects it.

import React, { useState, useEffect, useRef } from 'react';
import {
    fetchAllTvDisplays,
    castGameToTv,
    stopCastingToTv,
    subscribeTvStatus,
    type TvDisplay,
} from '../services/tvDisplayService';
import { supabase } from '../services/supabase';

interface BroadcastModalProps {
    userId: string;
    onClose: () => void;
}

interface ActiveGame {
    code: string;
    name: string;
    teamA: string;
    teamB: string;
    sport: string;
    status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isScreenOnline = (display: TvDisplay) => Date.now() - display.last_seen < 20000;

const SportEmoji: Record<string, string> = {
    basketball: '🏀',
    badminton: '🏸',
    football: '⚽',
    default: '🎮',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const PulsingDot: React.FC<{ online: boolean }> = ({ online }) => (
    <span style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: online ? '#22c55e' : '#3f3f46',
        boxShadow: online ? '0 0 8px #22c55e' : 'none',
        animation: online ? 'bPulse 2s ease-in-out infinite' : 'none',
        flexShrink: 0,
    }} />
);

const ScreenCard: React.FC<{
    display: TvDisplay;
    selected: boolean;
    onClick: () => void;
}> = ({ display, selected, onClick }) => {
    const online = isScreenOnline(display);
    const casting = display.status === 'casting';

    return (
        <button
            onClick={onClick}
            disabled={!online}
            style={{
                width: '100%',
                background: selected
                    ? 'rgba(220,38,38,0.12)'
                    : online ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                border: `1px solid ${selected ? '#DC2626' : online ? '#27272a' : '#1c1c1f'}`,
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: online ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                opacity: online ? 1 : 0.4,
            }}
        >
            {/* Screen icon */}
            <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: selected ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${selected ? 'rgba(220,38,38,0.4)' : '#27272a'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
            }}>
                📺
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 2,
                }}>
                    <span style={{
                        fontSize: 13,
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        letterSpacing: '0.15em',
                        color: selected ? '#DC2626' : '#ffffff',
                    }}>
                        {display.tv_code}
                    </span>
                    {casting && (
                        <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.2em',
                            color: '#22c55e',
                            background: 'rgba(34,197,94,0.1)',
                            border: '1px solid rgba(34,197,94,0.3)',
                            borderRadius: 4,
                            padding: '1px 6px',
                        }}>
                            LIVE
                        </span>
                    )}
                </div>
                <div style={{
                    fontSize: 10,
                    color: online ? '#52525b' : '#3f3f46',
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                }}>
                    {online
                        ? casting ? `Casting → ${display.game_code}` : 'Ready to receive'
                        : 'Offline'}
                </div>
            </div>

            <PulsingDot online={online} />
        </button>
    );
};

const GameCard: React.FC<{
    game: ActiveGame;
    selected: boolean;
    onClick: () => void;
}> = ({ game, selected, onClick }) => (
    <button
        onClick={onClick}
        style={{
            width: '100%',
            background: selected ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${selected ? '#DC2626' : '#27272a'}`,
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            textAlign: 'left',
        }}
    >
        {/* Sport icon */}
        <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: selected ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${selected ? 'rgba(220,38,38,0.4)' : '#27272a'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
        }}>
            {SportEmoji[game.sport] || SportEmoji.default}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                fontSize: 12,
                fontWeight: 900,
                color: selected ? '#DC2626' : '#ffffff',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {game.name || `${game.teamA} vs ${game.teamB}`}
            </div>
            <div style={{
                fontSize: 10,
                color: '#52525b',
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
            }}>
                {game.teamA} · {game.teamB} · #{game.code}
            </div>
        </div>

        {selected && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
            </svg>
        )}
    </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const BroadcastModal: React.FC<BroadcastModalProps> = ({ userId, onClose }) => {
    const [screens, setScreens] = useState<TvDisplay[]>([]);
    const [games, setGames] = useState<ActiveGame[]>([]);
    const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [phase, setPhase] = useState<'idle' | 'casting' | 'success' | 'stopping'>('idle');
    const [loadingScreens, setLoadingScreens] = useState(true);
    const [loadingGames, setLoadingGames] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const unsubRef = useRef<(() => void) | null>(null);

    // ── Load all Pi screens ───────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setLoadingScreens(true);
            const all = await fetchAllTvDisplays();
            setScreens(all);

            // Auto-select if only one online
            const online = all.filter(isScreenOnline);
            if (online.length === 1) setSelectedScreen(online[0].tv_code);

            setLoadingScreens(false);
        };
        load();

        // Refresh screen list every 10s
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, []);

    // ── Load user's active games ──────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setLoadingGames(true);
            const { data, error } = await supabase
                .from('games')
                .select('code, data, sportId')
                .eq('hostId', userId)
                .eq('status', 'live')
                .order('lastUpdate', { ascending: false });

            if (!error && data) {
                const mapped: ActiveGame[] = data.map((row: any) => ({
                    code: row.code,
                    name: row.data?.settings?.gameName || '',
                    teamA: row.data?.teamA?.name || 'Team A',
                    teamB: row.data?.teamB?.name || 'Team B',
                    sport: row.sportId || row.data?.sportId || 'basketball',
                    status: 'live',
                }));
                setGames(mapped);

                // Auto-select if only one
                if (mapped.length === 1) setSelectedGame(mapped[0].code);
            }
            setLoadingGames(false);
        };
        load();
    }, [userId]);

    // ── Subscribe to selected screen for live status updates ─────────────────
    useEffect(() => {
        unsubRef.current?.();
        if (!selectedScreen) return;

        unsubRef.current = subscribeTvStatus(selectedScreen, (display) => {
            setScreens(prev => prev.map(s =>
                s.tv_code === display.tv_code ? display : s
            ));
        });
        return () => { unsubRef.current?.(); };
    }, [selectedScreen]);

    // Cleanup on unmount
    useEffect(() => () => { unsubRef.current?.(); }, []);

    // ── Cast ──────────────────────────────────────────────────────────────────
    const handleCast = async () => {
        if (!selectedScreen || !selectedGame) return;
        setPhase('casting');
        setError(null);

        const result = await castGameToTv(selectedScreen, selectedGame);
        if (result.success) {
            setPhase('success');
        } else {
            setError(result.message);
            setPhase('idle');
        }
    };

    // ── Stop cast ─────────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (!selectedScreen) return;
        setPhase('stopping');
        await stopCastingToTv(selectedScreen);
        setPhase('idle');
    };

    const selectedScreenData = screens.find(s => s.tv_code === selectedScreen);
    const isCasting = selectedScreenData?.status === 'casting';
    const canCast = selectedScreen && selectedGame && !loadingScreens && phase !== 'casting';
    const onlineScreens = screens.filter(isScreenOnline);

    return (
        <>
            <style>{`
                @keyframes bPulse {
                    0%, 100% { opacity: 1; box-shadow: 0 0 8px #22c55e; }
                    50% { opacity: 0.4; box-shadow: 0 0 3px #22c55e; }
                }
                @keyframes bSpin {
                    to { transform: rotate(360deg); }
                }
                @keyframes bFadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* Backdrop */}
            <div
                onClick={phase === 'casting' ? undefined : onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.88)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                }}
            >
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%',
                        maxWidth: 480,
                        maxHeight: '90vh',
                        background: '#09090b',
                        border: '1px solid #18181b',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 32px 100px rgba(0,0,0,0.9)',
                        animation: 'bFadeIn 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Top accent bar */}
                    <div style={{
                        height: 2,
                        background: phase === 'success'
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : 'linear-gradient(90deg, #DC2626, #7f1d1d)',
                        transition: 'background 0.4s ease',
                        flexShrink: 0,
                    }} />

                    {/* Header */}
                    <div style={{
                        padding: '22px 24px 0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexShrink: 0,
                    }}>
                        <div>
                            <p style={{
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: '0.3em',
                                color: '#3f3f46',
                                textTransform: 'uppercase',
                                fontFamily: 'monospace',
                                marginBottom: 6,
                            }}>
                                LED Display
                            </p>
                            <h2 style={{
                                fontSize: 20,
                                fontWeight: 900,
                                color: '#ffffff',
                                textTransform: 'uppercase',
                                letterSpacing: '-0.02em',
                                lineHeight: 1,
                            }}>
                                {phase === 'success' ? `Broadcasting Live` : 'Broadcast on LED'}
                            </h2>
                        </div>
                        {phase !== 'casting' && (
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#52525b',
                                    cursor: 'pointer',
                                    fontSize: 20,
                                    lineHeight: 1,
                                    padding: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 6,
                                    transition: 'color 0.15s',
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Scrollable body */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '20px 24px 0',
                    }}>

                        {/* ── SUCCESS STATE ── */}
                        {phase === 'success' && selectedScreenData && (
                            <div style={{
                                background: 'rgba(34,197,94,0.06)',
                                border: '1px solid rgba(34,197,94,0.2)',
                                borderRadius: 12,
                                padding: '20px',
                                marginBottom: 20,
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>📺</div>
                                <p style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: '#22c55e',
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    marginBottom: 6,
                                }}>
                                    Broadcasting to {selectedScreen}
                                </p>
                                <p style={{ fontSize: 11, color: '#52525b', fontFamily: 'monospace' }}>
                                    Game #{selectedGame} is now live on the LED display
                                </p>
                            </div>
                        )}

                        {/* ── SCREENS SECTION ── */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 10,
                            }}>
                                <p style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: '0.25em',
                                    color: '#52525b',
                                    textTransform: 'uppercase',
                                    fontFamily: 'monospace',
                                }}>
                                    LED Screens
                                </p>
                                <p style={{
                                    fontSize: 10,
                                    color: onlineScreens.length > 0 ? '#22c55e' : '#52525b',
                                    fontFamily: 'monospace',
                                }}>
                                    {onlineScreens.length} online
                                </p>
                            </div>

                            {loadingScreens ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                                    <div style={{
                                        width: 24,
                                        height: 24,
                                        border: '2px solid #18181b',
                                        borderTopColor: '#DC2626',
                                        borderRadius: '50%',
                                        animation: 'bSpin 0.8s linear infinite',
                                    }} />
                                </div>
                            ) : screens.length === 0 ? (
                                <div style={{
                                    padding: '16px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px dashed #27272a',
                                    borderRadius: 10,
                                    textAlign: 'center',
                                }}>
                                    <p style={{ fontSize: 11, color: '#52525b', fontFamily: 'monospace' }}>
                                        No Pi screens registered yet.
                                    </p>
                                    <p style={{ fontSize: 10, color: '#3f3f46', marginTop: 4, fontFamily: 'monospace' }}>
                                        Boot a Pi pointed at <span style={{ color: '#666' }}>/tv?code=BOX1</span>
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {screens.map(s => (
                                        <ScreenCard
                                            key={s.tv_code}
                                            display={s}
                                            selected={selectedScreen === s.tv_code}
                                            onClick={() => setSelectedScreen(s.tv_code)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── GAMES SECTION ── */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 10,
                            }}>
                                <p style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: '0.25em',
                                    color: '#52525b',
                                    textTransform: 'uppercase',
                                    fontFamily: 'monospace',
                                }}>
                                    Select Game
                                </p>
                                <p style={{
                                    fontSize: 10,
                                    color: '#52525b',
                                    fontFamily: 'monospace',
                                }}>
                                    {games.length} active
                                </p>
                            </div>

                            {loadingGames ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                                    <div style={{
                                        width: 24,
                                        height: 24,
                                        border: '2px solid #18181b',
                                        borderTopColor: '#DC2626',
                                        borderRadius: '50%',
                                        animation: 'bSpin 0.8s linear infinite',
                                    }} />
                                </div>
                            ) : games.length === 0 ? (
                                <div style={{
                                    padding: '16px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px dashed #27272a',
                                    borderRadius: 10,
                                    textAlign: 'center',
                                }}>
                                    <p style={{ fontSize: 11, color: '#52525b', fontFamily: 'monospace' }}>
                                        No active games found.
                                    </p>
                                    <p style={{ fontSize: 10, color: '#3f3f46', marginTop: 4, fontFamily: 'monospace' }}>
                                        Start a game from the dashboard first.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {games.map(g => (
                                        <GameCard
                                            key={g.code}
                                            game={g}
                                            selected={selectedGame === g.code}
                                            onClick={() => setSelectedGame(g.code)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── ERROR ── */}
                        {error && (
                            <div style={{
                                padding: '10px 14px',
                                background: 'rgba(220,38,38,0.08)',
                                border: '1px solid rgba(220,38,38,0.3)',
                                borderRadius: 8,
                                marginBottom: 16,
                            }}>
                                <p style={{ fontSize: 11, color: '#ef4444', fontFamily: 'monospace' }}>{error}</p>
                            </div>
                        )}
                    </div>

                    {/* ── FOOTER ACTIONS ── */}
                    <div style={{
                        padding: '16px 24px 24px',
                        borderTop: '1px solid #18181b',
                        flexShrink: 0,
                        display: 'flex',
                        gap: 10,
                    }}>
                        {/* Stop button — only shown when actively casting */}
                        {isCasting && phase === 'success' && (
                            <button
                                onClick={handleStop}
                                disabled={phase === 'stopping' as any}
                                style={{
                                    flex: 1,
                                    padding: '13px',
                                    background: 'rgba(220,38,38,0.08)',
                                    border: '1px solid rgba(220,38,38,0.3)',
                                    borderRadius: 10,
                                    color: '#ef4444',
                                    fontSize: 11,
                                    fontWeight: 900,
                                    letterSpacing: '0.2em',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                Stop Cast
                            </button>
                        )}

                        {/* Main cast button */}
                        <button
                            onClick={phase === 'success' ? onClose : handleCast}
                            disabled={!canCast && phase !== 'success'}
                            style={{
                                flex: 2,
                                padding: '13px',
                                background: phase === 'success'
                                    ? '#22c55e'
                                    : canCast
                                        ? '#DC2626'
                                        : '#1c1c1f',
                                border: 'none',
                                borderRadius: 10,
                                color: phase === 'success'
                                    ? '#000000'
                                    : canCast ? '#ffffff' : '#3f3f46',
                                fontSize: 11,
                                fontWeight: 900,
                                letterSpacing: '0.2em',
                                textTransform: 'uppercase',
                                cursor: canCast || phase === 'success' ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            {phase === 'casting' ? (
                                <>
                                    <div style={{
                                        width: 14,
                                        height: 14,
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#ffffff',
                                        borderRadius: '50%',
                                        animation: 'bSpin 0.8s linear infinite',
                                    }} />
                                    Casting...
                                </>
                            ) : phase === 'success' ? (
                                'Done'
                            ) : (
                                <>
                                    📺 Broadcast Now
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};