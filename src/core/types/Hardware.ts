export type HardwareActionType = 'ADD_SCORE_A' | 'ADD_SCORE_B' | 'UNDO' | 'TOGGLE_CLOCK';

export interface HardwareSignal {
    gameId: string;
    action: HardwareActionType;
    timestamp: number;
    deviceId: string;
}