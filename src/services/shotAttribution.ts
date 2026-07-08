// src/services/shotAttribution.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Headless Shot-Attribution State Machine (masterplan S1)
//
// ONE state machine for every shot-attribution surface. The Pi referee flow
// (PiAdvancedShotFlow) and the web console (AdvancedConsole) each re-implemented
// this logic with divergent bugs; this module is the single truth they both
// render. It is a PURE REDUCER — no React, no timers, no I/O — so every rule is
// unit-tested (shotAttribution.test.ts). `useShotAttribution` (src/hooks/) is
// the thin React wrapper that drives TICK and drains the outbox.
//
// Canonical flow (Pi order, decision 2026-07-07): court → player → [context].
//   • Free throws (points === 1) skip the court step; zone persists 'free_throw'.
//   • Web "deferred" entry (court tapped before any score button) passes
//     `prefill` — the machine then starts at the player step.
//   • made:false events (the MISS button, masterplan A2) run the same flow.
//
// Queueing (fixes the Pi mid-flow wipe): a score arriving while attribution is
// active is QUEUED, never destroys progress. Overflow beyond maxQueue
// auto-flushes the oldest QUEUED event as an unattributed row (the score is
// already counted upstream; every event must still yield exactly one row).
//
// Timers live in the reducer via TICK (1 Hz from the hook): the player step
// times out to an unattributed finalize, the context step to a finalize with
// whatever tags are toggled — identical to today's Pi behavior. The court step
// has no timeout by default (courtSec: null).
//
// Semantics deltas from the legacy implementations (intentional, documented):
//   • UNATTRIBUTED always finalizes immediately (it is the ref's bail-out —
//     never make the bail-out longer), even when the context step is enabled.
//   • DISMISS retains whatever was already captured (a tapped location is
//     data; "dismiss" only abandons the remaining steps) and flags the row.
//
// The outbox payload is wire-frozen: it matches today's `shot_attributed`
// socket event / shotService.createShotEvent params. Do not reshape it —
// the pi-daemon and the Flutter app consume the same field names.
// ─────────────────────────────────────────────────────────────────────────────

export type AttributionStep = 'court' | 'player' | 'context';
export type TeamSide = 'A' | 'B';

export interface PendingScoreEvent {
    id: string;
    team: TeamSide;
    points: 1 | 2 | 3;
    made: boolean;
    period: number;
    gameClockSec: number | null;
    shotClockSec?: number | null;
    /** Court-first entry (web deferred flow): location known before the event. */
    prefill?: { zone: string; x: number; y: number };
    /** Opaque surface data riding the queue (e.g. the Pi's roster snapshot —
     *  each queued event keeps ITS rosters, so mid-queue subs stay correct). */
    meta?: Record<string, unknown>;
    ts: number;
}

export interface AttributionConfig {
    /** Show the context (attribute tags) step. */
    showContext: boolean;
    /** Court-step timeout; null = untimed (Pi default). */
    courtSec: number | null;
    playerSec: number;
    contextSec: number;
    /** Queue depth before the oldest QUEUED event auto-flushes unattributed. */
    maxQueue: number;
}

export const DEFAULT_ATTRIBUTION_CONFIG: AttributionConfig = {
    showContext: true,
    courtSec: null,
    playerSec: 12,
    contextSec: 9,
    maxQueue: 4,
};

/** Wire-frozen output — mirrors the `shot_attributed` event field names. */
export interface AttributedShotPayload {
    eventId: string;
    team: TeamSide;
    points: 1 | 2 | 3;
    made: boolean;
    playerId: string | null;
    playerName: string | null;
    zone: string;                     // 'free_throw' for FTs; 'unlocated' fallback
    x?: number;                       // absent for FT / unlocated
    y?: number;
    period: number;
    gameClockSec: number | null;
    shotClockSec?: number | null;
    attributes: string[];
    /** Provenance flags (not persisted — for receipts/telemetry at the caller). */
    unattributed: boolean;
    dismissed: boolean;
    timedOut: boolean;
    autoFlushed: boolean;
}

export interface AttributionState {
    config: AttributionConfig;
    /** queue[0] is the ACTIVE event; the rest are pending behind it. */
    queue: PendingScoreEvent[];
    steps: AttributionStep[];
    stepIndex: number;                // -1 = idle
    zone: string | null;
    x: number | null;
    y: number | null;
    playerId: string | null;
    playerName: string | null;
    attrs: string[];
    /** Countdown for the current step; null = untimed. */
    secondsLeft: number | null;
    /** Finalized payloads awaiting the caller (drained by the hook). */
    outbox: AttributedShotPayload[];
}

