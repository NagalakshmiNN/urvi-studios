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
// ---- Pay-first flow (2026-10+) ----
//
// The order record is NO LONGER created at checkout time. Instead, a
// checkout_sessions row holds the cart and customer data until payment is
// confirmed. This function now:
//
//   1. Looks for the order in the orders table (backward-compat for any
//      legacy PENDING orders still in flight at the moment of deploy, and
//      for future idempotent re-calls after the order has already been
//      materialised).
//   2. If not found there, looks in checkout_sessions.
//   3. If found in checkout_sessions: atomically claims the session (delete
//      returning), creates the real order + items, deducts stock, sends
//      notifications, and returns "confirmed".
//
// Because both callers can land within milliseconds, the claim is a
// DELETE … RETURNING — whoever deletes the session wins and does the work;
// the other finds nothing to delete and falls back to the orders table,
// where the order now exists (created by the winner), and returns "already".

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { adjustStockForLine } from "./stock";
import { sendOrderNotification, sendCustomerOrderConfirmation } from "./order-notify";
import { revalidateStockViews } from "./revalidate-stock";
import { sendWhatsApp } from "./whatsapp";
import { formatINR } from "./format";

export type ConfirmResult =
  | { ok: true; state: "confirmed" | "already"; orderNumber: string }
  | { ok: false; reason: "not-found" | "order-mismatch" | "amount-mismatch" };

/**
 * Shape of the JSON blob stored in checkout_sessions.payload.
 */
export interface CheckoutSessionPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  notes: string | null;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode: string | null;
  fulfilmentMethod: string;
  saleBy: string;
  newAccountEmail: string | null;
  lines: Array<{
    productId: string;
    productName: string;
    sku: string;
    size: string;
    color: string;
    qty: number;
    price: number;
    landedCost: number | null;
  }>;
}

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
  /**
   * What Razorpay says it actually took, in paise, when the caller knows it.
   * Razorpay enforces the amount fixed server-side when the order was
   * created, so a mismatch should be impossible — which is exactly why it is
   * worth checking. If it ever happens, something is misconfigured and an
   * order should not be quietly marked paid on the strength of it.
   */
  amountPaise?: number;
}): Promise<ConfirmResult> {
  const { orderNumber, razorpayOrderId, razorpayPaymentId, amountPaise } = opts;

  // ---- Path 1: check existing orders (backward-compat + idempotent re-calls) ----
  const existingOrder = orderNumber
    ? await db.query.orders.findFirst({ where: eq(schema.orders.orderNumber, orderNumber), with: { items: true } })
    : razorpayOrderId
    ? await db.query.orders.findFirst({ where: eq(schema.orders.razorpayOrderId, razorpayOrderId), with: { items: true } })
    : undefined;

  if (existingOrder) {
    // Validate cross-references when both are given.
    if (razorpayOrderId && existingOrder.razorpayOrderId !== razorpayOrderId) {
      return { ok: false, reason: "order-mismatch" };
    }
    if (typeof amountPaise === "number" && amountPaise !== existingOrder.total * 100) {
      console.error(
        `[confirm-paid-order] ${existingOrder.orderNumber} expects ${existingOrder.total * 100} paise but Razorpay captured ` +
          `${amountPaise} for payment ${razorpayPaymentId}. Not confirming — this needs a person.`
      );
      return { ok: false, reason: "amount-mismatch" };
    }
    if (existingOrder.paymentStatus === "PAID" || existingOrder.stockDeducted) {
      return { ok: true, state: "already", orderNumber: existingOrder.orderNumber };
    }

    // Legacy path: a PENDING order created before the pay-first migration.
    // Confirm it the old way with the conditional update.
    const claimed = await db
      .update(schema.orders)
      .set({
        paymentStatus: "PAID",
        status: "CONFIRMED",
        razorpayPaymentId,
        stockDeducted: true,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.orders.id, existingOrder.id), eq(schema.orders.stockDeducted, false)))
      .returning({ id: schema.orders.id });

    if (claimed.length === 0) {
      return { ok: true, state: "already", orderNumber: existingOrder.orderNumber };
    }

    // Deduct stock + notify (same as before).
    await deductStockAndNotify(existingOrder, existingOrder.items, razorpayPaymentId);
    return { ok: true, state: "confirmed", orderNumber: existingOrder.orderNumber };
  }

  // ---- Path 2: checkout session (the new pay-first flow) ----
  const session = orderNumber
    ? await db.query.checkoutSessions.findFirst({ where: eq(schema.checkoutSessions.orderNumber, orderNumber) })
    : razorpayOrderId
    ? await db.query.checkoutSessions.findFirst({ where: eq(schema.checkoutSessions.razorpayOrderId, razorpayOrderId) })
    : undefined;

  if (!session) {
    return { ok: false, reason: "not-found" };
  }

  // Cross-reference check.
  if (razorpayOrderId && session.razorpayOrderId !== razorpayOrderId) {
    return { ok: false, reason: "order-mismatch" };
  }
  if (orderNumber && session.orderNumber !== orderNumber) {
    return { ok: false, reason: "order-mismatch" };
  }

  const payload: CheckoutSessionPayload = JSON.parse(session.payload);

  // Amount check against the session's total.
  if (typeof amountPaise === "number" && amountPaise !== payload.total * 100) {
    console.error(
      `[confirm-paid-order] Session ${session.orderNumber} expects ${payload.total * 100} paise but Razorpay captured ` +
        `${amountPaise} for payment ${razorpayPaymentId}. Not confirming — this needs a person.`
    );
    return { ok: false, reason: "amount-mismatch" };
  }

  // Atomically claim the session — whoever deletes it wins.
  const claimed = await db
    .delete(schema.checkoutSessions)
    .where(eq(schema.checkoutSessions.id, session.id))
    .returning({ id: schema.checkoutSessions.id });

  if (claimed.length === 0) {
    // Someone else already consumed it. The order should now exist.
    // Wait a beat and check (the winner may still be inserting).
    await new Promise((r) => setTimeout(r, 500));
    const madeByOther = await db.query.orders.findFirst({
      where: eq(schema.orders.orderNumber, session.orderNumber),
    });
    if (madeByOther) {
      return { ok: true, state: "already", orderNumber: madeByOther.orderNumber };
    }
    // Extremely unlikely — the other caller claimed the session but
    // hasn't created the order yet. Return not-found and let the webhook
    // retry bring us back.
    return { ok: false, reason: "not-found" };
  }

  // We won the claim. Create the real order.
  const [order] = await db
    .insert(schema.orders)
    .values({
      orderNumber: session.orderNumber,
      customerId: session.customerId,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentMethod: "razorpay",
      stockDeducted: true,
      fulfilmentMethod: payload.fulfilmentMethod === "pickup" ? "pickup" : "delivery",
      saleBy: payload.saleBy,
      razorpayOrderId: session.razorpayOrderId,
      razorpayPaymentId,
      subtotal: payload.subtotal,
      shipping: payload.shipping,
      discount: payload.discount,
      total: payload.total,
      couponCode: payload.couponCode,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      addressLine1: payload.addressLine1,
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,
      notes: payload.notes,
    })
    .returning();

  const itemRows = payload.lines.map((l) => ({
    orderId: order.id,
    productId: l.productId,
    productName: l.productName,
    sku: l.sku,
    size: l.size,
    color: l.color,
    qty: l.qty,
    price: l.price,
    landedCostAtSale: l.landedCost,
  }));
  await db.insert(schema.orderItems).values(itemRows);

  // Deduct stock.
  for (const line of payload.lines) {
    if (line.productId) {
      await adjustStockForLine(line.productId, line.size, -line.qty);
    }
  }

  // Notifications.
  const notifyLines = payload.lines.map((l) => ({
    productName: l.productName,
    sku: l.sku,
    size: l.size,
    color: l.color,
    qty: l.qty,
    price: l.price,
  }));

  await sendOrderNotification({ ...order, paymentStatus: "PAID" }, notifyLines);
  await sendCustomerOrderConfirmation(
    { ...order, paymentStatus: "PAID" },
    notifyLines,
    payload.newAccountEmail ? { newAccountEmail: payload.newAccountEmail } : undefined
  );

  const itemSummary = notifyLines.map((l) => `• ${l.productName} (${l.size}) x${l.qty}`).join("\n");
  sendWhatsApp(
    `New paid order ${order.orderNumber}!\n\n` +
    `${itemSummary}\n\n` +
    `Total: ${formatINR(order.total)}\n` +
    `Customer: ${order.customerName}\n` +
    `Phone: ${order.customerPhone}`
  ).catch(() => {});

  revalidateStockViews();

  console.log(`[confirm-paid-order] Created and confirmed ${order.orderNumber} from checkout session.`);
  return { ok: true, state: "confirmed", orderNumber: order.orderNumber };
}

