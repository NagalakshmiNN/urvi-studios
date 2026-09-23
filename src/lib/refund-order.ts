// What happens to an order when the money goes back.
//
// Razorpay has always sent a webhook when a refund is made. This site
// acknowledged it and did nothing, which meant a refunded order stayed
// exactly as it was: paymentStatus PAID, status CONFIRMED, stock deducted.
// Three things were then wrong at once and none of them announced itself —
// the day's revenue counted a sale that had been given back, the shelf count
// stayed one garment short of what was actually on the shelf, and the order
// screen told whoever opened it that the customer had paid.
//
// Refunds are usually made from the Razorpay dashboard rather than from this
// site, so the webhook is the only way the shop's own records ever hear about
// one. That makes this the whole of the handling, not a convenience on top of
// it.
//
// As with confirmation, two callers can arrive for the same refund — Razorpay
// sends refund.created and payment.refunded for the same event, and retries
// anything it does not get a 2xx for. So the work is claimed with a
// conditional update and later callers find it already done.

import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { adjustStockForLine } from "./stock";
import { sendMail } from "./mailer";
import { formatINR } from "./format";
import { SITE } from "./site-config";
import { revalidateStockViews } from "./revalidate-stock";

export type RefundResult =
  | { ok: true; state: "refunded" | "partial" | "already"; orderNumber: string }
  | { ok: false; reason: "not-found" };

/**
 * Whether a refund covers the whole order.
 *
 * Compared in paise against the order total in rupees, because that is the
 * shape the two numbers arrive in. Razorpay refunds arrive as separate events
 * that each carry their own amount, so what matters is the running total
 * refunded so far, not the size of this one.
 */
export function isFullRefund(refundedPaise: number, orderTotalRupees: number): boolean {
  return refundedPaise >= orderTotalRupees * 100;
}

/**
 * Record a refund against the order that took the payment.
 *
 * A full refund undoes the sale: the order goes back to CANCELLED, the stock
 * goes back on the shelf, and the payment reads REFUNDED. A partial refund
 * does none of that — a customer refunded ₹200 of a ₹1,800 order for a mark
 * on a sleeve still has the garment, and putting it back on the shelf would
 * be a lie. The amount is recorded and the shop is told, and a person decides
 * what it means.
 */
export async function refundOrder(opts: {
  razorpayPaymentId: string;
  /**
   * Razorpay's id for this particular refund.
   *
   * This is what makes the whole thing idempotent. Razorpay sends several
   * events for one refund and retries any it gets no 2xx for; adding up the
   * amounts as they arrive would count the same money three times and turn a
   * ₹200 goodwill refund into a full one — cancelling the sale and putting a
   * garment back on the shelf that the customer still has.
   */
  refundId?: string;
  /** What this refund returned, in paise. */
  refundedPaise: number;
  /**
   * Razorpay's own running total for the payment when it sends one
   * (amount_refunded on the payment entity). Trusted as a floor, because a
   * refund made before this code existed would otherwise never be counted.
   */
  totalRefundedPaise?: number;
}): Promise<RefundResult> {
  const { razorpayPaymentId, refundId, refundedPaise, totalRefundedPaise } = opts;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.razorpayPaymentId, razorpayPaymentId),
    with: { items: true },
  });

  if (!order) return { ok: false, reason: "not-found" };

  // Record this refund, once. A repeat of the same refund id does nothing at
  // all — which is the point.
  if (refundId && refundedPaise > 0) {
    await db
      .insert(schema.orderRefunds)
      .values({ id: refundId, orderId: order.id, amountPaise: refundedPaise })
      .onConflictDoNothing();
  }

  const recorded = await db
    .select({ amountPaise: schema.orderRefunds.amountPaise })
    .from(schema.orderRefunds)
    .where(eq(schema.orderRefunds.orderId, order.id));
  const summed = recorded.reduce((sum, r) => sum + r.amountPaise, 0);

  // The largest of: what we have on file, what the distinct refunds add up
  // to, and what Razorpay says it has refunded in total. Never smaller than
  // any of them — a stale duplicate must not be able to reduce the figure.
  const runningTotal = Math.max(
    order.refundedPaise ?? 0,
    summed,
    typeof totalRefundedPaise === "number" ? totalRefundedPaise : 0,
    // An event with no refund id at all (an older payload shape) still counts
    // for something, rather than being silently dropped.
    refundId ? 0 : (order.refundedPaise ?? 0) + refundedPaise
  );

  const full = isFullRefund(runningTotal, order.total);

  if (!full) {
    // Partial. Nothing about the sale is undone — only recorded.
    await db
      .update(schema.orders)
      .set({ refundedPaise: runningTotal, refundedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.orders.id, order.id));

    await notifyShop(order.orderNumber, runningTotal, order.total, false);
    return { ok: true, state: "partial", orderNumber: order.orderNumber };
  }

  // Full refund. Claim it the same way a confirmation is claimed: the update
  // only lands if the order still thinks it holds the stock, so two webhooks
  // racing cannot put the same garments back twice.
  const claimed = await db
    .update(schema.orders)
    .set({
      paymentStatus: "REFUNDED",
      status: "CANCELLED",
      stockDeducted: false,
      refundedPaise: runningTotal,
      refundedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.orders.id, order.id), eq(schema.orders.stockDeducted, true)))
    .returning({ id: schema.orders.id });

  if (claimed.length === 0) {
    // Someone already handled it — but the amount may still have grown, so
    // record that much without touching the stock again.
    await db
      .update(schema.orders)
      .set({
        refundedPaise: sql`greatest(${schema.orders.refundedPaise}, ${runningTotal})`,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, order.id));
    return { ok: true, state: "already", orderNumber: order.orderNumber };
  }

  for (const item of order.items) {
    if (item.productId) {
      await adjustStockForLine(item.productId, item.size, item.qty);
    }
  }

  await notifyShop(order.orderNumber, runningTotal, order.total, true);
  revalidateStockViews();

  return { ok: true, state: "refunded", orderNumber: order.orderNumber };
}

/**
 * Tell the shop, because nothing else will.
 *
 * A refund made in the Razorpay dashboard leaves no trace anywhere anyone
 * here looks day to day. The email is the only thing that says the shelf
 * count just changed and a garment may be coming back.
 */
async function notifyShop(orderNumber: string, refundedPaise: number, orderTotal: number, full: boolean) {
  const amount = formatINR(Math.round(refundedPaise / 100));
  const headline = full
    ? `Order ${orderNumber} refunded in full — ${amount}`
    : `Order ${orderNumber} partly refunded — ${amount} of ${formatINR(orderTotal)}`;

  const body = full
    ? `${amount} has gone back to the customer, so this order is now cancelled and its stock has been put back on the shelf.\n\n` +
      `If the garment has not physically come back yet, the shelf count is ahead of reality until it does.`
    : `${amount} of ${formatINR(orderTotal)} has gone back to the customer.\n\n` +
      `The order is still confirmed and its stock is still deducted, because a part refund usually means the customer kept the garment. ` +
      `If they are actually returning it, mark the order Returned and the stock goes back.`;

  await sendMail({
    to: SITE.contactEmail,
    subject: headline,
    text: `${headline}\n\n${body}\n\nView in admin: https://urvi-studios.netlify.app/admin/orders/${orderNumber}`,
  });
}
