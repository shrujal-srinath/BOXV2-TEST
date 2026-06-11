// src/components/refereebox/PiAdvancedShotFlow.tsx
// ═══════════════════════════════════════════════════════════════
// Full-screen shot-attribution flow for stats/advanced mode.
// Takes over the entire screen so the referee has maximum working
// space — a prominent live-score header keeps the game state
// visible at all times.
//
// Steps:
//   field goal (stats or advanced)  →  COURT → PLAYER → CONTEXT
//   free throw                      →  PLAYER → CONTEXT
//
// Header (96px) shows live scores, team names, period + clock so
// the referee never loses track of the game state.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PiHexCourt from './PiHexCourt';
import { ZONES, SHOT_ATTRIBUTES } from '../shotchart/courtZones';
import type { ScorePendingEvent, Player, TeamState, ClockState } from '../../hooks/useRefereeBox';
import type { ShotZoneId } from '../shotchart/types/shotTypes';
import { useShotChart } from '../../hooks/useShotChart';
import { useReducedMotion } from '../../lib/colorPalettes';
import { getShotTypeSelection } from '../../services/gameControlPrefs';

interface PiAdvancedShotFlowProps {
    event: ScorePendingEvent;
    teamA: TeamState; teamB: TeamState;
    teamAColor: string; teamBColor: string;
    clock: ClockState;
    /** Active game code — used to fetch shot history for the in-court heatmap. */
    gameCode?: string;
    onAttribute: (data: {
        team: 'A' | 'B'; points: number;
        playerId: string | null; playerName: string | null;
        zone?: string; x?: number; y?: number;
        period?: number; gameClockSec?: number; attributes?: string[];
    }) => void;
    onSkip: () => void;
    /** Fires the daemon UNDO action (rolls back the last shot + score). */
    onUndo?: () => void;
}

type Step = 'court' | 'player' | 'context';

const PLAYER_SECONDS  = 12;  // 12s to pick player — enough to glance at roster
const CONTEXT_SECONDS = 9;   // 9s to add context tags

const RM  = "'JetBrains Mono', monospace";
const OSW = "'Oswald', sans-serif";

// ── Helpers ───────────────────────────────────────────────────
function msToDisplay(ms: number) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
function pLabel(period: number, total: number) {
    return period <= total ? `Q${period}` : `OT${period - total}`;
}

