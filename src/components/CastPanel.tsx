// src/components/CastPanel.tsx
// ═══════════════════════════════════════════════════════════════
//  HOST-SIDE CAST CONTROL PANEL
//  Replaces CastModal entirely. Slides in from the right of
//  HostConsole. Shows ALL live Pi terminals at a glance.
//  One-click cast — no code typing needed from the console.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    fetchAllTvDisplays,
    castGameToTv,
    stopCastingToTv,
    subscribeTvStatus,
    type TvDisplay,
} from '../services/tvDisplayService';

interface CastPanelProps {
    gameCode: string;
    gameName?: string;
    onClose: () => void;
}

const PANEL_CSS = `
@keyframes panelSlideIn {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
}
@keyframes panelSlideOut {
    from { transform: translateX(0);    opacity: 1; }
    to   { transform: translateX(100%); opacity: 0; }
}
@keyframes cpPulse {
    0%,100% { opacity:1; box-shadow:0 0 6px #22c55e; }
    50%      { opacity:0.3; box-shadow:0 0 2px #22c55e; }
}
@keyframes cpSpin {
    to { transform: rotate(360deg); }
}
@keyframes cpFadeIn {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
}
@keyframes cpCardIn {
    from { opacity:0; transform:translateX(20px); }
    to   { opacity:1; transform:translateX(0); }
}
@keyframes cpBeat {
    0%,100% { transform:scaleX(1);   }
    50%      { transform:scaleX(1.5); }
}
`;

// ─── Types ────────────────────────────────────────────────────────────────────
type DisplayWithOps = TvDisplay & {
    casting: boolean;       // casting THIS game
    castingOther: boolean;  // casting a different game
    online: boolean;
};

// ─── Heartbeat Bars ───────────────────────────────────────────────────────────
const HeartbeatBars: React.FC<{ active: boolean }> = ({ active }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
        {[0.6, 1, 0.75, 0.9, 0.5, 0.8, 1].map((h, i) => (
            <div key={i} style={{
                width: 2, height: `${h * 14}px`, borderRadius: 1,
                background: active ? '#22c55e' : '#333',
                animation: active ? `cpBeat 1.2s ${i * 0.12}s ease-in-out infinite` : 'none',
                transition: 'background 0.3s',
            }} />
        ))}
    </div>
);

