// src/pages/ShotChartView.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Post-Game Shot Chart Visualization
//
// Route: /game/:code/shots (public, no auth)
//
// Three views: Scatter Plot | Zone Efficiency | Stats Table
// Filter by: team, player, period, made/missed
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HalfCourt } from '../components/shotchart/HalfCourt';
import { useShotChart } from '../hooks/useShotChart';
import { getGameByCode } from '../services/supabaseGameService';
import type { BasketballGame } from '../types';
import type { ShotEvent, ZoneStat } from '../components/shotchart/types/shotTypes';
import { ZONES } from '../components/shotchart/courtZones';

type ViewMode = 'scatter' | 'zones' | 'table';

// ── Stat Pill ────────────────────────────────────────────────────────────────

const StatPill: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
    <div style={{
        background: accent ? 'rgba(245,158,11,0.08)' : '#111',
        border: accent ? '1px solid rgba(245,158,11,0.2)' : '1px solid #1a1a1a',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        minWidth: 70,
    }}>
        <span style={{
            fontSize: 20, fontWeight: 800, color: accent ? '#F59E0B' : '#fff',
            fontFamily: '"Barlow Condensed", sans-serif',
        }}>
            {value}
        </span>
        <span style={{
            fontSize: 9, fontWeight: 700, color: '#555',
            textTransform: 'uppercase', letterSpacing: '0.15em',
            fontFamily: '"Barlow", sans-serif',
        }}>
            {label}
        </span>
    </div>
);

// ── Filter Bar ───────────────────────────────────────────────────────────────

const FilterPill: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
    color?: string;
}> = ({ label, active, onClick, color }) => (
    <button
        onClick={onClick}
        style={{
            padding: '6px 14px',
            borderRadius: 20,
            border: active ? `1px solid ${color || '#F59E0B'}` : '1px solid #222',
            background: active ? `${color || '#F59E0B'}15` : 'transparent',
            color: active ? '#fff' : '#666',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            fontFamily: '"Barlow", sans-serif',
        }}
    >
        {label}
    </button>
);

// ── Zone Stats Table ─────────────────────────────────────────────────────────

