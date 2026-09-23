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

  // Two events are subscribed in the Razorpay dashboard, payment.captured and
  // order.paid, but every test above this line sends only the first. If the
  // route ever read the payment entity from a path that order.paid doesn't
  // carry, the suite would stay green while half the configured events did
  // nothing — and which of the two arrives first is Razorpay's business, not
  // ours.
  test("order.paid confirms the order just as payment.captured does", async ({ request }) => {
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, hookProduct);
    const stockBefore = (await getSizeStock(hookProduct.id, "M"))!;

    // Shaped as Razorpay sends it: order.paid carries BOTH entities, and the
    // payment is the one we care about.
    const raw = JSON.stringify({
      entity: "event",
      event: "order.paid",
      contains: ["payment", "order"],
      payload: {
        payment: { entity: { id: "pay_ORDERPAID1", order_id: razorpayOrderId, status: "captured" } },
        order: { entity: { id: razorpayOrderId, amount: 300000, status: "paid" } },
      },
    });

    const res = await post(request, raw, signWebhook(raw));
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ ok: true, state: "confirmed", orderNumber });

    const order = await getOrderByNumber(orderNumber);
    expect(order!.payment_status).toBe("PAID");
    expect(order!.stock_deducted).toBe(true);
    expect(await getSizeStock(hookProduct.id, "M")).toBe(stockBefore - 1);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  // The real payload is forty-odd fields deep, not the four-field stub the
  // other tests send. Reading a field from the wrong nesting level is the
  // classic way an integration passes its own tests and then fails against
  // the actual gateway, so one test sends the genuine article.
  test("a full-size payload from Razorpay confirms the order", async ({ request }) => {
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, hookProduct);
    const stockBefore = (await getSizeStock(hookProduct.id, "M"))!;

    const raw = JSON.stringify({
      entity: "event",
      account_id: "acc_TESTACCOUNT",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: "pay_FULLSIZE01",
            entity: "payment",
            amount: 300000,
            currency: "INR",
            status: "captured",
            order_id: razorpayOrderId,
            invoice_id: null,
            international: false,
            method: "upi",
            amount_refunded: 0,
            refund_status: null,
            captured: true,
            description: `Order ${orderNumber}`,
            card_id: null,
            bank: null,
            wallet: null,
            vpa: "tester@okicici",
            email: "tester@example.com",
            contact: "+919876500222",
            notes: [],
            fee: 7080,
            tax: 1080,
            error_code: null,
            error_description: null,
            error_source: null,
            error_step: null,
            error_reason: null,
            acquirer_data: { rrn: "123456789012" },
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const res = await post(request, raw, signWebhook(raw));
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ ok: true, state: "confirmed", orderNumber });
    expect((await getOrderByNumber(orderNumber))!.payment_status).toBe("PAID");
    expect(await getSizeStock(hookProduct.id, "M")).toBe(stockBefore - 1);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("a webhook with no signature header at all is refused", async ({ request }) => {
    // Not a forged signature — none. Anyone who finds the URL can send this,
    // and the answer must be the same as for a bad one.
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, hookProduct);
    const raw = paymentCaptured(razorpayOrderId, "pay_NOSIG");

    const res = await request.post("/api/webhooks/razorpay", {
      headers: { "Content-Type": "application/json" },
      data: raw,
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, reason: "no-signature" });

    const order = await getOrderByNumber(orderNumber);
    expect(order!.payment_status).toBe("PENDING");
    expect(order!.stock_deducted).toBe(false);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("a correctly signed body that isn't JSON is refused", async ({ request }) => {
    // The signature proves it came from Razorpay; it proves nothing about the
    // body being parseable. Without the try/catch around JSON.parse this is an
    // unhandled throw, which Next answers with a 500 — and a 500 makes Razorpay
    // retry the same broken payload until it gives up and disables the webhook.
    const raw = "{ this is not json";

    // Sent as a Buffer rather than a string: given a string that doesn't parse
    // as JSON, Playwright re-encodes it before sending, so the bytes on the
    // wire stop matching the signature and the route rejects on the signature
    // instead — the test would pass on a 400 it never meant to assert.
    const res = await request.post("/api/webhooks/razorpay", {
      headers: { "Content-Type": "application/json", "x-razorpay-signature": signWebhook(raw) },
      data: Buffer.from(raw, "utf8"),
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, reason: "bad-json" });
  });
});

