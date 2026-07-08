// src/components/refereebox/PiMatchReport.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Pi MATCH REPORT (PLAN-U P4)
//
// The post-game stats experience on the referee touchscreen,
// reached from PostGameScreen's "MATCH REPORT" button. Runs the
// SAME post-game engine as the website (buildGameReport) and the
// SAME hexbin aggregation (via ReviewHexChart's landscape adapter)
// — one math, Pi-native presentation.
//
// Layout (landscape touchscreen, operator-only):
//   LEFT RAIL   final score · auto-highlights · QR to the web hub
//               · BACK / NEW GAME
//   CONTENT     ≥56px tabs: SHOT MAP (tap-to-read hexes, team
//               filter) · OVERVIEW (quarters, special points,
//               four factors) · PLAYERS (PTS-sorted, GmSc)
// Degrades gracefully: score + QR always render; stats need the
// cloud fetch (daemon persisted them live) — offline shows a
// retriable notice, quick games a "not tracked" notice.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import ReviewHexChart, { type HexFilter } from './ReviewHexChart';
import { landscapeBinId, type LandscapeHexBin } from '../../services/hexbinEngine';
import { buildGameReport, type GameReport } from '../../services/gameReport';
import { persistGameReport } from '../../services/statsPersistService';
import { getGameByCode } from '../../services/supabaseGameService';
import { getShotsForGame, getActionsForGame } from '../../services/shotService';
import { classifyZone, ZONES } from '../shotchart/courtZones';
import type { ShotZoneId } from '../shotchart/types/shotTypes';
import { useReducedMotion } from '../../lib/colorPalettes';

// ── Pi FUI tokens (match GameReviewScreen / MatchSetup family) ──
const SURFACE  = '#101013';
const SURFACE2 = '#18181C';
const BDR      = 'rgba(255,255,255,0.14)';
const BDR_DIM  = 'rgba(255,255,255,0.07)';
const TXT      = '#F4F4F5';
const TXT_DIM  = '#A1A1AA';
const TXT_MUT  = '#5B5B66';
const GREEN    = '#22C55E';
const AMBER    = '#F59E0B';

const RM  = "'JetBrains Mono', monospace";
const OSW = "'Oswald', sans-serif";
const SG  = "'Space Grotesk', sans-serif";

export interface FinalScoreInfo {
    a: number; b: number; teamA: string; teamB: string;
    teamAColor?: string; teamBColor?: string;
    gameCode?: string; gameMode?: string;
}

interface Props {
    score: FinalScoreInfo;
    onClose: () => void;
    onNewGame: () => void;
}

type Tab = 'shotmap' | 'overview' | 'players';
type LoadState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; report: GameReport; shots: import('../shotchart/types/shotTypes').ShotEvent[] };

// ── small primitives ──────────────────────────────────────────

const Label = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.24em', textTransform: 'uppercase' }}>
        {children}
    </span>
);

