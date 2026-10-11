// Automatic expiry of abandoned checkouts.
//
// ---- Pay-first flow (2026-10+) ----
//
// A checkout_sessions row holds the cart and customer data until payment is
// confirmed. If the customer abandons the Razorpay modal, the session row
// stays around forever. This module deletes those stale sessions after a
// configurable window (default 45 minutes).
//
// It also handles legacy PENDING orders created before the pay-first
// migration, marking them ABANDONED after the same window.
//
// Called opportunistically at the start of each new checkout — no cron or
// scheduled function needed. The query is cheap and idempotent.

import { and, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** How many minutes an unpaid checkout survives before being expired. */
const ABANDON_MINUTES = 45;

/**
 * Clean up stale checkout sessions and legacy unpaid orders.
 *
 * 1. Deletes checkout_sessions older than ABANDON_MINUTES.
 * 2. Marks legacy PENDING Razorpay orders as ABANDONED (backward-compat).
 *
 * Returns the total count of items expired this run.
 */
export async function expireAbandonedCheckouts(): Promise<number> {
  try {
    let count = 0;

    // 1. Delete stale checkout sessions (the new pay-first path).
    const expiredSessions = await db
      .delete(schema.checkoutSessions)
      .where(
        lt(schema.checkoutSessions.createdAt, sql`NOW() - INTERVAL '45 minutes'`)
      )
      .returning({ id: schema.checkoutSessions.id });

    if (expiredSessions.length > 0) {
      console.log(`[expire-abandoned] Deleted ${expiredSessions.length} stale checkout session(s).`);
      count += expiredSessions.length;
    }

    // 2. Mark legacy PENDING Razorpay orders as ABANDONED (pre pay-first).
    const expiredOrders = await db
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
          lt(schema.orders.createdAt, sql`NOW() - INTERVAL '45 minutes'`)
        )
      )
      .returning({ id: schema.orders.id });

    if (expiredOrders.length > 0) {
      console.log(`[expire-abandoned] Marked ${expiredOrders.length} stale legacy order(s) as ABANDONED.`);
      count += expiredOrders.length;
    }

    return count;
  } catch (err) {
    // Never let cleanup break the actual checkout.
    console.error("[expire-abandoned] Error:", err);
    return 0;
  }
}

/** @deprecated Use expireAbandonedCheckouts instead. */
export const expireAbandonedOrders = expireAbandonedCheckouts;
