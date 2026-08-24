import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { priceCart, nextOrderNumber, type CartLineInput } from "@/lib/order-pricing";
import { getCustomerSession } from "@/lib/auth";
import { SITE } from "@/lib/site-config";
import { formatINR } from "@/lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { items, customer, couponCode } = body as {
    items: CartLineInput[];
    customer: { name: string; email: string; phone: string; address: string; city: string; state: string; pincode: string; notes?: string };
    couponCode?: string;
  };

  if (!customer?.name || !EMAIL_RE.test(customer?.email || "") || !customer?.phone || !customer?.address || !customer?.city || !customer?.state || !/^\d{6}$/.test(customer?.pincode || "")) {
    return NextResponse.json({ error: "Please fill in every shipping field correctly." }, { status: 400 });
  }

  const pricing = await priceCart(items, couponCode);
  if (!pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 });

  const customerId = await getCustomerSession();
  const orderNumber = await nextOrderNumber();

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const razorpayConfigured = Boolean(keyId && keySecret);

  // Persist the order up front (PENDING). Stock is only decremented once
  // payment is actually confirmed (see verify-payment), so a browser that
  // never completes checkout never reserves inventory.
  const [order] = await db
    .insert(schema.orders)
    .values({
      orderNumber,
      customerId: customerId || null,
      status: "PLACED",
      paymentStatus: "PENDING",
      paymentMethod: razorpayConfigured ? "razorpay" : "whatsapp_cod",
      subtotal: pricing.subtotal,
      shipping: pricing.shipping,
      discount: pricing.discount,
      total: pricing.total,
      couponCode: pricing.couponCode,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      addressLine1: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      notes: customer.notes || null,
    })
    .returning();

  await db.insert(schema.orderItems).values(
    pricing.lines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      productName: l.productName,
      size: l.size,
      color: l.color,
      qty: l.qty,
      price: l.price,
    }))
  );

  if (!razorpayConfigured) {
    const lines = pricing.lines.map((l) => `• ${l.productName} (${l.size}, ${l.color}) x${l.qty} — ${formatINR(l.price * l.qty)}`).join("\n");
    const msg =
      `New order ${orderNumber} from ${customer.name}\n\n${lines}\n\nTotal: ${formatINR(pricing.total)}` +
      (pricing.freeShipping ? " (free shipping)" : " + shipping (confirm with customer based on pincode)") +
      `\n\nPhone: ${customer.phone}\nEmail: ${customer.email}\nAddress: ${customer.address}, ${customer.city}, ${customer.state} - ${customer.pincode}` +
      (customer.notes ? `\nNotes: ${customer.notes}` : "");
    const whatsappUrl = `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    return NextResponse.json({ configured: false, orderNumber, whatsappUrl });
  }

  const amountPaise = Math.round(pricing.total * 100);
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: orderNumber }),
  });

  if (!rzpRes.ok) {
    console.error("Razorpay order creation failed:", await rzpRes.text());
    return NextResponse.json({ error: "Could not start payment. Please try again." }, { status: 502 });
  }

  const rzpOrder = await rzpRes.json();
  await db.update(schema.orders).set({ razorpayOrderId: rzpOrder.id }).where(eq(schema.orders.id, order.id));

  return NextResponse.json({
    configured: true,
    order_id: rzpOrder.id,
    amount: rzpOrder.amount,
    key_id: keyId,
    orderNumber,
  });
}
