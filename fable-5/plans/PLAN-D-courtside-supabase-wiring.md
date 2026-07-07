# PLAN D — Courtside: wire Supabase (kill FakeData in one pass)

> Fable 5, 2026-07-07. Authority for everything visual/product: `courtside/CLAUDE.md`
> (glossary! tokens! hard rules!) + `readme/future_plans.md`. This plan only sequences the
> data work. The one-pass strategy is deliberate (CLAUDE.md §12): don't wire screen-by-screen
> across many sessions — do domains in dependency order, each domain completed fully
> (provider + shimmer + error state + FakeData entry deleted) before the next.

## Phase 0 — Prod readiness (half a session)

1. Confirm Courtside migrations 001–005 are applied (PLAN A Phase 0 does this); apply gaps.
2. Seed REAL Bengaluru venues/courts/slots (replace/extend `004_seed.sql` data) — even 3–5
   real venues make every later demo honest.
3. Confirm Razorpay edge functions (`create-razorpay-order`, `verify-razorpay-payment`) are
   deployed and the keys in the dashboard are the intended (test-mode) ones.
4. **Do PLAN A Phases 0–3 before or alongside this plan** — every account created by a wired
   Courtside must be born clean. Wiring bookings to duplicate-prone accounts creates the data
   mess the identity plan exists to prevent.

## Phase 1 — Read paths (no money, no risk)

Order: `venues` + `courts` + `slots` → venue detail + home + explore + sport screens.
Pattern per CLAUDE.md: one provider per domain in `lib/providers/`, service does the query in
`lib/services/venue_service.dart` (it already exists — wire it, don't rewrite it), screens
swap `FakeData.X` → `ref.watch(xProvider)`, add `CsShimmer` loading + `CsErrorState` on every
converted screen, delete the entry from `fake_data.dart`. `flutter analyze` clean after each
domain.

## Phase 2 — Bookings + payment (the money path)

1. Slot availability must be enforced server-side (unique constraint / RPC on slot booking —
   check what 001/002 already provide; if it's client-checked only, add the constraint by
   migration BEFORE going live).
2. Booking wizard: draft state stays in `booking_draft_provider`; on pay → create razorpay
   order (edge function) → `razorpay_flutter` checkout → verify (edge function) → insert
   booking + hardware_rental rows → confirmation screen reads the real row.
3. My Bookings + Next Game card read real bookings (nearest upcoming logic).
4. Test the failure paths deliberately: payment abandoned, verify fails, slot taken between
   draft and pay. Each needs a designed UX, not a crash.

## Phase 3 — The wedge (time-gated scoring → verified stats)

1. Scoring unlock: basketball/cricket scorers check the active booking window (15 min before
   slot start → 4 h after). UI shows countdown until unlock (this is a product moment — make
   it feel earned, per CLAUDE.md aesthetics).
2. On game end → `submit_game_result` RPC (it enforces the window server-side; the client
   check is only UX). Handle its P0001 rejections gracefully.
3. Stats screen + stat share read real `player_stats` + `courtside_games` (later: the §8
   union view, once PLAN A lands and BOX-game linking exists).
4. Squad invitees: on booking completion, invited players' stat lines route to their profiles
   (requires identity resolution — another PLAN A dependency).

## Phase 4 — Marketplace + the rest

Products/reviews/cart/orders/addresses (schema exists in 001/004), then friends/pickup.
Independent of everything above; lowest priority; skip if time is short.

## Definition of done

`fake_data.dart` is empty-or-deleted · every screen has loading + error states · `flutter
analyze` clean · a real end-to-end run on a device: browse → book (test-mode pay) → wait for
window (or use a test booking with a now-slot) → score → verified stat appears on profile.

## Stop conditions

Schema doesn't match a service's expectations → stop, write a migration, don't bend the
client. Any temptation to add a manual stat entry "for testing" → NO (product principle #1);
seed test rows via SQL instead.
