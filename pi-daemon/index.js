import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import readline from 'readline';
import { BUTTON_CONFIG, OUTPUT_CONFIG } from './buttonMap.js';
import { broadcastToCloud, broadcastClockToCloud } from './supabaseSync.js';

// The ID that remote spectators will use to join the stream
let currentGameCode = 'BMSCE-LIVE';

// ==========================================
// 1. HARDWARE MOCKING SETUP
// ==========================================
let Gpio;

if (process.platform === 'linux') {
    const onoff = await import('onoff');
    Gpio = onoff.Gpio;
} else {
    console.warn('\n⚠️  [DEV MODE] Non-Linux OS detected. Hardware GPIO pins are being mocked.\n');
    global.mockPins = {};

    Gpio = class MockGpio {
        constructor(gpio, direction, edge, options) {
            this.gpio = gpio;
            this.direction = direction; // 'in' or 'out'
            this.value = 0;
            this.watchCallbacks = [];
            global.mockPins[gpio] = this;
        }
        watch(callback) { this.watchCallbacks.push(callback); }
        readSync() { return this.value; }
        writeSync(value) {
            this.value = value;
            // If this is an output pin (like our buzzer), log it to the terminal!
            if (this.direction === 'out') {
                if (value === 1) console.log(`\n🔊 [HARDWARE OUTPUT] BUZZER ON (Pin ${this.gpio})`);
                if (value === 0) console.log(`🔇 [HARDWARE OUTPUT] BUZZER OFF (Pin ${this.gpio})\n`);
            }
        }
        unexport() { delete global.mockPins[this.gpio]; }
        simulateChange(newValue) {
            this.value = newValue;
            this.watchCallbacks.forEach(cb => cb(null, this.value));
        }
    };
}

// ==========================================
// 2. THE LOCAL GAME ENGINE
// ==========================================
const getInitialState = () => ({
    teamA: { name: 'BMSCE', score: 0, fouls: 0, timeouts: 3 },
    teamB: { name: 'Opponent', score: 0, fouls: 0, timeouts: 3 },
    clock: { gameMs: 10 * 60 * 1000, shotMs: 24 * 1000, isRunning: false, period: 1 },
    ui: { isTouchUnlocked: false }
});

let state = getInitialState();
let history = [];

const cloneState = (s) => JSON.parse(JSON.stringify(s));

const saveHistory = () => {
    history.push(cloneState(state));
    if (history.length > 50) history.shift();
};

// ==========================================
// 3. HARDWARE OUTPUT LOGIC (BUZZER)
// ==========================================
let buzzerPin;
let buzzerTimeout = null;

function initializeOutputs() {
    buzzerPin = new Gpio(OUTPUT_CONFIG.BUZZER_PIN, 'out');
    // Ensure buzzer is off on startup
    buzzerPin.writeSync(0);
}

// Triggers the physical relay for the siren
function triggerBuzzer(type = 'SHORT') {
    if (!buzzerPin) return;

    const duration = type === 'LONG' ? 2000 : 800; // 2s for period end, 0.8s for shot clock

    // Turn buzzer ON
    buzzerPin.writeSync(1);

    // Clear any existing timers so we don't overlap
    if (buzzerTimeout) clearTimeout(buzzerTimeout);

    // Turn buzzer OFF after duration
    buzzerTimeout = setTimeout(() => {
        buzzerPin.writeSync(0);
    }, duration);
}

// ==========================================
// 4. CLOCK TICKER
// ==========================================
let lastTick = Date.now();
let lastCloudTick = 0;

setInterval(() => {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    if (state.clock.isRunning) {
        // Keep track of previous times so we know EXACTLY when we hit zero
        const prevGameMs = state.clock.gameMs;
        const prevShotMs = state.clock.shotMs;

        state.clock.gameMs = Math.max(0, state.clock.gameMs - delta);
        state.clock.shotMs = Math.max(0, state.clock.shotMs - delta);

        let needsFullSync = false;

        // Detect Game Clock hitting 0
        if (state.clock.gameMs === 0 && prevGameMs > 0) {
            console.log('🚨 BUZZER! End of Period.');
            state.clock.isRunning = false;
            triggerBuzzer('LONG');
            needsFullSync = true;
        }
        // Detect Shot Clock hitting 0 (Only if Game clock isn't also 0)
        else if (state.clock.shotMs === 0 && prevShotMs > 0 && state.clock.gameMs > 0) {
            console.log('🚨 BUZZER! Shot Clock Violation.');
            state.clock.isRunning = false;
            triggerBuzzer('SHORT');
            needsFullSync = true;
        }

        if (needsFullSync) {
            io.emit('state_update', state); // Update UI to show paused state
            broadcastToCloud(currentGameCode, state); // Sync to Supabase
        } else {
            io.emit('clock_sync', state.clock); // Normal high-speed local clock tick

            // Cloud 1-second sync to avoid rate limits
            if (now - lastCloudTick >= 1000) {
                broadcastClockToCloud(currentGameCode, state.clock);
                lastCloudTick = now;
            }
        }
    }
}, 100);

// ==========================================
// 5. BUTTON MAPPING & HARDWARE LOGIC
// ==========================================
const buttons = [];
let shotClockDownTime = 0;

