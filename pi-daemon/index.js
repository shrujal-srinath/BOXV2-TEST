// pi-daemon/index.js — THE BOX Hardware Daemon v3
// Pico UART for buttons, pigpio for buzzer, score_pending for UI popups

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { OUTPUT_CONFIG } from './buttonMap.js';
import {
    createGame, persistGameState, finishGame,
    broadcastToCloud, broadcastClockToCloud, teardownChannel,
} from './supabaseSync.js';

let currentGameCode = null;

// ── 1. BUZZER GPIO ────────────────────────────────────────────
let Gpio;
if (process.platform === 'linux') {
    const pigpio = await import('pigpio');
    try { pigpio.configureClock(5, 0); } catch (e) { }
    Gpio = pigpio.Gpio;
} else {
    Gpio = class MockGpio {
        constructor(gpio) { this.gpio = gpio; this.value = 0; }
        digitalWrite(v) { console.log(v ? '\n🔊 BUZZER ON' : '🔇 BUZZER OFF\n'); }
    };
}

// ── 2. GAME STATE ─────────────────────────────────────────────
const getInitialState = (config = null) => ({
    teamA: { name: config?.teamAName || 'Team A', score: 0, fouls: 0, timeouts: config?.timeoutsPerTeam ?? 2, color: config?.teamAColor || '#3B82F6' },
    teamB: { name: config?.teamBName || 'Team B', score: 0, fouls: 0, timeouts: config?.timeoutsPerTeam ?? 2, color: config?.teamBColor || '#EF4444' },
    clock: {
        gameMs: (config?.periodMinutes || 10) * 60 * 1000,
        shotMs: (config?.shotClockSeconds || 24) * 1000,
        isRunning: false, period: 1,
        totalPeriods: config?.periods || 4,
        periodMinutes: config?.periodMinutes || 10,
        shotClockSeconds: config?.shotClockSeconds || 24,
    },
    ui: { isTouchUnlocked: false },
    possession: null, // 'A' | 'B' | null
    meta: {
        gameCode: null, gameActive: false,
        periodType: config?.periodType || 'quarter',
        gameMode: config?.gameMode || 'quick', // 'quick' | 'stats' | 'advanced'
        players: {
            teamA: config?.playersA || [],
            teamB: config?.playersB || [],
        },
    },
});

let state = getInitialState();
let history = [];
const cloneState = (s) => JSON.parse(JSON.stringify(s));
const saveHistory = () => { history.push(cloneState(state)); if (history.length > 50) history.shift(); };

// ── 3. BUZZER ─────────────────────────────────────────────────
let buzzerPin = null, buzzerTimeout = null;

function initializeBuzzer() {
    try {
        buzzerPin = new Gpio(OUTPUT_CONFIG.BUZZER_PIN, { mode: Gpio.OUTPUT });
        buzzerPin.digitalWrite(0);
        console.log('✅ Buzzer initialized');
    } catch (e) {
        console.warn('⚠️  Buzzer unavailable:', e.message);
        buzzerPin = null;
    }
}

function triggerBuzzer(type = 'SHORT') {
    if (!buzzerPin) return;
    buzzerPin.digitalWrite(1);
    if (buzzerTimeout) clearTimeout(buzzerTimeout);
    buzzerTimeout = setTimeout(() => buzzerPin.digitalWrite(0), type === 'LONG' ? 2000 : 800);
}

// ── 4. CLOCK ──────────────────────────────────────────────────
let lastTick = Date.now(), lastCloudTick = 0;

