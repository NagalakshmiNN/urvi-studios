"use server";

import { getAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { parseInvoiceBrief } from "@/lib/invoice-brief";
import { planPurchase, applyPurchase, type PurchasePlan, type PurchaseResult } from "@/lib/record-purchase";
import { loadBands, saveBands } from "@/lib/markup-band-store";
import { suggestPricing, validateBands, type MarkupBand } from "@/lib/markup-bands";
import { isDocumentKind } from "@/lib/purchase-documents";

async function requireAdmin() {
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authorised");
  return adminId;
}

/** Every screen whose numbers change when stock arrives. */
function revalidateAfterPurchase() {
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/products");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/money");
  revalidatePath("/admin/money/expenses");
  revalidatePath("/admin/pricing");
  revalidatePath("/admin");
}

// ------------------------------------------------------------- Purchases

export type PurchaseFormState =
  | { stage: "empty" }
  | { stage: "errors"; errors: string[]; raw: string }
  | { stage: "review"; plan: PurchasePlan; warnings: string[]; raw: string }
  | { stage: "saved"; result: PurchaseResult };

/**
 * Read the invoice block and say what saving it would do — without saving it.
 *
 * The review step is the whole point of pasting rather than importing. The
 * block came from reading a photograph of a piece of paper, which is the least
 * reliable step in the chain; a screen that shows every product, every size,
 * every price and every discrepancy before anything is written is what makes
 * that acceptable.
 */
export async function previewPurchaseAction(
  _prev: PurchaseFormState | undefined,
  formData: FormData
): Promise<PurchaseFormState> {
  await requireAdmin();
  const raw = String(formData.get("brief") || "").trim();
  if (!raw) return { stage: "errors", errors: ["Paste the invoice block first."], raw };

  const parsed = parseInvoiceBrief(raw);
  if (!parsed.ok) return { stage: "errors", errors: parsed.errors, raw };

  try {
    const plan = await planPurchase(parsed.brief);
    return { stage: "review", plan, warnings: [...parsed.warnings, ...plan.warnings], raw };
  } catch (error) {
    return { stage: "errors", errors: [error instanceof Error ? error.message : String(error)], raw };
  }
}

export async function savePurchaseAction(
  _prev: PurchaseFormState | undefined,
  formData: FormData
): Promise<PurchaseFormState> {
  await requireAdmin();
  const raw = String(formData.get("brief") || "").trim();

  const parsed = parseInvoiceBrief(raw);
  if (!parsed.ok) return { stage: "errors", errors: parsed.errors, raw };

  try {
    const result = await applyPurchase(parsed.brief);
    revalidateAfterPurchase();
    return { stage: "saved", result };
  } catch (error) {
    // The message is written to be read — `applyPurchase` refuses with the
    // specific reasons rather than a generic failure.
    return { stage: "errors", errors: [error instanceof Error ? error.message : String(error)], raw };
  }
}

// --------------------------------------------------------------- Pricing

export type PricingFormState = { error?: string; errors?: string[]; success?: string } | undefined;

function readBands(formData: FormData): MarkupBand[] {
  const count = Number(formData.get("bandCount") || 0);
  const bands: MarkupBand[] = [];
  for (let i = 0; i < count; i++) {
    const upTo = String(formData.get(`upTo_${i}`) ?? "").trim();
    const last = i === count - 1;
    bands.push({
      upToPaise: last || upTo === "" ? null : Math.round(Number(upTo) * 100),
      targetPct: Math.round(Number(formData.get(`target_${i}`) ?? 0)),
      minPct: Math.round(Number(formData.get(`min_${i}`) ?? 0)),
    });
  }
  return bands;
}

export async function saveBandsAction(_prev: PricingFormState, formData: FormData): Promise<PricingFormState> {
  await requireAdmin();

  const bands = readBands(formData);
  if (bands.some((b) => !Number.isFinite(b.targetPct) || !Number.isFinite(b.minPct))) {
    return { error: "Every band needs a target and a minimum markup." };
  }

  const problems = validateBands(bands);
  if (problems.length > 0) {
    return { errors: problems.map((p) => (p.index >= 0 ? `Band ${p.index + 1}: ${p.message}` : p.message)) };
  }

  const saved = await saveBands(bands);
  if (!saved.ok) return { errors: saved.errors };

  revalidatePath("/admin/pricing");
  return { success: "Bands saved. No price has moved — use “Apply to catalogue” below when you're ready." };
}

/**
 * Re-price the catalogue from the bands.
 *
 * Separate from saving the bands, and never automatic. Changing a markup is a
 * decision about what the bands should be; moving two hundred live prices is a
 * different decision, and it deserves its own button and its own confirmation.
 *
 * Only products with a recorded landed cost move. The twenty-eight with none
 * are left exactly as they are — there is nothing to mark up, and a price
 * computed from a cost of zero would be worse than the one already there.
 */
export async function applyPricingAction(_prev: PricingFormState, formData: FormData): Promise<PricingFormState> {
  await requireAdmin();

  const onlyIds = String(formData.get("productIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const bands = await loadBands();
  const rows = await db
    .select({
      id: schema.products.id,
      price: schema.products.price,
      landedCost: schema.products.landedCost,
    })
    .from(schema.products)
    .where(onlyIds.length > 0 ? inArray(schema.products.id, onlyIds) : undefined);

  let moved = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.landedCost == null || row.landedCost <= 0) {
      skipped++;
      continue;
    }
    const suggested = suggestPricing(row.landedCost * 100, bands);
    if (!suggested || suggested.price === row.price) continue;

    await db
      .update(schema.products)
      .set({
        price: suggested.price,
        maxRoundUpTo: suggested.price,
        minRoundUpTo: suggested.minPrice,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, row.id));
    moved++;
  }

  revalidatePath("/admin/pricing");
  revalidatePath("/admin/products");
  revalidatePath("/shop");

  const skippedNote = skipped > 0 ? ` ${skipped} left alone — no landed cost recorded.` : "";
  return {
    success: moved === 0 ? `Nothing to change — every price already matches its band.${skippedNote}` : `${moved} price${moved === 1 ? "" : "s"} updated.${skippedNote}`,
  };
}

