// src/core/types/Manifest.ts
import React from 'react';
import { NormalizedResult, ScoringMode } from './Game';

// --- Shared UI Component Props ---

export interface SportComponentProps<TState, TAction> {
    gameId: string;
    state: TState;
    dispatch: (action: TAction) => void;
    // Network awareness for the UI
    isOffline: boolean;
    syncQueueCount: number;
}

export interface SpectatorProps<TState> {
    state: TState;
    // Read-only: Spectators cannot dispatch actions
}

export interface WallCardProps<TState> {
    state: TState;
    // Read-only: TV displays cannot dispatch actions
}

/**
 * THE SPORT MANIFEST CONTRACT
 * Every sport folder (e.g., src/sports/basketball/index.ts) must export this exact interface.
 */
export interface SportManifest<TState, TAction, TRules> {
    // 1. Metadata
    id: string;                  // Must match the folder name / DB sportId (e.g., 'basketball')
    label: string;               // e.g., "Basketball"
    scoringMode: ScoringMode;    // Tells the UI which family this belongs to

    // 2. State & Logic Management (Redux Pattern)
    rules: TRules;               // Default rules for the sport
    createInitialState: (rules: TRules) => TState;
    reducer: (state: TState, action: TAction, rules: TRules) => TState;

    // 3. The Tournament Bridge
    // Translates the complex TState into the simple NormalizedResult
    normalizeResult: (state: TState, rules: TRules) => NormalizedResult;

    // 4. Admin Overrides (The God Mode)
    canAdminOverride: boolean;
    validateOverride?: (currentState: TState, patch: Partial<TState>) => boolean;

    // 5. The UI Components
    components: {
        TabletController: React.FC<SportComponentProps<TState, TAction>>;
        HostConsole: React.FC<SportComponentProps<TState, TAction>>;
        WallCard: React.FC<WallCardProps<TState>>;
        SpectatorView: React.FC<SpectatorProps<TState>>;
    };
}