// Two findings from the second security audit.
test.describe("confirming a payment is atomic and checks the amount", () => {
  test("two confirmations arriving at once take the stock only once", async ({ request }) => {
    // The guard used to be a read: "is stockDeducted false?" then, separately,
    // "set it true and deduct". The browser and Razorpay's webhook routinely
    // arrive within milliseconds of each other, and Razorpay retries a webhook
    // it gets no 2xx for — so both would read false, both would pass, and one
    // payment would take two garments off the shelf.
    const product = await createTestProduct({ name: "Race Test Piece", price: 2000, stock: 9 });
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, product);
    const before = (await getSizeStock(product.id, "M"))!;
    const paymentId = "pay_RACE0001";

    const verifyBody = {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(razorpayOrderId, paymentId),
      orderNumber,
    };
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, amount: 200000 } } },
    });
    const webhookSig = createHmac("sha256", RAZORPAY_TEST_WEBHOOK_SECRET).update(raw).digest("hex");

    // Fired together, not one after the other — sequential calls were always
    // handled; it is the simultaneous pair that was broken.
    await Promise.all([
      request.post("/api/checkout/verify-payment", { data: verifyBody }),
      request.post("/api/webhooks/razorpay", {
        headers: { "Content-Type": "application/json", "x-razorpay-signature": webhookSig },
        data: raw,
      }),
      request.post("/api/checkout/verify-payment", { data: verifyBody }),
    ]);

    expect(await getSizeStock(product.id, "M")).toBe(before - 1);
    expect((await getOrderByNumber(orderNumber))!.payment_status).toBe("PAID");

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
    await deleteTestProduct(product.id);
  });

  test("a payment for the wrong amount does not confirm the order", async ({ request }) => {
    // Razorpay enforces the amount we fixed when the order was created, so
    // this should be impossible — which is why it is worth checking. If it
    // ever happens something is misconfigured, and an order must not be
    // marked paid on the strength of it.
    const product = await createTestProduct({ name: "Short Pay Piece", price: 2000, stock: 5 });
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, product);
    const before = (await getSizeStock(product.id, "M"))!;

    const raw = JSON.stringify({
      event: "payment.captured",
      // One rupee against a two-thousand rupee order.
      payload: { payment: { entity: { id: "pay_SHORT001", order_id: razorpayOrderId, amount: 100 } } },
    });
    const res = await request.post("/api/webhooks/razorpay", {
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": createHmac("sha256", RAZORPAY_TEST_WEBHOOK_SECRET).update(raw).digest("hex"),
      },
      data: raw,
    });

    // Acknowledged so Razorpay stops retrying, but the order stands unpaid
    // and the stock is untouched.
    expect(res.status()).toBe(200);
    expect((await getOrderByNumber(orderNumber))!.payment_status).toBe("PENDING");
    expect(await getSizeStock(product.id, "M")).toBe(before);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
    await deleteTestProduct(product.id);
  });
});

