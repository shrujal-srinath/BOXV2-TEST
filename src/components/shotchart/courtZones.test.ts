// Golden tests for the court zone law — the single most load-bearing math in
// the ecosystem (shot capture, persistence, stats, heatmaps, and the Flutter
// port all depend on classifyZone behaving EXACTLY like this).
// If one of these fails, you changed shot-analytics semantics: stop and check
// fable-5/OPUS-GUIDANCE.md §2 before "fixing" the test.
import { describe, it, expect } from 'vitest';
import { classifyZone, ZONES, COURT } from './courtZones';

describe('classifyZone golden cases (portrait half-court, 0-100 × 0-94)', () => {
    const cases: Array<[number, number, string]> = [
        [50, 10.5, 'at_rim'],            // basket center
        [50, 11.9, 'at_rim'],            // within 1.6u dunk radius
        [50, 16, 'restricted'],          // inside no-charge arc
        [40, 26, 'paint_left'],          // paint, left of rim
        [60, 26, 'paint_right'],
        [20, 14, 'mid_baseline_left'],   // 2pt baseline
        [80, 14, 'mid_baseline_right'],
        [24, 42, 'mid_elbow_left'],      // just above FT line, outside lane
        [76, 42, 'mid_elbow_right'],
        [50, 46, 'mid_top'],             // top of key, inside arc
        [3, 10, 'three_corner_left'],    // corner column, x ≤ 6
        [97, 10, 'three_corner_right'],
        [6.5, 28, 'three_wing_left'],    // beyond arc, >155° from basket
        [93.5, 28, 'three_wing_right'],  // beyond arc, <25°
        [25, 60, 'three_top_left'],
        [75, 60, 'three_top_right'],
        [50, 64, 'three_top_center'],    // straight-on 3
        [6.5, 15, 'mid_baseline_left'],  // 0.975m off sideline, INSIDE arc: a long 2
        [50, 2, 'paint_right'],          // directly behind the backboard
    ];
    it.each(cases)('(%f, %f) → %s', (x, y, zone) => {
        expect(classifyZone(x, y)).toBe(zone);
    });

    it('FIBA corner-3 tangent: arc meets corner column at y≈19.93', () => {
        // sqrt(45² − 44²) = 9.43 above basketY 10.5
        expect(COURT.threeCornerMaxY).toBeCloseTo(10.5 + Math.sqrt(45 ** 2 - 44 ** 2), 1);
    });
});

describe('ZONES centroids self-classify (shotService backfills x/y from these)', () => {
    // Every centroid MUST classify to its own zone id — shotService.recordShot
    // fills x/y from ZONES[zone].cx/cy for zone-only captures, and statsEngine
    // re-derives the zone from x/y. A drifted centroid silently re-bins shots
    // (this actually happened: wings landed as top-3s before 2026-07-07).
    for (const z of Object.values(ZONES)) {
        if (z.id === 'unlocated') continue;
        it(`${z.id} centroid (${z.cx}, ${z.cy})`, () => {
            expect(classifyZone(z.cx, z.cy)).toBe(z.id);
        });
    }
});
