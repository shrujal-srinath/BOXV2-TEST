// Pico handles all button input via UART — see handlePicoMessage in index.js for the protocol.

// Define output pins (e.g., for relays, LEDs, Buzzers)
export const OUTPUT_CONFIG = {
    BUZZER_PIN: 21 // The GPIO pin that connects to your 12V Siren Relay
};