// Money going back out.
//
// Razorpay has always sent a refund webhook; the site acknowledged it and did
// nothing. A refunded order stayed PAID and CONFIRMED with its stock
// deducted, so the day's revenue counted a sale that had been given back and
// the shelf count stayed a garment short of what was on the shelf. Refunds
// are made in the Razorpay dashboard, so this webhook is the only way the
// shop's own records ever hear about one.
test.describe("refunds", () => {
  let refundProduct: Product;
  test.beforeAll(async () => {
    refundProduct = await createTestProduct({ name: "Refund Test Piece", price: 2000, stock: 40 });
  });
  test.afterAll(async () => {
    await deleteTestProduct(refundProduct.id);
  });

  function signHook(raw: string) {
    return createHmac("sha256", RAZORPAY_TEST_WEBHOOK_SECRET).update(raw).digest("hex");
  }

  async function postHook(request: import("@playwright/test").APIRequestContext, raw: string) {
    return request.post("/api/webhooks/razorpay", {
      headers: { "Content-Type": "application/json", "x-razorpay-signature": signHook(raw) },
      data: raw,
    });
  }

  /** Place an order and take it all the way to paid, the way a real one goes. */
  async function paidOrder(request: import("@playwright/test").APIRequestContext, paymentId: string) {
    const { orderNumber, razorpayOrderId, email } = await placeAwaitingPaymentOrder(request, refundProduct);
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, amount: 200000 } } },
    });
    const res = await postHook(request, raw);
    expect(await res.json()).toMatchObject({ ok: true, state: "confirmed" });
    return { orderNumber, razorpayOrderId, email };
  }

  test("a full refund cancels the order and puts the stock back", async ({ request }) => {
    const { orderNumber, email } = await paidOrder(request, "pay_REFUND001");
    const afterSale = (await getSizeStock(refundProduct.id, "M"))!;

    const raw = JSON.stringify({
      event: "refund.created",
      payload: { refund: { entity: { id: "rfnd_001", payment_id: "pay_REFUND001", amount: 200000 } } },
    });
    const res = await postHook(request, raw);
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ ok: true, state: "refunded", orderNumber });

    const order = await getOrderByNumber(orderNumber);
    expect(order!.payment_status).toBe("REFUNDED");
    expect(order!.status).toBe("CANCELLED");
    // The garment is back on the shelf, and the order no longer holds it.
    expect(order!.stock_deducted).toBe(false);
    expect(await getSizeStock(refundProduct.id, "M")).toBe(afterSale + 1);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("a partial refund is recorded without undoing the sale", async ({ request }) => {
    // ₹200 back on a ₹2,000 order — a mark on a sleeve, not a return. The
    // customer still has the garment, so putting it back on the shelf would
    // be a lie the next customer pays for.
    const { orderNumber, email } = await paidOrder(request, "pay_REFUND002");
    const afterSale = (await getSizeStock(refundProduct.id, "M"))!;

    const raw = JSON.stringify({
      event: "refund.created",
      payload: { refund: { entity: { id: "rfnd_002", payment_id: "pay_REFUND002", amount: 20000 } } },
    });
    const res = await postHook(request, raw);
    expect(await res.json()).toMatchObject({ ok: true, state: "partial", orderNumber });

    const order = await getOrderByNumber(orderNumber);
    expect(order!.payment_status).toBe("PAID");
    expect(order!.status).toBe("CONFIRMED");
    expect(order!.stock_deducted).toBe(true);
    expect(await getSizeStock(refundProduct.id, "M")).toBe(afterSale);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("the same refund arriving twice returns the stock only once", async ({ request }) => {
    // Razorpay sends refund.created and payment.refunded for one refund, and
    // retries anything it gets no 2xx for. Handling it twice would mint a
    // garment that does not exist.
    const { orderNumber, email } = await paidOrder(request, "pay_REFUND003");
    const afterSale = (await getSizeStock(refundProduct.id, "M"))!;

    const created = JSON.stringify({
      event: "refund.created",
      payload: { refund: { entity: { id: "rfnd_003", payment_id: "pay_REFUND003", amount: 200000 } } },
    });
    const refunded = JSON.stringify({
      event: "payment.refunded",
      payload: { payment: { entity: { id: "pay_REFUND003", amount: 200000, amount_refunded: 200000 } } },
    });

    expect(await (await postHook(request, created)).json()).toMatchObject({ state: "refunded" });
    expect(await (await postHook(request, refunded)).json()).toMatchObject({ state: "already" });
    expect(await (await postHook(request, created)).json()).toMatchObject({ state: "already" });

    expect(await getSizeStock(refundProduct.id, "M")).toBe(afterSale + 1);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("two part refunds that add up to the whole cancel the order", async ({ request }) => {
    const { orderNumber, email } = await paidOrder(request, "pay_REFUND004");
    const afterSale = (await getSizeStock(refundProduct.id, "M"))!;

    const half = (id: string) =>
      JSON.stringify({
        event: "refund.created",
        payload: { refund: { entity: { id, payment_id: "pay_REFUND004", amount: 100000 } } },
      });

    expect(await (await postHook(request, half("rfnd_004a"))).json()).toMatchObject({ state: "partial" });
    expect(await getSizeStock(refundProduct.id, "M")).toBe(afterSale);

    expect(await (await postHook(request, half("rfnd_004b"))).json()).toMatchObject({ state: "refunded" });
    expect(await getSizeStock(refundProduct.id, "M")).toBe(afterSale + 1);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("a refund on a payment no order claims is acknowledged, not retried forever", async ({ request }) => {
    // Retrying cannot conjure an order, and a webhook that keeps failing gets
    // switched off at Razorpay's end — taking the working events with it.
    const raw = JSON.stringify({
      event: "refund.created",
      payload: { refund: { entity: { id: "rfnd_ghost", payment_id: "pay_NOSUCHPAYMENT", amount: 5000 } } },
    });
    const res = await postHook(request, raw);
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toMatchObject({ ok: true, unmatched: "not-found" });
  });

  test("a refund event carrying no amount changes nothing", async ({ request }) => {
    // Guessing "the whole order" would cancel a sale on no evidence.
    const { orderNumber, email } = await paidOrder(request, "pay_REFUND005");

    const raw = JSON.stringify({
      event: "refund.created",
      payload: { refund: { entity: { id: "rfnd_005", payment_id: "pay_REFUND005" } } },
    });
    const res = await postHook(request, raw);
    expect(await res.json()).toMatchObject({ ok: true, ignored: "no-amount" });

    const order = await getOrderByNumber(orderNumber);
    expect(order!.payment_status).toBe("PAID");
    expect(order!.stock_deducted).toBe(true);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });
});
