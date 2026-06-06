// src/components/refereebox/LockedScoreboardMinimal.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Minimal Referee Live Scoreboard v3 · "Editorial Sport"
//
// Premium broadcast-lower-third aesthetic, tuned for the Waveshare
// 7-inch HDMI screen (1024×600).
//
// Layout (1024×600):
//   ┌────────────────────────────────────────────────────────┐
//   │ ●  THE BOX · LIVE · CODE 4FG2     CAST · HW · SET · END│  44px
//   ├──┬──────────────────────────────────────────────────┬──┤
//   │  │      HOME            CLOCK            AWAY       │  │
//   │  │      TEAM A        ──────────         TEAM B     │  │  hero zone
//   │  │       84              5:43             72        │  │
//   │  │    ▶ BALL              ─                         │  │
//   │  │   F:3 · TO:●●○      SHOT 18         F:4 · TO:●●● │  │
//   │  └──────────────────────────────────────────────────┘  │
//   │                                                        │
//   │      ╭───────── ▲ OPEN TOUCH DECK ▲ ─────────╮         │  pull tab
//   └────────────────────────────────────────────────────────┘
//
// Visual language:
//   • One sealed, unified scoreboard frame (not three floating cards).
//   • Team-color "ribbons" running vertical along the left & right outer edges.
//   • Ambient team-color radial washes on the canvas — broadcast environment.
//   • Center clock cluster is a sealed unit with subtle internal divider.
//   • Period progress is a faint 1px hairline pinned to the very top edge.
//   • Pull-up tab is a calm full-bleed accent — taps unlock the touch deck.
//
// Feature parity with the classic theme:
//   • Pull-up tab, undo flash, settings flash, possession indicator,
//     period progress, FIBA bonus chip, period bucket label.
//
// Honors the `disableTouchDeck` Game Control pref — hides both the pull tab
// and the OPEN TOUCH DECK header chip when the ref doesn't want touch input.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { fibaTimeoutsForPeriod, bucketLabel } from '../../services/fibaTimeouts';
import { useDisableTouchDeck } from '../../services/gameControlPrefs';

// ── Types (mirror LockedScoreboard) ───────────────────────────
interface TeamState { name: string; score: number; fouls: number; timeouts: number; color?: string; }
interface ClockState { gameMs: number; shotMs: number; isRunning: boolean; period: number; totalPeriods: number; }

interface Props {
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

// ── Tokens ────────────────────────────────────────────────────
const BG       = '#0a0a0c';
const SURFACE  = '#141416';
const SURFACE_HI = '#1a1a1d';
const BDR      = 'rgba(255,255,255,0.08)';
const BDR_HI   = 'rgba(255,255,255,0.12)';
const WHITE    = '#FFFFFF';
const DIM      = 'rgba(255,255,255,0.55)';
const MUTED    = 'rgba(255,255,255,0.38)';
const EASE     = 'cubic-bezier(0.16, 1, 0.3, 1)';
const GREEN    = '#22C55E';
const AMBER    = '#F59E0B';
const ORANGE   = '#F97316';
const RED      = '#EF4444';
const HOME_C   = '#DC2626';
const AWAY_C   = '#2563EB';

const OSW = "'Oswald', sans-serif";
const RM  = "'JetBrains Mono', monospace";

// ── Helpers ───────────────────────────────────────────────────
const fmt = (ms: number): string => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtShot = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));
const periodLabel = (period: number, total: number): string => {
    if (total === 2) return period <= 2 ? `H${period}` : `OT${period - 2}`;
    return period <= 4 ? `Q${period}` : `OT${period - 4}`;
};

// ── Icons ─────────────────────────────────────────────────────
const IconCast = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 16h.01" /><path d="M2 12a8 8 0 0 1 8 8" /><path d="M2 8a12 12 0 0 1 12 12" />
        <rect x="13" y="13" width="9" height="7" rx="1" />
    </svg>
);
const IconHW = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="5" width="14" height="14" rx="1.5" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </svg>
);
const IconGear = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);
const IconStop = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
);
const IconUnlock = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
    </svg>
);

