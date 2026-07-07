# THE BOX — Companion App Ecosystem (master map)

> **Read this first.** Single source of truth for the mobile/companion side of THE BOX:
> where everything lives, what it does today, the wire contracts that hold it together, the
> roadmap, the open blockers, and the idea catalog. Written for a human *or* a fresh AI agent
> picking the work up cold.
> Last updated: 2026-06-14.

---

## 0. TL;DR

THE BOX is a multi-sport live-scoring + broadcasting platform. The **companion effort** lets a
phone pair with a live game to act as a **co-scorer / coach-support** device, configure & hand
over to the Pi referee box, display the game, and (planned) carry the live feed **peer-to-peer
over gym WiFi (LAN)**. There are **two distinct halves**:

1. **Native app** (Flutter, Android-first) — the real companion app.
2. **Web phone scorer** (inside this React repo) — `/host` rendered as a touch deck on phones.

Both talk to **one Supabase project**: `eoowagimooxsqcrrihbw.supabase.co`.

⚠️ **Coach Mode (the flagship) is built but does not work end-to-end yet** — see §7 Blockers.

---

## 1. Where everything lives

| Piece | Location | Stack | Git |
|---|---|---|---|
| **Website** (host console, spectator, shot charts, watch/tournament pages, LAN) | `/Users/shrujalsrinath/Downloads/BOXV2-TEST-main` · live https://theboxbybmsce.in · GitHub `shrujal-srinath/BOXV2-TEST` | React + TS + Vite + Tailwind + Supabase | tracked |
| **Pi referee box** (physical scoring unit + LED display) | same repo: `pi-daemon/` (Node, socket.io :3001) + `/referee` React routes; `start_box.sh` | runs on a Raspberry Pi 4 | tracked |
| **Native companion app** | `/Users/shrujalsrinath/Desktop/the_box_app` | Flutter (Riverpod + go_router + supabase_flutter) | **NOT a git repo** |
| **Web phone scorer** | this repo: `src/pages/MobileScorer.tsx`, `src/pages/ScorerHost.tsx` | React (reuses website engine) | **uncommitted** |

**Shared Supabase project:** `eoowagimooxsqcrrihbw`. App creds in `the_box_app/.env`
(loaded via `flutter_dotenv`); website creds in repo-root `.env` / `pi-daemon/.env`.

> **NOT part of this work:** the `CourtSide v*.apk` files on the Desktop and the
> `~/.claude/plans/i-want-you-to-sprightly-wolf.md` plan ("Courtside" — a Playo/Strava-style
> venue-booking app) are a **different, unrelated app**. Don't confuse them with the companion app.

---

## 2. Native companion app (`the_box_app`)

Mobile counterpart of the website. Android-first, sideloaded APK, verified Android App Links.
Package id **`com.thebox.the_box_app`**.

**Stack:** `supabase_flutter` 2.12, Riverpod, go_router, `flutter_dotenv`, `google_sign_in`,
`mobile_scanner` (QR), `app_links` (deep links), `qr_flutter` (generator).
**Design tokens:** dark-only — bg `#080A0F`, surface `#0F1117`, accent `#E8112D`,
Space Grotesk (display/score) + Inter (body). Tokens in `lib/core/tokens/*`.

### Screen map (`lib/screens/`)
| Area | Files | Role |
|---|---|---|
| auth | `auth/login_screen.dart` | email / Google / anonymous (guest) |
| dashboard | `dashboard/dashboard_screen.dart` | live feed + action cards (incl. COACH MODE, SCAN QR) |
| coach **(flagship)** | `coach/coach_join_screen.dart`, `coach/coach_live_screen.dart` | join by code+team → annotate every ref score |
| connect | `connect/scan_screen.dart` | camera QR scan → routed via `qr_parser` |
| setup | `setup/pi_setup_screen.dart` | `/cast?tv=` Pi setup wizard + handover |
| scoring | `scoring/{scorer,co_scorer,co_join,game_setup,shot_clock_operator,stats_operator}_screen.dart` | app-native scoring + split operator roles (co-scorer/shot-clock/stats) |
| spectator | `spectator/spectator_screen.dart` | watch any game (dual-listens website + legacy events) |
| profile | `profile/profile_screen.dart` | account |

