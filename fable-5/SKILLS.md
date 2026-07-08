# Skills to install (researched 2026-07-08, Fable)

Agent-run install was permission-blocked (remote code). **Shrujal: run these yourself by
typing them with a `!` prefix in the Claude Code prompt** (runs in-session), then restart:

```
! npx skills add anthropics/skills@frontend-design
! npx skills add nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max
```

1. **frontend-design** (official Anthropic, 277k+ installs) — design intelligence: 50 styles,
   21 palettes, 50 font pairings, 20 chart types, React/Tailwind/Flutter stacks. Invoked as
   `/frontend-design` or auto-triggers on design asks. USE FOR: PLAN-U P4 (Pi ReviewHexChart),
   P6 (composer overhaul), S3 (Pi flow polish), every new stats panel.
2. **ui-ux-pro-max** — deeper UX review workflows (states, heuristics, a11y passes).
   USE FOR: the 100/100 design-bar audits in EXECUTION-LADDER.md's design loop.
3. Optional later: `giuseppe-trisciuoglio/developer-kit@shadcn-ui` (only if we adopt shadcn —
   we currently hand-roll on Tailwind tokens; do NOT install by default).
4. Math/geometry: no dedicated skill exists in the registries; our own golden-tested engines
   (courtZones, CourtGeometry, hexbinEngine) + COURT-PIPELINE-DEEPDIVE.md ARE the geometry
   authority. Don't let a generic skill override the coordinate law.

**How they slot into the loop:** skill pass (structure/style) → Claude Design pass
(DESIGN-BRIEF) → Shrujal screenshot sign-off. Skills assist the bar; they don't replace it.
