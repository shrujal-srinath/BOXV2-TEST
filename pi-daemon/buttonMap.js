// Map your physical GPIO pins to the game actions here.
// Change the 'pin' values to match your actual Pi wiring once the hardware is ready.

export const BUTTON_CONFIG = [
    { pin: 17, type: 'SCORE', team: 'teamA', value: 1, key: '1' },
    { pin: 27, type: 'SCORE', team: 'teamA', value: 2, key: '2' },
    { pin: 22, type: 'SCORE', team: 'teamA', value: 3, key: '3' },
    { pin: 5, type: 'SCORE', team: 'teamB', value: 1, key: '4' },
    { pin: 6, type: 'SCORE', team: 'teamB', value: 2, key: '5' },
    { pin: 13, type: 'SCORE', team: 'teamB', value: 3, key: '6' },
    { pin: 19, type: 'TOGGLE_CLOCK', key: 'p' },
    { pin: 26, type: 'SHOT_CLOCK', key: 'r' }, // Handles both 24s (short) and 14s (long)
    { pin: 23, type: 'UNDO', key: 'u' },
    { pin: 24, type: 'SETTINGS', key: 's' } // Locks/Unlocks the touchscreen UI
];

// Define output pins (e.g., for relays, LEDs, Buzzers)
export const OUTPUT_CONFIG = {
    BUZZER_PIN: 21 // The GPIO pin that connects to your 12V Siren Relay
};