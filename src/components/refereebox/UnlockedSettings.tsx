// src/components/refereebox/UnlockedSettings.tsx
// ═══════════════════════════════════════════════════════════════
// THE BOX — MANUAL OVERRIDE CONSOLE v6
// Opens when the hardware SETTINGS button unlocks the box, OR via the
// SETTINGS button in any header. Lets the ref edit *every* live game
// variable: score, fouls, timeouts, game clock (with ms precision via
// modal), shot clock, period, possession, buzzer. Header mirrors the
// LockedScoreboard exactly so navigation stays consistent.
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
    SB_BG, SB_SURFACE, SB_HOME_C, SB_AWAY_C, SB_GREEN, SB_AMBER, SB_ORANGE,
    SB_WHITE, SB_DIM, SB_BDR, SB_BDR_HI,
    SB_OSW, SB_RM, SB_DOT_GRID,
    CornerBrackets, ScorePanel, FibaFoulMarkers, HeaderBtn,
    IconCast, IconHW, IconStop, IconUndo, IconLock,
} from './sharedScoreboard';
import {
    fibaTimeoutsForPeriod, bucketLabel,
} from '../../services/fibaTimeouts';
import NumberEditor from './NumberEditor';
import TimeEditor, { type TimeEditorMode } from './TimeEditor';
import { useScoreboardTheme } from '../../services/scoreboardTheme';
import { useHeatPalette, getReducedMotionOverride, setReducedMotionOverride } from '../../lib/colorPalettes';
import {
    useKeepClockOnShotViolation,
    useMinimizeHeader,
    useDisableScorePopup,
    useDisableTouchDeck,
    useShotTypeSelection,
    useQuickEntry,
} from '../../services/gameControlPrefs';

// ── Types ─────────────────────────────────────────────────────
interface TeamState { name: string; score: number; fouls: number; timeouts: number; }
interface ClockState {
    gameMs: number; shotMs: number; isRunning: boolean;
    period: number; totalPeriods: number;
}

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
    onEndGame?: () => void;
    onCast?: () => void;
    onConnectHardware?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────
