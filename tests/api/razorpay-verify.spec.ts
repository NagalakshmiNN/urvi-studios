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
import { RAZORPAY_TEST_SECRET } from "../setup/env";
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
async function placeAwaitingPaymentOrder(request: import("@playwright/test").APIRequestContext) {
  const email = uniqueEmail("payer");
  const res = await request.post("/api/checkout/create-order", {
    data: {
      items: [{ productId: product.id, size: "M", color: product.colors[0].name, qty: 1 }],
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

  const razorpayOrderId = `order_TEST${Date.now().toString(36)}`;
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
