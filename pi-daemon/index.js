// pi-daemon/index.js — THE BOX Hardware Daemon v3
// Pico UART for buttons, pigpio for buzzer, score_pending for UI popups.
//
// Transports:
//   • Socket.io @ :3001 → LAN UI (RefereeScreen, PiLocalDisplay, OBSOverlay)
//     events: state_update, clock_sync, score_pending, undo_triggered,
//             settings_toggled, pico_status, pico_message_raw, game_ready,
//             game_ended, setup_error, score_pending_clear
//   • Supabase realtime → cloud spectators (web SpectatorView, watch pages)
//     channel: game:${code}
//     events:  clock_tick, clock_start, clock_stop, score_update

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { OUTPUT_CONFIG } from './buttonMap.js';
import {
    createGame, fetchGameByCode, persistGameState, finishGame, flushPendingPersist,
    ensureChannel, broadcastToCloud, broadcastClockTick, broadcastClockStart, broadcastClockStop,
    teardownChannel,
    writeShotEvent, deleteShotEvent, writeGameAction, deleteGameAction,
} from './supabaseSync.js';

let currentGameCode = null;

// ── FIBA timeout buckets (ported from src/services/fibaTimeouts.ts) ──
// Allotment per period, refilled when the bucket key changes.
//   4+ periods: H1 (P1-2) = 2,  H2 (P3..total) = 3,  OT = 1
//   2 periods:  H1 = 2, H2 = 2, OT = 1
//   1 period:   1 per game
function fibaTimeoutsForPeriod(period, totalPeriods) {
    if (totalPeriods >= 4) {
        if (period <= 2) return 2;
        if (period <= totalPeriods) return 3;
        return 1;
    }
    if (totalPeriods === 2) {
        if (period <= 2) return 2;
        return 1;
    }
    return 1;
}
function timeoutBucketKey(period, totalPeriods) {
    if (totalPeriods >= 4) {
        if (period <= 2) return 'H1';
        if (period <= totalPeriods) return 'H2';
        return `OT${period - totalPeriods}`;
    }
    if (totalPeriods === 2) {
        if (period === 1) return 'H1';
        if (period === 2) return 'H2';
        return `OT${period - 2}`;
    }
    return period === 1 ? 'REG' : `OT${period - 1}`;
}

// ── 1. BUZZER GPIO ────────────────────────────────────────────
let Gpio;
let pigpioModule = null;
if (process.platform === 'linux') {
    pigpioModule = await import('pigpio');
    try { pigpioModule.configureClock(5, 0); } catch (e) { }
    Gpio = pigpioModule.Gpio;
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
        timeoutMode: config?.timeoutMode || 'fiba',
        players: {
            teamA: config?.playersA || [],
            teamB: config?.playersB || [],
        },
    },
});

let state = getInitialState();

// History entries are { state, shotIds[], actionIds[] }. The IDs are the
// shot_events / game_actions rows written *after* this snapshot was taken
// (i.e. the rows the user will lose if they undo to it).
let history = [];
const cloneState = (s) => JSON.parse(JSON.stringify(s));
const saveHistory = () => {
    history.push({ state: cloneState(state), shotIds: [], actionIds: [] });
    if (history.length > 50) history.shift();
};
const recordShotOnLastSnapshot = (id) => {
    if (!id || history.length === 0) return;
    history[history.length - 1].shotIds.push(id);
};
const recordActionOnLastSnapshot = (id) => {
    if (!id || history.length === 0) return;
    history[history.length - 1].actionIds.push(id);
};

// ── Offline queues ───────────────────────────────────────────
// shot_events and game_actions both fall through to here when the Supabase
// write fails (offline / transient error). Flushed on next success, or every
// 30s by the retry timer below.
const shotQueue = [];
const actionQueue = [];
let retryTimer = null;

function ensureRetryTimer() {
    if (retryTimer) return;
    if (shotQueue.length === 0 && actionQueue.length === 0) return;
    retryTimer = setInterval(async () => {
        await flushShotQueue();
        await flushActionQueue();
        if (shotQueue.length === 0 && actionQueue.length === 0) {
            clearInterval(retryTimer);
            retryTimer = null;
            console.log('[Queue] All queues drained — retry timer stopped');
        }
    }, 30000);
}

async function persistShotEvent(eventData) {
    const payload = { ...eventData, createdAt: new Date().toISOString() };
    try {
        const id = await writeShotEvent(currentGameCode, payload);
        recordShotOnLastSnapshot(id);
        flushShotQueue();
        flushActionQueue();
    } catch {
        shotQueue.push({ gameCode: currentGameCode, ...payload });
        console.warn(`[ShotQueue] Queued offline — queue length: ${shotQueue.length}`);
        ensureRetryTimer();
    }
}

async function flushShotQueue() {
    while (shotQueue.length > 0) {
        const item = shotQueue[0];
        try {
            await writeShotEvent(item.gameCode, item);
            shotQueue.shift();
            console.log(`[ShotQueue] Flushed 1 shot — ${shotQueue.length} remaining`);
        } catch {
            break;
        }
    }
}

async function persistGameAction(actionData) {
    try {
        const id = await writeGameAction(currentGameCode, actionData);
        recordActionOnLastSnapshot(id);
        flushShotQueue();
        flushActionQueue();
    } catch {
        actionQueue.push({ gameCode: currentGameCode, ...actionData });
        console.warn(`[ActionQueue] Queued offline — queue length: ${actionQueue.length}`);
        ensureRetryTimer();
    }
}

async function flushActionQueue() {
    while (actionQueue.length > 0) {
        const item = actionQueue[0];
        try {
            await writeGameAction(item.gameCode, item);
            actionQueue.shift();
            console.log(`[ActionQueue] Flushed 1 action — ${actionQueue.length} remaining`);
        } catch {
            break;
        }
    }
}

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

// ── 4. CLOCK (epoch-anchored) ─────────────────────────────────
// While running, we don't decrement on each tick — instead we store a
// "deadline" timestamp and recompute remaining = max(0, deadline - now).
// Event-loop stalls no longer steal real seconds from the official clock.
let gameDeadlineMs = null;
let shotDeadlineMs = null;
let lastCloudTick = 0;

function startClock() {
    if (state.clock.gameMs <= 0) return;
    if (state.clock.isRunning) return;
    state.clock.isRunning = true;
    gameDeadlineMs = Date.now() + state.clock.gameMs;
    shotDeadlineMs = Date.now() + state.clock.shotMs;
    broadcastClockStart(currentGameCode, state.clock);
}

function stopClock() {
    if (!state.clock.isRunning) return;
    // Freeze remaining time before clearing deadlines.
    if (gameDeadlineMs !== null) state.clock.gameMs = Math.max(0, gameDeadlineMs - Date.now());
    if (shotDeadlineMs !== null) state.clock.shotMs = Math.max(0, shotDeadlineMs - Date.now());
    state.clock.isRunning = false;
    gameDeadlineMs = null;
    shotDeadlineMs = null;
    broadcastClockStop(currentGameCode, state.clock);
}

/** Re-anchor the deadlines after gameMs/shotMs were edited mid-run. */
function reanchorClock() {
    if (!state.clock.isRunning) return;
    gameDeadlineMs = Date.now() + state.clock.gameMs;
    shotDeadlineMs = Date.now() + state.clock.shotMs;
}

setInterval(() => {
    if (!state.meta.gameActive || !state.clock.isRunning) return;
    const now = Date.now();
    const prevGame = state.clock.gameMs;
    const prevShot = state.clock.shotMs;
    state.clock.gameMs = Math.max(0, gameDeadlineMs - now);
    state.clock.shotMs = Math.max(0, shotDeadlineMs - now);
    let fullSync = false;

    if (state.clock.gameMs === 0 && prevGame > 0) {
        state.clock.isRunning = false;
        gameDeadlineMs = null;
        shotDeadlineMs = null;
        triggerBuzzer('LONG');
        fullSync = true;
        console.log('🚨 End of Period!');
        broadcastClockStop(currentGameCode, state.clock);
    } else if (state.clock.shotMs === 0 && prevShot > 0 && state.clock.gameMs > 0) {
        state.clock.isRunning = false;
        gameDeadlineMs = null;
        shotDeadlineMs = null;
        triggerBuzzer('SHORT');
        fullSync = true;
        console.log('🚨 Shot Clock Violation!');
        broadcastClockStop(currentGameCode, state.clock);
    }

    if (fullSync) {
        io.emit('state_update', state);
        broadcastToCloud(currentGameCode, state);
        persistGameState(currentGameCode, state);
    } else {
        io.emit('clock_sync', state.clock);
        if (now - lastCloudTick >= 1000) {
            broadcastClockTick(currentGameCode, state.clock);
            lastCloudTick = now;
        }
    }
}, 100);

// ── 5. PICO UART ──────────────────────────────────────────────
const SERIAL_SOURCES = [
    { path: '/dev/serial0', label: 'Pico W',    baudRate: 115200 },
    { path: '/dev/ttyACM0', label: 'C3 Dongle', baudRate: 115200 },
];
const serialPorts = new Map();
const serialReconnectTimers = new Map();
let picoConnected = false;

function initializeSerial(source) {
    const { path, label, baudRate } = source;
    const existing = serialReconnectTimers.get(path);
    if (existing) { clearTimeout(existing); serialReconnectTimers.delete(path); }

    console.log(`🔌 Connecting to ${label} on ${path}...`);
    let port;
    try {
        port = new SerialPort({ path, baudRate });
    } catch (e) {
        console.warn(`⚠️  ${label}: Could not open ${path}: ${e.message} — retrying in 3s`);
        serialReconnectTimers.set(path, setTimeout(() => initializeSerial(source), 3000));
        return;
    }

    serialPorts.set(path, port);
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', () => {
        if (path === '/dev/serial0') picoConnected = true;
        console.log(`✅ ${label} connected`);
        io.emit('pico_status', { connected: true, source: label });
    });

    port.on('error', (e) => {
        console.error(`❌ ${label} error: ${e.message}`);
    });

    port.on('close', () => {
        if (path === '/dev/serial0') picoConnected = false;
        serialPorts.delete(path);
        console.warn(`⚠️  ${label} closed — reconnecting in 3s...`);
        io.emit('pico_status', { connected: false, source: label });
        serialReconnectTimers.set(path, setTimeout(() => initializeSerial(source), 3000));
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

    if (msg === 'PICO_READY' || msg === 'ESPNOW_READY') { console.log(`✅ ${msg} handshake`); return; }

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

        // Made field goal (+2 or +3): other team gets the ball with a
        // fresh 24s shot clock. Free throws (+1) don't auto-reset because
        // they come in sequences; the ref resets after the last FT.
        if (points >= 2 && state.clock.shotClockSeconds > 0) {
            state.clock.shotMs = state.clock.shotClockSeconds * 1000;
            state.possession = team === 'A' ? 'B' : 'A';
            reanchorClock();
        }

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
            startClock();
            console.log('> CLOCK START');
            break;
        case 'CLOCK_STOP':
            stopClock();
            console.log('> CLOCK STOP');
            break;
        case 'CLOCK_TOGGLE':
            if (state.clock.isRunning) { stopClock(); console.log('> CLOCK STOP (toggle)'); }
            else { startClock(); console.log('> CLOCK START (toggle)'); }
            break;
        case 'SHOT_CLOCK_24':
            saveHistory();
            state.clock.shotMs = state.clock.shotClockSeconds * 1000;
            reanchorClock();
            console.log('> SHOT CLOCK 24s');
            break;
        case 'SHOT_CLOCK_14':
            saveHistory();
            state.clock.shotMs = 14000;
            reanchorClock();
            console.log('> SHOT CLOCK 14s');
            break;
        case 'UNDO':
            performUndo();
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

function performUndo() {
    if (history.length === 0) return;
    const entry = history.pop();
    state = entry.state;
    // Re-anchor in case the clock was running before the undone action.
    if (state.clock.isRunning) reanchorClock();
    else { gameDeadlineMs = null; shotDeadlineMs = null; }
    // Best-effort delete of any rows the undone action wrote.
    entry.shotIds.forEach(id => { deleteShotEvent(id).catch(() => {}); });
    entry.actionIds.forEach(id => { deleteGameAction(id).catch(() => {}); });
    console.log(`> UNDO — reverted (${entry.shotIds.length} shot(s), ${entry.actionIds.length} action(s) deleted)`);
    io.emit('undo_triggered');
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
        queues: { shots: shotQueue.length, actions: actionQueue.length },
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
    // New clients should know hardware status without waiting for a flap.
    socket.emit('pico_status', { connected: picoConnected, source: picoConnected ? 'Pico W' : null });

    socket.on('setup_game', async (config) => {
        console.log('\n📋 Setting up game:', config.existingGameCode || 'NEW');
        try {
            let gameCode;
            let restored = null;

            if (config.existingGameCode) {
                // Resume path — try to fetch persisted state before falling back.
                gameCode = config.existingGameCode;
                const row = await fetchGameByCode(gameCode);
                if (row && row.data) restored = row.data;
            } else {
                gameCode = await createGame(config);
            }

            currentGameCode = gameCode;
            state = getInitialState(config);
            if (restored) hydrateFromPersisted(restored);
            state.meta.gameCode = gameCode;
            state.meta.gameActive = true;
            history = [];

            // Pre-create the realtime channel so cloud viewers start receiving
            // clock_tick from the very first tick (not just after first score).
            ensureChannel(gameCode);

            socket.emit('game_ready', { gameCode, resumed: !!restored });
            io.emit('state_update', state);
            console.log(`✅ Game ${gameCode} ${restored ? 'RESUMED' : 'started'} — Mode: ${state.meta.gameMode}`);
        } catch (err) {
            console.error('❌ setup_game failed:', err.message);
            socket.emit('setup_error', { message: err.message });
        }
    });

    // Shot attribution — sent back from UI after popup completes
    // Score already counted; this persists the location/player metadata.
    socket.on('shot_attributed', (data) => {
        console.log(`📊 Shot: Team ${data.team} +${data.points} | Player: ${data.playerName || 'none'} | Zone: ${data.zone || 'unlocated'}`);
        if (currentGameCode && state.meta.gameMode !== 'quick') {
            persistShotEvent({
                team: data.team,
                points: data.points,
                playerId: data.playerId ?? null,
                playerName: data.playerName ?? null,
                zone: data.zone ?? 'unlocated',
                x: data.x ?? null,
                y: data.y ?? null,
                period: data.period ?? state.clock.period,
                gameClockSec: data.gameClockSec ?? Math.ceil(state.clock.gameMs / 1000),
                attributes: Array.isArray(data.attributes) ? data.attributes : [],
            });
        }
    });

    socket.on('ui_action', (action) => {
        if (!state.meta.gameActive) return;

        // UNLOCK_TOUCH must be honoured even while locked — it's how the on-screen
        // touch deck enables itself (there's no physical SETTINGS press on a tablet).
        if (action.type === 'UNLOCK_TOUCH') {
            state.ui.isTouchUnlocked = true;
            io.emit('settings_toggled', { unlocked: true });
            io.emit('state_update', state);
            console.log('> TOUCHSCREEN UNLOCKED 🔓 (touch deck)');
            return;
        }

        if (!state.ui.isTouchUnlocked) { console.log('> UI action rejected — locked'); return; }
        // UNDO and LOCK_TOUCH are not undo-able themselves; everything else snapshots.
        const NO_HISTORY = new Set(['UNDO', 'LOCK_TOUCH', 'TRIGGER_BUZZER']);
        if (!NO_HISTORY.has(action.type)) saveHistory();

        switch (action.type) {
            case 'EDIT_SCORE': {
                const tk = action.payload.team;
                const amount = action.payload.amount;
                state[tk].score = Math.max(0, state[tk].score + amount);
                // Positive scoring in stats/advanced mode → fire the shot-attribution
                // popup (court + roster), exactly like a physical score button.
                if (amount > 0 && state.meta.gameMode !== 'quick') {
                    const team = tk === 'teamA' ? 'A' : 'B';
                    io.emit('score_pending', {
                        team,
                        points: amount,
                        players: tk === 'teamA' ? state.meta.players.teamA : state.meta.players.teamB,
                        gameMode: state.meta.gameMode,
                    });
                }
                break;
            }
            case 'EDIT_FOULS': {
                const tk = action.payload.team;
                const amount = action.payload.amount;
                const before = state[tk].fouls;
                state[tk].fouls = Math.max(0, state[tk].fouls + amount);
                if (amount > 0 && state[tk].fouls > before) {
                    persistGameAction({
                        team: tk === 'teamA' ? 'A' : 'B',
                        actionType: 'foul',
                        period: state.clock.period,
                        gameClockSec: Math.ceil(state.clock.gameMs / 1000),
                    });
                }
                break;
            }
            case 'EDIT_TIMEOUTS': {
                const tk = action.payload.team;
                const amount = action.payload.amount;
                const before = state[tk].timeouts;
                state[tk].timeouts = Math.max(0, state[tk].timeouts + amount);
                if (amount < 0 && state[tk].timeouts < before) {
                    persistGameAction({
                        team: tk === 'teamA' ? 'A' : 'B',
                        actionType: 'timeout',
                        period: state.clock.period,
                        gameClockSec: Math.ceil(state.clock.gameMs / 1000),
                    });
                }
                break;
            }
            case 'EDIT_PERIOD': state.clock.period = Math.max(1, Math.min(state.clock.totalPeriods + 4, state.clock.period + action.payload.amount)); break;
            case 'CLOCK_TOGGLE':
                if (state.clock.isRunning) { stopClock(); console.log('> CLOCK STOP (touch)'); }
                else { startClock(); console.log('> CLOCK START (touch)'); }
                break;
            case 'CLOCK_START': startClock(); console.log('> CLOCK START (touch)'); break;
            case 'CLOCK_STOP':  stopClock();  console.log('> CLOCK STOP (touch)');  break;
            case 'EDIT_GAME_CLOCK':
                state.clock.gameMs = Math.max(0, Math.round(state.clock.gameMs + (action.payload.amount * 1000)));
                reanchorClock();
                break;
            case 'EDIT_SHOT_CLOCK':
                state.clock.shotMs = Math.max(0, Math.round(state.clock.shotMs + (action.payload.amount * 1000)));
                reanchorClock();
                break;
            case 'SET_GAME_CLOCK':
                state.clock.gameMs = Math.max(0, Math.round(action.payload.ms ?? 0));
                reanchorClock();
                break;
            case 'SET_SHOT_CLOCK':
                state.clock.shotMs = Math.max(0, Math.round(action.payload.ms ?? 0));
                reanchorClock();
                break;
            case 'LOCK_TOUCH':
                state.ui.isTouchUnlocked = false;
                io.emit('settings_toggled', { unlocked: false });
                break;
            case 'UNDO':
                performUndo();
                break;
            case 'NEXT_PERIOD':
                advancePeriod();
                break;
            case 'ADD_FOUL_A':
                state.teamA.fouls = Math.min(99, state.teamA.fouls + 1);
                persistGameAction({ team: 'A', actionType: 'foul', period: state.clock.period, gameClockSec: Math.ceil(state.clock.gameMs / 1000) });
                break;
            case 'ADD_FOUL_B':
                state.teamB.fouls = Math.min(99, state.teamB.fouls + 1);
                persistGameAction({ team: 'B', actionType: 'foul', period: state.clock.period, gameClockSec: Math.ceil(state.clock.gameMs / 1000) });
                break;
            case 'TIMEOUT_A':
                if (state.teamA.timeouts > 0) {
                    state.teamA.timeouts -= 1;
                    stopClock();
                    persistGameAction({ team: 'A', actionType: 'timeout', period: state.clock.period, gameClockSec: Math.ceil(state.clock.gameMs / 1000) });
                }
                break;
            case 'TIMEOUT_B':
                if (state.teamB.timeouts > 0) {
                    state.teamB.timeouts -= 1;
                    stopClock();
                    persistGameAction({ team: 'B', actionType: 'timeout', period: state.clock.period, gameClockSec: Math.ceil(state.clock.gameMs / 1000) });
                }
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
        stopClock();
        io.emit('score_pending_clear');
        const endedCode = currentGameCode;
        // finishGame internally flushes the throttled persist before flipping status.
        await finishGame(endedCode);
        teardownChannel();
        currentGameCode = null; state = getInitialState(); history = [];
        socket.emit('game_ended', { finalCode: endedCode });
        io.emit('state_update', state);
        console.log(`🏁 Game ${endedCode} ended`);
    });

    // DEV / TESTING — inject a simulated Pico button press from the browser.
    // Gated to non-production so anyone on the LAN can't inject scores in prod.
    socket.on('dev_pico_message', (msg) => {
        if (process.env.NODE_ENV === 'production') {
            console.warn(`🚫 dev_pico_message rejected in production (msg: ${msg})`);
            return;
        }
        if (typeof msg === 'string' && msg.length) {
            console.log(`⌨️  dev_pico: ${msg}`);
            handlePicoMessage(msg);
        }
    });

    socket.on('disconnect', () => console.log(`🔌 UI disconnected: ${socket.id}`));
});

// ── 7. RESUME / HYDRATE ───────────────────────────────────────
function hydrateFromPersisted(data) {
    const tA = data.teamA || {};
    const tB = data.teamB || {};
    const gs = data.gameState || {};
    const settings = data.settings || {};

    state.teamA.name = tA.name ?? state.teamA.name;
    state.teamA.color = tA.color ?? state.teamA.color;
    state.teamA.score = tA.score ?? 0;
    state.teamA.fouls = tA.fouls ?? 0;
    state.teamA.timeouts = tA.timeouts ?? state.teamA.timeouts;

    state.teamB.name = tB.name ?? state.teamB.name;
    state.teamB.color = tB.color ?? state.teamB.color;
    state.teamB.score = tB.score ?? 0;
    state.teamB.fouls = tB.fouls ?? 0;
    state.teamB.timeouts = tB.timeouts ?? state.teamB.timeouts;

    if (settings.periodDuration) state.clock.periodMinutes = settings.periodDuration;
    if (settings.shotClockDuration) state.clock.shotClockSeconds = settings.shotClockDuration;
    if (settings.periods) state.clock.totalPeriods = settings.periods;

    state.clock.period = gs.period ?? 1;
    // Always resume PAUSED — refs should restart the clock manually after a crash.
    state.clock.isRunning = false;
    const mins = gs.gameTime?.minutes ?? state.clock.periodMinutes;
    const secs = gs.gameTime?.seconds ?? 0;
    state.clock.gameMs = (mins * 60 + secs) * 1000;
    state.clock.shotMs = (gs.shotClock ?? state.clock.shotClockSeconds) * 1000;
    state.possession = gs.possession ?? null;

    // Players carry through if the persisted row had them.
    if (Array.isArray(tA.players) && tA.players.length) state.meta.players.teamA = tA.players;
    if (Array.isArray(tB.players) && tB.players.length) state.meta.players.teamB = tB.players;

    console.log(`♻️  Hydrated from persisted state — score ${state.teamA.score}-${state.teamB.score} P${state.clock.period}`);
}

// ── 8. PERIOD ADVANCE (with FIBA bucket replenishment + OT length) ──
function advancePeriod() {
    stopClock();
    const total = state.clock.totalPeriods;
    const oldPeriod = state.clock.period;
    const newPeriod = Math.min(total + 4, oldPeriod + 1); // cap at 4 OTs

    const isOT = newPeriod > total;
    // FIBA OT is fixed at 5 minutes regardless of regulation length.
    state.clock.gameMs = (isOT ? 5 : state.clock.periodMinutes) * 60 * 1000;
    state.clock.shotMs = state.clock.shotClockSeconds * 1000;
    state.teamA.fouls = 0;
    state.teamB.fouls = 0;
    state.clock.period = newPeriod;

    // Replenish timeouts only when the bucket key changes between old and new
    // period. Mid-bucket period changes (P1→P2) carry timeouts over.
    if (state.meta.timeoutMode === 'fiba') {
        const oldKey = timeoutBucketKey(oldPeriod, total);
        const newKey = timeoutBucketKey(newPeriod, total);
        if (oldKey !== newKey) {
            const refill = fibaTimeoutsForPeriod(newPeriod, total);
            state.teamA.timeouts = refill;
            state.teamB.timeouts = refill;
            console.log(`> Timeouts replenished for ${newKey}: ${refill} per team`);
        }
    }
    console.log(`> NEXT PERIOD: ${newPeriod}${isOT ? ' (OT)' : ''}`);
}

// ── 9. BOOT ───────────────────────────────────────────────────
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════╗`);
    console.log(`║   THE BOX — Hardware Daemon v3    ║`);
    console.log(`║   Listening on :${PORT}              ║`);
    console.log(`╚═══════════════════════════════════╝\n`);
    initializeBuzzer();
    SERIAL_SOURCES.forEach(source => initializeSerial(source));
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    serialReconnectTimers.forEach(t => clearTimeout(t));
    serialPorts.forEach(p => p.close());
    if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
    if (buzzerPin) buzzerPin.digitalWrite(0);
    try { pigpioModule?.terminate?.(); } catch (_) { }
    teardownChannel();
    // Best-effort: flush any pending persist before we exit.
    try { await flushPendingPersist(); } catch (_) { }
    process.exit(0);
});
