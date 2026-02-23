// src/hooks/useHardwareSignaling.ts
//
// THE BOX — Hardware Signal Listener
// BMSCE Sports Tech Division
//
// FIX v2: Uses a ref to hold the latest onSignal callback so the Supabase
// channel subscription is created ONCE and never recreated on re-renders.
// Previous version had a stale closure bug where the callback always ran
// from the first render, missing updated controlMode / dispatch references.

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { HardwareSignal } from '../core/types/Hardware';

export function useHardwareSignaling(
    gameId: string,
    onSignal: (signal: HardwareSignal) => void
) {
    // ── Stable ref: always holds the LATEST onSignal without re-subscribing ──
    const onSignalRef = useRef(onSignal);
    useEffect(() => {
        onSignalRef.current = onSignal;
    }, [onSignal]);

    useEffect(() => {
        if (!gameId) return;

        console.log(`[HW Signal] Subscribing to hw-${gameId}`);

        const channel = supabase.channel(`hw-${gameId}`, {
            config: {
                broadcast: { self: false, ack: false },
            },
        });

        channel
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                console.log('[HW Signal] Received:', payload);
                // Always call the LATEST version of the callback via ref
                onSignalRef.current(payload as HardwareSignal);
            })
            .subscribe((status) => {
                console.log(`[HW Signal] Channel status: ${status}`);
            });

        return () => {
            console.log(`[HW Signal] Unsubscribing from hw-${gameId}`);
            supabase.removeChannel(channel);
        };
        // Only re-subscribe if gameId changes — NOT when onSignal changes
    }, [gameId]);

    // ── Send feedback/state back to the ESP32 display ─────────────────────────
    // Used when web scores in shared mode so ESP32 display stays in sync
    const sendToHardware = useCallback(async (event: string, data: any) => {
        if (!gameId) return;

        const channel = supabase.channel(`hw-${gameId}`);
        try {
            await channel.send({
                type: 'broadcast',
                event: 'feedback',
                payload: { event, data, timestamp: Date.now() },
            });
        } catch (err) {
            console.warn('[HW Signal] sendToHardware failed:', err);
        }
    }, [gameId]);

    return { sendToHardware };
}