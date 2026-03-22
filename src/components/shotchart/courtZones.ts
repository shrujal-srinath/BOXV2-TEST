// src/components/shotchart/courtZones.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Court Zone Definitions & Classification
//
// Coordinate system: 0-100 (x) by 0-94 (y)
// Origin (0,0) = left side of baseline
// (50,0) = center of basket/baseline
// (50,94) = center of half-court line
//
// FIBA half-court dimensions: 15m wide × 14m deep
// 1 unit ≈ 15cm
// ─────────────────────────────────────────────────────────────────────────────

import type { ShotZoneId, ZoneDefinition } from './types/shotTypes';

// ── Court geometry constants (in coordinate units) ───────────────────────────

export const COURT = {
    width: 100,
    height: 94,
    basketX: 50,
    basketY: 5.25,       // basket is 1.575m from baseline → ~5.25 units
    restrictedRadius: 4,  // 1.25m restricted arc → ~4.2 units
    paintLeft: 31,        // paint is 4.9m wide → ~16.3 units each side
    paintRight: 69,
    paintTop: 19,         // FT line is 5.8m from baseline → ~19.3 units
    ftCircleRadius: 6,    // FT circle 1.8m radius → ~6 units
    threePointRadius: 22.5, // 6.75m arc → ~22.5 units
    threeCornerX: 3,      // corner 3 is 0.9m from sideline → ~3 units
    threeCornerMaxY: 9,   // corner 3 extends to ~2.99m → ~9.3 units
} as const;

// ── Zone definitions with centroids ──────────────────────────────────────────

export const ZONES: Record<ShotZoneId, ZoneDefinition> = {
    restricted: {
        id: 'restricted', label: 'Restricted area', shortLabel: 'RA',
        pointValue: 2, cx: 50, cy: 5,
    },
    paint_left: {
        id: 'paint_left', label: 'Paint left', shortLabel: 'PL',
        pointValue: 2, cx: 38, cy: 12,
    },
    paint_right: {
        id: 'paint_right', label: 'Paint right', shortLabel: 'PR',
        pointValue: 2, cx: 62, cy: 12,
    },
    mid_baseline_left: {
        id: 'mid_baseline_left', label: 'Mid baseline left', shortLabel: 'MBL',
        pointValue: 2, cx: 15, cy: 8,
    },
    mid_baseline_right: {
        id: 'mid_baseline_right', label: 'Mid baseline right', shortLabel: 'MBR',
        pointValue: 2, cx: 85, cy: 8,
    },
    mid_elbow_left: {
        id: 'mid_elbow_left', label: 'Left elbow', shortLabel: 'LEL',
        pointValue: 2, cx: 28, cy: 22,
    },
    mid_elbow_right: {
        id: 'mid_elbow_right', label: 'Right elbow', shortLabel: 'REL',
        pointValue: 2, cx: 72, cy: 22,
    },
    mid_top: {
        id: 'mid_top', label: 'Mid top of key', shortLabel: 'MT',
        pointValue: 2, cx: 50, cy: 25,
    },
    three_corner_left: {
        id: 'three_corner_left', label: 'Left corner 3', shortLabel: 'LC3',
        pointValue: 3, cx: 2, cy: 5,
    },
    three_corner_right: {
        id: 'three_corner_right', label: 'Right corner 3', shortLabel: 'RC3',
        pointValue: 3, cx: 98, cy: 5,
    },
    three_wing_left: {
        id: 'three_wing_left', label: 'Left wing 3', shortLabel: 'LW3',
        pointValue: 3, cx: 10, cy: 30,
    },
    three_wing_right: {
        id: 'three_wing_right', label: 'Right wing 3', shortLabel: 'RW3',
        pointValue: 3, cx: 90, cy: 30,
    },
    three_top_left: {
        id: 'three_top_left', label: 'Top left 3', shortLabel: 'TL3',
        pointValue: 3, cx: 28, cy: 42,
    },
    three_top_right: {
        id: 'three_top_right', label: 'Top right 3', shortLabel: 'TR3',
        pointValue: 3, cx: 72, cy: 42,
    },
    three_top_center: {
        id: 'three_top_center', label: 'Top center 3', shortLabel: 'TC3',
        pointValue: 3, cx: 50, cy: 48,
    },
    unlocated: {
        id: 'unlocated', label: 'Unlocated', shortLabel: '??',
        pointValue: 2, cx: 50, cy: 47,
    },
};

