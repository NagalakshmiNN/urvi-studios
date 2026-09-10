// Payment verification — the one place where money and stock meet.
//
// No real Razorpay call is ever made: the endpoint verifies an HMAC
// signature locally, so the suite signs its own payloads with the test
// secret. That exercises the genuine verification logic, including the
// forgery and double-callback cases that would be unsafe to try live.

import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  createTestProduct,
  deleteTestProduct,
  deleteOrderByNumber,
  deleteCustomerByEmail,
  getOrderByNumber,
  getSizeStock,
  uniqueEmail,
  withDb,
} from "../setup/db";
import { RAZORPAY_TEST_SECRET, RAZORPAY_TEST_WEBHOOK_SECRET } from "../setup/env";
import { outboxLength, waitForMail } from "../setup/outbox";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
let product: Product;

test.beforeAll(async () => {
  product = await createTestProduct({ name: "Payment Test Product", price: 3000, stock: 9 });
});

test.afterAll(async () => {
  await deleteTestProduct(product.id);
});

function sign(orderId: string, paymentId: string) {
  return createHmac("sha256", RAZORPAY_TEST_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

/**
 * Place a real order through the checkout API, then mark it the way the
 * Razorpay path would have: awaiting payment against a Razorpay order id.
 */
async function placeAwaitingPaymentOrder(
  request: import("@playwright/test").APIRequestContext,
  // Which product to buy. The webhook suite passes its own, so that its
  // repeated purchases can't exhaust the stock the assertions above depend on.
  p: Product = product
) {
  const email = uniqueEmail("payer");
  const res = await request.post("/api/checkout/create-order", {
    data: {
      items: [{ productId: p.id, size: "M", color: p.colors[0].name, qty: 1 }],
      customer: {
        name: "Payment Tester",
        email,
        phone: "9876500222",
        address: "9 Payment Street",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
    },
  });
  expect(res.ok()).toBeTruthy();
  const { orderNumber } = await res.json();

  // Random suffix as well as the timestamp: two orders placed inside the same
  // millisecond would otherwise share a Razorpay order id, and a webhook for
  // one would confirm the other — which is exactly the kind of cross-talk
  // these tests exist to rule out.
  const razorpayOrderId = `order_TEST${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;
  await withDb((client) =>
    client.query("update orders set razorpay_order_id = $1, payment_method = 'razorpay' where order_number = $2", [
      razorpayOrderId,
      orderNumber,
    ])
  );

  return { orderNumber, razorpayOrderId, email };
}

test("a correctly signed payment confirms the order, takes the stock, and emails both sides", async ({ request }) => {
  const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request);
  const stockBefore = (await getSizeStock(product.id, "M"))!;
  const marker = outboxLength();

  const paymentId = "pay_TEST0001";
  const res = await request.post("/api/checkout/verify-payment", {
    data: {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(razorpayOrderId, paymentId),
      orderNumber,
    },
  });

  expect(res.ok()).toBeTruthy();
  expect((await res.json()).verified).toBe(true);

  const order = await getOrderByNumber(orderNumber);
  expect(order!.payment_status).toBe("PAID");
  expect(order!.status).toBe("CONFIRMED");
  expect(order!.stock_deducted).toBe(true);

  // Exactly one piece, from the exact size ordered.
  expect(await getSizeStock(product.id, "M")).toBe(stockBefore - 1);
  expect(await getSizeStock(product.id, "S")).toBe(3);

  const toShop = await waitForMail(marker, (m) => m.to === "urvistudios2026@gmail.com");
  expect(toShop.text).toContain("Paid via Razorpay");
  const toCustomer = await waitForMail(marker, (m) => m.to === email);
  expect(toCustomer.subject).toContain(orderNumber);

  await deleteOrderByNumber(orderNumber);
  await deleteCustomerByEmail(email);
});

test("a forged signature is refused and changes nothing", async ({ request }) => {
  const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request);
  const stockBefore = (await getSizeStock(product.id, "M"))!;

  const res = await request.post("/api/checkout/verify-payment", {
    data: {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: "pay_FORGED",
      razorpay_signature: "0".repeat(64),
      orderNumber,
    },
  });

  expect((await res.json()).verified).toBe(false);

  const order = await getOrderByNumber(orderNumber);
  expect(order!.payment_status).toBe("PENDING");
  expect(order!.status).toBe("PLACED");
  expect(order!.stock_deducted).toBe(false);
  expect(await getSizeStock(product.id, "M")).toBe(stockBefore);

  await deleteOrderByNumber(orderNumber);
  await deleteCustomerByEmail(email);
});

test("a signature for a different order is refused", async ({ request }) => {
  const { orderNumber, email } = await placeAwaitingPaymentOrder(request);

  // Correctly signed, but for someone else's Razorpay order id.
  const otherOrderId = "order_SOMEONEELSE";
  const paymentId = "pay_TEST0002";
  const res = await request.post("/api/checkout/verify-payment", {
    data: {
      razorpay_order_id: otherOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(otherOrderId, paymentId),
      orderNumber,
    },
  });

  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe("Order mismatch.");
  expect((await getOrderByNumber(orderNumber))!.payment_status).toBe("PENDING");

  await deleteOrderByNumber(orderNumber);
  await deleteCustomerByEmail(email);
});

test("a repeated callback does not take the stock twice", async ({ request }) => {
  const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request);
  const stockBefore = (await getSizeStock(product.id, "M"))!;

  const paymentId = "pay_TEST0003";
  const payload = {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: sign(razorpayOrderId, paymentId),
    orderNumber,
  };

  await request.post("/api/checkout/verify-payment", { data: payload });
  const stockAfterFirst = await getSizeStock(product.id, "M");
  expect(stockAfterFirst).toBe(stockBefore - 1);

  // Razorpay can retry a callback; the second one must be a no-op.
  const second = await request.post("/api/checkout/verify-payment", { data: payload });
  expect((await second.json()).verified).toBe(true);
  expect(await getSizeStock(product.id, "M")).toBe(stockBefore - 1);

  await deleteOrderByNumber(orderNumber);
  await deleteCustomerByEmail(email);
});

test("missing verification fields are rejected", async ({ request }) => {
  const res = await request.post("/api/checkout/verify-payment", { data: { orderNumber: "URVI-2026-00001" } });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe("Missing verification fields.");
});

// The webhook — the path that saved this feature. A payment used to be
// confirmed only by the customer's own browser; when that request failed the
// money was taken and the order sat unpaid with nobody told. Razorpay now
// calls us directly, so the browser is an optimisation rather than the only
// hope.
test.describe("the Razorpay webhook", () => {
  // Its own product with room to spare: these tests buy repeatedly, and
  // draining the shared one would break the stock assertions above.
  let hookProduct: Product;
  test.beforeAll(async () => {
    hookProduct = await createTestProduct({ name: "Webhook Test Product", price: 3000, stock: 60 });
  });
  test.afterAll(async () => {
    await deleteTestProduct(hookProduct.id);
  });

  function signWebhook(rawBody: string) {
    return createHmac("sha256", RAZORPAY_TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");
  }

  function paymentCaptured(razorpayOrderId: string, paymentId: string) {
    return JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId } } },
    });
  }

  async function post(request: import("@playwright/test").APIRequestContext, raw: string, signature: string) {
    return request.post("/api/webhooks/razorpay", {
      headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
      data: raw,
    });
  }

  test("confirms an order the customer's browser never managed to confirm", async ({ request }) => {
    const before = outboxLength();
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, hookProduct);
    const stockBefore = (await getSizeStock(hookProduct.id, "M"))!;

    // Placing the order sends its own mail, and it can still be in flight when
    // the marker is read. Wait for it first, so anything after the marker is
    // unambiguously the webhook's doing.
    await waitForMail(before, (m) => m.to === email);
    const marker = outboxLength();

    // No call to verify-payment at all — this is the customer whose phone
    // died the moment after paying.
    const raw = paymentCaptured(razorpayOrderId, "pay_HOOK0001");
    const res = await post(request, raw, signWebhook(raw));
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ ok: true, state: "confirmed", orderNumber });

    const order = await getOrderByNumber(orderNumber);
    expect(order!.payment_status).toBe("PAID");
    expect(order!.status).toBe("CONFIRMED");
    expect(order!.stock_deducted).toBe(true);
    expect(order!.razorpay_order_id).toBe(razorpayOrderId);
    expect(await getSizeStock(hookProduct.id, "M")).toBe(stockBefore - 1);

    // Both sides get told, which is the part that matters to actual people.
    // The shop's copy is matched on "Paid via Razorpay" — the placement mail
    // never says that, so this can only be the confirmation.
    const toShop = await waitForMail(marker, (m) => m.to === "urvistudios2026@gmail.com");
    expect(toShop.text).toContain("Paid via Razorpay");
    expect(toShop.text).toContain(orderNumber);

    const toCustomer = await waitForMail(marker, (m) => m.to === email);
    expect(toCustomer.text).toContain(orderNumber);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("a forged or mis-signed webhook changes nothing", async ({ request }) => {
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, hookProduct);
    const raw = paymentCaptured(razorpayOrderId, "pay_FORGED");

    // Signed with the payment key secret rather than the webhook secret —
    // the exact mistake that would quietly accept forged calls if the route
    // used the wrong key.
    const wrong = createHmac("sha256", RAZORPAY_TEST_SECRET).update(raw).digest("hex");
    expect((await post(request, raw, wrong)).status()).toBe(400);
    expect((await post(request, raw, "not-a-signature")).status()).toBe(400);

    // A valid signature over a *different* body must not carry over either.
    const otherRaw = paymentCaptured(razorpayOrderId, "pay_OTHER");
    expect((await post(request, raw, signWebhook(otherRaw))).status()).toBe(400);

    const order = await getOrderByNumber(orderNumber);
    expect(order!.payment_status).not.toBe("PAID");
    expect(order!.stock_deducted).toBe(false);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("the browser and the webhook both landing takes the stock only once", async ({ request }) => {
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, hookProduct);
    const stockBefore = (await getSizeStock(hookProduct.id, "M"))!;
    const paymentId = "pay_BOTH0001";

    // The browser gets there first…
    const verify = await request.post("/api/checkout/verify-payment", {
      data: {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(razorpayOrderId, paymentId),
        orderNumber,
      },
    });
    expect((await verify.json()).verified).toBe(true);

    // …and Razorpay's webhook arrives right behind it, twice, as it does
    // when a delivery is retried.
    const raw = paymentCaptured(razorpayOrderId, paymentId);
    for (const _ of [1, 2]) {
      const res = await post(request, raw, signWebhook(raw));
      expect(res.ok()).toBeTruthy();
      expect(await res.json()).toMatchObject({ ok: true, state: "already" });
    }

    // One payment, one piece of stock.
    expect(await getSizeStock(hookProduct.id, "M")).toBe(stockBefore - 1);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("a payment for an order we don't have is acknowledged, not retried forever", async ({ request }) => {
    // Returning 5xx here would make Razorpay retry indefinitely and
    // eventually disable the webhook, taking the working events down with it.
    const raw = paymentCaptured("order_DOESNOTEXIST", "pay_ORPHAN");
    const res = await post(request, raw, signWebhook(raw));
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, unmatched: "not-found" });
  });

  test("events we don't act on are acknowledged and ignored", async ({ request }) => {
    const raw = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_FAILED", order_id: "order_WHATEVER" } } },
    });
    const res = await post(request, raw, signWebhook(raw));
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ ok: true, ignored: "payment.failed" });
  });
});
