-- Whether the seven o'clock email actually ran.
--
-- The report worked when it was tested by hand and then did not arrive in the
-- morning, and there was no way to tell the two possible reasons apart: the
-- schedule never fired, or it fired and the send failed. The only record was
-- in Netlify's function logs, which means the answer to "did my report run?"
-- was a hunt through a dashboard — the same trap the build stamp was added to
-- get out of.
--
-- So every run writes a row: when, what triggered it, whether it worked, who
-- it went to, and what went wrong if anything did. An empty table is itself
-- the answer — it means nothing has ever called the report, which points at
-- the schedule rather than at the email.

CREATE TABLE IF NOT EXISTS report_runs (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- Which report. Only "stock-daily" today; named so a second report does not
  -- need a second table.
  kind       TEXT        NOT NULL,
  -- "schedule" when Netlify's timer called it, "manual" when somebody pressed
  -- the button. This is the distinction that makes the table worth having.
  source     TEXT        NOT NULL,
  ok         BOOLEAN     NOT NULL,
  -- Who it went to, comma separated, or empty when it never got that far.
  recipients TEXT        NOT NULL DEFAULT '',
  -- What went wrong, in the words the screen will show.
  note       TEXT,
  ran_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only query: the most recent runs of one kind.
CREATE INDEX IF NOT EXISTS report_runs_kind_time_idx ON report_runs (kind, ran_at DESC);
