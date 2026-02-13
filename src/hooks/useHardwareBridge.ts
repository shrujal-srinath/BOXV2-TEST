import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface HardwareState {
    isConnected: boolean;
    hardwareId: string | null;
    lastInput: {
        button: string; // 'A', 'B', 'C', etc.
        timestamp: number;
        handled: boolean;
    } | null;
}

export const useHardwareBridge = () => {
    const [hwState, setHwState] = useState<HardwareState>({
        isConnected: false,
        hardwareId: null,
        lastInput: null
    });

    // 1. Initialize Connection on Mount
    useEffect(() => {
        const storedId = sessionStorage.getItem('BOX_HARDWARE_ID');

        if (!storedId) {
            setHwState(prev => ({ ...prev, isConnected: false, hardwareId: null }));
            return;
        }

        console.log(`[HardwareBridge] Listening to device: ${storedId}`);
        setHwState(prev => ({ ...prev, hardwareId: storedId }));

        // 2. Real-time Subscription to Hardware Status
        const unsub = onSnapshot(doc(db, 'hardware_terminals', storedId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setHwState(prev => ({
                    ...prev,
                    isConnected: data.status === 'linked' || data.status === 'active',
                    lastInput: data.lastInput || null
                }));
            } else {
                // Device document deleted? Unlink.
                sessionStorage.removeItem('BOX_HARDWARE_ID');
                setHwState({ isConnected: false, hardwareId: null, lastInput: null });
            }
        });

        return () => unsub();
    }, []);

    // 3. The "Mirror" Function (Sends Text to ESP32 Screen)
    // We use a debounce to prevent flooding Firestore while typing
    const updateScreen = useCallback(async (line1: string, line2: string, footer: string) => {
        const storedId = sessionStorage.getItem('BOX_HARDWARE_ID');
        if (!storedId) return;

        try {
            await updateDoc(doc(db, 'hardware_terminals', storedId), {
                displayOverride: {
                    line1: line1.substring(0, 10).toUpperCase(), // Nokia line limit approx 10 chars big text
                    line2: line2.substring(0, 10).toUpperCase(),
                    footer: footer.substring(0, 14).toUpperCase(),
                    timestamp: Date.now()
                }
            });
        } catch (err) {
            console.error("[HardwareBridge] Failed to update screen:", err);
        }
    }, []);

    // 4. Mark Input as Handled (So we don't process button presses twice)
    const ackInput = useCallback(async () => {
        const storedId = sessionStorage.getItem('BOX_HARDWARE_ID');
        if (!storedId) return;

        await updateDoc(doc(db, 'hardware_terminals', storedId), {
            'lastInput.handled': true
        });
    }, []);

    return {
        isConnected: hwState.isConnected,
        hardwareId: hwState.hardwareId,
        lastInput: hwState.lastInput,
        updateScreen,
        ackInput
    };
};