function initializeHardware() {
    console.log('Wiring up physical interfaces...');
    initializeOutputs(); // Setup the buzzer!

    BUTTON_CONFIG.forEach(config => {
        const button = new Gpio(config.pin, 'in', 'both', { debounceTimeout: 20 });

        button.watch((err, value) => {
            if (err) return console.error(`Error on pin ${config.pin}:`, err);

            if (config.type === 'SHOT_CLOCK') {
                if (value === 1) {
                    shotClockDownTime = Date.now();
                } else if (value === 0 && shotClockDownTime > 0) {
                    const duration = Date.now() - shotClockDownTime;
                    saveHistory();
                    if (duration >= 500) {
                        console.log('> Hardware Action: SHOT CLOCK RESET (14s)');
                        state.clock.shotMs = 14 * 1000;
                    } else {
                        console.log('> Hardware Action: SHOT CLOCK RESET (24s)');
                        state.clock.shotMs = 24 * 1000;
                    }
                    shotClockDownTime = 0;
                    io.emit('state_update', state);
                    broadcastToCloud(currentGameCode, state);
                }
                return;
            }

            if (value === 1) {
                handleGameAction(config);
            }
        });
        buttons.push(button);
    });
}

function handleGameAction(config) {
    switch (config.type) {
        case 'SCORE':
            saveHistory();
            state[config.team].score += config.value;
            console.log(`> Hardware Action: ${config.team.toUpperCase()} +${config.value}`);
            break;
        case 'TOGGLE_CLOCK':
            // Don't allow starting the clock if time is 0
            if (!state.clock.isRunning && state.clock.gameMs > 0 && state.clock.shotMs > 0) {
                state.clock.isRunning = true;
                lastTick = Date.now();
                console.log(`> Hardware Action: CLOCK STARTED`);
            } else {
                state.clock.isRunning = false;
                console.log(`> Hardware Action: CLOCK STOPPED`);
            }
            break;
        case 'UNDO':
            if (history.length > 0) {
                state = history.pop();
                console.log('> Hardware Action: UNDO REVERT');
            } else {
                console.log('> Hardware Action: UNDO (No history)');
            }
            break;
        case 'SETTINGS':
            state.ui.isTouchUnlocked = !state.ui.isTouchUnlocked;
            console.log(`> Hardware Action: UI TOUCH ${state.ui.isTouchUnlocked ? 'UNLOCKED 🔓' : 'LOCKED 🔒'}`);
            break;
    }

    io.emit('state_update', state);
    broadcastToCloud(currentGameCode, state);
}

// ==========================================
// 6. SERVER & WEBSOCKET SETUP
// ==========================================
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.get('/api/state', (req, res) => res.json(state));

io.on('connection', (socket) => {
    socket.emit('state_update', state);

    socket.on('ui_action', (action) => {
        if (!state.ui.isTouchUnlocked) return;

        saveHistory();
        console.log(`> UI Action Received: ${action.type}`, action.payload);

        switch (action.type) {
            case 'EDIT_SCORE':
                state[action.payload.team].score = Math.max(0, state[action.payload.team].score + action.payload.amount);
                break;
            case 'EDIT_FOULS':
                state[action.payload.team].fouls = Math.max(0, state[action.payload.team].fouls + action.payload.amount);
                break;
            case 'EDIT_TIMEOUTS':
                state[action.payload.team].timeouts = Math.max(0, state[action.payload.team].timeouts + action.payload.amount);
                break;
            case 'EDIT_PERIOD':
                state.clock.period = Math.max(1, state.clock.period + action.payload.amount);
                break;
            case 'EDIT_GAME_CLOCK':
                state.clock.gameMs = Math.max(0, state.clock.gameMs + (action.payload.amount * 1000));
                break;
            case 'EDIT_SHOT_CLOCK':
                state.clock.shotMs = Math.max(0, state.clock.shotMs + (action.payload.amount * 1000));
                break;
        }
        io.emit('state_update', state);
        broadcastToCloud(currentGameCode, state);
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\n📦 THE BOX: Local Brain active on http://localhost:${PORT}`);
    initializeHardware();
    setupKeyboardSimulation();
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    if (buzzerPin) buzzerPin.writeSync(0); // Ensure buzzer is off before exiting!
    if (buzzerPin) buzzerPin.unexport();
    buttons.forEach(btn => btn.unexport());
    process.exit();
});

// ==========================================
// 7. KEYBOARD SIMULATION
// ==========================================
function setupKeyboardSimulation() {
    if (process.platform === 'linux') return;

    console.log('\n--- TERMINAL DEV CONTROLS ---');
    console.log('1,2,3 : Team A Scoring | 4,5,6 : Team B Scoring');
    console.log('p: Play/Pause | r: Reset 24s | R: Reset 14s (Shift+r)');
    console.log('u: Undo | s: Settings Lock/Unlock | Ctrl+C: Exit\n');

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    process.stdin.on('keypress', (str, key) => {
        if (key.ctrl && key.name === 'c') process.emit('SIGINT');

        if (key.name === 'r' && key.shift) {
            const pin = BUTTON_CONFIG.find(c => c.type === 'SHOT_CLOCK').pin;
            const mockPin = global.mockPins[pin];
            if (mockPin) {
                mockPin.simulateChange(1);
                setTimeout(() => mockPin.simulateChange(0), 600);
            }
            return;
        }

        const config = BUTTON_CONFIG.find(c => c.key === key.name);
        if (config && global.mockPins[config.pin]) {
            global.mockPins[config.pin].simulateChange(1);
            setTimeout(() => global.mockPins[config.pin].simulateChange(0), 50);
        }
    });
}