const fmtClock = (ms: number, withMs = false): string => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (!withMs) return `${m}:${String(s).padStart(2, '0')}`;
    const milli = Math.max(0, ms - totalSec * 1000);
    return `${m}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
};
const fmtShot = (ms: number): string => {
    const s = Math.ceil(ms / 1000);
    return `${s}`;
};
const periodLabel = (p: number, total: number): string => {
    if (total === 2) return p <= 2 ? `H${p}` : `OT${p - 2}`;
    return p <= 4 ? `Q${p}` : `OT${p - 4}`;
};

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
const UnlockedSettings: React.FC<Props> = ({
    teamA, teamB, clock, possession,
    teamAColor = SB_HOME_C, teamBColor = SB_AWAY_C,
    isConnected = true, gameCode,
    sendAction,
    onClose, onEndGame, onCast, onConnectHardware,
}) => {
    const [scoreEditor, setScoreEditor] = useState<null | 'A' | 'B'>(null);
    const [timeEditor, setTimeEditor] = useState<null | TimeEditorMode>(null);

    const inBonusA = teamA.fouls >= 5;
    const inBonusB = teamB.fouls >= 5;
    const timeoutsPerBucket = fibaTimeoutsForPeriod(clock.period, clock.totalPeriods);
    const bucketName = bucketLabel(clock.period, clock.totalPeriods);

    // Soft LOCK — ask daemon to clear isTouchUnlocked, then leave the screen.
    // The auto-toggle effect in RefereeScreen will see the daemon flag flip
    // and stay on live_game; the soft setScreen('live_game') below covers the
    // case where the parent's effect hasn't seen the flag change yet.
    const handleLock = () => {
        sendAction('LOCK_TOUCH');
        onClose();
    };

    const handleUndo = () => sendAction('UNDO');

    return (
        <div style={{
            width: '100vw', height: '100vh',
            background: SB_BG, color: SB_WHITE,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', fontFamily: SB_RM,
            position: 'relative',
        }}>
            {/* ════════════════ TOP BAR — mirror LockedScoreboard ════════════════ */}
            <div style={{
                height: 56, flexShrink: 0,
                background: SB_SURFACE,
                borderBottom: `1px solid ${SB_BDR_HI}`,
                display: 'flex', alignItems: 'center',
                padding: '0 18px', gap: 12,
            }}>
                {/* Brand mark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 4, height: 22, background: SB_AWAY_C }} />
                    <span style={{
                        fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 20, color: SB_WHITE, letterSpacing: '0.06em',
                    }}>
                        THE BOX
                    </span>
                </div>

                {/* MANUAL OVERRIDE chip — replaces LIVE/PAUSED while in this screen */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px',
                    border: `1px solid ${SB_ORANGE}88`,
                    background: `${SB_ORANGE}1a`,
                    boxShadow: `0 0 12px ${SB_ORANGE}44`,
                }}>
                    <div style={{
                        width: 7, height: 7, background: SB_ORANGE,
                        animation: 'usPulse 1.1s infinite',
                    }} />
                    <span style={{
                        fontFamily: SB_RM, fontSize: 9, color: SB_ORANGE,
                        letterSpacing: '0.22em', fontWeight: 700,
                        textTransform: 'uppercase',
                    }}>MANUAL OVERRIDE</span>
                </div>

                {/* Game code */}
                {gameCode && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 14px',
                        border: `1px solid ${SB_BDR_HI}`,
                        background: 'rgba(255,255,255,0.03)',
                    }}>
                        <span style={{ fontFamily: SB_RM, fontSize: 8, color: SB_DIM, letterSpacing: '0.24em', fontWeight: 600 }}>
                            CODE
                        </span>
                        <span style={{
                            fontFamily: SB_RM, fontSize: 12, color: SB_WHITE,
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
                        background: isConnected ? SB_GREEN : SB_AWAY_C,
                        boxShadow: `0 0 6px ${isConnected ? SB_GREEN : SB_AWAY_C}88`,
                    }} />
                    <span style={{
                        fontFamily: SB_RM, fontSize: 8, color: SB_DIM,
                        letterSpacing: '0.2em', fontWeight: 600,
                    }}>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
                </div>

                <HeaderBtn label="CAST"     icon={<IconCast />} onClick={onCast} />
                <HeaderBtn label="HARDWARE" icon={<IconHW />}   onClick={onConnectHardware} />
                <HeaderBtn label="UNDO"     icon={<IconUndo />} onClick={handleUndo} accent={SB_AMBER} />
                {onEndGame && (
                    <HeaderBtn label="END" icon={<IconStop />} onClick={onEndGame} accent={SB_AWAY_C} />
                )}
                <HeaderBtn label="BACK TO SCORING" icon={<IconLock />} onClick={handleLock} accent={SB_GREEN} filled />
            </div>

            {/* ════════════════ BODY GRID ════════════════ */}
            <div style={{
                flex: 1, display: 'grid',
                gridTemplateColumns: '1fr 460px 1fr',
                minHeight: 0,
            }}>

                <TeamOverrideColumn
                    side="HOME" align="left"
                    team={teamA} color={teamAColor} teamKey="teamA"
                    bonus={inBonusA} hasPossession={possession === 'A'}
                    timeoutsPerBucket={timeoutsPerBucket} bucketName={bucketName}
                    sendAction={sendAction}
                    onEditScore={() => setScoreEditor('A')}
                />

                <CenterControlColumn
                    clock={clock}
                    possession={possession}
                    teamAColor={teamAColor} teamBColor={teamBColor}
                    sendAction={sendAction}
                    onEditTime={(mode) => setTimeEditor(mode)}
                />

                <TeamOverrideColumn
                    side="AWAY" align="right"
                    team={teamB} color={teamBColor} teamKey="teamB"
                    bonus={inBonusB} hasPossession={possession === 'B'}
                    timeoutsPerBucket={timeoutsPerBucket} bucketName={bucketName}
                    sendAction={sendAction}
                    onEditScore={() => setScoreEditor('B')}
                />
            </div>

            {/* ════════════════ MODALS ════════════════ */}
            {scoreEditor !== null && (
                <NumberEditor
                    title={`EDIT ${scoreEditor === 'A' ? 'HOME' : 'AWAY'} SCORE`}
                    currentValue={scoreEditor === 'A' ? teamA.score : teamB.score}
                    accent={scoreEditor === 'A' ? teamAColor : teamBColor}
                    onApply={(v) => {
                        const team = scoreEditor === 'A' ? 'teamA' : 'teamB';
                        const current = scoreEditor === 'A' ? teamA.score : teamB.score;
                        const delta = v - current;
                        if (delta !== 0) sendAction('EDIT_SCORE', { team, amount: delta });
                        setScoreEditor(null);
                    }}
                    onCancel={() => setScoreEditor(null)}
                />
            )}
            {timeEditor !== null && (
                <TimeEditor
                    mode={timeEditor}
                    currentMs={timeEditor === 'game' ? clock.gameMs : clock.shotMs}
                    onApply={(targetMs) => {
                        // Absolute set — no delta race, daemon stores Math.round(target).
                        if (timeEditor === 'game') sendAction('SET_GAME_CLOCK', { ms: targetMs });
                        else                       sendAction('SET_SHOT_CLOCK', { ms: targetMs });
                        setTimeEditor(null);
                    }}
                    onCancel={() => setTimeEditor(null)}
                />
            )}

            <style>{`
                @keyframes usPulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.25; }
                }
            `}</style>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// TEAM OVERRIDE COLUMN
// ══════════════════════════════════════════════════════════════
const TeamOverrideColumn: React.FC<{
    side: 'HOME' | 'AWAY';
    align: 'left' | 'right';
    team: TeamState;
    color: string;
    teamKey: 'teamA' | 'teamB';
    bonus: boolean;
    hasPossession: boolean;
    timeoutsPerBucket: number;
    bucketName: string;
    sendAction: Props['sendAction'];
    onEditScore: () => void;
}> = ({
    side, align, team, color, teamKey, bonus, hasPossession,
    timeoutsPerBucket, bucketName,
    sendAction, onEditScore,
}) => {
    const isLeft = align === 'left';
    const flow = isLeft ? 'row' : 'row-reverse';
    const itemAlign = isLeft ? 'flex-start' : 'flex-end';

    const editScore = (delta: number) => sendAction('EDIT_SCORE', { team: teamKey, amount: delta });
    const editFouls = (delta: number) => sendAction('EDIT_FOULS', { team: teamKey, amount: delta });
    const editTOs   = (delta: number) => sendAction('EDIT_TIMEOUTS', { team: teamKey, amount: delta });
    const resetFouls = () => { if (team.fouls !== 0) editFouls(-team.fouls); };
    const refillTOs  = () => {
        const target = timeoutsPerBucket;
        const delta = target - team.timeouts;
        if (delta !== 0) editTOs(delta);
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            background: SB_SURFACE,
            backgroundImage: `${SB_DOT_GRID}, linear-gradient(180deg, ${color}10 0%, transparent 22%, transparent 78%, ${color}10 100%)`,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Top accent bar */}
            <div style={{
                height: 5, flexShrink: 0,
                background: `linear-gradient(90deg, ${isLeft ? color : 'transparent'}, ${color}, ${!isLeft ? color : 'transparent'})`,
                boxShadow: `0 0 12px ${color}88`,
            }} />

            {/* Header */}
            <div style={{
                height: 76, flexShrink: 0,
                padding: '12px 24px',
                borderBottom: `1px solid ${SB_BDR}`,
                display: 'flex', flexDirection: 'column',
                alignItems: itemAlign, gap: 4,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: flow }}>
                    <div style={{
                        width: 6, height: 18, background: color,
                        boxShadow: `0 0 8px ${color}aa`,
                    }} />
                    <span style={{
                        fontFamily: SB_RM, fontSize: 10, color: SB_DIM,
                        letterSpacing: '0.34em', fontWeight: 700,
                    }}>
                        {side} · OVERRIDE
                    </span>
                    {hasPossession && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '2px 7px',
                            border: `1px solid ${color}aa`,
                            background: `${color}1f`,
                            flexDirection: flow,
                        }}>
                            <div style={{ width: 4, height: 4, background: color, animation: 'usPulse 1.2s infinite' }} />
                            <span style={{ fontFamily: SB_RM, fontSize: 7, color, letterSpacing: '0.22em', fontWeight: 700 }}>
                                BALL
                            </span>
                        </div>
                    )}
                </div>
                <span style={{
                    fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 26, color: SB_WHITE,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    lineHeight: 1.02,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '100%',
                    textAlign: align,
                    textShadow: `0 0 14px ${color}33`,
                }}>{team.name}</span>
            </div>

            {/* SCORE section */}
            <Section title="SCORE" align={align}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px' }}>
                    <div onClick={onEditScore} style={{ cursor: 'pointer' }}>
                        <ScorePanel value={team.score} color={color} fontSize={96} maxWidth={280} />
                    </div>
                </div>
                <StepRow flow={flow}>
                    <Step label="−10" color={color} onClick={() => editScore(-10)} />
                    <Step label="−1"  color={color} onClick={() => editScore(-1)} big />
                    <Step label="EDIT" color={SB_WHITE} onClick={onEditScore} hint />
                    <Step label="+1"  color={color} onClick={() => editScore(1)}  big />
                    <Step label="+10" color={color} onClick={() => editScore(10)} />
                </StepRow>
            </Section>

            {/* FOULS section */}
            <Section title="TEAM FOULS" align={align}>
                <div style={{
                    display: 'flex', flexDirection: flow,
                    alignItems: 'center', gap: 14, padding: '4px 0',
                }}>
                    <FibaFoulMarkers count={team.fouls} color={color} align={align} />
                    <div style={{ flex: 1 }} />
                    <span style={{
                        fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 36, color: bonus ? SB_ORANGE : SB_WHITE,
                        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                        textShadow: bonus ? `0 0 14px ${SB_ORANGE}88` : 'none',
                    }}>{team.fouls}</span>
                    {bonus && (
                        <div style={{
                            padding: '3px 8px',
                            background: SB_ORANGE, color: '#000',
                            fontFamily: SB_RM, fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.22em',
                            boxShadow: `0 0 14px ${SB_ORANGE}aa`,
                        }}>BONUS</div>
                    )}
                </div>
                <StepRow flow={flow}>
                    <Step label="−1" color="#EF4444" onClick={() => editFouls(-1)} big />
                    <Step label="RESET" color={SB_DIM} onClick={resetFouls} hint />
                    <Step label="+1" color="#EF4444" onClick={() => editFouls(1)} big />
                </StepRow>
            </Section>

            {/* TIMEOUTS section */}
            <Section
                title="TIMEOUTS"
                align={align}
                caption={`${bucketName} · ${timeoutsPerBucket} ALLOTTED`}
            >
                <div style={{
                    display: 'flex', flexDirection: flow,
                    alignItems: 'center', gap: 14, padding: '4px 0',
                }}>
                    <TODashes
                        remaining={team.timeouts}
                        total={Math.max(timeoutsPerBucket, team.timeouts)}
                        color={color}
                    />
                    <div style={{ flex: 1 }} />
                    <span style={{
                        fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 28, color: SB_WHITE,
                        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                    }}>
                        {team.timeouts}
                        <span style={{ color: SB_DIM, fontSize: 16 }}> / {Math.max(timeoutsPerBucket, team.timeouts)}</span>
                    </span>
                </div>
                <StepRow flow={flow}>
                    <Step label="−1" color={SB_AMBER} onClick={() => editTOs(-1)} big disabled={team.timeouts <= 0} />
                    <Step label="REFILL" color={SB_DIM} onClick={refillTOs} hint />
                    <Step label="+1" color={SB_AMBER} onClick={() => editTOs(1)} big />
                </StepRow>
            </Section>
        </div>
    );
};

// ── Timeout dash strip ──────────────────────────────────────
const TODashes: React.FC<{ remaining: number; total: number; color: string }> = ({
    remaining, total, color,
}) => (
    <div style={{ display: 'flex', gap: 5 }}>
        {Array.from({ length: total }).map((_, i) => {
            const active = i < remaining;
            return (
                <div key={i} style={{
                    width: 26, height: 7,
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
// CENTER CONTROL COLUMN
// ══════════════════════════════════════════════════════════════
const CenterControlColumn: React.FC<{
    clock: ClockState;
    possession: 'A' | 'B' | null;
    teamAColor: string; teamBColor: string;
    sendAction: Props['sendAction'];
    onEditTime: (mode: TimeEditorMode) => void;
}> = ({
    clock, possession, teamAColor, teamBColor, sendAction, onEditTime,
}) => {
    const live = clock.isRunning;
    const shotLow = clock.shotMs > 0 && clock.shotMs <= 5000;
    const showMs = clock.gameMs < 60_000;

    const adjGame = (deltaSec: number) => sendAction('EDIT_GAME_CLOCK', { amount: deltaSec });
    const setGame = (ms: number) => sendAction('SET_GAME_CLOCK', { ms });
    const adjShot = (deltaSec: number) => sendAction('EDIT_SHOT_CLOCK', { amount: deltaSec });
    const setShot = (ms: number) => sendAction('SET_SHOT_CLOCK', { ms });

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            background: '#070707',
            backgroundImage: `${SB_DOT_GRID}, radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)`,
            borderLeft: `1px solid ${SB_BDR_HI}`,
            borderRight: `1px solid ${SB_BDR_HI}`,
            overflow: 'hidden auto',
            padding: '14px 16px',
            gap: 14,
        }}>

            {/* COURT SETTINGS — collapsible, top of center column */}
            <CourtSettingsAccordion />

            {/* GAME CONTROL SETTINGS — flow prefs (clock-on-shot-violation etc.) */}
            <GameControlSettingsAccordion />

            {/* GAME CLOCK */}
            <div style={{
                display: 'flex', flexDirection: 'column',
                gap: 8,
                padding: 12,
                border: `1px solid ${SB_BDR}`,
                background: 'rgba(255,255,255,0.02)',
                position: 'relative',
            }}>
                <CornerBrackets color={SB_BDR_HI} size={8} thickness={1} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                        fontFamily: SB_RM, fontSize: 9, color: SB_DIM,
                        letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase',
                    }}>GAME CLOCK</span>
                    <span style={{
                        fontFamily: SB_RM, fontSize: 8,
                        color: live ? SB_GREEN : SB_AMBER,
                        letterSpacing: '0.22em', fontWeight: 700,
                    }}>· {live ? 'RUNNING' : 'PAUSED'}</span>
                </div>

                <div
                    onClick={() => onEditTime('game')}
                    style={{
                        cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                        textAlign: 'center', padding: '6px 0',
                    }}
                >
                    <span style={{
                        fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 72, lineHeight: 1, color: SB_WHITE,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.03em',
                        textShadow: live
                            ? `0 0 22px rgba(255,255,255,0.42)`
                            : `0 0 10px rgba(255,255,255,0.18)`,
                    }}>{fmtClock(clock.gameMs, showMs)}</span>
                </div>

                {/* 6-stepper row: ±1m ±5s ±1s */}
                <div style={{ display: 'flex', gap: 4 }}>
                    <Step label="−1m"  color={SB_WHITE} onClick={() => adjGame(-60)} flex />
                    <Step label="−5s"  color={SB_WHITE} onClick={() => adjGame(-5)}  flex />
                    <Step label="−1s"  color={SB_WHITE} onClick={() => adjGame(-1)}  flex />
                    <Step label="+1s"  color={SB_WHITE} onClick={() => adjGame(1)}   flex />
                    <Step label="+5s"  color={SB_WHITE} onClick={() => adjGame(5)}   flex />
                    <Step label="+1m"  color={SB_WHITE} onClick={() => adjGame(60)}  flex />
                </div>

                {/* Presets + EDIT EXACT */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Preset label="10:00" onClick={() => setGame(600_000)} />
                    <Preset label="5:00"  onClick={() => setGame(300_000)} />
                    <Preset label="1:00"  onClick={() => setGame( 60_000)} />
                    <Preset label="0:30"  onClick={() => setGame( 30_000)} />
                    <Preset label="0:10"  onClick={() => setGame( 10_000)} />
                    <div style={{ flex: 1 }} />
                    <Preset label="EDIT EXACT →" onClick={() => onEditTime('game')} accent />
                </div>
            </div>

            {/* SHOT CLOCK */}
            <div style={{
                display: 'flex', flexDirection: 'column',
                gap: 8,
                padding: 12,
                border: `1px solid ${shotLow ? SB_AWAY_C : SB_BDR}`,
                background: shotLow ? `${SB_AWAY_C}10` : 'rgba(255,255,255,0.02)',
                position: 'relative',
            }}>
                <CornerBrackets color={shotLow ? SB_AWAY_C : SB_BDR_HI} size={8} thickness={1} />
                <span style={{
                    fontFamily: SB_RM, fontSize: 9, color: shotLow ? SB_AWAY_C : SB_DIM,
                    letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase',
                }}>SHOT CLOCK</span>

                <div
                    onClick={() => onEditTime('shot')}
                    style={{
                        cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                        textAlign: 'center', padding: '4px 0',
                    }}
                >
                    <span style={{
                        fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 64, lineHeight: 1,
                        color: shotLow ? SB_AWAY_C : SB_AMBER,
                        fontVariantNumeric: 'tabular-nums',
                        textShadow: `0 0 18px ${shotLow ? SB_AWAY_C : SB_AMBER}aa`,
                    }}>{fmtShot(clock.shotMs)}</span>
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                    <Step label="−5" color={SB_AMBER} onClick={() => adjShot(-5)} flex />
                    <Step label="−1" color={SB_AMBER} onClick={() => adjShot(-1)} flex />
                    <Step label="+1" color={SB_AMBER} onClick={() => adjShot(1)}  flex />
                    <Step label="+5" color={SB_AMBER} onClick={() => adjShot(5)}  flex />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Preset label="24" onClick={() => setShot(24_000)} />
                    <Preset label="14" onClick={() => setShot(14_000)} />
                    <Preset label="8"  onClick={() => setShot( 8_000)} />
                    <Preset label="0"  onClick={() => setShot(     0)} />
                    <div style={{ flex: 1 }} />
                    <Preset label="EDIT EXACT →" onClick={() => onEditTime('shot')} accent />
                </div>
            </div>

            {/* PERIOD */}
            <div style={{
                display: 'flex', flexDirection: 'column',
                gap: 8, padding: 12,
                border: `1px solid ${SB_BDR}`, background: 'rgba(255,255,255,0.02)',
                position: 'relative',
            }}>
                <CornerBrackets color={SB_BDR_HI} size={8} thickness={1} />
                <span style={{
                    fontFamily: SB_RM, fontSize: 9, color: SB_DIM,
                    letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase',
                }}>PERIOD</span>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <Step label="← BACK" color={SB_WHITE} onClick={() => sendAction('EDIT_PERIOD', { amount: -1 })} flex />
                    <div style={{
                        flex: 1.2,
                        textAlign: 'center',
                        fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                        fontSize: 28, color: SB_WHITE,
                        letterSpacing: '0.04em',
                    }}>
                        {periodLabel(clock.period, clock.totalPeriods)}
                        <span style={{ fontFamily: SB_RM, fontSize: 9, color: SB_DIM, letterSpacing: '0.18em', marginLeft: 8 }}>
                            · {clock.period}/{clock.totalPeriods}
                        </span>
                    </div>
                    <Step label="NEXT →" color={SB_AMBER} onClick={() => sendAction('NEXT_PERIOD')} flex />
                </div>
                <Step label="+ OVERTIME" color={SB_GREEN} onClick={() => sendAction('NEXT_PERIOD', { forceOT: true })} />
            </div>

            {/* POSSESSION */}
            <div style={{
                display: 'flex', flexDirection: 'column',
                gap: 8, padding: 12,
                border: `1px solid ${SB_BDR}`, background: 'rgba(255,255,255,0.02)',
                position: 'relative',
            }}>
                <CornerBrackets color={SB_BDR_HI} size={8} thickness={1} />
                <span style={{
                    fontFamily: SB_RM, fontSize: 9, color: SB_DIM,
                    letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase',
                }}>POSSESSION</span>
                <div style={{ display: 'flex', gap: 4 }}>
                    <PossessionToggle
                        label="◀ HOME"
                        color={teamAColor}
                        active={possession === 'A'}
                        onClick={() => sendAction('SET_POSSESSION', { team: 'A' })}
                    />
                    <PossessionToggle
                        label="— NONE —"
                        color={SB_DIM}
                        active={possession === null}
                        onClick={() => sendAction('SET_POSSESSION', { team: null })}
                    />
                    <PossessionToggle
                        label="AWAY ▶"
                        color={teamBColor}
                        active={possession === 'B'}
                        onClick={() => sendAction('SET_POSSESSION', { team: 'B' })}
                    />
                </div>
            </div>

            {/* BUZZER */}
            <div
                onClick={() => sendAction('TRIGGER_BUZZER', { type: 'SHORT' })}
                style={{
                    height: 56, position: 'relative',
                    border: `1px solid ${SB_ORANGE}66`,
                    background: `linear-gradient(180deg, ${SB_ORANGE}1a 0%, ${SB_ORANGE}06 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    cursor: 'pointer', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    boxShadow: `inset 0 1px 0 ${SB_ORANGE}44`,
                    transition: 'background 0.12s, transform 0.06s',
                }}
                onTouchStart={e => {
                    (e.currentTarget as HTMLElement).style.background = `linear-gradient(180deg, ${SB_ORANGE}66 0%, ${SB_ORANGE}33 100%)`;
                    (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
                }}
                onTouchEnd={e => {
                    (e.currentTarget as HTMLElement).style.background = `linear-gradient(180deg, ${SB_ORANGE}1a 0%, ${SB_ORANGE}06 100%)`;
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
            >
                <CornerBrackets color={SB_ORANGE} size={10} thickness={1} />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SB_ORANGE} strokeWidth="2.5" strokeLinecap="square">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
                <span style={{
                    fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 16, color: SB_ORANGE,
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                    textShadow: `0 0 10px ${SB_ORANGE}88`,
                }}>TRIGGER BUZZER</span>
            </div>

            {/* SCORING CONSOLE PREFERENCES */}
            <ConsolePrefsCard />
        </div>
    );
};

