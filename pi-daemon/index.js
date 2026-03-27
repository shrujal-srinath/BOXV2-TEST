// pi-daemon/index.js
// ═══════════════════════════════════════════════════════════════
// THE BOX — Hardware Daemon v2
// Now reads buttons via UART from Pico instead of direct GPIO
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { execSync } from 'child_process';
import { OUTPUT_CONFIG } from './buttonMap.js';
import {
    createGame,
    persistGameState,
    finishGame,
    broadcastToCloud,
    broadcastClockToCloud,
    teardownChannel,
} from './supabaseSync.js';

let currentGameCode = null;

// ==========================================
// 1. HARDWARE SETUP (Buzzer only — buttons via Pico UART)
// ==========================================
let Gpio;

if (process.platform === 'linux') {
    const pigpio = await import('pigpio');
    try { pigpio.configureClock(5, 0); } catch (e) { }
    Gpio = pigpio.Gpio;
} else {
    console.warn('\n⚠️  [DEV MODE] GPIO is mocked.\n');
    Gpio = class MockGpio {
        constructor(gpio, opts = {}) { this.gpio = gpio; this.value = 0; }
        digitalWrite(value) {
            this.value = value;
            if (value === 1) console.log(`\n🔊 [BUZZER ON]`);
            if (value === 0) console.log(`🔇 [BUZZER OFF]\n`);
        }
    };
}

// ==========================================
// 2. GAME STATE ENGINE
// ==========================================
const getInitialState = (config = null) => ({
    teamA: {
        name: config?.teamAName || 'Team A',
        score: 0, fouls: 0,
        timeouts: config?.timeoutsPerTeam ?? 2,
        color: config?.teamAColor || '#3B82F6',
    },
    teamB: {
        name: config?.teamBName || 'Team B',
        score: 0, fouls: 0,
        timeouts: config?.timeoutsPerTeam ?? 2,
        color: config?.teamBColor || '#EF4444',
    },
    clock: {
        gameMs: (config?.periodMinutes || 10) * 60 * 1000,
        shotMs: (config?.shotClockSeconds || 24) * 1000,
        isRunning: false, period: 1,
        totalPeriods: config?.periods || 4,
        periodMinutes: config?.periodMinutes || 10,
        shotClockSeconds: config?.shotClockSeconds || 24,
    },
    ui: { isTouchUnlocked: false },
    meta: { gameCode: null, gameActive: false, periodType: config?.periodType || 'quarter' },
});

let state = getInitialState();
let history = [];
const cloneState = (s) => JSON.parse(JSON.stringify(s));
const saveHistory = () => { history.push(cloneState(state)); if (history.length > 50) history.shift(); };

// ==========================================
// 3. BUZZER
// ==========================================
let buzzerPin = null;
let buzzerTimeout = null;

