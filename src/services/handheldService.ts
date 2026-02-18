// src/services/handheldService.ts
//
// REWRITE — True Handshake Pairing
//
// The old system wrote to Firestore and declared success. No confirmation from ESP32.
// This version implements a two-way handshake:
//   1. Web writes pairRequest  → ESP32 sees it
//   2. ESP32 writes pairAck    → Web sees it → CONFIRMED
//
// False positives are eliminated. If the device doesn't respond in 10s → timeout.

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, rtdb } from './firebase';
import { ref, set, get, onValue, off, remove, update } from 'firebase/database';

// ─── UNIFIED SESSION KEY ──────────────────────────────────────────────────────
// ⚠️ MUST MATCH everywhere: handheldService, Dashboard, ConnectControllerModal
export const HW_SESSION_KEY = 'BOX_HARDWARE_ID';
export const HW_COLLECTION = 'hardware_terminals';

// ─── HANDSHAKE TIMEOUT ───────────────────────────────────────────────────────
const PAIR_ACK_TIMEOUT_MS = 10_000; // 10 seconds for ESP32 to respond

// ─── CONTROL MODES ───────────────────────────────────────────────────────────
export type ControlMode = 'hardware' | 'shared' | 'web';

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface HandheldDevice {
    id: string;
    status: 'waiting' | 'paired' | 'active';
    hostId: string | null;
    activeGameId: string | null;
    lastHeartbeat: number;
    linkedAt?: number;
}

export interface PairResult {
    success: boolean;
    message: string;
    phase?: 'not_found' | 'stale_blocked' | 'handshake_timeout' | 'confirmed';
}

// ─── HELPER: RTDB PATHS ──────────────────────────────────────────────────────
export const hwPath = {
    root: (id: string) => `hardware/${id}`,
    registered: (id: string) => `hardware/${id}/registered`,
    heartbeat: (id: string) => `hardware/${id}/heartbeat`,
    pairRequest: (id: string) => `hardware/${id}/meta/pairRequest`,
    pairAck: (id: string) => `hardware/${id}/meta/pairAck`,
    status: (id: string) => `hardware/${id}/meta/status`,
    hostId: (id: string) => `hardware/${id}/meta/hostId`,
    controlMode: (id: string) => `hardware/${id}/meta/controlMode`,
    activeGameId: (id: string) => `hardware/${id}/meta/activeGameId`,
    localIp: (id: string) => `hardware/${id}/meta/localIp`,
    display: (id: string) => `hardware/${id}/display`,
    input: (id: string) => `hardware/${id}/input`,
};

