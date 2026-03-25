// pi-daemon/index.js
// ═══════════════════════════════════════════════════════════════
// THE BOX — Hardware Daemon v2
//
// Architecture:
//   - Socket.io server on :3001 (React app connects here)
//   - GPIO buttons → handleGameAction() → broadcast to React + Supabase
//   - Game lifecycle: setup_game → game_ready → [live] → end_game
//   - No hardcoded game codes — game is created dynamically on setup
//
// Socket Events (inbound from React):
//   setup_game  { teamAName, teamBName, teamAColor, teamBColor,
//                 periodMinutes, shotClockSeconds, periods, periodType }
//               → Creates Supabase game row, returns game_ready
//   ui_action   { type, payload }
//               → Only processed when isTouchUnlocked = true
//   end_game    {}
//               → Marks game completed, resets state
//
// Socket Events (outbound to React):
//   game_ready  { gameCode }
//   state_update { ...fullState }
//   clock_sync  { ...clockState }
//   game_ended  {}
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import readline from 'readline';
import { execSync } from 'child_process';
import { BUTTON_CONFIG, OUTPUT_CONFIG } from './buttonMap.js';
import {
    createGame,
    persistGameState,
    finishGame,
    broadcastToCloud,
    broadcastClockToCloud,
    teardownChannel,
} from './supabaseSync.js';

// ─── Game Code ────────────────────────────────────────────────
let currentGameCode = null;

// ==========================================
// 1. HARDWARE SETUP
// ==========================================
let Gpio;

if (process.platform === 'linux') {
    // Use pigpio on the Pi
    const pigpio = await import('pigpio');
    Gpio = pigpio.Gpio;
} else {
    // Mock GPIO for dev on Mac/Windows
    console.warn('\n⚠️  [DEV MODE] Non-Linux OS detected. GPIO is mocked.\n');
    global.mockPins = {};

    Gpio = class MockGpio {
        constructor(gpio, opts = {}) {
            this.gpio = gpio;
            this.opts = opts;
            this.value = 0;
            this.alertCallbacks = [];
            global.mockPins[gpio] = this;
        }
        on(event, callback) {
            if (event === 'alert') this.alertCallbacks.push(callback);
        }
        digitalWrite(value) {
            this.value = value;
            if (value === 1) console.log(`\n🔊 [BUZZER ON]  (Pin ${this.gpio})`);
            if (value === 0) console.log(`🔇 [BUZZER OFF] (Pin ${this.gpio})\n`);
        }
        glitchFilter() { }
        simulatePress() {
            this.alertCallbacks.forEach(cb => cb(0, Date.now())); // active low: 0 = pressed
            setTimeout(() => {
                this.alertCallbacks.forEach(cb => cb(1, Date.now()));
            }, 80);
        }
    };
}

// ==========================================
// 2. GAME STATE ENGINE
// ==========================================

const getInitialState = (config = null) => ({
    teamA: {
        name: config?.teamAName || 'Team A',
        score: 0,
        fouls: 0,
        timeouts: config?.timeoutsPerTeam ?? 2,
        color: config?.teamAColor || '#3B82F6',
    },
    teamB: {
        name: config?.teamBName || 'Team B',
        score: 0,
        fouls: 0,
        timeouts: config?.timeoutsPerTeam ?? 2,
        color: config?.teamBColor || '#EF4444',
    },
    clock: {
        gameMs: (config?.periodMinutes || 10) * 60 * 1000,
        shotMs: (config?.shotClockSeconds || 24) * 1000,
        isRunning: false,
        period: 1,
        totalPeriods: config?.periods || 4,
        periodMinutes: config?.periodMinutes || 10,
        shotClockSeconds: config?.shotClockSeconds || 24,
    },
    ui: { isTouchUnlocked: false },
    meta: {
        gameCode: null,
        gameActive: false,
        periodType: config?.periodType || 'quarter',
    },
});

let state = getInitialState();
let history = [];

