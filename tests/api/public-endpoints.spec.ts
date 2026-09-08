// Coupon previews, the wishlist endpoint, the contact form, and image
// serving — plus a check that every admin-only endpoint really is locked.

import { test, expect } from "@playwright/test";
import { createTestProduct, deleteTestProduct, query, queryOne, uniqueEmail, withDb } from "../setup/db";
import { outboxLength, waitForMail } from "../setup/outbox";
import { registerCustomer } from "../setup/fixtures";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
let product: Product;

test.beforeAll(async () => {
  product = await createTestProduct({ name: "Public API Product", price: 2500, stock: 15 });
});

test.afterAll(async () => {
  await deleteTestProduct(product.id);
});

function items(qty = 1) {
  return [{ productId: product.id, size: "M", color: product.colors[0].name, qty }];
}

test.describe("coupon preview", () => {
  test("returns the discount for a valid code", async ({ request }) => {
    const res = await request.post("/api/checkout/preview-coupon", {
      data: { items: items(1), couponCode: "WELCOME10" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.couponCode).toBe("WELCOME10");
    expect(body.discount).toBe(250); // 10% of ₹2,500
  });

  test("refuses a code below its minimum order value", async ({ request }) => {
    const cheap = await createTestProduct({ name: "Cheap Coupon Product", price: 900, stock: 5 });
    const res = await request.post("/api/checkout/preview-coupon", {
      data: {
        items: [{ productId: cheap.id, size: "M", color: cheap.colors[0].name, qty: 1 }],
        couponCode: "WELCOME10",
      },
    });
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("coupon code isn");
    await deleteTestProduct(cheap.id);
  });

  test("refuses a code that doesn't exist", async ({ request }) => {
    const res = await request.post("/api/checkout/preview-coupon", {
      data: { items: items(1), couponCode: "TOTALLY-MADE-UP" },
    });
    expect((await res.json()).ok).toBe(false);
  });
});

test.describe("wishlist", () => {
  test("is closed to visitors who aren't logged in", async ({ request }) => {
    const res = await request.post("/api/wishlist", { data: { productId: product.id } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBe("Not logged in.");
  });

  test("adds and removes for a logged-in shopper, and is safe to repeat", async ({ page }) => {
    const { email } = await registerCustomer(page);
    const customer = await queryOne<{ id: string }>("select id from customers where lower(email) = lower($1)", [email]);

    const add = await page.request.post("/api/wishlist", { data: { productId: product.id } });
    expect((await add.json()).ok).toBe(true);
    expect(
      await query("select id from wishlist_items where customer_id = $1 and product_id = $2", [customer!.id, product.id])
    ).toHaveLength(1);

    // Adding twice must not create a duplicate row.
    await page.request.post("/api/wishlist", { data: { productId: product.id } });
    expect(
      await query("select id from wishlist_items where customer_id = $1 and product_id = $2", [customer!.id, product.id])
    ).toHaveLength(1);

    const remove = await page.request.delete("/api/wishlist", { data: { productId: product.id } });
    expect((await remove.json()).ok).toBe(true);
    expect(
      await query("select id from wishlist_items where customer_id = $1 and product_id = $2", [customer!.id, product.id])
    ).toHaveLength(0);
  });

  test("rejects a missing product id and an unknown product", async ({ page }) => {
    await registerCustomer(page);
    const missing = await page.request.post("/api/wishlist", { data: {} });
    expect(missing.status()).toBe(400);

    const unknown = await page.request.post("/api/wishlist", { data: { productId: "no-such-product" } });
    expect(unknown.status()).toBe(404);
  });
});

test.describe("contact form endpoint", () => {
  test("saves the message and alerts the shop", async ({ request }) => {
    const email = uniqueEmail("enquiry");
    const marker = outboxLength();

    const res = await request.post("/api/contact", {
      data: { name: "Curious Shopper", email, message: "Do you have this kurta in XL?" },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).ok).toBe(true);

    const saved = await queryOne<{ name: string; message: string; status: string }>(
      "select name, message, status from contact_messages where email = $1",
      [email]
    );
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe("Curious Shopper");
    expect(saved!.status).toBe("NEW");

    const alert = await waitForMail(marker, (m) => m.text.includes("Do you have this kurta in XL?"));
    expect(alert.replyTo).toBe(email);
  });

  test("requires name, email and message", async ({ request }) => {
    const res = await request.post("/api/contact", { data: { name: "", email: "", message: "" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Name, email, and message are all required.");
  });
});

test.describe("product images", () => {
  test("serves an uploaded image back with the right content type", async ({ request }) => {
    // A 1×1 transparent PNG.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const id = `test-asset-${Date.now().toString(36)}`;
    await withDb((client) =>
      client.query(
        "insert into product_image_assets (id, content_type, data_base64) values ($1, 'image/png', $2)",
        [id, png.toString("base64")]
      )
    );

    const res = await request.get(`/api/images/${id}`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toBe("image/png");
    expect(Buffer.from(await res.body()).equals(png)).toBe(true);

    await withDb((client) => client.query("delete from product_image_assets where id = $1", [id]));
  });

  test("404s for an image that doesn't exist", async ({ request }) => {
    const res = await request.get("/api/images/definitely-not-a-real-id");
    expect(res.status()).toBe(404);
  });
});

test.describe("admin endpoints are locked to admins", () => {
  const getEndpoints = [
    "/api/admin/export-products",
    "/api/admin/export/customers",
    "/api/admin/export/orders",
    "/api/admin/export/addresses",
    "/api/admin/export/wishlist",
    "/api/admin/export/reviews",
  ];

  for (const url of getEndpoints) {
    test(`GET ${url} returns 401 without an admin session`, async ({ request }) => {
      const res = await request.get(url);
      expect(res.status()).toBe(401);
    });
  }

  test("POST /api/admin/upload-image returns 401 without an admin session", async ({ request }) => {
    const res = await request.post("/api/admin/upload-image", {
      multipart: { files: { name: "x.png", mimeType: "image/png", buffer: Buffer.from([0]) } },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/admin/import-products returns 401 without an admin session", async ({ request }) => {
    const res = await request.post("/api/admin/import-products", {
      multipart: { file: { name: "x.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from([0]) } },
    });
    expect(res.status()).toBe(401);
  });

  test("a logged-in customer is not an admin", async ({ page }) => {
    await registerCustomer(page);
    const res = await page.request.get("/api/admin/export/customers");
    expect(res.status()).toBe(401);
  });
});
