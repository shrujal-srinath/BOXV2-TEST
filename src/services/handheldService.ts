// src/services/handheldService.ts

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, rtdb } from './firebase';
import { ref, set } from 'firebase/database';

// ── Single source of truth for session key & collection name ──────
// Both useHardwareBridge.ts and ConnectControllerModal.tsx import
// from here — no more key mismatches.

export const HW_SESSION_KEY = 'BOX_HARDWARE_ID';
export const HW_COLLECTION = 'hardware_terminals';

// ── Types ─────────────────────────────────────────────────────────

export interface HandheldDevice {
    id: string;
    status: 'waiting' | 'linked' | 'active';
    hostId: string | null;
    activeGameId: string | null;
    lastHeartbeat: number;
    linkedAt?: number;
}

// ── linkHandheldDevice ────────────────────────────────────────────
// Called when user enters the 4-digit code on the website.
// Writes to Firestore so the ESP32 can poll and detect it was linked.

export const linkHandheldDevice = async (
    code: string,
    userId: string
): Promise<{ success: boolean; message: string }> => {
    if (!code || code.length !== 4) {
        return { success: false, message: 'Invalid code. Must be 4 digits.' };
    }

    try {
        const deviceRef = doc(db, HW_COLLECTION, code);
        const deviceSnap = await getDoc(deviceRef);

        if (!deviceSnap.exists()) {
            // Device not registered yet — create it fresh
            await setDoc(deviceRef, {
                id: code,
                status: 'linked',
                hostId: userId,
                activeGameId: null,
                lastHeartbeat: Date.now(),
                linkedAt: serverTimestamp(),
            });
        } else {
            const data = deviceSnap.data() as HandheldDevice;

            // Already linked to a different user
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
        }

        // Persist pairing to session storage so the bridge auto-connects on refresh
        sessionStorage.setItem(HW_SESSION_KEY, code);

        // Also write to RTDB so the ESP32 detects the link immediately
        if (rtdb) {
            await set(ref(rtdb, `hardware/${code}/meta`), {
                status: 'linked',
                hostId: userId,
                linkedAt: Date.now(),
            });
        }

        return { success: true, message: 'Controller linked!' };
    } catch (error: any) {
        console.error('[handheldService] Link error:', error);
        return { success: false, message: error.message || 'Connection failed.' };
    }
};

// ── unlinkHandheldDevice ──────────────────────────────────────────
// Called when user clicks "Unlink" in ConnectControllerModal.

export const unlinkHandheldDevice = async (code: string): Promise<void> => {
    try {
        const deviceRef = doc(db, HW_COLLECTION, code);
        await updateDoc(deviceRef, {
            status: 'waiting',
            hostId: null,
            activeGameId: null,
        });

        if (rtdb) {
            await set(ref(rtdb, `hardware/${code}/meta`), {
                status: 'waiting',
                hostId: null,
                linkedAt: null,
            });
        }
    } catch (error) {
        console.error('[handheldService] Unlink error:', error);
    } finally {
        // Always clear session even if the Firestore write fails
        sessionStorage.removeItem(HW_SESSION_KEY);
    }
};

// ── bindDeviceToGame ──────────────────────────────────────────────
// Call this when a game starts so the ESP32 knows which game it controls.

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