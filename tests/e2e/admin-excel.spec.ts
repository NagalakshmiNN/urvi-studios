// The Excel round trip — the workflow the catalog is actually maintained
// with. Export the catalog, edit the sheet, upload it back: new rows create
// products, rows with a Product ID update them in place, and the Maximum
// Round Up To column sets the live price.

import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { createTestProduct, deleteTestProduct, getProductBySku, query, queryOne } from "../setup/db";
import { loginAsAdmin } from "../setup/fixtures";

const EXPECTED_HEADERS = [
  "Product ID",
  "Category",
  "Product Name",
  "Description",
  "Material / Fabric",
  "Perfect For / Where to Wear",
  "Best Weather",
  "Ease / Styling",
  "Style",
  "Price (₹)",
  "Compare-at Price (₹)",
  "Landed Cost (GST + Shipping) (₹)",
  "Minimum Round Up To (₹)",
  "Maximum Round Up To (₹)",
  "Stock (pieces)",
  "Sizes Available",
  "Colors Available",
  "Badge (optional)",
  "Photos",
];

async function downloadCatalog(page: import("@playwright/test").Page) {
  const res = await page.request.get("/api/admin/export-products");
  expect(res.ok()).toBeTruthy();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await res.body()) as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet("Add Products");
  if (!sheet) throw new Error("Export has no 'Add Products' sheet");
  return { workbook, sheet };
}

async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function headerRow(sheet: ExcelJS.Worksheet): string[] {
  const values = sheet.getRow(1).values as (string | undefined)[];
  return values.slice(1).map((v) => String(v ?? ""));
}

function findRowBySku(sheet: ExcelJS.Worksheet, sku: string): ExcelJS.Row | null {
  let found: ExcelJS.Row | null = null;
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    if (String(row.getCell(1).value ?? "").trim() === sku) found = row;
  });
  return found;
}

test("exports the current catalog with every column the template expects", async ({ page }) => {
  const product = await createTestProduct({
    name: "Excel Export Product",
    price: 3300,
    landedCost: 2000,
    minRoundUpTo: 2900,
    maxRoundUpTo: 3300,
    sizes: ["S", "M"],
    stock: 8,
  });

  await loginAsAdmin(page);
  const { sheet } = await downloadCatalog(page);

  expect(headerRow(sheet)).toEqual(EXPECTED_HEADERS);

  const row = findRowBySku(sheet, product.sku);
  expect(row, `no exported row for ${product.sku}`).not.toBeNull();
  expect(String(row!.getCell(3).value)).toBe("Excel Export Product");
  expect(Number(row!.getCell(10).value)).toBe(3300);
  expect(Number(row!.getCell(12).value)).toBe(2000);
  expect(Number(row!.getCell(13).value)).toBe(2900);
  expect(Number(row!.getCell(14).value)).toBe(3300);
  expect(String(row!.getCell(16).value)).toBe("S, M");

  await deleteTestProduct(product.id);
});

test("an exported row edited and re-uploaded updates that product in place", async ({ page }) => {
  const product = await createTestProduct({ name: "Excel Update Product", price: 1900, stock: 6 });

  await loginAsAdmin(page);
  const { workbook, sheet } = await downloadCatalog(page);
  const row = findRowBySku(sheet, product.sku)!;
  row.getCell(3).value = "Excel Update Product (renamed)";
  row.getCell(10).value = 2400;
  row.getCell(18).value = "New In";

  const before = await query("select id from products");

  // Upload through the real admin screen, not just the API.
  await page.goto("/admin/products/import");
  await page.locator('input[type="file"]').setInputFiles({
    name: "catalog.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await toBuffer(workbook),
  });
  await page.locator("button", { hasText: "Import Products" }).click();

  await expect(page.locator(".notice-box")).toContainText("matched by Product ID", { timeout: 30_000 });

  const updated = await getProductBySku(product.sku);
  expect(updated!.name).toBe("Excel Update Product (renamed)");
  expect(updated!.price).toBe(2400);
  expect(updated!.badge).toBe("New In");

  // Updating must not duplicate anything.
  const after = await query("select id from products");
  expect(after.length).toBe(before.length);

  await deleteTestProduct(product.id);
});

