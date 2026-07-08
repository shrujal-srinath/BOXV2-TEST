// Golden tests for the headless shot-attribution machine (masterplan S1).
// This machine replaces two divergent implementations (PiAdvancedShotFlow, the
// web console's pending/deferred flows) — these tests ARE the flow contract.
import { describe, it, expect } from 'vitest';
import {
    attributionReducer as reduce,
    createInitialState,
    getCurrentStep,
    getQueuedCount,
    type AttributionState,
    type AttributionAction,
    type PendingScoreEvent,
} from './shotAttribution';

let seq = 0;
const ev = (over: Partial<PendingScoreEvent> = {}): PendingScoreEvent => ({
    id: `e${++seq}`,
    team: 'A',
    points: 2,
    made: true,
    period: 2,
    gameClockSec: 345,
    shotClockSec: 14,
    ts: Date.now(),
    ...over,
});

const run = (state: AttributionState, ...actions: AttributionAction[]): AttributionState =>
    actions.reduce(reduce, state);

const start = (event: PendingScoreEvent, config = {}) =>
    reduce(createInitialState(config), { type: 'ENQUEUE', event });

describe('flow shape', () => {
    it('field goal: court → player → context (context on)', () => {
        const s = start(ev());
        expect(s.steps).toEqual(['court', 'player', 'context']);
        expect(getCurrentStep(s)).toBe('court');
        expect(s.secondsLeft).toBeNull();               // court untimed by default
    });

    it('field goal without context step', () => {
        const s = start(ev(), { showContext: false });
        expect(s.steps).toEqual(['court', 'player']);
    });

    it('free throw skips the court; payload zone is free_throw with no coords', () => {
        const s0 = start(ev({ points: 1 }));
        expect(s0.steps).toEqual(['player', 'context']);
        const s1 = run(s0, { type: 'SELECT_PLAYER', playerId: 'p9', playerName: 'Nine' }, { type: 'RECORD' });
        expect(s1.outbox).toHaveLength(1);
        expect(s1.outbox[0]).toMatchObject({ zone: 'free_throw', playerId: 'p9', points: 1 });
        expect(s1.outbox[0].x).toBeUndefined();
        expect(s1.outbox[0].y).toBeUndefined();
    });

    it('web deferred entry: prefilled location starts at player step and keeps coords', () => {
        const s0 = start(ev({ prefill: { zone: 'three_corner_left', x: 3, y: 10 } }));
        expect(getCurrentStep(s0)).toBe('player');
        const s1 = run(s0, { type: 'SELECT_PLAYER', playerId: 'p1', playerName: null }, { type: 'RECORD' });
        expect(s1.outbox[0]).toMatchObject({ zone: 'three_corner_left', x: 3, y: 10 });
    });
});

describe('the happy path payload', () => {
    it('carries event identity, location, player, tags — wire-frozen field names', () => {
        const e = ev({ team: 'B', points: 3, gameClockSec: 61, shotClockSec: 4 });
        const s = run(
            start(e),
            { type: 'TAP_COURT', zone: 'three_wing_right', x: 93.5, y: 28 },
            { type: 'SELECT_PLAYER', playerId: 'p23', playerName: 'Ari' },
            { type: 'TOGGLE_ATTR', attr: 'catch_and_shoot' },
            { type: 'TOGGLE_ATTR', attr: 'contested' },
            { type: 'TOGGLE_ATTR', attr: 'contested' },   // toggles off
            { type: 'RECORD' },
        );
        expect(s.outbox).toHaveLength(1);
        expect(s.outbox[0]).toEqual(expect.objectContaining({
            eventId: e.id,
            team: 'B',
            points: 3,
            made: true,
            playerId: 'p23',
            playerName: 'Ari',
            zone: 'three_wing_right',
            x: 93.5,
            y: 28,
            period: 2,
            gameClockSec: 61,
            shotClockSec: 4,
            attributes: ['catch_and_shoot'],
            unattributed: false,
            dismissed: false,
            timedOut: false,
        }));
        expect(getCurrentStep(s)).toBeNull();             // idle again
    });

    it('miss events flow identically with made:false', () => {
        const s = run(
            start(ev({ made: false })),
            { type: 'TAP_COURT', zone: 'mid_top', x: 50, y: 46 },
            { type: 'SELECT_PLAYER', playerId: 'p1', playerName: null },
            { type: 'RECORD' },
        );
        expect(s.outbox[0]).toMatchObject({ made: false, zone: 'mid_top' });
    });

    it('selecting a player finalizes immediately when there is no context step', () => {
        const s = run(
            start(ev(), { showContext: false }),
            { type: 'TAP_COURT', zone: 'restricted', x: 50, y: 16 },
            { type: 'SELECT_PLAYER', playerId: 'p4', playerName: null },
        );
        expect(s.outbox).toHaveLength(1);
        expect(getCurrentStep(s)).toBeNull();
    });
});