const ConsolePrefsCard: React.FC = () => {
    const [theme, setTheme] = useState<string>(() => localStorage.getItem('boxv2-console-theme') || 'dark');
    const [grid, setGrid] = useState<string>(() => localStorage.getItem('boxv2-console-grid') || 'hover');
    const [scoreboardTheme, setSbTheme] = useScoreboardTheme();
    const [heatPalette, setHeatPaletteState] = useHeatPalette();
    const [reducedMotionOverride, setReducedMotionOverrideState] = useState<'auto' | 'on' | 'off'>(() => {
        const v = getReducedMotionOverride();
        return v === true ? 'on' : v === false ? 'off' : 'auto';
    });
    const setRm = (v: 'auto' | 'on' | 'off') => {
        setReducedMotionOverrideState(v);
        setReducedMotionOverride(v === 'auto' ? null : v === 'on');
    };
    const pickTheme = (v: string) => { setTheme(v); localStorage.setItem('boxv2-console-theme', v); };
    const pickGrid = (v: string) => { setGrid(v); localStorage.setItem('boxv2-console-grid', v); };
    const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <span style={{
            fontFamily: SB_RM, fontSize: 9, color: SB_DIM,
            letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase',
        }}>{children}</span>
    );
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: 10, padding: 12,
            border: `1px solid ${SB_BDR}`, background: 'rgba(255,255,255,0.02)',
            position: 'relative',
        }}>
            <CornerBrackets color={SB_BDR_HI} size={8} thickness={1} />
            <Label>SCORING CONSOLE</Label>

            {/* SCOREBOARD THEME — switch the live referee scoreboard look */}
            <Label>Scoreboard theme</Label>
            <div style={{ display: 'flex', gap: 4 }}>
                <PossessionToggle label="CLASSIC" color={SB_GREEN} active={scoreboardTheme === 'classic'} onClick={() => setSbTheme('classic')} />
                <PossessionToggle label="MINIMAL" color={SB_GREEN} active={scoreboardTheme === 'minimal'} onClick={() => setSbTheme('minimal')} />
            </div>

            {/* HEATMAP PALETTE — for the advanced shot court */}
            <Label>Shot heatmap palette</Label>
            <div style={{ display: 'flex', gap: 4 }}>
                <PossessionToggle label="CIVIDIS" color={SB_GREEN} active={heatPalette === 'cividis'} onClick={() => setHeatPaletteState('cividis')} />
                <PossessionToggle label="CLASSIC" color={SB_GREEN} active={heatPalette === 'classic'} onClick={() => setHeatPaletteState('classic')} />
            </div>

            {/* MOTION — override system prefers-reduced-motion */}
            <Label>Motion (animations)</Label>
            <div style={{ display: 'flex', gap: 4 }}>
                <PossessionToggle label="AUTO"   color={SB_GREEN} active={reducedMotionOverride === 'auto'} onClick={() => setRm('auto')} />
                <PossessionToggle label="REDUCE" color={SB_GREEN} active={reducedMotionOverride === 'on'}   onClick={() => setRm('on')} />
                <PossessionToggle label="FULL"   color={SB_GREEN} active={reducedMotionOverride === 'off'}  onClick={() => setRm('off')} />
            </div>

            <Label>Court theme</Label>
            <div style={{ display: 'flex', gap: 4 }}>
                {[['dark', 'VOID'], ['wooden', 'HARDWOOD'], ['white', 'BLUEPRINT']].map(([v, l]) => (
                    <PossessionToggle key={v} label={l} color={SB_GREEN} active={theme === v} onClick={() => pickTheme(v)} />
                ))}
            </div>
            <Label>Hex grid</Label>
            <div style={{ display: 'flex', gap: 4 }}>
                {[['off', 'OFF'], ['hover', 'ON HOVER'], ['always', 'ALWAYS']].map(([v, l]) => (
                    <PossessionToggle key={v} label={l} color={SB_GREEN} active={grid === v} onClick={() => pickGrid(v)} />
                ))}
            </div>
        </div>
    );
};

