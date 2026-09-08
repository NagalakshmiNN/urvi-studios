// Selling to someone who comes to the door, and to someone who orders
// online then collects: the two in-person paths, the cash/UPI/card record,
// the stock sheet, and the customer history that ties them together.

import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import {
  createTestProduct,
  deleteTestProduct,
  deleteOrderByNumber,
  deleteCustomerByEmail,
  getOrderByNumber,
  getSizeStock,
  query,
  uniqueEmail,
  withDb,
} from "../setup/db";
import { loginAsAdmin, seedCart, fillCheckoutForm, placedOrderNumber } from "../setup/fixtures";
import { outboxLength, waitForMail } from "../setup/outbox";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
let product: Product;

test.beforeAll(async () => {
  product = await createTestProduct({ name: "In Person Sale Product", price: 1800, stock: 30 });
});

test.afterAll(async () => {
  await deleteTestProduct(product.id);
});

function cartLine(qty = 1) {
  return {
    productId: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    price: product.price,
    image: "/placeholders/casual-wear.svg",
    size: "M",
    color: product.colors[0].name,
    qty,
  };
}

test.describe("ordering online, collecting in person", () => {
  test("choosing collection drops the address fields and the delivery charge", async ({ page }) => {
    await seedCart(page, [cartLine()]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();

    // Delivery is the default, and asks for an address.
    await expect(page.locator('input[name="address"]')).toBeVisible();
    await expect(page.locator(".summary-row", { hasText: "Delivery" })).toContainText("Additional");

    await page.getByRole("button", { name: "Collect in person" }).click();

    await expect(page.locator('input[name="address"]')).toHaveCount(0);
    await expect(page.locator('input[name="pincode"]')).toHaveCount(0);
    await expect(page.locator(".summary-row", { hasText: "Delivery" })).toContainText("Collecting in person");
    await expect(page.locator(".summary-card")).toContainText("Nothing to pay for delivery");
    // Still asks who they are and how to reach them.
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test("places a pickup order with no address, and tells the customer so", async ({ page }) => {
    const email = uniqueEmail("collector");
    const marker = outboxLength();

    await seedCart(page, [cartLine()]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();
    await page.getByRole("button", { name: "Collect in person" }).click();

    await page.fill('input[name="name"]', "Priya Pickup");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="phone"]', "9876511111");
    await page.getByRole("button", { name: "Place Order" }).click();

    const orderNumber = await placedOrderNumber(page);
    const order = await getOrderByNumber(orderNumber);
    expect(order!.fulfilment_method).toBe("pickup");
    expect(order!.address_line1).toBe("");
    expect(order!.total).toBe(1800);

    const mail = await waitForMail(marker, (m) => m.to === email);
    expect(mail.text).toContain("collecting this one in person");
    expect(mail.text).not.toContain("Delivering to:");

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("a delivery order still requires a full address", async ({ page }) => {
    await seedCart(page, [cartLine()]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();
    await fillCheckoutForm(page, { email: uniqueEmail("delivery") });
    await page.getByRole("button", { name: "Place Order" }).click();

    const orderNumber = await placedOrderNumber(page);
    const order = await getOrderByNumber(orderNumber);
    expect(order!.fulfilment_method).toBe("delivery");
    expect(order!.address_line1).not.toBe("");

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(order!.customer_email);
  });

  test("a pickup order is never offered shipping statuses, and its wording changes", async ({ page }) => {
    const email = uniqueEmail("pickupstatus");
    const res = await page.request.post("/api/checkout/create-order", {
      data: {
        items: [{ productId: product.id, size: "M", color: product.colors[0].name, qty: 1 }],
        customer: { name: "Status Collector", email, phone: "9876512222" },
        fulfilmentMethod: "pickup",
      },
    });
    const { orderNumber } = await res.json();

    await loginAsAdmin(page);
    await page.goto(`/admin/orders/${orderNumber}`);

    const options = await page.locator("select.status-select option").allTextContents();
    expect(options).toEqual(["Order Received", "Ready to Collect", "Collected", "Cancelled", "Return Processed"]);
    expect(options).not.toContain("Shipped");

    // And the WhatsApp message says collect, not deliver.
    const href = await page.locator("a", { hasText: "Message Customer on WhatsApp" }).getAttribute("href");
    expect(decodeURIComponent(href!)).toContain("ready for you to collect");

    // Marking it ready emails the customer in collection language.
    const marker = outboxLength();
    await page.locator("select.status-select").selectOption("CONFIRMED");
    const mail = await waitForMail(marker, (m) => m.to === email);
    expect(mail.subject).toContain("Ready to Collect");
    expect(mail.text).toContain("ready to collect");

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });
});

test.describe("recording a walk-in sale", () => {
  test("records the sale, takes the stock, and marks it collected and paid", async ({ page }) => {
    const stockBefore = (await getSizeStock(product.id, "M"))!;

    await loginAsAdmin(page);
    await page.goto("/admin/orders/new");

    // Walk-in is the default, and it hides the address fields.
    await expect(page.locator('select[name="source"]')).toHaveValue("walk_in");
    await expect(page.locator('select[name="fulfilmentMethod"]')).toHaveValue("pickup");
    await expect(page.locator('input[name="addressLine1"]')).toHaveCount(0);

    await page.selectOption('select[name="lineProductId"]', product.id);
    await expect(page.locator('select[name="lineSize"] option[value="M"]')).toHaveCount(1);
    await page.selectOption('select[name="lineSize"]', "M");
    await page.selectOption('select[name="lineColor"]', product.colors[0].name);
    await page.fill('input[name="lineQty"]', "2");

    await page.fill('input[name="customerName"]', "Meera Walkin");
    await page.fill('input[name="customerPhone"]', "9876513333");
    await page.selectOption('select[name="paymentStatus"]', "PAID");
    await page.selectOption('select[name="paymentMode"]', "upi");
    await page.locator('button[type="submit"]', { hasText: "Record Order" }).click();

    await page.waitForURL(/\/admin\/orders\/URVI-/);
    const orderNumber = page.url().split("/").pop()!;

    const order = await getOrderByNumber(orderNumber);
    expect(order!.source).toBe("walk_in");
    expect(order!.fulfilment_method).toBe("pickup");
    expect(order!.payment_status).toBe("PAID");
    expect(order!.payment_mode).toBe("upi");
    // They walked out with it, so it's already collected — not "confirmed"
    // and waiting to be packed.
    expect(order!.status).toBe("DELIVERED");
    expect(order!.stock_deducted).toBe(true);
    expect(order!.total).toBe(3600);
    expect(await getSizeStock(product.id, "M")).toBe(stockBefore - 2);

    // And it reads correctly on the order page.
    const details = page.locator(".admin-card", { hasText: "Customer & Shipping" });
    await expect(details).toContainText("Walk-in");
    await expect(details).toContainText("Collected in person");
    await expect(details).toContainText("UPI");

    await deleteOrderByNumber(orderNumber);
  });

  test("asks how a paid sale was settled rather than guessing", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/orders/new");
    await page.selectOption('select[name="lineProductId"]', product.id);
    await page.selectOption('select[name="lineSize"]', "M");
    await page.fill('input[name="customerName"]', "No Payment Mode");
    await page.fill('input[name="customerPhone"]', "9876514444");
    await page.selectOption('select[name="paymentStatus"]', "PAID");

    // Blank out the payment mode the way a stripped-down submission would.
    await page.locator('select[name="paymentMode"]').evaluate((el) => {
      const select = el as HTMLSelectElement;
      const blank = document.createElement("option");
      blank.value = "";
      select.appendChild(blank);
      select.value = "";
    });
    await page.locator('button[type="submit"]', { hasText: "Record Order" }).click();

    await expect(page.locator(".notice-box.error")).toContainText("cash, UPI or card");
  });

  test("a sale that still needs delivering keeps its address fields", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/orders/new");
    await page.selectOption('select[name="source"]', "phone");

    // Choosing a phone order switches it to delivery, and the address is back.
    await expect(page.locator('select[name="fulfilmentMethod"]')).toHaveValue("delivery");
    await expect(page.locator('input[name="addressLine1"]')).toBeVisible();
  });
});

test.describe("the orders list by channel", () => {
  test("separates walk-in sales from website orders", async ({ page }) => {
    const email = uniqueEmail("channel");
    const online = await page.request.post("/api/checkout/create-order", {
      data: {
        items: [{ productId: product.id, size: "L", color: product.colors[0].name, qty: 1 }],
        customer: {
          name: "Website Buyer",
          email,
          phone: "9876515555",
          address: "5 Web Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      },
    });
    const { orderNumber } = await online.json();

    await loginAsAdmin(page);

    // Record a walk-in too, so both channels exist.
    await page.goto("/admin/orders/new");
    await page.selectOption('select[name="lineProductId"]', product.id);
    await page.selectOption('select[name="lineSize"]', "L");
    await page.fill('input[name="customerName"]', "Counter Buyer");
    await page.fill('input[name="customerPhone"]', "9876516666");
    await page.selectOption('select[name="paymentStatus"]', "PAID");
    await page.selectOption('select[name="paymentMode"]', "cash");
    await page.locator('button[type="submit"]', { hasText: "Record Order" }).click();
    await page.waitForURL(/\/admin\/orders\/URVI-/);
    const walkInNumber = page.url().split("/").pop()!;

    await page.goto("/admin/orders?channel=walk_in");
    await expect(page.locator("tbody tr", { hasText: walkInNumber })).toHaveCount(1);
    await expect(page.locator("tbody tr", { hasText: orderNumber })).toHaveCount(0);

    await page.goto("/admin/orders?channel=online");
    await expect(page.locator("tbody tr", { hasText: orderNumber })).toHaveCount(1);
    await expect(page.locator("tbody tr", { hasText: walkInNumber })).toHaveCount(0);

    await deleteOrderByNumber(orderNumber);
    await deleteOrderByNumber(walkInNumber);
    await deleteCustomerByEmail(email);
  });
});

test.describe("customers, matched by phone", () => {
  test("counts repeat buyers across the website and the door", async ({ page }) => {
    const phone = "9876517777";
    const email = uniqueEmail("repeat");

    // One website order…
    const online = await page.request.post("/api/checkout/create-order", {
      data: {
        items: [{ productId: product.id, size: "S", color: product.colors[0].name, qty: 1 }],
        customer: {
          name: "Anita Regular",
          email,
          phone,
          address: "9 Repeat Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      },
    });
    const { orderNumber } = await online.json();

    // …and two in-person sales, one with the phone written differently.
    await loginAsAdmin(page);
    const walkIns: string[] = [];
    for (const written of [phone, "98765 17777"]) {
      await page.goto("/admin/orders/new");
      await page.selectOption('select[name="lineProductId"]', product.id);
      await page.selectOption('select[name="lineSize"]', "S");
      await page.fill('input[name="customerName"]', "Anita Regular");
      await page.fill('input[name="customerPhone"]', written);
      await page.selectOption('select[name="paymentStatus"]', "PAID");
      await page.selectOption('select[name="paymentMode"]', "cash");
      await page.locator('button[type="submit"]', { hasText: "Record Order" }).click();
      await page.waitForURL(/\/admin\/orders\/URVI-/);
      walkIns.push(page.url().split("/").pop()!);
    }

    await page.goto("/admin/customers");
    const row = page.locator("tbody tr", { hasText: "Anita Regular" });
    await expect(row).toHaveCount(1); // one person, not three
    await expect(row).toContainText("3"); // three orders
    await expect(row).toContainText(email);

    // Filtering to people who came in person finds her.
    await page.goto("/admin/customers?show=walk_in");
    await expect(page.locator("tbody tr", { hasText: "Anita Regular" })).toHaveCount(1);

    // And her phone number opens her whole history.
    await page.locator("tbody tr", { hasText: "Anita Regular" }).locator("a").first().click();
    await expect(page).toHaveURL(/\/admin\/orders\?phone=/);
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await expect(page.locator(".notice-box")).toContainText("3 orders");

    await deleteOrderByNumber(orderNumber);
    for (const n of walkIns) await deleteOrderByNumber(n);
    await deleteCustomerByEmail(email);
  });
});

test.describe("the stock sheet", () => {
  test("shows every product and size with what's on hand", async ({ page }) => {
    const tracked = await createTestProduct({
      name: "Stock Sheet Product",
      price: 2000,
      landedCost: 1200,
      stock: 9,
      sizes: ["S", "M", "L"],
    });
    await withDb((client) =>
      client.query("update product_sizes set stock = 0 where product_id = $1 and label = 'S'", [tracked.id])
    );

    await loginAsAdmin(page);
    await page.goto("/admin/stock");

    await expect(page.locator(".metric-card").first()).toContainText("Pieces on hand");
    const row = page.locator("tbody tr", { hasText: "Stock Sheet Product" }).filter({ hasText: "M" }).first();
    await expect(row).toContainText(tracked.sku);
    await expect(row).toContainText("₹2,000");

    // The product's own photo sits beside the name, so a row can be
    // recognised at a glance instead of read.
    const thumb = row.locator("img.stock-thumb");
    await expect(thumb).toHaveAttribute("src", "/placeholders/casual-wear.svg");
    await expect(thumb).toBeVisible();

    // The sold-out size shows up under "Sold out".
    await page.goto("/admin/stock?show=out");
    const soldOut = page.locator("tbody tr", { hasText: "Stock Sheet Product" });
    await expect(soldOut).toHaveCount(1);
    await expect(soldOut).toContainText("S");

    await deleteTestProduct(tracked.id);
  });

  test("downloads as a real Excel file with a summary", async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.get("/api/admin/export/stock");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("spreadsheetml");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await res.body()) as unknown as ArrayBuffer);

    const sheet = workbook.getWorksheet("Stock On Hand")!;
    expect(sheet).toBeTruthy();
    const headers = (sheet.getRow(1).values as string[]).slice(1);
    expect(headers).toContain("Product ID");
    expect(headers).toContain("Pieces on hand");
    expect(headers).toContain("Value at selling price (₹)");
    expect(sheet.rowCount).toBeGreaterThan(1);

    // Every row's value column really is pieces × price.
    const row = sheet.getRow(2);
    const pieces = Number(row.getCell(5).value);
    const price = Number(row.getCell(6).value);
    expect(Number(row.getCell(7).value)).toBe(pieces * price);

    const summary = workbook.getWorksheet("Summary")!;
    const labels = summary.getColumn(1).values.map((v) => String(v ?? ""));
    expect(labels.join(" ")).toContain("Total pieces");
    expect(labels.join(" ")).toContain("Value at selling price");
  });

  test("is closed to anyone who isn't an admin", async ({ request }) => {
    const res = await request.get("/api/admin/export/stock");
    expect(res.status()).toBe(401);
  });

  test("the stock total matches what the database actually holds", async ({ page }) => {
    const [{ sum }] = await query<{ sum: string }>("select coalesce(sum(stock),0)::text as sum from product_sizes");
    await loginAsAdmin(page);
    await page.goto("/admin/stock");
    const pieces = page.locator(".metric-card", { hasText: "Pieces on hand" }).locator(".value");
    await expect(pieces).toHaveText(String(Number(sum)));
  });
});
