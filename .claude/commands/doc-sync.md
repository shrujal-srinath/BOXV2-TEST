---
description: End-of-session — update living docs, re-copy fable-5, commit
---

Run the session end protocol (`fable-5/OPUS-GUIDANCE.md` §6):

1. List what changed this session (code, schema, decisions).
2. Update every doc those changes invalidated: `fable-5/00-MASTER-CONTEXT.md` (cross-product
   facts, roadmap §10, blockers §11), `fable-5/plans/*` statuses, `COMPANION-APP.md` (app/wire
   changes), `readme-files/` specs. Use absolute dates (e.g. 2026-07-07), never "today".
3. If anything under `fable-5/` changed, re-copy the folder:
   `rm -rf /Users/shrujalsrinath/Desktop/the_box_app/fable-5 /Users/shrujalsrinath/Desktop/courtside/fable-5 && cp -R fable-5 /Users/shrujalsrinath/Desktop/the_box_app/fable-5 && cp -R fable-5 /Users/shrujalsrinath/Desktop/courtside/fable-5`
4. Verify the build (`npm run build` here; `flutter analyze` in Flutter repos if touched).
5. Commit in reviewed slices (ask Shrujal before pushing — pushes deploy to Vercel).
6. Save non-obvious cross-session facts to Claude memory.
7. Close with: what shipped, what's verified vs untested, single best next step.
