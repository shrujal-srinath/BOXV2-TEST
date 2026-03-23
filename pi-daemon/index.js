import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import readline from 'readline';
import { BUTTON_CONFIG } from './buttonMap.js';

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
            this.direction = direction;
            this.value = 0;
            this.watchCallbacks = [];
            global.mockPins[gpio] = this;
        }
        watch(callback) { this.watchCallbacks.push(callback); }
        readSync() { return this.value; }
        writeSync(value) { this.value = value; }
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
// 3. CLOCK TICKER
// ==========================================
let lastTick = Date.now();

setInterval(() => {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    if (state.clock.isRunning) {
        state.clock.gameMs = Math.max(0, state.clock.gameMs - delta);
        state.clock.shotMs = Math.max(0, state.clock.shotMs - delta);

        if (state.clock.gameMs === 0 || state.clock.shotMs === 0) {
            state.clock.isRunning = false;
            console.log('🚨 BUZZER! Clock stopped.');
            io.emit('state_update', state); // Emit full state to update isRunning flag visually
        } else {
            io.emit('clock_sync', state.clock); // Only emit clock data normally to save bandwidth
        }
    }
}, 100);

// ==========================================
// 4. BUTTON MAPPING & HARDWARE LOGIC
// ==========================================
const buttons = [];
let shotClockDownTime = 0;

function initializeHardware() {
    console.log('Wiring up physical interfaces...');

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
            state.clock.isRunning = !state.clock.isRunning;
            lastTick = Date.now();
            console.log(`> Hardware Action: CLOCK ${state.clock.isRunning ? 'STARTED' : 'STOPPED'}`);
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
}

// ==========================================
// 5. SERVER & WEBSOCKET SETUP
// ==========================================
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.get('/api/state', (req, res) => res.json(state));

io.on('connection', (socket) => {
    console.log(`📺 New display connected: ${socket.id}`);
    socket.emit('state_update', state);

    // --- LISTEN FOR MANUAL TOUCH SCREEN OVERRIDES ---
    socket.on('ui_action', (action) => {
        if (!state.ui.isTouchUnlocked) return; // Security check

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
    buttons.forEach(btn => btn.unexport());
    process.exit();
});

// ==========================================
// 6. KEYBOARD SIMULATION
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