/**
 * Stock deduction + notifications for legacy PENDING orders (pre pay-first).
 * Extracted so the main function stays readable.
 */
async function deductStockAndNotify(
  order: { orderNumber: string; total: number; customerName: string; customerPhone: string; customerEmail: string; addressLine1: string; city: string; state: string; pincode: string; paymentMethod: string; paymentStatus: string; fulfilmentMethod?: string | null },
  items: Array<{ productId: string | null; productName: string; sku: string | null; size: string; color: string; qty: number; price: number }>,
  _razorpayPaymentId: string
) {
  for (const item of items) {
    if (item.productId) {
      await adjustStockForLine(item.productId, item.size, -item.qty);
    }
  }

  const lines = items.map((i) => ({
    productName: i.productName,
    sku: i.sku ?? "",
    size: i.size,
    color: i.color,
    qty: i.qty,
    price: i.price,
  }));

  await sendOrderNotification({ ...order, paymentStatus: "PAID" }, lines);
  await sendCustomerOrderConfirmation({ ...order, paymentStatus: "PAID" }, lines);

  const itemSummary = lines.map((l) => `• ${l.productName} (${l.size}) x${l.qty}`).join("\n");
  sendWhatsApp(
    `New paid order ${order.orderNumber}!\n\n` +
    `${itemSummary}\n\n` +
    `Total: ${formatINR(order.total)}\n` +
    `Customer: ${order.customerName}\n` +
    `Phone: ${order.customerPhone}`
  ).catch(() => {});

  revalidateStockViews();
}
