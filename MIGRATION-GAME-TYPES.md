# GAME TYPES MIGRATION TRACKER (Mission 1)

**Goal:** Remove `BasketballGame` from all files and replace with generic `Game<TState, TRules>`.

## Phase 1: Validation Layer (COMPLETED)
- [x] `src/validation/gameSchema.ts` (Created Zod Schemas)
- [x] `src/services/supabaseGameService.ts` (Added Validation Interceptors)
- [x] `src/types.ts` (Marked `BasketballGame` as `@deprecated`)

## Phase 2: Generic Type Adapters & UI Migration (IN PROGRESS)
- [x] `src/adapters/basketballAdapter.ts` (Created Generic ↔ Legacy bridge)
- [x] `src/pages/Dashboard.tsx` (Migrated list view to `Game<any, any>`)
- [ ] `src/hooks/usePersistEngine.ts` (Migrate)

## Pending Files (Next Phases)
- [ ] `src/pages/HostConsole.tsx`
- [ ] `src/pages/SpectatorView.tsx`
- [ ] `src/hooks/useLocalGame.ts`
- [ ] `src/services/hybridService.ts`
- [ ] `src/services/tournamentService.ts`
- [ ] Remove `BasketballGame` and legacy code entirely
