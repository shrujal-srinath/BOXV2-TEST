// src/components/refereebox/PiStatsPlayerPicker.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Stats-Mode Player Attribution Modal
//
// Used in 'stats' game mode (NOT 'advanced'). Stats mode tracks
// per-player points only — no shot location, no shot context.
//
// LAYOUT
//   • A slim live-game header strip slides DOWN from the top
//     (team scores · fouls · timeouts · clock · shot clock · period)
//   • A centered floating modal scales IN with player tiles
//   • Both dismiss together when a player is selected
//
// AUTO-DISMISS
//   10-second countdown — if no selection, the score is recorded as
//   unattributed. The ref can dismiss earlier via skip or close.
//
// FREE THROWS
//   +1 never reaches this component (auto-dismissed upstream).
//   Only +2 and +3 trigger the picker.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ScorePendingEvent, Player, TeamState, ClockState } from '../../hooks/useRefereeBox';

const AUTO_DISMISS_SECS = 10;

const RM  = "'JetBrains Mono', monospace";
const OSW = "'Oswald', sans-serif";

// ── Helpers ──────────────────────────────────────────────────
function fmtClock(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function fmtShot(ms: number): number {
    return Math.max(0, Math.ceil(ms / 1000));
}
function periodLabel(period: number, totalPeriods: number): string {
    if (totalPeriods === 2) return period <= 2 ? `H${period}` : `OT${period - 2}`;
    return period <= totalPeriods ? `Q${period}` : `OT${period - totalPeriods}`;
}

// ══════════════════════════════════════════════════════════════
// COUNTDOWN RING
// ══════════════════════════════════════════════════════════════
function CountdownRing({ secondsLeft, total, color }: {
    secondsLeft: number; total: number; color: string;
}) {
    const R = 11;
    const C = 2 * Math.PI * R;
    const frac = Math.max(0, Math.min(1, secondsLeft / total));
    return (
        <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
            <svg width={28} height={28} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={14} cy={14} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={2.2} fill="none" />
                <circle cx={14} cy={14} r={R} stroke={color} strokeWidth={2.2} fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${frac * C} ${C}`}
                    style={{
                        transition: 'stroke-dasharray 1s linear',
                        filter: `drop-shadow(0 0 4px ${color})`,
                    }}
                />
            </svg>
            <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: OSW, fontWeight: 700, fontSize: 11, color,
                fontStyle: 'italic',
            }}>{secondsLeft}</span>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// LIVE HEADER STRIP — slides down from the top
//
// Layout: [Team A] | [Clock+Period+Shot center] | [Team B]
// Full-width, bold scoreboard-style. Clocks are the visual anchor.
// Scoring team's side highlights with their color.
// ══════════════════════════════════════════════════════════════
function LiveHeader({
    teamA, teamB, teamAColor, teamBColor, clock, scoringTeam,
}: {
    teamA: TeamState; teamB: TeamState;
    teamAColor: string; teamBColor: string;
    clock: ClockState; scoringTeam: 'A' | 'B';
}) {
    const live = clock.isRunning;
    const shotMs = clock.shotMs ?? 0;
    const shotLow = shotMs > 0 && shotMs <= 5000;
    const period = periodLabel(clock.period, clock.totalPeriods);

    return (
        <div style={{
            position: 'fixed', top: 10, left: 10, right: 10,
            zIndex: 102,
            display: 'grid',
            gridTemplateColumns: '1fr minmax(280px, 360px) 1fr',
            alignItems: 'stretch',
            height: 84,
            background: 'rgba(6,8,14,0.97)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 4,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 18px 56px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
            animation: 'spHeaderIn 0.32s cubic-bezier(0.22,1,0.36,1)',
            overflow: 'hidden',
        }}>

            <TeamCorner
                side="A"
                team={teamA} color={teamAColor}
                scoring={scoringTeam === 'A'}
            />

            <ClockCenter
                clock={clock} live={live} shotLow={shotLow}
                shotMs={shotMs} period={period}
            />

            <TeamCorner
                side="B"
                team={teamB} color={teamBColor}
                scoring={scoringTeam === 'B'}
            />
        </div>
    );
}

// ── Team corner — bold stat block ────────────────────────────
function TeamCorner({ side, team, color, scoring }: {
    side: 'A' | 'B'; team: TeamState; color: string; scoring: boolean;
}) {
    const isLeft = side === 'A';
    return (
        <div style={{
            display: 'flex', alignItems: 'center',
            gap: 18, padding: isLeft ? '0 18px 0 24px' : '0 24px 0 18px',
            flexDirection: isLeft ? 'row' : 'row-reverse',
            background: scoring
                ? `linear-gradient(${isLeft ? '90deg' : '270deg'}, ${color}32 0%, ${color}0a 60%, transparent 100%)`
                : 'transparent',
            position: 'relative',
        }}>
            {/* Vertical accent bar for scoring team */}
            {scoring && (
                <div style={{
                    position: 'absolute',
                    [isLeft ? 'left' : 'right']: 0,
                    top: 0, bottom: 0, width: 4,
                    background: color,
                    boxShadow: `0 0 18px ${color}, 0 0 4px ${color}`,
                }} />
            )}

            {/* Side label + name */}
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isLeft ? 'flex-start' : 'flex-end',
                gap: 2, minWidth: 0, flex: 1,
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    flexDirection: isLeft ? 'row' : 'row-reverse',
                }}>
                    <span style={{
                        width: 4, height: 14, background: color,
                        boxShadow: `0 0 6px ${color}88`,
                    }} />
                    <span style={{
                        fontFamily: RM, fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.24em',
                        color: 'rgba(255,255,255,0.5)',
                    }}>{isLeft ? 'HOME' : 'AWAY'}</span>
                </div>
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 17, color: scoring ? '#fff' : 'rgba(255,255,255,0.78)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 200, lineHeight: 1,
                    textShadow: scoring ? `0 0 12px ${color}66` : 'none',
                }}>{team.name}</span>

                {/* Foul + Timeout chips */}
                <div style={{
                    display: 'flex', gap: 6, marginTop: 4,
                    flexDirection: isLeft ? 'row' : 'row-reverse',
                }}>
                    <StatChip label="FOULS"    value={team.fouls}    bonus={team.fouls >= 5} />
                    <StatChip label="TIMEOUTS" value={team.timeouts} bonus={false} />
                </div>
            </div>

            {/* SCORE — the hero number */}
            <div style={{
                position: 'relative',
                padding: '4px 14px',
                border: `1px solid ${scoring ? color : 'rgba(255,255,255,0.12)'}`,
                background: scoring
                    ? `linear-gradient(180deg, ${color}1c 0%, transparent 50%, ${color}24 100%)`
                    : 'rgba(255,255,255,0.02)',
                boxShadow: scoring
                    ? `0 0 28px ${color}55, inset 0 0 14px ${color}1c`
                    : 'inset 0 0 6px rgba(255,255,255,0.03)',
                minWidth: 90, textAlign: 'center',
            }}>
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 54, lineHeight: 0.95, color: '#fff',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.04em',
                    textShadow: scoring
                        ? `0 0 24px ${color}, 0 0 8px ${color}cc`
                        : '0 0 6px rgba(255,255,255,0.12)',
                    transition: 'text-shadow 0.3s',
                    display: 'inline-block',
                }}>{team.score}</span>
            </div>
        </div>
    );
}

function StatChip({ label, value, bonus }: {
    label: string; value: number; bonus: boolean;
}) {
    const color = bonus ? '#F97316' : 'rgba(255,255,255,0.65)';
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 7px',
            border: `1px solid ${bonus ? '#F9731666' : 'rgba(255,255,255,0.12)'}`,
            background: bonus ? '#F9731614' : 'rgba(255,255,255,0.025)',
            borderRadius: 2,
        }}>
            <span style={{
                fontFamily: RM, fontSize: 7, fontWeight: 700,
                letterSpacing: '0.18em',
                color: bonus ? '#F97316' : 'rgba(255,255,255,0.4)',
            }}>{label}</span>
            <span style={{
                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                fontSize: 13, color,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
            }}>{value}</span>
        </div>
    );
}

// ── Clock center — LED-bezel game clock + period + shot clock ──
function ClockCenter({ clock, live, shotLow, shotMs, period }: {
    clock: ClockState; live: boolean; shotLow: boolean;
    shotMs: number; period: string;
}) {
    const shotColor = shotLow ? '#DC2626' : '#F59E0B';
    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 12px', gap: 4,
            borderLeft: '1px solid rgba(255,255,255,0.10)',
            borderRight: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(0,0,0,0.25)',
            position: 'relative',
        }}>
            {/* Top row: Period chip + LIVE/PAUSED */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                lineHeight: 1,
            }}>
                <span style={{
                    padding: '2px 8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 13, color: '#fff',
                    letterSpacing: '0.06em',
                }}>{period}</span>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px',
                    border: `1px solid ${live ? '#22C55E' : '#F59E0B'}55`,
                    background: `${live ? '#22C55E' : '#F59E0B'}14`,
                }}>
                    <span style={{
                        width: 5, height: 5,
                        background: live ? '#22C55E' : '#F59E0B',
                        boxShadow: live ? '0 0 6px #22C55E' : 'none',
                        animation: live ? 'spLiveDot 1.1s infinite' : 'none',
                        display: 'inline-block',
                    }} />
                    <span style={{
                        fontFamily: RM, fontSize: 8, fontWeight: 700,
                        letterSpacing: '0.22em', textTransform: 'uppercase',
                        color: live ? '#22C55E' : '#F59E0B',
                    }}>{live ? 'LIVE' : 'PAUSED'}</span>
                </div>
            </div>

            {/* Hero row: game clock + shot clock side-by-side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* GAME CLOCK — LED bezel */}
                <div style={{
                    padding: '4px 14px',
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
                    boxShadow: live
                        ? '0 0 22px rgba(255,255,255,0.18), inset 0 0 12px rgba(255,255,255,0.05)'
                        : 'inset 0 0 8px rgba(255,255,255,0.03)',
                    minWidth: 110, textAlign: 'center',
                }}>
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 38, lineHeight: 1, color: '#fff',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.03em',
                        textShadow: live
                            ? '0 0 20px rgba(255,255,255,0.6), 0 0 6px rgba(255,255,255,0.8)'
                            : '0 0 6px rgba(255,255,255,0.15)',
                    }}>{fmtClock(clock.gameMs)}</span>
                </div>

                {/* SHOT CLOCK — own bezel */}
                <div style={{
                    padding: '4px 12px',
                    border: `1px solid ${shotColor}88`,
                    background: `linear-gradient(180deg, ${shotColor}0d 0%, transparent 50%, ${shotColor}1c 100%)`,
                    boxShadow: shotLow
                        ? `0 0 18px ${shotColor}cc, inset 0 0 10px ${shotColor}33`
                        : `0 0 10px ${shotColor}33, inset 0 0 6px ${shotColor}14`,
                    animation: shotLow ? 'spShotPulse 0.5s infinite' : 'none',
                    minWidth: 56, textAlign: 'center',
                }}>
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 30, lineHeight: 1, color: shotColor,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.03em',
                        textShadow: `0 0 14px ${shotColor}, 0 0 4px ${shotColor}cc`,
                    }}>{fmtShot(shotMs)}</span>
                </div>
            </div>

            {/* Sub-labels */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: RM, fontSize: 7, fontWeight: 700,
                letterSpacing: '0.28em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
            }}>
                <span style={{ minWidth: 110, textAlign: 'center' }}>GAME CLOCK</span>
                <span style={{ minWidth: 56, textAlign: 'center', color: `${shotColor}aa` }}>SHOT</span>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// PLAYER TILE
// ══════════════════════════════════════════════════════════════
function PlayerTile({ player, color, onTap }: {
    player: Player; color: string;
    onTap: (p: Player) => void;
}) {
    return (
        <button
            onClick={() => onTap(player)}
            style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '16px 12px',
                minHeight: 110, minWidth: 0,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 6,
                cursor: 'pointer', userSelect: 'none',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                transition: 'transform 0.08s, border-color 0.12s, background 0.12s, box-shadow 0.12s',
                overflow: 'hidden',
            }}
            onPointerDown={e => {
                const t = e.currentTarget;
                t.style.background = `${color}1c`;
                t.style.borderColor = color;
                t.style.boxShadow = `0 0 22px ${color}55, inset 0 0 14px ${color}22`;
                t.style.transform = 'scale(0.96)';
            }}
            onPointerUp={e => {
                e.currentTarget.style.transform = 'scale(1)';
            }}
            onPointerLeave={e => {
                const t = e.currentTarget;
                t.style.background = 'rgba(255,255,255,0.025)';
                t.style.borderColor = 'rgba(255,255,255,0.10)';
                t.style.boxShadow = 'none';
                t.style.transform = 'scale(1)';
            }}
        >
            {/* Faint top accent line */}
            <div style={{
                position: 'absolute', top: 0, left: '14%', right: '14%',
                height: 1, background: `${color}88`,
                opacity: 0.5,
            }} />

            {/* Jersey number — the hero */}
            <span style={{
                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                fontSize: 52, lineHeight: 0.9, color: '#fff',
                letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums',
                textShadow: `0 0 18px ${color}33`,
            }}>{player.number}</span>

            {/* Player name */}
            <span style={{
                fontFamily: RM, fontSize: 8, fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.65)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%',
            }}>{player.name}</span>
        </button>
    );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
interface PiStatsPlayerPickerProps {
    event: ScorePendingEvent;
    teamA: TeamState; teamB: TeamState;
    teamAColor: string; teamBColor: string;
    clock: ClockState;
    onAttribute: (data: {
        team: 'A' | 'B'; points: number;
        playerId: string | null; playerName: string | null;
        period?: number; gameClockSec?: number;
    }) => void;
    onSkip: () => void;
}

export default function PiStatsPlayerPicker({
    event, teamA, teamB, teamAColor, teamBColor, clock, onAttribute, onSkip,
}: PiStatsPlayerPickerProps) {
    const { team, points, players } = event;
    const teamColor = team === 'A' ? teamAColor : teamBColor;
    const teamName  = team === 'A' ? teamA.name : teamB.name;

    const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECS);
    const doneRef = useRef(false);

    const finalize = useCallback((player: Player | null) => {
        if (doneRef.current) return;
        doneRef.current = true;
        onAttribute({
            team, points,
            playerId:   player?.id   ?? null,
            playerName: player?.name ?? null,
            period:       clock.period,
            gameClockSec: Math.ceil(clock.gameMs / 1000),
        });
    }, [team, points, clock.period, clock.gameMs, onAttribute]);

    // Auto-dismiss countdown
    useEffect(() => {
        if (secondsLeft <= 0) { finalize(null); return; }
        const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [secondsLeft, finalize]);

    const numCols = players.length <= 4 ? 2 : 3;

    return (
        <>
            {/* ── BACKDROP SCRIM (live game visible beneath, blurred) ── */}
            <div
                onClick={() => finalize(null)}
                style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.62)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    animation: 'spScrimIn 0.22s ease-out',
                }}
            />

            {/* ── SLIM LIVE HEADER (top of screen) ── */}
            <LiveHeader
                teamA={teamA} teamB={teamB}
                teamAColor={teamAColor} teamBColor={teamBColor}
                clock={clock} scoringTeam={team}
            />

            {/* ── CENTERED PICKER MODAL ── */}
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 103,
                width: 'min(92vw, 720px)',
                maxHeight: '78vh',
                display: 'flex', flexDirection: 'column',
                background: 'rgba(10,12,18,0.96)',
                border: `1px solid ${teamColor}55`,
                borderRadius: 8,
                boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 40px ${teamColor}1f, 0 0 0 1px rgba(255,255,255,0.05)`,
                animation: 'spModalIn 0.32s cubic-bezier(0.22,1,0.36,1)',
                overflow: 'hidden',
            }}>

                {/* FUI corner brackets */}
                {([
                    { top: -1, left: -1, borderRight: 'none', borderBottom: 'none' },
                    { top: -1, right: -1, borderLeft: 'none', borderBottom: 'none' },
                    { bottom: -1, left: -1, borderRight: 'none', borderTop: 'none' },
                    { bottom: -1, right: -1, borderLeft: 'none', borderTop: 'none' },
                ] as const).map((s, i) => (
                    <div key={i} style={{
                        position: 'absolute', width: 14, height: 14,
                        border: `2px solid ${teamColor}`,
                        pointerEvents: 'none', zIndex: 1, ...s,
                    }} />
                ))}

                {/* MODAL HEADER */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: 14, padding: '14px 18px',
                    background: `linear-gradient(90deg, ${teamColor}22 0%, ${teamColor}06 60%, transparent 100%)`,
                    borderBottom: `1px solid ${teamColor}33`,
                    position: 'relative',
                }}>
                    {/* Pulsing accent */}
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: teamColor,
                        boxShadow: `0 0 12px ${teamColor}`,
                        animation: 'spLiveDot 1.1s infinite',
                        flexShrink: 0,
                    }} />

                    {/* Title */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                        <span style={{
                            fontFamily: RM, fontSize: 8, fontWeight: 700,
                            letterSpacing: '0.26em', color: 'rgba(255,255,255,0.5)',
                            textTransform: 'uppercase',
                        }}>WHO SCORED?</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                fontSize: 18, color: '#fff',
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                maxWidth: 280,
                            }}>{teamName}</span>
                            <span style={{
                                padding: '3px 10px',
                                background: teamColor, color: '#000',
                                fontFamily: RM, fontSize: 10, fontWeight: 800,
                                letterSpacing: '0.08em',
                                boxShadow: `0 0 12px ${teamColor}66`,
                            }}>+{points} PTS</span>
                        </div>
                    </div>

                    {/* Countdown */}
                    <CountdownRing secondsLeft={secondsLeft} total={AUTO_DISMISS_SECS} color={teamColor} />

                    {/* Close — 44×44 to clear WCAG 2.5.5 AAA */}
                    <button onClick={() => finalize(null)}
                        aria-label="Close — skip attribution"
                        title="Skip attribution"
                        style={{
                            width: 44, height: 44,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.16)',
                            color: 'rgba(255,255,255,0.7)',
                            fontFamily: RM, fontSize: 18, fontWeight: 700,
                            cursor: 'pointer', userSelect: 'none',
                            WebkitTapHighlightColor: 'transparent',
                            transition: 'background 0.12s, color 0.12s',
                            flexShrink: 0,
                            borderRadius: 8,
                        }}
                        onPointerDown={e => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)';
                            (e.currentTarget as HTMLElement).style.color = '#fff';
                        }}
                        onPointerLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                        }}
                    >✕</button>
                </div>

                {/* PLAYER GRID */}
                <div style={{
                    flex: 1, minHeight: 0, overflowY: 'auto',
                    padding: '14px 14px 8px',
                }}>
                    {players.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${numCols}, 1fr)`,
                            gap: 8,
                        }}>
                            {players.map(p => (
                                <PlayerTile key={p.id} player={p} color={teamColor} onTap={finalize} />
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            padding: '40px 20px', textAlign: 'center',
                            fontFamily: RM, fontSize: 11,
                            color: 'rgba(255,255,255,0.32)', letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                        }}>
                            NO ROSTER — DISMISS TO RECORD UNATTRIBUTED
                        </div>
                    )}
                </div>

                {/* FOOTER — skip attribution + hardware-live hint */}
                <div style={{
                    padding: '10px 14px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(0,0,0,0.3)',
                }}>
                    {/* HARDWARE LIVE — tells the ref physical buttons still work during this popup */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px',
                        border: '1px solid rgba(34,197,94,0.35)',
                        background: 'rgba(34,197,94,0.08)',
                        flexShrink: 0,
                    }}>
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: '#22C55E',
                            boxShadow: '0 0 8px #22C55E',
                            animation: 'spLiveDot 1.4s infinite',
                        }} />
                        <span style={{
                            fontFamily: RM, fontSize: 8, fontWeight: 700,
                            letterSpacing: '0.22em', textTransform: 'uppercase',
                            color: '#22C55E',
                        }}>HARDWARE LIVE</span>
                    </div>

                    <button
                        onClick={() => finalize(null)}
                        style={{
                            flex: 1, height: 44, padding: '0 16px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.18)',
                            color: 'rgba(255,255,255,0.7)',
                            fontFamily: RM, fontSize: 10, fontWeight: 700,
                            letterSpacing: '0.22em', textTransform: 'uppercase',
                            cursor: 'pointer', userSelect: 'none',
                            WebkitTapHighlightColor: 'transparent',
                            transition: 'all 0.12s',
                            borderRadius: 8,
                        }}
                        onPointerDown={e => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                            (e.currentTarget as HTMLElement).style.color = '#fff';
                        }}
                        onPointerLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                        }}
                    >SKIP — RECORD AS UNATTRIBUTED</button>
                </div>
            </div>

            <style>{`
                @keyframes spScrimIn  { from { opacity: 0; } to { opacity: 1; } }
                @keyframes spHeaderIn { from { opacity: 0; transform: translateX(-50%) translateY(-24px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
                @keyframes spModalIn  { from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
                @keyframes spLiveDot  { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
                @keyframes spShotPulse{ 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
            `}</style>
        </>
    );
}
