// src/components/refereebox/GameReviewScreen.tsx
// MATCH PRE-FLIGHT CHECK — shown after roster setup. The referee verifies all
// match parameters AND system readiness (rosters, hardware link) before locking
// in. Reframed from a passive summary into a real go/no-go checklist.
// Renders as a centered dialog over a dark backdrop.

import React from 'react';
import type { GameConfig, Player } from '../../hooks/useRefereeBox';

type ReviewConfig = GameConfig & { playersA?: Player[]; playersB?: Player[] };

interface GameReviewScreenProps {
    config: ReviewConfig;
    onConfirm: () => void;
    onBack: () => void;
    /** Live hardware-daemon link status (drives the HARDWARE pre-flight item). */
    isConnected?: boolean;
}

// ── Shared elevation tokens (match MatchSetup / RosterSetup) ───
const SURFACE  = '#161618';   // modal body
const SURFACE2 = '#202023';   // inner cards / pills
const SURFACE3 = '#2A2A2E';
const BDR      = 'rgba(255,255,255,0.16)';
const BDR_DIM  = 'rgba(255,255,255,0.08)';
const TXT      = '#F4F4F5';
const TXT_DIM  = '#A1A1AA';
const TXT_MUT  = '#71717A';
const GREEN    = '#22C55E';
const AMBER    = '#F59E0B';
const RED      = '#EF4444';

const RM  = "'JetBrains Mono', monospace";
const OSW = "'Oswald', sans-serif";
const SG  = "'Space Grotesk', sans-serif";
const MAX_PLAYERS = 12;

// ── Period label helper ───────────────────────────────────────
function periodLabel(periods: number, minutes: number, type: 'quarter' | 'half'): string {
    const unit = type === 'half' ? 'HALVES' : periods === 2 ? 'HALVES' : 'QUARTERS';
    return `${periods}×${minutes} MIN ${unit}`;
}

// ── Status icons ──────────────────────────────────────────────
const IconCheck = ({ c = GREEN }: { c?: string }) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);
const IconWarn = ({ c = AMBER }: { c?: string }) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);
const IconCross = ({ c = RED }: { c?: string }) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

// ── Mode chip ─────────────────────────────────────────────────
function ModeChip({ mode }: { mode: string }) {
    const map: Record<string, { label: string; color: string }> = {
        quick:    { label: 'QUICK',    color: '#F59E0B' },
        stats:    { label: 'STATS',    color: '#3B82F6' },
        advanced: { label: 'ADVANCED', color: '#8B5CF6' },
    };
    const { label, color } = map[mode] ?? { label: mode.toUpperCase(), color: '#888' };
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            border: `1px solid ${color}66`,
            background: `${color}18`,
            borderRadius: 4,
            padding: '6px 12px',
        }}>
            <div style={{ width: 6, height: 6, background: color, flexShrink: 0, borderRadius: 1 }} />
            <span style={{ fontFamily: RM, fontSize: 10, color, letterSpacing: '0.18em', fontWeight: 700 }}>
                {label}
            </span>
        </div>
    );
}

// ── Single stat pill ──────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '8px 16px',
            border: `1px solid ${BDR_DIM}`,
            background: SURFACE2,
            borderRadius: 4,
            minWidth: 88,
        }}>
            <span style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.22em', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontFamily: OSW, fontSize: 15, fontWeight: 700, fontStyle: 'italic', color: TXT, letterSpacing: '0.04em' }}>{value}</span>
        </div>
    );
}

