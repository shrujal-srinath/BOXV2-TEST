// Golden tests for the hexbin shot-chart engine. The bin math must stay stable:
// share cards, StatsHub charts, and (future) career profiles all render from it.
import { describe, it, expect } from 'vitest';
import { buildHexbins, binsToLandscape } from './hexbinEngine';
import type { ShotEvent } from '../components/shotchart/types/shotTypes';

let seq = 0;
const shot = (x: number, y: number, over: Partial<ShotEvent> = {}): ShotEvent => ({
    id: `h${++seq}`,
    gameCode: 'TEST',
    playerId: 'p1',
    teamSide: 'A',
    x, y,
    zone: 'restricted',
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

describe('buildHexbins', () => {
    it('same-spot shots share one bin; the bin center contains the point (≤ R)', () => {
        const r = buildHexbins([
            shot(50, 16, { made: true, points: 2 }),
            shot(50, 16, { made: false, points: 2 }),
        ]);
        expect(r.bins).toHaveLength(1);
        const b = r.bins[0];
        expect(b.attempts).toBe(2);
        expect(b.made).toBe(1);
        expect(b.fgPct).toBe(50);
        expect(b.points).toBe(2);
        expect(b.ppa).toBeCloseTo(1, 5);
        expect(b.expPpa).toBeCloseTo(0.58 * 2, 5);       // restricted prior
        expect(b.delta).toBeCloseTo(1 - 1.16, 5);
        expect(b.sizeT).toBe(1);
        expect(Math.hypot(b.cx - 50, b.cy - 16)).toBeLessThanOrEqual(r.radius + 1e-9);
    });

    it('distant shots land in distinct bins', () => {
        const r = buildHexbins([
            shot(50, 16),
            shot(3, 10, { zone: 'three_corner_left', points: 3 }),
        ]);
        expect(r.bins).toHaveLength(2);
    });

    it('minAttempts gates small samples but totalAttempts counts them', () => {
        const r = buildHexbins(
            [shot(50, 16), shot(50, 16), shot(3, 10, { zone: 'three_corner_left', points: 3 })],
            { minAttempts: 2 }
        );
        expect(r.bins).toHaveLength(1);
        expect(r.totalAttempts).toBe(3);
        expect(r.maxAttempts).toBe(2);
    });

    it('sizeT scales against the busiest bin', () => {
        const r = buildHexbins([
            shot(50, 16), shot(50, 16), shot(50, 16),
            shot(3, 10, { zone: 'three_corner_left', points: 3 }),
        ]);
        const small = r.bins.find(b => b.attempts === 1)!;
        expect(small.sizeT).toBeCloseTo(1 / 3, 5);
    });

    it('excludes free throws, unlocated rows, and null coordinates', () => {
        const r = buildHexbins([
            shot(50, 38, { shotType: 'free_throw', points: 1 }),
            shot(50, 70, { zone: 'unlocated' }),
            shot(null as unknown as number, null as unknown as number, { zone: 'restricted' }),
        ]);
        expect(r.bins).toHaveLength(0);
        expect(r.totalAttempts).toBe(0);
    });

    it('filters by side and playerId', () => {
        const shots = [
            shot(50, 16, { teamSide: 'A', playerId: 'p1' }),
            shot(50, 16, { teamSide: 'B', playerId: 'p2' }),
        ];
        expect(buildHexbins(shots, { side: 'B' }).totalAttempts).toBe(1);
        expect(buildHexbins(shots, { playerId: 'p1' }).totalAttempts).toBe(1);
    });

    it('a bin straddle-free sanity: every shot within R of its bin center', () => {
        // Spray of located shots across the half court — containment must hold everywhere.
        const spray: ShotEvent[] = [];
        for (let x = 2; x <= 98; x += 12) {
            for (let y = 2; y <= 92; y += 15) {
                spray.push(shot(x, y, { zone: 'mid_top' }));
            }
        }
        const r = buildHexbins(spray);
        expect(r.totalAttempts).toBe(spray.length);
        const binned = r.bins.reduce((n, b) => n + b.attempts, 0);
        expect(binned).toBe(spray.length);
        for (const s of spray) {
            const owner = r.bins.reduce(
                (best, b) => {
                    const d = Math.hypot(b.cx - s.x, b.cy - s.y);
                    return d < best.d ? { d, b } : best;
                },
                { d: Infinity, b: r.bins[0] }
            );
            expect(owner.d).toBeLessThanOrEqual(r.radius + 1e-9);
        }
    });
});

describe('binsToLandscape (the unification law: bin in portrait, transform for display)', () => {
    it('team A bins land on the left basket, team B on the right', () => {
        const rim = buildHexbins([shot(50, 10.5)]);
        const a = binsToLandscape(rim, 'A')[0];
        const b = binsToLandscape(rim, 'B')[0];
        // Depth-from-own-basket becomes lx from the OWN end: A left, B mirrored right.
        expect(a.lx).toBeCloseTo(a.cy, 6);
        expect(b.lx).toBeCloseTo(188 - b.cy, 6);
        expect(a.ly).toBeCloseTo(a.cx, 6);   // width axis carries over
        expect(b.ly).toBeCloseTo(b.cx, 6);
    });

    it('aggregation is untouched — only coordinates are added', () => {
        const r = buildHexbins([shot(3, 10, { zone: 'three_corner_left', points: 3 }), shot(3, 10, { zone: 'three_corner_left', points: 3, made: false })]);
        const [land] = binsToLandscape(r, 'B');
        expect(land.attempts).toBe(2);
        expect(land.fgPct).toBe(50);
        expect(land.cx).toBe(r.bins[0].cx);  // portrait fields preserved
    });

    it('round-trips: landscape center maps back to the portrait bin center', () => {
        const r = buildHexbins([shot(24, 42, { zone: 'mid_elbow_left' })]);
        for (const side of ['A', 'B'] as const) {
            const [land] = binsToLandscape(r, side);
            const back = side === 'B' ? 188 - land.lx : land.lx;
            expect(back).toBeCloseTo(land.cy, 6);
        }
    });
});
