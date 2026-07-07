# Design Brief — THE BOX Advanced Shot Attribution Experience

> Written by Fable 5, 2026-07-07, for Shrujal to paste into **Claude Design** (or any design
> tool/session). Self-contained: context, current flaws, constraints, and the design asks.
> Code-truth source: `ADVANCED-STATS-MASTERPLAN.md` §1 (same folder).

## What this product moment is

THE BOX is a live basketball scoring platform (web + a Raspberry Pi referee touchscreen with
physical score buttons). In **advanced mode**, every time a ref presses a physical score button,
the touchscreen instantly becomes a **shot attribution flow**: a beautiful landscape court where
the ref taps WHERE the shot was made → picks WHO shot it → optionally tags HOW (fastbreak,
catch-and-shoot, contested…). It must be operable in ~3 seconds by a stressed courtside operator
while play continues. This is the flagship demo moment of the hardware product. Think: FIBA
LiveStats data rigor × NBA broadcast graphics polish × arcade-machine tactility.

The screen is **operator-only** (never spectator-facing), landscape, ~10-13" touch, often in a
bright gym. Dark theme is default; a light court theme exists and the chrome must support both.

## What already works (do NOT lose these)

- Magnifier loupe while dragging (2.4× zoom above the finger, shows court lines + nearby shots)
- Drag-to-adjust: press, slide to the exact spot, lift to commit
- 2/3-point zone lock: tapping the wrong side of the arc bounces with an educational toast
- Off-half dimming + pulsing beacon on the scoring team's basket + line-to-rim ruler
- Quick-spot chips (AT RIM / FT / TOP 3 / corners / wings) for one-tap entry
- Haptic language on the court (tap 10ms · reject double-buzz · commit "logged" pattern)
- Per-step countdown rings (player 12s, context 9s) so the flow never blocks the game
- Team color threads through everything (banner, rings, chips, buttons)

## The flaws to fix (ranked, code-verified)

1. **No ending.** Recording a shot gives zero receipt — the screen just vanishes. The flow's
   emotional arc dies at the most important beat. Need a ~600ms "SHOT LOGGED · #23 · CORNER 3"
   confirmation moment (court thumbnail with the marker, checkmark, haptic), then exit.
2. **No beginning.** The flow hard-mounts full-screen instantly — no scrim, scale, or slide.
   (Ironically our stats-mode picker has a nicer scale-in + sliding-header entrance.)
3. **Step changes are a flat 180ms opacity fade.** Court→player→context should have
   directional motion (slide/parallax) + content stagger so the operator feels progression.
4. **Timeouts expire silently.** The countdown ring hits zero and the screen vanishes.
   Needs escalation: ring color shift + pulse + tick haptics for the last 3 seconds.
5. **Theme mismatch.** The court supports light/dark; the surrounding chrome (header, prompt
   banner, player grid, footer) is hardcoded near-black (#060810). Chrome must join the theme.
6. **Buttons are hand-rolled and flat.** No pressed/disabled/pending states beyond a 0.95
   scale; player tiles barely react on selection; attribute chips are plain outlined pills.
7. **Three confusing exits** — "SKIP LOCATION", "UNATTRIBUTED", "✕" overlap semantically.
   Need one consistent language: BACK (one step), SKIP (this step, keep going), ✕ (dismiss all).
8. **Haptics stop at the court** — player select, attribute toggle, and finalize are silent.
9. **Empty roster dead-end** — "NO ROSTER — MARK UNATTRIBUTED" is text, not a button.
10. **A second score arriving mid-flow silently destroys progress** (engineering fixes this
    with a queue — design the "1 PENDING" chip + queued-event handoff moment).
11. **Web version** additionally: a yellow off-brand "Who Scored?" popup (being deleted),
    8px-font control bar, no visual pointer that the court is the required next step.

## New capabilities the redesign must include

- **MISS button** on the referee screen (per team) entering the same flow with a "MISS"
  visual state (red/X language vs green/check for makes) — misses are how FG% heatmaps and
  real analytics unlock.
- **"+ ASSIST" chip on the confirmation moment** → optional single-tap second-player pick
  (4s window, skippable). One extra beat, huge data value.
- **Pending-event queue chip** (top corner): "1 PENDING" when a second score fires mid-flow.

## Design-system constraints

- Fonts already in product: display/scores use an Oswald-like condensed (`OSW`), body uses
  Roboto Mono-ish (`RM`) on the Pi; the web design system is Space Grotesk + Inter. Recommend
  unifying the Pi flow on the product family (Space Grotesk numerals, tabular figures).
- Team colors are dynamic (any hex) — everything accents off them; never hardcode team hues.
- Brand: THE BOX wordmark, red #E8112D accent family, dark surfaces #080A0F/#0F1117 (see
  courtside/box-app tokens), FUI/broadcast flavor welcomed (corner brackets, scanlines exist).
- Touch targets ≥ 44px (buttons currently 44-58px — keep or grow; web console's 8px-font
  controls are the anti-pattern).
- Every animation needs a reduced-motion variant (hook already exists in code).
- Timing budget: entrance ≤ 250ms, step transition ≤ 200ms, receipt moment ≤ 700ms total —
  the operator is mid-game; polish must never slow the 3-second flow.

## Deliverables to ask Claude Design for

1. The five-beat motion storyboard: mount → court tap/drag+commit → player pick → context
   tags → receipt & exit (with the assist-chip variant).
2. Component sheet: PressButton variants (primary/ghost/danger/disabled/pending), player tile
   states (idle/pressed/selected), attribute chip states, countdown ring escalation states,
   MISS vs MAKE visual language, pending-queue chip.
3. Light + dark chrome themes matching the existing court themes.
4. The web console reskin direction: same components, docked layout (roster rails + court +
   control deck) instead of full-screen steps.

## Reference points

FIBA LiveStats (data model rigor), NBA/ESPN broadcast lower-thirds (receipt moment), Easy
Stats' "2 taps for anything" economy, HomeCourt's delightful confirmations, arcade/FUI
aesthetics already in the repo (corner brackets in PiStatsPlayerPicker, scanlines.svg).