function initializeBuzzer() {
    try {
        buzzerPin = new Gpio(OUTPUT_CONFIG.BUZZER_PIN, { mode: Gpio.OUTPUT });
        buzzerPin.digitalWrite(0);
        console.log('✅ Buzzer pin initialized');
    } catch (e) {
        console.warn('⚠️  Buzzer GPIO not available:', e.message);
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
// 5. PICO UART HANDLER
// ==========================================
function initializePico() {
    console.log('🔌 Connecting to Pico via UART...');

    let port;
    try {
        port = new SerialPort({
            path: '/dev/serial0',
            baudRate: 115200,
        });
    } catch (e) {
        console.warn('⚠️  Could not open serial port:', e.message);
        return;
    }

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', () => console.log('✅ Pico UART connected on /dev/serial0'));
    port.on('error', (e) => console.error('❌ UART error:', e.message));

    parser.on('data', (line) => {
        const msg = line.trim();
        if (!msg) return;
        console.log(`📨 Pico: ${msg}`);
        handlePicoMessage(msg);
    });
}

function handlePicoMessage(msg) {
    if (msg === 'PICO_READY') {
        console.log('✅ Pico handshake received');
        return;
    }

    if (!state.meta.gameActive) {
        console.log('> Button pressed but no active game — ignoring');
        return;
    }

    switch (msg) {
        // ── Scoring ──
        case 'SCORE_A1': saveHistory(); state.teamA.score += 1; break;
        case 'SCORE_A2': saveHistory(); state.teamA.score += 2; break;
        case 'SCORE_A3': saveHistory(); state.teamA.score += 3; break;
        case 'SCORE_B1': saveHistory(); state.teamB.score += 1; break;
        case 'SCORE_B2': saveHistory(); state.teamB.score += 2; break;
        case 'SCORE_B3': saveHistory(); state.teamB.score += 3; break;

        // ── Clock ──
        case 'CLOCK_START':
            if (!state.clock.isRunning && state.clock.gameMs > 0) {
                state.clock.isRunning = true;
                lastTick = Date.now();
                console.log('> CLOCK STARTED');
            }
            break;
        case 'CLOCK_STOP':
            if (state.clock.isRunning) {
                state.clock.isRunning = false;
                console.log('> CLOCK STOPPED');
            }
            break;

        // ── Shot Clock ──
        case 'SHOT_CLOCK_24':
            saveHistory();
            state.clock.shotMs = state.clock.shotClockSeconds * 1000;
            console.log('> SHOT CLOCK RESET (24s)');
            break;
        case 'SHOT_CLOCK_14':
            saveHistory();
            state.clock.shotMs = 14000;
            console.log('> SHOT CLOCK RESET (14s)');
            break;

        // ── Undo ──
        case 'UNDO':
            if (history.length > 0) {
                state = history.pop();
                console.log('> UNDO');
            }
            break;

        // ── Settings ──
        case 'SETTINGS':
            state.ui.isTouchUnlocked = !state.ui.isTouchUnlocked;
            console.log(`> TOUCHSCREEN ${state.ui.isTouchUnlocked ? 'UNLOCKED 🔓' : 'LOCKED 🔒'}`);
            break;

        default:
            console.log(`> Unknown message: ${msg}`);
            return;
    }

    console.log(`> Score: ${state.teamA.score}-${state.teamB.score}`);
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
app.get('/api/health', (req, res) => res.json({ status: 'ok', gameActive: state.meta.gameActive, gameCode: currentGameCode }));
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
            let gameCode = config.existingGameCode || await createGame(config);
            console.log(`✅ Game code: ${gameCode}`);
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
        if (!state.ui.isTouchUnlocked) { console.log('> UI action rejected — screen is locked'); return; }
        if (!state.meta.gameActive) return;
        saveHistory();

        switch (action.type) {
            case 'EDIT_SCORE': state[action.payload.team].score = Math.max(0, state[action.payload.team].score + action.payload.amount); break;
            case 'EDIT_FOULS': state[action.payload.team].fouls = Math.max(0, state[action.payload.team].fouls + action.payload.amount); break;
            case 'EDIT_TIMEOUTS': state[action.payload.team].timeouts = Math.max(0, state[action.payload.team].timeouts + action.payload.amount); break;
            case 'EDIT_PERIOD': state.clock.period = Math.max(1, Math.min(state.clock.totalPeriods + 1, state.clock.period + action.payload.amount)); break;
            case 'EDIT_GAME_CLOCK': state.clock.gameMs = Math.max(0, state.clock.gameMs + (action.payload.amount * 1000)); break;
            case 'EDIT_SHOT_CLOCK': state.clock.shotMs = Math.max(0, state.clock.shotMs + (action.payload.amount * 1000)); break;
            case 'NEXT_PERIOD':
                state.clock.isRunning = false;
                state.clock.period += 1;
                state.clock.gameMs = state.clock.periodMinutes * 60 * 1000;
                state.clock.shotMs = state.clock.shotClockSeconds * 1000;
                state.teamA.fouls = 0; state.teamB.fouls = 0;
                break;
        }
        io.emit('state_update', state);
        broadcastToCloud(currentGameCode, state);
        persistGameState(currentGameCode, state);
    });

    socket.on('end_game', async () => {
        if (!currentGameCode) return;
        state.clock.isRunning = false;
        await finishGame(currentGameCode);
        teardownChannel();
        const endedCode = currentGameCode;
        currentGameCode = null; state = getInitialState(); history = [];
        socket.emit('game_ended', { finalCode: endedCode });
        io.emit('state_update', state);
    });

    socket.on('disconnect', () => console.log(`🔌 UI disconnected: ${socket.id}`));
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
    initializeBuzzer();
    initializePico();
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    if (buzzerPin) buzzerPin.digitalWrite(0);
    teardownChannel();
    process.exit(0);
});