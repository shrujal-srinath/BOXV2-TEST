// src/core/types/Hardware.ts
//
// v2.3 — expanded to cover all actions the ESP32 firmware broadcasts.
// If an action isn't listed here, TypeScript allows it through the
// 'action: string' fallback but the HostConsole switch won't handle it.
// KEEP THIS IN SYNC with onShortPress / onHoldPress in firmware v2.3.

export type HardwareActionType =
    // ── Scoring (short press) ──────────────────────────────────────────────
    | 'ADD_SCORE_A'           // +1
    | 'ADD_SCORE_B'           // +1
    | 'SUB_SCORE_A'           // -1
    | 'SUB_SCORE_B'           // -1

    // ── Scoring (hold press) ───────────────────────────────────────────────
    | 'ADD_SCORE_A_2'         // +2 (hold A+)
    | 'ADD_SCORE_B_2'         // +2 (hold B+)

    // ── Fouls (hold UP / DOWN) ─────────────────────────────────────────────
    | 'ADD_FOUL_A'
    | 'ADD_FOUL_B'

    // ── Clock ──────────────────────────────────────────────────────────────
    | 'TOGGLE_CLOCK'          // start or stop (payload has gameRunning bool)
    | 'RESET_SHOT_CLOCK_24'   // short press SHOT
    | 'RESET_SHOT_CLOCK_14'   // hold press SHOT
    // Legacy aliases kept for backwards compatibility
    | 'RESET_CLOCK'

    // ── Game flow ──────────────────────────────────────────────────────────
    | 'NEXT_PERIOD'
    | 'TOGGLE_POSSESSION'
    | 'UNDO'

    // ── Full state sync (sent after undo chain / web sync) ─────────────────
    | 'SCORE_STATE';

export interface HardwareSignal {
    gameId: string;
    action: HardwareActionType;
    timestamp: number;
    deviceId: string;
    // Optional: included for immediate UI update without waiting for DB
    scoreA?: number;
    scoreB?: number;
    foulsA?: number;
    foulsB?: number;
    timeoutsA?: number;
    timeoutsB?: number;
    possession?: 'A' | 'B';
    // Clock state (included in TOGGLE_CLOCK)
    gameRunning?: boolean;
    minutes?: number;
    seconds?: number;
    tenths?: number;
    shotClock?: number;
    period?: number;
}