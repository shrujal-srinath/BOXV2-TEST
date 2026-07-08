// src/components/shotchart/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Shot Chart Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

// ── Zone definitions ─────────────────────────────────────────────────────────

export type ShotZoneId =
    | 'at_rim'
    | 'restricted'
    | 'paint_left'
    | 'paint_right'
    | 'mid_baseline_left'
    | 'mid_baseline_right'
    | 'mid_elbow_left'
    | 'mid_elbow_right'
    | 'mid_top'
    | 'three_corner_left'
    | 'three_corner_right'
    | 'three_wing_left'
    | 'three_wing_right'
    | 'three_top_left'
    | 'three_top_right'
    | 'three_top_center'
    | 'unlocated';

/**
 * What the `shot_events.zone` column actually holds: a court zone, OR
 * 'free_throw' for FT rows (no court location — the Pi path has always
 * persisted this; the web path joined it on 2026-07-08, migration 013).
 * Spatial consumers must filter by shotType/zone before indexing ZONES.
 */
export type PersistedZone = ShotZoneId | 'free_throw';

export interface ZoneDefinition {
    id: ShotZoneId;
    label: string;
    shortLabel: string;
    pointValue: 2 | 3;
    /** Centroid coordinates for zone-mode snap (0-100 x 0-94) */
    cx: number;
    cy: number;
}

// ── Shot event (matches DB schema) ───────────────────────────────────────────

export type ShotAttribute =
    | 'fastbreak'
    | 'second_chance'
    | 'off_turnover'
    | 'uncontested'
    | 'contested'
    | 'off_screen'
    | 'pull_up'
    | 'catch_and_shoot'
    | 'post_up';

export type ShotType = 'field_goal' | 'free_throw';

export interface ShotEvent {
    id: string;
    gameCode: string;
    playerId: string | null;
    teamSide: 'A' | 'B';
    /** Nullable in reality (FT rows, quick-mode daemon rows write NULL). The
     *  declaration stays `number` to avoid a repo-wide ripple tonight — every
     *  spatial consumer already null-checks (`s.x != null`). Honest widening
     *  is queued for the S1 wiring session. */
    x: number;
    y: number;
    zone: PersistedZone;
    made: boolean;
    points: 1 | 2 | 3;
    shotType: ShotType;
    period: number;
    gameClockSec: number | null;
    /** Shot-clock seconds remaining at the shot (migration 012). Null/undefined if untracked. */
    shotClockSec?: number | null;
    attributes: ShotAttribute[];
    assistedBy: string | null;
    reboundedBy: string | null;
    reboundType: 'offensive' | 'defensive' | null;
    blockedBy: string | null;
    inputMethod: 'live' | 'post_game_edit';
    editedAt: string | null;
    createdAt: string;
}

// ── Game action (non-shot events) ────────────────────────────────────────────

export type GameActionType =
    | 'rebound'
    | 'steal'
    | 'turnover'
    | 'block'
    | 'assist'
    | 'foul'
    | 'timeout'
    | 'substitution';

export interface GameAction {
    id: string;
    gameCode: string;
    playerId: string | null;
    teamSide: 'A' | 'B';
    actionType: GameActionType;
    subtype: string | null;
    period: number;
    gameClockSec: number | null;
    relatedShotId: string | null;
    createdAt: string;
}

// ── Action chain state (live scoring UI) ─────────────────────────────────────

export type ChainStep = 'player' | 'court' | 'attributes' | 'rebound' | 'done';

export interface ChainState {
    isOpen: boolean;
    /** What triggered this chain */
    trigger: {
        teamSide: 'A' | 'B';
        points: 1 | 2 | 3;
        made: boolean;
        shotType: ShotType;
    } | null;
    currentStep: ChainStep;
    /** Collected data as chain progresses */
    playerId: string | null;
    playerName: string | null;
    x: number | null;
    y: number | null;
    zone: ShotZoneId | null;
    attributes: ShotAttribute[];
    /** Timeout ref for auto-advance */
    timeoutMs: number;
    startedAt: number;
}

// ── Visualization data ───────────────────────────────────────────────────────

export interface ZoneStat {
    zone: ShotZoneId;
    label: string;
    fga: number;
    fgm: number;
    fgPct: number;
    points: number;
    ptsPerShot: number;
}

export interface PlayerShotSummary {
    playerId: string;
    playerName: string;
    fga: number;
    fgm: number;
    fgPct: number;
    threePa: number;
    threePm: number;
    threePct: number;
    ftA: number;
    ftM: number;
    ftPct: number;
    efgPct: number;
    tsPct: number;
    ptsPerShot: number;
}

// ── Court interaction mode ───────────────────────────────────────────────────

export type CourtMode = 'zone' | 'precise';