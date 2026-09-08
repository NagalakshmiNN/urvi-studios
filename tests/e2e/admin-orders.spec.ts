// Orders in the admin: the list and its filters, moving an order through its
// statuses (which is what moves stock and emails the customer), the
// one-tap WhatsApp update, and recording an offline sale by hand.

import { test, expect } from "@playwright/test";
import {
  createTestProduct,
  deleteTestProduct,
  deleteOrderByNumber,
  deleteCustomerByEmail,
  getOrderByNumber,
  getSizeStock,
  uniqueEmail,
} from "../setup/db";
import { loginAsAdmin } from "../setup/fixtures";
import { outboxLength, waitForMail } from "../setup/outbox";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
let product: Product;

test.beforeAll(async () => {
  product = await createTestProduct({ name: "Admin Order Product", price: 2700, stock: 30 });
});

test.afterAll(async () => {
  await deleteTestProduct(product.id);
});

/** Place a website order so the admin has something real to work with. */
async function placeOrder(page: import("@playwright/test").Page, qty = 1) {
  const email = uniqueEmail("adminorder");
  const res = await page.request.post("/api/checkout/create-order", {
    data: {
      items: [{ productId: product.id, size: "M", color: product.colors[0].name, qty }],
      customer: {
        name: "Ravi Kumar",
        email,
        phone: "9876505050",
        address: "7 Order Street",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
    },
  });
  const { orderNumber } = await res.json();
  return { orderNumber, email };
}

test("the orders list shows website orders and filters by status", async ({ page }) => {
  const { orderNumber, email } = await placeOrder(page);
  await loginAsAdmin(page);
  await page.goto("/admin/orders");

  const row = page.locator("tbody tr", { hasText: orderNumber });
  await expect(row).toContainText("Ravi Kumar");
  await expect(row).toContainText("Website");
  // The badge reads in plain words rather than the raw status code.
  await expect(row.locator(".order-status-badge")).toHaveText("Order Received");

  // Filtering to a status the order isn't in hides it.
  await page.locator(".filter-bar a.chip", { hasText: "DELIVERED" }).click();
  await expect(page.locator("tbody tr", { hasText: orderNumber })).toHaveCount(0);

  await page.locator(".filter-bar a.chip", { hasText: "All statuses" }).click();
  await expect(page.locator("tbody tr", { hasText: orderNumber })).toHaveCount(1);

  await deleteOrderByNumber(orderNumber);
  await deleteCustomerByEmail(email);
});

test("confirming an order takes the stock and emails the customer", async ({ page }) => {
  const { orderNumber, email } = await placeOrder(page, 2);
  const stockBefore = (await getSizeStock(product.id, "M"))!;
  const marker = outboxLength();

  await loginAsAdmin(page);
  await page.goto(`/admin/orders/${orderNumber}`);
  await expect(page.locator("h1")).toHaveText(orderNumber);

  await page.locator("select.status-select").selectOption("CONFIRMED");

  await expect(async () => {
    const order = await getOrderByNumber(orderNumber);
    expect(order!.status).toBe("CONFIRMED");
    expect(order!.stock_deducted).toBe(true);
  }).toPass({ timeout: 10_000 });

  // Stock comes out of the exact size ordered, and only once.
  expect(await getSizeStock(product.id, "M")).toBe(stockBefore - 2);

  const mail = await waitForMail(marker, (m) => m.to === email);
  expect(mail.subject).toContain("Order Confirmed");
  expect(mail.text).toContain("confirmed");
  expect(mail.text).toContain(orderNumber);

  await deleteOrderByNumber(orderNumber);
  await deleteCustomerByEmail(email);
});

test("cancelling a confirmed order puts the stock back", async ({ page }) => {
  const { orderNumber, email } = await placeOrder(page, 1);
  const stockBefore = (await getSizeStock(product.id, "M"))!;

  await loginAsAdmin(page);
  await page.goto(`/admin/orders/${orderNumber}`);
  await page.locator("select.status-select").selectOption("CONFIRMED");
  await expect(async () => {
    expect(await getSizeStock(product.id, "M")).toBe(stockBefore - 1);
  }).toPass({ timeout: 10_000 });

  await page.reload();
  await page.locator("select.status-select").selectOption("CANCELLED");
  await expect(async () => {
    const order = await getOrderByNumber(orderNumber);
    expect(order!.status).toBe("CANCELLED");
    expect(order!.stock_deducted).toBe(false);
    expect(await getSizeStock(product.id, "M")).toBe(stockBefore);
  }).toPass({ timeout: 10_000 });

  await deleteOrderByNumber(orderNumber);
  await deleteCustomerByEmail(email);
});

test("the WhatsApp button messages the customer with wording that matches the status", async ({ page }) => {
  const { orderNumber, email } = await placeOrder(page);
  await loginAsAdmin(page);
  await page.goto(`/admin/orders/${orderNumber}`);

  const button = page.locator("a", { hasText: "Message Customer on WhatsApp" });
  const placedHref = await button.getAttribute("href");
  expect(placedHref).toContain("https://wa.me/919876505050"); // country code added
  expect(decodeURIComponent(placedHref!)).toContain("Ravi Kumar");
  expect(decodeURIComponent(placedHref!)).toContain(orderNumber);
  expect(decodeURIComponent(placedHref!)).toContain("received your order");

  // Move it on, and the pre-filled message follows.
  await page.locator("select.status-select").selectOption("SHIPPED");
  await expect(async () => {
    await page.reload();
    const href = await page.locator("a", { hasText: "Message Customer on WhatsApp" }).getAttribute("href");
    expect(decodeURIComponent(href!)).toContain("shipped");
  }).toPass({ timeout: 10_000 });

  await deleteOrderByNumber(orderNumber);
  await deleteCustomerByEmail(email);
});

test("an offline sale can be recorded by hand and reserves stock immediately", async ({ page }) => {
  const stockBefore = (await getSizeStock(product.id, "L"))!;

  await loginAsAdmin(page);
  await page.goto("/admin/orders/new");

  await page.selectOption('select[name="source"]', "phone");
  await page.selectOption('select[name="lineProductId"]', product.id);
  // Size and colour options only appear once the product choice re-renders.
  await expect(page.locator('select[name="lineSize"] option[value="L"]')).toHaveCount(1);
  await page.selectOption('select[name="lineSize"]', "L");
  await page.selectOption('select[name="lineColor"]', product.colors[0].name);
  await page.fill('input[name="lineQty"]', "1");

  await page.fill('input[name="customerName"]', "Walk-in Customer");
  await page.fill('input[name="customerPhone"]', "9876506060");
  await page.selectOption('select[name="paymentStatus"]', "PAID");
  await page.locator('button[type="submit"]', { hasText: "Record Order" }).click();

  // Success is a redirect to the new order, not a message.
  await page.waitForURL(/\/admin\/orders\/URVI-/);
  const orderNumber = page.url().split("/").pop()!;

  const order = await getOrderByNumber(orderNumber);
  expect(order!.source).toBe("phone");
  expect(order!.payment_method).toBe("manual");
  expect(order!.payment_status).toBe("PAID");
  expect(order!.status).toBe("CONFIRMED");
  expect(order!.stock_deducted).toBe(true);
  expect(await getSizeStock(product.id, "L")).toBe(stockBefore - 1);

  await deleteOrderByNumber(orderNumber);
});

test("recording an order without a customer name is refused", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/orders/new");
  await page.selectOption('select[name="lineProductId"]', product.id);
  await page.selectOption('select[name="lineSize"]', "M");
  await page.fill('input[name="customerPhone"]', "9876507070");
  // The name field is required in the browser too, so clear that guard to
  // check the server's own validation.
  await page.locator('input[name="customerName"]').evaluate((el) => el.removeAttribute("required"));
  await page.locator('button[type="submit"]', { hasText: "Record Order" }).click();

  await expect(page.locator(".notice-box.error")).toContainText("customer");
});
