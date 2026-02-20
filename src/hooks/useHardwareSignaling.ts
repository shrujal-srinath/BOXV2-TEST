// src/hooks/useHardwareSignaling.ts
import { useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { HardwareSignal } from '../core/types/Hardware';

/**
 * High-performance hook to listen for ESP32 hardware signals 
 * via Supabase Realtime Broadcast.
 */
export function useHardwareSignaling(
    gameId: string,
    onSignal: (signal: HardwareSignal) => void
) {
    useEffect(() => {
        if (!gameId) return;

        // Join the dedicated hardware channel for this game
        const channel = supabase.channel(`hw-${gameId}`, {
            config: { broadcast: { self: false, ack: false } }
        });

        channel
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                // High-speed execution: pass signal directly to the engine
                onSignal(payload as HardwareSignal);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[Hardware Bridge] Listening for signals on game: ${gameId}`);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [gameId, onSignal]);

    /**
     * Helper to send signals BACK to the handheld (e.g., to vibrate or update LED)
     */
    const sendToHardware = useCallback(async (event: string, data: any) => {
        const channel = supabase.channel(`hw-${gameId}`);
        await channel.send({
            type: 'broadcast',
            event: 'feedback',
            payload: { event, data, timestamp: Date.now() }
        });
    }, [gameId]);

    return { sendToHardware };
}