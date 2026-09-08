// The order-creation endpoint: validation, the guest-checkout account rules,
// coupons, what actually lands in the database, and which emails go out.

import { test, expect } from "@playwright/test";
import {
  createTestProduct,
  deleteTestProduct,
  deleteOrderByNumber,
  deleteCustomerByEmail,
  getOrderByNumber,
  getSizeStock,
  query,
  queryOne,
  uniqueEmail,
} from "../setup/db";
import { outboxLength, waitForMail } from "../setup/outbox";
import { registerCustomer } from "../setup/fixtures";

type Product = Awaited<ReturnType<typeof createTestProduct>>;

let product: Product;

function shipping(email: string) {
  return {
    name: "API Tester",
    email,
    phone: "9876500111",
    address: "12 Test Lane",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
  };
}

function itemsFor(p: Product, qty = 1) {
  return [{ productId: p.id, size: "M", color: p.colors[0].name, qty }];
}

test.beforeAll(async () => {
  product = await createTestProduct({ name: "API Order Product", price: 2000, stock: 12 });
});

test.afterAll(async () => {
  await deleteTestProduct(product.id);
});

test.describe("shipping detail validation", () => {
  const cases: { label: string; patch: Record<string, string> }[] = [
    { label: "a missing name", patch: { name: "" } },
    { label: "an email that isn't an email", patch: { email: "not-an-email" } },
    { label: "a missing phone number", patch: { phone: "" } },
    { label: "a missing address", patch: { address: "" } },
    { label: "a pincode that isn't 6 digits", patch: { pincode: "12" } },
  ];

  for (const { label, patch } of cases) {
    test(`rejects ${label}`, async ({ request }) => {
      const res = await request.post("/api/checkout/create-order", {
        data: { items: itemsFor(product), customer: { ...shipping(uniqueEmail()), ...patch } },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("Please fill in every shipping field correctly.");
    });
  }

  test("rejects an empty bag", async ({ request }) => {
    const res = await request.post("/api/checkout/create-order", {
      data: { items: [], customer: shipping(uniqueEmail()) },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Your bag is empty.");
  });

  test("refuses to sell more than the size actually has", async ({ request }) => {
    const res = await request.post("/api/checkout/create-order", {
      data: { items: itemsFor(product, 9), customer: shipping(uniqueEmail()) },
    });
    expect(res.status()).toBe(400);
    // 12 pieces split across S/M/L → 4 in M, so 9 can't be fulfilled.
    expect((await res.json()).error).toContain("left in size M");
  });
});

test.describe("guest checkout", () => {
  test("creates an account, signs the guest in, and files the order under it", async ({ request }) => {
    const email = uniqueEmail("guest");
    const marker = outboxLength();

    const res = await request.post("/api/checkout/create-order", {
      data: { items: itemsFor(product), customer: shipping(email) },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    expect(body.configured).toBe(false); // Razorpay off in tests → WhatsApp/COD path
    expect(body.orderNumber).toMatch(/^URVI-\d{4}-\d{5}$/);
    expect(body.accountCreated).toBe(true);
    expect(body.customerEmail).toBe(email);
    expect(body.whatsappUrls).toHaveLength(3);
    for (const w of body.whatsappUrls) expect(w.url).toContain("https://wa.me/");

    // A real account row now exists, with a password nobody can guess.
    const customer = await queryOne<{ id: string; name: string; phone: string; password_hash: string }>(
      "select id, name, phone, password_hash from customers where lower(email) = lower($1)",
      [email]
    );
    expect(customer).not.toBeNull();
    expect(customer!.name).toBe("API Tester");
    expect(customer!.phone).toBe("9876500111");
    expect(customer!.password_hash.length).toBeGreaterThan(20);

    // The guest is signed in on this browser context (session cookie set).
    const cookies = await request.storageState();
    expect(cookies.cookies.some((c) => c.name === "urvi_session")).toBe(true);

    // And the order is tied to that new account.
    const order = await getOrderByNumber(body.orderNumber);
    expect(order!.customer_id).toBe(customer!.id);
    expect(order!.status).toBe("PLACED");
    expect(order!.payment_status).toBe("PENDING");
    expect(order!.payment_method).toBe("whatsapp_cod");
    expect(order!.source).toBe("online");
    expect(order!.total).toBe(2000);

    // Stock is NOT taken out yet — an abandoned checkout must not hold stock.
    expect(order!.stock_deducted).toBe(false);
    expect(await getSizeStock(product.id, "M")).toBe(4);

    // The line item carries its own snapshot of the product.
    const lines = await query<{ product_name: string; sku: string; size: string; qty: number; price: number }>(
      "select product_name, sku, size, qty, price from order_items where order_id = $1",
      [order!.id]
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].product_name).toBe("API Order Product");
    expect(lines[0].sku).toBe(product.sku);
    expect(lines[0].size).toBe("M");

    // Both emails go out: one to the shop, one to the customer.
    const toShop = await waitForMail(marker, (m) => m.subject.includes(`New order ${body.orderNumber}`));
    expect(toShop.to).toBe("urvistudios2026@gmail.com");
    expect(toShop.text).toContain("API Order Product");

    const toCustomer = await waitForMail(marker, (m) => m.to === email);
    expect(toCustomer.subject).toContain(body.orderNumber);
    expect(toCustomer.text).toContain("Thanks for shopping with Urvi Studios");
    expect(toCustomer.text).toContain("saved your details"); // the new-account note
    expect(toCustomer.text).toContain(`/account/orders/${body.orderNumber}`);

    await deleteOrderByNumber(body.orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("will not quietly attach a guest order to somebody else's existing account", async ({ request, page }) => {
    // A shopper who already has a login.
    const { email } = await registerCustomer(page);

    // Someone (or the same person, logged out) tries to check out as a guest
    // using that email. It must not create an order, and must not hand out a
    // session for an account whose password was never entered.
    const res = await request.post("/api/checkout/create-order", {
      data: { items: itemsFor(product), customer: shipping(email) },
    });

    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.accountExists).toBe(true);
    expect(body.error).toBe("An account already exists with this email. Please login to continue with checkout.");

    const cookies = await request.storageState();
    expect(cookies.cookies.some((c) => c.name === "urvi_session")).toBe(false);

    const orders = await query("select id from orders where customer_email = $1", [email]);
    expect(orders).toHaveLength(0);

    await deleteCustomerByEmail(email);
  });
});

test.describe("logged-in checkout", () => {
  test("files the order under the signed-in account without creating a new one", async ({ page }) => {
    const { email } = await registerCustomer(page);
    const before = await query("select id from customers");

    const res = await page.request.post("/api/checkout/create-order", {
      data: { items: itemsFor(product), customer: shipping(email) },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.accountCreated).toBe(false);

    const customer = await queryOne<{ id: string }>("select id from customers where lower(email) = lower($1)", [email]);
    const order = await getOrderByNumber(body.orderNumber);
    expect(order!.customer_id).toBe(customer!.id);

    const after = await query("select id from customers");
    expect(after.length).toBe(before.length);

    await deleteOrderByNumber(body.orderNumber);
    await deleteCustomerByEmail(email);
  });
});

test.describe("coupons at order time", () => {
  test("applies a valid coupon to the order total", async ({ request }) => {
    const email = uniqueEmail("coupon");
    // WELCOME10 is 10% off, minimum order ₹1,500 — 2 × ₹2,000 clears it.
    const res = await request.post("/api/checkout/create-order", {
      data: { items: itemsFor(product, 2), customer: shipping(email), couponCode: "WELCOME10" },
    });
    expect(res.ok()).toBeTruthy();
    const { orderNumber } = await res.json();

    const order = await getOrderByNumber(orderNumber);
    expect(order!.subtotal).toBe(4000);
    expect(order!.discount).toBe(400);
    expect(order!.total).toBe(3600);
    expect(order!.coupon_code).toBe("WELCOME10");

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("rejects the whole order rather than silently ignoring a bad coupon", async ({ request }) => {
    const res = await request.post("/api/checkout/create-order", {
      data: { items: itemsFor(product), customer: shipping(uniqueEmail()), couponCode: "NOPE-NOT-REAL" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("coupon code isn");
  });
});
