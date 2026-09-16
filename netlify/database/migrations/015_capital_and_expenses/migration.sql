-- Money going OUT, and the money that was put in to start with.
--
-- Until now this app only ever knew about money coming in: orders, their
-- items, what each piece cost us. The other half of the business — the capital
-- the owners put in, what gets paid to vendors for stock, and the packaging,
-- courier and platform costs of actually running it — lived only in an Excel
-- workbook. That made every profit figure in here a half-truth, and meant the
-- whole-business picture had to be assembled by hand from a spreadsheet and
-- went stale the moment anything was spent.
--
-- Amounts are in PAISE, as integers, for the same reason the Actual Sale Price
-- column is: a courier bill is ₹247.50 as often as it is ₹247, and floating
-- point cannot hold two decimal places exactly.

CREATE TABLE IF NOT EXISTS "capital_contributions" (
  "id" text PRIMARY KEY,
  -- The day the money actually moved, not the day it was typed in here.
  "contributed_on" date NOT NULL,
  "contributor" text NOT NULL,
  "amount_paise" integer NOT NULL,
  "mode" text NOT NULL,
  "reference" text,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" text PRIMARY KEY,
  "spent_on" date NOT NULL,
  -- One of the categories in src/lib/money.ts, which deliberately mirror the
  -- workbook's Expense Register so the two can still be read side by side.
  "category" text NOT NULL,
  "description" text NOT NULL,
  "payee" text,
  -- What was actually paid, GST included — the figure on the receipt.
  "amount_paise" integer NOT NULL,
  -- GST rate in basis points (1800 = 18%), so the tax portion can be shown
  -- without a second float. Null where GST doesn't apply or isn't known.
  "gst_rate_bp" integer,
  "payment_mode" text NOT NULL,
  "reference" text,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Both tables are read almost exclusively as "everything, newest first" and
-- "everything in a given month", so the date is the one column worth indexing.
CREATE INDEX IF NOT EXISTS "capital_contributions_date_idx" ON "capital_contributions" ("contributed_on");
CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses" ("spent_on");
CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses" ("category");
