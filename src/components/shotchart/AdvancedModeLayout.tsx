// src/components/shotchart/AdvancedModeLayout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Advanced Stats Mode: Single-Screen Scoring Layout
//
// Replaces the standard HostConsole control deck when Advanced mode is active.
// Everything on one screen — no bottom sheets, no sequential steps.
//
// Layout (landscape):
//   ┌──────────────────────────────────────────────────────────────┐
//   │  TEAM A SCORING  │   HALF COURT + ATTRIBUTES   │  TEAM B    │
//   │  Made/Miss btns  │   (always visible, tappable) │  Made/Miss │
//   │  Player select   │   Shot confirmation dots     │  Player    │
//   │  Secondary acts  │   Attribute pills below      │  Secondary │
//   └──────────────────────────────────────────────────────────────┘
//
// Flow: Select player → Tap Made/Miss → Tap court → Tap attributes → Done
// (Any step can be skipped. Order is flexible.)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { HalfCourt } from './HalfCourt';
import { classifyZone, SHOT_ATTRIBUTES, ZONES } from './courtZones';
import type {
    ShotEvent, ShotAttribute, ShotZoneId, ShotType, CourtMode, GameActionType,
} from './types/shotTypes';
import type { Player } from '../../types';

// ── Props ────────────────────────────────────────────────────────────────────

interface AdvancedModeLayoutProps {
    // Team data
    teamAName: string;
    teamAColor: string;
    teamAPlayers: Player[];
    teamBName: string;
    teamBColor: string;
    teamBPlayers: Player[];
    // Score handlers (these update the actual scoreboard)
    onScoreChange: (team: 'A' | 'B', points: number) => void;
    // Shot event handler (saves to DB)
    onShotRecorded: (shot: {
        teamSide: 'A' | 'B';
        playerId: string | null;
        points: 1 | 2 | 3;
        made: boolean;
        shotType: ShotType;
        x: number | null;
        y: number | null;
        zone: ShotZoneId;
        attributes: ShotAttribute[];
    }) => void;
    // Secondary action handler
    onSecondaryAction: (team: 'A' | 'B', action: GameActionType) => void;
    // Existing shot data for this game (onion-skinning)
    existingShots: ShotEvent[];
    // Game clock info (for display, not control)
    period: number;
    gameClockSec: number;
    // Is game clock running
    gameRunning: boolean;
}

// ── Pending shot state ───────────────────────────────────────────────────────

interface PendingShot {
    teamSide: 'A' | 'B';
    points: 1 | 2 | 3;
    made: boolean;
    shotType: ShotType;
    playerId: string | null;
    playerName: string | null;
}

// ── Confirmed shot (shown on court with animation) ───────────────────────────