// ── Pre-flight checklist item ─────────────────────────────────
type CheckStatus = 'pass' | 'warn' | 'fail';
function CheckItem({ status, label, detail, live }: {
    status: CheckStatus; label: string; detail: string; live?: boolean;
}) {
    const color = status === 'pass' ? GREEN : status === 'warn' ? AMBER : RED;
    const Icon = status === 'pass' ? IconCheck : status === 'warn' ? IconWarn : IconCross;
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px',
            background: SURFACE2,
            border: `1px solid ${status === 'pass' ? BDR_DIM : color + '55'}`,
            borderLeft: `3px solid ${color}`,
            borderRadius: 4,
            flex: 1, minWidth: 0,
        }}>
            <div style={{
                width: 22, height: 22, flexShrink: 0, borderRadius: '50%',
                background: `${color}1f`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Icon c={color} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: SG, fontSize: 10, fontWeight: 700, color: TXT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        {label}
                    </span>
                    {live && (
                        <span style={{
                            width: 5, height: 5, borderRadius: '50%', background: color,
                            animation: 'pfPulse 1.4s ease-in-out infinite', flexShrink: 0,
                        }} />
                    )}
                </div>
                <span style={{
                    fontFamily: RM, fontSize: 9, color: TXT_DIM, letterSpacing: '0.08em',
                    textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', display: 'block',
                }}>
                    {detail}
                </span>
            </div>
        </div>
    );
}

