// How many times a coupon has actually been used, and whether it may be used
// again.
//
// There is no separate counter column, deliberately. A counter is a second
// copy of a fact the orders table already holds, and the two drift: an order
// gets cancelled, a refund comes back, a row is deleted during a clean-up,
// and the counter keeps its old number forever. Then the shop either gives
// away discounts it meant to cap or refuses a code that has barely been used,
// and nothing on the screen explains why.
//
// So the count is derived. "Used" means an order that carries the code and
// actually stands — one that was paid for, or one whose stock has been taken
// off the shelf because somebody confirmed it. A cancelled order, a refunded
// one, and an abandoned checkout all stop counting, which is the behaviour
// anyone would expect without being told.

import { and, eq, isNotNull, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type CouponLimits = {
  usageLimit: number | null;
  perCustomerLimit: number | null;
};

export type UsageCounts = {
  /** Redemptions by everyone. */
  total: number;
  /** Redemptions by the one customer asked about, or null if none was given. */
  byCustomer: number | null;
};

/**
 * Orders that count as a redemption.
 *
 * Paid, or stock-deducted — and not cancelled or returned. The second half
 * matters: a cancelled order has its stock put back but keeps paymentStatus
 * PAID until it is refunded, and counting it would hold a coupon hostage to
 * a sale that was undone.
 */
function countsAsUsed() {
  return and(
    or(eq(schema.orders.paymentStatus, "PAID"), eq(schema.orders.stockDeducted, true)),
    ne(schema.orders.status, "CANCELLED"),
    ne(schema.orders.status, "RETURNED"),
    ne(schema.orders.paymentStatus, "REFUNDED")
  );
}

/**
 * Count redemptions of a code, optionally narrowed to one customer.
 *
 * `excludeOrderId` leaves one order out of the count — used when re-pricing
 * an order that already exists, so it does not see itself as somebody else's
 * redemption and refuse its own coupon.
 */
export async function countCouponUses(
  code: string,
  customerEmail?: string | null,
  excludeOrderId?: string
): Promise<UsageCounts> {
  const normalised = code.trim().toUpperCase();

  const rows = await db
    .select({
      id: schema.orders.id,
      email: sql<string>`lower(${schema.orders.customerEmail})`,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.couponCode, normalised), isNotNull(schema.orders.couponCode), countsAsUsed()));

  const kept = excludeOrderId ? rows.filter((r) => r.id !== excludeOrderId) : rows;
  const email = customerEmail?.trim().toLowerCase();

  return {
    total: kept.length,
    byCustomer: email ? kept.filter((r) => r.email === email).length : null,
  };
}

export type LimitVerdict = { ok: true } | { ok: false; error: string };

/**
 * Whether one more redemption is allowed, given the limits and the counts.
 *
 * Kept separate from the database so the rule itself can be read and tested
 * on its own — the counting is plumbing, this is the decision.
 *
 * The two refusals are worded differently on purpose. "Fully used" is the
 * shop's problem and nothing the customer can do changes it; "you have
 * already used this" tells them the code worked, just not twice, which is
 * the difference between a shopper giving up and a shopper emailing to ask.
 */
export function withinLimits(limits: CouponLimits, counts: UsageCounts): LimitVerdict {
  if (limits.usageLimit !== null && counts.total >= limits.usageLimit) {
    return { ok: false, error: "This coupon has been fully used." };
  }
  if (
    limits.perCustomerLimit !== null &&
    counts.byCustomer !== null &&
    counts.byCustomer >= limits.perCustomerLimit
  ) {
    return {
      ok: false,
      error:
        limits.perCustomerLimit === 1
          ? "You've already used this coupon — it's one order per customer."
          : `You've already used this coupon ${counts.byCustomer} times, which is the most allowed per customer.`,
    };
  }
  return { ok: true };
}

/** What is left of a coupon, for the admin screen. */
export function remainingUses(limits: CouponLimits, total: number): number | null {
  if (limits.usageLimit === null) return null;
  return Math.max(0, limits.usageLimit - total);
}

/**
 * Usage counts for every coupon at once, for the Coupons screen.
 *
 * One query rather than one per coupon: the screen lists all of them, and a
 * query per row is how a page that was instant becomes slow the month the
 * shop runs a dozen campaigns.
 */
export async function couponUsageTotals(): Promise<Map<string, number>> {
  const rows = await db
    .select({ code: schema.orders.couponCode, count: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(and(isNotNull(schema.orders.couponCode), countsAsUsed()))
    .groupBy(schema.orders.couponCode);

  return new Map(rows.filter((r) => r.code).map((r) => [r.code as string, Number(r.count)]));
}