const ZoneStatsTable: React.FC<{ zoneStats: ZoneStat[] }> = ({ zoneStats }) => {
    const [sortBy, setSortBy] = useState<keyof ZoneStat>('fga');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const sorted = useMemo(() => {
        return [...zoneStats].sort((a, b) => {
            const aVal = a[sortBy] as number;
            const bVal = b[sortBy] as number;
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }, [zoneStats, sortBy, sortDir]);

    const toggleSort = (col: keyof ZoneStat) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('desc'); }
    };

    const totals = useMemo(() => {
        const fga = zoneStats.reduce((s, z) => s + z.fga, 0);
        const fgm = zoneStats.reduce((s, z) => s + z.fgm, 0);
        const pts = zoneStats.reduce((s, z) => s + z.points, 0);
        return { fga, fgm, fgPct: fga > 0 ? (fgm / fga) * 100 : 0, pts, pps: fga > 0 ? pts / fga : 0 };
    }, [zoneStats]);

    const headerStyle: React.CSSProperties = {
        padding: '10px 12px', textAlign: 'right', cursor: 'pointer',
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const,
        letterSpacing: '0.15em', color: '#555', userSelect: 'none',
        fontFamily: '"Barlow", sans-serif',
    };
    const cellStyle: React.CSSProperties = {
        padding: '10px 12px', textAlign: 'right', fontSize: 13,
        fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 600,
        color: '#ccc', borderBottom: '1px solid #111',
    };

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #222' }}>
                        <th style={{ ...headerStyle, textAlign: 'left' }}>Zone</th>
                        <th style={headerStyle} onClick={() => toggleSort('fga')}>
                            FGA {sortBy === 'fga' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        </th>
                        <th style={headerStyle} onClick={() => toggleSort('fgm')}>
                            FGM {sortBy === 'fgm' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        </th>
                        <th style={headerStyle} onClick={() => toggleSort('fgPct')}>
                            FG% {sortBy === 'fgPct' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        </th>
                        <th style={headerStyle} onClick={() => toggleSort('points')}>
                            PTS {sortBy === 'points' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        </th>
                        <th style={headerStyle} onClick={() => toggleSort('ptsPerShot')}>
                            PPS {sortBy === 'ptsPerShot' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(z => {
                        const pctColor = z.fgPct >= 45 ? '#22C55E' : z.fgPct >= 35 ? '#FBBF24' : '#EF4444';
                        return (
                            <tr key={z.zone}>
                                <td style={{ ...cellStyle, textAlign: 'left', color: '#999' }}>{z.label}</td>
                                <td style={cellStyle}>{z.fga}</td>
                                <td style={cellStyle}>{z.fgm}</td>
                                <td style={{ ...cellStyle, color: pctColor, fontWeight: 800 }}>
                                    {z.fga > 0 ? z.fgPct.toFixed(1) : '—'}
                                </td>
                                <td style={cellStyle}>{z.points}</td>
                                <td style={cellStyle}>{z.fga > 0 ? z.ptsPerShot.toFixed(2) : '—'}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr style={{ borderTop: '2px solid #333' }}>
                        <td style={{ ...cellStyle, textAlign: 'left', color: '#fff', fontWeight: 800 }}>TOTALS</td>
                        <td style={{ ...cellStyle, color: '#fff', fontWeight: 800 }}>{totals.fga}</td>
                        <td style={{ ...cellStyle, color: '#fff', fontWeight: 800 }}>{totals.fgm}</td>
                        <td style={{ ...cellStyle, color: '#F59E0B', fontWeight: 800 }}>{totals.fgPct.toFixed(1)}</td>
                        <td style={{ ...cellStyle, color: '#fff', fontWeight: 800 }}>{totals.pts}</td>
                        <td style={{ ...cellStyle, color: '#fff', fontWeight: 800 }}>{totals.pps.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

// ── Main Page ────────────────────────────────────────────────────────────────

export const ShotChartView: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const [game, setGame] = useState<BasketballGame | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('scatter');

    const {
        filteredShots, filter, updateFilter, resetFilter,
        zoneStats, aggregateStats, periods, loading, shotCount, hasLocationData,
    } = useShotChart(code || null);

    // Fetch game metadata
    useEffect(() => {
        if (!code) return;
        getGameByCode(code).then(setGame);
    }, [code]);

    // Convert shots to scatter plot dots
    const scatterDots = useMemo(() => {
        return filteredShots
            .filter(s => s.zone !== 'unlocated' && s.shotType === 'field_goal')
            .map((s, i, arr) => ({
                id: s.id,
                x: s.x,
                y: s.y,
                made: s.made,
                points: s.points as 1 | 2 | 3,
                isLatest: i === arr.length - 1,
                playerName: s.playerId || undefined,
            }));
    }, [filteredShots]);

    // Zone overlays for efficiency map
    const zoneOverlays = useMemo(() => {
        return zoneStats
            .filter(z => z.zone !== 'unlocated')
            .map(z => ({
                zoneId: z.zone,
                fgPct: z.fgPct,
                fga: z.fga,
                label: z.label,
            }));
    }, [zoneStats]);

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', background: '#000', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{
                    width: 24, height: 24, border: '2px solid #333',
                    borderTop: '2px solid #F59E0B', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (shotCount === 0) {
        return (
            <div style={{
                minHeight: '100vh', background: '#000', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 16, color: '#555', fontFamily: '"Barlow", sans-serif',
            }}>
                <div style={{
                    fontSize: 48, fontWeight: 900, fontStyle: 'italic',
                    color: '#1a1a1a', textTransform: 'uppercase',
                    fontFamily: '"Barlow Condensed", sans-serif',
                }}>
                    No shot data
                </div>
                <div style={{ fontSize: 14 }}>
                    This game was not tracked in Advanced Stats mode.
                </div>
                {code && (
                    <Link to={`/watch/${code}`} style={{
                        color: '#F59E0B', fontSize: 12, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.15em',
                        textDecoration: 'none',
                    }}>
                        View scoreboard instead
                    </Link>
                )}
            </div>
        );
    }

    const teamAName = game?.teamA?.name || 'TEAM A';
    const teamBName = game?.teamB?.name || 'TEAM B';
    const teamAColor = game?.teamA?.color || '#DC2626';
    const teamBColor = game?.teamB?.color || '#2563EB';

    return (
        <div style={{
            minHeight: '100vh', background: '#000', color: '#fff',
            fontFamily: '"Barlow", sans-serif',
        }}>
            {/* ── HEADER ───────────────────────────────────────────── */}
            <header style={{
                padding: '20px 24px', borderBottom: '1px solid #111',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div>
                    <div style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.25em', color: '#555', marginBottom: 4,
                    }}>
                        Shot chart
                    </div>
                    <h1 style={{
                        fontSize: 22, fontWeight: 900, fontStyle: 'italic',
                        textTransform: 'uppercase', letterSpacing: '-0.02em',
                        margin: 0, fontFamily: '"Barlow Condensed", sans-serif',
                    }}>
                        {teamAName}
                        <span style={{ color: '#333', margin: '0 10px' }}>vs</span>
                        {teamBName}
                    </h1>
                </div>
                <div style={{
                    fontSize: 11, color: '#555', textAlign: 'right',
                    fontFamily: '"Barlow Condensed", sans-serif',
                }}>
                    <div style={{ fontWeight: 700, letterSpacing: '0.1em' }}>
                        GAME {code}
                    </div>
                    <div style={{ color: '#333', fontSize: 10, marginTop: 2 }}>
                        {filteredShots.length} shots tracked
                    </div>
                    {code && (
                        <Link to={`/game/${code}/stats`} style={{
                            display: 'inline-block', marginTop: 6, color: '#F59E0B',
                            fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                            letterSpacing: '0.12em', textDecoration: 'none',
                        }}>
                            Full Stats →
                        </Link>
                    )}
                </div>
            </header>

            {/* ── AGGREGATE STATS ROW ──────────────────────────────── */}
            <div style={{
                display: 'flex', gap: 8, padding: '16px 24px',
                overflowX: 'auto', borderBottom: '1px solid #0a0a0a',
            }}>
                <StatPill label="FG%" value={`${aggregateStats.fgPct.toFixed(1)}%`} accent />
                <StatPill label="FGM/A" value={`${aggregateStats.fgm}/${aggregateStats.fga}`} />
                <StatPill label="3P%" value={`${aggregateStats.threePct.toFixed(1)}%`} />
                <StatPill label="3PM/A" value={`${aggregateStats.threePm}/${aggregateStats.threePa}`} />
                <StatPill label="eFG%" value={`${aggregateStats.efgPct.toFixed(1)}%`} accent />
                <StatPill label="PTS/Shot" value={aggregateStats.ptsPerShot.toFixed(2)} />
                <StatPill label="Points" value={`${aggregateStats.totalPoints}`} />
            </div>

            {/* ── FILTERS ─────────────────────────────────────────── */}
            <div style={{
                padding: '12px 24px', display: 'flex', gap: 8,
                flexWrap: 'wrap', borderBottom: '1px solid #0a0a0a',
            }}>
                {/* Team filter */}
                <FilterPill label="All" active={filter.teamSide === 'all'}
                    onClick={() => updateFilter({ teamSide: 'all' })} />
                <FilterPill label={teamAName} active={filter.teamSide === 'A'}
                    onClick={() => updateFilter({ teamSide: 'A' })} color={teamAColor} />
                <FilterPill label={teamBName} active={filter.teamSide === 'B'}
                    onClick={() => updateFilter({ teamSide: 'B' })} color={teamBColor} />

                <div style={{ width: 1, background: '#1a1a1a', margin: '0 4px' }} />

                {/* Result filter */}
                <FilterPill label="All shots" active={filter.result === 'all'}
                    onClick={() => updateFilter({ result: 'all' })} />
                <FilterPill label="Made" active={filter.result === 'made'}
                    onClick={() => updateFilter({ result: 'made' })} color="#22C55E" />
                <FilterPill label="Missed" active={filter.result === 'missed'}
                    onClick={() => updateFilter({ result: 'missed' })} color="#EF4444" />

                <div style={{ width: 1, background: '#1a1a1a', margin: '0 4px' }} />

                {/* Period filter */}
                {periods.map(p => (
                    <FilterPill key={p} label={`Q${p}`}
                        active={filter.period === p}
                        onClick={() => updateFilter({ period: filter.period === p ? null : p })} />
                ))}

                {(filter.teamSide !== 'all' || filter.result !== 'all' || filter.period !== null) && (
                    <FilterPill label="Reset" active={false} onClick={resetFilter} color="#EF4444" />
                )}
            </div>

            {/* ── VIEW MODE TABS ──────────────────────────────────── */}
            <div style={{
                display: 'flex', borderBottom: '1px solid #111',
            }}>
                {([
                    { id: 'scatter' as ViewMode, label: 'Shot chart' },
                    { id: 'zones' as ViewMode, label: 'Zone efficiency' },
                    { id: 'table' as ViewMode, label: 'Stats table' },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setViewMode(tab.id)}
                        style={{
                            flex: 1, padding: '14px 16px', background: 'none',
                            border: 'none', borderBottom: viewMode === tab.id
                                ? '2px solid #F59E0B' : '2px solid transparent',
                            color: viewMode === tab.id ? '#fff' : '#555',
                            cursor: 'pointer', fontSize: 11, fontWeight: 800,
                            textTransform: 'uppercase', letterSpacing: '0.15em',
                            transition: 'all 0.15s',
                            fontFamily: '"Barlow", sans-serif',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── VIEW CONTENT ─────────────────────────────────────── */}
            <div style={{ padding: '24px' }}>
                {viewMode === 'scatter' && (
                    <div style={{ maxWidth: 600, margin: '0 auto' }}>
                        <HalfCourt
                            shots={scatterDots}
                            showZones={false}
                        />
                        {/* Legend */}
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: 24,
                            marginTop: 16, fontSize: 11, color: '#666',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                                Made
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, color: '#EF4444', fontSize: 12, lineHeight: 1 }}>
                                    ✕
                                </div>
                                Missed
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%', background: '#22C55E',
                                }} />
                                3PT
                                <div style={{
                                    width: 7, height: 7, borderRadius: '50%', background: '#22C55E',
                                }} />
                                2PT
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'zones' && (
                    <div style={{ maxWidth: 600, margin: '0 auto' }}>
                        <HalfCourt
                            zoneOverlays={zoneOverlays}
                            showZones
                        />
                        {/* Color scale legend */}
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: 16,
                            marginTop: 16, fontSize: 11, color: '#666',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 14, height: 10, borderRadius: 2, background: 'rgba(239,68,68,0.35)' }} />
                                Cold (&lt;25%)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 14, height: 10, borderRadius: 2, background: 'rgba(250,204,21,0.15)' }} />
                                Average
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 14, height: 10, borderRadius: 2, background: 'rgba(34,197,94,0.35)' }} />
                                Hot (&gt;55%)
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'table' && (
                    <ZoneStatsTable zoneStats={zoneStats} />
                )}
            </div>

            {/* ── FOOTER ──────────────────────────────────────────── */}
            <div style={{
                padding: '24px', borderTop: '1px solid #111',
                textAlign: 'center',
            }}>
                <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
                    textTransform: 'uppercase', color: '#333',
                    fontFamily: '"Barlow Condensed", sans-serif',
                }}>
                    Powered by THE BOX
                </div>
            </div>
        </div>
    );
};

export default ShotChartView;