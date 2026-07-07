# fable-5 — Ecosystem Context Pack

Written by **Claude Fable 5** on **2026-07-07** in a dedicated context-building session with
Shrujal. Purpose: give every future AI session (Opus 4.8 and beyond) the full picture of the
THE BOX × Courtside ecosystem plus the working judgment to build on it well — without
re-deriving everything from the code.

## Read order

1. **`00-MASTER-CONTEXT.md`** — WHAT everything is. The four products (BOX website, pi-daemon
   hardware box, the_box_app companion, Courtside startup), the shared Supabase backend, the
   identity unification plan, everything done so far, and the locked roadmap. Read top to
   bottom on your first session.
2. **`OPUS-GUIDANCE.md`** — HOW to work here. Session protocols, the ten invariants, how
   Shrujal prompts, judgment principles, known AI failure modes.
3. **`CLAUDE-DRAFT.md`** — proposed replacement for the BOXV2 root `CLAUDE.md` (lean,
   pointer-based, per 2026 best practices). Status: **draft — awaiting Shrujal's review before
   promotion to repo root.** Only relevant to the website repo.
4. **`DESIGN-SYSTEM-WEB.md`** — the full BOX website design system (extracted from the original
   CLAUDE.md; referenced by the draft). Load only for website UI work.

## Copies

This folder lives in all three repos:

- `BOXV2-TEST-main/fable-5/` ← **canonical** (edit here)
- `the_box_app/fable-5/` ← copy
- `courtside/fable-5/` ← copy

If you change anything here, re-copy the folder to the other two repos before ending the
session (`OPUS-GUIDANCE.md` §6).

## Relationship to other docs

This pack is the cross-product authority. Product-internal docs still win inside their scope —
notably Courtside's own `CLAUDE.md` (glossary/tokens/rules) and `readme/future_plans.md`,
the_box_app's `APP-MASTERPLAN.md`, and BOXV2's `COMPANION-APP.md` + `readme-files/`. The full
precedence table is in `00-MASTER-CONTEXT.md` §12.