function VsRow({ label, a, b, colorA, colorB }: { label: string; a: number; b: number; colorA: string; colorB: string }) {
    const total = a + b;
    const aShare = total > 0 ? a / total : 0.5;
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: a >= b ? TXT : TXT_MUT, fontVariantNumeric: 'tabular-nums' }}>{a}</span>
                <Label>{label}</Label>
                <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: b >= a ? TXT : TXT_MUT, fontVariantNumeric: 'tabular-nums' }}>{b}</span>
            </div>
            <div style={{ display: 'flex', gap: 3, height: 4 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${aShare * 100}%`, background: colorA, transition: 'width 0.6s ease-out' }} />
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(1 - aShare) * 100}%`, background: colorB, transition: 'width 0.6s ease-out' }} />
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
export default function PiMatchReport({ score, onClose, onNewGame }: Props) {
    const code = (score.gameCode ?? '').toUpperCase();
    const colorA = score.teamAColor || '#2563EB';
    const colorB = score.teamBColor || '#DC2626';
    const isQuick = score.gameMode === 'quick';
    const reducedMotion = useReducedMotion();

    const [load, setLoad] = useState<LoadState>({ status: 'loading' });
    const [tab, setTab] = useState<Tab>('shotmap');
    const [filter, setFilter] = useState<HexFilter>('both');
    const [selected, setSelected] = useState<LandscapeHexBin | null>(null);
    const [retry, setRetry] = useState(0);
    const [qr, setQr] = useState<string | null>(null);

    const statsUrl = `https://theboxbybmsce.in/game/${code}/stats`;

    // QR to the full web stats hub — always available, even offline.
    useEffect(() => {
        if (!code) return;
        QRCode.toDataURL(statsUrl, { width: 220, margin: 1, color: { dark: '#0A0A0C', light: '#FFFFFF' } })
            .then(setQr)
            .catch(() => setQr(null));
    }, [code, statsUrl]);

    // Fetch + run the post-game engine (client-side, same as the web hub).
    useEffect(() => {
        if (!code || isQuick) return;
        let live = true;
        setLoad({ status: 'loading' });
        Promise.all([getGameByCode(code), getShotsForGame(code), getActionsForGame(code)])
            .then(([game, shots, actions]) => {
                if (!live) return;
                if (!game) { setLoad({ status: 'error' }); return; }
                const report = buildGameReport(game, shots, actions);
                setLoad({ status: 'ready', report, shots });
                // After-game persistence (PLAN-U P3): the Pi report is a persist
                // trigger too — fire-and-forget, idempotent, graceful pre-014.
                void persistGameReport(report, game);
            })
            .catch(() => { if (live) setLoad({ status: 'error' }); });
        return () => { live = false; };
    }, [code, isQuick, retry]);

    const report = load.status === 'ready' ? load.report : null;
    const hasMisses = report?.box.capabilities.hasMisses ?? false;
    const hasLocations = report?.box.capabilities.hasShotLocations ?? false;

    // Default to OVERVIEW when there are no located shots to map.
    useEffect(() => {
        if (report && !hasLocations && tab === 'shotmap') setTab('overview');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [report, hasLocations]);

    const winner: 'A' | 'B' | 'tie' = score.a === score.b ? 'tie' : score.a > score.b ? 'A' : 'B';

    // ── per-period team points (for the OVERVIEW quarter strip) ──
    const periodRows = useMemo(() => {
        if (load.status !== 'ready' || !report) return [];
        const periods = report.header.periods;
        const pts = (side: 'A' | 'B', p: number) =>
            load.shots.filter(s => s.teamSide === side && s.made && s.period === p)
                .reduce((n, s) => n + (s.shotType === 'free_throw' ? 1 : s.points), 0);
        return Array.from({ length: Math.max(periods, 1) }, (_, i) => ({
            p: i + 1, a: pts('A', i + 1), b: pts('B', i + 1),
        }));
    }, [load, report]);

    const specialRows = report ? [
        { label: 'PTS IN PAINT', a: report.special.teamA.inPaint, b: report.special.teamB.inPaint },
        { label: 'FASTBREAK', a: report.special.teamA.fastbreak, b: report.special.teamB.fastbreak },
        { label: '2ND CHANCE', a: report.special.teamA.secondChance, b: report.special.teamB.secondChance },
        { label: 'OFF TURNOVERS', a: report.special.teamA.offTurnover, b: report.special.teamB.offTurnover },
    ].filter(r => r.a + r.b > 0) : [];

    const selZone = selected
        ? (ZONES[classifyZone(selected.cx, selected.cy) as ShotZoneId]?.label ?? '').toUpperCase()
        : null;

    // ── styles ────────────────────────────────────────────────
    const tabBtn = (on: boolean): React.CSSProperties => ({
        flex: 1, height: 52, border: 'none', cursor: 'pointer',
        background: on ? SURFACE2 : 'transparent',
        borderBottom: `2px solid ${on ? GREEN : 'transparent'}`,
        color: on ? TXT : TXT_MUT,
        fontFamily: RM, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
        textTransform: 'uppercase', transition: 'color 0.15s, background 0.15s',
    });
    const segBtn = (on: boolean, color?: string): React.CSSProperties => ({
        padding: '10px 16px', minWidth: 64, border: `1px solid ${on ? (color ?? GREEN) : BDR_DIM}`,
        borderRadius: 4, cursor: 'pointer',
        background: on ? `${color ?? GREEN}1a` : SURFACE2,
        color: on ? (color ?? GREEN) : TXT_DIM,
        fontFamily: RM, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
    });
    const railBtn = (accent: string): React.CSSProperties => ({
        height: 48, border: `1px solid ${accent}44`, borderRadius: 4, cursor: 'pointer',
        background: `${accent}0d`, color: accent,
        fontFamily: RM, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
    });

    return (
        <div style={{
            width: '100vw', height: '100dvh', background: '#08090C',
            display: 'flex', overflow: 'hidden', fontFamily: RM, color: TXT,
        }}>
            <style>{`
                @keyframes pmrIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
                .pmr-in { animation: pmrIn 0.35s ease-out both; }
                @keyframes pmrPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
                @media (prefers-reduced-motion: reduce) { .pmr-in { animation: none; } }
            `}</style>

            {/* ══ LEFT RAIL ══════════════════════════════════════ */}
            <div style={{
                width: 264, flexShrink: 0, display: 'flex', flexDirection: 'column',
                borderRight: `1px solid ${BDR_DIM}`, background: SURFACE, padding: 16, gap: 14,
            }}>
                <div className="pmr-in" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, background: GREEN, animation: reducedMotion ? undefined : 'pmrPulse 1.6s infinite' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.26em' }}>MATCH REPORT</span>
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: TXT_MUT, letterSpacing: '0.2em' }}>{code}</span>
                </div>

                {/* Final score */}
                <div className="pmr-in" style={{ animationDelay: '60ms', border: `1px solid ${BDR_DIM}`, borderRadius: 6, background: SURFACE2, overflow: 'hidden' }}>
                    {([['A', score.teamA, score.a, colorA], ['B', score.teamB, score.b, colorB]] as const).map(([side, name, pts, color]) => {
                        const won = winner === side;
                        return (
                            <div key={side} style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                borderLeft: `3px solid ${color}`,
                                background: won ? `${GREEN}0a` : 'transparent',
                                borderBottom: side === 'A' ? `1px solid ${BDR_DIM}` : 'none',
                            }}>
                                <span style={{
                                    fontFamily: SG, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                                    textTransform: 'uppercase', color: won ? TXT : TXT_DIM,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                                }}>{name}</span>
                                {won && <span style={{ fontSize: 7, color: GREEN, letterSpacing: '0.2em', fontWeight: 700 }}>WIN</span>}
                                <span style={{
                                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 30,
                                    color: won ? TXT : TXT_MUT, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                                }}>{pts}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Auto highlights */}
                {report && report.highlights.length > 0 && (
                    <div className="pmr-in" style={{ animationDelay: '120ms', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflowY: 'auto' }}>
                        <Label>Game story</Label>
                        {report.highlights.slice(0, 4).map((hl, i) => (
                            <div key={`${hl.kind}-${i}`} style={{
                                borderLeft: `2px solid ${hl.side === 'A' ? colorA : hl.side === 'B' ? colorB : GREEN}`,
                                background: SURFACE2, borderRadius: 3, padding: '7px 10px',
                            }}>
                                <div style={{ fontFamily: SG, fontSize: 10, fontWeight: 700, color: TXT, letterSpacing: '0.04em' }}>{hl.label}</div>
                                <div style={{ fontSize: 8, color: TXT_DIM, letterSpacing: '0.06em', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hl.detail}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ flex: 1 }} />

                {/* QR to the full web hub */}
                {qr && (
                    <div className="pmr-in" style={{ animationDelay: '180ms', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${BDR_DIM}`, borderRadius: 6, background: SURFACE2, padding: 10 }}>
                        <img src={qr} alt="Full stats QR" style={{ width: 64, height: 64, borderRadius: 3 }} />
                        <div>
                            <div style={{ fontSize: 8, fontWeight: 700, color: TXT, letterSpacing: '0.16em' }}>FULL STATS + SHARING</div>
                            <div style={{ fontSize: 7, color: TXT_MUT, letterSpacing: '0.1em', marginTop: 3 }}>SCAN — OPENS THE WEB HUB WITH EXPORTS &amp; SHARE CARDS</div>
                        </div>
                    </div>
                )}

                <div className="pmr-in" style={{ animationDelay: '220ms', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={onClose} style={railBtn('#A1A1AA')}
                        onTouchStart={e => { e.currentTarget.style.background = 'rgba(161,161,170,0.18)'; }}
                        onTouchEnd={e => { e.currentTarget.style.background = 'rgba(161,161,170,0.05)'; }}>
                        ← FINAL SCORE
                    </button>
                    <button onClick={onNewGame} style={railBtn(GREEN)}
                        onTouchStart={e => { e.currentTarget.style.background = `${GREEN}22`; }}
                        onTouchEnd={e => { e.currentTarget.style.background = `${GREEN}0d`; }}>
                        ↺ NEW GAME
                    </button>
                </div>
            </div>

            {/* ══ CONTENT ════════════════════════════════════════ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Tabs */}
                <div style={{ display: 'flex', flexShrink: 0, borderBottom: `1px solid ${BDR_DIM}`, background: SURFACE }}>
                    {hasLocations && <button style={tabBtn(tab === 'shotmap')} onClick={() => setTab('shotmap')}>SHOT MAP</button>}
                    <button style={tabBtn(tab === 'overview')} onClick={() => setTab('overview')}>OVERVIEW</button>
                    <button style={tabBtn(tab === 'players')} onClick={() => setTab('players')}>PLAYERS</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>
                    {/* Loading / error / quick states */}
                    {isQuick && (
                        <CenterNotice title="STATS NOT TRACKED" detail="QUICK MODE RECORDS SCORE ONLY — PLAY IN STATS OR ADVANCED MODE FOR THE FULL REPORT" />
                    )}
                    {!isQuick && load.status === 'loading' && (
                        <CenterNotice title="COMPILING MATCH REPORT" detail="FETCHING SHOTS + EVENTS FROM THE CLOUD" pulse />
                    )}
                    {!isQuick && load.status === 'error' && (
                        <CenterNotice
                            title="REPORT UNAVAILABLE"
                            detail="CHECK THE INTERNET LINK — THE GAME DATA IS SAFE IN THE CLOUD QUEUE"
                            action={<button style={{ ...segBtn(true), marginTop: 12 }} onClick={() => setRetry(r => r + 1)}>RETRY</button>}
                        />
                    )}

                    {report && load.status === 'ready' && tab === 'shotmap' && hasLocations && (
                        <div className="pmr-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Team filter */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button style={segBtn(filter === 'both')} onClick={() => { setFilter('both'); setSelected(null); }}>BOTH</button>
                                <button style={segBtn(filter === 'A', colorA)} onClick={() => { setFilter('A'); setSelected(null); }}>{score.teamA}</button>
                                <button style={segBtn(filter === 'B', colorB)} onClick={() => { setFilter('B'); setSelected(null); }}>{score.teamB}</button>
                                <span style={{ marginLeft: 'auto', fontSize: 8, color: TXT_MUT, letterSpacing: '0.14em' }}>
                                    {hasMisses ? 'COLOUR = FG% · SIZE = VOLUME' : 'MISSES NOT TRACKED — SHOWING MAKE VOLUME'}
                                </span>
                            </div>

                            <div style={{ border: `1px solid ${BDR_DIM}`, borderRadius: 6, overflow: 'hidden' }}>
                                <ReviewHexChart
                                    shots={load.shots}
                                    hasMisses={hasMisses}
                                    teamAColor={colorA}
                                    teamBColor={colorB}
                                    filter={filter}
                                    selectedId={selected ? landscapeBinId(selected) : null}
                                    onSelect={setSelected}
                                />
                            </div>

                            {/* Tap readout */}
                            <div style={{
                                minHeight: 56, border: `1px solid ${selected ? BDR : BDR_DIM}`, borderRadius: 6,
                                background: SURFACE2, display: 'flex', alignItems: 'center', gap: 18, padding: '0 16px',
                            }}>
                                {selected ? (
                                    <>
                                        <span style={{ width: 10, height: 10, borderRadius: 2, background: selected.side === 'A' ? colorA : colorB, flexShrink: 0 }} />
                                        <span style={{ fontFamily: SG, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{selZone}</span>
                                        <Stat label="MADE / ATT" value={`${selected.made}/${selected.attempts}`} />
                                        {hasMisses && <Stat label="FG%" value={`${selected.fgPct.toFixed(0)}%`} />}
                                        <Stat label="PTS/SHOT" value={selected.ppa.toFixed(2)} />
                                        {hasMisses && (
                                            <span style={{
                                                marginLeft: 'auto', padding: '4px 10px', borderRadius: 100,
                                                background: selected.delta >= 0 ? `${GREEN}1c` : 'rgba(59,130,246,0.16)',
                                                color: selected.delta >= 0 ? GREEN : '#60A5FA',
                                                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                                            }}>
                                                {selected.delta >= 0 ? '▲' : '▼'} {Math.abs(selected.delta).toFixed(2)} VS EXPECTED
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span style={{ fontSize: 9, color: TXT_MUT, letterSpacing: '0.18em' }}>
                                        TAP A HEX FOR THE ZONE READOUT
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {report && load.status === 'ready' && tab === 'overview' && (
                        <div className="pmr-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {/* Quarter strip */}
                            <div style={{ border: `1px solid ${BDR_DIM}`, borderRadius: 6, background: SURFACE, padding: 14 }}>
                                <Label>Scoring by period</Label>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 12, height: 120 }}>
                                    {periodRows.map(r => {
                                        const max = Math.max(1, ...periodRows.flatMap(x => [x.a, x.b]));
                                        return (
                                            <div key={r.p} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 90, width: '100%', justifyContent: 'center' }}>
                                                    {([['a', r.a, colorA], ['b', r.b, colorB]] as const).map(([k, v, c]) => (
                                                        <div key={k} style={{ width: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                                            <span style={{ fontSize: 8, color: TXT_DIM, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                                                            <div style={{
                                                                width: '100%', borderRadius: 2,
                                                                height: Math.max(4, (v / max) * 70),
                                                                background: c, opacity: v >= (k === 'a' ? r.b : r.a) ? 1 : 0.45,
                                                                transition: 'height 0.5s ease-out',
                                                            }} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <Label>{report.header.periodType === 'half' ? 'H' : 'Q'}{r.p}</Label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Special points */}
                            <div style={{ border: `1px solid ${BDR_DIM}`, borderRadius: 6, background: SURFACE, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <Label>Points breakdown</Label>
                                {specialRows.length > 0 ? specialRows.map(r => (
                                    <VsRow key={r.label} label={r.label} a={r.a} b={r.b} colorA={colorA} colorB={colorB} />
                                )) : (
                                    <span style={{ fontSize: 9, color: TXT_MUT, letterSpacing: '0.14em' }}>NO TAGGED SHOTS THIS GAME</span>
                                )}
                            </div>

                            {/* Four factors */}
                            {report.advanced && (
                                <div style={{ gridColumn: '1 / -1', border: `1px solid ${BDR_DIM}`, borderRadius: 6, background: SURFACE, padding: 14 }}>
                                    <Label>Four factors</Label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 10 }}>
                                        {([
                                            ['eFG%', report.advanced.teamA.fourFactors.efgPct, report.advanced.teamB.fourFactors.efgPct, '%'],
                                            ['TOV%', report.advanced.teamA.fourFactors.tovPct, report.advanced.teamB.fourFactors.tovPct, '%'],
                                            ['ORB%', report.advanced.teamA.fourFactors.orbPct, report.advanced.teamB.fourFactors.orbPct, '%'],
                                            ['FT RATE', report.advanced.teamA.fourFactors.ftRate, report.advanced.teamB.fourFactors.ftRate, '%'],
                                            ['NET RTG', report.advanced.teamA.ratings.netRating, report.advanced.teamB.ratings.netRating, ''],
                                        ] as const).map(([label, a, b, suffix]) => (
                                            <div key={label} style={{ background: SURFACE2, borderRadius: 4, padding: '10px 12px', border: `1px solid ${BDR_DIM}` }}>
                                                <Label>{label}</Label>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                                    <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: colorA, fontVariantNumeric: 'tabular-nums' }}>{a.toFixed(1)}{suffix}</span>
                                                    <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: colorB, fontVariantNumeric: 'tabular-nums' }}>{b.toFixed(1)}{suffix}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {report && load.status === 'ready' && tab === 'players' && (
                        <div className="pmr-in" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr repeat(4, 68px)', gap: 8, padding: '0 12px' }}>
                                <span /><span />
                                {['PTS', 'REB', 'AST', 'GMSC'].map(h => (
                                    <span key={h} style={{ textAlign: 'right' }}><Label>{h}</Label></span>
                                ))}
                            </div>
                            {report.players.slice(0, 12).map((p, i) => {
                                const c = p.side === 'A' ? colorA : colorB;
                                return (
                                    <div key={p.playerId} className="pmr-in" style={{
                                        animationDelay: `${i * 40}ms`,
                                        display: 'grid', gridTemplateColumns: '44px 1fr repeat(4, 68px)', gap: 8,
                                        alignItems: 'center', padding: '9px 12px',
                                        background: SURFACE, border: `1px solid ${BDR_DIM}`, borderLeft: `3px solid ${c}`,
                                        borderRadius: 4,
                                    }}>
                                        <span style={{
                                            width: 32, height: 32, borderRadius: 4, background: `${c}1f`, border: `1px solid ${c}55`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 10, fontWeight: 700, color: c,
                                        }}>{p.number || '—'}</span>
                                        <span style={{ fontFamily: SG, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                        {[p.row.pts, p.row.reb, p.row.ast].map((v, j) => (
                                            <span key={j} style={{ textAlign: 'right', fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums', color: j === 0 ? TXT : TXT_DIM }}>{v}</span>
                                        ))}
                                        <span style={{ textAlign: 'right', fontFamily: RM, fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.gameScore >= 10 ? GREEN : TXT_DIM }}>{p.gameScore.toFixed(1)}</span>
                                    </div>
                                );
                            })}
                            {report.players.length === 0 && (
                                <CenterNotice title="NO PLAYER DATA" detail="NO ATTRIBUTED SHOTS OR ACTIONS THIS GAME" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── shared bits ───────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Label>{label}</Label>
            <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: TXT, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </span>
    );
}

function CenterNotice({ title, detail, pulse, action }: { title: string; detail: string; pulse?: boolean; action?: React.ReactNode }) {
    return (
        <div style={{
            height: '100%', minHeight: 220, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', padding: 24,
        }}>
            <span style={{
                fontFamily: RM, fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.26em',
                animation: pulse ? 'pmrPulse 1.4s ease-in-out infinite' : undefined,
            }}>{title}</span>
            <span style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.18em', maxWidth: 420, lineHeight: 1.8 }}>{detail}</span>
            {action}
        </div>
    );
}