export type AttributionAction =
    | { type: 'ENQUEUE'; event: PendingScoreEvent }
    | { type: 'TAP_COURT'; zone: string; x: number; y: number }
    | { type: 'SELECT_PLAYER'; playerId: string; playerName: string | null }
    | { type: 'UNATTRIBUTED' }
    | { type: 'TOGGLE_ATTR'; attr: string }
    | { type: 'BACK' }
    | { type: 'SKIP_STEP' }
    | { type: 'DISMISS' }
    | { type: 'RECORD' }
    | { type: 'TICK' }
    | { type: 'DRAIN_OUTBOX'; count: number };

// ── construction ─────────────────────────────────────────────────────────────

export const createInitialState = (
    config: Partial<AttributionConfig> = {}
): AttributionState => ({
    config: { ...DEFAULT_ATTRIBUTION_CONFIG, ...config },
    queue: [],
    steps: [],
    stepIndex: -1,
    zone: null,
    x: null,
    y: null,
    playerId: null,
    playerName: null,
    attrs: [],
    secondsLeft: null,
    outbox: [],
});

const isFreeThrow = (e: PendingScoreEvent): boolean => e.points === 1;

const stepsFor = (e: PendingScoreEvent, config: AttributionConfig): AttributionStep[] => {
    const tail: AttributionStep[] = config.showContext ? ['player', 'context'] : ['player'];
    if (isFreeThrow(e) || e.prefill) return tail;
    return ['court', ...tail];
};

const timerFor = (step: AttributionStep, config: AttributionConfig): number | null =>
    step === 'court' ? config.courtSec
        : step === 'player' ? config.playerSec
        : config.contextSec;

/** Reset per-event fields and enter the first step of queue[0]. */
const activate = (state: AttributionState): AttributionState => {
    const active = state.queue[0];
    if (!active) {
        return { ...state, steps: [], stepIndex: -1, zone: null, x: null, y: null, playerId: null, playerName: null, attrs: [], secondsLeft: null };
    }
    const steps = stepsFor(active, state.config);
    return {
        ...state,
        steps,
        stepIndex: 0,
        zone: active.prefill?.zone ?? null,
        x: active.prefill?.x ?? null,
        y: active.prefill?.y ?? null,
        playerId: null,
        playerName: null,
        attrs: [],
        secondsLeft: timerFor(steps[0], state.config),
    };
};

const enterStep = (state: AttributionState, stepIndex: number): AttributionState => ({
    ...state,
    stepIndex,
    secondsLeft: timerFor(state.steps[stepIndex], state.config),
});

const buildPayload = (
    state: AttributionState,
    flags: Partial<Pick<AttributedShotPayload, 'dismissed' | 'timedOut' | 'autoFlushed'>>
): AttributedShotPayload => {
    const e = state.queue[0];
    const ft = isFreeThrow(e);
    const zone = ft ? 'free_throw' : (state.zone ?? 'unlocated');
    const located = !ft && state.x != null && state.y != null && zone !== 'unlocated';
    return {
        eventId: e.id,
        team: e.team,
        points: e.points,
        made: e.made,
        playerId: state.playerId,
        playerName: state.playerName,
        zone,
        x: located ? state.x! : undefined,
        y: located ? state.y! : undefined,
        period: e.period,
        gameClockSec: e.gameClockSec,
        shotClockSec: e.shotClockSec,
        attributes: state.attrs,
        unattributed: state.playerId === null,
        dismissed: false,
        timedOut: false,
        autoFlushed: false,
        ...flags,
    };
};

/** Finalize the ACTIVE event: emit to outbox, shift the queue, activate next. */
const finalize = (
    state: AttributionState,
    flags: Partial<Pick<AttributedShotPayload, 'dismissed' | 'timedOut' | 'autoFlushed'>> = {}
): AttributionState => {
    const payload = buildPayload(state, flags);
    return activate({
        ...state,
        queue: state.queue.slice(1),
        outbox: [...state.outbox, payload],
    });
};