// ── Header pill button ────────────────────────────────────────
// Two variants:
//   • iconOnly={true}  → 36×36 round chip (CAST, HARDWARE).
//   • Default          → 36 height pill with label (SETTINGS, END, TOUCH DECK).
// All hit ≥36px touch targets — comfortable for a finger on a 7" panel.
const HeaderBtn: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    accent?: string;
    filled?: boolean;
    iconOnly?: boolean;
}> = ({ label, icon, onClick, accent = WHITE, filled = false, iconOnly = false }) => {
    const enabled = !!onClick;
    return (
        <button
            onClick={enabled ? onClick : undefined}
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
            style={{
                appearance: 'none',
                height: 44,
                width: iconOnly ? 44 : 'auto',
                padding: iconOnly ? 0 : '0 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: iconOnly ? 0 : 7,
                border: `1px solid ${filled ? accent : BDR_HI}`,
                background: filled ? `${accent}22` : 'rgba(255,255,255,0.02)',
                color: filled ? accent : WHITE,
                fontFamily: RM, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.2em', textTransform: 'uppercase',
                cursor: enabled ? 'pointer' : 'default',
                opacity: enabled ? 1 : 0.4,
                userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                borderRadius: 999,
                transition: `background 200ms ${EASE}, transform 200ms ${EASE}, box-shadow 200ms ${EASE}`,
                boxShadow: filled ? `0 0 14px ${accent}33` : 'none',
            }}
            onPointerDown={e => {
                if (!enabled) return;
                (e.currentTarget as HTMLElement).style.background = `${accent}3a`;
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onPointerUp={e => {
                (e.currentTarget as HTMLElement).style.background = filled ? `${accent}22` : 'rgba(255,255,255,0.02)';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
            onPointerLeave={e => {
                (e.currentTarget as HTMLElement).style.background = filled ? `${accent}22` : 'rgba(255,255,255,0.02)';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
        >
            {icon}
            {!iconOnly && <span>{label}</span>}
        </button>
    );
};

// ── Score tick — pulses briefly when value changes ────────────
// Broadcast scoreboards always animate on point change. Subtle scale
// (1 → 1.06 → 1) over 320ms + a flash of team-color glow.
const ScoreTick: React.FC<{ value: number; color: string }> = ({ value, color }) => {
    const [pulse, setPulse] = useState(false);
    const prev = useRef(value);
    useEffect(() => {
        if (prev.current !== value) {
            setPulse(true);
            const t = setTimeout(() => setPulse(false), 360);
            prev.current = value;
            return () => clearTimeout(t);
        }
    }, [value]);
    return (
        <span style={{
            fontFamily: OSW, fontWeight: 700,
            fontSize: 'clamp(140px, 22vw, 230px)',
            lineHeight: 0.82, color: WHITE,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.055em',
            display: 'inline-block',
            transform: pulse ? 'scale(1.06)' : 'scale(1)',
            transition: `transform 360ms ${EASE}, text-shadow 360ms ${EASE}`,
            textShadow: pulse
                ? `0 6px 32px rgba(0,0,0,0.7), 0 0 50px ${color}cc, 0 0 18px ${color}88`
                : `0 6px 32px rgba(0,0,0,0.7), 0 0 38px ${color}44`,
        }}>{value}</span>
    );
};

// ── Timeout pips ──────────────────────────────────────────────
const TimeoutPips: React.FC<{ remaining: number; total: number; color: string }> = ({ remaining, total, color }) => (
    <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: Math.max(total, remaining) }).map((_, i) => {
            const lit = i < remaining;
            return (
                <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: lit ? color : 'transparent',
                    border: `1.5px solid ${lit ? color : 'rgba(255,255,255,0.16)'}`,
                    boxShadow: lit ? `0 0 8px ${color}aa` : 'none',
                }} />
            );
        })}
    </div>
);

// ── Team column ───────────────────────────────────────────────
// One vertical slab per team: large team name in tracked caps,
// gigantic score, possession marker, footer with fouls + TOs.
// The team-color ribbon runs the full height along the outer edge.
const TeamColumn: React.FC<{
    side: 'A' | 'B';
    team: TeamState;
    color: string;
    hasPossession: boolean;
    inBonus: boolean;
    timeoutsPerBucket: number;
}> = ({ side, team, color, hasPossession, inBonus, timeoutsPerBucket }) => {
    const isLeft = side === 'A';
    return (
        <div style={{
            flex: 1,
            position: 'relative',
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            padding: isLeft ? '14px 22px 14px 30px' : '14px 30px 14px 22px',
            overflow: 'hidden',
        }}>
            {/* Outer-edge color ribbon — runs the full height */}
            <div style={{
                position: 'absolute', top: 0, bottom: 0,
                [isLeft ? 'left' : 'right']: 0,
                width: 5,
                background: `linear-gradient(180deg, ${color} 0%, ${color}aa 50%, ${color} 100%)`,
                boxShadow: `0 0 18px ${color}88`,
            }} />

            {/* Ambient team-color glow centered behind the score.
                NOTE: no filter: blur — Pi 4 GPU killer per CLAUDE.md. A multi-stop
                radial gradient gives the same soft falloff for ~free. */}
            <div style={{
                position: 'absolute',
                [isLeft ? 'right' : 'left']: -120, top: '40%',
                transform: 'translateY(-50%)',
                width: 280, height: 280,
                background: `radial-gradient(circle, ${color}26 0%, ${color}14 25%, ${color}08 45%, transparent 70%)`,
                pointerEvents: 'none',
            }} />

            {/* TOP — side label + team name */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isLeft ? 'flex-start' : 'flex-end',
                gap: 6, position: 'relative', zIndex: 1,
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    flexDirection: isLeft ? 'row' : 'row-reverse',
                }}>
                    <span style={{
                        fontFamily: RM, fontSize: 8, fontWeight: 800,
                        color: MUTED, letterSpacing: '0.4em',
                    }}>{isLeft ? 'HOME' : 'AWAY'}</span>
                    {hasPossession && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '2px 7px',
                            border: `1px solid ${color}aa`,
                            background: `${color}1f`,
                            borderRadius: 100,
                            boxShadow: `0 0 10px ${color}55`,
                        }}>
                            <div style={{
                                width: 5, height: 5, borderRadius: '50%',
                                background: color,
                                boxShadow: `0 0 6px ${color}`,
                                animation: 'msbDot 1.1s infinite',
                            }} />
                            <span style={{
                                fontFamily: RM, fontSize: 7, fontWeight: 800,
                                color, letterSpacing: '0.22em',
                            }}>BALL</span>
                        </div>
                    )}
                </div>
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 22, color: WHITE,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    lineHeight: 1,
                    textShadow: `0 0 16px ${color}44`,
                }}>{team.name || (isLeft ? 'TEAM A' : 'TEAM B')}</span>
            </div>

            {/* HERO — gigantic score, vertically centered, animates on change */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isLeft ? 'flex-end' : 'flex-start',
                position: 'relative', zIndex: 1,
                paddingRight: isLeft ? 10 : 0,
                paddingLeft: isLeft ? 0 : 10,
            }}>
                <ScoreTick value={team.score} color={color} />
            </div>

            {/* FOOTER — fouls + timeouts in one tight row */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                position: 'relative', zIndex: 1,
            }}>
                {/* FOULS */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    order: isLeft ? 1 : 2,
                }}>
                    <span style={{
                        fontFamily: RM, fontSize: 8, fontWeight: 800,
                        color: DIM, letterSpacing: '0.28em',
                    }}>FOULS</span>
                    <span style={{
                        fontFamily: OSW, fontWeight: 700,
                        fontSize: 22, color: inBonus ? ORANGE : WHITE,
                        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                        textShadow: inBonus ? `0 0 12px ${ORANGE}77` : 'none',
                    }}>{team.fouls}</span>
                    {inBonus && (
                        <span style={{
                            padding: '2px 7px',
                            background: ORANGE, color: '#000',
                            fontFamily: RM, fontSize: 7, fontWeight: 800,
                            letterSpacing: '0.2em', borderRadius: 3,
                            boxShadow: `0 0 12px ${ORANGE}aa`,
                        }}>BONUS</span>
                    )}
                </div>
                {/* TIMEOUTS */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    order: isLeft ? 2 : 1,
                    flexDirection: isLeft ? 'row-reverse' : 'row',
                }}>
                    <span style={{
                        fontFamily: RM, fontSize: 8, fontWeight: 800,
                        color: DIM, letterSpacing: '0.28em',
                    }}>TO</span>
                    <TimeoutPips
                        remaining={team.timeouts}
                        total={Math.max(timeoutsPerBucket, team.timeouts)}
                        color={color}
                    />
                </div>
            </div>
        </div>
    );
};

