# PLAN S1-WIRING — Make both consoles render the attribution machine

> Fable 5, 2026-07-08. The machine (`src/services/shotAttribution.ts` + `useShotAttribution`)
> is built and contract-tested (22 goldens). This plan converts the two legacy surfaces into
> RENDERERS of it. Executor: read the machine's header + tests first — the tests ARE the flow
> contract. Do the WEB console first (it carries a live scoring bug); the Pi flow second.
> One surface per session. Wire payload shapes are frozen — this changes state management,
> never event names.

## Part 1 — Web console (`AdvancedConsole.tsx`) — kills the wrong-team bug

**Delete these local states + their logic:** `pending` (line ~151), `deferredShot` (~179),
the 10s auto-finalize timer (~218-224), `attrs` (the pending-flow copy), and
`TimedPlayerPopup.tsx` entirely (the off-brand yellow modal).

**Instantiate:** `useShotAttribution({ showContext: true, courtSec: 10, playerSec: 8,
contextSec: 9 }, onPayload)` — courtSec 10 preserves today's pending timeout; playerSec 8
preserves the deferred popup's 8s.

**Rewire the handlers:**
| Legacy | Becomes |
|---|---|
| `handleMade(side, pts, st)` FG branch | `onScoreChange(side, pts)` (score stays immediate on web) then `enqueue({id: nanoid/crypto, team: side, points: pts, made: true, period, gameClockSec, shotClockSec})`. If a roster player is pre-selected, call `selectPlayer(pid, name)` right after the court tap lands (see below) — or simpler: keep pre-selection by dispatching `SELECT_PLAYER` immediately after `TAP_COURT` when `getSel(side)` is set. |
| `handleMiss(side, pts, st)` | same enqueue with `made: false` (no score change) |
| FT branches | enqueue `{points: 1, made}` — machine skips court, zone `free_throw` |
| `handleCourtTap(x, y)` when a flow is active | `tapCourt(classifyZone(x,y), x, y)` |
| `handleCourtTap` when idle (old deferred entry) | **ask the operator the team** — replace the `x < 50` guess with a two-button chip overlay (team A / team B in team colors) anchored at the tap; on pick → `enqueue({..., team: picked, made: true, prefill: {zone, x, y}})`. This is the bug fix: the operator decides, never geometry. |
| attribute ribbon chips | `toggleAttr(id)` (render from `state.attrs`) |
| pending ribbon “Skip” / “×” | `skipStep()` / `dismiss()` |
| player pick UI (replaces TimedPlayerPopup) | render the machine's `player` step inline in the ribbon area: roster row buttons → `selectPlayer`, plus UNATTRIBUTED → `unattributed()`; countdown from `state.secondsLeft` |

**`onPayload` (the single sink):** `onShotRecorded({teamSide: p.team, playerId, points, made,
shotType: p.zone === 'free_throw' ? 'free_throw' : 'field_goal', x: p.x ?? null, y: p.y ?? null,
zone: p.zone, attributes: p.attributes})`; if the payload came from the deferred entry
(`prefill` events), ALSO `onScoreChange(p.team, p.points)` when `made` — deferred scores were
never applied up-front. Track which eventIds were deferred in a ref set.

**UI additions:** the pending ribbon shows `queuedCount` ("1 PENDING") when >0; the court
glow/arm state = `step === 'court'`.

**Verify:** build+tests; dev-server live game: score-first flow (both teams), tap-court-first
flow on BOTH halves choosing BOTH teams (the bug case), FT make/miss, miss buttons, tags,
timeouts (court 10s → unlocated; player 8s → unattributed), undo; spectator shot chart
receives every dot; `game_actions`/`shot_events` rows correct in Supabase.

## Part 2 — Pi flow (`PiAdvancedShotFlow.tsx` + `RefereeScreen.tsx`)

- Replace the flow's internal `steps/stepIndex/selectedZone/courtX/courtY/selectedAttrs/
  secondsLeft/finalize/goNext/goPrev` (lines ~247-330) with the hook (config:
  `{showContext: getShotTypeSelection(), courtSec: null, playerSec: 12, contextSec: 9}`).
  The step UIs stay — only their state source changes.
- `PiHexCourt.onZoneSelect(zone, portX, portY)` → `tapCourt(zone, portX, portY)`.
- Player tiles → `selectPlayer`; UNATTRIBUTED → `unattributed()`; SKIP LOCATION → `skipStep()`;
  `✕` → `dismiss()`; RECORD → `record()`.
- `onAttribute` ← the hook's payload (map field names 1:1 — they match `shot_attributed`).
- **RefereeScreen: delete the remount keying** (`key={team-points-...}`, lines ~672-690 AND
  the duplicate at ~775-790 — collapse to one block). Instead: on `scorePending`, call
  `enqueue(...)` and clear the daemon's pending flag; the flow stays mounted while
  `state.stepIndex >= 0`. Render the "N PENDING" chip from `queuedCount` (top-right).
- **Verify on the Pi (or dev_pico_message sim):** two rapid score presses mid-attribution —
  first attribution SURVIVES, second queues, both rows land; FT flow; timers expire with
  Pi-identical behavior; UNDO still works.

## Guards
- Zero wire changes: `shot_attributed` fields, `ui_action`, socket events untouched.
- `PiStatsPlayerPicker` (stats-mode) is a DIFFERENT surface — do not touch.
- If any behavior mismatch vs the machine is discovered, extend the MACHINE + its tests
  first, then the renderer — never fork logic back into a component.
