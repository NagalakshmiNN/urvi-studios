// Recording a purchase: one invoice in, everything else follows.
//
// This is the step that makes the app the system of record rather than a copy
// of one. Saving a purchase does, in a single transaction, what used to be
// four separate manual jobs across two systems:
//
//   1. creates the vendor, if this is the first invoice from them;
//   2. creates a product per (item, colour) and a size row per size, or adds
//      to the ones already there;
//   3. works out landed cost per piece across *every* purchase of that
//      product, not just this one — the weighted average the workbook's
//      SUMIFS has always computed;
//   4. prices new products from the markup bands, and records what was paid so
//      the Money Map stays right.
//
// Two deliberate asymmetries, both about not surprising anyone:
//
//   • **Facts update, decisions don't.** A restock at a different cost updates
//     landed cost, because that is simply what the pieces cost. It does not
//     move the price of a product already on sale — that is a decision, and it
//     is offered on the Pricing screen instead of happening silently while
//     someone enters paperwork.
//   • **New products arrive switched off.** They have no photographs yet, and
//     a product going live the moment an invoice is typed is how a category
//     placeholder ends up on the storefront.
//
// Everything here is planned before it is applied. `planPurchase` reads the
// database and describes exactly what would happen; the review screen shows
// that, and `applyPurchase` re-plans inside the transaction and carries it out.

import { db, schema } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { InvoiceBrief } from "@/lib/invoice-brief";
import { reconcile, type Discrepancy } from "@/lib/invoice-brief";
import {
  costPurchase,
  costingByProduct,
  paiseToRupees,
  productKey,
  sizeOrder,
  type CostedPurchase,
  type ProductCosting,
} from "@/lib/purchasing";
import { suggestPricing, type MarkupBand, type SuggestedPricing } from "@/lib/markup-bands";
import { loadBands } from "@/lib/markup-band-store";
import { STOCK_PURCHASE } from "@/lib/money";

/**
 * A name reduced to what actually identifies it.
 *
 * "Short Kurthi - Red", "Short Kurthi — Red" and "short kurthi  –  red" are
 * one product written three ways. Matching on the raw string would create a
 * duplicate every time a dash changed shape, which is precisely how the
 * workbook ended up needing a hand-kept map of renamed products.
 */
export function matchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type PlannedSize = {
  label: string;
  received: number;
  stockBefore: number | null;
  stockAfter: number;
};

export type PlannedProduct = {
  key: string;
  item: string;
  colour: string | null;
  /** The catalogue name this will carry. */
  name: string;
  existing: { id: string; name: string; price: number; landedCost: number | null; isActive: boolean } | null;
  sizes: PlannedSize[];
  totalReceived: number;
  /** Weighted across every purchase of this product, including this one. */
  landedCostRupees: number;
  landedCostBefore: number | null;
  suggested: SuggestedPricing | null;
  /** What the price would become. Applied for a new product; offered for an existing one. */
  priceAfter: number | null;
  category: { id: string; name: string } | null;
  problems: string[];
};

export type PlannedExpense = { category: string; description: string; amountPaise: number };

