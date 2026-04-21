// src/sports/registry.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BOX — Sport Registry
//
// CORE_SPORTS   — always shown on Dashboard (top-level sport cards)
// EXTENDED_SPORTS — shown under "More Sports" collapsible section
//
// To add a new sport:
//   1. Create src/sports/<id>/manifest.tsx implementing SportManifest
//   2. Import and add to SPORT_REGISTRY below
//   3. Add the id to SchedulableSport in src/types.ts
//   4. Set category: 'core' or 'extended' in the manifest
// ─────────────────────────────────────────────────────────────────────────────

import { SportManifest } from '../core/types/Manifest';

// ── Core sports (live / beta) ─────────────────────────────────────────────
import { basketballManifest } from './basketball/manifest';
import { badmintonManifest } from './badminton/manifest';
import { volleyballManifest } from './volleyball/manifest';
import { kabaddiManifest } from './kabaddi/manifest';
import { tabletennisManifest } from './tabletennis/manifest';
import { generalManifest } from './general/manifest';

// ── Extended sports (under-development) ───────────────────────────────────
import { cricketManifest } from './cricket/manifest';
import { footballManifest } from './football/manifest';
import { hockeyManifest } from './hockey/manifest';
import { khokhoManifest } from './khokho/manifest';
import { netballManifest } from './netball/manifest';
import { tennisManifest } from './tennis/manifest';
import { handballManifest } from './handball/manifest';
import { throwballManifest } from './throwball/manifest';
import { chessManifest } from './chess/manifest';
import { carromManifest } from './carrom/manifest';
import { athleticsManifest } from './athletics/manifest';

// We cast to `any` here strictly for the dictionary mapping because each sport
// has unique Action/State types. The `useGameEngine` hook restores type safety.
export const SPORT_REGISTRY: Record<string, SportManifest<any, any, any>> = {
    // Core
    basketball: basketballManifest,
    badminton: badmintonManifest,
    volleyball: volleyballManifest,
    kabaddi: kabaddiManifest,
    tabletennis: tabletennisManifest,
    general: generalManifest,
    // Extended
    cricket: cricketManifest,
    football: footballManifest,
    hockey: hockeyManifest,
    khokho: khokhoManifest,
    netball: netballManifest,
    tennis: tennisManifest,
    handball: handballManifest,
    throwball: throwballManifest,
    chess: chessManifest,
    carrom: carromManifest,
    athletics: athleticsManifest,
};

/** Sport IDs shown as primary cards on the Dashboard */
export const CORE_SPORTS = ['basketball', 'badminton', 'volleyball', 'kabaddi', 'tabletennis', 'general'] as const;

/** Sport IDs shown under "More Sports" on the Dashboard */
export const EXTENDED_SPORTS = ['cricket', 'football', 'hockey', 'khokho', 'netball', 'tennis', 'handball', 'throwball', 'chess', 'carrom', 'athletics'] as const;

export type CoreSport = typeof CORE_SPORTS[number];
export type ExtendedSport = typeof EXTENDED_SPORTS[number];

// Strongly typed list of all registered sport IDs
export type SupportedSport = keyof typeof SPORT_REGISTRY;

export const isSportSupported = (sportId: string): sportId is SupportedSport => {
    return sportId in SPORT_REGISTRY;
};
