// src/pages/PlayerCard.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — SHAREABLE PLAYER STAT CARD
//
// Route: /player/:gameCode/:playerId
// Public, no auth. Designed to screenshot and share on Instagram/WhatsApp.
// Renders a 400×600 card with player stats + mini shot chart heatmap.
//
// THE BOX watermark is always present — organic marketing.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getGameByCode } from '../services/supabaseGameService';
import { getShotsForGame, computePlayerShotSummaries } from '../services/shotService';
import type { BasketballGame } from '../types';
import type { PlayerShotSummary } from '../components/shotchart/types/shotTypes';

// ── Mini court heatmap zones (simplified 6-zone version) ──────
const MINI_ZONES = [
    { id: 'paint', label: 'Paint', x: 140, y: 60, w: 120, h: 90 },
    { id: 'mid_left', label: 'Mid L', x: 60, y: 80, w: 80, h: 70 },
    { id: 'mid_right', label: 'Mid R', x: 260, y: 80, w: 80, h: 70 },
    { id: 'three_left', label: '3 L', x: 20, y: 30, w: 60, h: 120 },
    { id: 'three_right', label: '3 R', x: 320, y: 30, w: 60, h: 120 },
    { id: 'three_top', label: '3 Top', x: 100, y: 10, w: 200, h: 55 },
];

const zoneColor = (pct: number | null): string => {
    if (pct === null) return 'rgba(255,255,255,0.04)';
    if (pct >= 50) return 'rgba(34,197,94,0.3)';
    if (pct >= 35) return 'rgba(245,158,11,0.25)';
    return 'rgba(239,68,68,0.25)';
};

// ═══════════════════════════════════════════════════════════════

