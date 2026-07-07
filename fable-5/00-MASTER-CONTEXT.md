# THE BOX × COURTSIDE — Master Context

> **Written by Claude Fable 5 on 2026-07-07** for Shrujal Srinath (BMSCE, Bengaluru).
> This is the single source of truth for the entire product ecosystem: what exists, where it
> lives, how the pieces talk to each other, what has been decided, and what comes next.
>
> **If you are an AI session picking this up cold: read this file top to bottom before writing
> any code.** Then read `OPUS-GUIDANCE.md` in this folder — it tells you *how* to work on these
> codebases without repeating past mistakes. Product-specific deep docs are indexed in §12.
>
> A copy of this folder lives in all three repos (BOXV2-TEST-main, the_box_app, courtside).
> **The canonical copy is the one in `BOXV2-TEST-main/fable-5/`.** If you update it, re-copy to
> the other two repos before ending the session.

---

## TABLE OF CONTENTS

- §0 — How to use this file
- §1 — The ecosystem at a glance (four products, one backend, one founder)
- §2 — Product 1: THE BOX website (React/Vite, `BOXV2-TEST-main`)
- §3 — Product 2: pi-daemon (Raspberry Pi hardware referee box, inside `BOXV2-TEST-main`)
- §4 — Product 3: the_box_app (Flutter companion / coach / scorer app)
- §5 — Product 4: Courtside (Flutter consumer startup — booking + verified stats)
- §6 — The shared Supabase backend (tables, channels, wire contracts, coordinate law)
- §7 — THE IDENTITY UNIFICATION PLAN (one human = one account, across everything)
- §8 — Cross-app stats surfacing (BOX games → Courtside profiles)
- §9 — Everything done so far (timeline of shipped work)
- §10 — The roadmap (four locked priorities, ordered, with task breakdowns)
- §11 — Open blockers, environment facts, and prod-drift warnings
- §12 — Document map (every other doc, and which one wins on conflict)

---

# §0 — HOW TO USE THIS FILE

1. This file is **ground truth for cross-product facts**: the backend, the identity plan, the
   roadmap, the relationships between products. For *within-product* detail (design tokens,
   component rules, screen specs), the per-repo docs win — see §12 for the hierarchy.
2. Facts in this file were verified against the actual code on **2026-07-07**. Line numbers and
   file paths drift — **re-grep before quoting them in code changes**, but the architecture and
   decisions here are stable.
3. When a decision in this file gets changed by Shrujal, **update this file in the same
   session** and re-copy the folder to the other repos. A stale master context is worse than
   none — it makes future sessions confidently wrong.
4. Sections marked ⚠️ VERIFY contain facts that could not be confirmed against production
   (the Supabase MCP access token was expired on 2026-07-07 — see §11). Verify them against the
   live database before building on them.

---

# §1 — THE ECOSYSTEM AT A GLANCE

Shrujal is building a **sports scoring + booking ecosystem** with four products sharing one
Supabase backend (`eoowagimooxsqcrrihbw.supabase.co`):

```
                    ┌──────────────────────────────────────────────────┐
                    │        SUPABASE  eoowagimooxsqcrrihbw            │
                    │  auth.users · games · shot_events · game_actions │
                    │  player_profiles · user_profiles · bookings      │
                    │  venues/courts/slots · courtside_games · …       │
                    └──────┬──────────┬──────────┬──────────┬──────────┘
                           │          │          │          │
        ┌──────────────────┴──┐  ┌────┴─────┐  ┌─┴────────┐  ┌┴──────────────┐
        │ 1. THE BOX website  │  │ 2. pi-   │  │ 3. the_  │  │ 4. COURTSIDE  │
        │ React+TS+Vite PWA   │  │ daemon   │  │ box_app  │  │ Flutter app   │
        │ theboxbybmsce.in    │  │ Node on  │  │ Flutter  │  │ booking +     │
        │ score·broadcast·    │  │ Pi 4 +   │  │ coach·   │  │ verified stats│
        │ watch·tournaments·  │  │ physical │  │ co-score·│  │ + player      │
        │ stats/analytics     │  │ buttons  │  │ LAN·setup│  │ identity      │
        └─────────────────────┘  └──────────┘  └──────────┘  └───────────────┘
```

**One-line per product:**

1. **THE BOX website** (`/Users/shrujalsrinath/Downloads/BOXV2-TEST-main`) — multi-sport live
   scoring + broadcasting web platform. A host scores; anyone watches live via a 6-digit code /
   QR. Tournaments, shot charts, and (in flight) a full post-game stats/analytics hub.
   Live at **https://theboxbybmsce.in**, GitHub `shrujal-srinath/BOXV2-TEST`, Vercel
   auto-deploys `main`.
2. **pi-daemon** (same repo, `pi-daemon/`) — the software for a **physical scoring device**
   being built on a Raspberry Pi 4: Pico/ESP32 physical buttons → Node daemon (Socket.io :3001)
   → referee touchscreen UI (`/referee` React routes) + LED/TV display + cloud sync. This is THE
   BOX *hardware* product.
3. **the_box_app** (`/Users/shrujalsrinath/Desktop/the_box_app`) — Flutter companion app
   (Android-first). Does what the website does on a phone, **plus** phone-only powers: Coach
   Mode (annotate every ref score), co-scorer/shot-clock/stats operator roles, Pi setup &
   handover, LAN Direct scoring (<50 ms), and future game recording / CV features.
4. **Courtside** (`/Users/shrujalsrinath/Desktop/courtside`) — **the startup**. "Playo + Strava
   for Indian sports": book a court, play, get *verified* stats, build a player identity. Also
   grown to include a marketplace, wallet, leaderboard. V1 = basketball + cricket, Bengaluru,
   Gen Z.

**The locked relationship between Courtside and THE BOX (decided 2026-07-07):**
They are **separate products** — Courtside is the consumer booking/identity startup; THE BOX is
the scoring platform + hardware brand. **But identity and stats flow across them:** if a user
plays a game whose stats were recorded by a BOX device or the BOX website, and their profile was
linked to that game, those stats **must appear on their Courtside profile too.** That requirement
drives the identity unification plan in §7 and the stats-surfacing plan in §8.

**Business model (Courtside):** court-booking commission + per-game BOX hardware rental (paid by
the booker). No subscriptions, no ads. THE BOX website/hardware additionally serves college/event
scoring (BMSCE events, tournaments).

**Competitive frame:** Playo/Hudle are the booking incumbents (the floor to meet). Nobody in the
Indian market produces **verified stats** — stats captured by time-gated phone scoring or BOX
hardware, impossible to fake. That's the moat. Strava is the identity model; ESPN/NBA.com/
Sofascore are the presentation models.

---

# §2 — PRODUCT 1: THE BOX WEBSITE

**Location:** `/Users/shrujalsrinath/Downloads/BOXV2-TEST-main` · **Stack:** React 18 + TypeScript
+ Vite + Tailwind + Supabase (auth/Postgres/Realtime/storage) · **Deploy:** Vercel on push to
`main` · **Domain:** theboxbybmsce.in · PWA-capable (`dev-dist/sw.js`).

## 2.1 What it is

A multi-sport live scoring system with real-time broadcast. An operator ("host") scores from a
dashboard/tablet/phone; spectators watch a TV-style scoreboard via a shareable game code. It also
runs tournaments (brackets, volunteer scorers) and — the newest layer — post-game statistics and
analytics with exports.