// ── Court settings accordion (sits at top of center column) ──
const GameControlSettingsAccordion: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [keepClock, setKeepClock]   = useKeepClockOnShotViolation();
    const [minHeader, setMinHeader]   = useMinimizeHeader();
    const [noPopup, setNoPopup]       = useDisableScorePopup();
    const [noTouch, setNoTouch]       = useDisableTouchDeck();
    const [shotType, setShotType]     = useShotTypeSelection();
    const [quickEntry, setQuickEntry] = useQuickEntry();

    const Toggle: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
        <div
            onClick={onToggle}
            style={{
                width: 44, height: 24, borderRadius: 12,
                background: on ? SB_GREEN : 'rgba(255,255,255,0.12)',
                border: `1px solid ${on ? SB_GREEN : 'rgba(255,255,255,0.2)'}`,
                position: 'relative', cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.18s, border-color 0.18s',
                WebkitTapHighlightColor: 'transparent',
            }}
        >
            <div style={{
                position: 'absolute', top: 2,
                left: on ? 22 : 2,
                width: 18, height: 18, borderRadius: 9,
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transition: 'left 0.18s',
            }} />
        </div>
    );

    const PrefRow: React.FC<{
        title: string; help: string; on: boolean; onToggle: () => void;
    }> = ({ title, help, on, onToggle }) => (
        <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, padding: '10px 0',
            borderTop: `1px solid ${SB_BDR}`,
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{
                    fontFamily: SB_RM, fontSize: 10, color: SB_WHITE,
                    fontWeight: 700, letterSpacing: '0.06em',
                }}>{title}</span>
                <span style={{
                    fontFamily: SB_RM, fontSize: 9, color: SB_DIM,
                    lineHeight: 1.4,
                }}>{help}</span>
            </div>
            <Toggle on={on} onToggle={onToggle} />
        </div>
    );

    return (
        <div style={{
            border: `1px solid ${open ? SB_AMBER + '55' : SB_BDR}`,
            background: open ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
            position: 'relative',
            transition: 'border-color 0.15s, background 0.15s',
        }}>
            <CornerBrackets color={open ? SB_AMBER + '88' : SB_BDR_HI} size={8} thickness={1} />
            <div
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 14px',
                    cursor: 'pointer', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Clock icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? SB_AMBER : SB_DIM} strokeWidth="2" strokeLinecap="square">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                    </svg>
                    <span style={{
                        fontFamily: SB_RM, fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.28em', textTransform: 'uppercase',
                        color: open ? SB_AMBER : SB_WHITE,
                    }}>GAME CONTROL SETTINGS</span>
                </div>
                <span style={{
                    fontFamily: SB_RM, fontSize: 10, color: open ? SB_AMBER : SB_DIM,
                    transform: open ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.18s',
                    display: 'inline-block',
                }}>▼</span>
            </div>

            {open && (
                <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column' }}>
                    <PrefRow
                        title="Keep clock after shot violation"
                        help="Game clock keeps ticking when shot clock hits 0. Shot clock blinks red as a reset reminder. Off = FIBA auto-stop."
                        on={keepClock}
                        onToggle={() => setKeepClock(!keepClock)}
                    />
                    <PrefRow
                        title="Minimize header"
                        help="Collapse the top bar to a single gear icon."
                        on={minHeader}
                        onToggle={() => setMinHeader(!minHeader)}
                    />
                    <PrefRow
                        title="Skip player picker"
                        help="Score updates instantly — no WHO SCORED popup. Useful for fast games where player stats don't matter."
                        on={noPopup}
                        onToggle={() => setNoPopup(!noPopup)}
                    />
                    <PrefRow
                        title="Disable touch deck"
                        help="Hide the on-screen scoring deck. Score via hardware buttons only."
                        on={noTouch}
                        onToggle={() => setNoTouch(!noTouch)}
                    />
                    <PrefRow
                        title="Shot type tagging"
                        help="Add a context step after player pick — tag Fastbreak, Contested, Pull-up, etc. Off by default."
                        on={shotType}
                        onToggle={() => setShotType(!shotType)}
                    />
                    <PrefRow
                        title="Quick entry chips"
                        help="Show quick-spot shortcut buttons on the court (Rim, Mid, Corner 3, Top 3, etc.) for fast one-tap location entry."
                        on={quickEntry}
                        onToggle={() => setQuickEntry(!quickEntry)}
                    />
                </div>
            )}
        </div>
    );
};