interface ConfirmedDot {
    id: string;
    x: number;
    y: number;
    made: boolean;
    points: 1 | 2 | 3;
    zone: ShotZoneId;
    timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const AdvancedModeLayout: React.FC<AdvancedModeLayoutProps> = ({
    teamAName, teamAColor, teamAPlayers,
    teamBName, teamBColor, teamBPlayers,
    onScoreChange, onShotRecorded, onSecondaryAction,
    existingShots, period, gameClockSec, gameRunning,
}) => {
    // ── State ────────────────────────────────────────────────────────────────

    // Currently selected player (persists across shots for streaks)
    const [selectedPlayerA, setSelectedPlayerA] = useState<string | null>(null);
    const [selectedPlayerB, setSelectedPlayerB] = useState<string | null>(null);

    // Pending shot waiting for court tap
    const [pending, setPending] = useState<PendingShot | null>(null);

    // Confirmed shots for this session (visual feedback on court)
    const [confirmedDots, setConfirmedDots] = useState<ConfirmedDot[]>([]);

    // Selected attributes for the current/next shot
    const [activeAttrs, setActiveAttrs] = useState<ShotAttribute[]>([]);

    // Court interaction mode
    const [courtMode, setCourtMode] = useState<CourtMode>('zone');

    // Pending shot pulse timer (auto-cancel after 8s)
    const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Derived ──────────────────────────────────────────────────────────────

    const activeTeamColor = pending?.teamSide === 'A' ? teamAColor : pending?.teamSide === 'B' ? teamBColor : '#555';

    const getSelectedPlayer = (side: 'A' | 'B') => side === 'A' ? selectedPlayerA : selectedPlayerB;
    const getPlayers = (side: 'A' | 'B') => (side === 'A' ? teamAPlayers : teamBPlayers).filter(p => p.name);

    // Merge existing shots + confirmed dots for court display
    const courtDots = useMemo(() => {
        const existing = existingShots
            .filter(s => s.zone !== 'unlocated')
            .map(s => ({ id: s.id, x: s.x, y: s.y, made: s.made, points: s.points as 1 | 2 | 3 }));

        const confirmed = confirmedDots.map(d => ({
            id: d.id, x: d.x, y: d.y, made: d.made, points: d.points,
            isLatest: Date.now() - d.timestamp < 3000,
        }));

        return [...existing, ...confirmed];
    }, [existingShots, confirmedDots]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    // Clear pending timeout
    const clearPendingTimeout = useCallback(() => {
        if (pendingTimeoutRef.current) {
            clearTimeout(pendingTimeoutRef.current);
            pendingTimeoutRef.current = null;
        }
    }, []);

    // Finalize and record a shot (with or without location)
    const finalizeShot = useCallback((
        shot: PendingShot,
        x: number | null,
        y: number | null,
        zone: ShotZoneId,
    ) => {
        onShotRecorded({
            teamSide: shot.teamSide,
            playerId: shot.playerId,
            points: shot.points,
            made: shot.made,
            shotType: shot.shotType,
            x, y, zone,
            attributes: activeAttrs,
        });

        // Add confirmed dot for visual feedback
        if (x !== null && y !== null && zone !== 'unlocated') {
            setConfirmedDots(prev => [...prev.slice(-30), {
                id: `cd-${Date.now()}`,
                x, y,
                made: shot.made,
                points: shot.points,
                zone,
                timestamp: Date.now(),
            }]);
        }

        // Reset
        setPending(null);
        setActiveAttrs([]);
        clearPendingTimeout();
    }, [onShotRecorded, activeAttrs, clearPendingTimeout]);

    // MADE button tapped
    const handleMade = useCallback((side: 'A' | 'B', points: 1 | 2 | 3, shotType: ShotType) => {
        // If there's a pending shot that wasn't placed, save it unlocated first
        if (pending) {
            finalizeShot(pending, null, null, 'unlocated');
        }

        // Update actual score immediately
        onScoreChange(side, points);

        const playerId = getSelectedPlayer(side);
        const player = getPlayers(side).find(p => p.id === playerId);

        const newPending: PendingShot = {
            teamSide: side, points, made: true, shotType,
            playerId: playerId, playerName: player?.name || null,
        };

        if (shotType === 'free_throw') {
            // FT: auto-finalize at FT line, no court tap needed
            finalizeShot(newPending, 50, 19, 'mid_top');
        } else {
            // Field goal: set pending, wait for court tap
            setPending(newPending);
            clearPendingTimeout();
            pendingTimeoutRef.current = setTimeout(() => {
                // Auto-save without location after 8s
                finalizeShot(newPending, null, null, 'unlocated');
            }, 8000);
        }
    }, [pending, onScoreChange, finalizeShot, clearPendingTimeout, selectedPlayerA, selectedPlayerB, teamAPlayers, teamBPlayers]);

    // MISS button tapped
    const handleMiss = useCallback((side: 'A' | 'B', points: 2 | 3, shotType: ShotType) => {
        if (pending) {
            finalizeShot(pending, null, null, 'unlocated');
        }

        // NO score change for misses
        const playerId = getSelectedPlayer(side);
        const player = getPlayers(side).find(p => p.id === playerId);

        const newPending: PendingShot = {
            teamSide: side, points, made: false, shotType,
            playerId: playerId, playerName: player?.name || null,
        };

        setPending(newPending);
        clearPendingTimeout();
        pendingTimeoutRef.current = setTimeout(() => {
            finalizeShot(newPending, null, null, 'unlocated');
        }, 8000);
    }, [pending, finalizeShot, clearPendingTimeout, selectedPlayerA, selectedPlayerB, teamAPlayers, teamBPlayers]);

    const handleMissFT = useCallback((side: 'A' | 'B') => {
        if (pending) finalizeShot(pending, null, null, 'unlocated');
        const playerId = getSelectedPlayer(side);
        const newPending: PendingShot = {
            teamSide: side, points: 1, made: false, shotType: 'free_throw',
            playerId, playerName: null,
        };
        finalizeShot(newPending, 50, 19, 'mid_top');
    }, [pending, finalizeShot, selectedPlayerA, selectedPlayerB]);

    // Court tapped — place the pending shot
    const handleCourtTap = useCallback((rawX: number, rawY: number) => {
        if (!pending) return;

        let x = rawX;
        let y = rawY;
        let zone = classifyZone(rawX, rawY);

        // In zone mode, snap to centroid
        if (courtMode === 'zone') {
            const z = ZONES[zone];
            if (z) { x = z.cx; y = z.cy; }
        }

        finalizeShot(pending, x, y, zone);
    }, [pending, courtMode, finalizeShot]);

    // Toggle attribute
    const handleToggleAttr = useCallback((attr: ShotAttribute) => {
        setActiveAttrs(prev =>
            prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
        );
    }, []);

    // Cleanup on unmount
    useEffect(() => clearPendingTimeout, [clearPendingTimeout]);

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="w-full h-full flex gap-2 p-2 bg-black" style={{ minHeight: 340 }}>

            {/* ═══ LEFT: TEAM A CONTROLS ═══ */}
            <TeamScoringColumn
                side="A"
                teamName={teamAName}
                teamColor={teamAColor}
                players={teamAPlayers.filter(p => p.name)}
                selectedPlayerId={selectedPlayerA}
                onSelectPlayer={setSelectedPlayerA}
                onMade={(pts, type) => handleMade('A', pts, type)}
                onMiss={(pts, type) => handleMiss('A', pts, type)}
                onMissFT={() => handleMissFT('A')}
                onSecondaryAction={(action) => onSecondaryAction('A', action)}
                isPending={pending?.teamSide === 'A'}
                pendingLabel={pending?.teamSide === 'A'
                    ? `${pending.made ? '' : 'MISS '}${pending.points}PT — tap court`
                    : undefined
                }
            />

            {/* ═══ CENTER: COURT + ATTRIBUTES ═══ */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
                {/* Court header */}
                <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-3">
                        {pending ? (
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full animate-pulse"
                                    style={{ background: activeTeamColor }} />
                                <span className="text-[10px] font-bold uppercase tracking-widest"
                                    style={{
                                        color: activeTeamColor,
                                        fontFamily: '"Barlow Condensed", sans-serif',
                                    }}>
                                    {pending.made ? '+' : 'MISS '}{pending.points}PT
                                    {pending.playerName ? ` — #${teamAPlayers.concat(teamBPlayers).find(p => p.id === pending.playerId)?.number || '?'} ${pending.playerName}` : ''}
                                    {' — TAP COURT'}
                                </span>
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest"
                                style={{ fontFamily: '"Barlow", sans-serif' }}>
                                Shot chart
                            </span>
                        )}
                    </div>
                    {/* Court mode toggle */}
                    <div className="flex bg-zinc-900 rounded-md border border-zinc-800 overflow-hidden">
                        {(['zone', 'precise'] as CourtMode[]).map(m => (
                            <button key={m} onClick={() => setCourtMode(m)}
                                className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all
                                    ${courtMode === m ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                                style={{ fontFamily: '"Barlow", sans-serif' }}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* The court */}
                <div className={`flex-1 relative rounded-xl overflow-hidden border transition-all duration-300 ${pending ? 'border-zinc-700 shadow-lg' : 'border-zinc-900'
                    }`} style={{
                        boxShadow: pending ? `0 0 30px ${activeTeamColor}15` : 'none',
                    }}>
                    {/* Pending overlay glow */}
                    {pending && (
                        <div className="absolute inset-0 pointer-events-none z-10 rounded-xl"
                            style={{
                                background: `radial-gradient(ellipse at center, ${activeTeamColor}08 0%, transparent 70%)`,
                            }}
                        />
                    )}
                    <HalfCourt
                        shots={courtDots}
                        showZones={courtMode === 'zone'}
                        mode={courtMode}
                        interactive={!!pending}
                        onCourtTap={handleCourtTap}
                    />
                </div>

                {/* Attribute pills (always visible, toggle independently of shots) */}
                <div className="flex flex-wrap gap-1.5 px-1">
                    {SHOT_ATTRIBUTES.map(attr => {
                        const isActive = activeAttrs.includes(attr.id);
                        return (
                            <button
                                key={attr.id}
                                onClick={() => handleToggleAttr(attr.id)}
                                className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all
                                    ${isActive
                                        ? 'text-white border'
                                        : 'text-zinc-600 border border-zinc-800/50 hover:border-zinc-700 hover:text-zinc-400'
                                    }`}
                                style={{
                                    fontFamily: '"Barlow", sans-serif',
                                    borderColor: isActive ? `${activeTeamColor}60` : undefined,
                                    background: isActive ? `${activeTeamColor}12` : 'transparent',
                                }}
                            >
                                {attr.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══ RIGHT: TEAM B CONTROLS ═══ */}
            <TeamScoringColumn
                side="B"
                teamName={teamBName}
                teamColor={teamBColor}
                players={teamBPlayers.filter(p => p.name)}
                selectedPlayerId={selectedPlayerB}
                onSelectPlayer={setSelectedPlayerB}
                onMade={(pts, type) => handleMade('B', pts, type)}
                onMiss={(pts, type) => handleMiss('B', pts, type)}
                onMissFT={() => handleMissFT('B')}
                onSecondaryAction={(action) => onSecondaryAction('B', action)}
                isPending={pending?.teamSide === 'B'}
                pendingLabel={pending?.teamSide === 'B'
                    ? `${pending.made ? '' : 'MISS '}${pending.points}PT — tap court`
                    : undefined
                }
            />
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM SCORING COLUMN (left/right panels)
// ═══════════════════════════════════════════════════════════════════════════════

interface TeamScoringColumnProps {
    side: 'A' | 'B';
    teamName: string;
    teamColor: string;
    players: Player[];
    selectedPlayerId: string | null;
    onSelectPlayer: (id: string | null) => void;
    onMade: (points: 1 | 2 | 3, shotType: ShotType) => void;
    onMiss: (points: 2 | 3, shotType: ShotType) => void;
    onMissFT: () => void;
    onSecondaryAction: (action: GameActionType) => void;
    isPending: boolean;
    pendingLabel?: string;
}

const TeamScoringColumn: React.FC<TeamScoringColumnProps> = ({
    side, teamName, teamColor, players, selectedPlayerId,
    onSelectPlayer, onMade, onMiss, onMissFT,
    onSecondaryAction, isPending, pendingLabel,
}) => {
    return (
        <div className="flex flex-col gap-1.5 w-[180px] shrink-0">
            {/* Team header */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{
                    background: isPending ? `${teamColor}10` : 'transparent',
                    borderLeft: `3px solid ${teamColor}`,
                }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-white truncate"
                    style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                    {teamName}
                </span>
            </div>

            {/* Pending indicator */}
            {pendingLabel && (
                <div className="text-[8px] font-bold uppercase tracking-widest px-2 animate-pulse"
                    style={{ color: teamColor, fontFamily: '"Barlow", sans-serif' }}>
                    {pendingLabel}
                </div>
            )}

            {/* Player quick-select (horizontal scroll) */}
            {players.length > 0 && (
                <div className="flex gap-1 overflow-x-auto px-1 py-1 custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
                    {/* Deselect button */}
                    <button
                        onClick={() => onSelectPlayer(null)}
                        className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all
                            ${!selectedPlayerId ? 'bg-zinc-800 text-white border border-zinc-600' : 'bg-zinc-950 text-zinc-600 border border-zinc-900 hover:border-zinc-700'}`}
                        style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                    >
                        --
                    </button>
                    {players.map(p => (
                        <button
                            key={p.id}
                            onClick={() => onSelectPlayer(p.id === selectedPlayerId ? null : p.id)}
                            className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black transition-all
                                ${p.id === selectedPlayerId
                                    ? 'text-white border-2'
                                    : 'bg-zinc-950 text-zinc-500 border border-zinc-900 hover:border-zinc-700 hover:text-zinc-300'
                                }`}
                            style={{
                                fontFamily: '"Barlow Condensed", sans-serif',
                                fontStyle: 'italic',
                                borderColor: p.id === selectedPlayerId ? teamColor : undefined,
                                background: p.id === selectedPlayerId ? `${teamColor}18` : undefined,
                            }}
                            title={p.name}
                        >
                            {p.number || '?'}
                        </button>
                    ))}
                </div>
            )}

            {/* MADE buttons */}
            <div className="grid grid-cols-3 gap-1">
                <ShotBtn label="+1" sub="FT" color={teamColor} variant="made"
                    onClick={() => onMade(1, 'free_throw')} />
                <ShotBtn label="+2" color={teamColor} variant="made"
                    onClick={() => onMade(2, 'field_goal')} />
                <ShotBtn label="+3" color={teamColor} variant="made"
                    onClick={() => onMade(3, 'field_goal')} />
            </div>

            {/* MISS buttons */}
            <div className="grid grid-cols-3 gap-1">
                <ShotBtn label="Miss" sub="FT" color="#7F1D1D" variant="miss"
                    onClick={onMissFT} />
                <ShotBtn label="Miss 2" color="#7F1D1D" variant="miss"
                    onClick={() => onMiss(2, 'field_goal')} />
                <ShotBtn label="Miss 3" color="#7F1D1D" variant="miss"
                    onClick={() => onMiss(3, 'field_goal')} />
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-900 my-0.5" />

            {/* Secondary actions (compact 2-col grid) */}
            <div className="grid grid-cols-2 gap-1">
                <SecBtn label="REB" onClick={() => onSecondaryAction('rebound')} />
                <SecBtn label="AST" onClick={() => onSecondaryAction('assist')} />
                <SecBtn label="STL" onClick={() => onSecondaryAction('steal')} />
                <SecBtn label="TO" onClick={() => onSecondaryAction('turnover')} />
                <SecBtn label="BLK" onClick={() => onSecondaryAction('block')} />
                <SecBtn label="FOUL" onClick={() => onSecondaryAction('foul')} />
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const ShotBtn: React.FC<{
    label: string;
    sub?: string;
    color: string;
    variant: 'made' | 'miss';
    onClick: () => void;
}> = ({ label, sub, color, variant, onClick }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center justify-center rounded-lg transition-all active:scale-95"
        style={{
            padding: '8px 4px',
            minHeight: 44,
            background: `${color}${variant === 'made' ? '15' : '10'}`,
            border: `1px solid ${color}${variant === 'made' ? '40' : '25'}`,
        }}
    >
        <span className="text-sm font-black leading-none"
            style={{
                color: variant === 'made' ? '#fff' : '#EF4444',
                fontFamily: '"Barlow Condensed", sans-serif',
            }}>
            {label}
        </span>
        {sub && (
            <span className="text-[7px] font-bold text-zinc-600 uppercase tracking-wider mt-0.5"
                style={{ fontFamily: '"Barlow", sans-serif' }}>
                {sub}
            </span>
        )}
    </button>
);

const SecBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button
        onClick={onClick}
        className="py-1.5 px-2 rounded-md bg-zinc-950 border border-zinc-900
            text-[9px] font-bold uppercase tracking-wider text-zinc-600
            hover:text-zinc-400 hover:border-zinc-700 active:scale-95 transition-all"
        style={{ fontFamily: '"Barlow", sans-serif' }}
    >
        {label}
    </button>
);

export default AdvancedModeLayout;