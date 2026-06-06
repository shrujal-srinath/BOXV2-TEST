// src/components/refereebox/PiTouchScoringScreenMinimal.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — Minimal-Theme Touch Scoring Deck (Waveshare 7", 1024×600)
//
// Mirrors PiTouchScoringScreen.tsx feature-for-feature so it can be
// dropped in whenever the user has the minimal scoreboard theme on.
// Visual language is shared with LockedScoreboardMinimal v3:
//   • Editorial broadcast aesthetic, pill chips, calm gradients
//   • Team-color ribbons along the outer edges
//   • Single sealed scoreboard frame on top
//   • Tactile slap buttons with soft glow on press
//
// All control affordances preserved:
//   • +1 / +2 / +3 large; −1 / FOUL / TIMEOUT secondary
//   • POSSESSION row, SHOT CLOCK 24 / 14, HORN, NEXT PERIOD
//   • Game-clock START / STOP slab (and tap-to-toggle on the time)
//   • Header CAST / HARDWARE / SETTINGS / END / BACK TO SCORING
//   • Minimize-header pref support (collapses to a single ⚙)
// ═══════════════════════════════════════════════════════════════

import React from 'react';
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

// ── Tokens (shared with LockedScoreboardMinimal) ──────────────
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

// ── Icons ────────────────────────────────────────────────────
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
const IconBack = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

// ══════════════════════════════════════════════════════════════
// HEADER PILL BUTTON
// ══════════════════════════════════════════════════════════════
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
                transition: `background 200ms ${EASE}, transform 200ms ${EASE}`,
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

