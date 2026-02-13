// src/services/handheldService.ts
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface HandheldDevice {
    id: string; // The 4-digit code (e.g. "8821")
    status: 'waiting' | 'linked' | 'active';
    hostId: string | null;
    activeGameId: string | null;
    lastHeartbeat: number;
}

/**
 * Attempts to link an ESP32 Handheld Controller using its 4-digit code.
 * @param code The 4-digit code displayed on the Controller screen
 * @param userId The current user's ID
 * @returns boolean success status
 */
export const linkHandheldDevice = async (code: string, userId: string): Promise<{ success: boolean; message: string }> => {
    if (!code || code.length !== 4) {
        return { success: false, message: "Invalid code format" };
    }

    try {
        // We check the 'handheld_terminals' collection in Firestore
        const deviceRef = doc(db, 'handheld_terminals', code);
        const deviceSnap = await getDoc(deviceRef);

        if (!deviceSnap.exists()) {
            return { success: false, message: "Controller not found. Is it powered on?" };
        }

        const data = deviceSnap.data() as HandheldDevice;

        if (data.status === 'linked' && data.hostId !== userId) {
            return { success: false, message: "Controller is already linked to another user." };
        }

        // Perform the Link
        await updateDoc(deviceRef, {
            status: 'linked',
            hostId: userId,
            linkedAt: serverTimestamp()
        });

        // Store in Session Storage so the browser remembers we are connected
        sessionStorage.setItem('BOX_HANDHELD_ID', code);

        return { success: true, message: "Controller Linked Successfully" };

    } catch (error: any) {
        console.error("Handheld Link Error:", error);
        return { success: false, message: error.message || "Connection failed" };
    }
};

/**
 * Unlinks the current handheld controller
 */
export const unlinkHandheldDevice = async (code: string) => {
    try {
        const deviceRef = doc(db, 'handheld_terminals', code);
        await updateDoc(deviceRef, {
            status: 'waiting',
            hostId: null,
            activeGameId: null
        });
        sessionStorage.removeItem('BOX_HANDHELD_ID');
    } catch (error) {
        console.error("Unlink Error:", error);
    }
};