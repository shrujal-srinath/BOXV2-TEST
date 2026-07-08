# THE BOX — Codebase Guide (CLAUDE.md)

> Rewritten by Fable 5, promoted 2026-07-08. Deliberately lean: universal facts + commands +
> pointers. Deep material lives in referenced docs and loads only when relevant.

THE BOX is a multi-sport live-scoring + broadcasting platform: a host scores a game from the
dashboard, a tablet, a phone, or a physical Raspberry Pi referee box; spectators watch a live
TV-style scoreboard via a 6-digit code or QR. It also runs tournaments and post-game stats/
analytics. Live at https://theboxbybmsce.in (Vercel auto-deploys `main`).

This repo is one of four products sharing one Supabase backend (with the Courtside booking app
and the_box_app Flutter companion). **Cross-product truth — backend schema, realtime wire
contracts, the identity plan, the roadmap — lives in `fable-5/00-MASTER-CONTEXT.md`. Read it
before any work that touches Supabase, realtime events, auth, or the pi-daemon.**

## Stack

React 18 + TypeScript + Vite · Tailwind CSS · Supabase (auth + Postgres + Realtime + storage) ·
React Router v6 · PWA (vite-plugin-pwa) · pi-daemon: Node.js + Socket.io (runs on a Pi 4).

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # production build (run before considering UI work done)
npm test           # vitest — 160 golden tests (court law, engines, cards). CI-gated
# deploy = git push origin main (Vercel picks it up)

