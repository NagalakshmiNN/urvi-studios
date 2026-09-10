// The fast path: the customer's browser tells us the payment succeeded, and
// we check Razorpay's signature before believing it.
//
// This is no longer the only path. /api/webhooks/razorpay does the same job
// from Razorpay's own servers and always arrives, so if this request never
// makes it the order still confirms. Both call confirmPaidOrder, which is
// idempotent — whichever gets there first does the work.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { confirmPaidOrder } from "@/lib/confirm-paid-order";

function signatureMatches(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return NextResponse.json({ verified: false, error: "Not configured." }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ verified: false, error: "Invalid request." }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderNumber } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderNumber) {
    return NextResponse.json({ verified: false, error: "Missing verification fields." }, { status: 400 });
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (!signatureMatches(expected, razorpay_signature)) {
    return NextResponse.json({ verified: false });
  }

  const result = await confirmPaidOrder({
    orderNumber,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { verified: false, error: result.reason === "not-found" ? "Order not found." : "Order mismatch." },
      { status: 400 }
    );
  }

  return NextResponse.json({ verified: true, orderNumber: result.orderNumber });
}