// ── Center clock column ───────────────────────────────────────
const CenterColumn: React.FC<{
    clock: ClockState;
    bucketName: string;
}> = ({ clock, bucketName }) => {
    const live = clock.isRunning;
    const shotMs = clock.shotMs ?? 0;
    const shotZero = shotMs === 0;
    const shotLow = !shotZero && shotMs <= 5000;
    const shotAlert = shotZero || shotLow;
    const shotColor = shotAlert ? RED : ORANGE;

    return (
        <div style={{
            width: 280,
            flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 12px',
            position: 'relative',
            background: `linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.012) 50%, transparent 100%)`,
            borderLeft: `1px solid ${BDR}`,
            borderRight: `1px solid ${BDR}`,
        }}>
            {/* PERIOD CHIP — small at top */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 10px',
                border: `1px solid ${BDR_HI}`,
                background: 'rgba(255,255,255,0.025)',
                borderRadius: 100,
            }}>
                <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: live ? GREEN : AMBER,
                    boxShadow: live ? `0 0 6px ${GREEN}` : 'none',
                    animation: live ? 'msbDot 1.1s infinite' : 'none',
                }} />
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 14, color: WHITE,
                    letterSpacing: '0.08em',
                }}>{periodLabel(clock.period, clock.totalPeriods)}</span>
                <span style={{ width: 1, height: 10, background: BDR_HI }} />
                <span style={{
                    fontFamily: RM, fontSize: 7, fontWeight: 800,
                    color: DIM, letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                }}>{bucketName}</span>
            </div>

            {/* GAME TIME — the hero */}
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
                <span style={{
                    fontFamily: RM, fontSize: 8, fontWeight: 800,
                    letterSpacing: '0.36em', color: MUTED,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                }}>GAME TIME</span>
                <span style={{
                    fontFamily: OSW, fontWeight: 700,
                    fontSize: 'clamp(70px, 11vw, 108px)',
                    lineHeight: 0.88, color: WHITE,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.04em',
                    textShadow: live ? '0 0 28px rgba(255,255,255,0.32)' : '0 0 4px rgba(255,255,255,0.08)',
                }}>{fmt(clock.gameMs)}</span>
            </div>

            {/* SHOT CLOCK — sealed bezel at bottom */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 12,
                padding: '6px 14px',
                border: `1px solid ${shotAlert ? shotColor : BDR_HI}`,
                background: `${shotAlert ? shotColor : 'rgba(255,255,255,0)'}${shotAlert ? '18' : ''}`,
                borderRadius: 12,
                boxShadow: shotAlert ? `0 0 18px ${shotColor}66` : 'none',
                animation: shotZero ? 'msbShotBlink 0.45s infinite' : shotLow ? 'msbShotPulse 0.5s infinite' : 'none',
                minWidth: 150,
            }}>
                <span style={{
                    fontFamily: RM, fontSize: 8, fontWeight: 800,
                    letterSpacing: '0.3em', color: shotAlert ? shotColor : DIM,
                    textTransform: 'uppercase',
                }}>{shotZero ? 'RESET' : 'SHOT'}</span>
                <span style={{
                    fontFamily: OSW, fontWeight: 700,
                    fontSize: 30, lineHeight: 1, color: shotColor,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.03em',
                    textShadow: `0 0 14px ${shotColor}88`,
                }}>{fmtShot(shotMs)}</span>
            </div>
        </div>
    );
};