const cloneState = (s) => JSON.parse(JSON.stringify(s));
const saveHistory = () => {
    history.push(cloneState(state));
    if (history.length > 50) history.shift();
};

// ==========================================
// 3. HARDWARE OUTPUT (BUZZER)
// ==========================================
let buzzerPin = null;
let buzzerTimeout = null;

function initializeOutputs() {
    try {
        buzzerPin = new Gpio(OUTPUT_CONFIG.BUZZER_PIN, { mode: Gpio.OUTPUT });
        buzzerPin.digitalWrite(0);
        console.log('✅ Buzzer pin initialized');
    } catch (e) {
        console.warn('⚠️  Buzzer GPIO not available — skipping:', e.message);
        buzzerPin = null;
    }
}

function triggerBuzzer(type = 'SHORT') {
    if (!buzzerPin) return;
    const duration = type === 'LONG' ? 2000 : 800;
    buzzerPin.digitalWrite(1);
    if (buzzerTimeout) clearTimeout(buzzerTimeout);
    buzzerTimeout = setTimeout(() => buzzerPin.digitalWrite(0), duration);
}

// ==========================================
// 4. CLOCK TICKER
// ==========================================
let lastTick = Date.now();
let lastCloudTick = 0;

setInterval(() => {
    if (!state.meta.gameActive) return;

    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    if (state.clock.isRunning) {
        const prevGameMs = state.clock.gameMs;
        const prevShotMs = state.clock.shotMs;

        state.clock.gameMs = Math.max(0, state.clock.gameMs - delta);
        state.clock.shotMs = Math.max(0, state.clock.shotMs - delta);

        let needsFullSync = false;

        if (state.clock.gameMs === 0 && prevGameMs > 0) {
            console.log('🚨 BUZZER! End of Period.');
            state.clock.isRunning = false;
            triggerBuzzer('LONG');
            needsFullSync = true;
        } else if (state.clock.shotMs === 0 && prevShotMs > 0 && state.clock.gameMs > 0) {
            console.log('🚨 BUZZER! Shot Clock Violation.');
            state.clock.isRunning = false;
            triggerBuzzer('SHORT');
            needsFullSync = true;
        }

        if (needsFullSync) {
            io.emit('state_update', state);
            broadcastToCloud(currentGameCode, state);
            persistGameState(currentGameCode, state);
        } else {
            io.emit('clock_sync', state.clock);
            if (now - lastCloudTick >= 1000) {
                broadcastClockToCloud(currentGameCode, state.clock);
                lastCloudTick = now;
            }
        }
    }
}, 100);

// ==========================================
// 5. BUTTON LOGIC
// ==========================================
const buttons = [];
let shotClockDownTime = 0;

function initializeHardware() {
    console.log('⚡ Wiring up GPIO buttons...');
    initializeOutputs();

    BUTTON_CONFIG.forEach(config => {
        try {
            const button = new Gpio(config.pin, {
                mode: Gpio.INPUT,
                pullUpDown: Gpio.PUD_UP,
                alert: true,
            });
            button.glitchFilter(10000); // 10ms debounce

            button.on('alert', (level, tick) => {
                // Active low: level 0 = pressed, level 1 = released
                const value = level === 0 ? 1 : 0;

                if (!state.meta.gameActive) {
                    if (value === 1) console.log('> Button pressed but no active game — ignoring');
                    return;
                }

                if (config.type === 'SHOT_CLOCK') {
                    if (value === 1) {
                        shotClockDownTime = Date.now();
                    } else if (value === 0 && shotClockDownTime > 0) {
                        const duration = Date.now() - shotClockDownTime;
                        saveHistory();
                        if (duration >= 500) {
                            console.log('> SHOT CLOCK RESET (14s)');
                            state.clock.shotMs = 14 * 1000;
                        } else {
                            console.log('> SHOT CLOCK RESET (24s)');
                            state.clock.shotMs = state.clock.shotClockSeconds * 1000;
                        }
                        shotClockDownTime = 0;
                        io.emit('state_update', state);
                        broadcastToCloud(currentGameCode, state);
                    }
                    return;
                }

                if (value === 1) handleGameAction(config);
            });

            buttons.push(button);
            console.log(`✅ Button pin ${config.pin} (${config.type}) ready`);
        } catch (e) {
            console.warn(`⚠️  Button pin ${config.pin} not available — skipping:`, e.message);
        }
    });

    console.log(`✅ Hardware init complete`);
}

