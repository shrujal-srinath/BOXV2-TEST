-- 009_arena_sessions.sql
-- Multi-Court Arena Session table

CREATE TABLE arena_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_code       char(4) UNIQUE NOT NULL,
  label            text NOT NULL DEFAULT 'Arena Session',
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  layout           text NOT NULL DEFAULT 'auto',
  game_codes       text[] NOT NULL DEFAULT '{}',
  max_slots        int NOT NULL DEFAULT 6,
  join_mode        text NOT NULL DEFAULT 'open',
  pending_requests jsonb NOT NULL DEFAULT '[]',
  status           text NOT NULL DEFAULT 'active',
  created_at       timestamptz DEFAULT now(),
  last_updated     timestamptz DEFAULT now()
);

ALTER TABLE arena_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY arena_public_read ON arena_sessions
  FOR SELECT USING (status = 'active');

CREATE POLICY arena_auth_write ON arena_sessions
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_arena_code    ON arena_sessions (arena_code);
CREATE INDEX idx_arena_creator ON arena_sessions (created_by);
CREATE INDEX idx_arena_status  ON arena_sessions (status);
