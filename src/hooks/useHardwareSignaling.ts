// src/hooks/useHardwareSignaling.ts — v2.3
// FIX: Stable ref pattern prevents stale closure bug where onSignal
// always ran with first-render state (controlMode never updated).
import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { HardwareSignal } from '../core/types/Hardware';

export function useHardwareSignaling(
    gameId: string,
    onSignal: (signal: HardwareSignal) => void
) {
    const cbRef = useRef(onSignal);
    useEffect(() => { cbRef.current = onSignal; }, [onSignal]);

    useEffect(() => {
        if (!gameId) return;
        console.log(`[HW] Subscribing to hw-${gameId}`);
        const channel = supabase.channel(`hw-${gameId}`, {
            config: { broadcast: { self: false, ack: false } },
        });
        channel
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                console.log('[HW] Signal:', payload?.action);
                cbRef.current(payload as HardwareSignal);
            })
            .subscribe((status) => {
                console.log(`[HW] hw-${gameId}: ${status}`);
            });
        return () => { supabase.removeChannel(channel); };
    }, [gameId]); // Only re-subscribe on gameId change

    const sendToHardware = useCallback(async (payload: any) => {
        if (!gameId) return;
        try {
            const ch = supabase.channel(`hw-${gameId}`);
            await ch.send({
                type: 'broadcast', event: 'feedback',
                payload: { ...payload, timestamp: Date.now() }
            });
        } catch (e) { console.warn('[HW] sendToHardware:', e); }
    }, [gameId]);

    return { sendToHardware };
}