# pi-daemon (runs on the Pi, not in the browser):
cd pi-daemon && npm install && node index.js   # Socket.io on :3001
```

No test suite exists yet — verification is `npm run build` + manual flows.

## Architecture map

| Path | What lives there |
|---|---|
| `src/App.tsx` | All routing + PWA/standalone detection |
| `src/types.ts` | Canonical type definitions (single source of truth) |
| `src/pages/` | One file per route: `Dashboard`, `HostConsole`, `MobileScorer`/`ScorerHost` (phone/desktop split at `/host/:gameCode`), `SpectatorView`, `RefereeScreen` (Pi), `LanControlPage`, `GameStatsPage`, tournament pages |
| `src/hooks/useSupabaseBroadcast.ts` | The realtime clock/score engine (host broadcasts, spectators interpolate) |
| `src/services/` | `supabaseGameService` (game CRUD), `supabaseBroadcastService` (channels), `shotService` (shot_events + game_actions), `statsEngine` + `gameMode` + `exportService` (stats v2), `webrtcSync` (LAN Direct P2P), `authService` |
| `src/components/shotchart/` | Court canvas + zone law (`courtZones.ts` — see invariants) |
| `src/components/refereebox/` | Pi touchscreen UI incl. `PiAdvancedShotFlow` (court→player→context shot attribution) |
| `src/components/stats/` | Stats v2 hub (`StatsHub`, boxscore/, summary/, advanced/, export/) |
| `src/sports/registry.ts` | Sport manifest registry (full manifests: basketball, badminton) |
| `src/contexts/HardwareContext.tsx` | ESP32 handheld connection state |
| `pi-daemon/` | Hardware referee box daemon: serial (Pico buttons) → state machine → Socket.io `:3001` + Supabase sync. Known bug list: master context §3.3 |
| `supabase/migrations/` | THE BOX schema. ⚠️ Prod has drift — check master context §6.4 before assuming a migration is applied |

## The invariants (violating these causes silent damage — full detail in `fable-5/OPUS-GUIDANCE.md` §2)

1. **Two worlds:** tablet/Pi/kiosk routes (`/tablet/*`, `/referee`, `/tv`) never require auth
   and must work offline. Website routes (`/dashboard`, `/host`, `/tournament`) require auth.
2. **Coordinate law:** persisted shot coords are portrait half-court 0–100 × 0–94 (basket at
   50, 10.5), defined in `src/components/shotchart/courtZones.ts` and mirrored 1:1 in the
   Flutter app. Pi UI is landscape 188×100, team A attacks left; convert only via
   `portraitToLandscape`/`landscapeToPortrait`.
3. **Wire contracts span repos:** channel `game:{CODE}` events (`clock_tick`, `score_update`,
   `game_snapshot`, …) are consumed by this site, the pi-daemon, and the Flutter app. Never
   rename/reshape one end alone — grep all three repos.
4. **Game modes gate stats:** `GameSettings.gameMode = 'quick' | 'stats' | 'advanced'`
   (set in `GameSetup.tsx`, capabilities in `src/services/gameMode.ts`). All stats UI branches
   on mode; quick games have no stats and no exports.
5. **`shot_events` semantics:** one row per made shot; ref UNDO = row DELETE; daemon writes
   `made: true` only (miss logging doesn't exist yet).
6. **Schema changes:** always as a numbered file in `supabase/migrations/`, even when applied
   by hand in the SQL editor.

## Design system

Full spec (tokens, card/nav/input/wizard patterns, typography, PlayerIdCard): load
**`fable-5/DESIGN-SYSTEM-WEB.md`** for any UI work. The one-paragraph version: light mode is
professional sports SaaS (ESPN/NBA.com/Sofascore) — warm off-white `#F0EEE9` page, white cards
with soft shadows, `red-600` accents, section headers with a `border-l-4 border-red-600` bar;
dark mode on zinc-950/900. `src/pages/Dashboard.tsx` is the shell reference;
`src/pages/PlayerPassportPage.tsx` is the form/wizard reference. Structural icons are inline
SVG, never emoji.

## Database quick facts

Supabase project `eoowagimooxsqcrrihbw` (shared with Courtside + the_box_app — full inventory
in master context §6.1). Highest-traffic tables here: `games` (PK `code`, 4 chars, `data` JSONB
snapshot) · `shot_events` · `game_actions` · `player_profiles` (passport; `player_code`
`BOX-XXX-1234`, phone unique, photos in `player-avatars` bucket) · tournaments trio ·
`arena_sessions` · `coach_annotations`.

## Working docs (progressive disclosure — load when relevant)

- `fable-5/00-MASTER-CONTEXT.md` — the ecosystem: all four products, backend, identity plan,
  roadmap. **Read first in any new session.**
- `fable-5/OPUS-GUIDANCE.md` — how to work on these codebases (invariants, failure modes,
  session protocol).
- `fable-5/DESIGN-SYSTEM-WEB.md` — full website design system.
- `COMPANION-APP.md` — companion-app ecosystem: wire contracts, LAN Direct protocol, QR/deep-
  link URL space.
- `readme-files/STATS_V2_GAME_ANALYTICS.md` — the stats v2 spec (superseded where
  `fable-5/ADVANCED-STATS-MASTERPLAN.md` + `COURT-PIPELINE-DEEPDIVE.md` go deeper).
- `fable-5/EXECUTION-LADDER.md` — the ordered build queue; check before picking work.
- `fable-5/plans/` — execution-grade plans; PLAN-S1-WIRING is the queue head.

## Referee controller (Pi) quick map

`/referee` = the Pi touchscreen (operator-only, no auth, offline-capable). State comes from
pi-daemon over Socket.io :3001 (`useRefereeBox` mirrors it — the DAEMON is that surface's
engine; never move its rules into React). Advanced mode: physical score → `score_pending` →
`PiAdvancedShotFlow` (court→player→context) → `shot_attributed` → daemon persists. Court
math: landscape 188×100, A attacks LEFT; persist portrait via `landscapeToPortrait` ONLY.
The golden tests + `fable-5/COURT-PIPELINE-DEEPDIVE.md` are the law here. Theme variants
(PiTouchScoringScreen/LockedScoreboard ±Minimal) are intentional — never "dedupe" them.

## Conventions

- TypeScript throughout; match the existing file's style; Tailwind utility classes, no CSS
  files for new UI.
- New sports = extend `src/sports/registry.ts` with a manifest; don't fork scoring UIs.
- Prefer editing existing services over adding parallel ones — one write path per entity.
- Commit in reviewed slices the same session work is built; this repo has a history of large
  at-risk uncommitted trees.
