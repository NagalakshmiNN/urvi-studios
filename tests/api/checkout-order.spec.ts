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

// A coupon had no ceiling of any kind: one code screenshotted off an
// Instagram post and forwarded into a deals group was redeemable by everyone
// who found it, as often as they liked, until somebody switched it off by
// hand. The discount is real money.
test.describe("coupon limits", () => {
  async function makeCoupon(opts: { code: string; usageLimit?: number | null; perCustomerLimit?: number | null }) {
    await query("delete from coupons where code = $1", [opts.code]);
    await query(
      `insert into coupons (id, code, type, value, min_order_value, active, usage_limit, per_customer_limit)
       values (gen_random_uuid()::text, $1, 'FLAT', 100, 0, true, $2, $3)`,
      [opts.code, opts.usageLimit ?? null, opts.perCustomerLimit ?? null]
    );
  }

  /** Place an order with the code and say what happened. */
  async function orderWith(
    request: import("@playwright/test").APIRequestContext,
    code: string,
    email: string
  ) {
    const res = await request.post("/api/checkout/create-order", {
      data: { items: itemsFor(product), customer: shipping(email), couponCode: code },
    });
    return { status: res.status(), body: await res.json() };
  }

  test("a coupon capped at one total use stops after that one", async ({ request }) => {
    await makeCoupon({ code: "ONLYONCE", usageLimit: 1 });
    const first = uniqueEmail("cap-a");
    const second = uniqueEmail("cap-b");

    const a = await orderWith(request, "ONLYONCE", first);
    expect(a.status).toBe(200);

    // The first order is WhatsApp/COD and unpaid, so it does not count yet —
    // an abandoned checkout must not burn a coupon. Mark it the way a
    // confirmed sale looks.
    await query("update orders set payment_status = 'PAID', status = 'CONFIRMED' where order_number = $1", [
      a.body.orderNumber,
    ]);

    const b = await orderWith(request, "ONLYONCE", second);
    expect(b.status).toBe(400);
    expect(b.body.error).toContain("fully used");

    await deleteOrderByNumber(a.body.orderNumber);
    await deleteCustomerByEmail(first);
    await deleteCustomerByEmail(second);
    await query("delete from coupons where code = $1", ["ONLYONCE"]);
  });

  test("an unpaid, unconfirmed order does not use up a coupon", async ({ request }) => {
    // Otherwise a script could exhaust a campaign in seconds without paying
    // for a single garment, and every real customer would be turned away.
    await makeCoupon({ code: "NOTBURNT", usageLimit: 1 });
    const first = uniqueEmail("burn-a");
    const second = uniqueEmail("burn-b");

    const a = await orderWith(request, "NOTBURNT", first);
    expect(a.status).toBe(200);

    const b = await orderWith(request, "NOTBURNT", second);
    expect(b.status).toBe(200);

    await deleteOrderByNumber(a.body.orderNumber);
    await deleteOrderByNumber(b.body.orderNumber);
    await deleteCustomerByEmail(first);
    await deleteCustomerByEmail(second);
    await query("delete from coupons where code = $1", ["NOTBURNT"]);
  });

  test("a cancelled order gives its coupon use back", async ({ request }) => {
    await makeCoupon({ code: "GIVESBACK", usageLimit: 1 });
    const first = uniqueEmail("back-a");
    const second = uniqueEmail("back-b");

    const a = await orderWith(request, "GIVESBACK", first);
    await query("update orders set payment_status = 'PAID', status = 'CONFIRMED' where order_number = $1", [
      a.body.orderNumber,
    ]);
    expect((await orderWith(request, "GIVESBACK", second)).status).toBe(400);

    // The sale was undone, so the code is available again — the alternative
    // is a campaign that quietly shrinks every time an order falls through.
    await query("update orders set status = 'CANCELLED' where order_number = $1", [a.body.orderNumber]);
    const c = await orderWith(request, "GIVESBACK", second);
    expect(c.status).toBe(200);

    await deleteOrderByNumber(a.body.orderNumber);
    await deleteOrderByNumber(c.body.orderNumber);
    await deleteCustomerByEmail(first);
    await deleteCustomerByEmail(second);
    await query("delete from coupons where code = $1", ["GIVESBACK"]);
  });

  test("one per customer stops the same person, not everybody else", async ({ request }) => {
    await makeCoupon({ code: "ONEEACH", perCustomerLimit: 1 });
    const mine = uniqueEmail("each-a");
    const theirs = uniqueEmail("each-b");

    const a = await orderWith(request, "ONEEACH", mine);
    expect(a.status).toBe(200);
    await query("update orders set payment_status = 'PAID', status = 'CONFIRMED' where order_number = $1", [
      a.body.orderNumber,
    ]);

    const again = await orderWith(request, "ONEEACH", mine);
    expect(again.status).toBe(400);
    expect(again.body.error).toContain("one order per customer");

    // Somebody else is unaffected — a per-customer cap is not a total cap.
    const b = await orderWith(request, "ONEEACH", theirs);
    expect(b.status).toBe(200);

    await deleteOrderByNumber(a.body.orderNumber);
    await deleteOrderByNumber(b.body.orderNumber);
    await deleteCustomerByEmail(mine);
    await deleteCustomerByEmail(theirs);
    await query("delete from coupons where code = $1", ["ONEEACH"]);
  });

  test("a coupon with no limits still works without end", async ({ request }) => {
    // Every coupon created before limits existed is this one.
    await makeCoupon({ code: "NOCEILING" });
    const emails = [uniqueEmail("ceil-a"), uniqueEmail("ceil-b"), uniqueEmail("ceil-c")];
    const numbers: string[] = [];

    for (const email of emails) {
      const r = await orderWith(request, "NOCEILING", email);
      expect(r.status).toBe(200);
      numbers.push(r.body.orderNumber);
      await query("update orders set payment_status = 'PAID', status = 'CONFIRMED' where order_number = $1", [
        r.body.orderNumber,
      ]);
    }

    for (const n of numbers) await deleteOrderByNumber(n);
    for (const e of emails) await deleteCustomerByEmail(e);
    await query("delete from coupons where code = $1", ["NOCEILING"]);
  });
});

