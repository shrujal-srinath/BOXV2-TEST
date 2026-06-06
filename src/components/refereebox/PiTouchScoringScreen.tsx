// src/components/refereebox/PiTouchScoringScreen.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — TABLETOP TOUCH SCORING DECK v3
// Cinematic scoreboard up top; tactile control deck below.
// Hierarchy: live state (scores · clock · period · shot · poss)
// is the hero. Buttons sit beneath, sized for confident taps but
// visually subordinate so the eye reads the game state first.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { fibaTimeoutsForPeriod, bucketLabel } from '../../services/fibaTimeouts';
import { useMinimizeHeader } from '../../services/gameControlPrefs';

// ── Types ────────────────────────────────────────────────────
interface TeamState { name: string; score: number; fouls: number; timeouts: number; }
interface ClockState { gameMs: number; shotMs: number; isRunning: boolean; period: number; totalPeriods: number; }

interface Props {
    teamA: TeamState;
    teamB: TeamState;
    clock: ClockState;
    possession: 'A' | 'B' | null;
    teamAColor?: string;
    teamBColor?: string;
    isConnected?: boolean;
    gameCode?: string;
    sendAction: (type: string, payload?: Record<string, unknown>) => void;
    onClose: () => void;
    onCast?: () => void;
    onConnectHardware?: () => void;
    onSettings?: () => void;
    onEndGame?: () => void;
}

// ── Inline icons (mirror LockedScoreboard) ────────────────────
const IconCast = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2 16h.01" /><path d="M2 12a8 8 0 0 1 8 8" /><path d="M2 8a12 12 0 0 1 12 12" />
        <rect x="13" y="13" width="9" height="7" />
    </svg>
);
const IconHW = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        <rect x="5" y="5" width="14" height="14" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </svg>
);
const IconGear = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M5 5l2 2M17 17l2 2M2 12h3M19 12h3M5 19l2-2M17 7l2-2" />
    </svg>
);
const IconClose = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M18 6L6 18" /><path d="M6 6l12 12" />
    </svg>
);
const IconStop = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="6" y="6" width="12" height="12" />
    </svg>
);

// ── Header action button (mirror LockedScoreboard) ───────────
const HeaderBtn: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    accent?: string;
    filled?: boolean;
}> = ({ label, icon, onClick, accent = WHITE, filled = false }) => {
    const enabled = !!onClick;
    return (
        <div
            onClick={onClick}
            style={{
                height: 36, padding: '0 14px',
                display: 'flex', alignItems: 'center', gap: 8,
                border: `1px solid ${filled ? accent : BDR_HI}`,
                background: filled ? `${accent}1f` : 'rgba(255,255,255,0.025)',
                color: enabled ? accent : 'rgba(255,255,255,0.22)',
                fontFamily: RM, fontSize: 9, fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                cursor: enabled ? 'pointer' : 'default',
                opacity: enabled ? 1 : 0.4,
                userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.12s, transform 0.06s',
                boxShadow: filled ? `0 0 12px ${accent}33, inset 0 1px 0 ${accent}33` : 'none',
            }}
            onTouchStart={e => {
                if (!enabled) return;
                (e.currentTarget as HTMLElement).style.background = `${accent}33`;
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onTouchEnd={e => {
                (e.currentTarget as HTMLElement).style.background = filled ? `${accent}1f` : 'rgba(255,255,255,0.025)';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
        >
            {icon}
            <span>{label}</span>
        </div>
    );
};

// ── Theme ────────────────────────────────────────────────────
const BG       = '#000';
const SURFACE  = '#0a0a0a';
const HOME_C   = '#2563EB';
const AWAY_C   = '#DC2626';
const GREEN    = '#22C55E';
const AMBER    = '#F59E0B';
const ORANGE   = '#F97316';
const WHITE    = '#FFFFFF';
const DIM      = 'rgba(255,255,255,0.42)';
const BDR      = 'rgba(255,255,255,0.07)';
const BDR_HI   = 'rgba(255,255,255,0.16)';

const OSW = "'Oswald', sans-serif";
const RM  = "'JetBrains Mono', monospace";

const DOT_GRID = `radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px) 0 0 / 14px 14px`;

// ── Helpers ──────────────────────────────────────────────────
const fmt = (ms: number): string => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtShot = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));
const periodLabel = (period: number, total: number): string => {
    if (total === 2) return period <= 2 ? `H${period}` : `OT${period - 2}`;
    return period <= 4 ? `Q${period}` : `OT${period - 4}`;
};

// ── Corner brackets ──────────────────────────────────────────
const Corners: React.FC<{ color: string; size?: number; thickness?: number }> = ({
    color, size = 10, thickness = 1.5,
}) => (
    <>
        {(['tl', 'tr', 'bl', 'br'] as const).map(pos => {
            const top  = pos.startsWith('t');
            const left = pos.endsWith('l');
            return (
                <div key={pos} style={{
                    position: 'absolute',
                    [top ? 'top' : 'bottom']: -1,
                    [left ? 'left' : 'right']: -1,
                    width: size, height: size,
                    borderTop:    top  ? `${thickness}px solid ${color}` : 'none',
                    borderBottom: !top ? `${thickness}px solid ${color}` : 'none',
                    borderLeft:   left  ? `${thickness}px solid ${color}` : 'none',
                    borderRight:  !left ? `${thickness}px solid ${color}` : 'none',
                    pointerEvents: 'none',
                }} />
            );
        })}
    </>
);

// ── Foul pips (5 squares) ────────────────────────────────────
const FoulPips: React.FC<{ count: number; color: string; align?: 'left' | 'right' }> = ({
    count, color, align = 'left',
}) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: align === 'left' ? 'flex-start' : 'flex-end' }}>
        {Array.from({ length: 5 }).map((_, i) => {
            const lit = i < count;
            const danger = lit && i >= 4;
            const c = danger ? ORANGE : color;
            return (
                <div key={i} style={{
                    width: 13, height: 13,
                    background: lit ? c : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${lit ? c : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: lit ? `0 0 6px ${c}77` : 'none',
                    transition: 'all 0.18s',
                }} />
            );
        })}
    </div>
);

