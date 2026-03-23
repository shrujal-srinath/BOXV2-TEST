import { Server } from 'socket.io';
import { BUTTON_MAP } from './buttonMap.js';

// Setup WebSocket Server on port 3001
const io = new Server(3001, {
    cors: { origin: '*' } // Allow local React app to connect
});

console.log('📦 THE BOX: Hardware Daemon starting on port 3001...');

let Gpio;
try {
    // Attempt to load the real hardware library
    import('onoff').then(module => {
        Gpio = module.Gpio;
        initializeButtons();
    });
} catch (err) {
    console.warn('⚠️ GPIO not available (likely running on Mac/Windows). Mocking hardware...');
    // We'll simulate button presses from the terminal later if needed
}

// Variables to track the shot clock long-press logic
let shotClockPressTime = 0;
const LONG_PRESS_MS = 500; // Half a second for 14s reset

function initializeButtons() {
    const buttons = {};

    Object.entries(BUTTON_MAP).forEach(([pinStr, config]) => {
        const pin = parseInt(pinStr, 10);

        // Initialize pin as input, listen for both press (falling) and release (rising)
        buttons[pin] = new Gpio(pin, 'in', 'both', { debounceTimeout: 50 });

        buttons[pin].watch((err, value) => {
            if (err) {
                console.error(`Error reading pin ${pin}:`, err);
                return;
            }

            // value === 0 means button is pressed (assuming pull-up to ground)
            // value === 1 means button is released
            const isPressed = value === 0;

            if (config.action === 'SHOT_CLOCK_RESET') {
                handleShotClockLogic(isPressed);
            } else if (isPressed) {
                // Standard button press, broadcast immediately
                console.log(`[HARDWARE] Button pressed: ${config.action}`);
                io.emit('hardware-action', config);
            }
        });
    });

    console.log('✅ GPIO Pins configured and listening.');
}

function handleShotClockLogic(isPressed) {
    if (isPressed) {
        // Record exactly when they pressed it down
        shotClockPressTime = Date.now();
    } else {
        // Button released, calculate how long it was held
        const heldTime = Date.now() - shotClockPressTime;

        if (heldTime >= LONG_PRESS_MS) {
            console.log('[HARDWARE] Long press detected: 14s Reset');
            io.emit('hardware-action', { action: 'RESET_SHOT_CLOCK', value: 14 });
        } else {
            console.log('[HARDWARE] Short press detected: 24s Reset');
            io.emit('hardware-action', { action: 'RESET_SHOT_CLOCK', value: 24 });
        }
    }
}

io.on('connection', (socket) => {
    console.log('💻 Controller UI Connected!');
});
