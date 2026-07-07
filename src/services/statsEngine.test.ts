// Golden tests for statsEngine's spatial math — distance bands and zone
// aggregation. These pin the 2026-07-07 fixes:
//  1. FIBA corner 3s (~21.7 ft) must land in the 3-Pointers band (binned by
//     ZONE, not by a >=22ft distance cut).
//  2. Zone aggregation re-derives zones from x/y — so ZONES centroids must
//     round-trip (see courtZones.test.ts) for zone-only captures to aggregate
//     under their captured zone.
import { describe, it, expect } from 'vitest';
import {
    distanceBands, aggregateZones, shotDistanceFt,
    attributeSplits, specialPoints, leadFlow, clutchStats,
    assistNetwork, possessionHistogram, shotQuality,
} from './statsEngine';
import type { ShotEvent } from '../components/shotchart/types/shotTypes';
import type { ScoreTimelinePoint } from '../components/stats/types';
import { ZONES } from '../components/shotchart/courtZones';

let seq = 0;
const shot = (x: number, y: number, over: Partial<ShotEvent> = {}): ShotEvent => ({
    id: `s${++seq}`,
    gameCode: 'TEST',
    playerId: null,
    teamSide: 'A',
    x, y,
    zone: 'unlocated',
    made: true,
    points: 2,
    shotType: 'field_goal',
    period: 1,
    gameClockSec: 300,
    attributes: [],
    assistedBy: null,
    reboundedBy: null,
    reboundType: null,
    blockedBy: null,
    inputMethod: 'live',
    editedAt: null,
    createdAt: new Date().toISOString(),
    ...over,
});

describe('distanceBands', () => {
    it('a FIBA corner 3 (~21.7 ft) lands in the 3-Pointers band, not long-2', () => {
        // (6, 10) sits ON the corner-3 line: 44 units = 6.6 m = 21.66 ft — a
        // legal 3 that a >=22ft distance cut would re-bin as a long 2.
        const corner = shot(6, 10, { zone: 'three_corner_left', points: 3 });
        expect(shotDistanceFt(6, 10)).toBeLessThan(22);
        const bands = distanceBands([corner]);
        expect(bands.find(b => b.label === '3-Pointers')!.fga).toBe(1);
        expect(bands.find(b => b.label === '16 ft–3PT')!.fga).toBe(0);
    });

    it('a long 2 just inside the arc stays in the 16 ft–3PT band', () => {
        const longTwo = shot(50, 52, { zone: 'mid_top' });   // ~20.4 ft, inside arc
        const bands = distanceBands([longTwo]);
        expect(bands.find(b => b.label === '16 ft–3PT')!.fga).toBe(1);
        expect(bands.find(b => b.label === '3-Pointers')!.fga).toBe(0);
    });

    it('rim / short / mid shots bin by distance; free throws are excluded', () => {
        const bands = distanceBands([
            shot(50, 11, { zone: 'at_rim' }),                          // ~0.3 ft
            shot(50, 24, { zone: 'restricted' }),                      // ~6.6 ft
            shot(40, 34, { zone: 'paint_left' }),                      // ~12.6 ft
            shot(50, 38.67, { zone: 'mid_top', shotType: 'free_throw', points: 1 }),
        ]);
        expect(bands.find(b => b.label === '0–3 ft')!.fga).toBe(1);
        expect(bands.find(b => b.label === '3–10 ft')!.fga).toBe(1);
        expect(bands.find(b => b.label === '10–16 ft')!.fga).toBe(1);
        expect(bands.reduce((n, b) => n + b.fga, 0)).toBe(3);
    });
});