const CourtSettingsAccordion: React.FC = () => {
    const [open, setOpen] = useState(false);
    return (
        <div style={{
            border: `1px solid ${open ? SB_GREEN + '55' : SB_BDR}`,
            background: open ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)',
            position: 'relative',
            transition: 'border-color 0.15s, background 0.15s',
        }}>
            <CornerBrackets color={open ? SB_GREEN + '88' : SB_BDR_HI} size={8} thickness={1} />

            {/* Header — always visible tap target */}
            <div
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 14px',
                    cursor: 'pointer', userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Hex icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? SB_GREEN : SB_DIM} strokeWidth="2" strokeLinecap="square">
                        <polygon points="12 2 22 7 22 17 12 22 2 17 2 7"/>
                    </svg>
                    <span style={{
                        fontFamily: SB_RM, fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.28em', textTransform: 'uppercase',
                        color: open ? SB_GREEN : SB_WHITE,
                    }}>COURT SETTINGS</span>
                </div>
                <span style={{
                    fontFamily: SB_RM, fontSize: 10, color: open ? SB_GREEN : SB_DIM,
                    transform: open ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.18s',
                    display: 'inline-block',
                }}>▼</span>
            </div>

            {/* Body — collapsed by default */}
            {open && (
                <div style={{ padding: '0 14px 14px' }}>
                    <PiCourtCard />
                </div>
            )}
        </div>
    );
};

