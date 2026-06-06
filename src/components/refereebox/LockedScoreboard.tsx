// src/components/refereebox/LockedScoreboard.tsx
// THE BOX — Referee Live Scoreboard v8
// FIBA / NBA-inspired scorer's table. Red · Black · White · Blue.
// LED-bezel framed scores + clocks. Tinted unlock-touch pop tab.

import React, { useState, useEffect, useRef } from 'react';
import { fibaTimeoutsForPeriod, bucketLabel } from '../../services/fibaTimeouts';

interface TeamState { name: string; score: number; fouls: number; timeouts: number; color?: string; }
interface ClockState { gameMs: number; shotMs: number; isRunning: boolean; period: number; totalPeriods: number; }

interface LiveScoreboardProps {
    teamA: TeamState;
    teamB: TeamState;
    clock: ClockState;
    possession: 'A' | 'B' | null;
    canUndo: boolean;
    teamAColor?: string;
    teamBColor?: string;
    isConnected?: boolean;
    isTouchUnlocked?: boolean;
    undoFlash?: boolean;
    settingsFlash?: boolean | null;
    gameMode?: 'quick' | 'stats' | 'advanced';
    gameCode?: string;
    onCast?: () => void;
    onConnectHardware?: () => void;
    onSettings?: () => void;
    onEndGame?: () => void;
    onUnlockTouchScoring?: () => void;
}

// ── Theme tokens ──────────────────────────────────────────────
const BG       = '#000';
const SURFACE  = '#0a0a0a';
const SURF2    = '#0c0c0c';
const HOME_C   = '#2563EB';
const AWAY_C   = '#DC2626';
const GREEN    = '#22C55E';
const AMBER    = '#F59E0B';
const ORANGE   = '#F97316';
const WHITE    = '#FFFFFF';
const DIM      = 'rgba(255,255,255,0.42)';
const MUTED    = 'rgba(255,255,255,0.22)';
const BDR      = 'rgba(255,255,255,0.07)';
const BDR_HI   = 'rgba(255,255,255,0.16)';

const OSW = "'Oswald', sans-serif";
const RM  = "'JetBrains Mono', monospace";
const SG  = "'Space Grotesk', sans-serif";

// ── Subtle dot grid background (for panel inserts) ────────────
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

// ── Inline icons ─────────────────────────────────────────────
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
const IconStop = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="6" y="6" width="12" height="12" />
    </svg>
);