// ── Timeout dashes ───────────────────────────────────────────
const TODashes: React.FC<{ remaining: number; total?: number; color: string; align?: 'left' | 'right' }> = ({
    remaining, total = 3, color, align = 'left',
}) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: align === 'left' ? 'flex-start' : 'flex-end' }}>
        {Array.from({ length: total }).map((_, i) => {
            const active = i < remaining;
            return (
                <div key={i} style={{
                    width: 26, height: 6,
                    background: active ? color : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? color : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: active ? `0 0 6px ${color}66` : 'none',
                    transition: 'all 0.18s',
                }} />
            );
        })}
    </div>
);

// ══════════════════════════════════════════════════════════════
// HERO SCORE — giant LED bezel, the visual anchor
// ══════════════════════════════════════════════════════════════
const HeroScore: React.FC<{ value: number; color: string; align: 'left' | 'right' }> = ({
    value, color, align,
}) => {
    const [flash, setFlash] = useState(false);
    const prev = useRef(value);
    const t = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (prev.current !== value) {
            prev.current = value;
            setFlash(true);
            if (t.current) clearTimeout(t.current);
            t.current = setTimeout(() => setFlash(false), 420);
        }
        return () => { if (t.current) clearTimeout(t.current); };
    }, [value]);

    return (
        <div style={{
            position: 'relative',
            padding: 8,
            border: `1px solid ${color}66`,
            background: `linear-gradient(180deg, ${color}08 0%, transparent 50%, ${color}14 100%)`,
            boxShadow: flash
                ? `0 0 70px ${color}aa, inset 0 0 36px ${color}44`
                : `0 0 28px ${color}26, inset 0 0 20px ${color}0d`,
            transition: 'box-shadow 0.42s',
            // Pull score outward toward the edge of the screen
            marginLeft: align === 'right' ? 'auto' : 0,
            marginRight: align === 'left' ? 'auto' : 0,
        }}>
            <Corners color={color} size={16} thickness={2} />
            <div style={{
                background: BG,
                backgroundImage: DOT_GRID,
                border: `1px solid ${color}33`,
                padding: '6px 32px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
                minWidth: 220,
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 1px, transparent 1px, transparent 3px)',
                    pointerEvents: 'none',
                }} />
                <span style={{
                    fontFamily: OSW, fontWeight: 700, fontStyle: 'italic',
                    fontSize: 168, lineHeight: 1, color,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.05em',
                    textShadow: flash
                        ? `0 0 50px ${color}, 0 0 22px ${color}cc, 0 0 10px ${color}`
                        : `0 0 26px ${color}66, 0 0 8px ${color}99`,
                    transition: 'text-shadow 0.42s',
                    position: 'relative', zIndex: 1,
                }}>{value}</span>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// HERO CLOCK COLUMN — center of the hero band