const PiCourtCard: React.FC = () => {
    // ── localStorage helpers ───────────────────────────────────
    const lsG  = (k: string, d: string)  => localStorage.getItem(k) ?? d;
    const lsB  = (k: string, d: boolean) => { const v = localStorage.getItem(k); return v === null ? d : v === 'true'; };
    const lsN  = (k: string, d: number)  => { const v = localStorage.getItem(k); const n = v ? parseFloat(v) : NaN; return isNaN(n) ? d : n; };
    const save = (k: string, v: string | boolean | number) => localStorage.setItem(k, String(v));

    // ── state (keys match PiHexCourt LS object exactly) ────────
    const [fullCourt,    setFullCourt]    = useState(() => lsB('boxv2-pi-court-fullcourt', true));
    const [units,        setUnits]        = useState(() => lsG('boxv2-pi-court-units', 'm'));
    const [piTheme,      setPiTheme]      = useState(() => lsG('boxv2-pi-court-theme', 'dark'));
    const [shotMode,     setShotMode]     = useState(() => lsG('boxv2-pi-court-shotmode', 'made'));
    const [viewMode,     setViewMode]     = useState(() => lsG('boxv2-pi-court-viewmode', 'hex'));
    const [hexSize,      setHexSize]      = useState(() => lsN('boxv2-pi-court-hexsize', 25));
    const [gridOutlines, setGridOutlines] = useState(() => lsB('boxv2-pi-court-gridoutlines', true));
    const [zoneTint,     setZoneTint]     = useState(() => lsB('boxv2-pi-court-zonetint', true));
    const [heatmap,      setHeatmap]      = useState(() => lsB('boxv2-pi-court-heatmap', false));
    const [distRings,    setDistRings]    = useState(() => lsB('boxv2-pi-court-distrings', false));
    const [lineRim,      setLineRim]      = useState(() => lsB('boxv2-pi-court-linetorim', false));
    const [zoneLabels,   setZoneLabels]   = useState(() => lsB('boxv2-pi-court-zonelabels', true));
    const [rimAccent,    setRimAccent]    = useState(() => lsB('boxv2-pi-court-rimaccent', false));
    const [chevrons,     setChevrons]     = useState(() => lsB('boxv2-pi-court-chevrons', false));

    // ── sub-components ─────────────────────────────────────────
    const SectionHdr: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <span style={{
            fontFamily: SB_RM, fontSize: 8, color: 'rgba(255,255,255,0.28)',
            letterSpacing: '0.30em', fontWeight: 700, textTransform: 'uppercase',
            marginTop: 6, display: 'block',
        }}>{children}</span>
    );

    const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 }}>
            <span style={{
                fontFamily: SB_RM, fontSize: 9, color: SB_DIM,
                letterSpacing: '0.18em', fontWeight: 600, textTransform: 'uppercase',
            }}>{label}</span>
            {children}
        </div>
    );

    // iOS-style pill toggle
    const IosToggle: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
        <div
            onClick={onToggle}
            style={{
                width: 40, height: 22, borderRadius: 11,
                background: on ? '#EF4444' : 'rgba(255,255,255,0.12)',
                border: `1px solid ${on ? '#EF4444' : 'rgba(255,255,255,0.2)'}`,
                position: 'relative', cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.18s, border-color 0.18s',
                WebkitTapHighlightColor: 'transparent',
            }}
        >
            <div style={{
                position: 'absolute', top: 2,
                left: on ? 19 : 2,
                width: 16, height: 16, borderRadius: 8,
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transition: 'left 0.18s',
            }} />
        </div>
    );

    // Segmented chips row
    const Seg: React.FC<{ opts: [string, string][]; val: string; onChange: (v: string) => void }> = ({ opts, val, onChange }) => (
        <div style={{ display: 'flex', gap: 3 }}>
            {opts.map(([v, l]) => (
                <div
                    key={v}
                    onClick={() => onChange(v)}
                    style={{
                        padding: '5px 10px',
                        background: val === v ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${val === v ? '#EF4444aa' : 'rgba(255,255,255,0.12)'}`,
                        color: val === v ? '#EF4444' : SB_DIM,
                        fontFamily: SB_RM, fontSize: 8, fontWeight: 700,
                        letterSpacing: '0.2em', textTransform: 'uppercase',
                        cursor: 'pointer', userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                    }}
                >{l}</div>
            ))}
        </div>
    );

    const DataBtn: React.FC<{ label: string; accent?: string; onClick: () => void }> = ({ label, accent = SB_DIM, onClick }) => (
        <div
            onClick={onClick}
            style={{
                padding: '9px 0', textAlign: 'center',
                border: `1px solid ${accent}55`,
                background: `${accent}0d`,
                color: accent, fontFamily: SB_RM,
                fontSize: 8, fontWeight: 700,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                cursor: 'pointer', userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.1s',
            }}
        >{label}</div>
    );

    // Compact 2-up toggle row — puts two labeled toggles side-by-side
    const TogglePair: React.FC<{
        items: { label: string; on: boolean; onToggle: () => void }[];
    }> = ({ items }) => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {items.map(({ label, on, onToggle }) => (
                <div key={label}
                    onClick={onToggle}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 8px',
                        background: on ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${on ? '#EF4444aa' : 'rgba(255,255,255,0.10)'}`,
                        cursor: 'pointer', userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'background 0.12s, border-color 0.12s',
                    }}
                >
                    <span style={{
                        fontFamily: SB_RM, fontSize: 8, fontWeight: 700,
                        color: on ? '#EF4444' : SB_DIM,
                        letterSpacing: '0.16em', textTransform: 'uppercase',
                    }}>{label}</span>
                    <IosToggle on={on} onToggle={() => {}} />
                </div>
            ))}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* VIEW + THEME in one row each ─────────────────── */}
            <SectionHdr>View &amp; theme</SectionHdr>
            <Row label="Court">
                <Seg opts={[['false','HALF'],['true','FULL']]} val={String(fullCourt)}
                    onChange={v => { const b = v === 'true'; setFullCourt(b); save('boxv2-pi-court-fullcourt', b); }} />
            </Row>
            <Row label="Theme">
                <Seg opts={[['dark','VOID'],['wooden','WOOD'],['white','LIGHT'],['hicontrast','A11Y']]} val={piTheme}
                    onChange={v => { setPiTheme(v); save('boxv2-pi-court-theme', v); }} />
            </Row>
            <Row label="Units">
                <Seg opts={[['m','M'],['ft','FT']]} val={units}
                    onChange={v => { setUnits(v); save('boxv2-pi-court-units', v); }} />
            </Row>
            <Row label="Default mark">
                <Seg opts={[['made','MADE'],['miss','MISS']]} val={shotMode}
                    onChange={v => { setShotMode(v); save('boxv2-pi-court-shotmode', v); }} />
            </Row>
            <Row label="View mode">
                <Seg opts={[['hex','HEX'],['zone','ZONE'],['dots','DOTS']]} val={viewMode}
                    onChange={v => { setViewMode(v); save('boxv2-pi-court-viewmode', v); }} />
            </Row>

            {/* HEX GRID ──────────────────────────────────────── */}
            <SectionHdr>Hex grid</SectionHdr>
            <Row label={`Hex size  ${hexSize} cm`}>
                <input
                    type="range" min={15} max={60} step={1} value={hexSize}
                    onChange={e => { const n = parseInt(e.target.value); setHexSize(n); save('boxv2-pi-court-hexsize', n); }}
                    style={{ width: 100, accentColor: '#EF4444', cursor: 'pointer' }}
                />
            </Row>
            <TogglePair items={[
                { label: 'Outlines',  on: gridOutlines, onToggle: () => { const n = !gridOutlines; setGridOutlines(n); save('boxv2-pi-court-gridoutlines', n); } },
                { label: 'Zone tint', on: zoneTint,     onToggle: () => { const n = !zoneTint;     setZoneTint(n);     save('boxv2-pi-court-zonetint', n); } },
                { label: 'Heatmap',   on: heatmap,      onToggle: () => { const n = !heatmap;      setHeatmap(n);      save('boxv2-pi-court-heatmap', n); } },
                { label: 'Zone labels', on: zoneLabels, onToggle: () => { const n = !zoneLabels;   setZoneLabels(n);   save('boxv2-pi-court-zonelabels', n); } },
            ]} />

            {/* COURT AIDS ────────────────────────────────────── */}
            <SectionHdr>Court aids</SectionHdr>
            <TogglePair items={[
                { label: 'Dist. rings', on: distRings, onToggle: () => { const n = !distRings; setDistRings(n); save('boxv2-pi-court-distrings', n); } },
                { label: 'Line to rim', on: lineRim,   onToggle: () => { const n = !lineRim;   setLineRim(n);   save('boxv2-pi-court-linetorim', n); } },
                { label: 'Rim accent',  on: rimAccent, onToggle: () => { const n = !rimAccent; setRimAccent(n); save('boxv2-pi-court-rimaccent', n); } },
                { label: 'Chevrons',    on: chevrons,  onToggle: () => { const n = !chevrons;  setChevrons(n);  save('boxv2-pi-court-chevrons', n); } },
            ]} />

            {/* DATA ───────────────────────────────────────────── */}
            <SectionHdr>Data</SectionHdr>
            <DataBtn label="Clear all shots" accent="#EF4444"
                onClick={() => { if (confirm('Clear all shot data?')) localStorage.removeItem('boxv2-local-shots'); }} />
        </div>
    );
};