setInterval(() => {
    if (!state.meta.gameActive) return;
    const now = Date.now();
    const delta = now - lastTick;
    const safeDelta = Math.min(delta, 200);
    lastTick = now;

    if (state.clock.isRunning) {
        const prevGame = state.clock.gameMs;
        const prevShot = state.clock.shotMs;
        state.clock.gameMs = Math.max(0, state.clock.gameMs - safeDelta);
        state.clock.shotMs = Math.max(0, state.clock.shotMs - safeDelta);
        let fullSync = false;

        if (state.clock.gameMs === 0 && prevGame > 0) {
            state.clock.isRunning = false;
            triggerBuzzer('LONG');
            fullSync = true;
            console.log('🚨 End of Period!');
        } else if (state.clock.shotMs === 0 && prevShot > 0 && state.clock.gameMs > 0) {
            state.clock.isRunning = false;
            triggerBuzzer('SHORT');
            fullSync = true;
            console.log('🚨 Shot Clock Violation!');
        }

        if (fullSync) {
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

// ── 5. PICO UART ──────────────────────────────────────────────
let picoPort = null;
let picoReconnectTimer = null;
let picoConnected = false;

function initializePico() {
    if (picoReconnectTimer) { clearTimeout(picoReconnectTimer); picoReconnectTimer = null; }

    console.log('🔌 Connecting to Pico via UART...');
    let port;
    try {
        port = new SerialPort({ path: '/dev/serial0', baudRate: 115200 });
    } catch (e) {
        console.warn(`⚠️  Could not open serial port: ${e.message} — retrying in 3s`);
        picoReconnectTimer = setTimeout(initializePico, 3000);
        return;
    }

    picoPort = port;

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', () => {
        picoConnected = true;
        console.log('✅ Pico UART connected');
        io.emit('pico_status', { connected: true });
    });

    port.on('error', (e) => {
        console.error(`❌ UART error: ${e.message}`);
    });

    port.on('close', () => {
        picoConnected = false;
        picoPort = null;
        console.warn('⚠️  Pico UART closed — reconnecting in 3s...');
        io.emit('pico_status', { connected: false });
        picoReconnectTimer = setTimeout(initializePico, 3000);
    });

    parser.on('data', (line) => {
        const msg = line.trim();
        if (msg) handlePicoMessage(msg);
    });
}

// Score messages that trigger popups before state update
const SCORE_MESSAGES = {
    SCORE_A1: { team: 'A', points: 1 },
    SCORE_A2: { team: 'A', points: 2 },
    SCORE_A3: { team: 'A', points: 3 },
    SCORE_B1: { team: 'B', points: 1 },
    SCORE_B2: { team: 'B', points: 2 },
    SCORE_B3: { team: 'B', points: 3 },
};

function handlePicoMessage(msg) {
    console.log(`📨 Pico: ${msg}`);
    io.emit('pico_message_raw', msg);

    if (msg === 'PICO_READY') { console.log('✅ Pico handshake'); return; }

    if (!state.meta.gameActive) {
        console.log('> No active game — ignoring');
        return;
    }

    // ── SCORE — emit pending first, then update state ──────────
    if (SCORE_MESSAGES[msg]) {
        const { team, points } = SCORE_MESSAGES[msg];
        const teamKey = team === 'A' ? 'teamA' : 'teamB';
        saveHistory();
        state[teamKey].score += points;

        // Always emit score_pending so UI can show popup (in stats/advanced mode)
        // UI decides whether to show popup based on gameMode
        io.emit('score_pending', {
            team,
            points,
            players: team === 'A' ? state.meta.players.teamA : state.meta.players.teamB,
            gameMode: state.meta.gameMode,
        });

        // Score updates immediately regardless of popup
        io.emit('state_update', state);
        broadcastToCloud(currentGameCode, state);
        persistGameState(currentGameCode, state);
        console.log(`> ${teamKey} +${points} | ${state.teamA.score}-${state.teamB.score}`);
        return;
    }

    switch (msg) {
        case 'CLOCK_START':
            if (!state.clock.isRunning && state.clock.gameMs > 0) {
                state.clock.isRunning = true;
                lastTick = Date.now();
                console.log('> CLOCK START');
            }
            break;
        case 'CLOCK_STOP':
            if (state.clock.isRunning) {
                state.clock.isRunning = false;
                console.log('> CLOCK STOP');
            }
            break;
        case 'SHOT_CLOCK_24':
            saveHistory();
            state.clock.shotMs = state.clock.shotClockSeconds * 1000;
            console.log('> SHOT CLOCK 24s');
            break;
        case 'SHOT_CLOCK_14':
            saveHistory();
            state.clock.shotMs = 14000;
            console.log('> SHOT CLOCK 14s');
            break;
        case 'UNDO':
            if (history.length > 0) {
                state = history.pop();
                console.log('> UNDO');
                io.emit('undo_triggered'); // UI can animate this
                broadcastToCloud(currentGameCode, state);
                persistGameState(currentGameCode, state);
            }
            break;
        case 'SETTINGS':
            state.ui.isTouchUnlocked = !state.ui.isTouchUnlocked;
            console.log(`> TOUCHSCREEN ${state.ui.isTouchUnlocked ? 'UNLOCKED 🔓' : 'LOCKED 🔒'}`);
            io.emit('settings_toggled', { unlocked: state.ui.isTouchUnlocked });
            break;
        default:
            console.log(`> Unknown: ${msg}`);
            return;
    }

    io.emit('state_update', state);
    broadcastToCloud(currentGameCode, state);
    persistGameState(currentGameCode, state);
}

// ── 6. SERVER ─────────────────────────────────────────────────
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.get('/api/state', (req, res) => res.json(state));
app.get('/api/health', (req, res) => {
    let cpuTemp = null;
    try {
        const raw = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
        cpuTemp = (parseInt(raw.trim()) / 1000).toFixed(1) + '°C';
    } catch (_) { }

    const mem = process.memoryUsage();
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()) + 's',
        pico: { connected: picoConnected },
        game: {
            active: state.meta.gameActive,
            code: currentGameCode,
            period: state.clock.period,
            score: `${state.teamA.score}-${state.teamB.score}`,
        },
        system: {
            cpuTemp,
            heapMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
            rssMb: (mem.rss / 1024 / 1024).toFixed(1),
        },
        ts: Date.now(),
    });
});
app.get('/api/network-ip', (req, res) => {
    try { res.json({ ip: execSync("hostname -I | awk '{print $1}'").toString().trim() }); }
    catch (e) { res.json({ ip: 'localhost' }); }
});