describe('escapes: back / skip / unattributed / dismiss', () => {
    it('BACK returns a step and the earlier selection survives', () => {
        const s = run(
            start(ev()),
            { type: 'TAP_COURT', zone: 'paint_left', x: 40, y: 26 },
            { type: 'BACK' },
        );
        expect(getCurrentStep(s)).toBe('court');
        expect(s.zone).toBe('paint_left');                // retained for re-tap or skip-forward
        expect(reduce(createInitialState(), { type: 'BACK' }).stepIndex).toBe(-1); // idle no-op
    });

    it('SKIP on court records unlocated and moves on', () => {
        const s = run(start(ev()), { type: 'SKIP_STEP' });
        expect(getCurrentStep(s)).toBe('player');
        expect(s.zone).toBe('unlocated');
    });

    it('UNATTRIBUTED always finalizes immediately — even with context enabled', () => {
        const s = run(
            start(ev()),
            { type: 'TAP_COURT', zone: 'mid_top', x: 50, y: 46 },
            { type: 'UNATTRIBUTED' },
        );
        expect(s.outbox).toHaveLength(1);
        expect(s.outbox[0]).toMatchObject({ playerId: null, unattributed: true, zone: 'mid_top' });
    });

    it('DISMISS keeps captured data and flags the payload', () => {
        const s = run(
            start(ev()),
            { type: 'TAP_COURT', zone: 'three_top_center', x: 50, y: 64 },
            { type: 'DISMISS' },
        );
        expect(s.outbox[0]).toMatchObject({
            dismissed: true, zone: 'three_top_center', x: 50, y: 64, playerId: null,
        });
    });

    it('unlocated skip never emits fake coordinates', () => {
        const s = run(start(ev()), { type: 'SKIP_STEP' }, { type: 'UNATTRIBUTED' });
        expect(s.outbox[0].zone).toBe('unlocated');
        expect(s.outbox[0].x).toBeUndefined();
        expect(s.outbox[0].y).toBeUndefined();
    });
});

describe('timers (TICK-driven)', () => {
    it('player step expires to an unattributed, timedOut payload', () => {
        let s = run(start(ev(), { playerSec: 2 }), { type: 'TAP_COURT', zone: 'restricted', x: 50, y: 16 });
        expect(s.secondsLeft).toBe(2);
        s = run(s, { type: 'TICK' });
        expect(s.secondsLeft).toBe(1);
        s = run(s, { type: 'TICK' });
        expect(s.outbox[0]).toMatchObject({ timedOut: true, unattributed: true, zone: 'restricted' });
    });

    it('context step expires to a finalize keeping toggled tags', () => {
        let s = run(
            start(ev({ points: 1 }), { contextSec: 1 }),
            { type: 'SELECT_PLAYER', playerId: 'p2', playerName: null },
            { type: 'TOGGLE_ATTR', attr: 'fastbreak' },
        );
        s = run(s, { type: 'TICK' });
        expect(s.outbox[0]).toMatchObject({ timedOut: true, playerId: 'p2', attributes: ['fastbreak'] });
    });

    it('a timed court step expires to unlocated and advances (web pending parity)', () => {
        let s = run(start(ev(), { courtSec: 1 }));
        s = run(s, { type: 'TICK' });
        expect(getCurrentStep(s)).toBe('player');
        expect(s.zone).toBe('unlocated');
    });

    it('BACK re-arms the step timer', () => {
        let s = run(start(ev(), { playerSec: 5 }), { type: 'SKIP_STEP' });   // → player, 5s
        s = run(s, { type: 'TICK' }, { type: 'TICK' });                       // 3s left
        s = run(s, { type: 'BACK' }, { type: 'SKIP_STEP' });                  // court → player again
        expect(s.secondsLeft).toBe(5);
    });
});

