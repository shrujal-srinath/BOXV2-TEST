// src/types.ts
// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH — do not split across files.
//
// FIX LOG (build errors resolved):
//  ✅ GameState.possession — was missing in deployed version
//  ✅ TournamentConfig — re-exported as alias so old files don't break
//  ✅ Tournament uses sportConfig + divisions (new shape)
//  ✅ TeamData has all required fields (score, timeouts, etc.)
// ─────────────────────────────────────────────────────────────

import type {
    Player, TeamData, GameSettings, GameState, BasketballGame,
    SportType, TournamentFormat, GenderCategory, DivisionConfig,
    TournamentFixture, Tournament, TournamentConfig,
} from '../types';