// ── Pull-up tab — calm green accent, broadcast-styled ─────────
const UnlockTab: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
    const [pressed, setPressed] = useState(false);
    if (!onClick) return null;
    return (
        <div
            onClick={onClick}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: `translateX(-50%) translateY(${pressed ? 0 : -3}px)`,
                width: 'min(42vw, 480px)', minWidth: 300,
                height: 52,
                background: `linear-gradient(180deg, rgba(34,197,94,0.13) 0%, rgba(34,197,94,0.04) 100%)`,
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: `1px solid ${GREEN}66`,
                borderBottom: 'none',
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 14,
                cursor: 'pointer', userSelect: 'none',
                color: GREEN,
                boxShadow: `0 -10px 32px rgba(34,197,94,0.18), inset 0 1px 0 rgba(255,255,255,0.06)`,
                WebkitTapHighlightColor: 'transparent',
                zIndex: 5,
                transition: 'transform 0.18s ease, background 0.15s',
                animation: 'msbBob 2.6s ease-in-out infinite',
            }}
        >
            {/* Tactile chevron stack — "swipe up" affordance */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.85 }}>
                <svg width="14" height="6" viewBox="0 0 14 6" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45">
                    <polyline points="1 5 7 1 13 5" />
                </svg>
                <svg width="14" height="6" viewBox="0 0 14 6" fill="none" stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 5 7 1 13 5" />
                </svg>
            </div>
            <span style={{
                fontFamily: RM, fontSize: 10, fontWeight: 800,
                letterSpacing: '0.32em', textTransform: 'uppercase',
                color: GREEN,
                textShadow: `0 0 10px ${GREEN}55`,
            }}>OPEN TOUCH DECK</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.85 }}>
                <svg width="14" height="6" viewBox="0 0 14 6" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45">
                    <polyline points="1 5 7 1 13 5" />
                </svg>
                <svg width="14" height="6" viewBox="0 0 14 6" fill="none" stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 5 7 1 13 5" />
                </svg>
            </div>
        </div>
    );
};

