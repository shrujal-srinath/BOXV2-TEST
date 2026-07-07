// Golden tests for the landscape (188×100) ↔ portrait (100×94) mapping used by
// the Pi referee court. Convention: team A attacks the LEFT basket, B the RIGHT;
// persisted coords are always portrait with y = depth from the shooter's OWN
// basket. Breaking round-trip identity corrupts every future shot chart.
import { describe, it, expect } from 'vitest';
import {
    landscapeToPortrait, portraitToLandscape, classifyLandscape,
    QUICK_SPOTS, LS_W, BX_L, BX_R, BY, isBeyondArc,
} from './CourtGeometry';
import { classifyZone } from '../../shotchart/courtZones';

describe('portrait ↔ landscape round-trip is identity for both teams', () => {
    const shots: Array<[number, number]> = [
        [50, 10.5], [3, 10], [97, 10], [6.5, 28], [50, 64], [24, 42], [80, 14],
    ];
    for (const side of ['A', 'B'] as const) {
        it.each(shots)(`side ${side}: (%f, %f) survives`, (portX, portY) => {
            const { lx, ly } = portraitToLandscape(portX, portY, side);
            const back = landscapeToPortrait(lx, ly);
            expect(back.portX).toBeCloseTo(portX, 6);
            expect(back.portY).toBeCloseTo(portY, 6);
        });
    }

    it('team A lands on the left basket, team B on the right', () => {
        expect(portraitToLandscape(50, 10.5, 'A').lx).toBeCloseTo(BX_L);
        expect(portraitToLandscape(50, 10.5, 'B').lx).toBeCloseTo(BX_R);
        expect(portraitToLandscape(50, 10.5, 'A').ly).toBeCloseTo(BY);
    });
});

describe('classifyLandscape agrees with portrait classifyZone on both halves', () => {
    const shots: Array<[number, number]> = [
        [50, 10.5], [3, 10], [6.5, 28], [50, 64], [24, 42], [50, 46],
    ];
    for (const side of ['A', 'B'] as const) {
        it.each(shots)(`side ${side}: (%f, %f)`, (portX, portY) => {
            const { lx, ly } = portraitToLandscape(portX, portY, side);
            expect(classifyLandscape(lx, ly)).toBe(classifyZone(portX, portY));
        });
    }
});

describe('quick-spots classify to their declared zone (persisted verbatim)', () => {
    for (const spot of QUICK_SPOTS) {
        it(`${spot.id} (${spot.lx}, ${spot.ly}) → ${spot.zone}`, () => {
            expect(classifyLandscape(spot.lx, spot.ly)).toBe(spot.zone);
        });
        it(`${spot.id} mirrored for team B`, () => {
            expect(classifyLandscape(LS_W - spot.lx, spot.ly)).toBe(spot.zone);
        });
    }
});

describe('isBeyondArc matches classifyZone 2pt/3pt verdict', () => {
    const pts: Array<[number, number]> = [
        [30, 50], [56, 50], [5, 3], [20, 5], [40, 50], [12, 20], [176, 50], [158, 3],
    ];
    it.each(pts)('landscape (%f, %f)', (lx, ly) => {
        const zone = classifyLandscape(lx, ly);
        expect(isBeyondArc(lx, ly)).toBe(zone.startsWith('three_'));
    });
});