// ══════════════════════════════════════════════════════════════
// SHARED STEPPER / SECTION HELPERS
// ══════════════════════════════════════════════════════════════
const Section: React.FC<{
    title: string;
    align: 'left' | 'right';
    caption?: string;
    children: React.ReactNode;
}> = ({ title, align, caption, children }) => (
    <div style={{
        padding: '12px 24px',
        borderBottom: `1px solid ${SB_BDR}`,
        display: 'flex', flexDirection: 'column',
        alignItems: align === 'left' ? 'stretch' : 'stretch',
        gap: 8,
    }}>
        <div style={{
            display: 'flex',
            flexDirection: align === 'left' ? 'row' : 'row-reverse',
            alignItems: 'baseline', gap: 8,
        }}>
            <span style={{
                fontFamily: SB_RM, fontSize: 9, color: SB_DIM,
                letterSpacing: '0.30em', fontWeight: 700, textTransform: 'uppercase',
            }}>{title}</span>
            {caption && (
                <span style={{
                    fontFamily: SB_RM, fontSize: 7, color: 'rgba(255,255,255,0.32)',
                    letterSpacing: '0.22em', fontWeight: 600,
                }}>· {caption}</span>
            )}
        </div>
        {children}
    </div>
);

const StepRow: React.FC<{ flow: 'row' | 'row-reverse'; children: React.ReactNode }> = ({
    flow, children,
}) => (
    <div style={{ display: 'flex', flexDirection: flow, gap: 4 }}>
        {children}
    </div>
);