### Service map (`lib/services/`)
| File | Role |
|---|---|
| `website_broadcast_service.dart` | speak the **website** event vocab on `game:{code}` — lets the app watch ANY Pi/website game |
| `broadcast_service.dart` | legacy app-only event vocab (app↔app roles); retire in P4 |
| `coach_service.dart` | `CoachGameLink`: postgres_changes INSERT/DELETE on `shot_events`, backfill, dedupe, `ensureCoachId()`, annotation writes |
| `cast_control_service.dart` | phone side of `cast-control:{tvCode}` (setup/handover) |
| `deep_link_service.dart` | `app_links` → go_router (cold-start buffered) |
| `qr_parser.dart` | universal payload parser (see §4 URL space) |
| `auth_service.dart`, `game_service.dart` | auth + game CRUD |

Models: `lib/models/{game_models,game_config,shot_models}.dart`. Court widgets:
`lib/widgets/court/{half_court_painter,tappable_court}.dart`. Router/constants: `lib/core/`.

### Built so far
- **Phase 1 — Coach Mode** ✅ (ref scores +2 on the Pi → coach phone pops "where/what/who" →
  private per-coach dataset in `coach_annotations`; ref record stays authoritative). *Blocked, §7.*
- **Phase 2 — Setup & Handover** ✅ (`/cast?tv=` wizard streams config to the Pi, then hands over;
  needs a real Pi to verify the full loop).
- `flutter analyze` clean. Debug APK builds + installs on `emulator-5554`.

---

## 3. Web phone scorer (this repo)

`src/pages/ScorerHost.tsx` is the device picker mounted at **`/host/:gameCode`**:
- phone (≤768px) → **`MobileScorer.tsx`** — portrait, thumb-sized touch deck (+1/+2/+3, foul,
  timeout, possession, clock start/stop, shot-clock 24/14, next period, undo).
- desktop → **`HostConsole.tsx`** (full console). A phone user can jump to the console (e.g. for
  the advanced shot chart) via the monitor button.

Only one mounts at a time, so engine hooks never double up. `MobileScorer` reuses the **exact**
HostConsole wiring — `useGameEngine` + `usePersistEngine`/`useGenericPersistEngine` +
`useSupabaseBroadcast` — so scores/clock broadcast to spectators and persist to Supabase
identically. **Status: uncommitted** (`src/pages/MobileScorer.tsx`, `src/pages/ScorerHost.tsx`,
plus the `/host/:gameCode` wiring in `src/App.tsx`).

---

## 4. Shared integration contracts (keep both ends aligned)

### Realtime channels (Supabase)
| Channel | Events | Used by |
|---|---|---|
| `game:{CODE}` (website vocab) | `clock_tick` `clock_start` `clock_stop` `shotclock_reset` `period_change` `clock_edit` `score_update` `game_snapshot` | website HostConsole, pi-daemon, app `WebsiteBroadcastService` |
| `game:{CODE}` (legacy app vocab) | `score_update` `clock_sync` `game_action` `request_clock_stop` `shot_clock_reset` `shot_clock_toggle` `stats_update` | app↔app roles; migrate to website vocab in P4 |
| `coach:{CODE}` | postgres_changes on `shot_events` (INSERT filtered by `game_code`; DELETE unfiltered) | app `CoachGameLink` |
| `cast-control:{TVCODE}` | `phone-connected` `config-update` `setup-start` `watch-game` | P2 setup/handover |
| `webrtc-{CODE}` | `signaling` | clock-sync WebRTC (low-latency clock) |
| `webrtc-lan-{CODE}` | `signaling` | **LAN Direct Link** (see §5) — deliberately separate from `webrtc-{CODE}` |

`score_update` payload: `{teamA, teamB, foulsA, foulsB, timeoutsA, timeoutsB, possession, [period], ts}`.
`clock_tick`: `{minutes, seconds, tenths, shotClock, [period, gameRunning], ts}`.

### Tables
- **`games`** — `code` PK (4 chars, no O/I/0/1), `hostId`, `status: live|completed|archived`,
  `data` JSONB = full snapshot (settings / gameState / teamA / teamB with rosters). App model:
  `BoxGame` (`lib/models/game_models.dart`).
- **`shot_events`** — one row per made shot. Quick-mode ref +2 →
  `{zone:'unlocated', player_id:null, x:null, y:null, points, shot_type:'field_goal'|'free_throw',
  period, game_clock_sec, input_method:'live'}`. **Ref UNDO = row DELETE.** Anon SELECT works.