test("a new row creates a product, and Maximum Round Up To sets the live price", async ({ page }) => {
  await loginAsAdmin(page);
  const { workbook, sheet } = await downloadCatalog(page);

  const name = `Excel Created Product ${Date.now().toString(36)}`;
  const row = sheet.addRow([]);
  row.getCell(1).value = ""; // blank Product ID → create
  row.getCell(2).value = "Casual Wear";
  row.getCell(3).value = name;
  row.getCell(4).value = "Imported from the master sheet.";
  row.getCell(5).value = "Test cotton";
  row.getCell(10).value = 999; // Price column…
  row.getCell(12).value = 500;
  row.getCell(13).value = 799;
  row.getCell(14).value = 899; // …overridden by Maximum Round Up To
  row.getCell(15).value = 6;
  row.getCell(16).value = "S, M, L";
  row.getCell(17).value = "Test Indigo:#1d4e89";
  row.commit();

  const res = await page.request.post("/api/admin/import-products", {
    multipart: {
      file: {
        name: "catalog.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: await toBuffer(workbook),
      },
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.created).toBe(1);
  expect(body.errors).toHaveLength(0);

  const created = await queryOne<{ id: string; price: number; max_round_up_to: number; min_round_up_to: number; landed_cost: number; stock: number }>(
    "select id, price, max_round_up_to, min_round_up_to, landed_cost, stock from products where name = $1",
    [name]
  );
  expect(created).not.toBeNull();
  // The standing rule: Maximum Round Up To wins over the Price column.
  expect(created!.price).toBe(899);
  expect(created!.max_round_up_to).toBe(899);
  expect(created!.min_round_up_to).toBe(799);
  expect(created!.landed_cost).toBe(500);
  expect(created!.stock).toBe(6);

  const sizes = await query("select label from product_sizes where product_id = $1", [created!.id]);
  expect(sizes).toHaveLength(3);

  await deleteTestProduct(created!.id);
});

test("bad rows are reported by row number instead of failing the whole import", async ({ page }) => {
  await loginAsAdmin(page);
  const { workbook, sheet } = await downloadCatalog(page);
  const goodName = `Excel Mixed Good ${Date.now().toString(36)}`;

  // One good row…
  const good = sheet.addRow([]);
  good.getCell(2).value = "Casual Wear";
  good.getCell(3).value = goodName;
  good.getCell(10).value = 1200;
  good.getCell(15).value = 4;
  good.getCell(16).value = "M, L";
  good.commit();

  // …one with a category that doesn't exist…
  const badCategory = sheet.addRow([]);
  badCategory.getCell(2).value = "Not A Real Category";
  badCategory.getCell(3).value = "Bad Category Row";
  badCategory.getCell(10).value = 1200;
  badCategory.getCell(16).value = "M";
  badCategory.commit();

  // …and one quoting a Product ID that was never exported.
  const badId = sheet.addRow([]);
  badId.getCell(1).value = "URVI-NOT-A-REAL-ID";
  badId.getCell(2).value = "Casual Wear";
  badId.getCell(3).value = "Bad Product ID Row";
  badId.getCell(10).value = 1200;
  badId.getCell(16).value = "M";
  badId.commit();

  const res = await page.request.post("/api/admin/import-products", {
    multipart: {
      file: {
        name: "catalog.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: await toBuffer(workbook),
      },
    },
  });
  const body = await res.json();

  expect(body.created).toBe(1); // the good row still went in
  expect(body.errors).toHaveLength(2);
  const reasons = body.errors.map((e: { reason: string }) => e.reason).join(" ");
  expect(reasons).toContain("Unrecognised category");
  expect(reasons).toContain("doesn't match any existing product");
  for (const e of body.errors) expect(typeof e.row).toBe("number");

  const created = await queryOne<{ id: string }>("select id from products where name = $1", [goodName]);
  await deleteTestProduct(created!.id);
  expect(await queryOne("select id from products where name = $1", ["Bad Category Row"])).toBeNull();
});

test.describe("protecting product identity", () => {
  test("refuses a row whose Product ID was cleared, instead of creating a duplicate", async ({ page }) => {
    const product = await createTestProduct({ name: "Cleared ID Product", price: 2000 });

    await loginAsAdmin(page);
    const { workbook, sheet } = await downloadCatalog(page);
    const row = findRowBySku(sheet, product.sku)!;
    row.getCell(1).value = ""; // the accident: Product ID wiped

    const res = await page.request.post("/api/admin/import-products", {
      multipart: {
        file: {
          name: "catalog.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: await toBuffer(workbook),
        },
      },
    });
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].reason).toContain("already exists but this row has no Product ID");
    // It names the ID to put back, and promises nothing was duplicated.
    expect(body.errors[0].reason).toContain(product.sku);

    // Still exactly one product with that name.
    const rows = await query("select id from products where name = $1", ["Cleared ID Product"]);
    expect(rows).toHaveLength(1);

    await deleteTestProduct(product.id);
  });

  test("refuses both rows when one Product ID appears twice", async ({ page }) => {
    const product = await createTestProduct({ name: "Duplicated ID Product", price: 2000 });

    await loginAsAdmin(page);
    const { workbook, sheet } = await downloadCatalog(page);
    const original = findRowBySku(sheet, product.sku)!;
    original.getCell(3).value = "First Rename Attempt";

    // The same Product ID pasted onto a second row.
    const copy = sheet.addRow([]);
    copy.getCell(1).value = product.sku;
    copy.getCell(2).value = "Casual Wear";
    copy.getCell(3).value = "Second Rename Attempt";
    copy.getCell(10).value = 3000;
    copy.getCell(16).value = "M";
    copy.commit();

    const res = await page.request.post("/api/admin/import-products", {
      multipart: {
        file: {
          name: "catalog.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: await toBuffer(workbook),
        },
      },
    });
    const body = await res.json();

    // Both of the ambiguous rows are refused by row number; every other row
    // in the sheet still applies as normal.
    expect(body.errors).toHaveLength(2);
    for (const e of body.errors) expect(e.reason).toContain("appears on more than one row");

    // Neither rename was applied — the ambiguity left the product untouched.
    const saved = await getProductBySku(product.sku);
    expect(saved!.name).toBe("Duplicated ID Product");
    expect(saved!.price).toBe(2000);

    await deleteTestProduct(product.id);
  });

  test("refuses to add the same brand-new product twice in one sheet", async ({ page }) => {
    await loginAsAdmin(page);
    const { workbook, sheet } = await downloadCatalog(page);
    const name = `Twice Added Product ${Date.now().toString(36)}`;

    for (let i = 0; i < 2; i++) {
      const row = sheet.addRow([]);
      row.getCell(2).value = "Casual Wear";
      row.getCell(3).value = name;
      row.getCell(10).value = 1500;
      row.getCell(16).value = "M";
      row.commit();
    }

    const res = await page.request.post("/api/admin/import-products", {
      multipart: {
        file: {
          name: "catalog.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: await toBuffer(workbook),
        },
      },
    });
    const body = await res.json();

    expect(body.created).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].reason).toContain("appears twice as a new product");

    const rows = await query<{ id: string }>("select id from products where name = $1", [name]);
    expect(rows).toHaveLength(1);
    await deleteTestProduct(rows[0].id);
  });

  test("a Product ID never changes, however much else the sheet edits", async ({ page }) => {
    const product = await createTestProduct({ name: "Identity Stable Product", price: 1000 });

    await loginAsAdmin(page);
    const { workbook, sheet } = await downloadCatalog(page);
    const row = findRowBySku(sheet, product.sku)!;
    // Change everything a person might plausibly edit.
    row.getCell(2).value = "Festive Wear";
    row.getCell(3).value = "Completely Different Name";
    row.getCell(4).value = "A totally rewritten description.";
    row.getCell(5).value = "Different fabric";
    row.getCell(10).value = 7777;
    row.getCell(16).value = "XS, S, M, L, XL";
    row.getCell(17).value = "Changed Color:#123456";

    await page.request.post("/api/admin/import-products", {
      multipart: {
        file: {
          name: "catalog.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: await toBuffer(workbook),
        },
      },
    });

    // Same row, same Product ID, everything else updated.
    const saved = await getProductBySku(product.sku);
    expect(saved).not.toBeNull();
    expect(saved!.id).toBe(product.id);
    expect(saved!.sku).toBe(product.sku);
    expect(saved!.name).toBe("Completely Different Name");
    expect(saved!.price).toBe(7777);

    // And still exactly one product — no duplicate spawned by the rename.
    const rows = await query("select id from products where id = $1 or name = $2", [
      product.id,
      "Completely Different Name",
    ]);
    expect(rows).toHaveLength(1);

    await deleteTestProduct(product.id);
  });

  test("reports how many catalog products the sheet didn't mention", async ({ page }) => {
    const product = await createTestProduct({ name: "Only Row In Sheet", price: 1200 });

    await loginAsAdmin(page);
    const { workbook, sheet } = await downloadCatalog(page);

    // Strip the sheet back to just this one product's row.
    const keep = findRowBySku(sheet, product.sku)!;
    const keepValues = keep.values;
    const lastRow = sheet.rowCount;
    for (let r = lastRow; r >= 2; r--) sheet.spliceRows(r, 1);
    sheet.addRow([]).values = keepValues;

    const res = await page.request.post("/api/admin/import-products", {
      multipart: {
        file: {
          name: "catalog.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: await toBuffer(workbook),
        },
      },
    });
    const body = await res.json();

    expect(body.updated).toBe(1);
    // Everything else in the catalog was left alone — never deleted — and
    // the count says so.
    expect(body.untouched).toBeGreaterThan(0);
    const stillThere = await query("select id from products");
    expect(stillThere.length).toBeGreaterThan(1);

    await deleteTestProduct(product.id);
  });
});

