// src/components/scoring/PredictiveFollowup.tsx
// After a made shot → ASSIST prompt; after a miss → REBOUND prompt.
// Pre-highlights the heuristic player (see useConsoleAnalytics). Auto-skips
// after 6s with a fading progress bar.
import React, { useEffect } from 'react';
import type { FollowupState, FollowupPlayer } from '../../hooks/useConsoleAnalytics';

const BARLOW = '"Barlow Condensed", sans-serif';

interface Props {
    followup: FollowupState | null;
    onResolve: (player: FollowupPlayer) => void;
    onSkip: () => void;
    /** Larger fingertip-sized player buttons for the Pi touch console. */
    touchMode?: boolean;
}

export const PredictiveFollowup: React.FC<Props> = ({ followup, onResolve, onSkip, touchMode = false }) => {
    useEffect(() => {
        if (!followup) return;
        const t = setTimeout(onSkip, 6000);
        return () => clearTimeout(t);
    }, [followup, onSkip]);

    if (!followup) return null;
    const { kind, players } = followup;

    return (
        <div onClick={onSkip} style={{
            position: 'absolute', inset: 0, zIndex: 55,
            background: 'rgba(7,9,14,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--surface-primary, #0D1320)', border: '0.5px solid var(--border-medium, #2B3E5A)',
                borderRadius: 16, padding: 18, width: 420, overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
                fontFamily: BARLOW, color: 'var(--text-primary, #F0F4FF)',
            }}>
                <style>{`@keyframes pfBar { from{width:100%} to{width:0%} }`}</style>
                <div style={{
                    fontSize: 12, letterSpacing: 1.6, fontWeight: 800, fontStyle: 'italic',
                    textTransform: 'uppercase', color: '#a78bfa', marginBottom: 4,
                }}>{kind === 'assist' ? 'Assist?' : 'Rebound?'}</div>
                <div style={{
                    fontSize: 14, color: 'var(--text-secondary, #8D97AA)', marginBottom: 14,
                    fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 0.6,
                }}>Tap the player who got the {kind}, or skip.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {players.map(p => {
                        const hot = p.id === followup.highlightId;
                        return (
                            <button key={`${p.teamSide}-${p.id}`} onClick={() => onResolve(p)} style={{
                                padding: touchMode ? '16px 18px' : '10px 12px', borderRadius: 10, cursor: 'pointer',
                                background: hot ? `${p.teamColor}22` : 'var(--surface-elevated, #152032)',
                                border: `1px solid ${hot ? p.teamColor : 'var(--border-subtle, #1B2640)'}`,
                                color: 'var(--text-primary, #F0F4FF)',
                                display: 'flex', alignItems: 'center', gap: 8, minWidth: touchMode ? 150 : 120,
                            }}>
                                <span style={{
                                    fontWeight: 800, fontSize: touchMode ? 22 : 17, fontStyle: 'italic', color: p.teamColor,
                                }}>{p.number}</span>
                                <span style={{ fontSize: touchMode ? 16 : 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.name}</span>
                            </button>
                        );
                    })}
                </div>
                <button onClick={onSkip} style={{
                    marginTop: 14, width: '100%', padding: 10, borderRadius: 10,
                    background: 'transparent', border: '0.5px solid var(--border-subtle, #1B2640)',
                    color: 'var(--text-tertiary, #5E6B7D)', cursor: 'pointer',
                    fontFamily: BARLOW, fontStyle: 'italic', textTransform: 'uppercase',
                    fontSize: 12, fontWeight: 700, letterSpacing: 1,
                }}>Skip</button>
                <div style={{ height: 3, marginTop: 12, background: 'rgba(167,139,250,0.15)', borderRadius: 2 }}>
                    <div style={{ height: '100%', background: '#a78bfa', borderRadius: 2, animation: 'pfBar 6s linear forwards' }} />
                </div>
            </div>
        </div>
    );
};
