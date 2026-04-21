// src/hooks/useGenericPersistEngine.ts
// Sport-agnostic state persistence for non-basketball sports.
// Writes engineState directly to `data.state` + broadcasts scores.

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { broadcastScoreUpdate } from '../services/supabaseBroadcastService';

export const useGenericPersistEngine = (
    gameCode: string | null,
    engineState: Record<string, any>,
    enabled: boolean
) => {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevStateRef = useRef<string>('');

    const persist = useCallback(async () => {
        if (!gameCode || !enabled) return;

        const { data: row, error: readErr } = await supabase
            .from('games')
            .select('data')
            .eq('code', gameCode)
            .single();

        if (readErr || !row) return;

        const merged = {
            ...row.data,
            state: { ...(row.data.state ?? {}), ...engineState },
            teamA: { ...row.data.teamA, score: engineState.gamesWonA ?? engineState.setsWonA ?? engineState.scoreA ?? row.data.teamA?.score ?? 0 },
            teamB: { ...row.data.teamB, score: engineState.gamesWonB ?? engineState.setsWonB ?? engineState.scoreB ?? row.data.teamB?.score ?? 0 },
            lastUpdate: Date.now(),
        };

        const { error } = await supabase
            .from('games')
            .update({ data: merged, lastUpdate: Date.now() })
            .eq('code', gameCode);

        if (error) console.error('[useGenericPersistEngine] Write failed:', error.message);
    }, [gameCode, engineState, enabled]);

    const broadcastNow = useCallback(() => {
        if (!gameCode || !enabled) return;
        const scoreA = engineState.gamesWonA ?? engineState.setsWonA ?? engineState.scoreA ?? 0;
        const scoreB = engineState.gamesWonB ?? engineState.setsWonB ?? engineState.scoreB ?? 0;
        broadcastScoreUpdate(gameCode, scoreA, scoreB, 0, 0, 0, 0, 'A');
    }, [gameCode, engineState, enabled]);

    useEffect(() => {
        if (!enabled || !gameCode) return;

        const stateKey = JSON.stringify(engineState);
        if (stateKey === prevStateRef.current) return;
        prevStateRef.current = stateKey;

        broadcastNow();

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(persist, 300);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [engineState, enabled, gameCode, persist, broadcastNow]);
};