// --------------------------------------------------------------- Vendors

export async function saveVendorAction(_prev: PricingFormState, formData: FormData): Promise<PricingFormState> {
  await requireAdmin();

  const id = String(formData.get("vendorId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "A vendor needs a name." };

  const values = {
    name,
    businessName: String(formData.get("businessName") || "").trim() || null,
    city: String(formData.get("city") || "").trim() || null,
    state: String(formData.get("state") || "").trim() || null,
    gstin: String(formData.get("gstin") || "").trim().toUpperCase() || null,
    pan: String(formData.get("pan") || "").trim().toUpperCase() || null,
    type: String(formData.get("type") || "").trim() || null,
    contactPerson: String(formData.get("contactPerson") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    paymentTerms: String(formData.get("paymentTerms") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  };

  if (id) {
    await db.update(schema.vendors).set(values).where(eq(schema.vendors.id, id));
  } else {
    const existing = await db.select({ code: schema.vendors.code }).from(schema.vendors);
    const highest = existing
      .map((v) => Number(/^V(\d+)$/.exec(v.code)?.[1] ?? 0))
      .reduce((a, b) => Math.max(a, b), 0);
    await db.insert(schema.vendors).values({ ...values, code: `V${String(highest + 1).padStart(3, "0")}` });
  }

  revalidatePath("/admin/vendors");
  return { success: id ? "Vendor updated." : "Vendor added." };
}

// ------------------------------------------------------- Purchase paperwork
//
// Uploading is a route (see api/admin/purchase-documents) because a server
// action's body is too small for a photographed invoice. Everything after the
// upload — relabelling, removing, bringing back — is an action, because it is
// small and belongs next to the screen it happens on.

export type DocumentFormState = { error?: string; success?: string } | undefined;

async function documentOnPurchase(documentId: string) {
  const doc = await db.query.purchaseDocuments.findFirst({
    where: eq(schema.purchaseDocuments.id, documentId),
  });
  return doc ?? null;
}

function revalidatePurchase(purchaseId: string) {
  revalidatePath(`/admin/purchases/${purchaseId}`);
  revalidatePath("/admin/purchases");
}

/** Change what a document is called, what it is, or the note against it. */
export async function updateDocumentAction(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  await requireAdmin();

  const id = String(formData.get("documentId") || "").trim();
  const doc = await documentOnPurchase(id);
  if (!doc) return { error: "That document no longer exists." };
  if (doc.deletedAt) return { error: "That document has been removed. Bring it back first, then edit it." };

  const kindRaw = String(formData.get("kind") || "").trim();
  if (!isDocumentKind(kindRaw)) return { error: "Choose what this document is." };

  const filename = String(formData.get("filename") || "").trim();
  if (!filename) return { error: "A document needs a name." };

  await db
    .update(schema.purchaseDocuments)
    .set({
      kind: kindRaw,
      // Renaming is renaming, not re-typing: the extension is part of what the
      // file is, so it is kept whatever the box says.
      filename: keepExtension(doc.filename, filename),
      notes: String(formData.get("notes") || "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.purchaseDocuments.id, id));

  revalidatePurchase(doc.purchaseId);
  return { success: "Saved." };
}

function keepExtension(original: string, wanted: string): string {
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(original)?.[0] ?? "";
  if (!ext) return wanted;
  return wanted.toLowerCase().endsWith(ext.toLowerCase()) ? wanted : wanted + ext;
}

/**
 * Remove a document — softly.
 *
 * It stops being listed and stops being served, but the row and its contents
 * stay. Paperwork deleted by mistake is paperwork that may be wanted at the end
 * of the financial year, and there is no getting an invoice back once the bytes
 * are gone.
 */
export async function deleteDocumentAction(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  await requireAdmin();

  const id = String(formData.get("documentId") || "").trim();
  const doc = await documentOnPurchase(id);
  if (!doc) return { error: "That document no longer exists." };
  if (doc.deletedAt) return { error: "That document is already removed." };

  await db
    .update(schema.purchaseDocuments)
    .set({
      deletedAt: new Date(),
      deletedReason: String(formData.get("reason") || "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.purchaseDocuments.id, id));

  revalidatePurchase(doc.purchaseId);
  return { success: `Removed ${doc.filename}. It can be brought back from “Removed paperwork” below.` };
}

/** Undo a removal. */
export async function restoreDocumentAction(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  await requireAdmin();

  const id = String(formData.get("documentId") || "").trim();
  const doc = await documentOnPurchase(id);
  if (!doc) return { error: "That document no longer exists." };
  if (!doc.deletedAt) return { error: "That document is already in use." };

  await db
    .update(schema.purchaseDocuments)
    .set({ deletedAt: null, deletedReason: null, updatedAt: new Date() })
    .where(eq(schema.purchaseDocuments.id, id));

  revalidatePurchase(doc.purchaseId);
  return { success: `${doc.filename} is back.` };
}
