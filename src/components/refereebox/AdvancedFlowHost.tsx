// src/components/refereebox/AdvancedFlowHost.tsx
// ═══════════════════════════════════════════════════════════════
// Owns the shot-attribution MACHINE for a Pi-style surface and
// bridges the legacy `scorePending` event interface onto it.
// RefereeScreen, LanControlPage, and the UI-audit fixture all
// render the advanced flow through this host, so:
//   • a second score mid-attribution QUEUES (never wipes progress —
//    the old keyed-remount behavior is gone),
//   • every score event yields exactly ONE persisted row (dismiss
//     and timeout included — machine conservation),
//   • flow rules live in services/shotAttribution.ts, tested.
// Renders the flow while an event is active, else `fallback`.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef } from 'react';
import PiAdvancedShotFlow from './PiAdvancedShotFlow';
import { useShotAttribution } from '../../hooks/useShotAttribution';
import type { AttributedShotPayload } from '../../services/shotAttribution';
import { getShotTypeSelection } from '../../services/gameControlPrefs';
import type { ScorePendingEvent, TeamState, ClockState } from '../../hooks/useRefereeBox';

export interface AttributeData {
    team: 'A' | 'B'; points: number; made: boolean;
    playerId: string | null; playerName: string | null;
    zone?: string; x?: number; y?: number;
    period?: number; gameClockSec?: number; attributes?: string[];
}

interface Props {
    /** The pending score event to consume (null when none / not advanced mode). */
    event: ScorePendingEvent | null;
    /** Called once the event has been absorbed into the queue. */
    onConsumed?: () => void;
    teamA: TeamState; teamB: TeamState;
    teamAColor: string; teamBColor: string;
    clock: ClockState;
    gameCode?: string;
    onAttribute: (data: AttributeData) => void;
    onUndo?: () => void;
    /** What renders when no attribution is active. */
    fallback: React.ReactNode;
}

export default function AdvancedFlowHost({
    event, onConsumed, teamA, teamB, teamAColor, teamBColor,
    clock, gameCode, onAttribute, onUndo, fallback,
}: Props) {
    const handlePayload = useCallback((p: AttributedShotPayload) => {
        onAttribute({
            team: p.team, points: p.points, made: p.made,
            playerId: p.playerId, playerName: p.playerName,
            zone: p.zone, x: p.x, y: p.y,
            period: p.period, gameClockSec: p.gameClockSec ?? undefined,
            attributes: p.attributes,
        });
    }, [onAttribute]);

    const attribution = useShotAttribution(
        { showContext: getShotTypeSelection(), courtSec: null, playerSec: 12, contextSec: 9 },
        handlePayload,
    );

    // Absorb each new pending event into the queue exactly once.
    const lastEventRef = useRef<ScorePendingEvent | null>(null);
    const clockRef = useRef(clock);
    useEffect(() => { clockRef.current = clock; }, [clock]);
    useEffect(() => {
        if (!event || lastEventRef.current === event) return;
        lastEventRef.current = event;
        attribution.enqueue({
            id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            team: event.team,
            points: event.points as 1 | 2 | 3,
            made: event.made ?? true,
            period: clockRef.current.period,
            gameClockSec: Math.ceil(clockRef.current.gameMs / 1000),
            // Roster snapshot rides the queue with its event.
            meta: { players: event.players ?? [] },
            ts: Date.now(),
        });
        onConsumed?.();
    }, [event, attribution, onConsumed]);

    if (!attribution.activeEvent) return <>{fallback}</>;

    return (
        <PiAdvancedShotFlow
            attribution={attribution}
            teamA={teamA} teamB={teamB}
            teamAColor={teamAColor} teamBColor={teamBColor}
            clock={clock}
            gameCode={gameCode}
            onSkip={attribution.dismiss}
            onUndo={onUndo}
        />
    );
}
