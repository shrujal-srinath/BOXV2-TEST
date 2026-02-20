export type HardwareActionType =
    | 'ADD_SCORE_A'
    | 'ADD_SCORE_B'
    | 'SUB_SCORE_A'
    | 'SUB_SCORE_B'
    | 'TOGGLE_CLOCK'
    | 'RESET_CLOCK'
    | 'NEXT_PERIOD'
    | 'UNDO';

export interface HardwareSignal {
    gameId: string;
    action: HardwareActionType;
    timestamp: number;
    deviceId: string;
}