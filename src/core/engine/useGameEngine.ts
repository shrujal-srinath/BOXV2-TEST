// src/core/engine/useGameEngine.ts

import { useReducer, useCallback, useEffect, useState } from 'react';
import { SportManifest } from '../types/Manifest';
import { Game, BaseGameState } from '../types/Game';

// ✅ UNCOMMENT THIS:
import { saveGameAction } from '../../services/hybridService';

export function useGameEngine<TState extends BaseGameState, TAction, TRules>(
    gameId: string,
    initialGame: Game<TState, TRules>,
    manifest: SportManifest<TState, TAction, TRules>,
    isAdmin: boolean = false
) {
    const [state, reactDispatch] = useReducer(
        (currentState: TState, action: TAction) => manifest.reducer(currentState, action, initialGame.rules),
        initialGame.state
    );

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [syncQueueCount, setSyncQueueCount] = useState(0);

    useEffect(() => {
        // ... offline listeners stay the same
    }, []);

    const dispatch = useCallback(
        (action: TAction) => {
            // 1. Snappy UI Update
            reactDispatch(action);

            // 2. Calculate next state
            const nextState = manifest.reducer(state, action, initialGame.rules);

            // 3. ✅ PUSH TO THE DATABASE AND OFFLINE QUEUE
            saveGameAction({
                ...initialGame,
                state: nextState,
                lastUpdate: Date.now()
            }).catch(err => console.error("Sync failed:", err));

            // 4. Tournament Bridge
            const result = manifest.normalizeResult(nextState, initialGame.rules);
            if (result.isComplete) {
                console.log(`[Tournament Bridge] Game ${gameId} complete! Winner: ${result.winner}`);
                // tournamentService.completeFixture(gameId, result);
            }
        },
        [state, manifest, initialGame, gameId]
    );

    const adminPatchState = useCallback(
        (patch: Partial<TState>) => {
            if (!isAdmin) return;

            const patchedState = { ...state, ...patch };

            // ✅ FORCE ADMIN OVERRIDE TO DATABASE
            console.warn(`[ADMIN OVERRIDE] Syncing patched state...`);
            saveGameAction({
                ...initialGame,
                state: patchedState,
                lastUpdate: Date.now()
            });
        },
        [isAdmin, manifest, state, initialGame, gameId]
    );

    return { state, dispatch, adminPatchState, isOffline, syncQueueCount };
}