describe('aggregateZones', () => {
    it('a zone-only capture backfilled from its centroid aggregates under that zone', () => {
        // Simulates shotService's centroid backfill for every zone.
        const shots = Object.values(ZONES)
            .filter(z => z.id !== 'unlocated')
            .map(z => shot(z.cx, z.cy, { zone: z.id, points: z.pointValue as 2 | 3 }));
        const agg = aggregateZones(shots);
        for (const z of Object.values(ZONES)) {
            if (z.id === 'unlocated') continue;
            const row = agg.find(a => a.zone === z.id);
            expect(row, `zone ${z.id} lost its shot to a neighbouring zone`).toBeDefined();
            expect(row!.fga).toBe(1);
        }
    });

    it('unlocated shots keep their unlocated bucket (never reclassified)', () => {
        const agg = aggregateZones([shot(50, 70, { zone: 'unlocated' })]);
        expect(agg.find(a => a.zone === 'unlocated')!.fga).toBe(1);
    });

    it('filters by team side', () => {
        const agg = aggregateZones(
            [shot(50, 16, { zone: 'restricted' }), shot(50, 16, { zone: 'restricted', teamSide: 'B' })],
            'B',
        );
        expect(agg.find(a => a.zone === 'restricted')!.fga).toBe(1);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// Advanced analytics (2026-07-07) — hand-computed goldens
// ═════════════════════════════════════════════════════════════════════════════

describe('attributeSplits', () => {
    it('splits shooting per tag; tags overlap by design; declaration order', () => {
        const rows = attributeSplits([
            shot(40, 26, { zone: 'paint_left', made: true, points: 2, attributes: ['fastbreak', 'contested'] as never }),
            shot(40, 26, { zone: 'paint_left', made: false, points: 2, attributes: ['fastbreak'] as never }),
            shot(3, 10, { zone: 'three_corner_left', made: true, points: 3, attributes: ['catch_and_shoot'] as never }),
        ]);
        expect(rows.map(r => r.attribute)).toEqual(['fastbreak', 'contested', 'catch_and_shoot']);
        const fb = rows[0];
        expect([fb.fga, fb.fgm, fb.points, fb.fgPct]).toEqual([2, 1, 2, 50]);
        expect(rows[1]).toMatchObject({ fga: 1, fgm: 1, points: 2, category: 'quality' });
        expect(rows[2]).toMatchObject({ fga: 1, fgm: 1, points: 3, category: 'type' });
    });

    it('free throws never enter attribute splits', () => {
        const rows = attributeSplits([
            shot(50, 38, { shotType: 'free_throw', points: 1, made: true, attributes: ['fastbreak'] as never }),
        ]);
        expect(rows).toEqual([]);
    });
});

describe('specialPoints', () => {
    it('tags drive fastbreak/2nd-chance/off-TO; paint is zone-derived; misses score 0', () => {
        const sp = specialPoints([
            shot(50, 16, { zone: 'restricted', made: true, points: 2, attributes: ['fastbreak'] as never }),
            shot(3, 10, { zone: 'three_corner_left', made: true, points: 3, attributes: ['second_chance'] as never }),
            shot(40, 26, { zone: 'paint_left', made: false, points: 2, attributes: ['off_turnover'] as never }),
        ]);
        expect(sp).toEqual({ fastbreak: 2, secondChance: 3, offTurnover: 0, inPaint: 2 });
    });
});

describe('leadFlow', () => {
    // Hand-built timeline: 0-0 → A+2 → B-1 → B-3 → tie → A+2, one event per minute.
    const tl: ScoreTimelinePoint[] = [
        { elapsedSec: 0, period: 1, clockLabel: 'Q1 10:00', scoreA: 0, scoreB: 0, lead: 0 },
        { elapsedSec: 60, period: 1, clockLabel: 'Q1 9:00', scoreA: 2, scoreB: 0, lead: 2 },
        { elapsedSec: 120, period: 1, clockLabel: 'Q1 8:00', scoreA: 2, scoreB: 3, lead: -1 },
        { elapsedSec: 180, period: 1, clockLabel: 'Q1 7:00', scoreA: 2, scoreB: 5, lead: -3 },
        { elapsedSec: 240, period: 1, clockLabel: 'Q1 6:00', scoreA: 5, scoreB: 5, lead: 0 },
        { elapsedSec: 300, period: 1, clockLabel: 'Q1 5:00', scoreA: 7, scoreB: 5, lead: 2 },
    ];

    it('counts lead changes (through-a-tie included) and ties', () => {
        const lf = leadFlow(tl);
        expect(lf.leadChanges).toBe(2);   // +→− at 120s, −→+ at 300s (via the tie)
        expect(lf.timesTied).toBe(1);     // the 5-5 moment
    });

    it('integrates time in front segment-by-segment, with the totalGameSec tail', () => {
        const lf = leadFlow(tl, { totalGameSec: 360 });
        expect(lf.timeLeadingSecA).toBe(60 + 60);   // [60,120) + tail [300,360)
        expect(lf.timeLeadingSecB).toBe(120);        // [120,240)
        expect(lf.timeTiedSec).toBe(120);            // [0,60) + [240,300)
    });
});

describe('clutchStats', () => {
    it('late+close window: final-period last 5:00 and all OT, margin measured BEFORE the event', () => {
        const c = clutchStats([
            // P4 6:40 (400s): outside window even though close.
            shot(50, 16, { zone: 'restricted', teamSide: 'A', playerId: 'a1', made: true, points: 2, period: 4, gameClockSec: 400 }),
            // P4 4:10 (250s), margin |2-0|=2 → clutch B three.
            shot(3, 10, { zone: 'three_corner_left', teamSide: 'B', playerId: 'b1', made: true, points: 3, period: 4, gameClockSec: 250 }),
            // P4 1:40, margin 1 → clutch A free throw.
            shot(50, 38, { shotType: 'free_throw', teamSide: 'A', playerId: 'a1', made: true, points: 1, period: 4, gameClockSec: 100 }),
            // P4 0:50, margin 0 → clutch A missed three.
            shot(25, 60, { zone: 'three_top_left', teamSide: 'A', playerId: 'a2', made: false, points: 3, period: 4, gameClockSec: 50 }),
            // OT counts entirely, margin 0 → clutch B.
            shot(50, 16, { zone: 'restricted', teamSide: 'B', playerId: 'b1', made: true, points: 2, period: 5, gameClockSec: 500 }),
        ], { totalPeriods: 4 });

        expect(c.hasClutchTime).toBe(true);
        expect(c.teamA).toMatchObject({ pts: 1, fgm: 0, fga: 1, tpm: 0, tpa: 1, ftm: 1, fta: 1, fgPct: 0 });
        expect(c.teamB).toMatchObject({ pts: 5, fgm: 2, fga: 2, tpm: 1, tpa: 1, fgPct: 100 });
        expect(c.players[0]).toMatchObject({ playerId: 'b1', side: 'B', pts: 5 });
    });

    it('a blowout has no clutch time', () => {
        const blowout = [
            ...[500, 450, 400, 350].map(clock =>
                shot(50, 64, { zone: 'three_top_center', teamSide: 'A', made: true, points: 3, period: 1, gameClockSec: clock })),
            shot(50, 16, { zone: 'restricted', teamSide: 'B', made: true, points: 2, period: 4, gameClockSec: 200 }),
        ];
        expect(clutchStats(blowout, { totalPeriods: 4 }).hasClutchTime).toBe(false); // margin 12 > 5
    });
});

describe('assistNetwork', () => {
    it('builds passer→scorer links from made FGs; assisted rate over makes', () => {
        const net = assistNetwork([
            shot(50, 16, { zone: 'restricted', playerId: 'alice', assistedBy: 'bob', made: true, points: 2 }),
            shot(3, 10, { zone: 'three_corner_left', playerId: 'alice', assistedBy: 'bob', made: true, points: 3 }),
            shot(40, 26, { zone: 'paint_left', playerId: 'cara', assistedBy: 'alice', made: true, points: 2 }),
            shot(50, 46, { zone: 'mid_top', playerId: 'cara', made: true, points: 2 }),          // unassisted
            shot(50, 46, { zone: 'mid_top', playerId: 'cara', assistedBy: 'alice', made: false, points: 2 }), // miss ignored
        ]);
        expect(net.assistedFgm).toBe(3);
        expect(net.unassistedFgm).toBe(1);
        expect(net.assistedPct).toBe(75);
        expect(net.topDuo).toMatchObject({ fromPlayerId: 'bob', toPlayerId: 'alice', count: 2, points: 5 });
        expect(net.links).toHaveLength(2);
    });
});

describe('possessionHistogram', () => {
    it('bins descend (hi−3, hi]; the last bin includes 0; boundaries land low', () => {
        const bins = possessionHistogram([
            shot(50, 16, { zone: 'restricted', shotClockSec: 24, made: true, points: 2 }),
            shot(50, 16, { zone: 'restricted', shotClockSec: 21, made: false, points: 2 }), // boundary → 21–18s bin
            shot(3, 10, { zone: 'three_corner_left', shotClockSec: 2, made: true, points: 3 }),
            shot(50, 16, { zone: 'restricted', shotClockSec: 0, made: false, points: 2 }),
        ]);
        expect(bins).toHaveLength(8);
        expect(bins[0]).toMatchObject({ label: '24–21s', fga: 1, fgm: 1, points: 2 });
        expect(bins[1]).toMatchObject({ label: '21–18s', fga: 1, fgm: 0 });
        expect(bins[7]).toMatchObject({ label: '3–0s', fga: 2, fgm: 1, points: 3 });
        expect(bins.reduce((n, b) => n + b.fga, 0)).toBe(4);
    });
});

describe('shotQuality (xPPA vs actual)', () => {
    it('expected from league priors × zone value; actual from results', () => {
        const q = shotQuality([
            shot(50, 11, { zone: 'at_rim', made: true, points: 2 }),               // exp 0.62×2 = 1.24
            shot(3, 10, { zone: 'three_corner_left', made: false, points: 3 }),    // exp 0.38×3 = 1.14
        ]);
        expect(q.fga).toBe(2);
        expect(q.expectedPts).toBeCloseTo(2.38, 5);
        expect(q.actualPts).toBe(2);
        expect(q.ppaExpected).toBeCloseTo(1.19, 5);
        expect(q.ppaActual).toBeCloseTo(1.0, 5);
        expect(q.delta).toBeCloseTo(-0.19, 5);
    });
});

describe('aggregateZones per-player filter', () => {
    it('third parameter narrows to one player', () => {
        const shots = [
            shot(50, 16, { zone: 'restricted', playerId: 'p1' }),
            shot(50, 16, { zone: 'restricted', playerId: 'p2' }),
        ];
        expect(aggregateZones(shots, undefined, 'p1').find(z => z.zone === 'restricted')!.fga).toBe(1);
    });
});