- **`coach_annotations`** — migration `010` (§7). One row per coach per shot;
  `shot_event_id → shot_events.id ON DELETE CASCADE` (ref UNDO auto-cleans). RLS: coach owns
  insert/select/update/delete by `auth.uid() = coach_id`.

### Court coordinates & zones (NEVER change unilaterally)
Portrait half-court: x 0–100 (width), y 0–94 (depth from own endline), basket at (50, 10.5).
17 `ShotZoneId`s + 9 `ShotAttribute`s. Source of truth: website
`src/components/shotchart/courtZones.ts`, ported 1:1 to `lib/models/shot_models.dart`
(`kZones`, `classifyZone`, `kShotAttributes`) — must stay behaviorally identical.

### QR / deep-link URL space (parser: `lib/services/qr_parser.dart`)
`/watch/:code` · `/coach/:code?team=A|B&both=0|1` · `/coach-join?code=` · `/lan-control/:code` ·
`/cast?tv=` · `/arena/:code` · `/score/:code` · `/co-score/:code` · `/shot-clock/:code` ·
`/stats-op/:code` · raw 4-char code · custom scheme `thebox://<same paths>`.
App Links host: `theboxbybmsce.in` (verified via `public/.well-known/assetlinks.json`).

---

## 5. LAN Direct Link protocol (built on website; app P3)

Zero-latency peer-to-peer game feed over gym WiFi, so the LED/receiver updates even when gym
internet is slow/down. Reference impl on the website:
`src/services/webrtcSync.ts` (`HostWebRTCManager` / `SpectatorWebRTCManager`),
`src/hooks/useLanGameLink.ts` (`useDirectLinkHost`, `useDirectLinkReceiver`, `useMirrorQueue`),
controller page `src/pages/LanControlPage.tsx` at `/lan-control/:gameCode`.

- **Signaling:** Supabase realtime channel **`webrtc-lan-{CODE}`** (the manager prepends
  `webrtc-` to the `lan-{CODE}` name). Event `signaling`, payloads
  `{type: join|offer|answer|ice, target, clientId, sdp|candidate}`. Receiver announces with
  `{type:'join', target:'host', clientId}`; host offers; receiver answers; ICE both ways.
- **Data channels:** `game-sync` (ordered:true, maxRetransmits:0 — lossy, low-latency ticks) +
  `game-snapshot` (ordered:true, **reliable** — full snapshots).
- **Payload `DirectLinkSnapshot v:1`** (on `game-snapshot`):
  `{v:1, gameCode, teamA{name,score,fouls,timeouts,color}, teamB{…}, clock{gameMs,shotMs,isRunning,period,totalPeriods}, possession:'A'|'B'|null, ts}`.
  Host pushes a FRESH snapshot every ~250ms (receiver re-anchors interpolation to each; never
  resend stale or the clock jumps back).
- **Cloud mirror:** `useMirrorQueue` best-effort writes to Supabase (coalesced state persist +
  ordered event inserts, retry on reconnect) so public spectators still see the game.

**App P3 job:** add `flutter_webrtc`; implement a receiver (LED display) and controller that speak
exactly the above. Full test needs 2 devices on the same WiFi.

---

## 6. Roadmap (status)

| Phase | What | Status |
|---|---|---|
| **P1** | Foundation + **Coach Mode** | ✅ built · ⛔ blocked (see §7) |
| **P2** | Setup & Handover (`cast-control`) | ✅ built · needs real Pi to verify loop |
| **P3** | **LAN Direct Link** (`flutter_webrtc`, §5) | ⛔ not started |
| **P4** | Scorer convergence — app emits website events + writes `shot_events` so website spectators see app-scored games (live shot chart) | 🟢 built (2026-06-15): scorer emits website vocab + writes `shot_events`; app spectator shows a live shot chart (`ShotFeed` → `ShotChartCourt`, located shots). Legacy events kept for co-scorer/operator roles |
| **P5** | Future — tournaments, player passport, FCM push, offline annotation queue, coach-data overlay on website charts, iOS, Play Store | ⛔ future |

**Constraints:** pi-daemon stays untouched; website-side changes stay minimal/static
(migration files + `assetlinks.json`).

Canonical plans: `~/.claude/plans/structured-splashing-stroustrup.md` (app A-to-Z) ·
`~/.claude/plans/cryptic-mapping-eich.md` (this session: docs + unblock P1).