// ─── TV Screen Card ───────────────────────────────────────────────────────────
const ScreenCard: React.FC<{
    display: DisplayWithOps;
    onCast: () => void;
    onStop: () => void;
    loading: boolean;
    index: number;
}> = ({ display, onCast, onStop, loading, index }) => {
    const [nickname, setNickname] = useState(() =>
        localStorage.getItem(`tv_name_${display.tv_code}`) || ''
    );
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const saveName = () => {
        const val = nickname.trim();
        if (val) localStorage.setItem(`tv_name_${display.tv_code}`, val);
        else localStorage.removeItem(`tv_name_${display.tv_code}`);
        setEditing(false);
    };

    const displayName = nickname || `SCREEN ${display.tv_code}`;
    const statusColor = !display.online ? '#52525b'
        : display.casting ? '#22c55e'
            : display.castingOther ? '#f59e0b'
                : '#3f3f46';

    const statusLabel = !display.online ? 'OFFLINE'
        : display.casting ? 'LIVE — THIS GAME'
            : display.castingOther ? `SHOWING: ${display.game_code}`
                : 'IDLE';

    return (
        <div style={{
            border: `1px solid ${display.casting ? 'rgba(34,197,94,0.3)' : display.online ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'}`,
            borderRadius: 12,
            background: display.casting ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)',
            padding: '14px 16px',
            transition: 'all 0.25s ease',
            animation: `cpCardIn 0.35s ${index * 0.07}s both ease-out`,
            opacity: display.online ? 1 : 0.45,
        }}>
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {editing ? (
                        <input ref={inputRef} value={nickname} onChange={e => setNickname(e.target.value)}
                            onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditing(false); } }}
                            autoFocus maxLength={20}
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(220,38,38,0.4)',
                                borderRadius: 6, padding: '3px 8px', color: '#fff',
                                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                                outline: 'none', width: '100%',
                            }}
                        />
                    ) : (
                        <button onClick={() => setEditing(true)} title="Click to rename"
                            style={{
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                                fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'inherit',
                                letterSpacing: '0.05em', textTransform: 'uppercase',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                            {displayName}
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: 400, letterSpacing: '0.1em' }}>✎</span>
                        </button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: statusColor,
                            boxShadow: display.casting ? `0 0 6px ${statusColor}` : 'none',
                            animation: display.casting ? 'cpPulse 2s ease-in-out infinite' : 'none',
                        }} />
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: statusColor, letterSpacing: '0.25em', textTransform: 'uppercase' }}>
                            {statusLabel}
                        </span>
                    </div>
                </div>

                {/* Code badge */}
                <div style={{
                    fontFamily: 'monospace', fontWeight: 900, fontSize: 18,
                    color: display.online ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
                    letterSpacing: '0.1em', flexShrink: 0, marginLeft: 12,
                }}>
                    {display.tv_code}
                </div>
            </div>

            {/* Heartbeat + last seen */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <HeartbeatBars active={display.online && !display.castingOther} />
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.15em' }}>
                    {display.online
                        ? `${Math.round((Date.now() - display.last_seen) / 1000)}s AGO`
                        : 'TIMED OUT'}
                </span>
            </div>

            {/* Action buttons */}
            {display.online && (
                <div style={{ display: 'flex', gap: 8 }}>
                    {display.casting ? (
                        <button onClick={onStop} disabled={loading}
                            style={{
                                flex: 1, padding: '9px 0',
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                                borderRadius: 8, color: '#ef4444', fontSize: 10, fontWeight: 800,
                                letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
                                fontFamily: 'monospace', transition: 'all 0.15s',
                                opacity: loading ? 0.5 : 1,
                            }}>
                            {loading ? '...' : '⏹ STOP CAST'}
                        </button>
                    ) : (
                        <button onClick={onCast} disabled={loading || !display.online}
                            style={{
                                flex: 1, padding: '9px 0',
                                background: display.castingOther ? 'rgba(220,38,38,0.08)' : 'rgba(220,38,38,0.12)',
                                border: `1px solid ${display.castingOther ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.35)'}`,
                                borderRadius: 8,
                                color: display.castingOther ? '#ef4444' : '#fff',
                                fontSize: 10, fontWeight: 800,
                                letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
                                fontFamily: 'monospace', transition: 'all 0.15s',
                                opacity: loading ? 0.5 : 1,
                            }}>
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <div style={{ width: 10, height: 10, border: '1.5px solid #333', borderTopColor: '#DC2626', borderRadius: '50%', animation: 'cpSpin 0.7s linear infinite' }} />
                                    LINKING...
                                </span>
                            ) : display.castingOther ? '↺ SWITCH TO THIS GAME' : '▶ CAST TO SCREEN'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState: React.FC = () => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '40px 20px', textAlign: 'center', gap: 12,
        animation: 'cpFadeIn 0.4s ease-out',
    }}>
        <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '1px dashed rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, marginBottom: 4,
        }}>📺</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            No Screens Online
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', lineHeight: 1.7, fontFamily: 'monospace', maxWidth: 220 }}>
            Boot a Pi pointed at<br />
            <span style={{ color: 'rgba(220,38,38,0.5)' }}>yourapp.com/tv?code=XXXX</span><br />
            It will appear here instantly.
        </div>
        {/* Mini setup steps */}
        {['1. Flash Pi SD card', '2. Set startup URL with ?code=', '3. Pi auto-registers on boot'].map((s, i) => (
            <div key={i} style={{
                fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.15)',
                letterSpacing: '0.1em', padding: '4px 10px',
                background: 'rgba(255,255,255,0.02)', borderRadius: 4,
                width: '100%', textAlign: 'left',
            }}>
                {s}
            </div>
        ))}
    </div>
);