/** Payload for a QUEUED (never-active) event flushed on overflow. */
const flushQueuedPayload = (e: PendingScoreEvent): AttributedShotPayload => ({
    eventId: e.id,
    team: e.team,
    points: e.points,
    made: e.made,
    playerId: null,
    playerName: null,
    zone: isFreeThrow(e) ? 'free_throw' : (e.prefill?.zone ?? 'unlocated'),
    x: e.prefill?.x,
    y: e.prefill?.y,
    period: e.period,
    gameClockSec: e.gameClockSec,
    shotClockSec: e.shotClockSec,
    attributes: [],
    unattributed: true,
    dismissed: false,
    timedOut: false,
    autoFlushed: true,
});

// ── selectors ────────────────────────────────────────────────────────────────

export const getActiveEvent = (s: AttributionState): PendingScoreEvent | null => s.queue[0] ?? null;
export const getCurrentStep = (s: AttributionState): AttributionStep | null =>
    s.stepIndex >= 0 ? s.steps[s.stepIndex] ?? null : null;
export const getQueuedCount = (s: AttributionState): number => Math.max(0, s.queue.length - 1);
export const canGoBack = (s: AttributionState): boolean => s.stepIndex > 0;

// ── reducer ──────────────────────────────────────────────────────────────────

export const attributionReducer = (
    state: AttributionState,
    action: AttributionAction
): AttributionState => {
    const step = getCurrentStep(state);

    switch (action.type) {
        case 'ENQUEUE': {
            const queue = [...state.queue, action.event];
            let next = { ...state, queue };
            if (state.stepIndex === -1) {
                next = activate(next);
            } else if (queue.length > state.config.maxQueue) {
                // Overflow: flush the OLDEST QUEUED (index 1 — never the active event).
                const flushed = queue[1];
                next = {
                    ...next,
                    queue: [queue[0], ...queue.slice(2)],
                    outbox: [...next.outbox, flushQueuedPayload(flushed)],
                };
            }
            return next;
        }

        case 'TAP_COURT': {
            if (step !== 'court') return state;
            return enterStep(
                { ...state, zone: action.zone, x: action.x, y: action.y },
                state.stepIndex + 1
            );
        }

        case 'SELECT_PLAYER': {
            if (step !== 'player') return state;
            const withPlayer = { ...state, playerId: action.playerId, playerName: action.playerName };
            const hasContext = state.steps.includes('context');
            return hasContext ? enterStep(withPlayer, state.stepIndex + 1) : finalize(withPlayer);
        }

        case 'UNATTRIBUTED': {
            if (step !== 'player') return state;
            // The ref's bail-out: always immediate, never adds a step.
            return finalize({ ...state, playerId: null, playerName: null });
        }

        case 'TOGGLE_ATTR': {
            // Any ACTIVE step: the web console lets operators tag shots while
            // the court is still armed (pre-tap), the Pi tags on the context
            // step — both are per-event state, reset on activate. Idle = inert.
            if (!step) return state;
            const attrs = state.attrs.includes(action.attr)
                ? state.attrs.filter(a => a !== action.attr)
                : [...state.attrs, action.attr];
            return { ...state, attrs };
        }

        case 'BACK': {
            if (state.stepIndex <= 0) return state;
            return enterStep(state, state.stepIndex - 1);
        }

        case 'SKIP_STEP': {
            if (!step) return state;
            if (step === 'court') {
                return enterStep({ ...state, zone: 'unlocated', x: null, y: null }, state.stepIndex + 1);
            }
            if (step === 'player') {
                return finalize({ ...state, playerId: null, playerName: null });
            }
            return finalize(state); // context: record with current tags
        }

        case 'DISMISS': {
            if (!step) return state;
            // Keep anything already captured; abandon the remaining steps.
            return finalize(state, { dismissed: true });
        }

        case 'RECORD': {
            if (step !== 'context') return state;
            return finalize(state);
        }

        case 'TICK': {
            if (!step || state.secondsLeft == null) return state;
            const secondsLeft = state.secondsLeft - 1;
            if (secondsLeft > 0) return { ...state, secondsLeft };
            // Expiry semantics per step (matches the Pi flow today):
            if (step === 'court') {
                return enterStep({ ...state, zone: 'unlocated', x: null, y: null }, state.stepIndex + 1);
            }
            if (step === 'player') {
                return finalize({ ...state, playerId: null, playerName: null }, { timedOut: true });
            }
            return finalize(state, { timedOut: true }); // context
        }

        case 'DRAIN_OUTBOX':
            return { ...state, outbox: state.outbox.slice(action.count) };

        default:
            return state;
    }
};