// ── Period progress — barely-visible 1px hairline ─────────────
const PeriodProgress: React.FC<{ clock: ClockState }> = ({ clock }) => {
    const periodMinutes = (clock as ClockState & { periodMinutes?: number }).periodMinutes
        ?? (clock.totalPeriods === 2 ? 20 : 10);
    const totalMs = periodMinutes * 60 * 1000;
    const elapsed = Math.max(0, totalMs - clock.gameMs);
    const pct = Math.min(100, Math.max(0, (elapsed / totalMs) * 100));
    const colorEnd = pct > 85 ? RED : pct > 65 ? AMBER : 'rgba(255,255,255,0.55)';
    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 1,
            background: 'transparent',
            zIndex: 4,
        }}>
            <div style={{
                width: `${pct}%`, height: '100%',
                background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, ${colorEnd} 100%)`,
                opacity: 0.5,
                transition: 'width 0.6s linear',
            }} />
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
const LockedScoreboardMinimal: React.FC<Props> = ({
    teamA, teamB, clock, possession,
    teamAColor = HOME_C, teamBColor = AWAY_C,
    isConnected = true, isTouchUnlocked = false,
    undoFlash = false, settingsFlash = null,
    gameMode, gameCode,
    onCast, onConnectHardware, onSettings, onEndGame, onUnlockTouchScoring,
}) => {
    const inBonusA = teamA.fouls >= 5;
    const inBonusB = teamB.fouls >= 5;
    const timeoutsPerBucket = fibaTimeoutsForPeriod(clock.period, clock.totalPeriods);
    const bucketName = bucketLabel(clock.period, clock.totalPeriods);
    const [disableTouchDeck] = useDisableTouchDeck();
    const showTouchAffordance = !disableTouchDeck && !isTouchUnlocked && !!onUnlockTouchScoring;

    // Undo flash — fades over ~700ms
    const [undoVisible, setUndoVisible] = useState(false);
    useEffect(() => {
        if (undoFlash) {
            setUndoVisible(true);
            const t = setTimeout(() => setUndoVisible(false), 700);
            return () => clearTimeout(t);
        }
    }, [undoFlash]);

    // Settings flash — when daemon toggles touch lock state
    const [settingsVisible, setSettingsVisible] = useState(false);
    useEffect(() => {
        if (settingsFlash !== null) {
            setSettingsVisible(true);
            const t = setTimeout(() => setSettingsVisible(false), 900);
            return () => clearTimeout(t);
        }
    }, [settingsFlash]);

    return (
        <main role="main" aria-label="THE BOX referee scoreboard" style={{
            width: '100vw', height: '100vh',
            background: BG, color: WHITE,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', fontFamily: RM,
            position: 'relative',
            backgroundImage: `
                radial-gradient(ellipse 80% 50% at 18% 60%, ${teamAColor}1a 0%, transparent 60%),
                radial-gradient(ellipse 80% 50% at 82% 60%, ${teamBColor}1a 0%, transparent 60%),
                radial-gradient(ellipse 80% 60% at 50% 12%, rgba(255,255,255,0.04) 0%, transparent 60%)
            `,
        }}>
            {/* Visually-hidden H1 — screen readers announce the page; sighted users see the scoreboard */}
            <h1 style={{
                position: 'absolute',
                width: 1, height: 1,
                padding: 0, margin: -1,
                overflow: 'hidden', clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap', border: 0,
            }}>
                {teamA.name} {teamA.score} versus {teamB.name} {teamB.score} — {periodLabel(clock.period, clock.totalPeriods)}, {fmt(clock.gameMs)}
            </h1>

            {/* Hairline period progress at top edge */}
            <PeriodProgress clock={clock} />

            {/* ═══ TOP BAR ════════════════════════════════════ */}
            <div style={{
                height: 52, flexShrink: 0,
                display: 'flex', alignItems: 'center',
                padding: '0 18px', gap: 10,
                zIndex: 3,
                borderBottom: `1px solid ${BDR}`,
            }}>
                {/* Brand mark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 16, background: RED, borderRadius: 1.5, boxShadow: `0 0 8px ${RED}aa` }} />
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 15, color: WHITE, letterSpacing: '0.06em',
                    }}>THE BOX</span>
                </div>

                <span style={{ width: 1, height: 14, background: BDR_HI }} />

                {/* Connection */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: isConnected ? GREEN : RED,
                        boxShadow: `0 0 6px ${isConnected ? GREEN : RED}99`,
                    }} />
                    <span style={{
                        fontFamily: RM, fontSize: 8, color: DIM,
                        letterSpacing: '0.22em', fontWeight: 700,
                    }}>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
                </div>

                {/* Game code chip */}
                {gameCode && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px',
                        border: `1px solid ${BDR_HI}`, borderRadius: 999,
                        background: 'rgba(255,255,255,0.018)',
                    }}>
                        <span style={{ fontFamily: RM, fontSize: 7, color: DIM, letterSpacing: '0.22em', fontWeight: 700 }}>CODE</span>
                        <span style={{ fontFamily: RM, fontSize: 9, color: WHITE, letterSpacing: '0.18em', fontWeight: 700 }}>
                            {gameCode.toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Game mode chip */}
                {gameMode && (
                    <div style={{
                        padding: '3px 8px', borderRadius: 999,
                        border: `1px solid ${(gameMode === 'advanced' ? '#8B5CF6' : gameMode === 'stats' ? '#3B82F6' : AMBER)}66`,
                        background: `${(gameMode === 'advanced' ? '#8B5CF6' : gameMode === 'stats' ? '#3B82F6' : AMBER)}1a`,
                        fontFamily: RM, fontSize: 8, fontWeight: 800,
                        letterSpacing: '0.22em', textTransform: 'uppercase',
                        color: gameMode === 'advanced' ? '#8B5CF6' : gameMode === 'stats' ? '#3B82F6' : AMBER,
                    }}>{gameMode}</div>
                )}

                <div style={{ flex: 1 }} />

                {/* Action buttons — CAST/HW are icon-only so the header fits 1024px */}
                <HeaderBtn label="CAST"     icon={<IconCast />} onClick={onCast}            iconOnly />
                <HeaderBtn label="HARDWARE" icon={<IconHW />}   onClick={onConnectHardware} iconOnly />
                <HeaderBtn label="SETTINGS" icon={<IconGear />} onClick={onSettings} accent={AMBER} />
                {onEndGame && (
                    <HeaderBtn label="END" icon={<IconStop />} onClick={onEndGame} accent={RED} />
                )}
                {showTouchAffordance && (
                    <HeaderBtn label="OPEN TOUCH" icon={<IconUnlock />} onClick={onUnlockTouchScoring} accent={GREEN} filled />
                )}
            </div>

            {/* ═══ HERO — single scoreboard frame ═══════════════ */}
            <div style={{
                flex: 1, minHeight: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '14px 22px',
                paddingBottom: showTouchAffordance ? 56 : 14, // leave room for pull tab
            }}>
                <div style={{
                    width: '100%', height: '100%',
                    maxWidth: 1280,
                    background: `linear-gradient(180deg, ${SURFACE_HI} 0%, ${SURFACE} 100%)`,
                    border: `1px solid ${BDR}`,
                    borderRadius: 24,
                    boxShadow: `
                        0 24px 60px rgba(0,0,0,0.6),
                        0 0 0 1px rgba(255,255,255,0.02),
                        inset 0 1px 0 rgba(255,255,255,0.04),
                        inset 0 -1px 0 rgba(0,0,0,0.4)
                    `,
                    display: 'flex',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Top edge highlight — subtle "stadium light" sweep */}
                    <div style={{
                        position: 'absolute', top: 0, left: '10%', right: '10%',
                        height: 60,
                        background: 'radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    <TeamColumn
                        side="A"
                        team={teamA} color={teamAColor}
                        hasPossession={possession === 'A'}
                        inBonus={inBonusA}
                        timeoutsPerBucket={timeoutsPerBucket}
                    />
                    <CenterColumn clock={clock} bucketName={bucketName} />
                    <TeamColumn
                        side="B"
                        team={teamB} color={teamBColor}
                        hasPossession={possession === 'B'}
                        inBonus={inBonusB}
                        timeoutsPerBucket={timeoutsPerBucket}
                    />
                </div>
            </div>

            {/* Pull-up tab — gated on touch-deck pref */}
            {showTouchAffordance && (
                <UnlockTab onClick={onUnlockTouchScoring} />
            )}

            {/* UNDO flash */}
            {undoVisible && (
                <div style={{
                    position: 'absolute', inset: 0,
                    pointerEvents: 'none', zIndex: 6,
                    background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.16) 0%, transparent 70%)',
                    animation: 'msbUndo 0.7s ease-out forwards',
                }}>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '10px 22px',
                        border: `1px solid ${AMBER}aa`,
                        background: `${AMBER}22`,
                        borderRadius: 999,
                        boxShadow: `0 0 24px ${AMBER}66`,
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 26, color: AMBER, letterSpacing: '0.16em',
                    }}>UNDO</div>
                </div>
            )}

            {/* SETTINGS flash */}
            {settingsVisible && (
                <div style={{
                    position: 'absolute', inset: 0,
                    pointerEvents: 'none', zIndex: 6,
                    background: `radial-gradient(ellipse at center, ${settingsFlash ? GREEN : RED}1a 0%, transparent 70%)`,
                    animation: 'msbUndo 0.9s ease-out forwards',
                }}>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '10px 22px',
                        border: `1px solid ${(settingsFlash ? GREEN : RED)}aa`,
                        background: `${(settingsFlash ? GREEN : RED)}22`,
                        borderRadius: 999,
                        boxShadow: `0 0 24px ${(settingsFlash ? GREEN : RED)}77`,
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 20, color: settingsFlash ? GREEN : RED, letterSpacing: '0.16em',
                    }}>{settingsFlash ? 'TOUCH UNLOCKED' : 'TOUCH LOCKED'}</div>
                </div>
            )}

            <style>{`
                @keyframes msbDot       { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
                @keyframes msbShotPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
                @keyframes msbShotBlink { 0%, 100% { opacity: 1; transform: scale(1.03); } 50% { opacity: 0.45; transform: scale(1); } }
                @keyframes msbBob       { 0%, 100% { transform: translateX(-50%) translateY(-3px); } 50% { transform: translateX(-50%) translateY(-7px); } }
                @keyframes msbUndo      { 0% { opacity: 1; } 100% { opacity: 0; } }
                @media (prefers-reduced-motion: reduce) {
                    *, *::before, *::after {
                        animation-duration: 0.001ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.001ms !important;
                    }
                }
            `}</style>
        </main>
    );
};

export default LockedScoreboardMinimal;
