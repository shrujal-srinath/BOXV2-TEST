// src/core/types/Manifest.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Sport Manifest Contract (v3 — with GameContext)
//
// CHANGE LOG:
//   v3: Added GameContext to all component prop interfaces. This provides team
//       names, colors, and game metadata to sport UI components WITHOUT polluting
//       the sport-specific TState. State stays pure (scores, fouls, game logic).
//       Context carries display metadata (team names, colors, game code, etc).
//
//   Breaking change: All sport manifest components now receive a `context` prop.
//   Migration: Add `context` to each component's props destructuring. Use
//   `context.teamA.name` instead of hardcoded "HOME" / "AWAY".
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { NormalizedResult, ScoringMode, BaseTeam } from './Game';

// ─── Game Context (metadata that lives outside sport state) ────────────────

/**
 * Universal game metadata available to all sport UI components.
 * This is the bridge between the generic game container (WallView, SpectatorView,
 * HostConsole) and the sport-specific UI components.
 *
 * Components should use this for display purposes (team names, colors, branding)
 * and NOT store this data in TState. TState is pure game logic.
 */
export interface GameContext {
    /** The game code (e.g. "A3K9") — useful for display/debug */
    gameCode: string;
    /** Team A metadata — name, color, overall score */
    teamA: BaseTeam;
    /** Team B metadata — name, color, overall score */
    teamB: BaseTeam;
    /** Sport label (e.g. "Basketball", "Badminton") — from manifest.label */
    sportLabel: string;
    /** Optional tournament name if this game is part of a tournament */
    tournamentName?: string;
    /** Optional court/venue identifier */
    court?: string;
}

// ─── Shared UI Component Props ─────────────────────────────────────────────

export interface SportComponentProps<TState, TAction> {
    gameId: string;
    state: TState;
    dispatch: (action: TAction) => void;
    /** Game metadata — team names, colors, etc. */
    context: GameContext;
    // Network awareness for the UI
    isOffline: boolean;
    syncQueueCount: number;
}

export interface SpectatorProps<TState> {
    state: TState;
    /** Game metadata — team names, colors, etc. */
    context: GameContext;
    // Read-only: Spectators cannot dispatch actions
}

export interface WallCardProps<TState> {
    state: TState;
    /** Game metadata — team names, colors, etc. */
    context: GameContext;
    // Read-only: TV displays cannot dispatch actions
}

// ─── The Sport Manifest Contract ───────────────────────────────────────────

/** Development status of a sport in the registry */
export type SportDevStatus = 'live' | 'beta' | 'under-development';

/** Props passed into every sport-specific setup page component */
export interface SportSetupPageProps {
    /** Called with the new game code after the game is created in Supabase */
    onLaunch: (gameCode: string) => void;
    /** Called when the user wants to go back to Dashboard */
    onBack: () => void;
}

/** Registry category — controls Dashboard placement */
export type SportCategory = 'core' | 'extended';

/**
 * THE SPORT MANIFEST CONTRACT
 * Every sport folder (e.g., src/sports/basketball/manifest.tsx) must export
 * this exact interface.
 */
export interface SportManifest<TState, TAction, TRules> {
    // 1. Metadata
    id: string;                  // Must match the folder name / DB sportId
    label: string;               // e.g., "Basketball"
    icon: string;                // Emoji icon for the sport card
    description: string;         // Short one-line description shown on sport card
    category: SportCategory;     // 'core' = always visible, 'extended' = "More Sports"
    accent: string;              // Tailwind bg class for the sport card accent strip
    devStatus: SportDevStatus;   // 'live' | 'beta' | 'under-development'
    scoringMode: ScoringMode;    // Tells the UI which scoring family this belongs to

    // 2. State & Logic Management (Redux Pattern)
    rules: TRules;               // Default rules for the sport
    createInitialState: (rules: TRules) => TState;
    reducer: (state: TState, action: TAction, rules: TRules) => TState;

    // 3. The Tournament Bridge
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

    // 6. Optional sport-specific setup page (replaces the generic GameSetup flow)
    setupPage?: React.FC<SportSetupPageProps>;
}