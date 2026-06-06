// src/lib/xppa.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Expected Points Per Attempt (xPPA)
//
// Bayesian-shrinkage expected points per attempt for the active player at a
// hovered court zone. Blends the player's from-zone rate with a tuned league
// prior. Priors are ported from the scoring-console prototype and mapped onto
// this codebase's 17-zone ShotZoneId set. The prior values are tuned — do not
// "round" them.
//
// Pure module: derives everything from the in-memory ShotEvent[] the console
// already holds (no DB / service calls).
// ─────────────────────────────────────────────────────────────────────────────

import { ZONES } from '../components/shotchart/courtZones';
import type { ShotEvent, ShotZoneId } from '../components/shotchart/types/shotTypes';

// League-average FG% prior per zone (tuned). Two-point zones convert to ~2*prior
// expected points, three-point zones to ~3*prior.
export const ZONE_PRIOR: Record<ShotZoneId, number> = {
    at_rim: 0.62,
    restricted: 0.58,
    paint_left: 0.46,
    paint_right: 0.46,
    mid_baseline_left: 0.40,
    mid_baseline_right: 0.40,
    mid_elbow_left: 0.41,
    mid_elbow_right: 0.41,
    mid_top: 0.43,
    three_corner_left: 0.38,
    three_corner_right: 0.38,
    three_wing_left: 0.36,
    three_wing_right: 0.36,
    three_top_left: 0.35,
    three_top_right: 0.35,
    three_top_center: 0.35,
    unlocated: 0.45,
};

export function zonePoints(zone: ShotZoneId): 2 | 3 {
    return ZONES[zone].pointValue;
}

export type ZoneStat = { made: number; att: number };

// Per-zone made/attempts for a single player, from field-goal attempts only.
export function playerZoneStats(
    shots: ShotEvent[],
    playerId: string | null,
): Record<string, ZoneStat> {
    const out: Record<string, ZoneStat> = {};
    if (!playerId) return out;
    for (const s of shots) {
        if (s.playerId !== playerId) continue;
        if (s.shotType !== 'field_goal') continue;
        if (s.zone === 'unlocated') continue;
        const z = out[s.zone] || (out[s.zone] = { made: 0, att: 0 });
        z.att++;
        if (s.made) z.made++;
    }
    return out;
}

export interface XPPA {
    ppa: number;
    playerPct: number | null;
    leaguePct: number;
    playerAtt: number;
}

// Bayesian shrinkage with k=8 (verbatim math from the prototype HUD).
export function computeXPPA(
    zone: ShotZoneId,
    stats: Record<string, ZoneStat>,
): XPPA {
    const prior = ZONE_PRIOR[zone];
    const pts = zonePoints(zone);
    const z = stats[zone] || { made: 0, att: 0 };
    const k = 8;
    const blended = (z.made + k * prior) / (z.att + k);
    return {
        ppa: blended * pts,
        playerPct: z.att > 0 ? z.made / z.att : null,
        leaguePct: prior,
        playerAtt: z.att,
    };
}
