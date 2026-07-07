-- ============================================================
-- THE BOX — Migration 012: shot_events advanced capture columns
--
-- Additive only. Adds shot-clock (possession) capture to the
-- basketball-only shot_events table. Safe on existing data — the
-- column is nullable and defaults to NULL for older rows.
--
-- Enables: "seconds into possession", early-vs-late shot-clock
-- efficiency, and possession-quality analytics in the stats hub.
-- ============================================================

ALTER TABLE shot_events
  ADD COLUMN IF NOT EXISTS shot_clock_sec INTEGER
  CHECK (shot_clock_sec IS NULL OR shot_clock_sec >= 0);

COMMENT ON COLUMN shot_events.shot_clock_sec IS
  'Shot-clock value (seconds remaining) at the moment of the shot. '
  'NULL for games captured before this migration or when no shot clock is used. '
  'Enables possession / early-vs-late-clock analytics.';
