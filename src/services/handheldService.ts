// src/services/handheldService.ts

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, rtdb } from './firebase';
import { ref, set, remove, get } from 'firebase/database';

export const HW_SESSION_KEY = 'BOX_HARDWARE_ID';
export const HW_COLLECTION = 'hardware_terminals';

export interface HandheldDevice {
    id: string;
    status: 'waiting' | 'linked' | 'active';
    hostId: string | null;
    activeGameId: string | null;
    lastHeartbeat: number;
    linkedAt?: number;
}

// ── linkHandheldDevice ────────────────────────────────────────────

export const linkHandheldDevice = async (
    code: string,
    userId: string
): Promise<{ success: boolean; message: string }> => {
    if (!code || code.length !== 4) {
        return { success: false, message: 'Invalid code. Must be 4 digits.' };
    }

    try {
        // ── FIXED: Check RTDB for device existence, not Firestore ──
        // ESP32 self-registers in RTDB on boot via hardware/{code}/meta/registered
        // Firestore is never written by the ESP32, so checking it always fails
        if (!rtdb) {
            return { success: false, message: 'Database not available.' };
        }

        const registeredSnap = await get(ref(rtdb, `hardware/${code}/meta/registered`));
        if (!registeredSnap.exists() || registeredSnap.val() !== true) {
            return { success: false, message: 'Controller not found. Check the code on your device.' };
        }

        // Device is real — now handle Firestore record
        const deviceRef = doc(db, HW_COLLECTION, code);
        const deviceSnap = await getDoc(deviceRef);

        if (deviceSnap.exists()) {
            const data = deviceSnap.data() as HandheldDevice;

            // Block if actively linked to someone else
            if (data.status === 'linked' && data.hostId && data.hostId !== userId) {
                const staleSince = Date.now() - (data.lastHeartbeat || 0);
                if (staleSince < 30_000) {
                    return { success: false, message: 'Controller is linked to another session.' };
                }
            }

            await updateDoc(deviceRef, {
                status: 'linked',
                hostId: userId,
                linkedAt: serverTimestamp(),
            });

        } else {
            // First time this device has been linked — create the Firestore record
            await setDoc(deviceRef, {
                id: code,
                status: 'linked',
                hostId: userId,
                activeGameId: null,
                lastHeartbeat: Date.now(),
                linkedAt: serverTimestamp(),
            });
        }

        // Persist to session so bridge auto-connects on refresh
        sessionStorage.setItem(HW_SESSION_KEY, code);

        // Tell ESP32 it has been linked via RTDB
        await set(ref(rtdb, `hardware/${code}/meta`), {
            registered: true,
            status: 'linked',
            hostId: userId,
            linkedAt: Date.now(),
        });

        return { success: true, message: 'Controller linked!' };

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Connection failed.';
        console.error('[handheldService] Link error:', error);
        return { success: false, message: msg };
    }
};

// ── unlinkHandheldDevice ──────────────────────────────────────────

export const unlinkHandheldDevice = async (code: string): Promise<void> => {
    try {
        const deviceRef = doc(db, HW_COLLECTION, code);
        await updateDoc(deviceRef, {
            status: 'waiting',
            hostId: null,
            activeGameId: null,
        });

        if (rtdb) {
            // Keep registered:true so the device can be re-paired
            // but reset everything else
            await set(ref(rtdb, `hardware/${code}/meta`), {
                registered: true,
                status: 'waiting',
                hostId: null,
                linkedAt: null,
            });

            // Clear stale nodes — prevents false isConnected on next session
            await remove(ref(rtdb, `hardware/${code}/heartbeat`));
            await remove(ref(rtdb, `hardware/${code}/input`));
            await set(ref(rtdb, `hardware/${code}/display`), {
                line1: 'READY',
                line2: 'TO PAIR',
                footer: 'IDLE',
                ts: Date.now(),
            });
        }

    } catch (error) {
        console.error('[handheldService] Unlink error:', error);
    } finally {
        sessionStorage.removeItem(HW_SESSION_KEY);
    }
};

// ── bindDeviceToGame ──────────────────────────────────────────────

export const bindDeviceToGame = async (
    code: string,
    gameId: string
): Promise<void> => {
    try {
        await updateDoc(doc(db, HW_COLLECTION, code), { activeGameId: gameId });
        if (rtdb) {
            await set(ref(rtdb, `hardware/${code}/meta/activeGameId`), gameId);
        }
    } catch (error) {
        console.error('[handheldService] Bind to game error:', error);
    }
};