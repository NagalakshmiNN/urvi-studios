import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export async function POST(request: Request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return NextResponse.json({ verified: false, error: "Not configured." }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ verified: false, error: "Invalid request." }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderNumber } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderNumber) {
    return NextResponse.json({ verified: false, error: "Missing verification fields." }, { status: 400 });
  }

  const expected = createHmac("sha256", keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  const verified = expected === razorpay_signature;

  if (!verified) {
    return NextResponse.json({ verified: false });
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.orderNumber, orderNumber),
    with: { items: true },
  });

  if (!order || order.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json({ verified: false, error: "Order mismatch." }, { status: 400 });
  }

  // Idempotent: if this order was already confirmed (e.g. a retried
  // callback), don't decrement stock a second time.
  if (order.paymentStatus !== "PAID") {
    await db
      .update(schema.orders)
      .set({ paymentStatus: "PAID", status: "CONFIRMED", razorpayPaymentId: razorpay_payment_id, updatedAt: new Date() })
      .where(eq(schema.orders.id, order.id));

    for (const item of order.items) {
      if (item.productId) {
        await db
          .update(schema.products)
          .set({ stock: sql`greatest(0, ${schema.products.stock} - ${item.qty})` })
          .where(eq(schema.products.id, item.productId));
      }
    }
  }

  return NextResponse.json({ verified: true, orderNumber: order.orderNumber });
}
