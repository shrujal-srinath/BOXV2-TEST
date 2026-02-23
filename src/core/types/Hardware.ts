// src/core/types/Hardware.ts
export type HardwareActionType =
    | 'ADD_SCORE_A'
    | 'ADD_SCORE_B'
    | 'SUB_SCORE_A'
    | 'SUB_SCORE_B'
    | 'ADD_FOUL_A'        // NEW
    | 'ADD_FOUL_B'        // NEW
    | 'USE_TIMEOUT_A'     // NEW
    | 'USE_TIMEOUT_B'     // NEW
    | 'TOGGLE_CLOCK'
    | 'RESET_SHOT_CLOCK_24'  // renamed for clarity
    | 'RESET_SHOT_CLOCK_14'  // NEW
    | 'NEXT_PERIOD'
    | 'TOGGLE_POSSESSION' // NEW
    | 'UNDO';

export interface HardwareSignal {
    gameId: string;
    action: HardwareActionType;
    value?: number;       // NEW — for variable point values (future)
    timestamp: number;
    deviceId: string;
}