// src/services/handheldService.ts
//
// FIX: HW_SESSION_KEY was 'BOX_HARDWARE_ID' here but Dashboard.tsx was reading
//      'BOX_HANDHELD_ID' — controller always showed disconnected on the dashboard.
//      Unified to 'BOX_HARDWARE_ID' everywhere.
//
// ALSO: Added unlinkHandheldDevice export (was missing from original, caused
//       TypeScript errors in ConnectControllerModal on the disconnect flow).

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, rtdb } from './firebase';
import { ref, set, remove, get } from 'firebase/database';

// ─── UNIFIED SESSION KEY ──────────────────────────────────────────
// ⚠️ THIS MUST MATCH EVERYWHERE: handheldService, Dashboard, ConnectControllerModal
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
        return { success: false, message: 'Invalid code. Must be 4 characters.' };
    }

    try {
        if (!rtdb) {
            return { success: false, message: 'Database not available.' };
        }

        // ESP32 self-registers in RTDB on boot via hardware/{code}/registered
        const registeredSnap = await get(ref(rtdb, `hardware/${code}/registered`));
        if (!registeredSnap.exists() || registeredSnap.val() !== true) {
            return { success: false, message: 'Controller not found. Check the code on your device.' };
        }

        // Device is real — now handle Firestore record
        const deviceRef = doc(db, HW_COLLECTION, code);
        const deviceSnap = await getDoc(deviceRef);

        if (deviceSnap.exists()) {
            const data = deviceSnap.data() as HandheldDevice;

            // Block if actively linked to someone else (with staleness check)
            if (data.status === 'linked' && data.hostId && data.hostId !== userId) {
                const staleSince = Date.now() - (data.lastHeartbeat || 0);
                if (staleSince < 30_000) {
                    return { success: false, message: 'Controller is linked to another session.' };
                }
                // Stale link — take it over
            }

            await updateDoc(deviceRef, {
                status: 'linked',
                hostId: userId,
                linkedAt: serverTimestamp(),
                lastHeartbeat: Date.now(),
            });
        } else {
            // First time — create Firestore record
            await setDoc(deviceRef, {
                id: code,
                status: 'linked',
                hostId: userId,
                activeGameId: null,
                lastHeartbeat: Date.now(),
                linkedAt: serverTimestamp(),
            });
        }

        // Persist code to session storage (unified key)
        sessionStorage.setItem(HW_SESSION_KEY, code);

        // Tell ESP32 it has been linked via RTDB
        await set(ref(rtdb, `hardware/${code}/meta/status`), 'linked');
        await set(ref(rtdb, `hardware/${code}/meta/hostId`), userId);
        await set(ref(rtdb, `hardware/${code}/meta/linkedAt`), Date.now());

        return { success: true, message: 'Controller linked!' };

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Connection failed.';
        console.error('[handheldService] linkHandheldDevice error:', error);
        return { success: false, message: msg };
    }
};

// ── unlinkHandheldDevice ──────────────────────────────────────────

export const unlinkHandheldDevice = async (
    code: string,
    userId: string
): Promise<{ success: boolean; message: string }> => {
    try {
        if (!rtdb) {
            return { success: false, message: 'Database not available.' };
        }

        // Update Firestore
        const deviceRef = doc(db, HW_COLLECTION, code);
        await updateDoc(deviceRef, {
            status: 'waiting',
            hostId: null,
            activeGameId: null,
        });

        // Tell ESP32 it's unlinked via RTDB
        await set(ref(rtdb, `hardware/${code}/meta/status`), 'waiting');
        await set(ref(rtdb, `hardware/${code}/meta/hostId`), null);

        // Clear session
        sessionStorage.removeItem(HW_SESSION_KEY);
        sessionStorage.removeItem('BOX_HW_LAST_ACK_TS'); // Also clear ack timestamp

        return { success: true, message: 'Controller unlinked.' };

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unlink failed.';
        console.error('[handheldService] unlinkHandheldDevice error:', error);
        return { success: false, message: msg };
    }
};