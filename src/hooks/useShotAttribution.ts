// src/hooks/useShotAttribution.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin React wrapper around the pure attribution machine
// (src/services/shotAttribution.ts). Owns exactly two effects:
//   1. a 1 Hz TICK while a timed step is active (drives step countdowns), and
//   2. draining the outbox to the caller's onAttribute.
// ALL flow rules live in the reducer — do not add logic here; extend the
// machine (and its tests) instead.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
    attributionReducer,
    createInitialState,
    getActiveEvent,
    getCurrentStep,
    getQueuedCount,
    canGoBack,
    type AttributionConfig,
    type AttributionState,
    type AttributedShotPayload,
    type PendingScoreEvent,
} from '../services/shotAttribution';

export interface UseShotAttribution {
    state: AttributionState;
    /** Derived: the event being attributed (null when idle). */
    activeEvent: PendingScoreEvent | null;
    step: ReturnType<typeof getCurrentStep>;
    queuedCount: number;
    canBack: boolean;
    enqueue: (event: PendingScoreEvent) => void;
    tapCourt: (zone: string, x: number, y: number) => void;
    selectPlayer: (playerId: string, playerName: string | null) => void;
    unattributed: () => void;
    toggleAttr: (attr: string) => void;
    back: () => void;
    skipStep: () => void;
    dismiss: () => void;
    record: () => void;
}

export const useShotAttribution = (
    config: Partial<AttributionConfig>,
    onAttribute: (payload: AttributedShotPayload) => void
): UseShotAttribution => {
    const [state, dispatch] = useReducer(attributionReducer, config, createInitialState);

    // Keep the latest callback without re-arming effects.
    const onAttributeRef = useRef(onAttribute);
    useEffect(() => {
        onAttributeRef.current = onAttribute;
    }, [onAttribute]);

    // 1 Hz countdown while a timed step is active. Re-arms on step entry so the
    // first tick lands a full second after the step appears.
    const activeId = state.queue[0]?.id ?? null;
    const timed = state.stepIndex >= 0 && state.secondsLeft != null;
    useEffect(() => {
        if (!timed) return;
        const t = setInterval(() => dispatch({ type: 'TICK' }), 1000);
        return () => clearInterval(t);
    }, [timed, activeId, state.stepIndex]);

    // Outbox drain: deliver each finalized payload exactly once.
    useEffect(() => {
        if (state.outbox.length === 0) return;
        for (const payload of state.outbox) onAttributeRef.current(payload);
        dispatch({ type: 'DRAIN_OUTBOX', count: state.outbox.length });
    }, [state.outbox]);

    const enqueue = useCallback((event: PendingScoreEvent) => dispatch({ type: 'ENQUEUE', event }), []);
    const tapCourt = useCallback((zone: string, x: number, y: number) => dispatch({ type: 'TAP_COURT', zone, x, y }), []);
    const selectPlayer = useCallback((playerId: string, playerName: string | null) => dispatch({ type: 'SELECT_PLAYER', playerId, playerName }), []);
    const unattributed = useCallback(() => dispatch({ type: 'UNATTRIBUTED' }), []);
    const toggleAttr = useCallback((attr: string) => dispatch({ type: 'TOGGLE_ATTR', attr }), []);
    const back = useCallback(() => dispatch({ type: 'BACK' }), []);
    const skipStep = useCallback(() => dispatch({ type: 'SKIP_STEP' }), []);
    const dismiss = useCallback(() => dispatch({ type: 'DISMISS' }), []);
    const record = useCallback(() => dispatch({ type: 'RECORD' }), []);

    return {
        state,
        activeEvent: getActiveEvent(state),
        step: getCurrentStep(state),
        queuedCount: getQueuedCount(state),
        canBack: canGoBack(state),
        enqueue,
        tapCourt,
        selectPlayer,
        unattributed,
        toggleAttr,
        back,
        skipStep,
        dismiss,
        record,
    };
};