test("rejects a file that isn't a workbook at all", async ({ page }) => {
  await loginAsAdmin(page);
  const res = await page.request.post("/api/admin/import-products", {
    multipart: {
      file: { name: "notes.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("this is not a workbook") },
    },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toContain("valid .xlsx file");
});

test("a Co-ords row imports into the new Co-ords category and reaches the shop", async ({ page }) => {
  await loginAsAdmin(page);
  const { workbook, sheet } = await downloadCatalog(page);

  // Co-ord sets are a real category in the product master workbook; before
  // migration 012 the website had no category by that name and every co-ord
  // row was refused as "Unrecognised category".
  const name = `Excel Co-ord Set ${Date.now().toString(36)}`;
  const row = sheet.addRow([]);
  row.getCell(1).value = "";
  row.getCell(2).value = "Co-ords";
  row.getCell(3).value = name;
  row.getCell(4).value = "A two-piece co-ord set imported from the master sheet.";
  row.getCell(5).value = "Muslin · Floral Print";
  row.getCell(12).value = 1142;
  row.getCell(13).value = 1660;
  row.getCell(14).value = 1890;
  row.getCell(15).value = 4;
  row.getCell(16).value = "M, L, XL, XXL";
  row.getCell(17).value = "Cream:#F3E9D8";
  row.commit();

  const res = await page.request.post("/api/admin/import-products", {
    multipart: {
      file: {
        name: "catalog.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: await toBuffer(workbook),
      },
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.errors).toHaveLength(0);
  expect(body.created).toBe(1);

  const created = await queryOne<{ id: string; slug: string; price: number; category_slug: string }>(
    `select p.id, p.slug, p.price, c.slug as category_slug
       from products p join categories c on c.id = p.category_id
      where p.name = $1`,
    [name]
  );
  expect(created).not.toBeNull();
  expect(created!.category_slug).toBe("co-ords");
  // No photo in the sheet, so the co-ords placeholder stands in.
  const image = await queryOne<{ url: string }>("select url from product_images where product_id = $1", [created!.id]);
  expect(image!.url).toBe("/placeholders/co-ords.svg");

  // And it is shoppable: Co-ords sits under the Everyday parent group.
  await page.goto("/shop?sub=co-ords");
  await expect(page.locator(".product-card", { hasText: name })).toHaveCount(1);

  await deleteTestProduct(created!.id);
});
