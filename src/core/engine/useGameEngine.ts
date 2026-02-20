// src/core/engine/useGameEngine.ts
import { useReducer, useCallback, useEffect, useState } from 'react';
import { SportManifest } from '../types/Manifest';
// ✅ IMPORT BaseGameState here
import { Game, BaseGameState } from '../types/Game';

// We will connect these to your actual services in the next phase
// import { saveGameAction } from '../../services/hybridService'; 
// import { useSupabaseBroadcast } from '../../hooks/useSupabaseBroadcast';

// ✅ ADD 'extends BaseGameState' to TState
export function useGameEngine<TState extends BaseGameState, TAction, TRules>(
    gameId: string,
    initialGame: Game<TState, TRules>,
    manifest: SportManifest<TState, TAction, TRules>,
    isAdmin: boolean = false
) {
    // 1. THE CORE STATE (Powered by the Sport's Plugin Reducer)
    const [state, reactDispatch] = useReducer(
        (currentState: TState, action: TAction) => manifest.reducer(currentState, action, initialGame.rules),
        initialGame.state
    );

    // Network & Queue tracking
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [syncQueueCount, setSyncQueueCount] = useState(0);

    // 2. NETWORK AWARENESS
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 3. THE DISPATCH WRAPPER (Handles Reducer + Database Sync)
    const dispatch = useCallback(
        (action: TAction) => {
            // Step A: Update local React state instantly for snappy UI
            reactDispatch(action);

            // Step B: Calculate what the NEXT state looks like to send to DB
            const nextState = manifest.reducer(state, action, initialGame.rules);

            // Step C: Send the updated JSONB payload to your Hybrid Sync Service
            // saveGameAction({ ...initialGame, state: nextState });

            // Step D: Calculate if the Tournament Bracket needs updating
            const result = manifest.normalizeResult(nextState, initialGame.rules);
            if (result.isComplete) {
                console.log(`[Tournament Bridge] Game ${gameId} complete! Winner: ${result.winner}`);
                // tournamentService.completeFixture(gameId, result);
            }
        },
        [state, manifest, initialGame, gameId]
    );

    // 4. THE GOD MODE (Admin Override)
    const adminPatchState = useCallback(
        (patch: Partial<TState>) => {
            if (!isAdmin) {
                console.error("Unauthorized: Only admins can patch state directly.");
                return;
            }
            if (manifest.validateOverride && !manifest.validateOverride(state, patch)) {
                console.error("Patch rejected by sport validation rules.");
                return;
            }

            // Merge the patch bypassing the reducer logic
            const patchedState = { ...state, ...patch };

            // Force React update (Note: In a real app, you might need a special action for this)
            // For now, we simulate the merge syncing to DB
            console.warn(`[ADMIN OVERRIDE] State patched for game ${gameId}`, patch);
            // saveGameAction({ ...initialGame, state: patchedState });
        },
        [isAdmin, manifest, state, initialGame, gameId]
    );

    // Return the exact props needed by the SportComponentProps contract
    return {
        state,
        dispatch,
        adminPatchState,
        isOffline,
        syncQueueCount
    };
}