// ══════════════════════════════════════════════════════════════
// SCORE / ACTION SLAP BUTTON — soft glow on press, no FUI corners
// ══════════════════════════════════════════════════════════════
const SlapBtn: React.FC<{
    label: string;
    sub?: string;
    color: string;
    onClick: () => void;
    primary?: boolean;
    disabled?: boolean;
}> = ({ label, sub, color, onClick, primary, disabled }) => (
    <button
        onClick={disabled ? undefined : onClick}
        style={{
            appearance: 'none',
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 2,
            background: primary
                ? `linear-gradient(180deg, ${color}33 0%, ${color}11 60%, ${color}06 100%)`
                : `linear-gradient(180deg, ${color}18 0%, ${color}08 100%)`,
            border: `1px solid ${color}${primary ? '88' : '55'}`,
            borderRadius: 16,
            color,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.35 : 1,
            userSelect: 'none', WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.12s, transform 0.06s, box-shadow 0.12s',
            boxShadow: primary
                ? `inset 0 1px 0 ${color}55, 0 8px 22px rgba(0,0,0,0.4), 0 0 18px ${color}1a`
                : `inset 0 1px 0 ${color}33, 0 4px 12px rgba(0,0,0,0.32)`,
        }}
        onPointerDown={e => {
            if (disabled) return;
            (e.currentTarget as HTMLElement).style.background =
                `linear-gradient(180deg, ${color}66 0%, ${color}33 100%)`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
            (e.currentTarget as HTMLElement).style.boxShadow =
                `0 0 32px ${color}aa, inset 0 1px 0 ${color}88`;
        }}
        onPointerUp={e => {
            (e.currentTarget as HTMLElement).style.background = primary
                ? `linear-gradient(180deg, ${color}33 0%, ${color}11 60%, ${color}06 100%)`
                : `linear-gradient(180deg, ${color}18 0%, ${color}08 100%)`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.boxShadow = primary
                ? `inset 0 1px 0 ${color}55, 0 8px 22px rgba(0,0,0,0.4), 0 0 18px ${color}1a`
                : `inset 0 1px 0 ${color}33, 0 4px 12px rgba(0,0,0,0.32)`;
        }}
        onPointerLeave={e => {
            (e.currentTarget as HTMLElement).style.background = primary
                ? `linear-gradient(180deg, ${color}33 0%, ${color}11 60%, ${color}06 100%)`
                : `linear-gradient(180deg, ${color}18 0%, ${color}08 100%)`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >
        <span style={{
            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: primary ? 46 : 22, lineHeight: 0.9,
            letterSpacing: '-0.02em',
            textShadow: primary ? `0 0 18px ${color}aa, 0 0 6px ${color}cc` : `0 0 8px ${color}66`,
        }}>{label}</span>
        {sub && (
            <span style={{
                fontFamily: RM, fontSize: primary ? 8 : 7, fontWeight: 800,
                color: primary ? color : `${color}cc`,
                letterSpacing: '0.26em', textTransform: 'uppercase',
                opacity: 0.92,
            }}>{sub}</span>
        )}
    </button>
);

// Tiny utility chip — for ± foul, ± TO inline. Sized for finger taps (32px tall).
const MicroBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => (
    <button
        onClick={onClick}
        style={{
            appearance: 'none',
            padding: '0 12px', height: 44, minWidth: 56,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${color}66`,
            background: 'rgba(255,255,255,0.025)',
            color,
            fontFamily: RM, fontSize: 9, fontWeight: 800,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            borderRadius: 999,
            cursor: 'pointer',
            userSelect: 'none', WebkitTapHighlightColor: 'transparent',
            transition: `background 200ms ${EASE}, transform 200ms ${EASE}`,
        }}
        onPointerDown={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.94)';
            (e.currentTarget as HTMLElement).style.background = `${color}28`;
        }}
        onPointerUp={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
        }}
        onPointerLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
        }}
    >{label}</button>
);

// Timeout pips (round, matches scoreboard)
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

// ══════════════════════════════════════════════════════════════
// HERO — compact scoreboard band on top of the deck
// ══════════════════════════════════════════════════════════════
const HeroBand: React.FC<{
    teamA: TeamState; teamB: TeamState;
    teamAColor: string; teamBColor: string;
    clock: ClockState;
    possession: 'A' | 'B' | null;
    bucketName: string;
    sendAction: Props['sendAction'];
}> = ({ teamA, teamB, teamAColor, teamBColor, clock, possession, bucketName, sendAction }) => {
    const live = clock.isRunning;
    const shotMs = clock.shotMs ?? 0;
    const shotZero = shotMs === 0;
    const shotLow = !shotZero && shotMs <= 5000;
    const shotAlert = shotZero || shotLow;
    const shotColor = shotAlert ? RED : ORANGE;
    const canToggle = clock.gameMs > 0;

    const TeamSide: React.FC<{
        side: 'A' | 'B'; team: TeamState; color: string;
        hasPoss: boolean;
    }> = ({ side, team, color, hasPoss }) => {
        const isLeft = side === 'A';
        return (
            <div style={{
                flex: 1, position: 'relative',
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                padding: isLeft ? '10px 16px 10px 20px' : '10px 20px 10px 16px',
                overflow: 'hidden',
            }}>
                {/* Outer ribbon */}
                <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    [isLeft ? 'left' : 'right']: 0,
                    width: 4,
                    background: `linear-gradient(180deg, ${color} 0%, ${color}aa 50%, ${color} 100%)`,
                    boxShadow: `0 0 16px ${color}88`,
                }} />
                <div style={{
                    position: 'absolute',
                    [isLeft ? 'right' : 'left']: -80, top: '40%',
                    transform: 'translateY(-50%)',
                    width: 200, height: 200,
                    background: `radial-gradient(circle, ${color}28 0%, transparent 65%)`,
                    pointerEvents: 'none', filter: 'blur(6px)',
                }} />

                {/* Top — label + ball chip */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    flexDirection: isLeft ? 'row' : 'row-reverse',
                    position: 'relative', zIndex: 1,
                }}>
                    <span style={{
                        fontFamily: RM, fontSize: 7, fontWeight: 800,
                        color: MUTED, letterSpacing: '0.4em',
                    }}>{isLeft ? 'HOME' : 'AWAY'}</span>
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 16, color: WHITE, letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: 180,
                    }}>{team.name || (isLeft ? 'TEAM A' : 'TEAM B')}</span>
                    {hasPoss && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '2px 6px',
                            border: `1px solid ${color}aa`,
                            background: `${color}1f`,
                            borderRadius: 100,
                        }}>
                            <div style={{
                                width: 4, height: 4, borderRadius: '50%',
                                background: color,
                                animation: 'mtdDot 1.1s infinite',
                            }} />
                            <span style={{
                                fontFamily: RM, fontSize: 6, fontWeight: 800,
                                color, letterSpacing: '0.2em',
                            }}>BALL</span>
                        </div>
                    )}
                </div>

                {/* Big score */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: isLeft ? 'flex-end' : 'flex-start',
                    position: 'relative', zIndex: 1,
                    paddingRight: isLeft ? 8 : 0,
                    paddingLeft: isLeft ? 0 : 8,
                }}>
                    <span style={{
                        fontFamily: OSW, fontWeight: 700,
                        fontSize: 'clamp(72px, 11vw, 110px)',
                        lineHeight: 0.82, color: WHITE,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.05em',
                        textShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 32px ${color}44`,
                    }}>{team.score}</span>
                </div>
            </div>
        );
    };

    return (
        <div style={{
            flexShrink: 0,
            display: 'flex',
            background: `linear-gradient(180deg, ${SURFACE_HI} 0%, ${SURFACE} 100%)`,
            border: `1px solid ${BDR}`,
            borderRadius: 18,
            boxShadow: `
                0 12px 32px rgba(0,0,0,0.55),
                inset 0 1px 0 rgba(255,255,255,0.04),
                inset 0 -1px 0 rgba(0,0,0,0.4)
            `,
            overflow: 'hidden',
            position: 'relative',
            height: 160,
        }}>
            <TeamSide side="A" team={teamA} color={teamAColor} hasPoss={possession === 'A'} />

            {/* Center clock — tappable */}
            <div
                onClick={() => { if (canToggle) sendAction('CLOCK_TOGGLE'); }}
                style={{
                    width: 240, flexShrink: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderLeft: `1px solid ${BDR}`,
                    borderRight: `1px solid ${BDR}`,
                    cursor: canToggle ? 'pointer' : 'default',
                    userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.18s',
                    background: live ? `${GREEN}05` : 'transparent',
                }}
                onPointerDown={e => { if (canToggle) (e.currentTarget as HTMLElement).style.transform = 'scale(0.99)'; }}
                onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
                {/* Period chip */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '3px 9px',
                    border: `1px solid ${BDR_HI}`,
                    background: 'rgba(255,255,255,0.025)',
                    borderRadius: 100,
                }}>
                    <div style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: live ? GREEN : AMBER,
                        boxShadow: live ? `0 0 6px ${GREEN}` : 'none',
                        animation: live ? 'mtdDot 1.1s infinite' : 'none',
                    }} />
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 12, color: WHITE, letterSpacing: '0.08em',
                    }}>{periodLabel(clock.period, clock.totalPeriods)}</span>
                    <span style={{ width: 1, height: 9, background: BDR_HI }} />
                    <span style={{
                        fontFamily: RM, fontSize: 6, fontWeight: 800,
                        color: DIM, letterSpacing: '0.22em',
                    }}>{bucketName}</span>
                </div>

                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                    <span style={{
                        fontFamily: OSW, fontWeight: 700,
                        fontSize: 60, lineHeight: 0.9, color: WHITE,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.04em',
                        textShadow: live ? '0 0 22px rgba(255,255,255,0.32)' : '0 0 4px rgba(255,255,255,0.08)',
                    }}>{fmt(clock.gameMs)}</span>
                    {canToggle && (
                        <span style={{
                            fontFamily: RM, fontSize: 7, fontWeight: 800,
                            color: live ? `${GREEN}cc` : `${WHITE}55`,
                            letterSpacing: '0.32em', textTransform: 'uppercase',
                        }}>{live ? '· TAP TO STOP ·' : '· TAP TO START ·'}</span>
                    )}
                </div>

                {/* Shot clock pill */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '4px 12px',
                    border: `1px solid ${shotAlert ? shotColor : BDR_HI}`,
                    background: shotAlert ? `${shotColor}18` : 'rgba(255,255,255,0)',
                    borderRadius: 999,
                    boxShadow: shotAlert ? `0 0 18px ${shotColor}66` : 'none',
                    animation: shotZero ? 'mtdShotBlink 0.45s infinite' : shotLow ? 'mtdShotPulse 0.5s infinite' : 'none',
                    minWidth: 130,
                    justifyContent: 'center',
                }}>
                    <span style={{
                        fontFamily: RM, fontSize: 7, fontWeight: 800,
                        letterSpacing: '0.3em', color: shotAlert ? shotColor : DIM,
                        textTransform: 'uppercase',
                    }}>{shotZero ? 'RESET' : 'SHOT'}</span>
                    <span style={{
                        fontFamily: OSW, fontWeight: 700,
                        fontSize: 22, lineHeight: 1, color: shotColor,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.02em',
                        textShadow: `0 0 12px ${shotColor}88`,
                    }}>{fmtShot(shotMs)}</span>
                </div>
            </div>

            <TeamSide side="B" team={teamB} color={teamBColor} hasPoss={possession === 'B'} />
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// CONTROL DECK — left team buttons | center control | right team
// ══════════════════════════════════════════════════════════════
const TeamControls: React.FC<{
    align: 'left' | 'right';
    team: TeamState; color: string; teamKey: 'A' | 'B';
    bonus: boolean; timeoutsPerBucket: number;
    sendAction: Props['sendAction'];
}> = ({ align, team, color, teamKey, bonus, timeoutsPerBucket, sendAction }) => {
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
            gap: 8, padding: 10,
            background: `linear-gradient(${align === 'left' ? '90deg' : '270deg'}, ${color}06 0%, transparent 80%)`,
            border: `1px solid ${BDR}`,
            borderRadius: 18,
            position: 'relative',
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 20px rgba(0,0,0,0.4)`,
        }}>
            {/* Header strip — side label, ± foul, + TO inline */}
            <div style={{
                display: 'flex',
                flexDirection: align === 'left' ? 'row' : 'row-reverse',
                alignItems: 'center', gap: 8,
            }}>
                <div style={{
                    width: 3, height: 14, background: color,
                    boxShadow: `0 0 8px ${color}aa`, borderRadius: 1,
                }} />
                <span style={{
                    fontFamily: RM, fontSize: 8, color: DIM,
                    letterSpacing: '0.32em', fontWeight: 800,
                }}>{align === 'left' ? 'HOME' : 'AWAY'}</span>
                <span style={{
                    fontFamily: RM, fontSize: 7, color: MUTED,
                    letterSpacing: '0.22em', fontWeight: 700,
                }}>· F {team.fouls} {bonus ? '· BONUS' : ''}</span>
                <div style={{ flex: 1 }} />
                <MicroBtn label="− F" color="rgba(239,68,68,0.7)" onClick={subFoul} />
                <MicroBtn label="+ TO" color="rgba(245,158,11,0.7)" onClick={addTO} />
            </div>

            {/* Primary scoring row — +1 / +2 / +3 */}
            <div style={{
                flex: 1, minHeight: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
            }}>
                <SlapBtn label="+1" sub="FT"    color={color} onClick={() => score(1)} primary />
                <SlapBtn label="+2" sub="MADE 2" color={color} onClick={() => score(2)} primary />
                <SlapBtn label="+3" sub="MADE 3" color={color} onClick={() => score(3)} primary />
            </div>

            {/* Secondary row — −1 / FOUL / TIMEOUT */}
            <div style={{
                height: 62, flexShrink: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
            }}>
                <SlapBtn label="−1"      sub="UNDO"                       color="#9CA3AF" onClick={subOne} />
                <SlapBtn label="FOUL"    sub={`+1 · ${team.fouls}`}        color={bonus ? ORANGE : RED} onClick={addFoul} />
                <SlapBtn
                    label="T-OUT"
                    sub={`${team.timeouts}/${Math.max(timeoutsPerBucket, team.timeouts)}`}
                    color={AMBER} onClick={useTO}
                    disabled={team.timeouts <= 0}
                />
            </div>

            {/* Timeout pip strip — visual reinforcement */}
            <div style={{
                display: 'flex',
                justifyContent: align === 'left' ? 'flex-start' : 'flex-end',
                paddingTop: 2,
            }}>
                <TimeoutPips
                    remaining={team.timeouts}
                    total={Math.max(timeoutsPerBucket, team.timeouts)}
                    color={color}
                />
            </div>
        </div>
    );
};

const CenterControls: React.FC<{
    possession: 'A' | 'B' | null;
    teamAColor: string; teamBColor: string;
    clock: ClockState;
    sendAction: Props['sendAction'];
}> = ({ possession, teamAColor, teamBColor, clock, sendAction }) => {
    const isRunning = clock.isRunning;
    const periodOver = clock.gameMs === 0;
    const onLastPeriod = clock.period >= clock.totalPeriods;
    const startStopColor = isRunning ? RED : GREEN;
    const startStopLabel = isRunning ? 'STOP' : 'START';

    const PossPill: React.FC<{ label: string; color: string; active: boolean; onClick: () => void }> = ({
        label, color, active, onClick,
    }) => (
        <button
            onClick={onClick}
            style={{
                appearance: 'none',
                flex: 1, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${active ? color : `${color}55`}`,
                background: active
                    ? `linear-gradient(180deg, ${color}33 0%, ${color}11 100%)`
                    : 'rgba(255,255,255,0.02)',
                color: active ? color : `${color}aa`,
                fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                fontSize: 14, letterSpacing: '0.16em', textTransform: 'uppercase',
                borderRadius: 100,
                cursor: 'pointer', userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: active ? `0 0 14px ${color}55, inset 0 1px 0 ${color}33` : 'none',
                transition: `background 200ms ${EASE}, transform 200ms ${EASE}, color 200ms ${EASE}`,
            }}
            onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
            onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            onPointerLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >{label}</button>
    );

    return (
        <div style={{
            width: 240, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            gap: 8, padding: 10,
            border: `1px solid ${BDR}`,
            borderRadius: 18,
            background: `linear-gradient(180deg, ${SURFACE_HI} 0%, ${SURFACE} 100%)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 22px rgba(0,0,0,0.45)`,
        }}>
            {/* GAME CLOCK START / STOP */}
            <span style={{
                fontFamily: RM, fontSize: 7, color: MUTED,
                letterSpacing: '0.36em', fontWeight: 800,
                textAlign: 'center', textTransform: 'uppercase',
            }}>GAME CLOCK</span>
            {periodOver ? (
                <button
                    onClick={() => sendAction('NEXT_PERIOD', onLastPeriod ? { forceOT: true } : {})}
                    style={{
                        appearance: 'none',
                        height: 60,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 2,
                        border: `1px solid ${AMBER}aa`,
                        background: `linear-gradient(180deg, ${AMBER}33 0%, ${AMBER}11 100%)`,
                        boxShadow: `0 0 18px ${AMBER}55, inset 0 1px 0 ${AMBER}55`,
                        borderRadius: 14,
                        color: AMBER,
                        cursor: 'pointer', userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'transform 0.06s',
                    }}
                    onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                    <span style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 18, color: AMBER, lineHeight: 1,
                        textShadow: `0 0 10px ${AMBER}aa`,
                    }}>{onLastPeriod ? '+ OT' : 'NEXT PERIOD'}</span>
                    <span style={{
                        fontFamily: RM, fontSize: 7, color: `${AMBER}cc`,
                        letterSpacing: '0.22em', fontWeight: 800,
                    }}>PERIOD ENDED</span>
                </button>
            ) : (
                <button
                    onClick={() => sendAction('CLOCK_TOGGLE')}
                    style={{
                        appearance: 'none',
                        height: 60,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        border: `1px solid ${startStopColor}aa`,
                        background: `linear-gradient(180deg, ${startStopColor}33 0%, ${startStopColor}0d 100%)`,
                        boxShadow: `0 0 18px ${startStopColor}55, inset 0 1px 0 ${startStopColor}55`,
                        borderRadius: 14,
                        color: startStopColor,
                        cursor: 'pointer', userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'transform 0.06s',
                    }}
                    onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                    onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
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
                        fontSize: 22, color: startStopColor, lineHeight: 1,
                        letterSpacing: '0.12em',
                        textShadow: `0 0 10px ${startStopColor}aa`,
                    }}>{startStopLabel}</span>
                </button>
            )}

            {/* POSSESSION */}
            <span style={{
                fontFamily: RM, fontSize: 7, color: MUTED,
                letterSpacing: '0.36em', fontWeight: 800,
                textAlign: 'center', textTransform: 'uppercase',
                marginTop: 2,
            }}>POSSESSION</span>
            <div style={{ display: 'flex', gap: 6 }}>
                <PossPill
                    label="◀ HOME"
                    color={teamAColor}
                    active={possession === 'A'}
                    onClick={() => sendAction('SET_POSSESSION', { team: 'A' })}
                />
                <PossPill
                    label="AWAY ▶"
                    color={teamBColor}
                    active={possession === 'B'}
                    onClick={() => sendAction('SET_POSSESSION', { team: 'B' })}
                />
            </div>

            {/* SHOT CLOCK 24 / 14 */}
            <span style={{
                fontFamily: RM, fontSize: 7, color: MUTED,
                letterSpacing: '0.36em', fontWeight: 800,
                textAlign: 'center', textTransform: 'uppercase',
                marginTop: 2,
            }}>SHOT CLOCK</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                    onClick={() => sendAction('SET_SHOT_CLOCK', { ms: 24000 })}
                    style={{
                        appearance: 'none',
                        height: 48,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${GREEN}77`,
                        background: `${GREEN}10`,
                        borderRadius: 12,
                        color: GREEN,
                        cursor: 'pointer', userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'transform 0.06s',
                    }}
                    onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)'; }}
                    onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                    <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 18, lineHeight: 1 }}>24</span>
                    <span style={{ fontFamily: RM, fontSize: 6, opacity: 0.7, letterSpacing: '0.2em', fontWeight: 800 }}>NEW POSS</span>
                </button>
                <button
                    onClick={() => sendAction('SET_SHOT_CLOCK', { ms: 14000 })}
                    style={{
                        appearance: 'none',
                        height: 48,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${AMBER}77`,
                        background: `${AMBER}10`,
                        borderRadius: 12,
                        color: AMBER,
                        cursor: 'pointer', userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'transform 0.06s',
                    }}
                    onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)'; }}
                    onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                >
                    <span style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 18, lineHeight: 1 }}>14</span>
                    <span style={{ fontFamily: RM, fontSize: 6, opacity: 0.7, letterSpacing: '0.2em', fontWeight: 800 }}>OFF REB</span>
                </button>
            </div>

            {/* HORN */}
            <button
                onClick={() => sendAction('TRIGGER_BUZZER', { type: 'SHORT' })}
                style={{
                    appearance: 'none',
                    flex: 1, minHeight: 56,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    border: `1px solid ${ORANGE}88`,
                    background: `linear-gradient(180deg, ${ORANGE}22 0%, ${ORANGE}06 100%)`,
                    borderRadius: 14,
                    color: ORANGE,
                    cursor: 'pointer', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    boxShadow: `inset 0 1px 0 ${ORANGE}33, 0 0 16px ${ORANGE}22`,
                    transition: 'transform 0.06s',
                    marginTop: 4,
                }}
                onPointerDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={ORANGE} />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 16, color: ORANGE,
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                }}>HORN</span>
            </button>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