// ── Corner brackets — FUI accent on framed panels ────────────
const CornerBrackets: React.FC<{ color: string; size?: number; thickness?: number }> = ({
    color, size = 12, thickness = 1.5,
}) => (
    <>
        {(['tl', 'tr', 'bl', 'br'] as const).map(pos => {
            const top    = pos.startsWith('t');
            const left   = pos.endsWith('l');
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

// ── Score panel — LED bezel framed with flash on change ──────
// Dimensioned to sit BELOW the central game/shot clocks in visual hierarchy.
const ScorePanel: React.FC<{ value: number; color: string }> = ({ value, color }) => {
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
            width: '90%', maxWidth: 340,
            padding: 6,
            border: `1px solid ${color}55`,
            background: `linear-gradient(180deg, ${color}06 0%, transparent 50%, ${color}10 100%)`,
            boxShadow: flash
                ? `0 0 60px ${color}88, inset 0 0 28px ${color}33`
                : `0 0 18px ${color}1f, inset 0 0 14px ${color}0a`,
            transition: 'box-shadow 0.42s',
        }}>
            <CornerBrackets color={color} size={14} thickness={2} />
            <div style={{
                background: BG,
                backgroundImage: DOT_GRID,
                border: `1px solid ${color}33`,
                padding: '6px 0 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 3px)',
                    pointerEvents: 'none',
                }} />
                <span style={{
                    fontFamily: OSW, fontWeight: 700, fontStyle: 'italic',
                    fontSize: 132, lineHeight: 1, color,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.04em',
                    textShadow: flash
                        ? `0 0 50px ${color}, 0 0 24px ${color}cc, 0 0 10px ${color}`
                        : `0 0 22px ${color}55, 0 0 8px ${color}88`,
                    transition: 'text-shadow 0.42s',
                    position: 'relative', zIndex: 1,
                }}>
                    {value}
                </span>
            </div>
        </div>
    );
};

// ── FIBA-style team foul markers (1–5, fifth always red) ─────
const FibaFoulMarkers: React.FC<{ count: number; color: string; align: 'left' | 'right' }> = ({
    count, color, align,
}) => (
    <div style={{
        display: 'flex',
        flexDirection: align === 'left' ? 'row' : 'row-reverse',
        gap: 4,
    }}>
        {Array.from({ length: 5 }).map((_, i) => {
            const lit = i < count;
            const isFifth = i === 4;
            // The 5th marker is *always* outlined red as a warning.
            const baseBorder = isFifth ? '#EF4444' : color;
            const litBg      = isFifth ? '#EF4444' : color;
            return (
                <div key={i} style={{
                    width: 28, height: 28,
                    background: lit ? litBg : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${lit ? litBg : `${baseBorder}55`}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 16, color: lit ? '#000' : `${baseBorder}88`,
                    fontVariantNumeric: 'tabular-nums',
                    boxShadow: lit ? `0 0 10px ${litBg}88` : 'none',
                    transition: 'all 0.18s',
                }}>
                    {i + 1}
                </div>
            );
        })}
    </div>
);

// ── Timeout dash row ─────────────────────────────────────────
const TORow: React.FC<{ remaining: number; total: number; color: string }> = ({ remaining, total, color }) => (
    <div style={{ display: 'flex', gap: 5 }}>
        {Array.from({ length: total }).map((_, i) => {
            const active = i < remaining;
            return (
                <div key={i} style={{
                    width: 30, height: 7,
                    background: active ? color : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? color : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: active ? `0 0 6px ${color}66` : 'none',
                    transition: 'all 0.18s',
                }} />
            );
        })}
    </div>
);

// ── Header action button ─────────────────────────────────────
const HeaderBtn: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    accent?: string;
}> = ({ label, icon, onClick, accent = WHITE }) => {
    const enabled = !!onClick;
    return (
        <div
            onClick={onClick}
            style={{
                height: 36, padding: '0 14px',
                display: 'flex', alignItems: 'center', gap: 8,
                border: `1px solid ${BDR_HI}`,
                background: 'rgba(255,255,255,0.025)',
                color: enabled ? accent : MUTED,
                fontFamily: RM, fontSize: 9, fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                cursor: enabled ? 'pointer' : 'default',
                opacity: enabled ? 1 : 0.4,
                userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.12s, transform 0.06s',
            }}
            onTouchStart={e => {
                if (!enabled) return;
                (e.currentTarget as HTMLElement).style.background = `${accent}1a`;
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onTouchEnd={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
        >
            {icon}
            <span>{label}</span>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// COMPRESSED HEADER — kept for PiAdvancedShotFlow
// ══════════════════════════════════════════════════════════════
export const CompressedHeader: React.FC<{
    teamA: TeamState; teamB: TeamState; clock: ClockState;
    teamAColor?: string; teamBColor?: string;
}> = ({ teamA, teamB, clock, teamAColor = HOME_C, teamBColor = AWAY_C }) => (
    <div style={{
        height: 50, flexShrink: 0,
        background: BG,
        borderBottom: `1px solid ${BDR_HI}`,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', padding: '0 16px',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start' }}>
            <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 11, color: teamAColor, letterSpacing: '0.16em' }}>
                {teamA.name.toUpperCase().slice(0, 12)}
            </span>
            <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 26, color: teamAColor, lineHeight: 1 }}>
                {teamA.score}
            </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: RM, fontWeight: 700, fontSize: 18, color: WHITE, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(clock.gameMs)}
            </span>
            <span style={{ fontFamily: RM, fontSize: 9, color: DIM, letterSpacing: '0.18em' }}>
                {periodLabel(clock.period, clock.totalPeriods)}
            </span>
            <span style={{ fontFamily: RM, fontWeight: 700, fontSize: 18, color: AMBER, fontVariantNumeric: 'tabular-nums' }}>
                {fmtShot(clock.shotMs)}s
            </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
            <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 26, color: teamBColor, lineHeight: 1 }}>
                {teamB.score}
            </span>
            <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 11, color: teamBColor, letterSpacing: '0.16em' }}>
                {teamB.name.toUpperCase().slice(0, 12)}
            </span>
        </div>
    </div>
);

