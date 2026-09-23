// Razorpay tells us directly when a payment succeeds.
//
// Without this, an order is only ever confirmed by the customer's own browser
// calling /api/checkout/verify-payment. That request is one network hop away
// from failing — a phone that loses signal, a closed tab, a slow cold start —
// and when it fails the money has already been taken while the order sits
// unpaid, no stock deducted and no email sent to anyone. That is exactly what
// happened before this route existed.
//
// Razorpay retries a webhook that doesn't return 2xx, so anything we answer
// with a 5xx will come back. Two consequences shape the code below:
//
//   * a payment we cannot match to an order still returns 200 — retrying
//     would never help, and a permanently failing webhook gets disabled by
//     Razorpay, taking the working events down with it. It is logged loudly
//     instead, because it means money arrived that nothing here accounts for.
//   * a genuine failure on our side (the database is down) returns 500 on
//     purpose, so Razorpay tries again rather than dropping the payment.
//
// Setup, once, in the Razorpay Dashboard under Settings → Webhooks:
//   URL     https://<your-domain>/api/webhooks/razorpay
//   Events  payment.captured, order.paid,
//           refund.created, refund.processed, payment.refunded
//   Secret  any strong random string, set here as RAZORPAY_WEBHOOK_SECRET
// The secret belongs in Netlify's environment variables, never in this repo.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { confirmPaidOrder } from "@/lib/confirm-paid-order";
import { refundOrder } from "@/lib/refund-order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Every event that means money went back to a customer.
 *
 * Razorpay sends more than one for a single refund — refund.created when it
 * is made, refund.processed when it settles, and payment.refunded on the
 * payment itself once it is fully refunded. All three are handled, and the
 * handling is idempotent, because which of them arrive (and in what order)
 * depends on the refund speed and on which events are ticked in the
 * dashboard. Acting on whichever comes first is the only version that works
 * without knowing that.
 */
const REFUND_EVENTS = new Set(["refund.created", "refund.processed", "payment.refunded"]);

/** Constant-time compare, so a wrong signature can't be guessed byte by byte. */
function signatureMatches(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set — ignoring webhook.");
    // 200, not 500: retrying cannot fix a missing setting, and a webhook that
    // keeps failing gets switched off at Razorpay's end.
    return NextResponse.json({ ok: false, reason: "not-configured" });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) return NextResponse.json({ ok: false, reason: "no-signature" }, { status: 400 });

  // The signature is over the RAW body, so it must be read as text and
  // parsed only afterwards — re-serialising parsed JSON changes the bytes
  // and the signature would never match.
  const raw = await request.text();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (!signatureMatches(expected, signature)) {
    console.error("[razorpay-webhook] Signature did not match — ignoring.");
    return NextResponse.json({ ok: false, reason: "bad-signature" }, { status: 400 });
  }

  let body: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; amount?: number; amount_refunded?: number } };
      refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const event = body.event ?? "";

  // Money going back out. Handled before the paid events below, because
  // payment.refunded carries a payment entity that looks exactly like a
  // capture and would otherwise fall through to the confirm path.
  if (REFUND_EVENTS.has(event)) {
    return handleRefund(event, body);
  }

  // Both remaining events carry the payment entity. Anything else (failures,
  // settlement notices, disputes) is acknowledged and ignored, so subscribing
  // to extra events by accident can never break this route.
  if (event !== "payment.captured" && event !== "order.paid") {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const payment = body.payload?.payment?.entity;
  const razorpayPaymentId = payment?.id;
  const razorpayOrderId = payment?.order_id;
  if (!razorpayPaymentId || !razorpayOrderId) {
    console.error(`[razorpay-webhook] ${event} had no payment/order id — ignoring.`);
    return NextResponse.json({ ok: true, ignored: "incomplete-payload" });
  }

  try {
    const result = await confirmPaidOrder({
      razorpayOrderId,
      razorpayPaymentId,
      // Razorpay sends what it took; comparing it to the order total is the
      // one check that would catch a partial capture.
      amountPaise: typeof payment.amount === "number" ? payment.amount : undefined,
    });

    if (!result.ok) {
      // Money has been taken for something we can't find. Retrying won't help,
      // so acknowledge it — but say so in the logs, loudly, because it needs
      // a person.
      console.error(
        `[razorpay-webhook] Payment ${razorpayPaymentId} for Razorpay order ${razorpayOrderId} ` +
          `could not be matched to an order (${result.reason}). This needs checking by hand.`
      );
      return NextResponse.json({ ok: true, unmatched: result.reason });
    }

    if (result.state === "confirmed") {
      console.log(`[razorpay-webhook] Confirmed ${result.orderNumber} from ${event}.`);
    }
    return NextResponse.json({ ok: true, state: result.state, orderNumber: result.orderNumber });
  } catch (err) {
    // Our fault, not Razorpay's — ask to be called again rather than losing
    // the payment.
    console.error("[razorpay-webhook] Failed to confirm order:", err);
    return NextResponse.json({ ok: false, reason: "server-error" }, { status: 500 });
  }
}

/**
 * A refund event, whichever of the three shapes it arrived in.
 *
 * refund.* events put the refund in payload.refund and name the payment it
 * belongs to; payment.refunded puts the payment in payload.payment and
 * carries its running refunded total. Both are reduced to the same two
 * numbers before anything is decided.
 */
async function handleRefund(
  event: string,
  body: {
    payload?: {
      payment?: { entity?: { id?: string; amount?: number; amount_refunded?: number } };
      refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    };
  }
) {
  const refund = body.payload?.refund?.entity;
  const payment = body.payload?.payment?.entity;

  const razorpayPaymentId = refund?.payment_id ?? payment?.id;
  if (!razorpayPaymentId) {
    console.error(`[razorpay-webhook] ${event} named no payment — ignoring.`);
    return NextResponse.json({ ok: true, ignored: "incomplete-refund" });
  }

  const refundedPaise = typeof refund?.amount === "number" ? refund.amount : 0;
  const totalRefundedPaise = typeof payment?.amount_refunded === "number" ? payment.amount_refunded : undefined;

  // A refund event with neither its own amount nor a running total tells us
  // nothing we can act on, and guessing "the whole order" would cancel a sale
  // on no evidence.
  if (refundedPaise === 0 && totalRefundedPaise === undefined) {
    console.error(`[razorpay-webhook] ${event} for payment ${razorpayPaymentId} carried no amount — ignoring.`);
    return NextResponse.json({ ok: true, ignored: "no-amount" });
  }

  try {
    const result = await refundOrder({
      razorpayPaymentId,
      // Razorpay's own id for this refund, so the same one arriving three
      // times (created, processed, and the retry) is counted once.
      refundId: refund?.id,
      refundedPaise,
      totalRefundedPaise,
    });

    if (!result.ok) {
      // A refund against a payment no order claims. Retrying will not find
      // one, so it is acknowledged — but somebody needs to look, because
      // money left the account for something the books do not know about.
      console.error(
        `[razorpay-webhook] Refund on payment ${razorpayPaymentId} matches no order. This needs checking by hand.`
      );
      return NextResponse.json({ ok: true, unmatched: result.reason });
    }

    console.log(`[razorpay-webhook] ${event}: ${result.orderNumber} is now ${result.state}.`);
    return NextResponse.json({ ok: true, state: result.state, orderNumber: result.orderNumber });
  } catch (err) {
    console.error("[razorpay-webhook] Failed to record refund:", err);
    return NextResponse.json({ ok: false, reason: "server-error" }, { status: 500 });
  }
}