const Step: React.FC<{
    label: string;
    color: string;
    onClick: () => void;
    big?: boolean;
    hint?: boolean;
    flex?: boolean;
    disabled?: boolean;
}> = ({ label, color, onClick, big = false, hint = false, flex = false, disabled = false }) => (
    <div
        onClick={disabled ? undefined : onClick}
        style={{
            flex: flex ? 1 : 'none',
            minWidth: big ? 56 : 44,
            height: big ? 48 : 40,
            padding: hint ? '0 14px' : '0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: hint ? 'transparent' : `${color}14`,
            border: `1px solid ${hint ? SB_BDR_HI : `${color}55`}`,
            color: disabled ? SB_DIM : color,
            fontFamily: hint ? SB_RM : SB_OSW,
            fontStyle: hint ? 'normal' : 'italic',
            fontWeight: 700,
            fontSize: hint ? 9 : (big ? 18 : 14),
            letterSpacing: hint ? '0.22em' : '0.04em',
            textTransform: hint ? 'uppercase' : 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.35 : 1,
            userSelect: 'none', WebkitTapHighlightColor: 'transparent',
            boxShadow: hint ? 'none' : `inset 0 1px 0 ${color}22`,
            transition: 'background 0.12s, transform 0.06s',
        }}
        onTouchStart={e => {
            if (disabled) return;
            (e.currentTarget as HTMLElement).style.background = `${color}44`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
        }}
        onTouchEnd={e => {
            (e.currentTarget as HTMLElement).style.background = hint ? 'transparent' : `${color}14`;
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >{label}</div>
);

const Preset: React.FC<{ label: string; onClick: () => void; accent?: boolean }> = ({
    label, onClick, accent = false,
}) => (
    <div
        onClick={onClick}
        style={{
            padding: '5px 10px',
            border: `1px solid ${accent ? SB_AMBER : SB_BDR_HI}`,
            background: accent ? `${SB_AMBER}1a` : 'rgba(255,255,255,0.025)',
            color: accent ? SB_AMBER : SB_WHITE,
            fontFamily: accent ? SB_RM : SB_OSW,
            fontStyle: accent ? 'normal' : 'italic',
            fontWeight: 700,
            fontSize: accent ? 8 : 11,
            letterSpacing: accent ? '0.22em' : '0.04em',
            textTransform: accent ? 'uppercase' : 'none',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.12s, transform 0.06s',
        }}
        onTouchStart={e => {
            (e.currentTarget as HTMLElement).style.background = accent ? `${SB_AMBER}33` : 'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
        }}
        onTouchEnd={e => {
            (e.currentTarget as HTMLElement).style.background = accent ? `${SB_AMBER}1a` : 'rgba(255,255,255,0.025)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
    >{label}</div>
);

const PossessionToggle: React.FC<{
    label: string; color: string; active: boolean; onClick: () => void;
}> = ({ label, color, active, onClick }) => (
    <div
        onClick={onClick}
        style={{
            flex: 1, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${active ? color : `${color}33`}`,
            background: active ? `${color}1f` : 'transparent',
            color: active ? color : SB_DIM,
            fontFamily: SB_OSW, fontStyle: 'italic', fontWeight: 700,
            fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: active ? `0 0 10px ${color}44, inset 0 1px 0 ${color}33` : 'none',
            transition: 'all 0.12s',
        }}
        onTouchStart={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
        onTouchEnd={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
    >{label}</div>
);

export default UnlockedSettings;
