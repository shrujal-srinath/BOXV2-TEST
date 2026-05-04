-- ============================================================
-- THE BOX — Migration 007: Extended Player Profile Columns
-- Adds columns that were defined in TypeScript types + service
-- but were missing from the player_profiles table in 006.
-- ============================================================

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS secondary_position  text,
  ADD COLUMN IF NOT EXISTS wingspan_cm         smallint,
  ADD COLUMN IF NOT EXISTS vertical_leap_cm    smallint,
  ADD COLUMN IF NOT EXISTS shuttle_run_sec     numeric(5,2),
  ADD COLUMN IF NOT EXISTS bench_press_kg      smallint,
  ADD COLUMN IF NOT EXISTS achievements        text[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS highlight_video_url text,
  ADD COLUMN IF NOT EXISTS instagram_handle    text,
  ADD COLUMN IF NOT EXISTS youtube_channel     text,
  ADD COLUMN IF NOT EXISTS twitter_handle      text,
  ADD COLUMN IF NOT EXISTS academic_year       text,
  ADD COLUMN IF NOT EXISTS graduation_year     smallint;

-- Index to support social handle lookups
CREATE INDEX IF NOT EXISTS idx_player_profiles_instagram ON player_profiles(instagram_handle) WHERE instagram_handle IS NOT NULL;