// ══════════════════════════════════════════════════════════════
// TEAM COLUMN — v9 scorer's-console layout
//
// Vertical order (mirrored across the central clock axis):
//   ▸ accent bar
//   ▸ team header (side label · BALL chip · team name)
//   ▸ SCORE (LED bezel)
//   ▸ stat block — FIBA team-foul markers + bonus + timeouts
// ══════════════════════════════════════════════════════════════
const TeamColumn: React.FC<{
    side: 'HOME' | 'AWAY';
    team: TeamState;
    color: string;
    bonus: boolean;
    hasPossession: boolean;
    align: 'left' | 'right';
    timeoutsPerBucket: number;   // current FIBA bucket allotment (or custom flat)
    bucketName: string;          // e.g. "H1 · 2 TO"
}> = ({ side, team, color, bonus, hasPossession, align, timeoutsPerBucket, bucketName }) => {
    const remainingTOs = team.timeouts;
    const totalTOs = Math.max(timeoutsPerBucket, remainingTOs);
    const isLeft = align === 'left';
    const flow = isLeft ? 'row' : 'row-reverse';
    const itemAlign = isLeft ? 'flex-start' : 'flex-end';

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            background: SURFACE,
            backgroundImage: `
                ${DOT_GRID},
                linear-gradient(180deg, ${color}10 0%, transparent 22%, transparent 78%, ${color}10 100%)
            `,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Color top accent — heavier glow on the outer edge */}
            <div style={{
                height: 5, flexShrink: 0,
                background: `linear-gradient(90deg, ${isLeft ? color : 'transparent'}, ${color}, ${!isLeft ? color : 'transparent'})`,
                boxShadow: `0 0 12px ${color}88`,
            }} />

            {/* Header zone — fixed height for symmetry across columns */}
            <div style={{
                height: 96, flexShrink: 0,
                padding: '16px 28px 14px',
                display: 'flex', flexDirection: 'column',
                alignItems: itemAlign,
                gap: 6,
                borderBottom: `1px solid ${BDR}`,
                position: 'relative',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: flow }}>
                    <div style={{
                        width: 6, height: 18, background: color,
                        boxShadow: `0 0 8px ${color}aa`,
                    }} />
                    <span style={{
                        fontFamily: RM, fontSize: 10, color: DIM,
                        letterSpacing: '0.34em', fontWeight: 700,
                    }}>
                        {side}
                    </span>
                    {hasPossession && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '3px 9px',
                            border: `1px solid ${color}aa`,
                            background: `${color}1f`,
                            boxShadow: `0 0 10px ${color}55`,
                            flexDirection: flow,
                        }}>
                            <div style={{ width: 5, height: 5, background: color, animation: 'lbPulse 1.2s infinite' }} />
                            <span style={{ fontFamily: RM, fontSize: 8, color, letterSpacing: '0.22em', fontWeight: 700 }}>
                                BALL
                            </span>
                        </div>
                    )}
                </div>
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 32, color: WHITE,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    lineHeight: 1.02,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '100%',
                    textAlign: align,
                    textShadow: `0 0 14px ${color}33`,
                }}>
                    {team.name}
                </span>
            </div>

            {/* SCORE — flex:1 so it occupies the middle band, mirrored against center clocks */}
            <div style={{
                flex: 1, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                position: 'relative', minHeight: 0,
                padding: '12px 18px',
            }}>
                <ScorePanel value={team.score} color={color} />
            </div>

            {/* STAT BLOCK — FIBA fouls + timeouts, fixed-height for left/right symmetry */}
            <div style={{
                height: 168, flexShrink: 0,
                padding: '14px 28px 18px',
                display: 'flex', flexDirection: 'column', gap: 14,
                borderTop: `1px solid ${BDR}`,
                alignItems: itemAlign,
                background: 'rgba(0,0,0,0.4)',
            }}>
                {/* Team Fouls row — FIBA 1-5 numbered markers */}
                <div style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: flow,
                    alignItems: 'center', gap: 14,
                }}>
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 6,
                        alignItems: itemAlign,
                    }}>
                        <span style={{
                            fontFamily: RM, fontSize: 9, color: DIM,
                            letterSpacing: '0.30em', fontWeight: 700,
                        }}>
                            TEAM FOULS
                        </span>
                        <FibaFoulMarkers count={team.fouls} color={color} align={align} />
                    </div>

                    <div style={{ flex: 1 }} />

                    <div style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: isLeft ? 'flex-end' : 'flex-start',
                        gap: 4,
                    }}>
                        <span style={{
                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                            fontSize: 44,
                            color: bonus ? ORANGE : WHITE,
                            lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                            textShadow: bonus ? `0 0 14px ${ORANGE}88` : 'none',
                        }}>
                            {team.fouls}
                        </span>
                        {bonus && (
                            <div style={{
                                padding: '3px 9px',
                                background: ORANGE, color: '#000',
                                fontFamily: RM, fontSize: 9, fontWeight: 700,
                                letterSpacing: '0.22em',
                                boxShadow: `0 0 14px ${ORANGE}aa`,
                                animation: 'lbPulse 1.6s infinite',
                            }}>
                                BONUS
                            </div>
                        )}
                    </div>
                </div>

                {/* Divider line for symmetry */}
                <div style={{
                    width: '100%', height: 1,
                    background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, ${BDR_HI}, transparent)`,
                }} />

                {/* Timeouts row */}
                <div style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: flow,
                    alignItems: 'center', gap: 14,
                }}>
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 6,
                        alignItems: itemAlign,
                    }}>
                        <div style={{
                            display: 'flex', flexDirection: align === 'left' ? 'row' : 'row-reverse',
                            alignItems: 'baseline', gap: 8,
                        }}>
                            <span style={{
                                fontFamily: RM, fontSize: 9, color: DIM,
                                letterSpacing: '0.30em', fontWeight: 700,
                            }}>
                                TIMEOUTS
                            </span>
                            <span style={{
                                fontFamily: RM, fontSize: 7, color: 'rgba(255,255,255,0.32)',
                                letterSpacing: '0.22em', fontWeight: 600,
                            }}>
                                · {timeoutsPerBucket} this {bucketName.split(' ')[0]}
                            </span>
                        </div>
                        <TORow remaining={remainingTOs} total={totalTOs} color={color} />
                    </div>

                    <div style={{ flex: 1 }} />

                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 28, color: WHITE,
                        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                    }}>
                        {remainingTOs}
                        <span style={{ color: DIM, fontSize: 16 }}> / {timeoutsPerBucket}</span>
                    </span>
                </div>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// CLOCK BEZEL — LED-style framed clock (game · shot)
// Sized larger in v9 so the centerpiece outweighs the team scores.
// ══════════════════════════════════════════════════════════════
const ClockBezel: React.FC<{
    label: string;
    children: React.ReactNode;
    accent: string;
    glow?: boolean;
    pulse?: boolean;
    width?: string | number;
    pad?: string;
}> = ({ label, children, accent, glow = false, pulse = false, width = '92%', pad = '14px 0' }) => (
    <div style={{
        position: 'relative',
        width,
        padding: 8,
        border: `1px solid ${accent}66`,
        background: `linear-gradient(180deg, ${accent}06 0%, transparent 50%, ${accent}14 100%)`,
        boxShadow: glow
            ? `0 0 38px ${accent}88, inset 0 0 22px ${accent}33`
            : `0 0 22px ${accent}22, inset 0 0 14px ${accent}0a`,
        animation: pulse ? 'lbShotPulse 0.5s infinite' : 'none',
    }}>
        <CornerBrackets color={accent} size={14} thickness={2} />

        {/* Label tab */}
        <div style={{
            position: 'absolute',
            top: -1, left: 14,
            transform: 'translateY(-50%)',
            padding: '3px 10px',
            background: BG,
            border: `1px solid ${accent}66`,
            fontFamily: RM, fontSize: 8,
            color: accent, letterSpacing: '0.34em', fontWeight: 700,
            zIndex: 2,
        }}>
            {label}
        </div>

        {/* Inner chamber */}
        <div style={{
            background: BG,
            backgroundImage: DOT_GRID,
            border: `1px solid ${accent}33`,
            padding: pad,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 1px, transparent 1px, transparent 3px)',
                pointerEvents: 'none',
            }} />
            {children}
        </div>
    </div>
);

// ══════════════════════════════════════════════════════════════
// POSSESSION BAR — thin strip under the shot clock
// Centered HOME ↔ AWAY pill. Arrow points to whichever team has ball.
// ══════════════════════════════════════════════════════════════
const PossessionBar: React.FC<{ side: 'A' | 'B' | null; colorA: string; colorB: string }> = ({ side, colorA, colorB }) => {
    if (!side) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 14px',
                border: `1px dashed ${MUTED}`,
            }}>
                <span style={{
                    fontFamily: RM, fontSize: 9, color: MUTED,
                    letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase',
                }}>
                    POSSESSION · UNDETERMINED
                </span>
            </div>
        );
    }
    const color = side === 'A' ? colorA : colorB;
    const teamLabel = side === 'A' ? 'HOME' : 'AWAY';

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '7px 18px',
            border: `1px solid ${color}aa`,
            background: `${color}1a`,
            boxShadow: `0 0 14px ${color}33`,
            position: 'relative',
        }}>
            <span style={{
                fontFamily: RM, fontSize: 8, color: DIM,
                letterSpacing: '0.32em', fontWeight: 700, textTransform: 'uppercase',
            }}>POSS</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {side === 'A' && (
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 24, color, lineHeight: 1,
                        textShadow: `0 0 12px ${color}aa`,
                        animation: 'lbPossArrow 1.4s infinite',
                    }}>◀</span>
                )}
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 16, color,
                    letterSpacing: '0.16em', textTransform: 'uppercase',
                }}>
                    {teamLabel}
                </span>
                {side === 'B' && (
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 24, color, lineHeight: 1,
                        textShadow: `0 0 12px ${color}aa`,
                        animation: 'lbPossArrow 1.4s infinite',
                    }}>▶</span>
                )}
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// UNLOCK TOUCH SCORING POP TAB (centered on bottom edge)
// ══════════════════════════════════════════════════════════════
const UnlockTab: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
    if (!onClick) return null;
    return (
        <div
            onClick={onClick}
            style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '34vw', minWidth: 300, maxWidth: 420,
                height: 38,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${BDR_HI}`,
                borderBottom: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 12,
                cursor: 'pointer', userSelect: 'none',
                color: WHITE,
                boxShadow: '0 -8px 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)',
                WebkitTapHighlightColor: 'transparent',
                zIndex: 5,
                transition: 'background 0.15s, transform 0.1s',
                animation: 'lbBob 2.4s ease-in-out infinite',
            }}
            onTouchStart={e => {
                (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)';
                (e.currentTarget as HTMLElement).style.transform = 'translateX(-50%) translateY(-2px)';
            }}
            onTouchEnd={e => {
                (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)';
                (e.currentTarget as HTMLElement).style.transform = 'translateX(-50%)';
            }}
        >
            {/* Up-chevron */}
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="square">
                <polyline points="1 7 6 2 11 7" />
            </svg>
            <span style={{
                fontFamily: RM, fontSize: 9, fontWeight: 700,
                letterSpacing: '0.28em', textTransform: 'uppercase',
                color: WHITE,
            }}>
                UNLOCK TOUCH SCORING
            </span>
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="square">
                <polyline points="1 7 6 2 11 7" />
            </svg>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
    teamA, teamB, clock, possession,
    teamAColor = HOME_C, teamBColor = AWAY_C,
    isConnected = true,
    gameCode,
    onCast, onConnectHardware, onSettings, onEndGame, onUnlockTouchScoring,
}) => {
    const inBonusA = teamA.fouls >= 5;
    const inBonusB = teamB.fouls >= 5;
    const timeoutsPerBucket = fibaTimeoutsForPeriod(clock.period, clock.totalPeriods);
    const bucketName = bucketLabel(clock.period, clock.totalPeriods);
    const shotMs   = clock.shotMs ?? 0;
    const shotLow  = shotMs > 0 && shotMs <= 5000;
    const live     = clock.isRunning;
    const margin   = teamA.score - teamB.score;

    return (
        <div style={{
            width: '100vw', height: '100vh',
            background: BG, color: WHITE,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', fontFamily: RM,
            position: 'relative',
        }}>

            {/* ════════════════ TOP BAR ════════════════ */}
            <div style={{
                height: 56, flexShrink: 0,
                background: SURFACE,
                borderBottom: `1px solid ${BDR_HI}`,
                display: 'flex', alignItems: 'center',
                padding: '0 18px', gap: 12,
            }}>
                {/* Brand mark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 4, height: 22, background: AWAY_C }} />
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 20, color: WHITE, letterSpacing: '0.06em',
                    }}>
                        THE BOX
                    </span>
                </div>

                {/* Live / paused status */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px',
                    border: `1px solid ${live ? GREEN : AMBER}55`,
                    background: `${live ? GREEN : AMBER}10`,
                }}>
                    <div style={{
                        width: 7, height: 7,
                        background: live ? GREEN : AMBER,
                        animation: live ? 'lbPulse 1.1s infinite' : 'none',
                    }} />
                    <span style={{
                        fontFamily: RM, fontSize: 9,
                        color: live ? GREEN : AMBER,
                        letterSpacing: '0.22em', fontWeight: 700,
                    }}>
                        {live ? 'LIVE' : 'PAUSED'}
                    </span>
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
                        }}>
                            {gameCode.toUpperCase()}
                        </span>
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
                    }}>
                        {isConnected ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </div>

                <HeaderBtn label="CAST"     icon={<IconCast />} onClick={onCast} />
                <HeaderBtn label="HARDWARE" icon={<IconHW />}   onClick={onConnectHardware} />
                <HeaderBtn label="SETTINGS" icon={<IconGear />} onClick={onSettings} accent={ORANGE} />
                {onEndGame && (
                    <HeaderBtn label="END" icon={<IconStop />} onClick={onEndGame} accent={AWAY_C} />
                )}
            </div>

            {/* ════════════════ MAIN GRID — v9 ════════════════
                Center column wider (460px) to host larger clocks.
                HOME ↔ AWAY mirror across the central clock axis.
            */}
            <div style={{
                flex: 1, display: 'grid',
                gridTemplateColumns: '1fr 460px 1fr',
                minHeight: 0,
            }}>

                {/* ── HOME ── */}
                <TeamColumn
                    side="HOME"
                    team={teamA}
                    color={teamAColor}
                    bonus={inBonusA}
                    hasPossession={possession === 'A'}
                    align="left"
                    timeoutsPerBucket={timeoutsPerBucket}
                    bucketName={bucketName}
                />

                {/* ── CENTER : CLOCKS (visual anchor) ── */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    background: SURF2,
                    backgroundImage: `
                        ${DOT_GRID},
                        radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)
                    `,
                    borderLeft: `1px solid ${BDR_HI}`,
                    borderRight: `1px solid ${BDR_HI}`,
                    overflow: 'hidden',
                    position: 'relative',
                }}>

                    {/* Period chip — sits ABOVE the game clock as a label */}
                    <div style={{
                        height: 56, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 12,
                        borderBottom: `1px solid ${BDR}`,
                        background: 'rgba(0,0,0,0.35)',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '7px 18px',
                            border: `1px solid ${BDR_HI}`,
                            background: 'rgba(255,255,255,0.03)',
                            position: 'relative',
                        }}>
                            <CornerBrackets color={BDR_HI} size={7} thickness={1} />
                            <span style={{
                                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                fontSize: 22, color: WHITE, letterSpacing: '0.05em',
                            }}>
                                {periodLabel(clock.period, clock.totalPeriods)}
                            </span>
                            <span style={{ fontFamily: RM, fontSize: 9, color: DIM, letterSpacing: '0.22em', fontWeight: 700 }}>
                                · {clock.period} OF {clock.totalPeriods}
                            </span>
                        </div>
                        {margin !== 0 && (
                            <div style={{
                                padding: '5px 12px',
                                border: `1px solid ${(margin > 0 ? teamAColor : teamBColor)}66`,
                                background: `${(margin > 0 ? teamAColor : teamBColor)}14`,
                            }}>
                                <span style={{
                                    fontFamily: RM, fontSize: 9,
                                    color: margin > 0 ? teamAColor : teamBColor,
                                    letterSpacing: '0.22em', fontWeight: 700,
                                }}>
                                    {margin > 0 ? `+${margin} HOME` : `+${Math.abs(margin)} AWAY`}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* GAME CLOCK — Tier 1 visual */}
                    <div style={{
                        flex: '1.4 1 0',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '16px 16px',
                        borderBottom: `1px solid ${BDR}`,
                    }}>
                        <ClockBezel label="GAME CLOCK" accent={WHITE} glow={live} width="94%" pad="18px 0 22px">
                            <span style={{
                                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                fontSize: 144, lineHeight: 1, color: WHITE,
                                fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '-0.03em',
                                textShadow: live
                                    ? `0 0 30px rgba(255,255,255,0.5), 0 0 12px rgba(255,255,255,0.7)`
                                    : `0 0 10px rgba(255,255,255,0.15)`,
                                position: 'relative', zIndex: 1,
                            }}>
                                {fmt(clock.gameMs)}
                            </span>
                        </ClockBezel>
                    </div>

                    {/* SHOT CLOCK — Tier 2 visual */}
                    <div style={{
                        flex: '1 1 0',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '12px 16px',
                        borderBottom: `1px solid ${BDR}`,
                        background: shotLow ? `${AWAY_C}08` : 'transparent',
                    }}>
                        <ClockBezel
                            label="SHOT CLOCK"
                            accent={shotLow ? AWAY_C : AMBER}
                            glow
                            pulse={shotLow}
                            width="62%"
                            pad="14px 0 16px"
                        >
                            <span style={{
                                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                fontSize: 108, lineHeight: 1,
                                color: shotLow ? AWAY_C : AMBER,
                                fontVariantNumeric: 'tabular-nums',
                                textShadow: `0 0 26px ${shotLow ? AWAY_C : AMBER}cc, 0 0 10px ${shotLow ? AWAY_C : AMBER}`,
                                position: 'relative', zIndex: 1,
                            }}>
                                {fmtShot(shotMs)}
                            </span>
                        </ClockBezel>
                    </div>

                    {/* POSSESSION strip — Tier 3 visual */}
                    <div style={{
                        height: 72, flexShrink: 0,
                        background: SURFACE,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderTop: `1px solid ${BDR_HI}`,
                    }}>
                        <PossessionBar side={possession} colorA={teamAColor} colorB={teamBColor} />
                    </div>
                </div>

                {/* ── AWAY ── */}
                <TeamColumn
                    side="AWAY"
                    team={teamB}
                    color={teamBColor}
                    bonus={inBonusB}
                    hasPossession={possession === 'B'}
                    align="right"
                    timeoutsPerBucket={timeoutsPerBucket}
                    bucketName={bucketName}
                />
            </div>

            {/* ════════════════ UNLOCK POP TAB ════════════════ */}
            <UnlockTab onClick={onUnlockTouchScoring} />

            <style>{`
                @keyframes lbPulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.25; }
                }
                @keyframes lbShotPulse {
                    0%, 100% { transform: scale(1); }
                    50%       { transform: scale(1.04); }
                }
                @keyframes lbBob {
                    0%, 100% { transform: translateX(-50%) translateY(0); }
                    50%       { transform: translateX(-50%) translateY(-3px); }
                }
                @keyframes lbPossArrow {
                    0%, 100% { transform: translateX(0); opacity: 1; }
                    50%       { transform: translateX(-3px); opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

export default LiveScoreboard;