function handleGameAction(config) {
    switch (config.type) {
        case 'SCORE':
            saveHistory();
            state[config.team].score += config.value;
            console.log(`> ${config.team.toUpperCase()} +${config.value} | Score: ${state.teamA.score}-${state.teamB.score}`);
            break;

        case 'FOUL':
            saveHistory();
            state[config.team].fouls = Math.min(99, state[config.team].fouls + 1);
            console.log(`> ${config.team.toUpperCase()} FOUL | Total: ${state[config.team].fouls}`);
            break;

        case 'TIMEOUT':
            saveHistory();
            if (state[config.team].timeouts > 0) {
                state[config.team].timeouts -= 1;
                state.clock.isRunning = false;
                console.log(`> ${config.team.toUpperCase()} TIMEOUT | Remaining: ${state[config.team].timeouts}`);
            }
            break;

        case 'TOGGLE_CLOCK':
            if (!state.clock.isRunning && state.clock.gameMs > 0 && state.clock.shotMs > 0) {
                state.clock.isRunning = true;
                lastTick = Date.now();
                console.log('> CLOCK STARTED');
            } else {
                state.clock.isRunning = false;
                console.log('> CLOCK STOPPED');
            }
            break;

        case 'UNDO':
            if (history.length > 0) {
                state = history.pop();
                console.log('> UNDO');
            }
            break;

        case 'SETTINGS':
            state.ui.isTouchUnlocked = !state.ui.isTouchUnlocked;
            console.log(`> TOUCHSCREEN ${state.ui.isTouchUnlocked ? 'UNLOCKED 🔓' : 'LOCKED 🔒'}`);
            break;
    }

    io.emit('state_update', state);
    broadcastToCloud(currentGameCode, state);
    persistGameState(currentGameCode, state);
}

// ==========================================
// 6. SERVER & SOCKET.IO
// ==========================================
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.get('/api/state', (req, res) => res.json(state));
app.get('/api/health', (req, res) => res.json({
    status: 'ok',
    gameActive: state.meta.gameActive,
    gameCode: currentGameCode,
}));

