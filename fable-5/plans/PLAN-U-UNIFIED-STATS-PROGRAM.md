# PLAN U — The Unified Stats Program

> Fable 5, 2026-07-08. The consolidation plan for Shrujal's four asks: (U1) one hex engine,
> two surface UIs · (U2) the automatic after-game stats engine · (U3) export/share at 100/100
> design quality · (U4) everything persisting per player + per team, in harmony.
> Builds ON: `ADVANCED-STATS-MASTERPLAN.md` (S-phases), `COURT-PIPELINE-DEEPDIVE.md`
> (engineering truth), `PLAN-S1-WIRING.md`, master context §7/§8 (identity + cross-app).
> Decisions locked 2026-07-08 (Shrujal): save-all-now/link-when-known · auto-persist on host
> device + auto-DELIVER to linked accounts (BOX website now, Courtside bridge later) + export
> stays an explicit button · real `teams` table · Pi visuals live in GameReviewScreen.

---

## U1 — One hex engine, two surface experiences

**Today:** `hexbinEngine.ts` (portrait, analytics — powers HexShotChart + heat card) and
`CourtGeometry.ts` (landscape grid math — powers the Pi's LIVE HexLayer) are separate systems;
~9 components across 3 families roll their own hex rendering (PLAN-R flagged this).

**Target:** `src/shared/court/hex/` — ONE core, surface adapters, several renderers:
1. `core.ts` — grid math (pointy-top spacing, `hexPath`, `hexVertices`), binning
   (`buildHexbins` moves here), aggregation types. Pure, golden-tested (tests already exist —
   they move with it).
2. `landscape.ts` — the adapter: `binsToLandscape(bins, side)` maps portrait bin centers
   through `portraitToLandscape` so the SAME aggregation renders on the Pi's 188×100 full
   court (team A left, B right). NO re-binning in landscape — bin once in portrait (the
   persisted space), transform for display. This is the unification law.
3. Renderers keep their own UX (deliberately different):
   - **Web `HexShotChart`** (shipped) — light/dark SaaS card, bloom entrance, tooltip,
     player rail. Refactor its imports to the shared core; zero visual change.
   - **Pi `ReviewHexChart`** (new) — landscape full-court, dark FUI language, BOTH teams at
     once on their attacking halves, touch-first: tap a hex → side readout (no hover on
     touchscreens), big segmented controls (≥56px), team color coding. Entrance: hexes sweep
     outward from each rim simultaneously.
     **CORRECTION (2026-07-08, verified in code):** `GameReviewScreen` is the PRE-MATCH
     go/no-go checklist, NOT post-game. The Pi's post-game surface is `PostGameScreen`
     (RefereeScreen `case 'post_game'`, fed by `finalScore` incl. gameCode/mode/colors).
     P4 therefore = new full-screen **`PiMatchReport`** reached via a "MATCH REPORT" button
     on PostGameScreen (hidden for quick games / missing code): left rail = final score +
     highlights + QR to the web stats hub + NEW GAME; content tabs (≥56px) = SHOT MAP
     (ReviewHexChart + tap readout + team filter) / OVERVIEW (quarters, special points,
     Four Factors) / PLAYERS (PTS-sorted, GmSc). Data: getGameByCode + getShotsForGame +
     getActionsForGame → buildGameReport client-side; graceful offline/quick/empty states
     (score + QR always render). Volume-mode automatically when !hasMisses.
   - The LIVE HexLayer stays as-is (operator tool, not analytics) — it may consume `core.ts`
     grid math but keeps its arc-split/tap pipeline untouched (S1-wiring territory).
4. Deletion pass: after both renderers sit on the core, retire duplicate hex math in
   `AdvancedCourtHex`/`CourtHexMap` per PLAN-R Phase 8 (visual before/after screenshots).

**Order:** core extraction (move, don't rewrite — tests prove identity) → Pi ReviewHexChart →
dedup pass. Depends on nothing; can start immediately.

## U2 — The automatic after-game engine (v2 of gameReport)

**Today:** `buildGameReport()` computes everything on demand; nothing persists; nothing runs
automatically.

**A. New derived stats (all computable from CURRENT capture — no new buttons):**
| Stat | Formula (established) | Level |
|---|---|---|
| Game Score (Hollinger) | PTS + 0.4·FGM − 0.7·FGA − 0.4·(FTA−FTM) + 0.7·ORB + 0.3·DRB + STL + 0.7·AST + 0.7·BLK − 0.4·PF − TOV | player |
| PIE (impact estimate) | player line sum ÷ both-teams line sum (NBA formula) | player |
| Possessions (est.) | FGA + 0.44·FTA − ORB + TOV | team |
| Four Factors | eFG% · TOV% (TOV/poss) · ORB% (ORB/(ORB+oppDRB)) · FT rate (FTA/FGA) | team |
| Off/Def Rating | 100·PTS/poss · 100·oppPTS/poss | team |
| AST/TO, points per shot, assisted-FGM % | direct | both |
| BLOCKED (needs substitution tracking, S8): minutes, +/-, usage rate, per-36 | — | note in UI as "coming with lineup tracking" — never fake |
Add as `report.advanced` (+ per-player in packages), golden-tested with hand-computed cases.
Capability-gate: Four Factors need rebounds+turnovers tracked (`stats`/`advanced` modes).

**B. Auto-persistence + delivery pipeline (the "engine that runs after each game"):**
1. `persistGameReport(report)` in a new `services/statsPersistService.ts`: idempotent upserts
   (unique on `(game_code, roster_player_id)` / `(game_code, side)`) into the U4 tables.
2. Triggers: (a) web host `end_game` path and (b) Pi daemon `end_game` (daemon calls the same
   REST upserts — mirror of `writeShotEvent` pattern); (c) **lazy backfill** — GameStatsPage
   checks `stats_generated_at` on load and backfills if missing (covers crashed hosts,
   historical games).
3. **Delivery:** rows written WITH `player_profile_id` (linked players) are instantly visible
   in that player's BOX profile (career queries filter on it). Courtside sees them later via
   the master-context §8 union view — persistence shape here is designed for that view (no
   rework). Unlinked rows wait with `player_profile_id = NULL`.
4. Graph auto-generation: the StatsHub/GameReview/exports all render FROM the persisted
   report where present (recompute only when events changed — compare `computed_at` vs last
   shot `created_at`).

## U3 — Export & share at 100/100

**Today:** 7 card templates + CSV/JSON/PDF/print. Solid engine; composer UX is functional,
not delightful; PDF is utilitarian.

**The gap list to 100/100 (each is a checklist item, not vibes):**
1. **Composer experience:** live-size preview with format-true device frame (story preview in
   a phone silhouette); template rail with THUMBNAILS (mini-renders, not text chips);
   crossfade between template previews (150ms); per-card STAT-PICKER (bounded: choose the
   3 trio stats from a whitelist); drag-to-reorder blocks where blocks exist; sticky
   share/download bar with progress state on export; success toast with the filename.
2. **Card additions:** career card + milestone auto-badges ("SEASON HIGH") — post-U4;
   team Four-Factors card (coach share) — post-U2A; all cards get the stat-picker.
3. **PDF v2:** embed the hexmap SVG + Game Story highlights into the branded print doc;
   per-player one-pagers (line + zones + quality + hexmap) — the coach handout.
4. **The design bar (applies to U1 Pi renderer + U3 composer + all panels):**
   - every interactive element: hover, active (scale 0.97), focus-visible ring, disabled state
   - entrances staggered ≤400ms total; exits 150ms; `prefers-reduced-motion` everywhere
   - touch targets ≥44px web, ≥56px Pi; tabular-nums on all numerals
   - light+dark verified per CLAUDE.md tokens; Pi surfaces per Pi tokens (never mixed)
   - empty/loading/error state designed for every data surface (no blank whites)
   - **the loop:** every new surface gets a Claude Design pass (use
     `DESIGN-BRIEF-shot-experience.md` as the system prompt companion) + a screenshot review
     with Shrujal before "done". Nothing ships on build-green alone.

## U4 — Persistence schema + harmony (migration 014)

**Audit findings:** `player_game_log.player_id` is `NOT NULL REFERENCES player_profiles` —
wrong for save-all-now (95% of roster players are unlinked). `player_sport_stats` is a
counter-cache (drift-prone). No team entity exists.

**Migration `014_stats_persistence.sql` (additive; old tables untouched until backfilled):**
```sql
teams (id uuid PK, name text, short_code text, color text, logo_url text,
       created_by uuid → auth.users, created_at; UNIQUE(created_by, name))
game_player_stats (id PK, game_code text, sport_id text default 'basketball',
       roster_player_id text NOT NULL,           -- per-game roster id (always known)
       player_profile_id uuid NULL → player_profiles,  -- linked now or retro-filled
       team_side text, team_id uuid NULL → teams, team_name text,
       line jsonb NOT NULL,        -- BoxScoreRow + gameScore/PIE
       zones jsonb, quality jsonb, attributes jsonb, periods jsonb,
       computed_at timestamptz, UNIQUE(game_code, roster_player_id))
game_team_stats (game_code, side, team_id NULL, team_name, totals jsonb,
       special jsonb, four_factors jsonb, ratings jsonb, result jsonb,
       computed_at, UNIQUE(game_code, side))
games + stats_generated_at timestamptz  -- backfill check, cheap
```
RLS: public SELECT (matches shot_events); writes via authenticated host + daemon service key.
Career reads: SQL views `v_player_career(profile_id → per-sport aggregates + last-5 form)` and
`v_team_career(team_id)` — computed on read (correct by construction); materialize later only
if slow. `player_sport_stats`/`player_game_log` become legacy: keep for the app's Coach Mode
reads, backfill-migrate in a later pass, don't dual-write.

**Roster→profile linking (the capture step, masterplan §8.2):** GameSetup roster editor gets
"link player" — search player_profiles by name/player_code/PHONE (his unique-id ask); store
`profileId` on the roster Player object inside games.data (additive field — JSONB shape
grows, never changes). `persistGameReport` copies it into `player_profile_id`. Retro-link:
when a passport is claimed (PLAN-A §7), future games link automatically; historical rows
update only where games.data carried the profileId.

**Team pages + player career UI:** after persistence flows, `/player/:id/season` (exists,
stub-fed) reads `v_player_career`; new `/team/:id` page (record, four-factors trend, roster,
H2H) — design pass required per U3.4.

## Phasing (sessions; respects existing plans)

| # | What | Depends on |
|---|---|---|
| P1 | U2A derived stats in gameReport + goldens — **✅ DONE same day (Fable)**: gameScore/PIE/possessions/Four Factors/ratings + goldens, 157 green | — |
| P2 | U1 core extraction + web refactor onto it | — |
| P3 | ~~persistence pipeline~~ ✅ **CODE-COMPLETE 2026-07-08** (mig 014 written NOT applied; statsPersistService + reportToRows goldens; lazy triggers = useGameStats [completed games] + PiMatchReport — no daemon change needed). Remaining: APPLY 014 in the token session, then verify rows | P1 ✅ |
| P4 | ~~Pi ReviewHexChart + match report~~ ✅ **BUILT 2026-07-08** (PiMatchReport off PostGameScreen — see U1.3 correction; daemon persist call still pending P3) | P2 ✅, P3 |
| P5 | GameSetup roster→profile linking (search by name/code/phone) | P3 |
| P6 | U3 composer overhaul + stat-picker + PDF v2 | P1 |
| P7 | Career views + `/team/:id` + career/milestone cards | P3–P5 |
| P8 | Hex dedup pass (retire duplicate court hex math) | P2, P4 |
Parallel-safe: P1/P2/P6 immediately; P3 needs a working Supabase token (still expired — same
blocker as migrations 010–013; batch them in one dashboard session).

## Open items for Shrujal
- Reference screenshots for hexbin visual styling (still wanted before restyle passes).
- Courtside delivery = master context §8 union view; planned there, not here (as agreed).
- Team creation UX: host-only quick-create in GameSetup, or a managed teams library page?
  (Plan assumes quick-create first, library later.)