// ─────────────────────────────────────────────────────────────────────────────
// pairHandheldDevice
//
// Full two-way handshake. Returns only after ESP32 confirms (or times out).
// ─────────────────────────────────────────────────────────────────────────────
export const pairHandheldDevice = async (
    code: string,
    userId: string,
    onPhaseChange?: (phase: 'searching' | 'found' | 'handshaking' | 'confirmed' | 'timeout') => void,
): Promise<PairResult> => {
    if (!code || code.length !== 4) {
        return { success: false, message: 'Invalid code. Must be 4 characters.' };
    }

    if (!rtdb) {
        return { success: false, message: 'Realtime Database not available.' };
    }

    // ── PHASE 1: SEARCHING ───────────────────────────────────────────────────
    onPhaseChange?.('searching');

    const registeredSnap = await get(ref(rtdb, hwPath.registered(code)));
    if (!registeredSnap.exists() || registeredSnap.val() !== true) {
        return {
            success: false,
            message: 'Controller not found. Check the code on your device and ensure it is powered on.',
            phase: 'not_found',
        };
    }

    // ── PHASE 2: FOUND — check Firestore for stale locks ────────────────────
    onPhaseChange?.('found');

    const deviceRef = doc(db, HW_COLLECTION, code);
    const deviceSnap = await getDoc(deviceRef);

    if (deviceSnap.exists()) {
        const data = deviceSnap.data() as HandheldDevice;
        if (data.status === 'paired' && data.hostId && data.hostId !== userId) {
            const staleSince = Date.now() - (data.lastHeartbeat || 0);
            if (staleSince < 30_000) {
                return {
                    success: false,
                    message: 'Controller is linked to another session.',
                    phase: 'stale_blocked',
                };
            }
        }
    }

    // ── PHASE 3: HANDSHAKING ─────────────────────────────────────────────────
    onPhaseChange?.('handshaking');

    // Clear any stale ack from a previous pairing attempt
    await remove(ref(rtdb, hwPath.pairAck(code)));

    // Write the pair request — ESP32 is watching this path
    await set(ref(rtdb, hwPath.pairRequest(code)), {
        hostId: userId,
        ts: Date.now(),
    });

    // ── PHASE 4: WAIT FOR ACK ────────────────────────────────────────────────
    // Returns a promise that resolves when ESP32 writes pairAck, or rejects on timeout.
    const ackReceived = await new Promise<boolean>((resolve) => {
        const ackRef = ref(rtdb, hwPath.pairAck(code));
        let settled = false;

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                off(ackRef, 'value', listener);
                resolve(false);
            }
        }, PAIR_ACK_TIMEOUT_MS);

        const listener = onValue(ackRef, (snap) => {
            if (!settled && snap.exists() && snap.val()?.confirmed === true) {
                settled = true;
                clearTimeout(timer);
                off(ackRef, 'value', listener);
                resolve(true);
            }
        });
    });

    if (!ackReceived) {
        // Clean up the dangling pairRequest so ESP32 doesn't act on it later
        await remove(ref(rtdb, hwPath.pairRequest(code)));
        onPhaseChange?.('timeout');
        return {
            success: false,
            message: 'Controller did not respond. Make sure it is on the same network and powered on.',
            phase: 'handshake_timeout',
        };
    }

    // ── PHASE 5: CONFIRMED ───────────────────────────────────────────────────
    onPhaseChange?.('confirmed');

    // Write/update Firestore record
    const firestoreData: HandheldDevice = {
        id: code,
        status: 'paired',
        hostId: userId,
        activeGameId: null,
        lastHeartbeat: Date.now(),
        linkedAt: Date.now(),
    };

    if (deviceSnap.exists()) {
        await updateDoc(deviceRef, { ...firestoreData, linkedAt: serverTimestamp() });
    } else {
        await setDoc(deviceRef, { ...firestoreData, linkedAt: serverTimestamp() });
    }

    // Update RTDB meta
    await update(ref(rtdb, `hardware/${code}/meta`), {
        status: 'paired',
        hostId: userId,
        controlMode: 'web' as ControlMode, // Default: web has control until game starts
        linkedAt: Date.now(),
    });

    // Push display update to ESP32 — it will show this on Nokia 5110
    await set(ref(rtdb, hwPath.display(code)), {
        line1: 'PAIRED',
        line2: userId.slice(0, 10).toUpperCase(),
        footer: 'WAITING...',
        ts: Date.now(),
    });

    // Save to session
    sessionStorage.setItem(HW_SESSION_KEY, code);

    return { success: true, message: 'Controller paired!', phase: 'confirmed' };
};