app.get('/api/network-ip', (req, res) => {
    try {
        const ip = execSync("hostname -I | awk '{print $1}'").toString().trim();
        res.json({ ip });
    } catch (e) {
        res.json({ ip: 'localhost' });
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 UI connected: ${socket.id}`);
    socket.emit('state_update', state);

    socket.on('setup_game', async (config) => {
        console.log('\n📋 Setting up game:', config.existingGameCode ? `ONLINE [${config.existingGameCode}]` : 'OFFLINE (new)');

        try {
            let gameCode;
            if (config.existingGameCode) {
                gameCode = config.existingGameCode;
                console.log(`✅ Adopting existing game ${gameCode}`);
            } else {
                gameCode = await createGame(config);
                console.log(`✅ Created new game ${gameCode}`);
            }

            currentGameCode = gameCode;
            state = getInitialState(config);
            state.meta.gameCode = gameCode;
            state.meta.gameActive = true;
            history = [];

            socket.emit('game_ready', { gameCode });
            io.emit('state_update', state);

        } catch (err) {
            console.error('❌ setup_game failed:', err.message);
            socket.emit('setup_error', { message: err.message });
        }
    });

    socket.on('ui_action', (action) => {
        if (!state.ui.isTouchUnlocked) {
            console.log('> UI action rejected — screen is locked');
            return;
        }
        if (!state.meta.gameActive) return;

        saveHistory();
        console.log(`> UI Action: ${action.type}`, action.payload);

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
                state.clock.period = Math.max(1, Math.min(state.clock.totalPeriods + 1, state.clock.period + action.payload.amount));
                break;
            case 'EDIT_GAME_CLOCK':
                state.clock.gameMs = Math.max(0, state.clock.gameMs + (action.payload.amount * 1000));
                break;
            case 'EDIT_SHOT_CLOCK':
                state.clock.shotMs = Math.max(0, state.clock.shotMs + (action.payload.amount * 1000));
                break;
            case 'NEXT_PERIOD': {
                state.clock.isRunning = false;
                state.clock.period += 1;
                state.clock.gameMs = state.clock.periodMinutes * 60 * 1000;
                state.clock.shotMs = state.clock.shotClockSeconds * 1000;
                state.teamA.fouls = 0;
                state.teamB.fouls = 0;
                console.log(`> NEXT PERIOD: ${state.clock.period}`);
                break;
            }
        }

        io.emit('state_update', state);
        broadcastToCloud(currentGameCode, state);
        persistGameState(currentGameCode, state);
    });

    socket.on('end_game', async () => {
        if (!currentGameCode) return;

        console.log(`\n🏁 Ending game ${currentGameCode}`);
        state.clock.isRunning = false;

        await finishGame(currentGameCode);
        teardownChannel();

        const endedCode = currentGameCode;
        currentGameCode = null;
        state = getInitialState();
        history = [];

        socket.emit('game_ended', { finalCode: endedCode });
        io.emit('state_update', state);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 UI disconnected: ${socket.id}`);
    });
});

// ==========================================
// 7. BOOT
// ==========================================
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════╗`);
    console.log(`║   THE BOX — Hardware Daemon v2    ║`);
    console.log(`║   Listening on :${PORT}              ║`);
    console.log(`╚═══════════════════════════════════╝\n`);
    initializeHardware();
    setupKeyboardSimulation();
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    if (buzzerPin) buzzerPin.digitalWrite(0);
    teardownChannel();
    process.exit(0);
});

// ==========================================
// 8. DEV KEYBOARD SIMULATION (non-Linux only)
// ==========================================
function setupKeyboardSimulation() {
    if (process.platform === 'linux') return;

    console.log('--- DEV TERMINAL CONTROLS ---');
    console.log('g: Simulate setup_game | 1,2,3: Team A | 4,5,6: Team B');
    console.log('p: Play/Pause | r: Shot 24s | R: Shot 14s');
    console.log('u: Undo | s: Settings unlock | e: End game | Ctrl+C: Exit\n');

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    process.stdin.on('keypress', async (str, key) => {
        if (key.ctrl && key.name === 'c') process.emit('SIGINT');

        if (key.name === 'g') {
            const fakeConfig = {
                teamAName: 'BMSCE', teamBName: 'RNSIT',
                teamAColor: '#3B82F6', teamBColor: '#EF4444',
                periodMinutes: 10, shotClockSeconds: 24,
                periods: 4, periodType: 'quarter',
            };
            const gameCode = await createGame(fakeConfig);
            currentGameCode = gameCode;
            state = getInitialState(fakeConfig);
            state.meta.gameCode = gameCode;
            state.meta.gameActive = true;
            history = [];
            console.log(`[DEV] Game ${gameCode} started`);
            io.emit('state_update', state);
            return;
        }

        if (key.name === 'e') {
            if (currentGameCode) {
                await finishGame(currentGameCode);
                teardownChannel();
                currentGameCode = null;
                state = getInitialState();
                history = [];
                io.emit('state_update', state);
                console.log('[DEV] Game ended');
            }
            return;
        }

        const config = BUTTON_CONFIG.find(c => c.key === key.name);
        if (config && global.mockPins?.[config.pin]) {
            global.mockPins[config.pin].simulatePress();
        }
    });
}