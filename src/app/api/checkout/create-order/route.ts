import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { priceCart, nextOrderNumber, type CartLineInput } from "@/lib/order-pricing";
import { getCustomerSession, hashPassword, createCustomerSession } from "@/lib/auth";
import { SITE } from "@/lib/site-config";
import { formatINR } from "@/lib/format";
import { sendOrderNotification, sendCustomerOrderConfirmation } from "@/lib/order-notify";
import { sendWhatsApp } from "@/lib/whatsapp";
import { expireAbandonedCheckouts } from "@/lib/expire-abandoned-orders";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Housekeeping: expire checkout sessions abandoned more than 45 minutes
  // ago. Runs opportunistically on each new checkout — cheap and idempotent.
  expireAbandonedCheckouts().catch(() => {});
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { items, customer, couponCode, fulfilmentMethod } = body as {
    items: CartLineInput[];
    customer: { name: string; email: string; phone: string; address: string; city: string; state: string; pincode: string; notes?: string };
    couponCode?: string;
    fulfilmentMethod?: string;
  };

  // Collecting in person needs no address — only who you are and how to
  // reach you when it's ready.
  const isPickup = fulfilmentMethod === "pickup";

  if (!customer?.name || !EMAIL_RE.test(customer?.email || "") || !customer?.phone) {
    return NextResponse.json({ error: "Please fill in every shipping field correctly." }, { status: 400 });
  }
  if (!isPickup && (!customer?.address || !customer?.city || !customer?.state || !/^\d{6}$/.test(customer?.pincode || ""))) {
    return NextResponse.json({ error: "Please fill in every shipping field correctly." }, { status: 400 });
  }

  // Checkout no longer requires an account up front — a logged-out visitor
  // can place an order as a guest. What happens next depends on whether
  // this email already has an account:
  //  - Already logged in: use that session's account, same as always.
  //  - New email, not logged in: a real account is created behind the
  //    scenes (a random password the customer never needs, since they're
  //    logged in for this browser right away) so the order — and any
  //    future one under the same email — is tracked under one account.
  //  - An email that already belongs to an existing account, but this
  //    browser isn't logged into it: rather than silently attaching a
  //    stranger's order to someone else's account (or silently logging
  //    into it without a password), this is turned back with a clear
  //    "please login" error — the checkout form surfaces that inline.
  // Price the cart BEFORE touching the customers table.
  //
  // The account used to be created first, so a request with an empty bag —
  // which fails pricing a few lines below — still left a real account behind
  // for whatever email address was sent, with a random password nobody holds.
  // Run a wordlist through it and the owners of those addresses can never
  // register and can never sign in. No payment, no order, no authentication
  // required.
  // The email goes in so a coupon capped at one per customer can actually
  // count what this customer has already used. The cart-page preview has no
  // email to offer, which is why the limit is re-checked here rather than
  // trusted from there.
  const pricing = await priceCart(items, couponCode, { customerEmail: customer.email });
  if (!pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 });

  let customerId = await getCustomerSession();
  let newAccountEmail: string | null = null;

  if (!customerId) {
    const emailLower = customer.email.trim().toLowerCase();
    const existing = await db.query.customers.findFirst({ where: eq(schema.customers.email, emailLower) });
    if (existing) {
      return NextResponse.json(
        { error: "An account already exists with this email. Please login to continue with checkout.", accountExists: true },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
    const [newCustomer] = await db
      .insert(schema.customers)
      .values({ name: customer.name, email: emailLower, phone: customer.phone, passwordHash })
      .returning();
    customerId = newCustomer.id;
    newAccountEmail = newCustomer.email;
    await createCustomerSession(customerId);

    // Alert the admin about the new registration (fire-and-forget).
    sendWhatsApp(
      `New customer registered on Urvi Studios!\n\n` +
      `Name: ${customer.name}\n` +
      `Email: ${emailLower}\n` +
      `Phone: ${customer.phone}`
    ).catch(() => {});
  }

  const orderNumber = await nextOrderNumber();

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const razorpayConfigured = Boolean(keyId && keySecret);

  // ---- WhatsApp / COD path: create the order immediately ----
  // No online payment step — the order IS the endpoint, so it is persisted
  // now and the customer completes payment offline.
  if (!razorpayConfigured) {
    const [order] = await db
      .insert(schema.orders)
      .values({
        orderNumber,
        customerId: customerId || null,
        status: "PLACED",
        paymentStatus: "PENDING",
        paymentMethod: "whatsapp_cod",
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        discount: pricing.discount,
        total: pricing.total,
        couponCode: pricing.couponCode,
        fulfilmentMethod: isPickup ? "pickup" : "delivery",
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        addressLine1: isPickup ? "" : customer.address,
        city: isPickup ? "" : customer.city,
        state: isPickup ? "" : customer.state,
        pincode: isPickup ? "" : customer.pincode,
        notes: customer.notes || null,
        saleBy: "Website",
      })
      .returning();

    await db.insert(schema.orderItems).values(
      pricing.lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        productName: l.productName,
        sku: l.sku,
        size: l.size,
        color: l.color,
        qty: l.qty,
        landedCostAtSale: l.landedCost,
        price: l.price,
      }))
    );

    const lines = pricing.lines.map((l) => `• ${l.productName} [ID: ${l.sku}] (${l.size}, ${l.color}) x${l.qty} — ${formatINR(l.price * l.qty)}`).join("\n");
    const msg =
      `New order ${orderNumber} from ${customer.name}\n\n${lines}\n\nTotal: ${formatINR(pricing.total)}` +
      (pricing.freeShipping ? " (free delivery)" : " + delivery charges (additional, confirmed with customer based on pincode)") +
      `\n\nPhone: ${customer.phone}\nEmail: ${customer.email}\n` +
      (isPickup
        ? "Collecting in person — no delivery needed"
        : `Address: ${customer.address}, ${customer.city}, ${customer.state} - ${customer.pincode}`) +
      (customer.notes ? `\nNotes: ${customer.notes}` : "");
    const whatsappUrls = SITE.whatsappOrderNumbers.map((n) => ({
      name: n.name,
      url: `https://wa.me/${n.number}?text=${encodeURIComponent(msg)}`,
    }));

    const notifyLines = pricing.lines.map((l) => ({ productName: l.productName, sku: l.sku, size: l.size, color: l.color, qty: l.qty, price: l.price }));
    await sendOrderNotification({ ...order, paymentMethod: "whatsapp_cod", paymentStatus: "PENDING" }, notifyLines);
    await sendCustomerOrderConfirmation(
      { ...order, paymentMethod: "whatsapp_cod", paymentStatus: "PENDING" },
      notifyLines,
      newAccountEmail ? { newAccountEmail } : undefined
    );

    const codItemSummary = notifyLines.map((l) => `• ${l.productName} (${l.size}) x${l.qty}`).join("\n");
    sendWhatsApp(
      `New order ${orderNumber} (WhatsApp/COD)!\n\n` +
      `${codItemSummary}\n\n` +
      `Total: ${formatINR(pricing.total)}\n` +
      `Customer: ${customer.name}\n` +
      `Phone: ${customer.phone}`
    ).catch(() => {});

    return NextResponse.json({ configured: false, orderNumber, whatsappUrls, accountCreated: Boolean(newAccountEmail), customerEmail: order.customerEmail });
  }

  // ---- Razorpay path: DO NOT create an order yet ----
  //
  // The order record is created ONLY when payment is confirmed (see
  // confirm-paid-order.ts). This stops unpaid checkouts from appearing in
  // the admin as real orders.
  //
  // A checkout session holds the cart and customer data in the meantime.
  // The webhook or the browser's verify-payment call consumes it.

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

  // Store everything in a checkout session — consumed when payment confirms.
  const payload = JSON.stringify({
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    addressLine1: isPickup ? "" : customer.address,
    city: isPickup ? "" : customer.city,
    state: isPickup ? "" : customer.state,
    pincode: isPickup ? "" : customer.pincode,
    notes: customer.notes || null,
    subtotal: pricing.subtotal,
    shipping: pricing.shipping,
    discount: pricing.discount,
    total: pricing.total,
    couponCode: pricing.couponCode,
    fulfilmentMethod: isPickup ? "pickup" : "delivery",
    saleBy: "Website",
    newAccountEmail,
    lines: pricing.lines.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      sku: l.sku,
      size: l.size,
      color: l.color,
      qty: l.qty,
      price: l.price,
      landedCost: l.landedCost,
    })),
  });

  await db.insert(schema.checkoutSessions).values({
    orderNumber,
    razorpayOrderId: rzpOrder.id,
    customerId: customerId || null,
    payload,
  });

  return NextResponse.json({
    configured: true,
    order_id: rzpOrder.id,
    amount: rzpOrder.amount,
    key_id: keyId,
    orderNumber,
    accountCreated: Boolean(newAccountEmail),
    customerEmail: customer.email,
  });
}
