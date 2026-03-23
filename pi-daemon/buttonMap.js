// BCM Pin numbers for the Raspberry Pi 4
export const BUTTON_MAP = {
    // Team A
    17: { action: 'ADD_POINTS', team: 'A', amount: 1 },
    27: { action: 'ADD_POINTS', team: 'A', amount: 2 },
    22: { action: 'ADD_POINTS', team: 'A', amount: 3 },

    // Team B
    23: { action: 'ADD_POINTS', team: 'B', amount: 1 },
    24: { action: 'ADD_POINTS', team: 'B', amount: 2 },
    25: { action: 'ADD_POINTS', team: 'B', amount: 3 },

    // Controls
    5: { action: 'TOGGLE_CLOCK' },
    6: { action: 'UNDO' },
    13: { action: 'TOGGLE_SETTINGS' },

    // Shot Clock (Special handled for short/long press)
    19: { action: 'SHOT_CLOCK_RESET' }
};