// ─────────────────────────────────────────────────────────────────────────────
// unpairHandheldDevice
// ─────────────────────────────────────────────────────────────────────────────
export const unpairHandheldDevice = async (
    code: string,
    userId: string,
): Promise<{ success: boolean; message: string }> => {
    try {
        if (!rtdb) return { success: false, message: 'Database not available.' };

        await updateDoc(doc(db, HW_COLLECTION, code), {
            status: 'waiting',
            hostId: null,
            activeGameId: null,
        });

        await update(ref(rtdb, `hardware/${code}/meta`), {
            status: 'waiting',
            hostId: null,
            controlMode: null,
            activeGameId: null,
        });

        // Clear display on device
        await set(ref(rtdb, hwPath.display(code)), {
            line1: 'UNLINKED',
            line2: '',
            footer: 'POWER OFF OK',
            ts: Date.now(),
        });

        sessionStorage.removeItem(HW_SESSION_KEY);
        sessionStorage.removeItem('BOX_HW_LAST_ACK_TS');

        return { success: true, message: 'Controller unlinked.' };
    } catch (e: unknown) {
        return { success: false, message: e instanceof Error ? e.message : 'Unlink failed.' };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// activateGameOnDevice
//
// Called by GameSetup when a game launches. Transfers control to hardware.
// ─────────────────────────────────────────────────────────────────────────────
export const activateGameOnDevice = async (
    code: string,
    gameId: string,
    teamAName: string,
    teamBName: string,
    initialControlMode: ControlMode = 'hardware',
): Promise<void> => {
    if (!rtdb) return;

    await update(ref(rtdb, `hardware/${code}/meta`), {
        status: 'active',
        activeGameId: gameId,
        controlMode: initialControlMode,
    });

    await updateDoc(doc(db, HW_COLLECTION, code), {
        status: 'active',
        activeGameId: gameId,
    });

    // Tell ESP32 game started
    await set(ref(rtdb, hwPath.display(code)), {
        line1: 'GAME ON',
        line2: `${teamAName.slice(0, 5)} v ${teamBName.slice(0, 4)}`.toUpperCase(),
        footer: 'YOU HAVE CTRL',
        ts: Date.now(),
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// setControlMode
//
// Web app calls this to switch between hardware / shared / web control.
// ─────────────────────────────────────────────────────────────────────────────
export const setControlMode = async (
    code: string,
    mode: ControlMode,
    teamAName?: string,
    teamBName?: string,
): Promise<void> => {
    if (!rtdb) return;

    await set(ref(rtdb, hwPath.controlMode(code)), mode);

    // Send contextual display update
    const footerMap: Record<ControlMode, string> = {
        hardware: 'ESP CONTROL',
        shared: 'SHARED CTRL',
        web: 'WEB CONTROL',
    };

    await set(ref(rtdb, hwPath.display(code)), {
        line1: mode === 'hardware' ? 'YOUR TURN' : mode === 'shared' ? 'SHARED' : 'WEB MODE',
        line2: teamAName && teamBName
            ? `${teamAName.slice(0, 5)} v ${teamBName.slice(0, 4)}`.toUpperCase()
            : '',
        footer: footerMap[mode],
        ts: Date.now(),
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// subscribeToControlMode
//
// Hook helper — subscribe to live control mode changes.
// Returns unsubscribe function.
// ─────────────────────────────────────────────────────────────────────────────
export const subscribeToControlMode = (
    code: string,
    cb: (mode: ControlMode) => void,
): (() => void) => {
    if (!rtdb) return () => { };
    const r = ref(rtdb, hwPath.controlMode(code));
    onValue(r, (snap) => {
        if (snap.exists()) cb(snap.val() as ControlMode);
    });
    return () => off(r);
};

// ─────────────────────────────────────────────────────────────────────────────
// subscribeToDeviceHeartbeat (FIXED)
//
// Uses local arrival timestamp for staleness — NOT snap.val() which is
// ESP32's millis() and has no relation to Date.now().
// ─────────────────────────────────────────────────────────────────────────────
export const subscribeToDeviceHeartbeat = (
    code: string,
    cb: (online: boolean, lastSeen: number) => void,
): (() => void) => {
    if (!rtdb) return () => { };
    const r = ref(rtdb, hwPath.heartbeat(code));
    const STALE_MS = 10_000;

    let staleness: ReturnType<typeof setInterval>;
    let lastLocalArrival = 0; // When we last heard from the device (local clock)

    onValue(r, (snap) => {
        if (!snap.exists()) { cb(false, 0); return; }

        // Ignore snap.val() — it's ESP32 millis(), not a Unix timestamp.
        // We only care that the value updated right now.
        lastLocalArrival = Date.now();

        clearInterval(staleness);
        cb(true, lastLocalArrival);

        // Re-check staleness every second using local time
        staleness = setInterval(() => {
            const isFresh = (Date.now() - lastLocalArrival) < STALE_MS;
            cb(isFresh, lastLocalArrival);
        }, 1_000);
    });

    return () => {
        off(r);
        clearInterval(staleness);
    };
};