// ── Player row ────────────────────────────────────────────────
function PlayerRow({ player, color, index }: { player: Player; color: string; index: number }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 12px', height: 38,
            background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.025)',
            borderBottom: `1px solid ${BDR_DIM}`,
            flexShrink: 0,
        }}>
            <div style={{
                width: 28, height: 28, flexShrink: 0, borderRadius: 4,
                background: `${color}22`,
                border: `1px solid ${color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: RM, fontSize: 10, fontWeight: 700, color,
            }}>
                {player.number || '—'}
            </div>
            <span style={{
                fontFamily: SG, fontSize: 11, fontWeight: 600,
                color: TXT_DIM, letterSpacing: '0.04em', textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {player.name}
            </span>
        </div>
    );
}

// ── Team card ─────────────────────────────────────────────────
function TeamCard({
    name, color, players, side,
}: {
    name: string; color: string; players: Player[]; side: 'A' | 'B';
}) {
    const count = players.length;
    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            border: `1px solid ${BDR}`,
            borderRadius: 6,
            background: SURFACE2,
            overflow: 'hidden',
        }}>
            {/* Colored accent bar at top */}
            <div style={{ height: 3, background: color, flexShrink: 0 }} />

            {/* Team header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px 9px', flexShrink: 0,
                borderBottom: `1px solid ${BDR_DIM}`,
            }}>
                <div>
                    <div style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.22em', marginBottom: 3 }}>
                        TEAM {side}
                    </div>
                    <div style={{
                        fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 17, color: TXT, letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                        {name}
                    </div>
                </div>
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '5px 11px', borderRadius: 4,
                    border: `1px solid ${color}55`, background: `${color}18`,
                }}>
                    <span style={{ fontFamily: OSW, fontSize: 20, fontWeight: 700, fontStyle: 'italic', color, lineHeight: 1 }}>{count}</span>
                    <span style={{ fontFamily: RM, fontSize: 7, color: TXT_MUT, letterSpacing: '0.15em' }}>/{MAX_PLAYERS}</span>
                </div>
            </div>

            {/* Scrollable player list */}
            <div style={{
                flex: 1, overflowY: 'auto', minHeight: 0,
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.18) transparent',
            }}>
                {count === 0 ? (
                    <div style={{
                        height: '100%', minHeight: 96, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 6,
                        border: `1px dashed ${BDR}`, borderRadius: 6, margin: 12,
                    }}>
                        <span style={{ fontFamily: RM, fontSize: 9, color: TXT_DIM, letterSpacing: '0.22em' }}>
                            NO ROSTER
                        </span>
                        <span style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.18em' }}>
                            SCORE BY TEAM ONLY
                        </span>
                    </div>
                ) : (
                    players.map((p, i) => <PlayerRow key={p.id} player={p} color={color} index={i} />)
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// MAIN MODAL
// ══════════════════════════════════════════════════════════════
const GameReviewScreen: React.FC<GameReviewScreenProps> = ({ config, onConfirm, onBack, isConnected = true }) => {
    const {
        teamAName, teamBName, teamAColor, teamBColor,
        periods, periodMinutes, shotClockSeconds, timeoutsPerTeam,
        timeoutMode = 'fiba',
        gameMode = 'stats', periodType = 'quarter',
        playersA = [], playersB = [],
    } = config;

    const timeoutValue = timeoutMode === 'fiba'
        ? (periods >= 4 ? 'FIBA · 2/3/1'
         : periods === 2 ? 'FIBA · 2/2/1'
         :                 'FIBA · 1 GAME')
        : `${timeoutsPerTeam ?? 2} / TEAM`;

    const totalPlayers = playersA.length + playersB.length;
    const needsRoster = gameMode === 'stats' || gameMode === 'advanced';
    const rosterIncomplete = needsRoster && totalPlayers === 0;

    // ── Pre-flight checklist ──────────────────────────────────
    const checks: { status: CheckStatus; label: string; detail: string; live?: boolean }[] = [
        {
            status: 'pass',
            label: 'Teams',
            detail: `${(teamAName || 'TEAM A')} vs ${(teamBName || 'TEAM B')}`,
        },
        {
            status: 'pass',
            label: 'Timing',
            detail: `${periods}×${periodMinutes}MIN · ${shotClockSeconds ? `${shotClockSeconds}S SC` : 'NO SC'}`,
        },
        {
            status: rosterIncomplete ? 'warn' : 'pass',
            label: 'Roster',
            detail: rosterIncomplete
                ? `${gameMode.toUpperCase()} MODE — NO PLAYERS`
                : needsRoster ? `${totalPlayers} PLAYERS REGISTERED` : 'NOT REQUIRED (QUICK)',
        },
        {
            status: isConnected ? 'pass' : 'fail',
            label: 'Hardware',
            detail: isConnected ? 'DAEMON LINK ONLINE' : 'DAEMON OFFLINE',
            live: true,
        },
    ];

    const failCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;
    const allClear  = failCount === 0 && warnCount === 0;

    const launchColor = failCount > 0 ? RED : warnCount > 0 ? AMBER : GREEN;
    const launchLabel = failCount > 0 ? 'LAUNCH (HW OFFLINE)' : warnCount > 0 ? 'LAUNCH ANYWAY →' : 'LAUNCH MATCH →';

    return (
        /* ── Full-screen backdrop ── */
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            fontFamily: RM,
        }}>
            <style>{`@keyframes pfPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

            {/* ── Modal box ── */}
            <div style={{
                width: 740, maxWidth: '96vw',
                maxHeight: '92vh',
                display: 'flex', flexDirection: 'column',
                background: SURFACE,
                border: `1px solid ${BDR}`,
                borderRadius: 8,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 90px rgba(0,0,0,0.85)',
                overflow: 'hidden',
            }}>

                {/* ── Modal header ── */}
                <div style={{
                    flexShrink: 0,
                    borderBottom: `1px solid ${BDR_DIM}`,
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{
                            width: 7, height: 7, borderRadius: '50%', background: launchColor,
                            animation: 'pfPulse 1.4s ease-in-out infinite',
                        }} />
                        <div>
                            <div style={{ fontFamily: RM, fontWeight: 700, fontSize: 11, color: TXT, letterSpacing: '0.22em' }}>
                                MATCH PRE-FLIGHT CHECK
                            </div>
                            <div style={{ fontFamily: RM, fontSize: 8, color: TXT_MUT, letterSpacing: '0.16em', marginTop: 2 }}>
                                VERIFY ALL PARAMETERS BEFORE LAUNCH
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onBack}
                        style={{
                            background: SURFACE2, border: `1px solid ${BDR}`, borderRadius: 4,
                            color: TXT_DIM, fontFamily: RM, fontSize: 11,
                            cursor: 'pointer', width: 28, height: 28,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* ── Game config section ── */}
                <div style={{
                    flexShrink: 0, padding: '14px 18px',
                    borderBottom: `1px solid ${BDR_DIM}`,
                }}>
                    <div style={{
                        fontFamily: RM, fontSize: 8, color: TXT_MUT,
                        letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 10,
                    }}>
                        GAME CONFIGURATION
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ModeChip mode={gameMode} />
                        <StatPill label="DURATION" value={periodLabel(periods, periodMinutes, periodType)} />
                        <StatPill label="SHOT CLOCK" value={shotClockSeconds ? `${shotClockSeconds}S` : 'OFF'} />
                        <StatPill label="TIMEOUTS" value={timeoutValue} />
                    </div>
                </div>

                {/* ── Team cards ── */}
                <div style={{
                    flex: 1, display: 'flex', minHeight: 0,
                    padding: '14px 18px 0',
                    gap: 14,
                }}>
                    <TeamCard name={teamAName || 'TEAM A'} color={teamAColor || '#3B82F6'} players={playersA} side="A" />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 36 }}>
                        <span style={{
                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                            fontSize: 18, color: TXT_MUT, letterSpacing: '0.05em',
                        }}>
                            VS
                        </span>
                    </div>

                    <TeamCard name={teamBName || 'TEAM B'} color={teamBColor || '#EF4444'} players={playersB} side="B" />
                </div>

                {/* ── Pre-flight checklist ── */}
                <div style={{ flexShrink: 0, padding: '14px 18px 0' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9,
                    }}>
                        <span style={{
                            fontFamily: RM, fontSize: 8, color: TXT_MUT,
                            letterSpacing: '0.28em', textTransform: 'uppercase',
                        }}>
                            SYSTEMS CHECK
                        </span>
                        <span style={{
                            fontFamily: RM, fontSize: 8, fontWeight: 700,
                            color: allClear ? GREEN : launchColor,
                            letterSpacing: '0.18em', textTransform: 'uppercase',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: allClear ? GREEN : launchColor }} />
                            {allClear ? 'ALL SYSTEMS GO' : failCount > 0 ? `${failCount} BLOCKER${failCount > 1 ? 'S' : ''}` : `${warnCount} WARNING${warnCount > 1 ? 'S' : ''}`}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {checks.map(c => (
                            <CheckItem key={c.label} status={c.status} label={c.label} detail={c.detail} live={c.live} />
                        ))}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div style={{
                    flexShrink: 0,
                    borderTop: `1px solid ${BDR_DIM}`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px', gap: 12, marginTop: 14,
                    background: 'rgba(255,255,255,0.02)',
                }}>
                    <span style={{
                        fontFamily: RM, fontSize: 9,
                        color: TXT_MUT, letterSpacing: '0.16em', textTransform: 'uppercase',
                    }}>
                        {totalPlayers} PLAYER{totalPlayers !== 1 ? 'S' : ''} REGISTERED
                    </span>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={onBack}
                            style={{
                                height: 40, padding: '0 22px', borderRadius: 4,
                                background: SURFACE2,
                                border: `1px solid ${BDR}`,
                                color: TXT_DIM, fontFamily: RM, fontSize: 10,
                                fontWeight: 700, letterSpacing: '0.14em',
                                textTransform: 'uppercase', cursor: 'pointer',
                                transition: 'background 0.12s, color 0.12s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = SURFACE3; (e.currentTarget as HTMLButtonElement).style.color = TXT; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = SURFACE2; (e.currentTarget as HTMLButtonElement).style.color = TXT_DIM; }}
                            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.background = SURFACE3; }}
                            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.background = SURFACE2; }}
                        >
                            ← EDIT
                        </button>
                        <button
                            onClick={onConfirm}
                            style={{
                                height: 40, padding: '0 28px', borderRadius: 4,
                                background: launchColor,
                                border: `1px solid ${launchColor}`,
                                color: '#000', fontFamily: OSW, fontStyle: 'italic',
                                fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
                                textTransform: 'uppercase', cursor: 'pointer',
                                boxShadow: `0 2px 14px ${launchColor}55`,
                                transition: 'transform 0.1s',
                            }}
                            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                        >
                            {launchLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameReviewScreen;
