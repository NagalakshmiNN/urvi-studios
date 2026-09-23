-- Two ways money could leak out of the shop unnoticed.
--
-- 1. A coupon had no ceiling of any kind. WELCOME10 posted on Instagram, or
--    forwarded into a deals group, was redeemable by everyone who found it,
--    as many times each as they liked, until somebody thought to switch it
--    off by hand. The discount is real money and there was no limit on how
--    much of it could be given away.
--
--    Two ceilings, both optional so existing coupons keep behaving exactly
--    as they do today: how many times the code may be redeemed in total, and
--    how many times one customer may redeem it.
--
-- 2. A refund did not un-confirm an order. Razorpay sends a webhook when
--    money goes back; the site acknowledged it and did nothing. The order
--    stayed PAID with its stock deducted, so the day's revenue counted a
--    sale that had been given back and the shelf count stayed short of a
--    garment that was on the shelf.
--
--    The refund is recorded on the order itself — when, and how much — so a
--    partial refund is visible rather than being rounded into "cancelled".

ALTER TABLE coupons
  -- NULL means unlimited, which is what every coupon created so far is.
  ADD COLUMN IF NOT EXISTS usage_limit        INTEGER,
  ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refunded_at    TIMESTAMPTZ,
  -- In PAISE, matching what Razorpay sends. Order totals are whole rupees,
  -- but a refund can be for any amount and rounding one is how a rupee goes
  -- missing from a reconciliation.
  ADD COLUMN IF NOT EXISTS refunded_paise INTEGER NOT NULL DEFAULT 0;

-- Each refund, once.
--
-- Razorpay sends more than one event for a single refund (refund.created,
-- refund.processed, payment.refunded) and retries any it does not get a 2xx
-- for. Adding up event amounts would count the same money three times and
-- make a part refund look like a whole one, which would cancel a sale and put
-- a garment back on the shelf that the customer still has. Razorpay's own
-- refund id is the primary key, so a repeat is a no-op and the total is
-- always the sum of distinct refunds.
CREATE TABLE IF NOT EXISTS order_refunds (
  -- Razorpay's refund id, e.g. "rfnd_NkQ...". Not generated here.
  id           TEXT PRIMARY KEY,
  order_id     TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_paise INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_refunds_order_idx ON order_refunds (order_id);

-- Counting redemptions means asking "how many orders used this code", which
-- is a scan of the orders table by coupon_code. Only a handful of orders
-- carry one, so a partial index stays tiny.
CREATE INDEX IF NOT EXISTS orders_coupon_code_idx
  ON orders (coupon_code)
  WHERE coupon_code IS NOT NULL;

-- Per-customer counting adds the email to that question.
CREATE INDEX IF NOT EXISTS orders_coupon_code_email_idx
  ON orders (coupon_code, lower(customer_email))
  WHERE coupon_code IS NOT NULL;