// ── Countdown ring ─────────────────────────────────────────────
function CountdownRing({ secondsLeft, total, color }: { secondsLeft: number; total: number; color: string }) {
    const R = 13, C = 2 * Math.PI * R;
    const frac = Math.max(0, Math.min(1, secondsLeft / total));
    return (
        <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
            <svg width={34} height={34} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={17} cy={17} r={R} stroke="rgba(255,255,255,0.1)" strokeWidth={2.5} fill="none" />
                <circle cx={17} cy={17} r={R} stroke={color} strokeWidth={2.5} fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${frac * C} ${C}`}
                    style={{ transition: 'stroke-dasharray 1s linear', filter: `drop-shadow(0 0 4px ${color})` }}
                />
            </svg>
            <span style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: OSW, fontWeight: 700, fontSize: 13, color, fontStyle: 'italic',
            }}>{secondsLeft}</span>
        </div>
    );
}

// ── Prominent game-state header ───────────────────────────────
// Always visible so the referee knows the live score while attributing.
function GameHeader({ teamA, teamB, teamAColor, teamBColor, clock, scoringTeam }: {
    teamA: TeamState; teamB: TeamState;
    teamAColor: string; teamBColor: string;
    clock: ClockState; scoringTeam: 'A' | 'B';
}) {
    const period = pLabel(clock.period, clock.totalPeriods);
    const cA = scoringTeam === 'A';
    const cB = scoringTeam === 'B';

    return (
        <div style={{
            height: 96, flexShrink: 0,
            display: 'grid', gridTemplateColumns: '1fr 110px 1fr',
            background: '#05070D',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
        }}>
            {/* ── Team A ──────────────────────────────── */}
            <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '0 18px', gap: 4, position: 'relative', overflow: 'hidden',
                background: cA ? `linear-gradient(90deg, ${teamAColor}18 0%, transparent 100%)` : 'transparent',
            }}>
                {/* Left accent bar — only for scoring team */}
                {cA && <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                    background: `linear-gradient(180deg, ${teamAColor}, ${teamAColor}88)`,
                    boxShadow: `2px 0 12px ${teamAColor}60`,
                }} />}

                {/* Team name */}
                <div style={{
                    fontFamily: OSW, fontWeight: 700, fontStyle: 'italic',
                    fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: cA ? teamAColor : 'rgba(255,255,255,0.6)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingLeft: cA ? 8 : 0,
                }}>{teamA.name}</div>

                {/* Score — the hero number */}
                <div style={{
                    fontFamily: OSW, fontWeight: 900, fontStyle: 'italic',
                    fontSize: cA ? 58 : 48, lineHeight: 1,
                    letterSpacing: '-0.03em',
                    color: cA ? '#fff' : 'rgba(255,255,255,0.6)',
                    textShadow: cA ? `0 0 32px ${teamAColor}70` : 'none',
                    paddingLeft: cA ? 8 : 0,
                    transition: 'font-size 0.15s, color 0.15s',
                }}>{teamA.score}</div>

                {/* Fouls / timeouts row */}
                <div style={{
                    display: 'flex', gap: 10, paddingLeft: cA ? 8 : 0,
                }}>
                    <span style={{ fontFamily: RM, fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em' }}>
                        {teamA.fouls}F
                    </span>
                    <span style={{ fontFamily: RM, fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em' }}>
                        {teamA.timeouts}TO
                    </span>
                </div>
            </div>

            {/* ── Center: period + clock ───────────────── */}
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3,
                borderLeft: '1px solid rgba(255,255,255,0.05)',
                borderRight: '1px solid rgba(255,255,255,0.05)',
            }}>
                {/* Period chip */}
                <div style={{
                    padding: '2px 10px', borderRadius: 100,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontFamily: RM, fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.2em', color: 'rgba(255,255,255,0.55)',
                    textTransform: 'uppercase',
                }}>{period}</div>

                {/* Game clock */}
                <div style={{
                    fontFamily: OSW, fontWeight: 700, fontStyle: 'italic',
                    fontSize: 26, lineHeight: 1, letterSpacing: '0.02em',
                    color: 'rgba(255,255,255,0.9)',
                    fontVariantNumeric: 'tabular-nums',
                }}>{msToDisplay(clock.gameMs)}</div>

                {/* Running indicator */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontFamily: RM, fontSize: 8, letterSpacing: '0.14em',
                    color: clock.isRunning ? '#22c55e' : 'rgba(255,255,255,0.2)',
                }}>
                    <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: clock.isRunning ? '#22c55e' : 'rgba(255,255,255,0.15)',
                        boxShadow: clock.isRunning ? '0 0 6px #22c55e' : 'none',
                        animation: clock.isRunning ? 'piClockDot 1s ease-in-out infinite' : 'none',
                    }} />
                    {clock.isRunning ? 'LIVE' : 'STOPPED'}
                </div>
            </div>

            {/* ── Team B ──────────────────────────────── */}
            <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end',
                padding: '0 18px', gap: 4, position: 'relative', overflow: 'hidden',
                background: cB ? `linear-gradient(270deg, ${teamBColor}18 0%, transparent 100%)` : 'transparent',
            }}>
                {cB && <div style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 4,
                    background: `linear-gradient(180deg, ${teamBColor}, ${teamBColor}88)`,
                    boxShadow: `-2px 0 12px ${teamBColor}60`,
                }} />}

                <div style={{
                    fontFamily: OSW, fontWeight: 700, fontStyle: 'italic',
                    fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: cB ? teamBColor : 'rgba(255,255,255,0.6)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: cB ? 8 : 0,
                }}>{teamB.name}</div>

                <div style={{
                    fontFamily: OSW, fontWeight: 900, fontStyle: 'italic',
                    fontSize: cB ? 58 : 48, lineHeight: 1,
                    letterSpacing: '-0.03em',
                    color: cB ? '#fff' : 'rgba(255,255,255,0.6)',
                    textShadow: cB ? `0 0 32px ${teamBColor}70` : 'none',
                    paddingRight: cB ? 8 : 0,
                    transition: 'font-size 0.15s, color 0.15s',
                }}>{teamB.score}</div>

                <div style={{ display: 'flex', gap: 10, paddingRight: cB ? 8 : 0 }}>
                    <span style={{ fontFamily: RM, fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em' }}>
                        {teamB.fouls}F
                    </span>
                    <span style={{ fontFamily: RM, fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em' }}>
                        {teamB.timeouts}TO
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
export default function PiAdvancedShotFlow({
    event, teamA, teamB, teamAColor, teamBColor, clock, gameCode, onAttribute, onSkip, onUndo,
}: PiAdvancedShotFlowProps) {
    const { team, points, players } = event;
    const teamColor = team === 'A' ? teamAColor : teamBColor;
    const teamName  = team === 'A' ? teamA.name : teamB.name;
    const reducedMotion = useReducedMotion();

    // Pull live shot history for the in-court heatmap.
    const { allShots } = useShotChart(gameCode ?? null);

    // Free throws (+1) skip the court — there's no location to record.
    // Free throw → player → [context].    Field goal → court → player → [context].
    // The context (shot-type tagging) step is gated by the shot type selection pref.
    const isFreeThrow   = points === 1;
    const showShotType  = getShotTypeSelection();
    const steps: Step[] = isFreeThrow
        ? (showShotType ? ['player', 'context'] : ['player'])
        : (showShotType ? ['court', 'player', 'context'] : ['court', 'player']);

    const [stepIndex, setStepIndex]       = useState(0);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [selectedZone,   setSelectedZone]   = useState<ShotZoneId | null>(null);
    const [courtX,         setCourtX]         = useState<number | null>(null);
    const [courtY,         setCourtY]         = useState<number | null>(null);
    const [selectedAttrs,  setSelectedAttrs]  = useState<Set<string>>(() => new Set());
    const [secondsLeft,    setSecondsLeft]    = useState<number | null>(null);

    const step    = steps[stepIndex];
    const doneRef = useRef(false);

    const goNext = useCallback(() => setStepIndex(i => Math.min(i + 1, steps.length - 1)), [steps.length]);
    const goPrev = useCallback(() => setStepIndex(i => Math.max(i - 1, 0)), []);

    const finalize = useCallback((opts: { unattributed?: boolean; playerOverride?: Player | null } = {}) => {
        if (doneRef.current) return;
        doneRef.current = true;
        const player = opts.unattributed ? null : ('playerOverride' in opts ? opts.playerOverride! : selectedPlayer);
        onAttribute({
            team, points,
            playerId:     player?.id   ?? null,
            playerName:   player?.name ?? null,
            zone:         isFreeThrow ? 'free_throw' : (selectedZone ?? 'unlocated'),
            x:            isFreeThrow ? undefined : (courtX ?? undefined),
            y:            isFreeThrow ? undefined : (courtY ?? undefined),
            period:       clock.period,
            gameClockSec: Math.ceil(clock.gameMs / 1000),
            attributes:   Array.from(selectedAttrs),
        });
    }, [selectedPlayer, selectedZone, courtX, courtY, selectedAttrs, team, points, clock, onAttribute, isFreeThrow]);

    // Reset the countdown when the step changes — done during render (the
    // documented "adjust state when a prop changes" pattern) instead of an
    // effect, so the new countdown is visible on the very first paint.
    const [countdownStep, setCountdownStep] = useState<Step | null>(null);
    if (countdownStep !== step) {
        setCountdownStep(step);
        setSecondsLeft(
            step === 'player'  ? PLAYER_SECONDS
            : step === 'context' ? CONTEXT_SECONDS
            : null
        );
    }

    useEffect(() => {
        if (secondsLeft === null) return;
        if (secondsLeft <= 0) {
            if (step === 'player')       finalize({ unattributed: true });
            else if (step === 'context') finalize();
            return;
        }
        const t = setTimeout(() => setSecondsLeft(v => v === null ? null : v - 1), 1000);
        return () => clearTimeout(t);
    }, [secondsLeft, step, finalize]);

    function handleCourtTap(zone: ShotZoneId, x: number, y: number) {
        // Tap commits immediately — no confirm step, no idle countdown.
        // Drag-to-adjust (HexLayer) allows in-flight repositioning before lift.
        setSelectedZone(zone);
        setCourtX(x);
        setCourtY(y);
        goNext();
    }

    function handleSkipLocation() {
        setSelectedZone('unlocated');
        setCourtX(null);
        setCourtY(null);
        goNext();
    }

    function handlePlayerSelect(p: Player) {
        setSelectedPlayer(p);
        if (!showShotType) finalize({ playerOverride: p });
        else goNext();
    }
    function handleMarkUnattributed() {
        setSelectedPlayer(null);
        if (!showShotType) finalize({ unattributed: true });
        else goNext();
    }
    function toggleAttr(id: string) {
        setSelectedAttrs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    const numCols   = players.length <= 4 ? 2 : 3;
    const zoneShort = selectedZone ? (ZONES[selectedZone]?.shortLabel ?? selectedZone) : null;
    const zoneLabel = selectedZone ? (ZONES[selectedZone]?.label      ?? selectedZone) : null;

    const promptText =
        step === 'court'   ? 'TAP SHOT LOCATION'
        : step === 'player'  ? 'WHO SCORED?'
        : 'SHOT CONTEXT';

    return (
        <div style={{
            width: '100vw', height: '100dvh',
            background: '#060810',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: OSW,
        }}>

            {/* ══ 1. PROMINENT GAME HEADER ══════════════════════ */}
            <GameHeader
                teamA={teamA} teamB={teamB}
                teamAColor={teamAColor} teamBColor={teamBColor}
                clock={clock} scoringTeam={team}
            />

            {/* ══ 2. STEP PROGRESS STRIP ═══════════════════════ */}
            <div style={{ display: 'flex', gap: 3, padding: '0 4px', height: 4, flexShrink: 0 }}>
                {steps.map((s, i) => (
                    <div key={s} style={{
                        flex: 1, height: '100%', borderRadius: 2,
                        background: i <= stepIndex ? teamColor : 'rgba(255,255,255,0.07)',
                        boxShadow: i === stepIndex ? `0 0 10px ${teamColor}` : 'none',
                        transition: 'background 0.25s, box-shadow 0.25s',
                    }} />
                ))}
            </div>

            {/* ══ 3. PROMPT BANNER ═════════════════════════════ */}
            <div style={{
                height: 44, flexShrink: 0,
                background: `linear-gradient(90deg, ${teamColor}14 0%, ${teamColor}06 50%, ${teamColor}14 100%)`,
                borderBottom: `1px solid ${teamColor}22`,
                display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
            }}>
                {/* Pulsing dot */}
                <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: teamColor, boxShadow: `0 0 8px ${teamColor}`,
                    animation: 'piShotPulse 1s ease-in-out infinite',
                }} />

                {/* Team + points badge */}
                <span style={{
                    fontFamily: RM, fontSize: 11, fontWeight: 700, color: teamColor,
                    letterSpacing: '0.16em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                    {teamName.slice(0, 14)}
                </span>
                <span style={{
                    padding: '2px 8px', borderRadius: 100,
                    background: teamColor, color: '#000',
                    fontFamily: RM, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                    flexShrink: 0,
                }}>
                    +{points}PT
                </span>

                {/* Step label */}
                <span style={{
                    fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 14, color: 'rgba(255,255,255,0.65)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                    {promptText}
                </span>

                {/* Right: retained chips + countdown */}
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center', flexShrink: 0 }}>
                    {zoneShort && step !== 'court' && (
                        <span style={{
                            padding: '2px 8px', borderRadius: 100, background: `${teamColor}1c`,
                            border: `1px solid ${teamColor}3e`, fontFamily: RM, fontSize: 9,
                            fontWeight: 700, color: teamColor, letterSpacing: '0.1em',
                        }}>◎ {zoneShort}</span>
                    )}
                    {selectedPlayer && (
                        <span style={{
                            padding: '2px 8px', borderRadius: 100, background: `${teamColor}1c`,
                            border: `1px solid ${teamColor}3e`, fontFamily: RM, fontSize: 9,
                            fontWeight: 700, color: teamColor, letterSpacing: '0.1em',
                        }}>#{selectedPlayer.number}</span>
                    )}
                    {secondsLeft !== null && (
                        <CountdownRing
                            secondsLeft={secondsLeft}
                            total={step === 'player' ? PLAYER_SECONDS : CONTEXT_SECONDS}
                            color={teamColor}
                        />
                    )}
                </div>
            </div>

            {/* ══ 4. STEP BODY ═════════════════════════════════ */}
            <div key={step} style={{
                flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
                animation: reducedMotion ? 'none' : 'piStepFade 0.18s ease-out',
            }}>

                {/* COURT — hex court, absolute-positioned so height resolves correctly */}
                {step === 'court' && (
                    <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#07090E', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                            <PiHexCourt
                                teamColor={teamColor}
                                onZoneSelect={handleCourtTap}
                                selectedZone={selectedZone}
                                selectedX={courtX}
                                selectedY={courtY}
                                existingShots={allShots}
                                lockMode={
                                    points === 2 ? 'two'
                                    : points === 3 ? 'three'
                                    : null
                                }
                                onUndoLastShot={onUndo}
                                scoringTeam={team}
                                teamAName={teamA.name}
                                teamBName={teamB.name}
                                teamAColor={teamAColor}
                                teamBColor={teamBColor}
                            />
                        </div>
                    </div>
                )}

                {/* PLAYER */}
                {step === 'player' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px 16px', overflowY: 'auto' }}>
                        {players.length > 0 ? (
                            <div style={{
                                flex: 1, display: 'grid', gridTemplateColumns: `repeat(${numCols},1fr)`,
                                gap: 12, alignContent: 'start',
                            }}>
                                {players.map(p => (
                                    <button key={p.id} onClick={() => handlePlayerSelect(p)}
                                        style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            gap: 4, minHeight: 80, padding: '12px 8px', borderRadius: 12,
                                            border: '2px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)',
                                            cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s, border-color 0.1s, background 0.1s',
                                            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', userSelect: 'none',
                                        }}
                                        onPointerDown={e => { const t = e.currentTarget; t.style.transform = 'scale(0.95)'; t.style.borderColor = teamColor; t.style.background = `${teamColor}1e`; t.style.boxShadow = `0 0 22px ${teamColor}33`; }}
                                        onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                        onPointerLeave={e => { const t = e.currentTarget; t.style.transform = 'scale(1)'; t.style.borderColor = 'rgba(255,255,255,0.07)'; t.style.background = 'rgba(255,255,255,0.025)'; t.style.boxShadow = 'none'; }}
                                    >
                                        <div style={{ fontFamily: OSW, fontStyle: 'italic', fontWeight: 700, fontSize: 38, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>
                                            {p.number}
                                        </div>
                                        <div style={{ fontFamily: RM, fontWeight: 700, fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                            {p.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: RM, fontSize: 11, color: 'rgba(255,255,255,0.16)', letterSpacing: '0.18em' }}>
                                NO ROSTER — MARK UNATTRIBUTED
                            </div>
                        )}
                    </div>
                )}

                {/* CONTEXT */}
                {step === 'context' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px 16px', overflowY: 'auto' }}>
                        <div style={{
                            flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))',
                            gap: 10, alignContent: 'start',
                        }}>
                            {SHOT_ATTRIBUTES.map(attr => {
                                const on = selectedAttrs.has(attr.id);
                                return (
                                    <button key={attr.id} onClick={() => toggleAttr(attr.id)}
                                        style={{
                                            minHeight: 56, borderRadius: 11,
                                            border: `2px solid ${on ? teamColor : 'rgba(255,255,255,0.07)'}`,
                                            background: on ? `${teamColor}1e` : 'rgba(255,255,255,0.025)',
                                            color: on ? teamColor : 'rgba(255,255,255,0.55)',
                                            fontFamily: OSW, fontStyle: 'italic', fontWeight: 700,
                                            fontSize: 15, letterSpacing: '0.02em', textTransform: 'uppercase',
                                            cursor: 'pointer', transition: 'all 0.12s',
                                            boxShadow: on ? `0 0 14px ${teamColor}2e` : 'none',
                                            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                                        }}
                                    >{attr.label}</button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ══ 5. ACTION FOOTER ═════════════════════════════ */}
            <div style={{
                height: 58, flexShrink: 0,
                background: '#05070D',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center',
                padding: '0 14px', gap: 9,
            }}>
                {step === 'court' && (
                    <>
                        <FooterButton label="SKIP LOCATION" onClick={handleSkipLocation} />
                        <div style={{ flex: 1 }} />
                        <span style={{ fontFamily: RM, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: zoneLabel ? teamColor : 'rgba(255,255,255,0.22)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            {zoneLabel ?? `TAP ${team === 'A' ? 'LEFT' : 'RIGHT'} HALF · DRAG TO FINE-TUNE`}
                        </span>
                    </>
                )}

                {step === 'player' && (
                    <>
                        <FooterButton label="← BACK" onClick={goPrev} />
                        <FooterButton label="UNATTRIBUTED" onClick={handleMarkUnattributed} />
                        <div style={{ flex: 1 }} />
                        <span style={{ fontFamily: RM, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase' }}>
                            TAP THE SCORER
                        </span>
                    </>
                )}

                {step === 'context' && (
                    <>
                        <FooterButton label="← BACK" onClick={goPrev} />
                        <FooterButton label="SKIP" onClick={() => finalize()} />
                        <div style={{ flex: 1 }}>
                            {selectedAttrs.size > 0 && (
                                <span style={{ fontFamily: RM, fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em' }}>
                                    {selectedAttrs.size} TAG{selectedAttrs.size > 1 ? 'S' : ''}
                                </span>
                            )}
                        </div>
                        <RecordButton onClick={() => finalize()} color={teamColor} />
                    </>
                )}

                {/* Dismiss without recording shot details */}
                {step !== 'context' && (
                    <button onClick={onSkip}
                        title="Dismiss — shot already counted"
                        aria-label="Dismiss without recording shot details"
                        style={{
                            marginLeft: 4, width: 44, height: 44, borderRadius: 10,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.03)',
                            color: 'rgba(255,255,255,0.65)', fontFamily: RM, fontWeight: 700, fontSize: 18,
                            cursor: 'pointer', flexShrink: 0,
                            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                            transition: 'background 0.12s, color 0.12s',
                        }}
                        onPointerDown={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = '#fff'; }}
                        onPointerUp={e =>   { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
                        onPointerLeave={e =>{ e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
                    >✕</button>
                )}
            </div>

            <style>{`
                @keyframes piShotPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
                @keyframes piStepFade  { from { opacity: 0; } to { opacity: 1; } }
                @keyframes piClockDot  { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
            `}</style>
        </div>
    );
}

function FooterButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button onClick={onClick}
            style={{
                height: 44, padding: '0 18px', borderRadius: 10,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.7)', fontFamily: RM, fontWeight: 700,
                fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s, color 0.1s, background 0.12s',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}
            onPointerDown={e => {
                e.currentTarget.style.transform = 'scale(0.96)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            }}
            onPointerUp={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }}
            onPointerLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }}
        >{label}</button>
    );
}

function RecordButton({ onClick, color }: { onClick: () => void; color: string }) {
    return (
        <button onClick={onClick}
            style={{
                padding: '10px 26px', borderRadius: 11,
                border: `2px solid ${color}`, background: color, color: '#000',
                fontFamily: RM, fontWeight: 800, fontSize: 11,
                letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
                boxShadow: `0 0 20px ${color}40`, transition: 'transform 0.1s',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}
            onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
            onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >✓ RECORD SHOT</button>
    );
}
