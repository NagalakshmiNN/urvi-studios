import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { distributeStock } from "@/lib/stock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  if (typeof v === "object" && "text" in (v as object)) {
    return String((v as { text: unknown }).text ?? "");
  }
  return String(v).trim();
}

const CATEGORY_PLACEHOLDER: Record<string, string> = {
  "festive-wear": "/placeholders/festive-wear.svg",
  "office-wear": "/placeholders/office-wear.svg",
  "casual-wear": "/placeholders/casual-wear.svg",
  "short-tops": "/placeholders/short-tops.svg",
  kurta: "/placeholders/kurta.svg",
  "fusion-edit": "/placeholders/fusion-edit.svg",
};

export async function POST(request: Request) {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid .xlsx file." }, { status: 400 });
  }

  // Find the sheet with the product table — prefer one literally named
  // "Add Products" (our template), otherwise the last sheet (Instructions
  // is usually first), otherwise whatever's there.
  const sheet =
    workbook.getWorksheet("Add Products") ??
    workbook.worksheets[workbook.worksheets.length - 1] ??
    workbook.worksheets[0];
  if (!sheet) return NextResponse.json({ error: "The workbook has no sheets." }, { status: 400 });

  // Locate the header row by scanning the first 6 rows for one containing
  // "Category" — the template has two title rows above it, but a hand-edited
  // file might not.
  let headerRowNumber = -1;
  let headers: Record<string, number> = {};
  for (let r = 1; r <= 6; r++) {
    const row = sheet.getRow(r);
    const map: Record<string, number> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const t = cellText(cell).toLowerCase();
      if (t) map[t] = colNumber;
    });
    if (Object.keys(map).some((h) => h.includes("category")) && Object.keys(map).some((h) => h.includes("product name"))) {
      headerRowNumber = r;
      headers = map;
      break;
    }
  }
  if (headerRowNumber === -1) {
    return NextResponse.json(
      { error: "Couldn't find the header row (expected columns like \"Category\" and \"Product Name\") — please use the template as given." },
      { status: 400 }
    );
  }

  const col = (name: string) => {
    const key = Object.keys(headers).find((h) => h.includes(name));
    return key ? headers[key] : undefined;
  };
  const cProductId = col("product id");
  const cCategory = col("category");
  const cName = col("product name");
  const cDescription = col("description");
  const cFabric = col("material");
  const cPerfectFor = col("perfect for");
  const cBestWeather = col("best weather");
  const cStyling = col("ease");
  const cStyle = col("style");
  const cPrice = col("price");
  const cCompareAt = col("compare-at");
  const cLandedCost = col("landed cost");
  const cMinRoundUp = col("minimum round");
  const cMaxRoundUp = col("maximum round");
  const cStock = col("stock");
  const cSizes = col("sizes");
  const cColors = col("colors");
  const cBadge = col("badge");
  const cPhotos = col("photos");

  if (!cCategory || !cName || !cPrice) {
    return NextResponse.json({ error: "The sheet is missing required columns (Category, Product Name, Price)." }, { status: 400 });
  }

  const categories = await db.query.categories.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c]));

  const existingProducts = await db.query.products.findMany({ columns: { id: true, slug: true, sku: true, name: true } });
  const existingSlugs = new Set(existingProducts.map((p) => p.slug));
  const productBySku = new Map(existingProducts.map((p) => [p.sku.toLowerCase().trim(), p]));
  // Used to catch a row whose Product ID was accidentally cleared: a "new"
  // product sharing an existing product's exact name is almost always that,
  // not a genuinely new piece.
  const productByName = new Map(existingProducts.map((p) => [p.name.toLowerCase().trim(), p]));

  // First pass, before anything is written: find any Product ID that appears
  // on more than one row. Applying those would silently let the last row win
  // and quietly discard the other — so both rows are refused instead.
  const rowsByProductId = new Map<string, number[]>();
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (!cellText(row.getCell(cName))) continue;
    const id = cProductId ? cellText(row.getCell(cProductId)).trim().toLowerCase() : "";
    if (!id) continue;
    rowsByProductId.set(id, [...(rowsByProductId.get(id) ?? []), r]);
  }

  let created = 0;
  let updated = 0;
  let skippedExample = 0;
  const errors: { row: number; reason: string }[] = [];
  // Which existing products this sheet actually touched, so the result can
  // say how many were left alone (rather than leaving that a silent unknown).
  const touchedProductIds = new Set<string>();
  // Names created during this same import, to catch a sheet that would add
  // the same new product twice in one go.
  const namesCreatedThisImport = new Set<string>();

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row.getCell(cName));
    if (!name) continue; // blank row

    const photosText = cPhotos ? cellText(row.getCell(cPhotos)) : "";
    if (photosText.trim().toLowerCase() === "(insert photo here)") {
      skippedExample++;
      continue; // the untouched example row
    }

    if (name.length < 3) {
      errors.push({ row: r, reason: "Product name is too short." });
      continue;
    }

    const productIdText = cProductId ? cellText(row.getCell(cProductId)).trim() : "";
    const existingProduct = productIdText ? productBySku.get(productIdText.toLowerCase()) : undefined;
    if (productIdText && !existingProduct) {
      errors.push({ row: r, reason: `Product ID "${productIdText}" doesn't match any existing product — leave it blank to create a new one, or check it's copied correctly from an exported sheet.` });
      continue;
    }

    // The same Product ID on two rows is ambiguous — refuse both rather than
    // letting one silently overwrite the other.
    if (productIdText) {
      const duplicateRows = rowsByProductId.get(productIdText.toLowerCase()) ?? [];
      if (duplicateRows.length > 1) {
        errors.push({
          row: r,
          reason: `Product ID "${productIdText}" appears on more than one row (rows ${duplicateRows.join(", ")}) — each product may only appear once. Nothing was changed for it.`,
        });
        continue;
      }
    }

    // A blank Product ID means "create a new product". If a product with this
    // exact name already exists, that's almost certainly an ID cleared by
    // accident — creating a duplicate here would be very hard to unpick, so
    // it's refused with both ways out spelled out.
    if (!productIdText) {
      const nameClash = productByName.get(name.toLowerCase().trim());
      if (nameClash) {
        errors.push({
          row: r,
          reason: `"${name}" already exists but this row has no Product ID — put ${nameClash.sku} back in the Product ID column to update it, or rename this row if it really is a different product. No duplicate was created.`,
        });
        continue;
      }
      if (namesCreatedThisImport.has(name.toLowerCase().trim())) {
        errors.push({ row: r, reason: `"${name}" appears twice as a new product in this sheet — only the first was created.` });
        continue;
      }
    }

    const categoryRaw = cellText(row.getCell(cCategory));
    const category = categoryByName.get(categoryRaw.toLowerCase().trim());
    if (!category) {
      errors.push({ row: r, reason: `Unrecognised category "${categoryRaw || "(blank)"}" — use one from the dropdown.` });
      continue;
    }

    // The "Maximum Round Up To" column, when the sheet has it and this row
    // has a value in it, is the rule for price going forward — it wins over
    // whatever the Price column says. Falls back to Price so older sheets
    // (or a row that just hasn't been costed yet) still work.
    const maxRoundUpText = cMaxRoundUp ? cellText(row.getCell(cMaxRoundUp)).replace(/[^\d.]/g, "") : "";
    const maxRoundUpTo = maxRoundUpText ? Math.round(parseFloat(maxRoundUpText)) : null;
    const priceText = cellText(row.getCell(cPrice)).replace(/[^\d.]/g, "");
    const price = maxRoundUpTo && maxRoundUpTo > 0 ? maxRoundUpTo : Math.round(parseFloat(priceText));
    if (!Number.isFinite(price) || price <= 0) {
      errors.push({ row: r, reason: "Missing or invalid price (and no Maximum Round Up To value to fall back on)." });
      continue;
    }

    const landedCostText = cLandedCost ? cellText(row.getCell(cLandedCost)).replace(/[^\d.]/g, "") : "";
    const landedCost = landedCostText ? Math.round(parseFloat(landedCostText)) : null;
    const minRoundUpText = cMinRoundUp ? cellText(row.getCell(cMinRoundUp)).replace(/[^\d.]/g, "") : "";
    const minRoundUpTo = minRoundUpText ? Math.round(parseFloat(minRoundUpText)) : null;

    const sizesText = cSizes ? cellText(row.getCell(cSizes)) : "";
    const sizeLabels = sizesText.split(",").map((s) => s.trim()).filter(Boolean);
    if (sizeLabels.length === 0) {
      errors.push({ row: r, reason: "No sizes listed." });
      continue;
    }

    const description = cDescription ? cellText(row.getCell(cDescription)) : "";
    const fabric = cFabric ? cellText(row.getCell(cFabric)) : "";
    const perfectFor = cPerfectFor ? cellText(row.getCell(cPerfectFor)) : "";
    const bestWeather = cBestWeather ? cellText(row.getCell(cBestWeather)) : "";
    const stylingTips = cStyling ? cellText(row.getCell(cStyling)) : "";
    const styleNotes = cStyle ? cellText(row.getCell(cStyle)) : "";
    const compareAtText = cCompareAt ? cellText(row.getCell(cCompareAt)).replace(/[^\d.]/g, "") : "";
    const compareAtPrice = compareAtText ? Math.round(parseFloat(compareAtText)) : null;
    const stockText = cStock ? cellText(row.getCell(cStock)).replace(/[^\d.]/g, "") : "";
    const stock = stockText ? Math.max(0, Math.round(parseFloat(stockText))) : 10;
    const badge = cBadge ? cellText(row.getCell(cBadge)) : "";
    const colorsText = cColors ? cellText(row.getCell(cColors)) : "";
    const colorPairs = colorsText.split(",").map((s) => s.trim()).filter(Boolean);

    if (existingProduct) {
      // Product ID matched an existing row — update it in place rather than
      // creating a duplicate. Sizes and colors are fully replaced with what
      // the sheet now says, same as the admin "Edit Product" screen. Photos
      // are deliberately left untouched: the sheet was never a reliable
      // source of real photo data, and overwriting real uploaded photos with
      // a placeholder on every re-import would be actively destructive.
      await db
        .update(schema.products)
        .set({
          name,
          description: description || "Details coming soon.",
          fabric: fabric || "See description",
          perfectFor: perfectFor || null,
          bestWeather: bestWeather || null,
          stylingTips: stylingTips || null,
          styleNotes: styleNotes || null,
          price,
          compareAtPrice,
          landedCost,
          minRoundUpTo,
          maxRoundUpTo,
          badge: badge || null,
          stock,
          categoryId: category.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, existingProduct.id));

      // The sheet only has one "Stock" number per row, not a count per
      // size — split it as evenly as possible across the sizes listed so
      // it lands somewhere real rather than zero; fine-tune the exact
      // per-size split afterward from Edit Product.
      const sizeStocks = distributeStock(stock, sizeLabels.length);
      await db.delete(schema.productSizes).where(eq(schema.productSizes.productId, existingProduct.id));
      await db.insert(schema.productSizes).values(sizeLabels.map((label, i) => ({ productId: existingProduct.id, label, stock: sizeStocks[i], position: i })));

      await db.delete(schema.productColors).where(eq(schema.productColors.productId, existingProduct.id));
      if (colorPairs.length) {
        await db.insert(schema.productColors).values(
          colorPairs.map((pair, i) => {
            const [colorName, hex] = pair.split(":").map((s) => s.trim());
            return { productId: existingProduct.id, name: colorName || pair, hex: hex || "#999999", position: i };
          })
        );
      }

      touchedProductIds.add(existingProduct.id);
      updated++;
      continue;
    }

    let slugBase = slugify(name);
    if (!slugBase) slugBase = "product";
    let slug = slugBase;
    let n = 1;
    while (existingSlugs.has(slug)) slug = `${slugBase}-${++n}`;
    existingSlugs.add(slug);
    const sku = `URVI-${slugBase.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}-${created}`;

    const [product] = await db
      .insert(schema.products)
      .values({
        sku,
        slug,
        name,
        description: description || "Details coming soon.",
        fabric: fabric || "See description",
        perfectFor: perfectFor || null,
        bestWeather: bestWeather || null,
        stylingTips: stylingTips || null,
        styleNotes: styleNotes || null,
        price,
        compareAtPrice,
        landedCost,
        minRoundUpTo,
        maxRoundUpTo,
        badge: badge || null,
        stock,
        categoryId: category.id,
      })
      .returning();

    // The template's photos are meant to be pasted directly into the cell —
    // that image data isn't something a spreadsheet library can pull out
    // reliably, so new products import with a category placeholder image
    // until real photos are added afterward (drag-and-drop in Edit).
    const imageUrl = CATEGORY_PLACEHOLDER[category.slug] ?? "/placeholders/casual-wear.svg";
    await db.insert(schema.productImages).values({ productId: product.id, url: imageUrl, position: 0 });
    const newSizeStocks = distributeStock(stock, sizeLabels.length);
    await db.insert(schema.productSizes).values(sizeLabels.map((label, i) => ({ productId: product.id, label, stock: newSizeStocks[i], position: i })));
    if (colorPairs.length) {
      await db.insert(schema.productColors).values(
        colorPairs.map((pair, i) => {
          const [colorName, hex] = pair.split(":").map((s) => s.trim());
          return { productId: product.id, name: colorName || pair, hex: hex || "#999999", position: i };
        })
      );
    }

    namesCreatedThisImport.add(name.toLowerCase().trim());
    created++;
  }

  // Products already in the catalog that this sheet didn't mention at all.
  // They are deliberately left exactly as they are — a missing row means
  // "not in this file", never "delete this" — but the count is reported so a
  // half-complete sheet doesn't pass unnoticed.
  const untouched = existingProducts.length - touchedProductIds.size;

  return NextResponse.json({ created, updated, skippedExample, untouched, errors });
}
