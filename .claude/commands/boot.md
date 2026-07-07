---
description: Session boot — load ecosystem context and report state before any work
---

Run the session boot protocol for this ecosystem:

1. Read `fable-5/00-MASTER-CONTEXT.md` (TOC + the sections relevant to today's task; ALL of it
   if this is your first session) and `fable-5/OPUS-GUIDANCE.md`.
2. Run `git status --short` and `git log --oneline -5` in this repo. Report anything dirty.
3. If the task touches Supabase/auth/realtime: check whether the Supabase MCP token works
   (one cheap `list_tables` call); report if expired.
4. Check `fable-5/plans/README.md` — report which plan (if any) today's task belongs to and
   its status.
5. Then give Shrujal a 5-line summary: repo state, relevant plan, blockers, and your
   understanding of the task — before writing any code.

$ARGUMENTS