describe('queueing (the mid-flow-score fix)', () => {
    it('a second score queues without touching in-progress state', () => {
        let s = run(start(ev()), { type: 'TAP_COURT', zone: 'paint_right', x: 60, y: 26 });
        s = run(s, { type: 'ENQUEUE', event: ev({ team: 'B' }) });
        expect(getQueuedCount(s)).toBe(1);
        expect(getCurrentStep(s)).toBe('player');
        expect(s.zone).toBe('paint_right');               // progress intact
    });

    it('finishing the active event auto-activates the next with fresh state', () => {
        const second = ev({ team: 'B', points: 3 });
        let s = run(
            start(ev()),
            { type: 'ENQUEUE', event: second },
            { type: 'TAP_COURT', zone: 'restricted', x: 50, y: 16 },
            { type: 'UNATTRIBUTED' },
        );
        expect(s.outbox).toHaveLength(1);
        expect(s.queue[0].id).toBe(second.id);
        expect(getCurrentStep(s)).toBe('court');
        expect(s.zone).toBeNull();                        // no bleed-through
        expect(getQueuedCount(s)).toBe(0);
    });

    it('queue overflow flushes the OLDEST QUEUED event as autoFlushed — never the active one', () => {
        const active = ev();
        const q1 = ev({ team: 'B' });
        let s = run(start(active, { maxQueue: 2 }), { type: 'ENQUEUE', event: q1 });
        const q2 = ev();
        s = run(s, { type: 'ENQUEUE', event: q2 });       // depth 3 > maxQueue 2 → flush q1
        expect(s.queue.map(e => e.id)).toEqual([active.id, q2.id]);
        expect(s.outbox).toHaveLength(1);
        expect(s.outbox[0]).toMatchObject({ eventId: q1.id, autoFlushed: true, unattributed: true });
    });

    it('every enqueued event yields exactly one payload (conservation)', () => {
        const events = [ev(), ev({ points: 1 }), ev({ team: 'B', made: false }), ev({ points: 3 })];
        let s = createInitialState({ maxQueue: 2, showContext: false });
        for (const e of events) s = reduce(s, { type: 'ENQUEUE', event: e });
        // Drive the machine until idle: skip court (if any), mark unattributed.
        let guard = 0;
        while (getCurrentStep(s) && guard++ < 20) {
            s = getCurrentStep(s) === 'court'
                ? reduce(s, { type: 'SKIP_STEP' })
                : reduce(s, { type: 'UNATTRIBUTED' });
        }
        expect(s.outbox).toHaveLength(events.length);
        expect(new Set(s.outbox.map(p => p.eventId)).size).toBe(events.length);
    });
});

describe('guards', () => {
    it('actions land only on their step (stale UI events are inert)', () => {
        const s0 = start(ev());                            // court step
        expect(reduce(s0, { type: 'SELECT_PLAYER', playerId: 'x', playerName: null })).toBe(s0);
        expect(reduce(s0, { type: 'RECORD' })).toBe(s0);
        const idle = createInitialState();
        expect(reduce(idle, { type: 'TAP_COURT', zone: 'mid_top', x: 50, y: 46 })).toBe(idle);
        expect(reduce(idle, { type: 'TICK' })).toBe(idle);
        expect(reduce(idle, { type: 'DISMISS' })).toBe(idle);
        expect(reduce(idle, { type: 'TOGGLE_ATTR', attr: 'fastbreak' })).toBe(idle);
    });

    it('TOGGLE_ATTR works on ANY active step (web tags pre-tap) and rides into the payload', () => {
        const s = run(
            start(ev(), { showContext: false }),
            { type: 'TOGGLE_ATTR', attr: 'fastbreak' },        // during court step
            { type: 'TAP_COURT', zone: 'restricted', x: 50, y: 16 },
            { type: 'TOGGLE_ATTR', attr: 'contested' },        // during player step
            { type: 'SELECT_PLAYER', playerId: 'p1', playerName: null },
        );
        expect(s.outbox[0].attributes).toEqual(['fastbreak', 'contested']);
    });

    it('pre-tap attrs reset between queued events', () => {
        let s = run(
            start(ev({ points: 1 }), { showContext: false }),
            { type: 'TOGGLE_ATTR', attr: 'fastbreak' },
            { type: 'ENQUEUE', event: ev({ points: 1 }) },
            { type: 'SELECT_PLAYER', playerId: 'p1', playerName: null },   // finalizes 1st
        );
        s = run(s, { type: 'SELECT_PLAYER', playerId: 'p2', playerName: null });
        expect(s.outbox[0].attributes).toEqual(['fastbreak']);
        expect(s.outbox[1].attributes).toEqual([]);
    });

    it('DRAIN_OUTBOX removes exactly the delivered payloads', () => {
        let s = run(start(ev({ points: 1 }), { showContext: false }),
            { type: 'SELECT_PLAYER', playerId: 'p1', playerName: null });
        s = run(s, { type: 'ENQUEUE', event: ev({ points: 1 }) });
        s = run(s, { type: 'SELECT_PLAYER', playerId: 'p2', playerName: null });
        expect(s.outbox).toHaveLength(2);
        s = reduce(s, { type: 'DRAIN_OUTBOX', count: 2 });
        expect(s.outbox).toHaveLength(0);
    });
});