---

## 7. Open blockers (Coach Mode does not work end-to-end until these clear)

1. **Migration 010 not applied to prod.** `supabase/migrations/010_coach_annotations.sql` is
   committed (`7be56b7`) but never run on project `eoowagimooxsqcrrihbw` → annotation SAVE 404s;
   `shot_events` may not be in the `supabase_realtime` publication.
   *Fix:* apply via Supabase MCP (needs a fresh `SUPABASE_ACCESS_TOKEN` — the one in `.env` is
   expired/Unauthorized) **or** paste the SQL into the dashboard SQL editor.
2. **Anonymous sign-in broken server-side.** `POST /auth/v1/signup {}` → `500 "Database error
   creating anonymous user"`. A trigger on `auth.users` (added outside tracked migrations) rejects
   null-email rows; also breaks the app's guest/DEV-ACCESS login. Coaches can't SAVE without it.
   *Fix:* diagnose triggers on `auth.users`, then modify the offending function to skip when
   `new.email is null` / `new.is_anonymous` (see `supabase/migrations/011_fix_anonymous_auth.sql`).
3. **Deploy gap.** `7be56b7` (assetlinks.json + migration file) is committed but **not pushed** →
   Vercel hasn't served `public/.well-known/assetlinks.json`, so App Links can't verify yet.
   *Fix:* `git push origin main`, then check `https://theboxbybmsce.in/.well-known/assetlinks.json`.

---

## 8. Idea catalog (creative directions)

**Built**
- **Court Experience (Pair 1, 2026-06-15)** — premium interactive court input (magnifier loupe
  above the finger, live zone chip, haptic zone-ticks, animated marker drop) +
  hex/zone heatmap shot chart (Markers/Heatmap/Zones toggle, staggered reveal) in the coach board.
  Files: `lib/widgets/court/{tappable_court,half_court_painter,shot_chart}.dart`,
  integrated in `lib/screens/coach/coach_live_screen.dart`.
- **Scorer convergence (Pair 2 / P4, 2026-06-15)** — the app scorer emits the website event
  vocab (`WebsiteBroadcastService`) + writes `shot_events` (`GameService.writeShotEvent`), and the
  app spectator renders a live shot chart (`lib/services/shot_feed_service.dart` → `ShotChartCourt`).
- Coach Mode — private per-coach shot enrichment dataset alongside the ref's authoritative record.
- Setup & Handover — phone configures the Pi, then hands over (Pi scores) or keeps scoring.
- App split-role scoring — co-scorer, shot-clock operator, stats operator on separate phones.
- Web phone scorer — `/host` as a tactile touch deck mirroring the Pi referee feel.
- Universal QR / deep-link connect — scan any website QR → app opens (App Links), website otherwise.

**Planned**
- LAN Direct Link (P3) — phone as zero-latency controller AND LED receiver over gym WiFi.
- Scorer convergence (P4) — app-scored games fully visible to website spectators + live shot chart.
- Tournaments module, player passport (`player_profiles`).
- FCM push — "game started", "your team is down 2 in Q4".
- Offline annotation queue; coach-data overlay on the website's shot charts.
- iOS build + Play Store distribution; real release keystore (add its SHA-256 to `assetlinks.json`).

**Candidate new ideas (not yet planned)**
- Coach analytics export/share (per-game PDF / image card from `coach_annotations`).
- Per-player shot heatmaps; lineup +/- from shot timelines.
- Voice / one-tap annotation to keep up with fast runs.
- Clip-tagging: bind a phone video timestamp to a `shot_events` row for instant highlights.
- Second-screen spectator stats (live shot chart + win-probability on the phone while watching).

---

## 9. Build & run

**Native app**
```bash
cd /Users/shrujalsrinath/Desktop/the_box_app
flutter pub get
flutter analyze                 # must stay clean
flutter build apk --debug       # or --release
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```
Flutter SDK: `/Users/shrujalsrinath/flutter/bin/flutter`. Emulator: `emulator-5554`.
Gotcha: `adb install -r` silently fails when the emulator `/data` is full (debug APK ~178 MB) —
always confirm it prints `Success` (`adb shell df /data`).

**Website**
```bash
cd /Users/shrujalsrinath/Downloads/BOXV2-TEST-main
npm install
npm run dev                     # local; Vercel auto-deploys on push to main
```