const PiTouchScoringScreenMinimal: React.FC<Props> = ({
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
        <main role="main" aria-label="THE BOX referee touch deck" style={{
            width: '100vw', height: '100vh',
            background: BG, color: WHITE,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', fontFamily: RM,
            position: 'relative',
            backgroundImage: `
                radial-gradient(ellipse 80% 50% at 18% 60%, ${teamAColor}14 0%, transparent 60%),
                radial-gradient(ellipse 80% 50% at 82% 60%, ${teamBColor}14 0%, transparent 60%),
                radial-gradient(ellipse 80% 60% at 50% 12%, rgba(255,255,255,0.035) 0%, transparent 60%)
            `,
            padding: minHeader ? '6px 14px 14px' : '0',
        }}>
            {/* Visually-hidden H1 for screen readers + landmark a11y compliance */}
            <h1 style={{
                position: 'absolute',
                width: 1, height: 1,
                padding: 0, margin: -1,
                overflow: 'hidden', clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap', border: 0,
            }}>
                Touch scoring deck — {teamA.name} {teamA.score} vs {teamB.name} {teamB.score}
            </h1>

            {/* ═══ HEADER ════════════════════════════════════════ */}
            {minHeader ? (
                <div style={{
                    height: 28, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: 6, paddingBottom: 4,
                }}>
                    <div style={{
                        width: 5, height: 5, marginRight: 6,
                        background: live ? GREEN : AMBER, borderRadius: '50%',
                        boxShadow: `0 0 6px ${live ? GREEN : AMBER}aa`,
                        animation: live ? 'mtdDot 1.1s infinite' : 'none',
                    }} />
                    <HeaderBtn label="SETTINGS" icon={<IconGear />} onClick={onSettings} accent={AMBER} />
                    <HeaderBtn label="BACK"     icon={<IconBack />} onClick={onClose}   accent={GREEN} filled />
                </div>
            ) : (
                <div style={{
                    height: 52, flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                    padding: '0 18px', gap: 10,
                    borderBottom: `1px solid ${BDR}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 16, background: AWAY_C, borderRadius: 1.5, boxShadow: `0 0 8px ${AWAY_C}aa` }} />
                        <span style={{
                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                            fontSize: 15, color: WHITE, letterSpacing: '0.06em',
                        }}>THE BOX</span>
                    </div>

                    <span style={{ width: 1, height: 14, background: BDR_HI }} />

                    {/* LIVE / PAUSED */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '3px 9px',
                        border: `1px solid ${(live ? GREEN : AMBER)}55`,
                        background: `${(live ? GREEN : AMBER)}14`,
                        borderRadius: 999,
                    }}>
                        <div style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: live ? GREEN : AMBER,
                            boxShadow: live ? `0 0 6px ${GREEN}` : 'none',
                            animation: live ? 'mtdDot 1.1s infinite' : 'none',
                        }} />
                        <span style={{
                            fontFamily: RM, fontSize: 8, fontWeight: 800,
                            letterSpacing: '0.22em', color: live ? GREEN : AMBER,
                            textTransform: 'uppercase',
                        }}>{live ? 'LIVE' : 'PAUSED'}</span>
                    </div>

                    {/* TOUCH ACTIVE */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '3px 9px',
                        border: `1px solid ${GREEN}88`,
                        background: `${GREEN}1a`,
                        borderRadius: 999,
                        boxShadow: `0 0 10px ${GREEN}33`,
                    }}>
                        <div style={{ width: 5, height: 5, background: GREEN, borderRadius: '50%', animation: 'mtdDot 1.1s infinite' }} />
                        <span style={{
                            fontFamily: RM, fontSize: 8, fontWeight: 800,
                            color: GREEN, letterSpacing: '0.22em', textTransform: 'uppercase',
                        }}>TOUCH</span>
                    </div>

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

                    <div style={{ flex: 1 }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 4 }}>
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

                    <HeaderBtn label="CAST"     icon={<IconCast />} onClick={onCast}            iconOnly />
                    <HeaderBtn label="HARDWARE" icon={<IconHW />}   onClick={onConnectHardware} iconOnly />
                    <HeaderBtn label="SETTINGS" icon={<IconGear />} onClick={onSettings} accent={AMBER} />
                    {onEndGame && (
                        <HeaderBtn label="END" icon={<IconStop />} onClick={onEndGame} accent={RED} />
                    )}
                    <HeaderBtn label="BACK TO SCORING" icon={<IconBack />} onClick={onClose} accent={GREEN} filled />
                </div>
            )}

            {/* ═══ MAIN — HERO band + CONTROL deck ═══════════════ */}
            <div style={{
                flex: 1, minHeight: 0,
                display: 'flex', flexDirection: 'column',
                gap: 10,
                padding: minHeader ? 0 : '10px 14px 14px',
            }}>
                {/* HERO band */}
                <HeroBand
                    teamA={teamA} teamB={teamB}
                    teamAColor={teamAColor} teamBColor={teamBColor}
                    clock={clock} possession={possession}
                    bucketName={bucketName}
                    sendAction={sendAction}
                />

                {/* CONTROL deck — 3 columns */}
                <div style={{
                    flex: 1, minHeight: 0,
                    display: 'flex', gap: 10,
                }}>
                    <TeamControls
                        align="left"
                        team={teamA} color={teamAColor} teamKey="A"
                        bonus={inBonusA} timeoutsPerBucket={timeoutsPerBucket}
                        sendAction={sendAction}
                    />
                    <CenterControls
                        possession={possession}
                        teamAColor={teamAColor} teamBColor={teamBColor}
                        clock={clock}
                        sendAction={sendAction}
                    />
                    <TeamControls
                        align="right"
                        team={teamB} color={teamBColor} teamKey="B"
                        bonus={inBonusB} timeoutsPerBucket={timeoutsPerBucket}
                        sendAction={sendAction}
                    />
                </div>
            </div>

            <style>{`
                @keyframes mtdDot       { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
                @keyframes mtdShotPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
                @keyframes mtdShotBlink { 0%, 100% { opacity: 1; transform: scale(1.04); } 50% { opacity: 0.4; transform: scale(1); } }
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

export default PiTouchScoringScreenMinimal;