export const ZONE_LIST = Object.values(ZONES).filter(z => z.id !== 'unlocated');

// ── Zone classification pure function ────────────────────────────────────────

/**
 * Classify a court coordinate into a zone.
 * Pure function — no side effects, deterministic output.
 *
 * @param x - X coordinate (0-100, left to right)
 * @param y - Y coordinate (0-94, baseline to half-court)
 * @returns The zone ID for this coordinate
 */
export function classifyZone(x: number, y: number): ShotZoneId {
    const { basketX, basketY, restrictedRadius, paintLeft, paintRight, paintTop,
        threePointRadius, threeCornerX, threeCornerMaxY } = COURT;

    // Distance from basket center
    const dx = x - basketX;
    const dy = y - basketY;
    const distFromBasket = Math.sqrt(dx * dx + dy * dy);

    // 1. Restricted area (semicircle around basket)
    if (distFromBasket <= restrictedRadius + 1 && y < paintTop) {
        return 'restricted';
    }

    // 2. Inside the paint but outside restricted
    if (x >= paintLeft && x <= paintRight && y <= paintTop) {
        if (distFromBasket <= restrictedRadius + 1) return 'restricted';
        return x < basketX ? 'paint_left' : 'paint_right';
    }

    // 3. Check if we're behind the 3-point line
    const isBehindThreeArc = distFromBasket >= threePointRadius;
    const isCornerThree = y <= threeCornerMaxY && (x <= threeCornerX + 6 || x >= 100 - threeCornerX - 6);

    // Corner 3s: below the arc break, outside the sideline threshold
    if (isCornerThree && (x <= threeCornerX + 6 || x >= 100 - threeCornerX - 6)) {
        return x < basketX ? 'three_corner_left' : 'three_corner_right';
    }

    // Behind the 3-point arc
    if (isBehindThreeArc || isCornerThree) {
        // Angle from basket to determine which 3pt zone
        const angle = Math.atan2(dy, dx) * (180 / Math.PI); // degrees, 0=right, 90=up

        if (y <= threeCornerMaxY) {
            return x < basketX ? 'three_corner_left' : 'three_corner_right';
        }

        // Wing zones (roughly 15-50 degrees from baseline on each side)
        if (x < 25) return 'three_wing_left';
        if (x > 75) return 'three_wing_right';

        // Top zones
        if (x < 40) return 'three_top_left';
        if (x > 60) return 'three_top_right';
        return 'three_top_center';
    }

    // 4. Mid-range (inside 3pt arc, outside paint)
    if (y <= 14) {
        return x < basketX ? 'mid_baseline_left' : 'mid_baseline_right';
    }

    if (y <= paintTop + 8) {
        if (x < paintLeft) return 'mid_elbow_left';
        if (x > paintRight) return 'mid_elbow_right';
    }

    return 'mid_top';
}

// ── Attribute definitions ────────────────────────────────────────────────────

export const SHOT_ATTRIBUTES = [
    { id: 'fastbreak' as const, label: 'Fastbreak', category: 'context' },
    { id: 'second_chance' as const, label: '2nd Chance', category: 'context' },
    { id: 'off_turnover' as const, label: 'Off TO', category: 'context' },
    { id: 'uncontested' as const, label: 'Open', category: 'quality' },
    { id: 'contested' as const, label: 'Contested', category: 'quality' },
    { id: 'catch_and_shoot' as const, label: 'Catch & Shoot', category: 'type' },
    { id: 'pull_up' as const, label: 'Pull-up', category: 'type' },
    { id: 'off_screen' as const, label: 'Off Screen', category: 'type' },
    { id: 'post_up' as const, label: 'Post-up', category: 'type' },
] as const;