// ─── Active Cast Banner ───────────────────────────────────────────────────────
const ActiveCastBanner: React.FC<{ count: number; gameName: string; gameCode: string }> = ({ count, gameName, gameCode }) => (
    <div style={{
        margin: '0 0 16px 0', padding: '12px 14px',
        background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
        animation: 'cpFadeIn 0.35s ease-out',
    }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'cpPulse 2s ease-in-out infinite', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                LIVE ON {count} SCREEN{count !== 1 ? 'S' : ''}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {gameName || gameCode}
            </div>
        </div>
    </div>
);

// ─── Main Panel ───────────────────────────────────────────────────────────────
export const CastPanel: React.FC<CastPanelProps> = ({ gameCode, gameName, onClose }) => {
    const [displays, setDisplays] = useState<DisplayWithOps[]>([]);
    const [loading, setLoading] = useState(true);
    const [operatingOn, setOperatingOn] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const subsRef = useRef<Map<string, () => void>>(new Map());
    const refreshRef = useRef<NodeJS.Timeout | null>(null);

    // ── Enrich display with derived state ─────────────────────────────────────
    const enrich = useCallback((d: TvDisplay): DisplayWithOps => ({
        ...d,
        online: Date.now() - d.last_seen < 20000,
        casting: d.status === 'casting' && d.game_code === gameCode,
        castingOther: d.status === 'casting' && d.game_code !== gameCode,
    }), [gameCode]);

    // ── Initial load ───────────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const all = await fetchAllTvDisplays();
            const enriched = all.map(enrich);
            setDisplays(enriched);
            setLoading(false);

            // Subscribe to each display for live updates
            enriched.forEach(d => {
                if (subsRef.current.has(d.tv_code)) return;
                const unsub = subscribeTvStatus(d.tv_code, (updated: TvDisplay) => {
                    setDisplays(prev => prev.map(p => p.tv_code === updated.tv_code ? enrich(updated) : p));
                });
                subsRef.current.set(d.tv_code, unsub);
            });
        };

        load();

        // Refresh display list every 15s to pick up newly booted Pis
        refreshRef.current = setInterval(load, 15000);

        return () => {
            if (refreshRef.current) clearInterval(refreshRef.current);
            subsRef.current.forEach(unsub => unsub());
            subsRef.current.clear();
        };
    }, [gameCode]); // eslint-disable-line

    // ── Cast ──────────────────────────────────────────────────────────────────
    const handleCast = async (tvCode: string) => {
        setOperatingOn(tvCode);
        setError(null);
        const result = await castGameToTv(tvCode, gameCode);
        if (!result.success) setError(result.message);
        setOperatingOn(null);
    };

    // ── Stop ──────────────────────────────────────────────────────────────────
    const handleStop = async (tvCode: string) => {
        setOperatingOn(tvCode);
        setError(null);
        await stopCastingToTv(tvCode);
        setOperatingOn(null);
    };

    const onlineScreens = displays.filter(d => d.online);
    const castingCount = displays.filter(d => d.casting).length;
    const onlineCount = onlineScreens.length;

    return (
        <>
            <style>{PANEL_CSS}</style>

            {/* Backdrop */}
            <div onClick={onClose} style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(3px)',
                zIndex: 200,
            }} />

            {/* Panel */}
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: 'clamp(320px,30vw,420px)',
                background: '#0a0a0a',
                borderLeft: '1px solid rgba(255,255,255,0.07)',
                zIndex: 201,
                display: 'flex', flexDirection: 'column',
                animation: 'panelSlideIn 0.28s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.8)',
            }}>

                {/* Header */}
                <div style={{
                    padding: '20px 20px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(220,38,38,0.8)', letterSpacing: '0.45em', textTransform: 'uppercase', marginBottom: 4, fontFamily: 'monospace' }}>
                                LED CAST CONTROL
                            </div>
                            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                                BROADCAST
                            </h2>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: 2 }}>
                                {onlineCount} screen{onlineCount !== 1 ? 's' : ''} online · {castingCount} live
                            </div>
                        </div>
                        <button onClick={onClose} style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}>×</button>
                    </div>

                    {/* Game being cast */}
                    <div style={{
                        marginTop: 14, padding: '10px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 8,
                        display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>GAME</div>
                        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {gameName || 'ACTIVE GAME'}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(220,38,38,0.7)', letterSpacing: '0.1em', flexShrink: 0 }}>
                            {gameCode}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

                    {/* Active cast banner */}
                    {castingCount > 0 && (
                        <ActiveCastBanner count={castingCount} gameName={gameName || ''} gameCode={gameCode} />
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{
                            padding: '10px 14px', marginBottom: 14,
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 8, animation: 'cpFadeIn 0.3s ease-out',
                        }}>
                            <div style={{ fontSize: 10, color: '#ef4444', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{error}</div>
                        </div>
                    )}

                    {/* Section heading */}
                    <div style={{
                        fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)',
                        letterSpacing: '0.35em', textTransform: 'uppercase',
                        fontFamily: 'monospace', marginBottom: 12,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <span>SCREENS</span>
                        {loading && <div style={{ width: 10, height: 10, border: '1.5px solid #222', borderTopColor: '#DC2626', borderRadius: '50%', animation: 'cpSpin 0.7s linear infinite' }} />}
                    </div>

                    {/* Screen cards */}
                    {!loading && displays.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Online first */}
                            {[...displays].sort((a, b) => {
                                if (a.casting && !b.casting) return -1;
                                if (!a.casting && b.casting) return 1;
                                if (a.online && !b.online) return -1;
                                if (!a.online && b.online) return 1;
                                return 0;
                            }).map((d, i) => (
                                <ScreenCard
                                    key={d.tv_code}
                                    display={d}
                                    index={i}
                                    loading={operatingOn === d.tv_code}
                                    onCast={() => handleCast(d.tv_code)}
                                    onStop={() => handleStop(d.tv_code)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer: Stop all + refresh */}
                {castingCount > 0 && (
                    <div style={{
                        padding: '14px 20px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        flexShrink: 0,
                    }}>
                        <button
                            onClick={() => {
                                displays.filter(d => d.casting).forEach(d => handleStop(d.tv_code));
                            }}
                            style={{
                                width: '100%', padding: '11px 0',
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 10, color: 'rgba(239,68,68,0.8)',
                                fontSize: 10, fontWeight: 800,
                                letterSpacing: '0.25em', textTransform: 'uppercase',
                                cursor: 'pointer', fontFamily: 'monospace',
                                transition: 'all 0.15s',
                            }}
                        >
                            ⏹ STOP ALL CASTS ({castingCount})
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default CastPanel;