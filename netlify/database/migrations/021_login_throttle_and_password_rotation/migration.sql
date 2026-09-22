-- Two things that were missing from sign-in.
--
-- 1. Nothing slowed a password guesser down. A login form with no limit is a
--    password cracker's front door, and it mattered more here because the
--    seeded admin password had been committed to the repository.
--
--    Attempts are recorded in the database rather than in memory because the
--    site runs as serverless functions: each request may land on a different
--    instance, so an in-memory counter resets constantly and protects nothing.
--
-- 2. Changing a password could not end the sessions opened with the old one.
--    password_changed_at is stamped on every change, and admin tokens issued
--    before that moment stop being accepted.

CREATE TABLE IF NOT EXISTS auth_attempts (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- "admin:someone@example.com" or "customer:someone@example.com". Scoped by
  -- account rather than by IP: a shared office or mobile network puts many
  -- honest people behind one address, and locking them all out to stop one
  -- guesser is its own kind of failure.
  attempt_key TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only query this table serves: how many failures for this key, recently.
CREATE INDEX IF NOT EXISTS auth_attempts_key_time_idx
  ON auth_attempts (attempt_key, created_at DESC);

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Existing admins get a timestamp in the past, so sessions they already hold
-- stay valid; only a real password change from here revokes anything.
UPDATE admin_users SET password_changed_at = created_at WHERE password_changed_at IS NULL;
