# Working Guidance — from Fable 5 to Opus 4.8 (and every future session)

> Written by Claude Fable 5 on 2026-07-07. Purpose: Shrujal will mostly work with Opus 4.8 and
> other models from tomorrow onward. This file transfers the judgment that made this session's
> analysis good, so future sessions start smart instead of re-deriving everything. Read
> `00-MASTER-CONTEXT.md` FIRST (facts), then this file (behavior).
>
> Design note: this file is deliberately organized as ~20 principles, not 200 rules. Models
> follow a small number of strong principles far more reliably than a long rule list. When in
> doubt, the principles at the top win.

---

## 1. Session boot protocol (do this before writing any code)

1. Read `fable-5/00-MASTER-CONTEXT.md` — top to bottom on your first session, the TOC + relevant
   sections thereafter.
2. Identify which of the four products this session touches, and read that product's own
   authority doc (map in master context §12). For Courtside that's its `CLAUDE.md` +
   `readme/future_plans.md` — non-negotiable reading.
3. Check `git status` in the repo you're touching. This ecosystem has a history of large
   valuable uncommitted changesets. Know what's dirty before you edit anything.
4. If the session touches the backend: try the Supabase MCP first. If the token is expired
   (historically common), say so immediately and either get it refreshed or fall back to writing
   migration files for manual application — never guess at prod state silently.

## 2. The ten ecosystem invariants (violating any of these causes silent, expensive damage)