io.on('connection', (socket) => {
    console.log(`🔌 UI connected: ${socket.id}`);
    socket.emit('state_update', state);

    socket.on('setup_game', async (config) => {
        console.log('\n📋 Setting up game:', config.existingGameCode || 'NEW');
        try {
            const gameCode = config.existingGameCode || await createGame(config);
            currentGameCode = gameCode;
            state = getInitialState(config);
            state.meta.gameCode = gameCode;
            state.meta.gameActive = true;
            history = [];
            socket.emit('game_ready', { gameCode });
            io.emit('state_update', state);
            console.log(`✅ Game ${gameCode} started — Mode: ${state.meta.gameMode}`);
        } catch (err) {
            console.error('❌ setup_game failed:', err.message);
            socket.emit('setup_error', { message: err.message });
        }
    });

    // Shot attribution — sent back from UI after popup completes
    // Daemon logs it but score is already counted
    socket.on('shot_attributed', (data) => {
        console.log(`📊 Shot attributed: Team ${data.team} +${data.points} | Player: ${data.playerName || 'unknown'} | Zone: ${data.zone || 'unlocated'}`);
        // Could persist shot detail to Supabase here in the future
    });

    socket.on('ui_action', (action) => {
        if (!state.ui.isTouchUnlocked) { console.log('> UI action rejected — locked'); return; }
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
                console.log(`> NEXT PERIOD: ${state.clock.period}`);
                break;
            case 'ADD_FOUL_A': saveHistory(); state.teamA.fouls = Math.min(99, state.teamA.fouls + 1); break;
            case 'ADD_FOUL_B': saveHistory(); state.teamB.fouls = Math.min(99, state.teamB.fouls + 1); break;
            case 'TIMEOUT_A':
                saveHistory();
                if (state.teamA.timeouts > 0) { state.teamA.timeouts -= 1; state.clock.isRunning = false; }
                break;
            case 'TIMEOUT_B':
                saveHistory();
                if (state.teamB.timeouts > 0) { state.teamB.timeouts -= 1; state.clock.isRunning = false; }
                break;
            case 'SET_POSSESSION':
                state.possession = action.payload.team || null;
                break;
            case 'TRIGGER_BUZZER':
                triggerBuzzer(action.payload?.type || 'SHORT');
                break;
        }
        io.emit('state_update', state);
        broadcastToCloud(currentGameCode, state);
        persistGameState(currentGameCode, state);
    });

    socket.on('end_game', async () => {
        if (!currentGameCode) return;
        state.clock.isRunning = false;
        io.emit('score_pending_clear');
        await finishGame(currentGameCode);
        teardownChannel();
        const endedCode = currentGameCode;
        currentGameCode = null; state = getInitialState(); history = [];
        socket.emit('game_ended', { finalCode: endedCode });
        io.emit('state_update', state);
        console.log(`🏁 Game ${endedCode} ended`);
    });

    socket.on('disconnect', () => console.log(`🔌 UI disconnected: ${socket.id}`));
});

// ── 7. BOOT ───────────────────────────────────────────────────
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════╗`);
    console.log(`║   THE BOX — Hardware Daemon v3    ║`);
    console.log(`║   Listening on :${PORT}              ║`);
    console.log(`╚═══════════════════════════════════╝\n`);
    initializeBuzzer();
    initializePico();
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    if (picoReconnectTimer) clearTimeout(picoReconnectTimer);
    if (picoPort) picoPort.close();
    if (buzzerPin) buzzerPin.digitalWrite(0);
    teardownChannel();
    process.exit(0);
});