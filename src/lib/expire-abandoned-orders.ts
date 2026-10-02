// Automatic expiry of abandoned Razorpay checkouts.
//
// An order is created BEFORE Razorpay opens (so we have something to match
// the payment back to). If the customer abandons the modal, the row stays
// in PLACED / PENDING / stockDeducted=false forever. This module marks
// those rows ABANDONED after a configurable window (default 30 minutes).
//
// Called opportunistically at the start of each new checkout — no cron or
// scheduled function needed. The query is cheap (index on created_at, small
// result set) and idempotent.

import { and, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** How many minutes an unpaid Razorpay order survives before being expired. */
const ABANDON_MINUTES = 30;

/**
 * Mark stale unpaid Razorpay orders as ABANDONED.
 *
 * Only touches orders that are:
 *  - paymentMethod = "razorpay"
 *  - paymentStatus = "PENDING"
 *  - stockDeducted = false  (never confirmed)
 *  - older than ABANDON_MINUTES
 *
 * Returns the count of orders expired this run.
 */
export async function expireAbandonedOrders(): Promise<number> {
  try {
    const cutoff = sql`NOW() - INTERVAL '${sql.raw(String(ABANDON_MINUTES))} minutes'`;

    const expired = await db
      .update(schema.orders)
      .set({
        status: "ABANDONED",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.orders.paymentMethod, "razorpay"),
          eq(schema.orders.paymentStatus, "PENDING"),
          eq(schema.orders.stockDeducted, false),
          eq(schema.orders.status, "PLACED"),
          lt(schema.orders.createdAt, sql`NOW() - INTERVAL '30 minutes'`)
        )
      )
      .returning({ id: schema.orders.id });

    if (expired.length > 0) {
      console.log(`[expire-abandoned] Marked ${expired.length} stale order(s) as ABANDONED.`);
    }

    return expired.length;
  } catch (err) {
    // Never let cleanup break the actual checkout.
    console.error("[expire-abandoned] Error:", err);
    return 0;
  }
}
