// src/services/rtdbClockService.ts
//
// ALL live clock operations go through Firebase Realtime Database.
// NOTHING in this file touches Firestore.
//
// Why RTDB and not Firestore for the clock?
//   - Firestore charges per write → clock ticks bankrupt you
//   - RTDB charges per GB downloaded → clock ticks are ~90 bytes each,
//     essentially free even at hundreds of games/month
//   - RTDB latency is <10ms → FIBA-accurate sync between host and spectators
//   - Firestore latency is 50–150ms → clock drift between devices

import { ref, set, update, onValue, off } from 'firebase/database';
import { rtdb } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RTDBClockState {
    gameRunning: boolean;
    shotClockRunning: boolean;
    minutes: number;
    seconds: number;
    shotClock: number;
    period: number;
    startedAt: number | null;
    shotClockStartedAt: number | null;
}

export interface RTDBScoreState {
    teamA: number;
    teamB: number;
    foulsA: number;
    foulsB: number;
    timeoutsA: number;
    timeoutsB: number;
    possession: 'A' | 'B';
}

// ─── Ref helpers ──────────────────────────────────────────────────────────────

const clockRef = (gameCode: string) => {
    if (!rtdb) throw new Error('[RTDB] Firebase Realtime Database not initialized. Check VITE_FIREBASE_DATABASE_URL.');
    return ref(rtdb, `games/${gameCode}/clock`);
};

const scoreRef = (gameCode: string) => {
    if (!rtdb) throw new Error('[RTDB] Firebase Realtime Database not initialized.');
    return ref(rtdb, `games/${gameCode}/score`);
};

// ─── Clock writes (host only) ─────────────────────────────────────────────────

/**
 * Called every 1 second by the host's setInterval.
 * Pushes the current clock state to RTDB.
 * All spectators receive this within <10ms.
 */
export const pushClockTick = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    shotClock: number
): Promise<void> => {
    if (!rtdb) return;
    try {
        await update(clockRef(gameCode), { minutes, seconds, shotClock });
    } catch (err) {
        console.error('[RTDB] pushClockTick failed:', err);
    }
};

/**
 * Called when the host presses START.
 * Sets gameRunning: true and records the exact moment the clock started.
 */
export const pushClockStart = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    shotClock: number,
    period: number
): Promise<void> => {
    if (!rtdb) return;
    try {
        await set(clockRef(gameCode), {
            gameRunning: true,
            shotClockRunning: true,
            minutes,
            seconds,
            shotClock,
            period,
            startedAt: Date.now(),
            shotClockStartedAt: Date.now(),
        });
    } catch (err) {
        console.error('[RTDB] pushClockStart failed:', err);
    }
};

/**
 * Called when the host presses STOP.
 * Persists the exact remaining time so any client that reconnects
 * sees the correct stopped time, not a stale running value.
 */
export const pushClockStop = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    shotClock: number,
    period: number
): Promise<void> => {
    if (!rtdb) return;
    try {
        await set(clockRef(gameCode), {
            gameRunning: false,
            shotClockRunning: false,
            minutes,
            seconds,
            shotClock,
            period,
            startedAt: null,
            shotClockStartedAt: null,
        });
    } catch (err) {
        console.error('[RTDB] pushClockStop failed:', err);
    }
};

/**
 * Called on period transition.
 * Resets clock to full period duration, stops all clocks.
 */
export const pushPeriodChange = async (
    gameCode: string,
    newPeriod: number,
    periodMinutes: number,
    shotClockDuration: number
): Promise<void> => {
    if (!rtdb) return;
    try {
        await set(clockRef(gameCode), {
            gameRunning: false,
            shotClockRunning: false,
            minutes: periodMinutes,
            seconds: 0,
            shotClock: shotClockDuration,
            period: newPeriod,
            startedAt: null,
            shotClockStartedAt: null,
        });
    } catch (err) {
        console.error('[RTDB] pushPeriodChange failed:', err);
    }
};

/**
 * Called when the host resets the shot clock (24 or 14 seconds).
 * Uses its OWN startedAt anchor so shot clock drift is tracked
 * independently from the game clock. This fixes the shot clock
 * drift bug where resetting mid-possession showed wrong values.
 */
export const pushShotClockReset = async (
    gameCode: string,
    value: number,
    gameRunning: boolean
): Promise<void> => {
    if (!rtdb) return;
    try {
        await update(clockRef(gameCode), {
            shotClock: value,
            shotClockRunning: gameRunning,
            shotClockStartedAt: gameRunning ? Date.now() : null,
        });
    } catch (err) {
        console.error('[RTDB] pushShotClockReset failed:', err);
    }
};

/**
 * Called when the host manually edits the clock via TimeEditModal.
 */
export const pushClockEdit = async (
    gameCode: string,
    minutes: number,
    seconds: number,
    shotClock: number
): Promise<void> => {
    if (!rtdb) return;
    try {
        await update(clockRef(gameCode), {
            minutes,
            seconds,
            shotClock,
            startedAt: null,
            shotClockStartedAt: null,
        });
    } catch (err) {
        console.error('[RTDB] pushClockEdit failed:', err);
    }
};

// ─── Score writes (host only) ─────────────────────────────────────────────────

/**
 * Called after every score/foul/timeout action on the host.
 * Keeps the RTDB score node in sync so spectators see it immediately.
 * The Firestore game document is the permanent record — this is the
 * live display layer.
 */
export const pushScoreUpdate = async (
    gameCode: string,
    scoreA: number,
    scoreB: number,
    foulsA: number,
    foulsB: number,
    timeoutsA: number,
    timeoutsB: number,
    possession: 'A' | 'B'
): Promise<void> => {
    if (!rtdb) return;
    try {
        await set(scoreRef(gameCode), {
            teamA: scoreA,
            teamB: scoreB,
            foulsA,
            foulsB,
            timeoutsA,
            timeoutsB,
            possession,
        });
    } catch (err) {
        console.error('[RTDB] pushScoreUpdate failed:', err);
    }
};

// ─── Subscriptions (all clients — host and spectators) ───────────────────────

/**
 * Subscribe to live clock state from RTDB.
 * Returns an unsubscribe function — call it on component unmount.
 */
export const subscribeToRTDBClock = (
    gameCode: string,
    callback: (clock: RTDBClockState | null) => void
): (() => void) => {
    if (!rtdb) {
        callback(null);
        return () => { };
    }
    const r = clockRef(gameCode);
    const unsub = onValue(r, (snap) => {
        callback(snap.exists() ? (snap.val() as RTDBClockState) : null);
    }, (err) => {
        console.error('[RTDB] Clock subscription error:', err);
        callback(null);
    });
    // Return cleanup function
    return () => off(r, 'value', unsub as any);
};

/**
 * Subscribe to live score state from RTDB.
 * Returns an unsubscribe function.
 */
export const subscribeToRTDBScore = (
    gameCode: string,
    callback: (score: RTDBScoreState | null) => void
): (() => void) => {
    if (!rtdb) {
        callback(null);
        return () => { };
    }
    const r = scoreRef(gameCode);
    const unsub = onValue(r, (snap) => {
        callback(snap.exists() ? (snap.val() as RTDBScoreState) : null);
    }, (err) => {
        console.error('[RTDB] Score subscription error:', err);
        callback(null);
    });
    return () => off(r, 'value', unsub as any);
};