// Golden tests for statsEngine's spatial math — distance bands and zone
// aggregation. These pin the 2026-07-07 fixes:
//  1. FIBA corner 3s (~21.7 ft) must land in the 3-Pointers band (binned by
//     ZONE, not by a >=22ft distance cut).
//  2. Zone aggregation re-derives zones from x/y — so ZONES centroids must
//     round-trip (see courtZones.test.ts) for zone-only captures to aggregate
//     under their captured zone.
import { describe, it, expect } from 'vitest';
import { distanceBands, aggregateZones, shotDistanceFt } from './statsEngine';
import type { ShotEvent } from '../components/shotchart/types/shotTypes';
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