export type PurchasePlan = {
  vendor: { id: string | null; code: string; name: string; isNew: boolean };
  costed: CostedPurchase;
  discrepancies: Discrepancy[];
  products: PlannedProduct[];
  expenses: PlannedExpense[];
  warnings: string[];
  problems: string[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

async function nextVendorCode(tx: Db): Promise<string> {
  const rows = await tx.select({ code: schema.vendors.code }).from(schema.vendors);
  const highest = rows
    .map((r) => Number(/^V(\d+)$/.exec(r.code)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `V${String(highest + 1).padStart(3, "0")}`;
}

/** PO-00006 onward. Atomic, so two invoices entered at once cannot share a number. */
async function nextPurchaseRef(tx: Db): Promise<string> {
  const result = await tx.execute<{ value: number }>(sql`
    INSERT INTO ${schema.counters} (key, value) VALUES ('purchases', 1)
    ON CONFLICT (key) DO UPDATE SET value = ${schema.counters.value} + 1
    RETURNING value
  `);
  return `PO-${String(result.rows[0]?.value ?? 1).padStart(5, "0")}`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "product";
}

const CATEGORY_CODE_OVERRIDES: Record<string, string> = {
  "casual wear": "CAS",
  "festive wear": "FES",
  "office wear": "OFF",
  "co ords": "COR",
  "short tops": "TOP",
};

function categoryCode(name: string): string {
  const fallback = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return CATEGORY_CODE_OVERRIDES[matchKey(name)] ?? (fallback || "GEN");
}

/**
 * What saving this invoice would do.
 *
 * Reads, never writes. The review screen renders this verbatim, so anything
 * surprising shows up before it happens rather than in the catalogue after.
 */
export async function planPurchase(brief: InvoiceBrief, conn: Db = db): Promise<PurchasePlan> {
  const warnings: string[] = [];
  const problems: string[] = [];

  const costed = costPurchase({
    lines: brief.lines,
    freightPaise: brief.invoice.freightPaise,
    discountPaise: brief.invoice.discountPaise,
    otherChargesPaise: brief.invoice.otherChargesPaise,
  });

  const discrepancies = reconcile(brief.statedTotals, costed);

  // ------------------------------------------------------------ the vendor
  const vendors = await conn.select().from(schema.vendors);
  const wanted = matchKey(brief.vendor.name);
  const found =
    (brief.vendor.gstin ? vendors.find((v) => v.gstin === brief.vendor.gstin) : undefined) ??
    vendors.find((v) => matchKey(v.name) === wanted) ??
    vendors.find((v) => v.businessName && matchKey(v.businessName) === wanted);

  const vendor = found
    ? { id: found.id, code: found.code, name: found.name, isNew: false }
    : { id: null, code: await nextVendorCode(conn), name: brief.vendor.name, isNew: true };

  if (found && brief.vendor.gstin && found.gstin && found.gstin !== brief.vendor.gstin) {
    warnings.push(
      `${found.name} is already on file with GSTIN ${found.gstin}, but this invoice says ${brief.vendor.gstin}. The one on file is kept.`
    );
  }

  // ---------------------------------------------------------- the products
  const existingProducts = await conn
    .select({
      id: schema.products.id,
      name: schema.products.name,
      price: schema.products.price,
      landedCost: schema.products.landedCost,
      isActive: schema.products.isActive,
    })
    .from(schema.products);
  const byName = new Map(existingProducts.map((p) => [matchKey(p.name), p]));

  const categories = await conn
    .select({ id: schema.categories.id, name: schema.categories.name, slug: schema.categories.slug })
    .from(schema.categories);

  const bands = await loadBands(conn);
  const costings = costingByProduct(costed);

  const existingIds = costings
    .map((c) => byName.get(matchKey(productKey(c.item, c.colour)))?.id)
    .filter((id): id is string => !!id);

  // Stock already on hand, and cost already spent, for the products this
  // invoice touches — needed for the weighted average and for showing the
  // before/after on every size.
  const priorSizes = existingIds.length
    ? await conn.select().from(schema.productSizes).where(inArray(schema.productSizes.productId, existingIds))
    : [];
  const priorLines = existingIds.length
    ? await conn
        .select({
          productId: schema.purchaseLines.productId,
          qty: schema.purchaseLines.qty,
          landedPaise: schema.purchaseLines.landedPaise,
        })
        .from(schema.purchaseLines)
        .where(inArray(schema.purchaseLines.productId, existingIds))
    : [];

  const products: PlannedProduct[] = costings.map((costing) => plan(costing));

  function plan(costing: ProductCosting): PlannedProduct {
    const name = productKey(costing.item, costing.colour);
    const existing = byName.get(matchKey(name)) ?? null;
    const lineProblems: string[] = [];

    // ---- sizes and stock
    const mine = priorSizes.filter((s) => existing && s.productId === existing.id);
    const sizes: PlannedSize[] = costing.sizes.map((s) => {
      const before = mine.find((m) => m.label === s.label);
      return {
        label: s.label,
        received: s.qty,
        stockBefore: existing ? before?.stock ?? 0 : null,
        stockAfter: (before?.stock ?? 0) + s.qty,
      };
    });
    sizes.sort((a, b) => sizeOrder(a.label) - sizeOrder(b.label));

    // ---- landed cost, weighted across every purchase ever made of this product
    const prior = priorLines.filter((l) => existing && l.productId === existing.id);
    const priorQty = prior.reduce((a, l) => a + l.qty, 0);
    const priorPaise = prior.reduce((a, l) => a + l.landedPaise, 0);
    const totalQty = priorQty + costing.totalQty;
    const totalPaise = priorPaise + costing.landedTotalPaise;
    const landedCostRupees = totalQty > 0 ? paiseToRupees(Math.round(totalPaise / totalQty)) : 0;

    // ---- the price this cost suggests
    const suggested = suggestPricing(totalQty > 0 ? Math.round(totalPaise / totalQty) : 0, bands);
    if (!suggested) {
      lineProblems.push("No unit price on the invoice, so there is no cost to price from — this will go in with no price.");
    }

    // ---- category, only needed for something new
    let category: { id: string; name: string } | null = null;
    if (!existing) {
      const wantedCategory = brief.lines.find((l) => productKey(l.item, l.colour) === name)?.category;
      if (!wantedCategory) {
        lineProblems.push("New product with no category on the invoice block — add one before saving.");
      } else {
        const match =
          categories.find((c) => matchKey(c.name) === matchKey(wantedCategory)) ??
          categories.find((c) => c.slug === slugify(wantedCategory));
        if (!match) {
          lineProblems.push(
            `Category "${wantedCategory}" doesn't exist on the site. Use one of: ${categories.map((c) => c.name).join(", ")}.`
          );
        } else category = { id: match.id, name: match.name };
      }
    }

    return {
      key: costing.key,
      item: costing.item,
      colour: costing.colour,
      name,
      existing,
      sizes,
      totalReceived: costing.totalQty,
      landedCostRupees,
      landedCostBefore: existing?.landedCost ?? null,
      suggested,
      // A new product takes the suggested price. An existing one keeps its own.
      priceAfter: existing ? existing.price : suggested?.price ?? null,
      category,
      problems: lineProblems,
    };
  }

  for (const p of products) problems.push(...p.problems.map((m) => `${p.name}: ${m}`));

  // ---------------------------------------------------------- what was paid
  const expenses: PlannedExpense[] = [];
  if (costed.invoiceTotalPaise > 0) {
    expenses.push({
      category: STOCK_PURCHASE,
      description: `${vendor.name} — invoice ${brief.invoice.number}`,
      amountPaise: costed.invoiceTotalPaise,
    });
  }
  if (costed.freightPaise > 0) {
    expenses.push({
      category: "Transportation",
      description: `Inbound freight — invoice ${brief.invoice.number}`,
      amountPaise: costed.freightPaise,
    });
  }
  if (costed.otherChargesPaise > 0) {
    expenses.push({
      category: "Other",
      description: `Other charges — invoice ${brief.invoice.number}`,
      amountPaise: costed.otherChargesPaise,
    });
  }

  for (const d of discrepancies) {
    warnings.push(
      `${d.label}: the invoice says ₹${(d.statedPaise / 100).toFixed(2)}, this works out to ₹${(d.computedPaise / 100).toFixed(2)} — ` +
        `a difference of ₹${(Math.abs(d.differencePaise) / 100).toFixed(2)}.` +
        (Math.abs(d.differencePaise) <= 500 ? " Small enough to be the vendor's own rounding." : " Worth checking against the paper.")
    );
  }

  return { vendor, costed, discrepancies, products, expenses, warnings, problems };
}

export type PurchaseResult = { purchaseId: string; ref: string; productsCreated: number; productsUpdated: number; piecesReceived: number };

/** Carry the plan out. Re-planned inside the transaction, so nothing drifts between review and save. */
export async function applyPurchase(brief: InvoiceBrief): Promise<PurchaseResult> {
  return db.transaction(async (tx) => {
    const p = await planPurchase(brief, tx);
    if (p.problems.length > 0) {
      throw new Error(`This can't be saved yet:\n${p.problems.map((m) => `• ${m}`).join("\n")}`);
    }

    // -------------------------------------------------------------- vendor
    let vendorId = p.vendor.id;
    if (!vendorId) {
      const [row] = await tx
        .insert(schema.vendors)
        .values({
          code: p.vendor.code,
          name: brief.vendor.name,
          businessName: brief.vendor.businessName,
          city: brief.vendor.city,
          state: brief.vendor.state,
          gstin: brief.vendor.gstin,
          pan: brief.vendor.pan,
          type: brief.vendor.type,
          phone: brief.vendor.phone,
        })
        .returning({ id: schema.vendors.id });
      vendorId = row.id;
    }

    // ------------------------------------------------------------ purchase
    const ref = await nextPurchaseRef(tx);
    const [purchase] = await tx
      .insert(schema.purchases)
      .values({
        ref,
        vendorId,
        invoiceNumber: brief.invoice.number,
        invoiceDate: brief.invoice.date,
        freightPaise: p.costed.freightPaise,
        discountPaise: p.costed.discountPaise,
        otherChargesPaise: p.costed.otherChargesPaise,
        grossPaise: p.costed.grossPaise,
        taxablePaise: p.costed.taxablePaise,
        gstPaise: p.costed.gstPaise,
        landedTotalPaise: p.costed.landedTotalPaise,
        totalQty: p.costed.totalQty,
        paymentMode: brief.invoice.paymentMode,
        notes: brief.invoice.notes,
      })
      .returning({ id: schema.purchases.id });

    // ------------------------------------------------------------ products
    let created = 0;
    let updated = 0;
    const productIdByKey = new Map<string, string>();

    for (const planned of p.products) {
      let productId: string;

      if (planned.existing) {
        productId = planned.existing.id;
        updated++;
      } else {
        const code = categoryCode(planned.category!.name);
        const sku = await uniqueSku(tx, code);
        const slug = await uniqueSlug(tx, slugify(planned.name));
        const [row] = await tx
          .insert(schema.products)
          .values({
            sku,
            slug,
            name: planned.name,
            // A factual placeholder, not invented marketing copy. The workbook
            // did the same: a sourcing note, replaced by real writing later.
            description: `${planned.item}${planned.colour ? ` in ${planned.colour.toLowerCase()}` : ""}. Full description to be added.`,
            fabric: brief.lines.find((l) => productKey(l.item, l.colour) === planned.name)?.fabric ?? "See description",
            price: planned.suggested?.price ?? 0,
            minRoundUpTo: planned.suggested?.minPrice ?? null,
            maxRoundUpTo: planned.suggested?.price ?? null,
            landedCost: planned.landedCostRupees,
            stock: 0,
            // Off until it has photographs. Switched on from the Products screen.
            isActive: false,
            categoryId: planned.category!.id,
          })
          .returning({ id: schema.products.id });
        productId = row.id;
        created++;
      }

      productIdByKey.set(planned.key, productId);

      // ---- sizes: add what arrived, create the size if it is new
      for (const size of planned.sizes) {
        const [existingSize] = await tx
          .select({ id: schema.productSizes.id, stock: schema.productSizes.stock })
          .from(schema.productSizes)
          .where(and(eq(schema.productSizes.productId, productId), eq(schema.productSizes.label, size.label)));

        if (existingSize) {
          await tx
            .update(schema.productSizes)
            .set({ stock: existingSize.stock + size.received })
            .where(eq(schema.productSizes.id, existingSize.id));
        } else {
          await tx.insert(schema.productSizes).values({
            productId,
            label: size.label,
            stock: size.received,
            position: sizeOrder(size.label),
          });
        }
      }
    }

    // --------------------------------------------------------------- lines
    await tx.insert(schema.purchaseLines).values(
      p.costed.lines.map((l, i) => ({
        purchaseId: purchase.id,
        productId: productIdByKey.get(productKey(l.item, l.colour)) ?? null,
        item: l.item,
        colour: l.colour ?? null,
        size: l.size,
        qty: l.qty,
        unitPricePaise: l.unitPricePaise,
        gstRatePct: Math.round(l.gstRatePct),
        discountSharePaise: l.discountSharePaise,
        gstPaise: l.gstPaise,
        freightSharePaise: l.freightSharePaise,
        otherSharePaise: l.otherSharePaise,
        landedPaise: l.landedPaise,
        landedPerUnitPaise: l.landedPerUnitPaise,
        position: i,
      }))
    );

    // ---- landed cost and the aggregate stock column, now that the lines exist
    for (const planned of p.products) {
      const productId = productIdByKey.get(planned.key)!;
      await tx
        .update(schema.products)
        .set({
          landedCost: planned.landedCostRupees,
          ...(planned.existing ? {} : { price: planned.suggested?.price ?? 0 }),
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, productId));

      await tx.execute(sql`
        UPDATE ${schema.products}
        SET stock = COALESCE((SELECT SUM(stock) FROM ${schema.productSizes} WHERE product_id = ${productId}), 0)
        WHERE id = ${productId}
      `);
    }

    // ------------------------------------------------------------ what was paid
    const rates = new Set(p.costed.lines.map((l) => l.gstRatePct));
    for (const e of p.expenses) {
      await tx.insert(schema.expenses).values({
        spentOn: brief.invoice.date,
        category: e.category,
        description: e.description,
        payee: brief.vendor.name,
        amountPaise: e.amountPaise,
        gstRateBp: e.category === STOCK_PURCHASE && rates.size === 1 ? [...rates][0] * 100 : null,
        paymentMode: brief.invoice.paymentMode ?? "Other",
        reference: `${ref} · ${brief.invoice.number}`,
      });
    }

    return {
      purchaseId: purchase.id,
      ref,
      productsCreated: created,
      productsUpdated: updated,
      piecesReceived: p.costed.totalQty,
    };
  });
}

async function uniqueSku(tx: Db, code: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const result = await tx.execute<{ value: number }>(sql`
      INSERT INTO ${schema.counters} (key, value) VALUES (${`sku_${code}`}, 1)
      ON CONFLICT (key) DO UPDATE SET value = ${schema.counters.value} + 1
      RETURNING value
    `);
    const sku = `URVI-${code}-${String(result.rows[0]?.value ?? 1).padStart(3, "0")}`;
    const [clash] = await tx.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.sku, sku));
    if (!clash) return sku;
  }
  throw new Error(`Could not find a free SKU for ${code} — check the products table for duplicates.`);
}

async function uniqueSlug(tx: Db, base: string): Promise<string> {
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    const [clash] = await tx.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, slug));
    if (!clash) return slug;
  }
  throw new Error(`Could not find a free web address for "${base}".`);
}