// ══════════════════════════════════════════════════════════════
const HeroClock: React.FC<{
    clock: ClockState;
    bucketName?: string;
    sendAction: Props['sendAction'];
}> = ({ clock, bucketName, sendAction }) => {
    const live = clock.isRunning;
    const shotMs = clock.shotMs ?? 0;
    const shotZero = shotMs === 0;
    const shotLow = !shotZero && shotMs <= 5000;
    const shotAlert = shotZero || shotLow;
    const canToggle = clock.gameMs > 0;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12,
            padding: '0 10px',
            position: 'relative',
        }}>
            {/* Period chip — sits above the clock */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 14px',
                border: `1px solid ${BDR_HI}`,
                background: 'rgba(255,255,255,0.025)',
                position: 'relative',
            }}>
                <Corners color={BDR_HI} size={6} thickness={1} />
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 18, color: WHITE, letterSpacing: '0.05em',
                }}>{periodLabel(clock.period, clock.totalPeriods)}</span>
                <span style={{ fontFamily: RM, fontSize: 8, color: DIM, letterSpacing: '0.18em' }}>
                    · {clock.period}/{clock.totalPeriods}
                </span>
            </div>
            {bucketName && (
                <span style={{
                    fontFamily: RM, fontSize: 7, color: 'rgba(255,255,255,0.32)',
                    letterSpacing: '0.28em', fontWeight: 600, textTransform: 'uppercase',
                    marginTop: -4,
                }}>
                    TO BUCKET · {bucketName}
                </span>
            )}

            {/* GAME CLOCK — biggest thing on screen after the scores; tap to start/stop */}
            <div
                onClick={() => { if (canToggle) sendAction('CLOCK_TOGGLE'); }}
                onTouchStart={e => { if (canToggle) (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
                onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                style={{
                position: 'relative',
                padding: 6,
                border: `1px solid ${live ? GREEN : WHITE}55`,
                background: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)`,
                boxShadow: live
                    ? `0 0 28px ${GREEN}33, inset 0 0 18px rgba(255,255,255,0.06)`
                    : `0 0 14px rgba(255,255,255,0.05), inset 0 0 10px rgba(255,255,255,0.02)`,
                cursor: canToggle ? 'pointer' : 'default',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'transform 0.06s, box-shadow 0.18s',
            }}>
                <Corners color={WHITE} size={12} thickness={1.5} />
                <div style={{
                    background: BG,
                    backgroundImage: DOT_GRID,
                    border: `1px solid ${BDR_HI}`,
                    padding: '6px 22px 10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden', minWidth: 240,
                }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 3px)',
                        pointerEvents: 'none',
                    }} />
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 100, lineHeight: 1, color: WHITE,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.03em',
                        textShadow: live
                            ? `0 0 22px rgba(255,255,255,0.55), 0 0 8px rgba(255,255,255,0.7)`
                            : '0 0 8px rgba(255,255,255,0.15)',
                        position: 'relative', zIndex: 1,
                    }}>{fmt(clock.gameMs)}</span>
                </div>
            </div>

            {/* SHOT CLOCK — smaller, sits below. Blinks red at 0 to alert refs. */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 18px',
                border: `1px solid ${shotAlert ? AWAY_C : AMBER}${shotZero ? 'cc' : '55'}`,
                background: `${shotAlert ? AWAY_C : AMBER}${shotZero ? '33' : '10'}`,
                position: 'relative',
                animation: shotZero ? 'tsShotBlink 0.45s infinite' : shotLow ? 'tsShotPulse 0.5s infinite' : 'none',
                boxShadow: shotZero ? `0 0 24px ${AWAY_C}aa` : 'none',
            }}>
                <Corners color={shotAlert ? AWAY_C : AMBER} size={8} thickness={1.5} />
                <span style={{
                    fontFamily: RM, fontSize: 9,
                    color: shotAlert ? AWAY_C : AMBER,
                    letterSpacing: '0.32em', fontWeight: 700, textTransform: 'uppercase',
                }}>{shotZero ? 'RESET' : 'SHOT'}</span>
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 38, lineHeight: 1,
                    color: shotAlert ? AWAY_C : AMBER,
                    fontVariantNumeric: 'tabular-nums',
                    textShadow: `0 0 14px ${shotAlert ? AWAY_C : AMBER}cc`,
                }}>{fmtShot(shotMs)}</span>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// HERO TEAM SIDE — name + status + giant score
// ══════════════════════════════════════════════════════════════
const HeroTeamSide: React.FC<{
    align: 'left' | 'right';
    side: 'HOME' | 'AWAY';
    team: TeamState;
    color: string;
    bonus: boolean;
    hasPossession: boolean;
    timeoutsPerBucket: number;
}> = ({ align, side, team, color, bonus, hasPossession, timeoutsPerBucket }) => {
    const isLeft = align === 'left';
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: isLeft ? '1fr auto' : 'auto 1fr',
            alignItems: 'center',
            padding: isLeft ? '0 12px 0 28px' : '0 28px 0 12px',
            gap: 16,
            position: 'relative',
            background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, ${color}10 0%, transparent 75%)`,
        }}>
            {/* INFO column */}
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isLeft ? 'flex-start' : 'flex-end',
                gap: 10,
                order: isLeft ? 1 : 2,
                minWidth: 0,
            }}>
                {/* Side label + possession chip */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    flexDirection: isLeft ? 'row' : 'row-reverse',
                }}>
                    <div style={{
                        width: 6, height: 18, background: color,
                        boxShadow: `0 0 8px ${color}aa`,
                    }} />
                    <span style={{
                        fontFamily: RM, fontSize: 10, color: DIM,
                        letterSpacing: '0.32em', fontWeight: 700,
                    }}>{side}</span>
                    {hasPossession && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '3px 8px',
                            border: `1px solid ${color}aa`,
                            background: `${color}1f`,
                            boxShadow: `0 0 10px ${color}55`,
                        }}>
                            <div style={{ width: 5, height: 5, background: color, animation: 'tsPulse 1.2s infinite' }} />
                            <span style={{
                                fontFamily: RM, fontSize: 8, color,
                                letterSpacing: '0.22em', fontWeight: 700,
                            }}>BALL</span>
                        </div>
                    )}
                </div>

                {/* Team name — large italic */}
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 38, color: WHITE,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    lineHeight: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '100%', textAlign: align,
                    textShadow: `0 0 14px ${color}33`,
                }}>{team.name}</span>

                {/* Stat strip */}
                <div style={{
                    display: 'flex',
                    flexDirection: isLeft ? 'row' : 'row-reverse',
                    alignItems: 'center', gap: 18, marginTop: 2,
                }}>
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        alignItems: isLeft ? 'flex-start' : 'flex-end',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isLeft ? 'row' : 'row-reverse' }}>
                            <span style={{ fontFamily: RM, fontSize: 8, color: DIM, letterSpacing: '0.26em', fontWeight: 600 }}>
                                FOULS
                            </span>
                            {bonus && (
                                <span style={{
                                    padding: '2px 7px', background: ORANGE, color: '#000',
                                    fontFamily: RM, fontSize: 8, fontWeight: 700,
                                    letterSpacing: '0.18em',
                                    boxShadow: `0 0 10px ${ORANGE}77`,
                                }}>BONUS</span>
                            )}
                        </div>
                        <FoulPips count={team.fouls} color={color} align={align} />
                    </div>
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        alignItems: isLeft ? 'flex-start' : 'flex-end',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'baseline', gap: 6,
                            flexDirection: isLeft ? 'row' : 'row-reverse',
                        }}>
                            <span style={{ fontFamily: RM, fontSize: 8, color: DIM, letterSpacing: '0.26em', fontWeight: 600 }}>
                                TIMEOUTS
                            </span>
                            <span style={{
                                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                fontSize: 14, color: WHITE,
                                fontVariantNumeric: 'tabular-nums',
                            }}>
                                {team.timeouts}
                                <span style={{ color: DIM, fontSize: 10 }}> / {Math.max(timeoutsPerBucket, team.timeouts)}</span>
                            </span>
                        </div>
                        <TODashes
                            remaining={team.timeouts}
                            total={Math.max(timeoutsPerBucket, team.timeouts)}
                            color={color}
                            align={align}
                        />
                    </div>
                </div>
            </div>

            {/* SCORE column */}
            <div style={{
                order: isLeft ? 2 : 1,
                display: 'flex', justifyContent: isLeft ? 'flex-end' : 'flex-start',
            }}>
                <HeroScore value={team.score} color={color} align={align} />
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// SLAP BUTTON — control deck button
// ══════════════════════════════════════════════════════════════
const SlapBtn: React.FC<{
    label: string;
    sub?: string;
    color: string;
    onClick: () => void;
    disabled?: boolean;
    primary?: boolean;        // primary = scoring (+1/+2/+3); secondary = -1/foul/TO
}> = ({ label, sub, color, onClick, disabled, primary = false }) => (
    <div
        onClick={disabled ? undefined : onClick}
        style={{
            position: 'relative',
            width: '100%', height: '100%',
            background: primary
                ? `linear-gradient(180deg, ${color}26 0%, ${color}0d 60%, ${color}05 100%)`
                : `linear-gradient(180deg, ${color}12 0%, ${color}05 100%)`,
            border: `1px solid ${color}${primary ? '66' : '44'}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.3 : 1,
            userSelect: 'none', WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.06s, background 0.12s, box-shadow 0.12s',
            boxShadow: primary
                ? `inset 0 1px 0 ${color}44, 0 0 18px ${color}1a`
                : `inset 0 1px 0 ${color}22`,
            overflow: 'hidden',
        }}
        onTouchStart={e => {
            if (disabled) return;
            (e.currentTarget as HTMLElement).style.background =
                `linear-gradient(180deg, ${color}66 0%, ${color}33 100%)`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
            (e.currentTarget as HTMLElement).style.boxShadow =
                `0 0 28px ${color}aa, inset 0 1px 0 ${color}88`;
        }}
        onTouchEnd={e => {
            (e.currentTarget as HTMLElement).style.background = primary
                ? `linear-gradient(180deg, ${color}26 0%, ${color}0d 60%, ${color}05 100%)`
                : `linear-gradient(180deg, ${color}12 0%, ${color}05 100%)`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.boxShadow = primary
                ? `inset 0 1px 0 ${color}44, 0 0 18px ${color}1a`
                : `inset 0 1px 0 ${color}22`;
        }}
    >
        <Corners color={color} size={primary ? 11 : 8} thickness={1} />
        {primary && (
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 4px)',
                pointerEvents: 'none',
            }} />
        )}
        <span style={{
            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: primary ? 56 : 22,
            color, letterSpacing: '-0.02em',
            textShadow: primary ? `0 0 14px ${color}99, 0 0 5px ${color}cc` : `0 0 6px ${color}55`,
            lineHeight: 0.9,
            position: 'relative', zIndex: 1,
        }}>{label}</span>
        {sub && (
            <span style={{
                fontFamily: RM, fontSize: primary ? 8 : 7, fontWeight: 700,
                color: primary ? `${color}dd` : `${color}aa`,
                letterSpacing: '0.26em', textTransform: 'uppercase',
                position: 'relative', zIndex: 1,
            }}>{sub}</span>
        )}
    </div>
);

// ══════════════════════════════════════════════════════════════
// CONTROL SIDE — 3×2 button grid for one team
// ══════════════════════════════════════════════════════════════
const ControlSide: React.FC<{
    align: 'left' | 'right';
    team: TeamState;
    color: string;
    teamKey: 'A' | 'B';
    bonus: boolean;
    timeoutsPerBucket: number;
    sendAction: Props['sendAction'];
}> = ({ align, team, color, teamKey, bonus, timeoutsPerBucket, sendAction }) => {
    // Daemon stores team buckets at state.teamA / state.teamB — use the full key.
    const tk = teamKey === 'A' ? 'teamA' : 'teamB';
    const score   = (n: 1 | 2 | 3) => sendAction('EDIT_SCORE',    { team: tk, amount: n });
    const subOne  = ()              => sendAction('EDIT_SCORE',    { team: tk, amount: -1 });
    const addFoul = ()              => sendAction('EDIT_FOULS',    { team: tk, amount: 1 });
    const subFoul = ()              => sendAction('EDIT_FOULS',    { team: tk, amount: -1 });
    const useTO   = ()              => sendAction('EDIT_TIMEOUTS', { team: tk, amount: -1 });
    const addTO   = ()              => sendAction('EDIT_TIMEOUTS', { team: tk, amount: 1 });

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            padding: 10,
            gap: 8,
        }}>
            {/* Tiny side label so user knows which buttons control which team */}
            <div style={{
                display: 'flex',
                justifyContent: align === 'left' ? 'flex-start' : 'flex-end',
                alignItems: 'center', gap: 8,
                flexDirection: align === 'left' ? 'row' : 'row-reverse',
                paddingLeft: align === 'left' ? 4 : 0,
                paddingRight: align === 'right' ? 4 : 0,
            }}>
                <div style={{ width: 4, height: 12, background: color, boxShadow: `0 0 6px ${color}aa` }} />
                <span style={{
                    fontFamily: RM, fontSize: 8, color: DIM,
                    letterSpacing: '0.32em', fontWeight: 700,
                }}>{align === 'left' ? 'HOME CONTROLS' : 'AWAY CONTROLS'}</span>
                <div style={{ flex: 1 }} />
                <MicroBtn label="− FOUL" color="rgba(239,68,68,0.7)" onClick={subFoul} />
                <MicroBtn label="+ TO"   color="rgba(245,158,11,0.7)" onClick={addTO} />
            </div>

            {/* Primary scoring row */}
            <div style={{
                flex: 1, minHeight: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 6,
            }}>
                <SlapBtn label="+1" sub="MADE FT" color={color} onClick={() => score(1)} primary />
                <SlapBtn label="+2" sub="MADE 2"  color={color} onClick={() => score(2)} primary />
                <SlapBtn label="+3" sub="MADE 3"  color={color} onClick={() => score(3)} primary />
            </div>

            {/* Secondary row */}
            <div style={{
                height: 72, flexShrink: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 6,
            }}>
                <SlapBtn label="−1"      sub="CORRECT"          color="#9CA3AF" onClick={subOne} />
                <SlapBtn label="FOUL"    sub={`TEAM · ${team.fouls}`}  color={bonus ? ORANGE : '#EF4444'} onClick={addFoul} />
                <SlapBtn
                    label="TIMEOUT"
                    sub={`${team.timeouts} / ${Math.max(timeoutsPerBucket, team.timeouts)}`}
                    color={AMBER}
                    onClick={useTO}
                    disabled={team.timeouts <= 0}
                />
            </div>
        </div>
    );
};

// ── Micro corrector chip ─────────────────────────────────────
const MicroBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
    <div
        onClick={onClick}
        style={{
            padding: '4px 10px',
            border: `1px solid ${color}`, color,
            fontFamily: RM, fontSize: 7, fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            background: 'transparent',
            transition: 'background 0.12s',
        }}
        onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >{label}</div>
);

// ══════════════════════════════════════════════════════════════
// CONTROL CENTER — possession + shot clock resets + horn
// ══════════════════════════════════════════════════════════════
const ControlCenter: React.FC<{
    possession: 'A' | 'B' | null;
    teamAColor: string; teamBColor: string;
    clock: ClockState;
    sendAction: Props['sendAction'];
}> = ({ possession, teamAColor, teamBColor, clock, sendAction }) => {
    const isRunning = clock.isRunning;
    const periodOver = clock.gameMs === 0;
    const onLastPeriod = clock.period >= clock.totalPeriods;
    const startStopColor = isRunning ? AWAY_C : GREEN;
    const startStopLabel = isRunning ? 'STOP' : 'START';
    return (
    <div style={{
        display: 'flex', flexDirection: 'column',
        background: '#070707',
        borderLeft: `1px solid ${BDR_HI}`,
        borderRight: `1px solid ${BDR_HI}`,
        padding: 10,
        gap: 8,
    }}>
        {/* GAME CLOCK START / STOP — the hero of the control deck */}
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, height: 14,
        }}>
            <span style={{
                fontFamily: RM, fontSize: 8, color: DIM,
                letterSpacing: '0.32em', fontWeight: 700,
            }}>GAME CLOCK</span>
        </div>
        {periodOver ? (
            <div
                onClick={() => {
                    if (onLastPeriod) {
                        sendAction('NEXT_PERIOD', { forceOT: true });
                    } else {
                        sendAction('NEXT_PERIOD');
                    }
                }}
                style={{
                    position: 'relative', height: 56,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    border: `1px solid ${AMBER}aa`,
                    background: `linear-gradient(180deg, ${AMBER}33 0%, ${AMBER}0a 100%)`,
                    boxShadow: `0 0 14px ${AMBER}55, inset 0 1px 0 ${AMBER}55`,
                    cursor: 'pointer', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.1s, transform 0.06s',
                }}
                onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
                <Corners color={AMBER} size={8} thickness={1.5} />
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 22, color: AMBER, lineHeight: 1,
                    textShadow: `0 0 10px ${AMBER}aa`,
                }}>{onLastPeriod ? '+ OT' : 'NEXT PERIOD'}</span>
                <span style={{
                    fontFamily: RM, fontSize: 8, color: `${AMBER}aa`,
                    letterSpacing: '0.22em', fontWeight: 700,
                }}>PERIOD ENDED</span>
            </div>
        ) : (
            <div
                onClick={() => sendAction('CLOCK_TOGGLE')}
                style={{
                    position: 'relative', height: 56,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    border: `1px solid ${startStopColor}aa`,
                    background: isRunning
                        ? `linear-gradient(180deg, ${startStopColor}26 0%, ${startStopColor}08 100%)`
                        : `linear-gradient(180deg, ${startStopColor}33 0%, ${startStopColor}0a 100%)`,
                    boxShadow: `0 0 14px ${startStopColor}55, inset 0 1px 0 ${startStopColor}55`,
                    cursor: 'pointer', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.1s, transform 0.06s',
                }}
                onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
                <Corners color={startStopColor} size={8} thickness={1.5} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isRunning ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={startStopColor}>
                            <rect x="6" y="5" width="4" height="14" />
                            <rect x="14" y="5" width="4" height="14" />
                        </svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={startStopColor}>
                            <polygon points="6,4 20,12 6,20" />
                        </svg>
                    )}
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 26, color: startStopColor, lineHeight: 1,
                        letterSpacing: '0.1em',
                        textShadow: `0 0 10px ${startStopColor}aa`,
                    }}>{startStopLabel}</span>
                </div>
                <span style={{
                    fontFamily: RM, fontSize: 8, color: `${startStopColor}aa`,
                    letterSpacing: '0.22em', fontWeight: 700,
                }}>{isRunning ? 'CLOCK IS LIVE' : 'TAP TO START'}</span>
            </div>
        )}

        {/* POSSESSION */}
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, height: 14,
        }}>
            <span style={{
                fontFamily: RM, fontSize: 8, color: DIM,
                letterSpacing: '0.32em', fontWeight: 700,
            }}>POSSESSION</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <PossessionRow
                label="◀ HOME"
                color={teamAColor}
                active={possession === 'A'}
                onClick={() => sendAction('SET_POSSESSION', { team: 'A' })}
            />
            <PossessionRow
                label="AWAY ▶"
                color={teamBColor}
                active={possession === 'B'}
                onClick={() => sendAction('SET_POSSESSION', { team: 'B' })}
            />
        </div>

        {/* SHOT CLOCK RESETS — 24s (new possession) and 14s (offensive rebound) */}
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, height: 14, marginTop: 2,
        }}>
            <span style={{
                fontFamily: RM, fontSize: 8, color: DIM,
                letterSpacing: '0.32em', fontWeight: 700,
            }}>SHOT CLOCK</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div
                onClick={() => sendAction('SET_SHOT_CLOCK', { ms: 24000 })}
                style={{
                    position: 'relative', height: 42,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    border: `1px solid ${GREEN}55`,
                    background: `${GREEN}0a`,
                    cursor: 'pointer', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.1s, transform 0.06s',
                }}
                onTouchStart={e => {
                    (e.currentTarget as HTMLElement).style.background = `${GREEN}33`;
                    (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
                }}
                onTouchEnd={e => {
                    (e.currentTarget as HTMLElement).style.background = `${GREEN}0a`;
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
            >
                <Corners color={GREEN} size={7} thickness={1} />
                <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: GREEN, lineHeight: 1 }}>24</span>
                <span style={{ fontFamily: RM, fontSize: 7, color: `${GREEN}99`, letterSpacing: '0.18em' }}>NEW POSS</span>
            </div>
            <div
                onClick={() => sendAction('SET_SHOT_CLOCK', { ms: 14000 })}
                style={{
                    position: 'relative', height: 42,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    border: `1px solid ${AMBER}55`,
                    background: `${AMBER}0a`,
                    cursor: 'pointer', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.1s, transform 0.06s',
                }}
                onTouchStart={e => {
                    (e.currentTarget as HTMLElement).style.background = `${AMBER}33`;
                    (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
                }}
                onTouchEnd={e => {
                    (e.currentTarget as HTMLElement).style.background = `${AMBER}0a`;
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
            >
                <Corners color={AMBER} size={7} thickness={1} />
                <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: AMBER, lineHeight: 1 }}>14</span>
                <span style={{ fontFamily: RM, fontSize: 7, color: `${AMBER}99`, letterSpacing: '0.18em' }}>OFF REB</span>
            </div>
        </div>

        {/* HORN — full width slab */}
        <div
            onClick={() => sendAction('TRIGGER_BUZZER', { type: 'SHORT' })}
            style={{
                position: 'relative',
                flex: 1, minHeight: 48,
                border: `1px solid ${ORANGE}66`,
                background: `linear-gradient(180deg, ${ORANGE}1a 0%, ${ORANGE}06 100%)`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                cursor: 'pointer', userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: `inset 0 1px 0 ${ORANGE}44`,
                transition: 'background 0.12s, transform 0.06s',
            }}
            onTouchStart={e => {
                (e.currentTarget as HTMLElement).style.background =
                    `linear-gradient(180deg, ${ORANGE}66 0%, ${ORANGE}33 100%)`;
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onTouchEnd={e => {
                (e.currentTarget as HTMLElement).style.background =
                    `linear-gradient(180deg, ${ORANGE}1a 0%, ${ORANGE}06 100%)`;
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
        >
            <Corners color={ORANGE} size={10} thickness={1} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="square">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            <span style={{
                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                fontSize: 16, color: ORANGE,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                textShadow: `0 0 10px ${ORANGE}88`,
            }}>HORN</span>
        </div>
    </div>
    );
};

// ── Possession row (in control deck) ─────────────────────────
const PossessionRow: React.FC<{
    label: string; color: string; active: boolean; onClick: () => void;
}> = ({ label, color, active, onClick }) => (
    <div
        onClick={onClick}
        style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${active ? color : `${color}33`}`,
            background: active
                ? `linear-gradient(180deg, ${color}33 0%, ${color}11 100%)`
                : 'transparent',
            color: active ? color : `${color}88`,
            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: 14, letterSpacing: '0.16em', textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: active ? `0 0 10px ${color}44, inset 0 1px 0 ${color}33` : 'none',
            transition: 'all 0.12s',
        }}
        onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
        onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
    >{label}</div>
);

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
const PiTouchScoringScreen: React.FC<Props> = ({
    teamA, teamB, clock, possession,
    teamAColor = HOME_C, teamBColor = AWAY_C,
    isConnected = true, gameCode,
    sendAction, onClose,
    onCast, onConnectHardware, onSettings, onEndGame,
}) => {
    const inBonusA = teamA.fouls >= 5;
    const inBonusB = teamB.fouls >= 5;
    const live = clock.isRunning;
    const timeoutsPerBucket = fibaTimeoutsForPeriod(clock.period, clock.totalPeriods);
    const bucketName = bucketLabel(clock.period, clock.totalPeriods);
    const [minHeader] = useMinimizeHeader();

    return (
        <div style={{
            width: '100vw', height: '100vh',
            background: BG, color: WHITE,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', fontFamily: RM,
            position: 'relative',
        }}>
            {/* Subtle "touch active" outer frame */}
            <div style={{
                position: 'absolute', inset: 0,
                border: `1px solid ${GREEN}33`,
                pointerEvents: 'none',
                zIndex: 1,
            }} />

            {/* ════════════ TOP BAR — full or minimized via Game Control pref ════════════ */}
            {minHeader ? (
                <div style={{
                    height: 32, flexShrink: 0,
                    background: SURFACE,
                    borderBottom: `1px solid ${BDR_HI}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    padding: '0 10px', gap: 6,
                    position: 'relative', zIndex: 2,
                }}>
                    {/* LIVE/PAUSED dot — keep tiny status indicator */}
                    <div style={{
                        width: 6, height: 6, marginRight: 6,
                        background: live ? GREEN : AMBER,
                        boxShadow: `0 0 6px ${live ? GREEN : AMBER}aa`,
                        animation: live ? 'tsPulse 1.1s infinite' : 'none',
                    }} />
                    <div
                        onClick={onSettings}
                        style={{
                            width: 28, height: 22,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1px solid ${ORANGE}88`,
                            background: `${ORANGE}1a`,
                            cursor: 'pointer', userSelect: 'none',
                            WebkitTapHighlightColor: 'transparent',
                            color: ORANGE,
                        }}
                        title="Settings"
                    >
                        <IconGear />
                    </div>
                </div>
            ) : (
            <div style={{
                height: 56, flexShrink: 0,
                background: SURFACE,
                borderBottom: `1px solid ${BDR_HI}`,
                display: 'flex', alignItems: 'center',
                padding: '0 18px', gap: 12,
                position: 'relative', zIndex: 2,
            }}>
                {/* Brand mark — same as LockedScoreboard */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 4, height: 22, background: AWAY_C }} />
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 20, color: WHITE, letterSpacing: '0.06em',
                    }}>THE BOX</span>
                </div>

                {/* LIVE / PAUSED */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px',
                    border: `1px solid ${live ? GREEN : AMBER}55`,
                    background: `${live ? GREEN : AMBER}10`,
                }}>
                    <div style={{
                        width: 7, height: 7,
                        background: live ? GREEN : AMBER,
                        animation: live ? 'tsPulse 1.1s infinite' : 'none',
                    }} />
                    <span style={{
                        fontFamily: RM, fontSize: 9,
                        color: live ? GREEN : AMBER,
                        letterSpacing: '0.22em', fontWeight: 700,
                    }}>{live ? 'LIVE' : 'PAUSED'}</span>
                </div>

                {/* Touch-active indicator — sits next to LIVE */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px',
                    border: `1px solid ${GREEN}88`,
                    background: `${GREEN}1a`,
                    boxShadow: `0 0 12px ${GREEN}33`,
                }}>
                    <div style={{ width: 7, height: 7, background: GREEN, animation: 'tsPulse 1.1s infinite' }} />
                    <span style={{
                        fontFamily: RM, fontSize: 9, color: GREEN,
                        letterSpacing: '0.22em', fontWeight: 700, textTransform: 'uppercase',
                    }}>TOUCH ACTIVE</span>
                </div>

                {/* Game code */}
                {gameCode && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 14px',
                        border: `1px solid ${BDR_HI}`,
                        background: 'rgba(255,255,255,0.03)',
                    }}>
                        <span style={{ fontFamily: RM, fontSize: 8, color: DIM, letterSpacing: '0.24em', fontWeight: 600 }}>
                            CODE
                        </span>
                        <span style={{
                            fontFamily: RM, fontSize: 12, color: WHITE,
                            letterSpacing: '0.2em', fontWeight: 700,
                        }}>{gameCode.toUpperCase()}</span>
                    </div>
                )}

                <div style={{ flex: 1 }} />

                {/* Connection state */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
                    <div style={{
                        width: 6, height: 6,
                        background: isConnected ? GREEN : AWAY_C,
                        boxShadow: `0 0 6px ${isConnected ? GREEN : AWAY_C}88`,
                    }} />
                    <span style={{
                        fontFamily: RM, fontSize: 8, color: DIM,
                        letterSpacing: '0.2em', fontWeight: 600,
                    }}>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
                </div>

                {/* Same action buttons as LockedScoreboard */}
                <HeaderBtn label="CAST"     icon={<IconCast />} onClick={onCast} />
                <HeaderBtn label="HARDWARE" icon={<IconHW />}   onClick={onConnectHardware} />
                <HeaderBtn label="SETTINGS" icon={<IconGear />} onClick={onSettings} accent={ORANGE} />
                {onEndGame && (
                    <HeaderBtn label="END" icon={<IconStop />} onClick={onEndGame} accent={AWAY_C} />
                )}

                {/* Close touch — green so it's the obvious "exit touch mode" affordance */}
                <HeaderBtn label="CLOSE TOUCH" icon={<IconClose />} onClick={onClose} accent={GREEN} filled />
            </div>
            )}

            {/* ════════════ HERO BAND ════════════ */}
            <div style={{
                flex: '1.1 1 0',          // hero gets a touch more height than control deck
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 360px 1fr',
                background: SURFACE,
                backgroundImage: `${DOT_GRID}, radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)`,
                borderBottom: `2px solid ${BDR_HI}`,
                position: 'relative', zIndex: 2,
                overflow: 'hidden',
            }}>
                <HeroTeamSide
                    align="left" side="HOME"
                    team={teamA} color={teamAColor}
                    bonus={inBonusA}
                    hasPossession={possession === 'A'}
                    timeoutsPerBucket={timeoutsPerBucket}
                />
                <HeroClock clock={clock} bucketName={bucketName} sendAction={sendAction} />
                <HeroTeamSide
                    align="right" side="AWAY"
                    team={teamB} color={teamBColor}
                    bonus={inBonusB}
                    hasPossession={possession === 'B'}
                    timeoutsPerBucket={timeoutsPerBucket}
                />
            </div>

            {/* ════════════ CONTROL DECK ════════════ */}
            <div style={{
                flex: '1 1 0',
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 200px 1fr',
                background: '#050505',
                position: 'relative', zIndex: 2,
            }}>
                <ControlSide
                    align="left"
                    team={teamA} color={teamAColor} teamKey="A"
                    bonus={inBonusA}
                    timeoutsPerBucket={timeoutsPerBucket}
                    sendAction={sendAction}
                />
                <ControlCenter
                    possession={possession}
                    teamAColor={teamAColor}
                    teamBColor={teamBColor}
                    clock={clock}
                    sendAction={sendAction}
                />
                <ControlSide
                    align="right"
                    team={teamB} color={teamBColor} teamKey="B"
                    bonus={inBonusB}
                    timeoutsPerBucket={timeoutsPerBucket}
                    sendAction={sendAction}
                />
            </div>

            <style>{`
                @keyframes tsPulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.25; }
                }
                @keyframes tsShotPulse {
                    0%, 100% { transform: scale(1); }
                    50%       { transform: scale(1.04); }
                }
                @keyframes tsShotBlink {
                    0%, 100% { opacity: 1; transform: scale(1.04); }
                    50%       { opacity: 0.35; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default PiTouchScoringScreen;
