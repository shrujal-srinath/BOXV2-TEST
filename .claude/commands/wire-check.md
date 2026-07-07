---
description: Verify a realtime channel/event/payload name is consistent across all three repos
---

A wire-contract name is being added, renamed, or debugged: **$ARGUMENTS**

Realtime contracts span three codebases (see `fable-5/00-MASTER-CONTEXT.md` §6.2). Grep for
the name (and its obvious variants/old names) in ALL of:

1. `/Users/shrujalsrinath/Downloads/BOXV2-TEST-main/src` AND
   `/Users/shrujalsrinath/Downloads/BOXV2-TEST-main/pi-daemon`
2. `/Users/shrujalsrinath/Desktop/the_box_app/lib`
3. `/Users/shrujalsrinath/Desktop/courtside/lib`

Report every producer and every consumer found, whether the payload shapes match, and — if
this is a rename — the complete list of files that must change together. Never let a rename
land on a producer without its consumers (that exact mistake froze cloud spectators once —
`fable-5/OPUS-GUIDANCE.md` §5).
