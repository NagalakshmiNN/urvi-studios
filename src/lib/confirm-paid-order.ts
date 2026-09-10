// Marking a Razorpay order paid — the one place it happens.
//
// Two things can confirm the same order, and both routinely do:
//
//   1. the customer's browser, calling /api/checkout/verify-payment right
//      after Razorpay's checkout closes; and
//   2. Razorpay itself, calling /api/webhooks/razorpay from its own servers.
//
// The browser is the fast path but not a reliable one — the phone loses
// signal, the tab is closed, the request times out — and when it fails the
// money has already left the customer's account. The webhook is the one that
// always arrives, so the browser is treated as an optimisation and the
// webhook as the guarantee.
//
// Because both can land (in either order, and more than once), this is
// idempotent: the first caller confirms the order, deducts stock and sends
// the emails; every later caller finds the work already done and returns
// "already" without touching anything. stockDeducted is the real guard —
// deducting a second time would silently sell stock that is still on the
// shelf.

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { adjustStockForLine } from "./stock";
import { sendOrderNotification, sendCustomerOrderConfirmation } from "./order-notify";

export type ConfirmResult =
  | { ok: true; state: "confirmed" | "already"; orderNumber: string }
  | { ok: false; reason: "not-found" | "order-mismatch" };

/**
 * Confirm the order behind a successful Razorpay payment.
 *
 * Exactly one of `orderNumber` or `razorpayOrderId` is needed to find it —
 * the browser knows our order number, the webhook only knows Razorpay's id.
 * When both are given they must agree, which is what stops a valid payment
 * for one order being replayed against a different one.
 */
export async function confirmPaidOrder(opts: {
  orderNumber?: string;
  razorpayOrderId?: string;
  razorpayPaymentId: string;
}): Promise<ConfirmResult> {
  const { orderNumber, razorpayOrderId, razorpayPaymentId } = opts;

  const order = orderNumber
    ? await db.query.orders.findFirst({ where: eq(schema.orders.orderNumber, orderNumber), with: { items: true } })
    : razorpayOrderId
    ? await db.query.orders.findFirst({ where: eq(schema.orders.razorpayOrderId, razorpayOrderId), with: { items: true } })
    : undefined;

  if (!order) return { ok: false, reason: "not-found" };
  if (razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
    return { ok: false, reason: "order-mismatch" };
  }

  if (order.paymentStatus === "PAID" || order.stockDeducted) {
    return { ok: true, state: "already", orderNumber: order.orderNumber };
  }

  await db
    .update(schema.orders)
    .set({
      paymentStatus: "PAID",
      status: "CONFIRMED",
      razorpayPaymentId,
      stockDeducted: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, order.id));

  for (const item of order.items) {
    if (item.productId) {
      await adjustStockForLine(item.productId, item.size, -item.qty);
    }
  }

  const lines = order.items.map((i) => ({
    productName: i.productName,
    sku: i.sku ?? "",
    size: i.size,
    color: i.color,
    qty: i.qty,
    price: i.price,
  }));

  // The order is already saved as PAID above, so a mail failure can never
  // leave a paid order unconfirmed — sendMail swallows its own errors, and
  // this ordering means even an unexpected throw here can't roll that back.
  await sendOrderNotification({ ...order, paymentStatus: "PAID" }, lines);
  await sendCustomerOrderConfirmation({ ...order, paymentStatus: "PAID" }, lines);

  return { ok: true, state: "confirmed", orderNumber: order.orderNumber };
}