// The quantity and identity bugs found in the second security audit. Each of
// these was exploitable by anyone who could send an HTTP request.
test.describe("what a hostile cart cannot do", () => {
  test("the same item sent fifty times cannot outrun the stock", async ({ request }) => {
    // Each line was checked on its own, and the ceilings were 50 lines and 10
    // per line — so one shoe sent fifty times at ten each passed fifty
    // separate "is there enough?" checks and became an order for 500 against
    // a stock of 3. The customer pays for every one of them.
    const p = await createTestProduct({ name: "Oversell Test Piece", price: 1000, stock: 3 });
    const line = { productId: p.id, size: "M", color: p.colors[0].name, qty: 10 };

    const res = await request.post("/api/checkout/create-order", {
      data: {
        items: Array.from({ length: 50 }, () => ({ ...line })),
        customer: {
          name: "Greedy", email: uniqueEmail("oversell"), phone: "9876500999",
          address: "1 Test", city: "Bengaluru", state: "Karnataka", pincode: "560001",
        },
      },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/Only \d+ left/);
    await deleteTestProduct(p.id);
  });

  test("a size that doesn't exist is refused, not checked against every other size", async ({ request }) => {
    // An unmatched size fell back to the product's total — the sum across all
    // sizes — so a sold-out "S" asked for as "Small" was measured against the
    // stock of everything else and went through.
    const p = await createTestProduct({ name: "Phantom Size Piece", price: 1000, stock: 9 });

    const res = await request.post("/api/checkout/create-order", {
      data: {
        items: [{ productId: p.id, size: "Small", color: p.colors[0].name, qty: 5 }],
        customer: {
          name: "Phantom", email: uniqueEmail("phantom"), phone: "9876500998",
          address: "1 Test", city: "Bengaluru", state: "Karnataka", pincode: "560001",
        },
      },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/no longer available/);
    await deleteTestProduct(p.id);
  });

  test("a failed checkout leaves no account behind", async ({ request }) => {
    // The account was created before the cart was priced, so an empty bag
    // still minted a real account for whatever email was sent, with a random
    // password nobody holds. Run a wordlist through it and those people can
    // never register and never sign in.
    const email = uniqueEmail("squat");

    const res = await request.post("/api/checkout/create-order", {
      data: {
        items: [],
        customer: {
          name: "Squatter", email, phone: "9876500997",
          address: "1 Test", city: "Bengaluru", state: "Karnataka", pincode: "560001",
        },
      },
    });
    expect(res.status()).toBe(400);

    const rows = await query("select id from customers where email = $1", [email]);
    expect(rows).toHaveLength(0);
  });
});