## 2.2 The two worlds (critical architectural fact)

1. **Website world** (`/`, `/dashboard`, `/host/:gameCode`, `/tournament/*`) — normal browser,
   **auth required** for host actions. Supabase Auth: Google OAuth + email/password + anonymous
   guest.
2. **Tablet/Pi world** (`/tablet/standalone`, `/referee`, `/tv`) — installed PWA / kiosk.
   **No auth, 100% offline capable.** iPad Air 2 scorer, Pi referee touchscreen, Pi TV kiosk.

**Never add an auth requirement to a tablet/Pi/kiosk route.** This separation is deliberate and
load-bearing (gyms have no reliable internet; refs don't have accounts).

## 2.3 Route map

| Route | Screen | Auth |
|---|---|---|
| `/` | LandingPage (guest) / HomePage (authed) | mixed |
| `/dashboard` | Operator dashboard — start game, live feed, tournaments | yes |
| `/setup` | GameSetup — sport, mode (`quick`/`stats`/`advanced`), teams, rosters | yes |
| `/host/:gameCode` | **ScorerHost** device picker → phone ≤768px gets `MobileScorer` (touch deck), desktop gets `HostConsole` | yes |
| `/watch/:gameCode` | SpectatorView — TV-style scoreboard | no |
| `/watch-live` | Code-entry watch page | no |
| `/t/:id`, `/t/:id/volunteer` | Tournament public viewer / PIN-gated volunteer scorer | no/PIN |
| `/tournament/*` | Tournament admin (create/manage) | yes |
| `/tv` | TvKiosk (Pi display holding screen) | no |
| `/referee` | RefereeScreen — Pi touchscreen scoring UI (talks to pi-daemon) | no |
| `/tablet/standalone` | Offline standalone tablet scorer | no |
| `/lan-control/:gameCode` | LanControlPage — phone controller; Socket.io-direct to Pi (`?pi=IP`) with WebRTC/cloud fallback | no |
| `/arena/:code` | Multi-court arena view (`arena_sessions`) | no |
| `/player-passport` | PlayerPassportPage — registration wizard (design reference) | yes |
| Stats v2 (uncommitted): `GameStatsPage`, `PlayerGameStatsPage`, `PlayerSeasonStatsPage` | post-game analytics hub | see 2.6 |

## 2.4 Real-time architecture

- **Supabase Realtime Broadcast** on channel **`game:{CODE}`** — ephemeral pub/sub, no DB writes.
  Events: `clock_tick` `clock_start` `clock_stop` `shotclock_reset` `period_change` `clock_edit`
  `score_update` `game_snapshot`. Host broadcasts; N spectators receive.
- **WebRTC** (`webrtc-{CODE}` signaling channel) — lower-latency clock sync host↔spectator.
- **LAN Direct Link** (`webrtc-lan-{CODE}` signaling) — P2P over gym WiFi; data channels
  `game-sync` (lossy ticks) + `game-snapshot` (reliable `DirectLinkSnapshot v:1` every ~250 ms).
  Impl: `src/services/webrtcSync.ts`, `src/hooks/useLanGameLink.ts`. Cloud mirror via
  `useMirrorQueue` keeps remote spectators fed.
- **Supabase Postgres** — durable state: `games.data` JSONB snapshot, `shot_events`,
  `game_actions`, tournaments.
- Clock engine: `useSupabaseBroadcast` — host runs a RAF loop, broadcasts 1 Hz; spectators
  interpolate with 8 s stale protection. When ESP32 hardware is connected
  (`HardwareContext` / `useHardwareSignaling`), the hardware clock is authoritative.
- Hardware relay (browser can't open `ws://` from HTTPS): Railway relay
  `wss://thebox-relay-production.up.railway.app/device/XXXX` as fallback for ESP32.

## 2.5 Game modes (drive everything stats-related)

`GameSettings.gameMode = 'quick' | 'stats' | 'advanced'` (set in `GameSetup.tsx`):
- **quick** — score only. No player tracking, no stats export.
- **stats** — + players/rosters, box-score counting stats via `game_actions`.
- **advanced** — + shot chart: every made shot gets a court location (`shot_events` x/y/zone).

All stats UI must branch on mode (capability flags in `src/services/gameMode.ts`).

## 2.6 Stats & Analytics v2 (IN FLIGHT — large uncommitted changeset)

Spec: `readme-files/STATS_V2_GAME_ANALYTICS.md` (v2, 2026-06-17 — supersedes
`STATS_IMPLEMENTATION_PLAN.md` v1). Decisions locked: light + dark THE BOX design system; box
score built first. Scope: **STATS 1 = per-game post-game analytics**; STATS 2 (career profiles)
is a separate later effort (and will merge with the identity plan, §7/§8).

Built so far (all **uncommitted** on `main` as of 2026-07-07 — ~960 insertions across 22 modified
files plus new untracked files):
- `src/services/statsEngine.ts` (499 lines) — single source of truth: box score, scoring
  timeline, team comparison, zones, distance.
- `src/services/gameMode.ts` — mode resolver + capability flags.
- `src/services/exportService.ts` + `src/components/stats/export/` — CSV/PDF/JSON + print
  graphics.
- `src/components/stats/` — `StatsHub.tsx` (mode-aware router), `boxscore/BoxScoreTable`,
  `summary/{ScoringTimelineChart,TeamComparison,LeadRunStrip}`,
  `advanced/{ShotMap,ZoneHeatmap,DistanceBreakdown,PossessionPanel,StatsCourt}`, plus
  `charts/ layouts/ player/ share/ shared/ ui/`, `useGameStats.ts`, `types.ts`.
- Pages: `GameStatsPage.tsx`, `PlayerGameStatsPage.tsx`, `PlayerSeasonStatsPage.tsx`.
- Supporting migration (untracked): `supabase/migrations/012_shot_events_advanced.sql`.

Key data facts the stats engine relies on:
- `shot_events` stores x,y on a **0–100 × 0–94 portrait half-court grid** + zone, made, points,
  `game_clock_sec`, attributes, `assisted_by`/`rebounded_by`/`blocked_by`.
- `HalfCourtCanvas` historically **snapped taps to hex centers** — raw-point storage is the
  Phase-4 fix (see migration 012).
- Score-at-shot is not stored but is reconstructable by replaying `shot_events` chronologically.
- Non-shot stats (rebound/steal/turnover/block/assist/foul) live in `game_actions`
  (written by the website `shotService.ts`; **the pi-daemon does not write them yet** — §3 bug #2).

**First job for any session touching the website: get this changeset reviewed, finished, and
COMMITTED.** It is the largest uncommitted body of work in the ecosystem (priority #2 in §10).

## 2.7 Design system

The root `CLAUDE.md` carries the complete design system (color tokens, typography, card/nav
patterns, input standards). Highlights that other repos also follow:
- Light mode: warm off-white `#F0EEE9` page, white cards with soft shadows, `red-600` accents,
  section headers = `border-l-4 border-red-600 pl-3`. Aesthetic targets: ESPN, NBA.com, Sofascore.
- Dark mode: zinc-950/900 surfaces.
- `PlayerPassportPage.tsx` = form/wizard reference; `Dashboard.tsx` = product-shell reference.
- Player ID card (`PlayerIdCard.tsx`): landscape 1.586:1 credential card, dark gradient,
  `player_code` `BOX-XXX-1234`.
- A rewritten, leaner CLAUDE.md draft lives at `fable-5/CLAUDE-DRAFT.md` — review + promote it.

## 2.8 Git state (2026-07-07)

Branch `main`, **~22 modified + many untracked files uncommitted** — the entire stats v2 effort,
the web phone scorer (`MobileScorer.tsx`/`ScorerHost.tsx`), LAN Direct web pieces, pi-daemon
changes, migrations 011/012, `COMPANION-APP.md`, `readme-files/`. Nothing here is committed;
treat the working tree as precious. Last commit: `7be56b7` (coach_annotations migration +
assetlinks) — pushed; assetlinks.json serves in prod.

---

# §3 — PRODUCT 2: PI-DAEMON (THE HARDWARE REFEREE BOX)

**Location:** `BOXV2-TEST-main/pi-daemon/` (Node.js, Socket.io on **:3001**) + the `/referee`,
`/tv` React routes + `start_box.sh`. Runs on a **Raspberry Pi 4** with a touchscreen; physical
buttons come from a **Pico / ESP32** over serial (ESP-NOW handshake `ESPNOW_READY`). 3D-printed
controller enclosures exist (STL files on Desktop).

## 3.1 What it is

The software for THE BOX **physical scoring device** — the hardware product. Same job as the
website host console, but built around physical buttons and a referee-specific touch UI:

```
Pico/ESP32 buttons ──serial──▶ pi-daemon (Node, :3001)
                                  │  Socket.io 'state_update' / 'ui_action'
                                  ├──▶ /referee touchscreen UI (React, useRefereeBox.ts)
                                  ├──▶ /tv LED/TV kiosk display
                                  ├──▶ LAN phones (LanControlPage web / LanScorerScreen Flutter)
                                  └──▶ Supabase (persist + cloud broadcast, supabaseSync.js)
```

- Physical score button → daemon updates state → everything on the LAN updates in ~10–30 ms.
- **Advanced scoring mode (the flagship hardware feature):** a physical score press emits
  `score_pending` → the touchscreen launches `PiAdvancedShotFlow` (COURT → PLAYER → CONTEXT) →
  `shot_attributed` → daemon writes `shot_events` to Supabase. The score is already counted;
  the flow only attributes metadata. Mid-attribution score events remount the flow cleanly
  (keyed component).
- LAN Direct: phones connect Socket.io-direct to `:3001` (QR embeds `?pi=IP` via
  `/api/network-status`); `ui_action` in, `state_update` out. Sub-50 ms scoring.
- FIBA support: timeouts/undo overhauled in commit `20e2291` (dual-transport, FIBA timeouts,
  undo, supabase sync refactor) — but see bug #4 below; web and daemon still differ.

## 3.2 Coordinate law (NEVER violate — corrupts analytics silently)

- Persisted shot coords are **PORTRAIT half-court**: x = width 0–100, y = depth 0–94 from the
  shooting team's OWN basket (basket at 50, 10.5). 17 `ShotZoneId`s + 9 `ShotAttribute`s.
  Source of truth: `src/components/shotchart/courtZones.ts` — ported 1:1 to the Flutter app's
  `lib/models/shot_models.dart`; the two **must stay behaviorally identical**.
- The Pi referee court UI is **LANDSCAPE full-court 188×100** (`CourtGeometry.ts`). Team A
  attacks the LEFT basket, team B the RIGHT. All conversions must go through
  `portraitToLandscape` / `landscapeToPortrait`. `ShotPoint` (heatmap input) is landscape,
  pre-mirrored by team.

## 3.3 Known open issues (audited 2026-06-06; re-verify line numbers before fixing)

Ranked; full detail in the memory audit and re-derivable from code. This is roadmap priority #3.

1. **Cloud channel/event mismatch — BREAKS cloud spectators.** Daemon broadcasts `clock_sync` on
   `box-${code}`; web listens for `clock_tick/clock_start/clock_stop` on `game:${code}`.
   Off-LAN clock frozen. Fix: align daemon to the website vocabulary on `game:${code}`.
2. **`game_actions` never written by daemon** — only `shot_events`. Play-by-play/box-score for
   Pi-scored games misses every non-shot event. Fix as an **append-only action journal**, which
   also enables…
3. **No crash recovery** — `setup_game` with `existingGameCode` resets state to 0;
   `persistGameState` is written but never read back. Resume-by-replay of the action journal is
   the cheap fix (combined-fix opportunity with #2).
4. **FIBA timeout buckets not enforced in daemon** (web-only `fibaTimeouts.ts`); H2 allotment
   never replenishes.
5. **UNDO leaves orphaned `shot_events` rows** — phantom dots on shot charts. (Ref UNDO on the
   app side = row DELETE; daemon must do the same.)
6. **Clock is delta-based** (`Math.min(delta,200)` clamp), loses real seconds under load —
   should be epoch-anchored like the web hooks.
7. `pico_status` never surfaced in UI · 8. `finishGame` can lose the final persist to the 500 ms
   throttle · 9. offline `shotQueue` has no retry timer · 10. `broadcastClockToCloud` races
   channel creation · 11. `NEXT_PERIOD` unclamped · 12. shot-clock reset doesn't flip
   possession · 13. OT reuses regulation length (FIBA OT = 5 min) · 14. `dev_pico_message`
   unguarded in prod · 15. daemon is single-court while the web UI went multi-court
   (`arena_sessions`) · 16. hygiene (pigpio terminate, CORS `*`).

**Combined-fix strategy (Shrujal's own idea — honor it):** build #2 as an append-only journal →
#3 becomes replay → play-by-play export falls out free. Also planned: `CLOCK_STOP_WITH_REASON`
(auto-tag next input within ~3 s of a clock stop as the dead-ball reason — no new UI).

Daemon writes `made: true` always (physical buttons only fire on made baskets) — **miss logging
does not exist yet**; FG%/heatmap visuals stay latent until a miss path is designed.

---

# §4 — PRODUCT 3: THE_BOX_APP (FLUTTER COMPANION)

**Location:** `/Users/shrujalsrinath/Desktop/the_box_app` · **Stack:** Flutter + Riverpod +
go_router + supabase_flutter 2.12 + mobile_scanner + app_links + socket_io_client ·
**Package:** `com.thebox.the_box_app`, Android-first, sideloaded APK, verified App Links on
`theboxbybmsce.in`. **Now a git repo** (single commit `8286a40 "Initial commit: The BOX app"`,
~10 files dirty as of 2026-07-07 — commit discipline needed here too).
**Design:** dark-only THE BOX tokens — bg `#080A0F`, surface `#0F1117`, accent `#E8112D`,
Space Grotesk + Inter (same family as Courtside's Void Fire theme).

## 4.1 What it is

The phone counterpart of the website AND the helper device for the hardware:
- **Coach Mode (flagship):** join a live game by code+team; every ref score pops a
  "where/what/who" annotation flow on the coach's phone → private per-coach dataset in
  `coach_annotations` (FK → `shot_events.id ON DELETE CASCADE`, so ref UNDO auto-cleans).
  The ref's record stays authoritative.
- **Split operator roles:** co-scorer, shot-clock operator, stats operator on separate phones.
- **Pi setup & handover:** `/cast?tv=` wizard streams config to the Pi over
  `cast-control:{TVCODE}`, then hands over.
- **LAN scorer:** `LanScorerScreen` — Socket.io direct to pi-daemon (<50 ms), auto-fallback to
  cloud; connection-mode indicator (DIRECT/CONNECTING/FALLBACK/OFFLINE).
- **Scorer convergence (P4, done):** the app scorer emits the *website* event vocabulary +
  writes `shot_events`, so website spectators see app-scored games with live shot charts.
- **Spectator:** watches any game (dual-listens website + legacy vocab), renders live shot chart.
- Future: game recording / highlights, CV auto-scoring (§4.3).

## 4.2 Key maps

Screens (`lib/screens/`): auth · dashboard · coach (join + live) · connect/scan · setup
(pi_setup) · scoring ({scorer, co_scorer, co_join, game_setup, shot_clock_operator,
stats_operator, lan_scorer}) · spectator · profile.

Services (`lib/services/`): `website_broadcast_service` (website vocab on `game:{code}`) ·
`broadcast_service` (legacy app↔app vocab — retire in P4 cleanup) · `coach_service`
(`CoachGameLink`: postgres_changes on `shot_events`, backfill, dedupe) · `cast_control_service` ·
`pi_direct_service` (Socket.io LAN + `PiDirectNotifier`) · `deep_link_service` · `qr_parser`
(universal URL parser — handles every QR shape: `/watch/:code`, `/coach/:code?team=`,
`/lan-control/:code?pi=IP`, `/cast?tv=`, `/arena/:code`, `/score|co-score|shot-clock|stats-op/
:code`, raw 4-char code, `thebox://…`) · `shot_feed_service` · `auth_service` · `game_service`.

Court widgets (`lib/widgets/court/`): `tappable_court` (magnifier loupe, zone chip, haptics),
`half_court_painter`, `shot_chart` (markers/heatmap/zones). `lib/models/shot_models.dart` is the
1:1 port of the website's zone law (§3.2) — must stay behaviorally identical.

## 4.3 Roadmap (APP-MASTERPLAN.md, decisions locked 2026-06-16)

- **Track 1 — 3-tab shell** (decided: 3 tabs, not 5): Home / **Score** (center hub) / Profile,
  persistent top bar (global search + scan + transport chip + avatar). Build order: shell →
  Score hub w/ unified join→role-picker → Home watch section → Connect sheet → Profile tab
  (PlayerIdCard port + My Stats) → global search.
- **Track 2 — TransportService ladder** (decided: one abstraction for both browser + native
  watch devices): Tier 0 LAN P2P (~1–10 ms) → Tier 1 app-as-bridge (~5–20 ms) → Tier 2 Railway
  relay → Tier 3 Supabase (~80–250 ms), with cloud always mirrored. The native app has no
  mixed-content rule, so it can open raw `ws://` to the ESP32 and host a local server — **the app
  becomes the LAN gateway the HTTPS website can't be** (Scenario 4 bridge). mDNS type
  `_thebox._tcp` with TXT `{role, gameCode, tier}`.
- **Track 3 — features** (decided: retention base first): ship Player Passport career stats +
  voice/one-tap coach annotation first; the two heroes — **Box Vision** (CV auto-scorekeeper)
  and **multi-cam instant highlights** — incubate behind them.
- Phases: P1 Coach Mode ✅ built (blockers below) · P2 Setup/Handover ✅ (needs real-Pi verify) ·
  P3 LAN Direct WebRTC receiver ⛔ · P4 scorer convergence 🟢 built 2026-06-15 · P5 future
  (tournaments, passport, FCM, iOS, Play Store).

## 4.4 Coach Mode blockers (as of last check — ⚠️ VERIFY current prod state)

1. Migration `010_coach_annotations.sql` committed but **not applied to prod** → annotation SAVE
   404s.
2. **Anonymous sign-in 500s** server-side — a trigger on `auth.users` (very likely Courtside's
   `handle_new_user`, §7.2) chokes on null-email/anonymous rows; breaks guest login everywhere.
3. ~~assetlinks deploy~~ CLEARED — `7be56b7` pushed; App Links verify.

Both open blockers are fixed by `BOXV2-TEST-main/supabase/migrations/011_fix_anonymous_auth.sql`
— **it just needs to be applied to prod** (SQL editor, or refresh `SUPABASE_ACCESS_TOKEN` for
MCP). This is also step 0 of the identity plan (§7.6).

---

# §5 — PRODUCT 4: COURTSIDE (THE STARTUP)

**Location:** `/Users/shrujalsrinath/Desktop/courtside` · **Stack:** Flutter 3.41 + Riverpod +
go_router 17 + supabase_flutter 2.12 + google_maps_flutter + geolocator + hive + razorpay_flutter
· git repo, active. **Its own `CLAUDE.md` (678 lines) is excellent and authoritative for
everything inside Courtside** — glossary, tokens, rules, screen specs. `readme/future_plans.md`
is its living roadmap. This section only carries what a cross-product session must know.

## 5.1 The thesis

**"Playo + Strava for Indian sports."** Booking apps stop at the transaction; Courtside continues
into the game. Scoring unlocks 15 min before a paid booking (time-gate) or a BOX-equipped court
captures stats automatically. Either way the output is **verified stats** — authenticated data
tied to a real booking at a real venue. Verified stats accumulate into a **player profile**
(the Strava layer). The scoring surfaces are the **wedge**; everything else feeds users into it.

**The GPS analogy (why it's defensible):** Strava works because GPS makes self-reported runs
unnecessary. Courtside's GPS-equivalent = time-gated phone scoring + BOX hardware. Playo can't
copy it without building the scoring stack — which is exactly what THE BOX already is.

**Inviolable product principles** (full list in Courtside CLAUDE.md §4): all stats are verified —
**self-entered stats do not exist, ever**; booking is the gateway not the product; identity
compounds; invitees are first-class (only the booker pays, all invitees receive stats); no in-app
chat (WhatsApp owns coordination); verified is a visual language; **V1 = basketball + cricket
only**.

**Glossary trap (the #9 failure):** "Court" = a bookable sub-unit inside a venue (Court 1,
Court 2) — NOT a sport-surface drawing. Venue ⊃ courts ⊃ slots; booking = slot+payment+squad;
a Booking *produces* a Game. Read the CLAUDE.md glossary before touching anything named by it.

## 5.2 The core loop

`DISCOVER venue → BOOK slot → INVITE squad → PLAY (scoring unlocks) → VERIFIED STATS → SHARE
stat card / profile → COME BACK`. Playo-layer = 1–3, wedge = 4, Strava-layer = 5–7. Every
feature must feed this loop or it's noise.

## 5.3 Current shape (verified 2026-07-07 — the CLAUDE.md §12 table is now BEHIND the code)

Routes in `lib/core/router.dart` beyond the documented set: **marketplace**
(`/marketplace`, `/product/:id`, `/cart`, `/checkout`, `/order-history`, plus `/book/:id/shop`
inside the booking wizard), **wallet**, **settings**, **leaderboard**, **profile**, booking
summary. Providers grew to 19 (marketplace, orders, reviews, addresses, demo store, app mode,
pickup, sport cycle…). Services: venue, booking (228 lines), payment (Razorpay, 120), profile,
stats, game, pickup, marketplace, local_games_store.

**Data layer:** UI still runs on `FakeData` (`lib/models/fake_data.dart`) by design — full UI
first, **Supabase wired in one pass** (that pass is roadmap priority #1, §10). Exception already
live: the verified-stat path — `courtside_games` + `submit_game_result()` RPC exists and is the
only write path for verified stats (SECURITY DEFINER, enforces booker-owns-booking + the
15-min-before → 4-h-after time window, Asia/Kolkata anchored). `player_stats` is public-read,
**no client write policy** — the moat lives in that RPC.

**Backend schema already written** (`courtside/supabase/migrations/001–005`): `user_profiles`
(1:1 auth.users, auto-created by trigger), `venues`, `courts`, `slots`, `bookings`,
`player_stats`, `hardware_rentals`, `products`, `product_reviews`, `delivery_addresses`,
`orders`, `friends`, `pickup_games`, `courtside_games` + RPCs (`submit_game_result`,
`cs_accumulate_stats`) + RLS + seed. Razorpay edge functions: `create-razorpay-order`,
`verify-razorpay-payment`. ⚠️ VERIFY which migrations are actually applied to prod.

**Design:** Void Fire dark theme (bg `#080A0F`, accent `#E8112D`, SpaceGrotesk + Inter), full
semantic token system, `Cs*` component library, 5 production-quality rules. All specified in
Courtside CLAUDE.md §9–10 — follow it exactly; it is the best-written design doc in the ecosystem.

---

# §6 — THE SHARED SUPABASE BACKEND

**One project for everything: `eoowagimooxsqcrrihbw.supabase.co`.** Creds: BOXV2 root `.env` +
`pi-daemon/.env` (web), `the_box_app/.env`, `courtside/.env` (all flutter_dotenv, gitignored).

## 6.1 Table inventory (by owning product; all in `public`)

**THE BOX (migrations in `BOXV2-TEST-main/supabase/migrations/`):**
| Table | Purpose |
|---|---|
| `games` | PK `code` (4 chars, alphabet excludes O/I/0/1), `hostId`, `status: live\|completed\|archived`, `data` JSONB = full snapshot (settings/gameState/teamA/teamB with rosters) |
| `shot_events` | One row per (made) shot: `game_code`, `player_id`, portrait x/y (0–100 × 0–94), `zone`, `points`, `shot_type`, `period`, `game_clock_sec`, `attributes`, `assisted_by`, `rebounded_by`, `blocked_by`, `input_method`. Quick-mode ref score → `{zone:'unlocated', player_id:null, x:null, y:null}`. **Ref UNDO = row DELETE.** Anon SELECT allowed. Migration 012 (uncommitted) extends it |
| `game_actions` | Non-shot events: rebound/steal/turnover/block/assist/foul (website-written only — daemon gap §3 #2) |
| `player_profiles` | Rich athlete identity (mig 006): own uuid PK, **`auth_user_id` nullable FK → auth.users**, `phone_number UNIQUE`, `player_code UNIQUE` (`BOX-XXX-1234` via `generate_player_code` RPC), `is_claimed`, `registered_by`, physical/academic/sport fields. Photos in `player-avatars` bucket |
| `player_teams`, `player_sport_stats`, `player_game_log`, `player_follows` | teams/stats/log/social around player_profiles |
| `tournaments`, `tournament_secrets`, `tournament_fixtures` | bracket system (divisions, knockout/RR/groups) |
| `arena_sessions` | multi-court arena (mig 009) |
| `sport_events` (mig 002) | legacy |
| `coach_annotations` (mig 010, ⚠️ apply to prod) | per-coach shot enrichment, FK → shot_events CASCADE |
| `hardware_terminals` | ESP32 registry incl. `local_ip` (mDNS will supersede) |

**Courtside (migrations in `courtside/supabase/migrations/`):**
| Table | Purpose |
|---|---|
| `user_profiles` | 1:1 `auth.users` (PK = auth id), `username UNIQUE`, auto-created by `on_auth_user_created` trigger — **the trigger fires for EVERY auth signup ecosystem-wide** (§7.2) |
| `venues` → `courts` → `slots` | the booking inventory hierarchy |
| `bookings` | slot + payer + squad + status |
| `hardware_rentals` | per-booking BOX rental |
| `courtside_games` | one row per completed Courtside phone-scored game (`user_id`, `booking_id`, `is_verified`, `my_line`/`player_lines` JSONB) |
| `player_stats` | career aggregate; public read, **writes only via `submit_game_result()` RPC** (time-gated, SECURITY DEFINER) |
| `products`, `product_reviews`, `orders`, `delivery_addresses` | marketplace |
| `friends`, `pickup_games` | social/pickup |

**Deliberate collision-avoidance already in place:** Courtside's per-game table is named
`courtside_games` because BOX owns `games`. Keep this pattern — prefix new Courtside tables when
a BOX concept shares the name.

## 6.2 Realtime channel contracts (spans 3+ codebases — NEVER change one end alone)

| Channel | Events | Producers/Consumers |
|---|---|---|
| `game:{CODE}` (website vocab — canonical) | `clock_tick` `clock_start` `clock_stop` `shotclock_reset` `period_change` `clock_edit` `score_update` `game_snapshot` | website HostConsole/MobileScorer, app `WebsiteBroadcastService`, spectators. pi-daemon SHOULD use this (bug §3 #1) |
| `game:{CODE}` (legacy app vocab) | `score_update` `clock_sync` `game_action` `request_clock_stop` `shot_clock_*` `stats_update` | app↔app operator roles; retire in P4 cleanup |
| `coach:{CODE}` | postgres_changes on `shot_events` (INSERT filtered by game_code; DELETE unfiltered) | app CoachGameLink |
| `cast-control:{TVCODE}` | `phone-connected` `config-update` `setup-start` `watch-game` | Pi setup/handover |
| `webrtc-{CODE}` | `signaling` | clock-sync WebRTC |
| `webrtc-lan-{CODE}` | `signaling` (`join/offer/answer/ice`) | LAN Direct Link — deliberately separate channel |
| Socket.io `:3001` (LAN, not Supabase) | `ui_action` in, `state_update` out, `score_pending`, `shot_attributed`, `pico_status` | pi-daemon ↔ referee UI / LAN phones |

Payload shapes: `score_update` = `{teamA, teamB, foulsA, foulsB, timeoutsA, timeoutsB,
possession, [period], ts}`; `clock_tick` = `{minutes, seconds, tenths, shotClock, [period,
gameRunning], ts}`; `DirectLinkSnapshot v:1` = `{v:1, gameCode, teamA{name,score,fouls,timeouts,
color}, teamB{…}, clock{gameMs,shotMs,isRunning,period,totalPeriods}, possession, ts}`.

## 6.3 The coordinate law (repeated on purpose — it protects the analytics moat)

Portrait half-court 0–100 × 0–94, basket (50, 10.5), 17 zones + 9 attributes. Website
`courtZones.ts` ⇄ app `shot_models.dart` must stay identical. Pi UI is landscape 188×100,
A-left/B-right, convert only via `portraitToLandscape`/`landscapeToPortrait`.

## 6.4 Prod drift (⚠️ VERIFY at next session with a working token)

Known/likely differences between migration files and live prod:
1. Migration 010 (`coach_annotations`) — believed NOT applied.
2. Migration 011 (`fix_anonymous_auth`) — written, NOT applied; anonymous signup 500s until it is.
3. Migration 012 (`shot_events_advanced`) — new, uncommitted, NOT applied.
4. An `auth.users` trigger exists in prod that was added outside tracked migrations (the
   anonymous-500 culprit; likely Courtside's `handle_new_user` or a sibling).
5. Which of Courtside's 001–005 are applied is unconfirmed (the `submit_game_result` path
   reportedly works, so at least 001/005 likely are).
First action of the next backend session: refresh `SUPABASE_ACCESS_TOKEN`, run `list_migrations`
+ `list_tables`, and reconcile this list.

---

# §7 — THE IDENTITY UNIFICATION PLAN

> Decided 2026-07-07: Shrujal wants **one human = one account**, regardless of whether they log
> in with phone number, Gmail, or email/username, on any of the products. Duplicate-account
> states ("phone login created a second account", "asked to re-register when they already
> exist") must be **impossible by design**, enforced server-side. This section is the plan.

## 7.1 Current auth surface (verified in code 2026-07-07)

| Surface | Methods |
|---|---|
| BOX website (`src/services/authService.ts`) | Google OAuth · email+password · **anonymous** |
| the_box_app (`lib/services/auth_service.dart`) | Google OAuth · email+password · **anonymous** |
| Courtside (`auth_provider.dart`, `phone_auth_screen.dart`) | Google OAuth · email+password · **phone OTP** (`signInWithOtp`/`verifyOTP`) |

All against the same `auth.users`. Profile tables: Courtside `user_profiles` (PK = auth id,
trigger-created); BOX `player_profiles` (own PK, `auth_user_id` nullable, `phone_number UNIQUE`,
claim model for host-registered players).

## 7.2 Why duplicates happen today — the exact failure cases

**Case A — phone vs email split (THE big one).** Priya signs into Courtside with Google
(priya@gmail.com) → auth user U1 + `user_profiles` row. Weeks later she reinstalls and taps
"continue with phone" → `signInWithOtp(phone)` → Supabase finds no auth user owning that phone →
**creates auth user U2**. Now she has two accounts, split stats, and her bookings are invisible
from the new login. Nothing in the current system prevents or detects this.

**Case B — unclaimed passport.** A host registers Priya on the BOX website Player Passport with
her phone number → `player_profiles` row (auth_user_id NULL or =host, is_claimed=false). Priya
later creates any account on any app — nothing connects her account to her passport, her BOX
game stats, or her `player_code`. Case A and B compound: her stats can end up spread across two
auth users AND an unclaimed passport.

**Case C — email/password vs Google, same email.** Supabase auto-links an OAuth identity into an
existing user only when the emails match and are verified; an email+password signup against an
existing OAuth-only email behaves differently (obfuscated "check your inbox" / linking rules
depend on project settings). Must be pinned by config + tested, not assumed.

**Case D — anonymous/guest.** Website + box app both use `signInAnonymously()` for guest
scoring. Two problems: (1) prod currently **500s on anonymous signup** because an `auth.users`
trigger (Courtside's `handle_new_user` inserts into `user_profiles` for EVERY new auth user —
including BOX guests — and something in the prod version rejects null-email/anonymous rows);
(2) even when fixed, guests must never become permanent duplicate identities.

**Case E — cross-app trigger pollution (already live).** Because `on_auth_user_created` fires
project-wide, every BOX website signup already gets a Courtside `user_profiles` row. That's
actually *convenient* for unification (see 7.4) but it was never designed — make it deliberate.

## 7.3 Design principles (the rules that make errors impossible)

1. **`auth.users.id` is the one canonical human key.** Every profile/stat/booking row must reach
   it, directly or via a claim flow. No app-level "match by phone string" joins at read time.
2. **A contact point (phone or email), once known, is either (a) attached to the auth user via
   Supabase identity linking, or (b) recorded with a pending-claim path.** Never stored as a
   loose string that a future login can silently duplicate.
3. **Resolution happens server-side, before account creation, every time.** Clients never decide
   "this is a new user" on their own — they ask the backend first.
4. **Profiles are created by the backend (trigger/RPC), never ad-hoc by clients.** One creation
   path = no divergent shapes.
5. **Merging is a first-class admin operation**, because some duplicates already exist and more
   will slip through until this ships.

## 7.4 Target architecture

```
                          auth.users (canonical; one row per human)
                          identities: google | email | phone   ← linked, not separate users
                               │ id
            ┌──────────────────┼─────────────────────┐
            ▼                  ▼                     ▼
   user_profiles          player_profiles        everything else keyed by user id
   (Courtside app-       (BOX athlete passport;  (bookings, courtside_games,
    level profile;        auth_user_id = link;    player_stats, orders, friends,
    PK = auth id)         claimable when NULL)    coach_annotations, games.hostId…)
```

- **Keep both profile tables** (they serve different jobs: `user_profiles` = app account,
  `player_profiles` = athlete passport that can exist *before* its human has an account —
  the host-registered case is a real product feature). Link them **only** through
  `auth.users.id`. Enforce: `player_profiles.auth_user_id` gets a **UNIQUE partial index**
  (`WHERE auth_user_id IS NOT NULL`) so one account can never hold two passports.
- **Phone becomes a linked identity, not a parallel account namespace.** In Courtside, when a
  logged-in (Google/email) user provides their phone during onboarding → `updateUser({phone})` +
  OTP verify → the phone now lives ON their auth user, and any future `signInWithOtp(phone)`
  resolves to the SAME user. This one change kills Case A for every user who completes it.
- **New RPC `resolve_identity(p_email text, p_phone text) → jsonb`** (SECURITY DEFINER):
  looks across `auth.users` (email, phone, identities) + `player_profiles.phone_number` +
  `user_profiles.username` and returns one of:
  `{status:'existing_account', methods:['google','email'], hint:'pr***@gmail.com'}` ·
  `{status:'unclaimed_passport', player_code:'BOX-…'}` · `{status:'new'}`.
  **Every signup/login screen in every app calls this before creating anything** and routes:
  - `existing_account` → "You already have an account — continue with Google / we sent an OTP to
    log you into it" (never a second account, never a dead-end "user exists" error).
  - `unclaimed_passport` → account creation proceeds, then immediately runs the claim flow.
  - `new` → normal signup.
- **Claim flow — RPC `claim_player_profile()`** (SECURITY DEFINER): caller must be authenticated
  AND have a verified phone on their auth user matching `player_profiles.phone_number` (or a
  verified email match as secondary) → sets `auth_user_id = auth.uid()`, `is_claimed = true`.
  Proof-of-possession only — no client-asserted matches.
- **Merge tool — RPC `merge_users(primary uuid, duplicate uuid)`** (service-role only, for the
  duplicates that already exist): repoints every FK (`user_profiles` keep primary, move
  `bookings.user_id`, `courtside_games.user_id`, `player_stats`, `orders`, `friends` both
  columns, `pickup_games`, `coach_annotations.coach_id`, `player_profiles.auth_user_id`/
  `registered_by`, `games.hostId`, `player_follows`…) inside one transaction, then bans/deletes
  the duplicate auth user. Build the FK inventory by querying `information_schema` at
  implementation time — do not hand-maintain the list.
- **Fix the trigger** (`handle_new_user`): `IF new.is_anonymous THEN RETURN new; END IF;` (skip
  guests) — this is also the anonymous-500 fix in migration 011. Keep the project-wide firing
  (Case E) as a *deliberate* choice: every real account gets a `user_profiles` row regardless of
  which app created it, which is exactly what shared identity wants.
- **Guests:** anonymous users get no profile rows. Upgrade path = Supabase's
  `linkIdentity`/`updateUser` on the anonymous session (converts guest → real user, keeping any
  session-scoped data), then the trigger logic runs the profile creation.

## 7.5 Supabase config checklist (dashboard, not code — ⚠️ VERIFY each)

1. Confirm **phone provider** (SMS sender: Twilio/MSG91/etc.) is production-grade — Courtside
   OTP depends on it.
2. Enable **manual identity linking** (required for `linkIdentity`/`updateUser({phone})` flows).
3. Confirm **automatic OAuth linking** behavior for same-verified-email (Case C) and write a test
   for it: email+password signup → then Google login with same address → must be ONE user.
4. Keep anonymous sign-in enabled (guest scoring depends on it) once 011 lands.
5. Decide whether email confirmation is required (affects Case C linking rules).

## 7.6 Implementation order (each step is safe alone)

1. **Apply migration 011** (fix anonymous trigger) — unblocks the box app's Coach Mode AND is
   prerequisite hygiene. Refresh `SUPABASE_ACCESS_TOKEN` or paste in SQL editor.
2. Write **migration 013_identity_bridge.sql**: unique partial index on
   `player_profiles.auth_user_id` · `resolve_identity()` · `claim_player_profile()` ·
   `merge_users()` · trigger hardening (idempotent, skip-anonymous, ON CONFLICT DO NOTHING).
3. **Courtside client:** call `resolve_identity` on the auth entry screen before any signup;
   add "link your phone" (`updateUser({phone})` + OTP) as a required onboarding step for
   Google/email users; route phone-OTP logins that hit `existing_account` into the
   log-into-existing flow.
4. **BOX website + box app:** call `resolve_identity` in their signup flows; add the
   claim-passport prompt after login when an unclaimed `player_profiles` matches.
5. **Audit + merge existing duplicates** (SQL: group auth.users by lower(email) & by phone
   across identities + player_profiles; run `merge_users` on confirmed pairs).
6. Only then build §8 (stats surfacing) on top — it depends on links being trustworthy.

**Test matrix to run before calling this done** (each on a fresh test human):
phone-first signup → later Google with different email (should offer link, not dup) · Google
first → phone OTP later (must resolve to same user) · email+password then Google same email
(one user) · host-registered passport → phone signup → claim fires · guest → upgrade → no
orphan profile · two pre-existing dups → merge → all rows follow.

---

# §8 — CROSS-APP STATS SURFACING (BOX → COURTSIDE)

The locked product requirement: **a BOX-recorded game (device or website) linked to a player's
profile must show on their Courtside profile.**

## 8.1 Where BOX stats live vs what Courtside reads

- BOX per-shot truth: `shot_events` (`player_id` refers to a roster player inside `games.data`
  JSONB — ⚠️ VERIFY exact id semantics before building; it is NOT an auth user id).
- BOX aggregates: `player_game_log` / `player_sport_stats` keyed by `player_profiles.id`.
- Courtside reads: `player_stats` (career aggregate) + `courtside_games` (game history), both
  keyed by `auth.users.id`.

## 8.2 The bridge (after §7 lands)

1. **Roster linking is the missing capture step:** when a BOX game is set up in `stats`/
   `advanced` mode, roster entries should (optionally) reference a `player_profiles.id`
   (search by name/player_code/phone in GameSetup — UI already has a passport system to draw
   on). No link → stats stay anonymous to that game; link → they flow.
2. **Read-side union view** `v_player_game_history(auth_user_id, source, game_id, played_at,
   sport, is_verified, line jsonb)` = `courtside_games` rows (source `courtside`) UNION
   `player_game_log`/aggregated `shot_events`+`game_actions` joined through
   `player_profiles.auth_user_id` (source `box`). Courtside's profile/stats screens read this
   view instead of `courtside_games` directly.
3. **Verified semantics:** BOX-hardware and BOX-website ref-scored games count as verified
   (arguably *more* verified than time-gated phone scoring — an official scored them). Show the
   same verified mark; optionally distinguish the capture source ("BOX hardware" badge) as brand
   surface for the hardware.
4. **Do not double-count:** a Courtside booking at a BOX-equipped venue that produces a BOX
   game must yield ONE game record. Long-term: `games` gets a nullable `booking_id`; when
   present, Courtside's `submit_game_result` path is suppressed for that booking.

Career profiles on the BOX side (STATS 2) and the box app's Profile tab (Track 1 step 5, Track 3
retention base) should all read the same bridged data — build the view once, surface it thrice.

---

# §9 — EVERYTHING DONE SO FAR (TIMELINE)

**THE BOX website + pi-daemon** (git history + working tree):
- Core platform: multi-sport scoring, host console, spectator broadcast (Realtime + WebRTC),
  tournaments with brackets/volunteers, TV kiosk, standalone offline tablet PWA, Player Passport
  registration + PlayerIdCard, hardware (ESP32) integration with Railway relay fallback.
- `0c42f7a` — Pi console redesign, multi-court arena (`arena_sessions`), scoring UX.
- `20e2291` — pi-daemon overhaul: dual transport, FIBA timeouts, undo, supabase sync refactor.
- `9cba0d2` — **Direct Link LAN scoring** + court overhaul (magnifier loupe, off-half dim,
  basket beacon, team-mirrored quick spots; fixed transposed heatmap + wrong-basket mirroring
  bugs — 2026-06-11), dev-key removal.
- `7be56b7` — coach_annotations migration + Android App Links assetlinks (pushed; serving).
- **Uncommitted (2026-06-16 → 07-07):** Stats & Analytics v2 (statsEngine, StatsHub, box score,
  timelines, zone heatmap, exports, 3 new pages, migration 012) · web phone scorer
  (MobileScorer/ScorerHost) · LAN Direct web pieces (`/api/network-status`, `?pi=` QR embed,
  Socket.io-direct LanControlPage) · migration 011 · COMPANION-APP.md + readme-files/.

**the_box_app** (now a git repo, initial commit `8286a40`):
- P1 Coach Mode built end-to-end (join → live annotate → coach_annotations) — blocked on prod
  migrations (§4.4). P2 Pi Setup & Handover built. P4 scorer convergence built (2026-06-15):
  app emits website vocab + writes shot_events; live shot chart in app spectator. Court
  Experience pack (tappable court w/ loupe + hex/zone heatmap). LAN Direct scoring
  (pi_direct_service + LanScorerScreen, 2026-06-16). Universal QR/deep-link parser + App Links.
  `flutter analyze` clean at last check.

**Courtside** (git, latest `f9cf7bb`):
- Full UI on FakeData: splash/auth (Google, email, phone OTP)/onboarding → Mode Gate → Home
  (Next Game card, live now, map, courts, feed) → sport/venue → 4-step booking wizard
  (slot → invite → hardware → shop → cart w/ Razorpay) → my bookings → stats + stat share →
  basketball scorer + cricket scorer → play shell. Undocumented growth: marketplace (products/
  cart/checkout/orders/reviews), wallet, leaderboard, settings, profile, host-game & pickup
  scaffolding. Phase-3 polish passes done (icons replace emoji, hero polish).
- Backend written: migrations 001–005 (full booking schema, RLS, seed, Razorpay edge functions,
  `submit_game_result` verified-stat RPC + `courtside_games`).
- Docs: the excellent CLAUDE.md + `readme/future_plans.md` living roadmap (currently empty of
  new directions — this fable-5 folder now feeds it).

---

# §10 — THE ROADMAP (locked 2026-07-07, all four confirmed as priorities)

Order below is a *suggested* execution order per area; Shrujal picks per session. The identity
plan (§7) is the connective tissue — schedule its step 1–2 early because three of the four
priorities touch it.

## Priority A — Courtside: wire Supabase (replace FakeData in one pass)
1. Verify prod state of migrations 001–005; apply gaps. Seed real Bengaluru venues.
2. Build the identity entry flow FIRST (§7.6 steps 2–3) so every account created from day one is
   clean — retrofitting identity after launch is 10× the pain.
3. Wire in dependency order: venues/courts/slots (read) → bookings + Razorpay (write) →
   squad invites → time-gated scoring unlock → `submit_game_result` → stats screens off real
   `player_stats`/`courtside_games` → marketplace last (independent).
4. Per Courtside CLAUDE.md: provider per domain, shimmer + error states on every screen, delete
   from `fake_data.dart` as each domain lands.

## Priority B — BOX website: finish + COMMIT Stats v2
1. First: commit the current working tree in reviewed slices (stats v2 · phone scorer · LAN
   direct · daemon changes · migrations). ~22 modified + dozens of untracked files at risk of
   loss right now.
2. Finish per `readme-files/STATS_V2_GAME_ANALYTICS.md`: box score → timelines/comparison →
   advanced (exact dots, zone heatmap, distance) → exports → mode gating (quick = none).
3. Apply migration 012; store raw tap points (kill the hex-snap loss).
4. STATS 2 (player career) waits for §7/§8.

## Priority C — pi-daemon fix list (order from §3.3, already validated)
1. Channel/event alignment (#1 — unbreaks cloud spectators) → 2. action journal + undo-deletes
   (#2+#5) → 3. crash recovery via replay (#3) → 4. FIBA buckets (#4) → 5. epoch clock (#6) →
   6. the tail (#7–16). Design multi-court daemon (#15) as its own pass.
Also next hardware feature candidates: miss logging (needs daemon path + button/UI design),
assist/rebound chaining, post-game shot chart review on the referee screen.

## Priority D — the_box_app: shell + transport
1. Track 1: 3-tab shell (`StatefulShellRoute`) → Score hub w/ unified join→role-picker →
   Home/Watch → Connect sheet → Profile tab (PlayerIdCard port + My Stats — needs §8 view) →
   global search.
2. Track 2: `TransportService` tier ladder; packages `flutter_webrtc`, `web_socket_channel`,
   `shelf`+`shelf_web_socket`, `multicast_dns`/`nsd`, `network_info_plus`; port wire contracts
   verbatim; bridge mode (app = LAN gateway, Scenario 4); latency HUD.
3. Unblock Coach Mode first (apply 010 + 011 — 15 minutes of SQL, unlocks the flagship).
4. Track 3 after base: voice annotation → passport career stats → incubate Box Vision + multi-cam.

## Cross-cutting (do alongside, not after)
- **Identity §7 steps 1–2** (migration 011 + 013) — before Courtside launch and before STATS 2.
- Refresh `SUPABASE_ACCESS_TOKEN` so MCP works; reconcile prod drift (§6.4).
- Commit discipline: BOXV2 tree committed in slices; the_box_app has 10 dirty files; keep
  `flutter analyze` clean in both Flutter repos.
- Keep this folder + `future_plans.md` + COMPANION-APP.md updated as decisions land.

---

# §11 — OPEN BLOCKERS & ENVIRONMENT FACTS

**Blockers:**
1. `SUPABASE_ACCESS_TOKEN` expired → MCP tools return Unauthorized (confirmed again 2026-07-07).
   Fix: regenerate at supabase.com/dashboard/account/tokens, update env/MCP config.
2. Migrations 010, 011 (and now 012) not applied to prod → Coach Mode annotation saves 404;
   anonymous sign-in 500s ecosystem-wide.
3. BOXV2 uncommitted changeset (stats v2 + phone scorer + LAN + daemon) — data-loss risk.

**Environment:**
- Machine: macOS (darwin 25.5.0), zsh. Flutter SDK at `/Users/shrujalsrinath/flutter/bin/flutter`.
- Android emulator `emulator-5554`; `adb install -r` silently fails when `/data` is full
  (debug APK ~178 MB) — confirm it prints `Success`.
- BOXV2 deploys: Vercel auto on push to `main` (GitHub `shrujal-srinath/BOXV2-TEST`).
- Live domain: theboxbybmsce.in (assetlinks.json serving). Railway relay:
  `thebox-relay-production.up.railway.app`.
- Supabase project: `eoowagimooxsqcrrihbw` — creds in each repo's gitignored `.env`.
- Desktop also holds STL files for the controller enclosure and old `CourtSide v*.apk` builds
  (unrelated to the current Courtside repo).

---

# §12 — DOCUMENT MAP (and which doc wins)

| Doc | Location | Scope / authority |
|---|---|---|
| **This file** | `fable-5/00-MASTER-CONTEXT.md` (canonical in BOXV2; copies in both Flutter repos) | Cross-product truth: backend, identity, roadmap, relationships. Wins on cross-product questions |
| `OPUS-GUIDANCE.md` | same folder | HOW to work on these codebases (for Opus 4.8 + future models). Read second |
| `CLAUDE-DRAFT.md` | same folder | Proposed replacement for BOXV2 root CLAUDE.md — review, then promote |
| BOXV2 root `CLAUDE.md` | repo root | Current website design system + key files. Wins on website UI style until the draft is promoted |
| `COMPANION-APP.md` | BOXV2 root | Companion-app ecosystem map: wire contracts, LAN protocol, blockers, idea catalog (2026-06-14) |
| `readme-files/STATS_V2_GAME_ANALYTICS.md` | BOXV2 | Stats v2 spec (supersedes STATS_IMPLEMENTATION_PLAN v1). Wins on stats scope |
| `APP-MASTERPLAN.md` | the_box_app root | The 3 tracks (shell/transport/features) + locked 2026-06-16 decisions. Wins on app IA/transport |
| `LAN_DIRECT_GUIDE.md` | the_box_app root | LAN Direct architecture + Socket.io event reference |
| Courtside `CLAUDE.md` | courtside root | EVERYTHING inside Courtside: glossary, principles, tokens, rules. Wins on all Courtside product/design questions. Its §12 screen table is stale — trust the router |
| `readme/future_plans.md` | courtside | Courtside living roadmap; newer than its CLAUDE.md on *direction* |
| Claude memory | `~/.claude/projects/-Users-shrujalsrinath-Downloads-BOXV2-TEST-main/memory/` | Session-persistent notes (BOXV2 sessions only — the Flutter repos don't see it; that's why this folder exists) |

**Conflict rule:** more specific doc wins inside its scope; this master context wins across
scopes; when two docs disagree on direction, the newer one wins but **flag the conflict to
Shrujal instead of silently picking.**
