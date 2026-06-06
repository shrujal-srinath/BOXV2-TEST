// src/components/shotchart/courtZones.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Court Zone Definitions & Classification v2
//
// Coordinate system: 0-100 (x) by 0-94 (y)
// Origin (0,0) = left corner of baseline (endline)
// (50,0) = center of baseline
// (50,94) = center of half-court line
//
// FIBA half-court: 15m wide × 14m deep
// Scale: 1 unit = 0.15m in BOTH axes
//   x: 100 units = 15.0m ✓
//   y: 94 units = 14.1m ≈ 14.0m ✓
//
// v2 FIXES: Previous version had ALL y-values at exactly half the correct
// value (used 0.3m/unit instead of 0.15m/unit). This has been corrected.
// ─────────────────────────────────────────────────────────────────────────────

import type { ShotZoneId, ZoneDefinition } from './types/shotTypes';

// ── Conversion helpers ───────────────────────────────────────────────────────

const M_TO_U = 6.667; // meters to units (1m = 100/15 = 6.667 units)

// ── Court geometry constants (FIBA 2024) ─────────────────────────────────────

export const COURT = {
    width: 100,
    height: 94,
    basketX: 50,
    basketY: 10.5,           // 1.575m from endline
    restrictedRadius: 8.33,   // 1.25m no-charge semicircle
    paintLeft: 33.67,         // center - 2.45m (4.9m total width)
    paintRight: 66.33,        // center + 2.45m
    paintTop: 38.67,          // FT line: 5.8m from endline
    ftCircleRadius: 12,       // 1.8m radius
    threePointRadius: 45,     // 6.75m from basket center
    threeCornerX: 6,          // 0.9m from sideline
    threeCornerMaxY: 19.93,   // tangent point where arc meets straight corner line
    // Derived: backboard at 1.2m from endline = 8 units
    backboardY: 8,
    // Derived: center circle radius 1.8m = 12 units
    centerCircleRadius: 12,
    // Lane marks from endline: 1.75m, 2.55m, 3.35m, 4.15m
    laneMarks: [11.67, 17.0, 22.33, 27.67],
} as const;

// ── Zone definitions with centroids ──────────────────────────────────────────

export const ZONES: Record<ShotZoneId, ZoneDefinition> = {
    at_rim: {
        id: 'at_rim', label: 'At rim / Dunk', shortLabel: 'RIM',
        pointValue: 2, cx: 50, cy: 10.5,
    },
    restricted: {
        id: 'restricted', label: 'Restricted area', shortLabel: 'RA',
        pointValue: 2, cx: 50, cy: 12,
    },
    paint_left: {
        id: 'paint_left', label: 'Paint left', shortLabel: 'PL',
        pointValue: 2, cx: 40, cy: 26,
    },
    paint_right: {
        id: 'paint_right', label: 'Paint right', shortLabel: 'PR',
        pointValue: 2, cx: 60, cy: 26,
    },
    mid_baseline_left: {
        id: 'mid_baseline_left', label: 'Mid baseline left', shortLabel: 'MBL',
        pointValue: 2, cx: 20, cy: 14,
    },
    mid_baseline_right: {
        id: 'mid_baseline_right', label: 'Mid baseline right', shortLabel: 'MBR',
        pointValue: 2, cx: 80, cy: 14,
    },
    mid_elbow_left: {
        id: 'mid_elbow_left', label: 'Left elbow', shortLabel: 'LEL',
        pointValue: 2, cx: 24, cy: 38,
    },
    mid_elbow_right: {
        id: 'mid_elbow_right', label: 'Right elbow', shortLabel: 'REL',
        pointValue: 2, cx: 76, cy: 38,
    },
    mid_top: {
        id: 'mid_top', label: 'Mid top of key', shortLabel: 'MT',
        pointValue: 2, cx: 50, cy: 46,
    },
    three_corner_left: {
        id: 'three_corner_left', label: 'Left corner 3', shortLabel: 'LC3',
        pointValue: 3, cx: 3, cy: 10,
    },
    three_corner_right: {
        id: 'three_corner_right', label: 'Right corner 3', shortLabel: 'RC3',
        pointValue: 3, cx: 97, cy: 10,
    },
    three_wing_left: {
        id: 'three_wing_left', label: 'Left wing 3', shortLabel: 'LW3',
        pointValue: 3, cx: 10, cy: 40,
    },
    three_wing_right: {
        id: 'three_wing_right', label: 'Right wing 3', shortLabel: 'RW3',
        pointValue: 3, cx: 90, cy: 40,
    },
    three_top_left: {
        id: 'three_top_left', label: 'Top left 3', shortLabel: 'TL3',
        pointValue: 3, cx: 25, cy: 60,
    },
    three_top_right: {
        id: 'three_top_right', label: 'Top right 3', shortLabel: 'TR3',
        pointValue: 3, cx: 75, cy: 60,
    },
    three_top_center: {
        id: 'three_top_center', label: 'Top center 3', shortLabel: 'TC3',
        pointValue: 3, cx: 50, cy: 64,
    },
    unlocated: {
        id: 'unlocated', label: 'Unlocated', shortLabel: '??',
        pointValue: 2, cx: 50, cy: 70,
    },
};

export const ZONE_LIST = Object.values(ZONES).filter(z => z.id !== 'unlocated');

// ── Zone classification ──────────────────────────────────────────────────────

export function classifyZone(x: number, y: number): ShotZoneId {
    const { basketX, basketY, restrictedRadius, paintLeft, paintRight, paintTop,
        threePointRadius, threeCornerX, threeCornerMaxY } = COURT;

    const dx = x - basketX;
    const dist = Math.sqrt(dx * dx + (y - basketY) * (y - basketY));

    // 1. At-rim (very close to basket — dunk/tip zone)
    if (dist <= 1.6) return 'at_rim';

    // 2. Paint (includes restricted check)
    if (x >= paintLeft && x <= paintRight && y <= paintTop) {
        if (dist <= restrictedRadius) return 'restricted';
        return x < basketX ? 'paint_left' : 'paint_right';
    }
    // Restricted arc that extends slightly beyond paint edges
    if (dist <= restrictedRadius && y <= basketY + restrictedRadius) return 'restricted';

    // 3. Corner 3 — only in the true corner column (no fudge factor)
    if (y <= threeCornerMaxY) {
        if (x <= threeCornerX) return 'three_corner_left';
        if (x >= 100 - threeCornerX) return 'three_corner_right';
    }

    // 4. Beyond arc — split by angle from basket for accurate zone boundaries
    if (dist >= threePointRadius) {
        const ang = Math.atan2(y - basketY, x - basketX) * 180 / Math.PI;
        if (ang < 25)   return 'three_wing_right';
        if (ang < 65)   return 'three_top_right';
        if (ang <= 115) return 'three_top_center';
        if (ang <= 155) return 'three_top_left';
        return 'three_wing_left';
    }

    // 5. Mid-range
    if (y <= paintTop) {
        return x < basketX ? 'mid_baseline_left' : 'mid_baseline_right';
    }
    if (y <= paintTop + 10) {
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