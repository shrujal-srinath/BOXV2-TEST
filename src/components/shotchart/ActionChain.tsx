// src/components/shotchart/ActionChain.tsx
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Action Chain (Bottom Sheet)
//
// Progressive disclosure scoring flow for Advanced Stats mode.
// Each step is optional with a timeout that auto-advances.
//
// Flow: Score button tapped → Player → Court Location → Attributes → Done
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HalfCourt } from './HalfCourt';
import { classifyZone, SHOT_ATTRIBUTES, ZONES } from './courtZones';
import type {
    ChainState,
    ChainStep,
    ShotAttribute,
    ShotEvent,
    ShotZoneId,
} from './types/shotTypes';
import type { Player } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface ActionChainProps {
    /** Whether the chain is currently open */
    isOpen: boolean;
    /** The triggering event */
    trigger: ChainState['trigger'];
    /** Players on the active team (for player selection step) */
    teamPlayers: Player[];
    /** Team side that scored */
    teamSide: 'A' | 'B';
    /** Team name (for display) */
    teamName: string;
    /** Team color */
    teamColor: string;
    /** Existing shots for this game (for court onion-skinning) */
    existingShots?: ShotEvent[];
    /** Called when the chain completes (with collected data) */
    onComplete: (data: {
        playerId: string | null;
        playerName: string | null;
        x: number | null;
        y: number | null;
        zone: ShotZoneId;
        attributes: ShotAttribute[];
    }) => void;
    /** Called when the chain is dismissed without completing */
    onDismiss: () => void;
    /** Last player who scored (for pre-selection on streaks) */
    lastPlayerId?: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PLAYER_TIMEOUT = 5000;
const COURT_TIMEOUT = 5000;
const ATTR_TIMEOUT = 3000;

// ── Component ────────────────────────────────────────────────────────────────

export const ActionChain: React.FC<ActionChainProps> = ({
    isOpen,
    trigger,
    teamPlayers,
    teamSide,
    teamName,
    teamColor,
    existingShots = [],
    onComplete,
    onDismiss,
    lastPlayerId,
}) => {
    const [step, setStep] = useState<ChainStep>('player');
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [playerName, setPlayerName] = useState<string | null>(null);
    const [shotX, setShotX] = useState<number | null>(null);
    const [shotY, setShotY] = useState<number | null>(null);
    const [shotZone, setShotZone] = useState<ShotZoneId>('unlocated');
    const [attributes, setAttributes] = useState<ShotAttribute[]>([]);
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef(0);

    // ── Reset state when chain opens ─────────────────────────────────────────

    useEffect(() => {
        if (isOpen && trigger) {
            setStep(teamPlayers.length > 0 ? 'player' : 'court');
            setPlayerId(lastPlayerId || null);
            setPlayerName(null);
            setShotX(null);
            setShotY(null);
            setShotZone('unlocated');
            setAttributes([]);
            setProgress(0);
            // Slide-in animation
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }
    }, [isOpen, trigger]);

    // ── Timeout management ───────────────────────────────────────────────────

    const getTimeoutForStep = (s: ChainStep): number => {
        switch (s) {
            case 'player': return PLAYER_TIMEOUT;
            case 'court': return COURT_TIMEOUT;
            case 'attributes': return ATTR_TIMEOUT;
            default: return 5000;
        }
    };

    const clearTimers = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (progressRef.current) clearInterval(progressRef.current);
    }, []);

    const startStepTimer = useCallback((currentStep: ChainStep) => {
        clearTimers();
        const duration = getTimeoutForStep(currentStep);
        startTimeRef.current = Date.now();
        setProgress(0);

        progressRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            setProgress(Math.min(100, (elapsed / duration) * 100));
        }, 50);

        timeoutRef.current = setTimeout(() => {
            clearTimers();
            advanceStep(currentStep);
        }, duration);
    }, [clearTimers]);

    useEffect(() => {
        if (isOpen && step !== 'done') {
            startStepTimer(step);
        }
        return clearTimers;
    }, [isOpen, step, startStepTimer, clearTimers]);

    // ── Step advancement ─────────────────────────────────────────────────────

    const advanceStep = useCallback((fromStep: ChainStep) => {
        clearTimers();
        switch (fromStep) {
            case 'player':
                if (trigger?.shotType === 'free_throw') {
                    // FTs skip court step — always from FT line
                    setStep('attributes');
                } else {
                    setStep('court');
                }
                break;
            case 'court':
                setStep('attributes');
                break;
            case 'attributes':
                completeChain();
                break;
            default:
                completeChain();
        }
    }, [trigger, clearTimers]);

    const completeChain = useCallback(() => {
        clearTimers();
        setStep('done');
        setIsVisible(false);
        onComplete({
            playerId,
            playerName,
            x: shotX,
            y: shotY,
            zone: shotZone,
            attributes,
        });
    }, [clearTimers, onComplete, playerId, playerName, shotX, shotY, shotZone, attributes]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handlePlayerSelect = useCallback((player: Player) => {
        setPlayerId(player.id);
        setPlayerName(player.name);
        advanceStep('player');
    }, [advanceStep]);

    const handleSkipPlayer = useCallback(() => {
        advanceStep('player');
    }, [advanceStep]);

    const handleCourtTap = useCallback((x: number, y: number) => {
        const zone = classifyZone(x, y);

        setShotX(x);
        setShotY(y);
        setShotZone(zone);
        advanceStep('court');
    }, [advanceStep]);

    const handleSkipCourt = useCallback(() => {
        advanceStep('court');
    }, [advanceStep]);

    const handleToggleAttribute = useCallback((attr: ShotAttribute) => {
        setAttributes(prev =>
            prev.includes(attr)
                ? prev.filter(a => a !== attr)
                : [...prev, attr]
        );
    }, []);

    const handleFinishAttributes = useCallback(() => {
        advanceStep('attributes');
    }, [advanceStep]);

    const handleDismiss = useCallback(() => {
        clearTimers();
        setIsVisible(false);
        setTimeout(onDismiss, 200);
    }, [clearTimers, onDismiss]);

    // ── Existing shots for onion-skinning on court ───────────────────────────

    const courtShots = existingShots
        .filter(s => s.zone !== 'unlocated')
        .map(s => ({
            id: s.id,
            x: s.x,
            y: s.y,
            made: s.made,
            points: s.points,
        }));

    if (!isOpen || !trigger) return null;

    const isMade = trigger.made;
    const pointLabel = trigger.shotType === 'free_throw' ? 'FT' : `${trigger.points}PT`;
    const resultLabel = isMade ? 'MADE' : 'MISS';

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: isVisible ? 'auto' : 'none',
            }}
        >
            {/* Backdrop — tap to dismiss */}
            <div
                onClick={handleDismiss}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    opacity: isVisible ? 1 : 0,
                    transition: 'opacity 0.2s',
                    zIndex: -1,
                }}
            />

            {/* Bottom sheet */}
            <div style={{
                background: '#0a0a0a',
                borderTop: `2px solid ${teamColor}`,
                borderRadius: '16px 16px 0 0',
                maxHeight: '65vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Progress bar */}
                <div style={{ height: 3, background: '#1a1a1a', position: 'relative' }}>
                    <div style={{
                        height: '100%',
                        background: '#F59E0B',
                        width: `${progress}%`,
                        transition: 'width 0.05s linear',
                    }} />
                </div>

                {/* Header */}
                <div style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #1a1a1a',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: isMade ? '#22C55E' : '#EF4444',
                        }} />
                        <span style={{
                            fontFamily: '"Barlow Condensed", sans-serif',
                            fontWeight: 700,
                            fontSize: 14,
                            letterSpacing: '0.1em',
                            color: '#fff',
                            textTransform: 'uppercase',
                        }}>
                            {teamName} — {pointLabel} {resultLabel}
                        </span>
                        {playerName && (
                            <span style={{
                                fontSize: 12,
                                color: 'rgba(255,255,255,0.4)',
                                fontFamily: '"Barlow", sans-serif',
                            }}>
                                #{teamPlayers.find(p => p.id === playerId)?.number} {playerName}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleDismiss}
                        style={{
                            background: 'none', border: 'none', color: '#555',
                            cursor: 'pointer', fontSize: 18, padding: '4px 8px',
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Step content */}
                <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>

                    {/* ── STEP: Player selection ──────────────────────────── */}
                    {step === 'player' && (
                        <div>
                            <div style={{
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.2em', color: '#555', marginBottom: 12,
                                fontFamily: '"Barlow", sans-serif',
                            }}>
                                Who {isMade ? 'scored' : 'shot'}?
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                gap: 8,
                            }}>
                                {teamPlayers.filter(p => p.name).map(player => (
                                    <button
                                        key={player.id}
                                        onClick={() => handlePlayerSelect(player)}
                                        style={{
                                            background: player.id === lastPlayerId ? '#1a1a1a' : '#111',
                                            border: player.id === lastPlayerId
                                                ? `1px solid ${teamColor}`
                                                : '1px solid #222',
                                            borderRadius: 10,
                                            padding: '10px 6px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 4,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <span style={{
                                            fontSize: 20, fontWeight: 900, color: '#fff',
                                            fontFamily: '"Barlow Condensed", sans-serif',
                                            fontStyle: 'italic',
                                        }}>
                                            {player.number}
                                        </span>
                                        <span style={{
                                            fontSize: 9, fontWeight: 700, color: '#666',
                                            textTransform: 'uppercase', letterSpacing: '0.05em',
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap', maxWidth: '100%',
                                            fontFamily: '"Barlow", sans-serif',
                                        }}>
                                            {player.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={handleSkipPlayer}
                                style={{
                                    marginTop: 12, width: '100%', padding: '8px',
                                    background: 'none', border: '1px solid #222',
                                    borderRadius: 8, color: '#555', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                                    letterSpacing: '0.15em',
                                    fontFamily: '"Barlow", sans-serif',
                                }}
                            >
                                Skip
                            </button>
                        </div>
                    )}

                    {/* ── STEP: Court location ────────────────────────────── */}
                    {step === 'court' && (
                        <div>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 12,
                            }}>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.2em', color: '#555',
                                    fontFamily: '"Barlow", sans-serif',
                                }}>
                                    Where on court?
                                </span>
                            </div>

                            <HalfCourt
                                shots={courtShots}
                                showZones={false}
                                interactive
                                onCourtTap={handleCourtTap}
                                maxHeight="35vh"
                            />

                            <button
                                onClick={handleSkipCourt}
                                style={{
                                    marginTop: 10, width: '100%', padding: '8px',
                                    background: 'none', border: '1px solid #222',
                                    borderRadius: 8, color: '#555', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                                    letterSpacing: '0.15em',
                                    fontFamily: '"Barlow", sans-serif',
                                }}
                            >
                                Skip location
                            </button>
                        </div>
                    )}

                    {/* ── STEP: Shot attributes ───────────────────────────── */}
                    {step === 'attributes' && (
                        <div>
                            <div style={{
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.2em', color: '#555', marginBottom: 12,
                                fontFamily: '"Barlow", sans-serif',
                            }}>
                                Shot context (optional)
                            </div>
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: 8,
                            }}>
                                {SHOT_ATTRIBUTES.map(attr => {
                                    const isSelected = attributes.includes(attr.id);
                                    return (
                                        <button
                                            key={attr.id}
                                            onClick={() => handleToggleAttribute(attr.id)}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: 20,
                                                border: isSelected
                                                    ? `1px solid ${teamColor}`
                                                    : '1px solid #333',
                                                background: isSelected ? `${teamColor}18` : '#111',
                                                color: isSelected ? '#fff' : '#888',
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                transition: 'all 0.15s',
                                                fontFamily: '"Barlow", sans-serif',
                                            }}
                                        >
                                            {attr.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={handleFinishAttributes}
                                style={{
                                    marginTop: 16, width: '100%', padding: '12px',
                                    background: teamColor,
                                    border: 'none', borderRadius: 10,
                                    color: '#000', cursor: 'pointer',
                                    fontSize: 12, fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.15em',
                                    fontFamily: '"Barlow Condensed", sans-serif',
                                }}
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActionChain;