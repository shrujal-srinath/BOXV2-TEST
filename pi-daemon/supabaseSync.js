// pi-daemon/supabaseSync.js
// ═══════════════════════════════════════════════════════════════
// THE BOX — Supabase Sync Layer
//
// Uses the SERVICE ROLE KEY so the Pi can write to the games table
// without needing an authenticated user session.
//
// Responsibilities:
//   1. createGame()        — insert a new game row, return game code
//   2. persistGameState()  — update the games.data JSONB on every action
//   3. broadcastToCloud()  — realtime broadcast for arena screen
//   4. broadcastClockToCloud() — throttled clock broadcast (1/sec)
//   5. finishGame()        — mark game as completed on end
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Service role key — bypasses RLS

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  No Supabase credentials found in .env. Cloud sync is DISABLED.');
    console.warn('    Add SUPABASE_URL and SUPABASE_SERVICE_KEY to pi-daemon/.env');
}

// Service role client — can write to any table regardless of RLS
const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;

let activeChannel = null;

// ─── Game Code Generator ───────────────────────────────────────
// Matches the website's algorithm exactly.
// Excludes O, 0, I, 1, S, 5 — visually ambiguous characters.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

const generateGameCode = async () => {
    if (!supabase) {
        // Offline fallback — generate a local code without uniqueness check
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
        }
        return code;
    }

    while (true) {
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
        }
        // Uniqueness check — retries on collision (astronomically rare)
        const { data } = await supabase
            .from('games')
            .select('code')
            .eq('code', code)
            .maybeSingle();
        if (!data) return code;
    }
};

// ─── Game Creation ─────────────────────────────────────────────
/**
 * Creates a new game in Supabase, identical to how the website does it.
 *
 * @param {object} config - { teamAName, teamBName, teamAColor, teamBColor,
 *                            periodMinutes, shotClockSeconds, periods, periodType }
 * @returns {string} gameCode — the 4-char code, or null if offline
 */
export const createGame = async (config) => {
    const gameCode = await generateGameCode();
    const now = Date.now();

    const gameData = {
        code: gameCode,
        hostId: 'THE-BOX-PI',         // Pi device identifier
        sportId: 'basketball',
        sport: 'basketball',
        status: 'live',
        gameType: 'local',
        createdAt: now,
        lastUpdate: now,
        settings: {
            gameName: `${config.teamAName} vs ${config.teamBName}`,
            periodDuration: config.periodMinutes,
            shotClockDuration: config.shotClockSeconds,
            periodType: config.periodType || 'quarter',
            periods: config.periods || 4,
            gameMode: 'quick',
        },
        gameState: {
            period: 1,
            gameTime: {
                minutes: config.periodMinutes,
                seconds: 0,
                tenths: 0,
            },
            shotClock: config.shotClockSeconds,
            gameRunning: false,
            shotClockRunning: false,
            possession: 'A',
        },
        teamA: {
            name: config.teamAName,
            color: config.teamAColor || '#3B82F6',
            score: 0,
            fouls: 0,
            foulsThisQuarter: 0,
            timeouts: config.timeoutsPerTeam || 2,
            timeoutsFirstHalf: 2,
            timeoutsSecondHalf: 3,
            players: [],
        },
        teamB: {
            name: config.teamBName,
            color: config.teamBColor || '#EF4444',
            score: 0,
            fouls: 0,
            foulsThisQuarter: 0,
            timeouts: config.timeoutsPerTeam || 2,
            timeoutsFirstHalf: 2,
            timeoutsSecondHalf: 3,
            players: [],
        },
    };

    if (!supabase) {
        console.log(`[Offline] Game ${gameCode} created locally only (no Supabase)`);
        return gameCode;
    }

    const { error } = await supabase
        .from('games')
        .insert({
            code: gameCode,
            hostId: 'THE-BOX-PI',
            sportId: 'basketball',
            status: 'live',
            gameType: 'local',
            data: gameData,
            lastUpdate: now,
        });

    if (error) {
        console.error('[Supabase] createGame failed:', error.message);
        // Don't throw — game still works locally even if Supabase write fails
        return gameCode;
    }

    console.log(`☁️  Game ${gameCode} created in Supabase`);
    return gameCode;
};

// ─── State Persistence ─────────────────────────────────────────
/**
 * Persists the full game state to the games.data JSONB column.
 * Called after every score/foul/timeout action (NOT on every clock tick).
 * Throttled internally — max 1 write per 500ms to avoid rate limits.
 */
let lastPersistTime = 0;
let pendingPersist = null;

export const persistGameState = (gameCode, state) => {
    if (!supabase || !gameCode) return;

    const now = Date.now();
    const timeSinceLast = now - lastPersistTime;

    // Clear any pending persist
    if (pendingPersist) {
        clearTimeout(pendingPersist);
        pendingPersist = null;
    }

    const doWrite = async () => {
        lastPersistTime = Date.now();

        const patch = {
            'teamA.score': state.teamA.score,
            'teamA.fouls': state.teamA.fouls,
            'teamA.timeouts': state.teamA.timeouts,
            'teamB.score': state.teamB.score,
            'teamB.fouls': state.teamB.fouls,
            'teamB.timeouts': state.teamB.timeouts,
            'gameState.period': state.clock.period,
            'gameState.gameRunning': state.clock.isRunning,
        };

        // Supabase doesn't support dot-path JSONB updates via .update() directly,
        // so we use RPC or a full data fetch+merge. Simplest approach: full overwrite
        // of just the fields we care about using jsonb_set via the JS client workaround.
        // For demo V1, we do a select-then-update pattern.
        const { data: existing, error: fetchError } = await supabase
            .from('games')
            .select('data')
            .eq('code', gameCode)
            .maybeSingle();

        if (fetchError || !existing) return;

        const merged = {
            ...existing.data,
            lastUpdate: Date.now(),
            teamA: { ...existing.data.teamA, score: state.teamA.score, fouls: state.teamA.fouls, timeouts: state.teamA.timeouts },
            teamB: { ...existing.data.teamB, score: state.teamB.score, fouls: state.teamB.fouls, timeouts: state.teamB.timeouts },
            gameState: {
                ...existing.data.gameState,
                period: state.clock.period,
                gameRunning: state.clock.isRunning,
                gameTime: {
                    minutes: Math.floor(state.clock.gameMs / 60000),
                    seconds: Math.floor((state.clock.gameMs % 60000) / 1000),
                    tenths: 0,
                },
                shotClock: Math.ceil(state.clock.shotMs / 1000),
            },
        };

        const { error } = await supabase
            .from('games')
            .update({ data: merged, lastUpdate: Date.now() })
            .eq('code', gameCode);

        if (error) console.error('[Supabase] persistGameState failed:', error.message);
    };

    if (timeSinceLast >= 500) {
        doWrite();
    } else {
        // Defer to avoid hammering Supabase on rapid button presses
        pendingPersist = setTimeout(doWrite, 500 - timeSinceLast);
    }
};

// ─── Game Finish ───────────────────────────────────────────────
export const finishGame = async (gameCode) => {
    if (!supabase || !gameCode) return;

    const { error } = await supabase
        .from('games')
        .update({ status: 'completed', lastUpdate: Date.now() })
        .eq('code', gameCode);

    if (error) console.error('[Supabase] finishGame failed:', error.message);
    else console.log(`☁️  Game ${gameCode} marked as completed`);
};

// ─── Realtime Broadcast ────────────────────────────────────────
// Uses ANON key for broadcast — this is fine, broadcast is ephemeral
// and doesn't touch the DB. We create a second client for this.
const anonKey = process.env.SUPABASE_ANON_KEY;
const broadcastClient = supabaseUrl && anonKey
    ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    : supabase; // fallback to service client if no anon key

export const broadcastToCloud = (gameCode, state) => {
    if (!broadcastClient || !gameCode) return;

    if (!activeChannel || activeChannel._topic !== `realtime:box-${gameCode}`) {
        if (activeChannel) broadcastClient.removeChannel(activeChannel);
        activeChannel = broadcastClient.channel(`box-${gameCode}`);
        activeChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log(`☁️  Broadcasting on channel [box-${gameCode}]`);
        });
    }

    activeChannel.send({
        type: 'broadcast',
        event: 'score_update',
        payload: {
            teamA: state.teamA.score,
            teamB: state.teamB.score,
            foulsA: state.teamA.fouls,
            foulsB: state.teamB.fouls,
            timeoutsA: state.teamA.timeouts,
            timeoutsB: state.teamB.timeouts,
            possession: state.clock.period % 2 !== 0 ? 'A' : 'B',
        }
    });
};

export const broadcastClockToCloud = (gameCode, clockState) => {
    if (!activeChannel) return;

    activeChannel.send({
        type: 'broadcast',
        event: 'clock_sync',
        payload: {
            minutes: Math.floor(clockState.gameMs / 60000),
            seconds: Math.floor((clockState.gameMs % 60000) / 1000),
            period: clockState.period,
            gameRunning: clockState.isRunning,
            shotClock: Math.ceil(clockState.shotMs / 1000),
        }
    });
};

// ─── Channel Teardown ──────────────────────────────────────────
export const teardownChannel = () => {
    if (activeChannel && broadcastClient) {
        broadcastClient.removeChannel(activeChannel);
        activeChannel = null;
    }
};