export default function PlayerCard() {
    const { gameCode, playerId } = useParams<{ gameCode: string; playerId: string }>();

    const [game, setGame] = useState<BasketballGame | null>(null);
    const [summary, setSummary] = useState<PlayerShotSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!gameCode || !playerId) return;
        (async () => {
            try {
                const [gameData, shots] = await Promise.all([
                    getGameByCode(gameCode),
                    getShotsForGame(gameCode),
                ]);
                if (!gameData) throw new Error('Game not found');
                setGame(gameData);

                const summaries = computePlayerShotSummaries(shots);
                const playerSummary = summaries.find(s => s.playerId === playerId);
                if (!playerSummary) throw new Error('Player has no recorded shots');
                setSummary(playerSummary);
            } catch (e: unknown) {
                setError((e as Error).message);
            } finally {
                setLoading(false);
            }
        })();
    }, [gameCode, playerId]);

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', background: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{
                    width: 24, height: 24, border: '2px solid #222',
                    borderTop: '2px solid #F59E0B', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error || !game || !summary) {
        return (
            <div style={{
                minHeight: '100vh', background: '#000',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16, color: '#444',
                fontFamily: "'Barlow', sans-serif",
            }}>
                <div style={{ fontSize: 48, fontWeight: 900, fontStyle: 'italic', color: '#1a1a1a' }}>
                    NO DATA
                </div>
                <div style={{ fontSize: 14 }}>{error || 'Player stats not found'}</div>
            </div>
        );
    }

    // Determine team side and colors
    const teamSide = game.teamA.players?.find((p: { id: string }) => p.id === playerId) ? 'A' : 'B';
    const team = teamSide === 'A' ? game.teamA : game.teamB;
    const teamColor = team.color || (teamSide === 'A' ? '#3B82F6' : '#EF4444');
    const opponentScore = teamSide === 'A' ? game.teamB.score : game.teamA.score;
    const teamScore = teamSide === 'A' ? game.teamA.score : game.teamB.score;
    const won = teamScore > opponentScore;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:ital,wght@0,700;0,800;1,700;1,800&family=JetBrains+Mono:wght@500;700&family=Barlow:wght@400;500;600;700&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #0a0a0a; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
            `}</style>

            <div ref={cardRef} style={{
                width: 400, background: '#000',
                borderRadius: 20, overflow: 'hidden',
                fontFamily: "'Oswald', sans-serif",
                boxShadow: `0 0 0 1px ${teamColor}33, 0 40px 80px rgba(0,0,0,0.8)`,
            }}>

                {/* ── TOP COLOR BAR ── */}
                <div style={{
                    height: 4,
                    background: `linear-gradient(90deg, ${teamColor}, ${teamColor}88, transparent)`,
                }} />

                {/* ── HEADER ── */}
                <div style={{
                    padding: '20px 24px 16px',
                    background: `linear-gradient(135deg, ${teamColor}15 0%, transparent 60%)`,
                    borderBottom: '1px solid #111',
                }}>
                    <div style={{
                        fontSize: 10, letterSpacing: '0.3em', color: '#444',
                        fontFamily: "'JetBrains Mono', monospace", marginBottom: 6,
                    }}>
                        {game.settings?.gameName || `${game.teamA.name} vs ${game.teamB.name}`}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{
                                fontSize: 36, fontWeight: 700, color: '#fff',
                                letterSpacing: '-0.01em', lineHeight: 1,
                            }}>
                                {summary.playerName}
                            </div>
                            <div style={{
                                fontSize: 12, color: teamColor, letterSpacing: '0.15em',
                                marginTop: 4, textTransform: 'uppercase',
                            }}>
                                {team.name}
                            </div>
                        </div>

                        {/* Win/Loss badge */}
                        <div style={{
                            padding: '6px 14px', borderRadius: 8,
                            background: won ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
                            border: `1px solid ${won ? '#22C55E44' : '#EF444433'}`,
                            color: won ? '#22C55E' : '#EF4444',
                            fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
                        }}>
                            {won ? 'W' : 'L'} {teamScore}–{opponentScore}
                        </div>
                    </div>
                </div>

                {/* ── PRIMARY STATS ── */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    borderBottom: '1px solid #111',
                }}>
                    {[
                        { label: 'PTS', value: summary.fgm * 2 + summary.threePm * 1 + summary.ftM, big: true },
                        { label: 'FG%', value: summary.fga > 0 ? `${summary.fgPct.toFixed(0)}%` : '—' },
                        { label: 'eFG%', value: summary.fga > 0 ? `${summary.efgPct.toFixed(0)}%` : '—' },
                    ].map((stat, i) => (
                        <div key={stat.label} style={{
                            padding: '18px 12px', textAlign: 'center',
                            borderRight: i < 2 ? '1px solid #111' : 'none',
                        }}>
                            <div style={{
                                fontSize: stat.big ? 48 : 32, fontWeight: 700,
                                color: stat.big ? teamColor : '#fff', lineHeight: 1,
                            }}>
                                {stat.value}
                            </div>
                            <div style={{
                                fontSize: 9, color: '#444', letterSpacing: '0.2em',
                                fontFamily: "'JetBrains Mono', monospace", marginTop: 4,
                            }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── SECONDARY STATS ROW ── */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                    borderBottom: '1px solid #111', padding: '12px 0',
                }}>
                    {[
                        { label: 'FGA', value: summary.fga },
                        { label: 'FGM', value: summary.fgm },
                        { label: '3PA', value: summary.threePa },
                        { label: '3PM', value: summary.threePm },
                    ].map((stat, i) => (
                        <div key={stat.label} style={{
                            textAlign: 'center',
                            borderRight: i < 3 ? '1px solid #0f0f0f' : 'none',
                        }}>
                            <div style={{
                                fontSize: 22, fontWeight: 700, color: '#fff',
                            }}>
                                {stat.value}
                            </div>
                            <div style={{
                                fontSize: 9, color: '#333', letterSpacing: '0.15em',
                                fontFamily: "'JetBrains Mono', monospace",
                            }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── MINI SHOT CHART ── */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #111' }}>
                    <div style={{
                        fontSize: 9, color: '#333', letterSpacing: '0.2em',
                        fontFamily: "'JetBrains Mono', monospace", marginBottom: 10,
                    }}>
                        SHOT DISTRIBUTION
                    </div>
                    <div style={{ position: 'relative', height: 160, borderRadius: 8, overflow: 'hidden', background: '#050505' }}>
                        {/* Basket */}
                        <div style={{
                            position: 'absolute', left: '50%', top: '60%',
                            transform: 'translateX(-50%)',
                            width: 12, height: 12, borderRadius: '50%',
                            border: `2px solid ${teamColor}88`,
                        }} />
                        {/* Paint box */}
                        <div style={{
                            position: 'absolute', left: '35%', top: '45%',
                            width: '30%', height: '40%',
                            border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 2,
                        }} />
                        {/* 3-point arc (simplified as oval top) */}
                        <div style={{
                            position: 'absolute', left: '10%', top: '10%',
                            width: '80%', height: '70%',
                            borderRadius: '50% 50% 0 0 / 80% 80% 0 0',
                            border: `1px solid rgba(255,255,255,0.06)`,
                            borderBottom: 'none',
                        }} />

                        {/* Zone labels with FG% coloring */}
                        {[
                            { label: `${summary.fga > 0 ? summary.fgPct.toFixed(0) : '—'}%`, x: '50%', y: '55%', note: 'Paint' },
                            { label: `${summary.threePct > 0 ? summary.threePct.toFixed(0) : '—'}%`, x: '50%', y: '8%', note: '3PT' },
                        ].map((z, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                left: z.x, top: z.y,
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                            }}>
                                <div style={{
                                    fontSize: 14, fontWeight: 700, color: teamColor,
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}>
                                    {z.label}
                                </div>
                                <div style={{ fontSize: 8, color: '#333', letterSpacing: '0.1em' }}>
                                    {z.note}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── TS% BAR ── */}
                <div style={{ padding: '14px 24px', borderBottom: '1px solid #111' }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 6,
                    }}>
                        <span style={{
                            fontSize: 9, color: '#444', letterSpacing: '0.2em',
                            fontFamily: "'JetBrains Mono', monospace",
                        }}>
                            TRUE SHOOTING %
                        </span>
                        <span style={{
                            fontSize: 14, fontWeight: 700, color: '#fff',
                            fontFamily: "'JetBrains Mono', monospace",
                        }}>
                            {summary.fga > 0 ? `${summary.tsPct.toFixed(1)}%` : '—'}
                        </span>
                    </div>
                    <div style={{ height: 3, background: '#111', borderRadius: 2 }}>
                        <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${Math.min(100, summary.tsPct)}%`,
                            background: summary.tsPct >= 55
                                ? '#22C55E'
                                : summary.tsPct >= 45
                                    ? '#F59E0B'
                                    : '#EF4444',
                            transition: 'width 1s ease',
                        }} />
                    </div>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        marginTop: 3,
                    }}>
                        <span style={{ fontSize: 8, color: '#222', fontFamily: "'JetBrains Mono', monospace" }}>0</span>
                        <span style={{ fontSize: 8, color: '#333', fontFamily: "'JetBrains Mono', monospace" }}>
                            League avg ≈ 55%
                        </span>
                        <span style={{ fontSize: 8, color: '#222', fontFamily: "'JetBrains Mono', monospace" }}>100</span>
                    </div>
                </div>

                {/* ── FOOTER / WATERMARK ── */}
                <div style={{
                    padding: '12px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{
                        fontSize: 9, color: '#222', letterSpacing: '0.25em',
                        fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        Powered by THE BOX
                    </div>
                    <div style={{
                        fontSize: 9, color: '#1a1a1a', letterSpacing: '0.1em',
                        fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        {new Date().toLocaleDateString('en-IN')}
                    </div>
                </div>
            </div>
        </>
    );
}