1. **Wire contracts span 3+ codebases.** The realtime channel names, event names, and payload
   shapes in master context §6.2 are consumed by the website, the pi-daemon, the Flutter app,
   and spectators in the wild. Never rename or reshape one end alone. The pi-daemon's broken
   cloud spectators (bug #1) happened exactly this way: a rename landed on the producer only.
   When you change a contract, grep ALL THREE repos for the old name before calling it done.
2. **The coordinate law.** Shot coords persist as PORTRAIT half-court 0–100 × 0–94 (y = depth
   from own basket, basket at 50,10.5). Pi referee UI is LANDSCAPE 188×100, team A attacks
   LEFT. Convert only via `portraitToLandscape`/`landscapeToPortrait`. Website
   `courtZones.ts` ⇄ app `shot_models.dart` must stay behaviorally identical. Getting this
   wrong doesn't crash — it silently corrupts every future shot chart.
3. **Two worlds.** Tablet/Pi/kiosk routes (`/tablet/*`, `/referee`, `/tv`) never require auth
   and must work fully offline. Gyms have no internet; refs have no accounts.
4. **Verified stats only (Courtside).** There is no manual stat entry, ever. Every stat flows
   through the time-gated `submit_game_result` RPC or BOX capture. If a feature request implies
   self-entered stats, push back — it deletes the moat.
5. **The Courtside glossary.** "Court" = bookable sub-unit (Court 1, Court 2), NOT a sport
   surface drawing. Venue ⊃ court ⊃ slot; Booking ≠ Game. Re-read the glossary in Courtside's
   CLAUDE.md §2 whenever a prompt uses one of its words.
6. **Identity is resolved server-side.** After the §7 identity plan lands: no client ever
   decides "this is a new user" — it calls `resolve_identity()` first. No read-time joins on
   raw phone strings. One human = one `auth.users` row.
7. **One creation path per entity.** Profiles are created by trigger/RPC, verified stats by
   RPC, shot events by the established writers. Don't add a second write path "just for this
   feature" — that's how duplicates and drift are born.
8. **Prod changes go through migration files.** Even when applying via the SQL editor, the SQL
   must exist as a numbered migration in the owning repo first. The prod-drift mess (§6.4)
   exists because this rule was broken once.
9. **Daemon writes `made: true` only** — physical buttons fire on made baskets; miss logging
   doesn't exist yet. Don't build UI that assumes miss data exists for Pi-scored games.
10. **Design tokens are law in both Flutter apps.** No raw hex, no `Colors.*`, no magic
    numbers, `withValues` not `withOpacity`. Courtside CLAUDE.md §9–11 and the box app's
    `lib/core/tokens/` define them. On the website, follow the root CLAUDE.md design system.

## 3. How Shrujal works (calibrate to the human)

- He is the **product owner and solo builder, not an experienced software developer.** You are
  his engineering, design, and product team in one. Own the technical decisions; explain the
  consequential ones in plain language; never hide behind jargon.
- His prompts are **short, emotional, and visual** ("make it pop", "feels cheap", "like
  Strava"). Translate intent → implementation; don't bounce his words back or ask him for
  padding values. Courtside CLAUDE.md §5 has the exact translation table — it applies to ALL
  four products.
- **Ask about product; assume about implementation.** Ask when intent, user flow, scope, or
  data model is ambiguous. Assume (and state the assumption in one line) for anything purely
  technical. Never interrupt work for a question a senior engineer would just decide.
- He explicitly wants **pushback on bad ideas** and better alternatives proposed in 1–2 lines.
  Silently building something you believe is wrong is a failure mode here, not politeness.
- When he types an error, he'll paste it verbatim — take it literally. When he describes
  behavior emotionally, verify against the code before accepting the framing.
- He often works in long ambitious sessions. Help him land planes: prefer finishing and
  COMMITTING one thing over starting three.

## 4. Judgment principles (the "intelligence transfer" — how to think here)

1. **Read the code before trusting any doc, including this folder.** Every doc here records
   truth-at-a-date. Line numbers drift, screen tables go stale (Courtside's CLAUDE.md §12
   already lags its router). Docs tell you where to look and what was decided; the code tells
   you what IS.
2. **Look for the combined fix.** The best decision in the pi-daemon backlog came from Shrujal:
   one append-only `game_actions` journal simultaneously fixes analytics, crash recovery, AND
   play-by-play export. Before building two systems, ask whether one primitive serves both.
   Conversely: before adding a primitive, check whether an existing one already serves it.
3. **Fix the class, not the instance.** When you find a duplicate-identity bug, a channel-name
   mismatch, or a coordinate flip, assume the same mistake exists elsewhere in the ecosystem
   and grep for its siblings before declaring victory.
4. **Additive schema changes only, until there's a merge tool.** Prefer new columns/tables/
   views over mutating shapes other products read. Three products share this database; you can
   rarely see all consumers of a column from where you're standing.
5. **Order work by "what unblocks what."** Apply migrations 011/010 (15 minutes) before any
   Coach Mode work. Land identity (§7) before Courtside launch and before career stats. Commit
   the stats v2 tree before extending it. The master context roadmap (§10) is already ordered
   this way — respect the ordering unless Shrujal overrides.
6. **When two docs disagree on direction, the newer wins — but say so out loud.** Never
   silently pick. Same for prompts that conflict with a locked product principle: flag, then
   follow his call.
7. **Latency tiers, always mirrored.** Every realtime feature follows the same pattern: fastest
   local path first (Socket.io LAN / WebRTC), cloud as automatic fallback AND best-effort
   mirror so remote spectators never go dark. If you build a fast path without the mirror,
   you've traded reliability for speed — that trade is never accepted here.
8. **Guard the moat in SQL, not in Dart/TS.** The verified-stats time gate lives in a SECURITY
   DEFINER RPC precisely so clients can't fake it. Any future "can't be faked" property must be
   enforced the same way — client-side checks are UX, not security.
9. **Estimate the blast radius before touching `games.data`, `shot_events`, or the clock
   engine.** These are the three highest-fan-in structures in the ecosystem (persistence,
   broadcast, charts, stats engine, coach mode, exports all read them).
10. **Done means: builds clean, `flutter analyze` clean (Flutter repos), the change is
    committed in a reviewed slice, and the living docs are updated.** Not "the code is
    written."

## 5. Known failure modes of past AI sessions (do not repeat)

- **The #9 court failure:** asked for a "court selection screen", drew a basketball-court
  graphic. Cause: pattern-matching a glossary word. Cure: invariant #5.
- **The producer-only rename:** renamed broadcast events on the daemon but not the web
  consumers → cloud spectators silently frozen for weeks. Cure: invariant #1.
- **The trigger that broke everyone's guests:** a Courtside `auth.users` trigger, applied to
  prod outside tracked migrations, 500s every anonymous signup ecosystem-wide. Cure:
  invariants #7 and #8 — and remember that in a shared project, YOUR trigger fires on THEIR
  signups.
- **Hex-snap data loss:** the shot canvas snapped taps to hex centers before saving, so "exact"
  locations weren't. Cure: store raw input; derive presentation. Generalize: never persist a
  lossy transform when the raw value is available.
- **Doc rot:** COMPANION-APP.md said the_box_app "is NOT a git repo" — it is now. Cure: docs
  carry dates; verify anything load-bearing; update docs when you falsify them.
- **Uncommitted mega-trees:** ~1,000 lines of stats v2 work sat uncommitted for three weeks.
  Cure: commit reviewed slices the same session they're built.

## 6. Session end protocol

1. Commit (or explicitly hand Shrujal the reason not to).
2. Update the docs your work invalidated: this folder's master context for cross-product
   changes; `future_plans.md` for Courtside direction; COMPANION-APP.md / APP-MASTERPLAN.md for
   app work. Append decisions with absolute dates (e.g. "2026-07-07"), never "today".
3. If you changed the fable-5 folder, re-copy it to the other two repos (it lives in all
   three; BOXV2's copy is canonical).
4. In BOXV2 sessions, persist non-obvious cross-session facts to Claude memory as well.
5. Tell Shrujal in plain language: what shipped, what's verified vs untested, and the single
   most valuable next step.

## 7. Where to be extra careful vs where to move fast

**Move fast (low blast radius):** UI polish within the token systems · new screens on FakeData ·
docs · new stats visualizations reading the statsEngine · additive migrations kept in files.

**Slow down, verify, maybe ask (high blast radius):** anything in §4.9's three structures ·
auth/identity flows · realtime contracts · RLS policies and SECURITY DEFINER functions ·
the pi-daemon clock/state machine · deleting or "cleaning up" anything you didn't create ·
applying SQL to prod.
