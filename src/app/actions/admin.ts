"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { revalidateStockViews } from "@/lib/revalidate-stock";
import { parseActualSalePrice } from "@/lib/sale-price";
import { redirect } from "next/navigation";
import { priceCart, nextOrderNumber, parseUnitPriceOverride, type CartLineInput } from "@/lib/order-pricing";
import { adjustStockForLine } from "@/lib/stock";
import { isBlankHtml } from "@/lib/richtext";
import { sendCustomerStatusUpdate } from "@/lib/order-notify";
import { fetchOrderPayments, capturedPayment, describePayments, checkConnection, type ConnectionCheck } from "@/lib/razorpay-api";
import { confirmPaidOrder } from "@/lib/confirm-paid-order";
import { canDeleteOrder } from "@/lib/order-cleanup";
import { hashPassword, verifyPassword, createAdminSession } from "@/lib/auth";
import { checkNewPassword } from "@/lib/password-rules";

// Costing fields (Landed Cost, Min/Max Round Up To) are optional numbers —
// usually set via Excel import, but editable by hand too. Blank means "not
// set" (null), not zero.
function optionalInt(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export type AdminFormState = { error?: string; success?: string } | undefined;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function requireAdmin() {
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authorized.");
  return adminId;
}

// ------------------------------------------------------------------- Products

export async function createProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const fabric = String(formData.get("fabric") || "").trim();
  const stylingTips = String(formData.get("stylingTips") || "").trim();
  const price = parseInt(String(formData.get("price") || ""), 10);
  const compareAtPriceRaw = String(formData.get("compareAtPrice") || "").trim();
  const landedCost = optionalInt(formData, "landedCost");
  const minRoundUpTo = optionalInt(formData, "minRoundUpTo");
  const maxRoundUpTo = optionalInt(formData, "maxRoundUpTo");
  const badge = String(formData.get("badge") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  const imageUrls = String(formData.get("images") || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const sizeLabels = formData.getAll("sizeLabel").map(String);
  const sizeStocks = formData.getAll("sizeStock").map(String);
  const sizes = sizeLabels
    .map((label, i) => ({ label: label.trim(), stock: Math.max(0, parseInt(sizeStocks[i] || "0", 10) || 0) }))
    .filter((s) => s.label);
  const colorPairs = String(formData.get("colors") || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!name || name.length < 3) return { error: "Please enter a product name." };
  if (!description || isBlankHtml(description)) return { error: "Please enter a description." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Please enter a valid price." };
  if (!categoryId) return { error: "Please choose a category." };
  if (imageUrls.length === 0) return { error: "Please add at least one photo." };
  if (sizes.length === 0) return { error: "Please add at least one size." };

  const totalStock = sizes.reduce((sum, s) => sum + s.stock, 0);

  const slugBase = slugify(name);
  let slug = slugBase;
  let n = 1;
  while (await db.query.products.findFirst({ where: eq(schema.products.slug, slug) })) {
    slug = `${slugBase}-${++n}`;
  }
  const sku = `URVI-${slugBase.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  const [product] = await db
    .insert(schema.products)
    .values({
      sku,
      slug,
      name,
      description,
      fabric: fabric || "See description",
      stylingTips: stylingTips || null,
      price,
      compareAtPrice: compareAtPriceRaw ? parseInt(compareAtPriceRaw, 10) : null,
      landedCost,
      minRoundUpTo,
      maxRoundUpTo,
      badge: badge || null,
      stock: totalStock,
      categoryId,
    })
    .returning();

  await db.insert(schema.productImages).values(imageUrls.map((url, i) => ({ productId: product.id, url, position: i })));
  await db.insert(schema.productSizes).values(sizes.map((s, i) => ({ productId: product.id, label: s.label, stock: s.stock, position: i })));

  if (colorPairs.length) {
    await db.insert(schema.productColors).values(
      colorPairs.map((pair, i) => {
        const [colorName, hex] = pair.split(":").map((s) => s.trim());
        return { productId: product.id, name: colorName || pair, hex: hex || "#999999", position: i };
      })
    );
  }

  revalidateStockViews();
  return { success: `"${name}" was added to the catalog.` };
}

export async function updateProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  const productId = String(formData.get("productId") || "");
  const price = parseInt(String(formData.get("price") || ""), 10);
  const landedCost = optionalInt(formData, "landedCost");
  const minRoundUpTo = optionalInt(formData, "minRoundUpTo");
  const maxRoundUpTo = optionalInt(formData, "maxRoundUpTo");
  const badge = String(formData.get("badge") || "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!productId) return { error: "Missing product." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Please enter a valid price." };

  // Stock is tracked per size now (see the Edit Product page) — this quick
  // row edit no longer touches it, so a stray save here can never overwrite
  // a real per-size count with a stale total.
  //
  // Compare-at price is left out for the same reason: the column was taken
  // off this screen, and writing a field the form no longer collects would
  // blank out every product's compare-at on the next Save. It stays editable
  // on the full Edit Product page.
  await db
    .update(schema.products)
    .set({
      price,
      landedCost,
      minRoundUpTo,
      maxRoundUpTo,
      badge: badge || null,
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(schema.products.id, productId));

  revalidateStockViews();
  return { success: "Product updated." };
}

// Full edit — every field, from the dedicated /admin/products/[id]/edit page.
// The slug/SKU are left untouched so existing links, cart lines and past
// orders that reference this product by id keep working.
export async function updateProductFullAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  const productId = String(formData.get("productId") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const fabric = String(formData.get("fabric") || "").trim();
  const stylingTips = String(formData.get("stylingTips") || "").trim();
  const price = parseInt(String(formData.get("price") || ""), 10);
  const compareAtPriceRaw = String(formData.get("compareAtPrice") || "").trim();
  const landedCost = optionalInt(formData, "landedCost");
  const minRoundUpTo = optionalInt(formData, "minRoundUpTo");
  const maxRoundUpTo = optionalInt(formData, "maxRoundUpTo");
  const badge = String(formData.get("badge") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  const isActive = formData.get("isActive") === "on";
  const imageUrls = String(formData.get("images") || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const sizeLabels = formData.getAll("sizeLabel").map(String);
  const sizeStocks = formData.getAll("sizeStock").map(String);
  const sizes = sizeLabels
    .map((label, i) => ({ label: label.trim(), stock: Math.max(0, parseInt(sizeStocks[i] || "0", 10) || 0) }))
    .filter((s) => s.label);
  const colorPairs = String(formData.get("colors") || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!productId) return { error: "Missing product." };
  if (!name || name.length < 3) return { error: "Please enter a product name." };
  if (!description || isBlankHtml(description)) return { error: "Please enter a description." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Please enter a valid price." };
  if (!categoryId) return { error: "Please choose a category." };
  if (imageUrls.length === 0) return { error: "Please add at least one photo." };
  if (sizes.length === 0) return { error: "Please add at least one size." };

  const totalStock = sizes.reduce((sum, s) => sum + s.stock, 0);

  // Perfect For / Best Weather / Style are deliberately left out of this
  // `.set()` — they're no longer collected on this form (the rich
  // Description box replaces them), so any existing values on older
  // products are left exactly as they are rather than getting silently
  // blanked out on every save.
  await db
    .update(schema.products)
    .set({
      name,
      description,
      fabric: fabric || "See description",
      stylingTips: stylingTips || null,
      price,
      compareAtPrice: compareAtPriceRaw ? parseInt(compareAtPriceRaw, 10) : null,
      landedCost,
      minRoundUpTo,
      maxRoundUpTo,
      badge: badge || null,
      stock: totalStock,
      categoryId,
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(schema.products.id, productId));

  await db.delete(schema.productImages).where(eq(schema.productImages.productId, productId));
  await db.insert(schema.productImages).values(imageUrls.map((url, i) => ({ productId, url, position: i })));

  await db.delete(schema.productSizes).where(eq(schema.productSizes.productId, productId));
  await db.insert(schema.productSizes).values(sizes.map((s, i) => ({ productId, label: s.label, stock: s.stock, position: i })));

  await db.delete(schema.productColors).where(eq(schema.productColors.productId, productId));
  if (colorPairs.length) {
    await db.insert(schema.productColors).values(
      colorPairs.map((pair, i) => {
        const [colorName, hex] = pair.split(":").map((s) => s.trim());
        return { productId, name: colorName || pair, hex: hex || "#999999", position: i };
      })
    );
  }

  const product = await db.query.products.findFirst({ where: eq(schema.products.id, productId) });
  revalidateStockViews();
  if (product) revalidatePath(`/product/${product.slug}`);
  return { success: `"${name}" was updated.` };
}

// order_items already stores a full snapshot of each line (product name,
// SKU, size, color, qty, price) independent of the live product row, so a
// product with order history can be deleted safely — order_items.product_id
// is ON DELETE SET NULL, so past orders keep displaying exactly as they did
// (via the snapshot), they just lose their now-pointless link to a product
// that no longer exists. Images/sizes/colors cascade automatically either way.
export async function deleteProductAction(productId: string): Promise<{ error?: string; success?: string }> {
  await requireAdmin();

  const product = await db.query.products.findFirst({ where: eq(schema.products.id, productId) });
  const orderedBefore = await db.query.orderItems.findFirst({ where: eq(schema.orderItems.productId, productId) });

  await db.delete(schema.products).where(eq(schema.products.id, productId));
  revalidateStockViews();

  return orderedBefore
    ? { success: `"${product?.name ?? "Product"}" was deleted. Its past orders still show up fine in Orders — just without a live product link.` }
    : {};
}

// --------------------------------------------------------------------- Orders

// Razorpay orders already have their stock deducted the moment payment
// verifies (see verify-payment), and manual orders deduct it at creation —
// so for both, `stockDeducted` is already true by the time an admin touches
// this dropdown, and the guards below are no-ops. The one path that still
// needs this: a WhatsApp/COD order (no online payment step at all) only
// ever gets its stock taken out of the catalog when an admin confirms it
// here for the first time. Marking a still-undeducted order cancelled skips
// stock entirely; cancelling or returning one that *was* deducted puts the
// stock back.
const STATUSES_THAT_IMPLY_SOLD = new Set(["CONFIRMED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]);
const STATUSES_THAT_RELEASE_STOCK = new Set(["CANCELLED", "RETURNED"]);

export async function updateOrderStatusAction(orderId: string, status: string) {
  await requireAdmin();

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId), with: { items: true } });
  if (!order) return;

  if (STATUSES_THAT_IMPLY_SOLD.has(status) && !order.stockDeducted) {
    for (const item of order.items) {
      if (item.productId) {
        await adjustStockForLine(item.productId, item.size, -item.qty);
      }
    }
    await db.update(schema.orders).set({ status, stockDeducted: true, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  } else if (STATUSES_THAT_RELEASE_STOCK.has(status) && order.stockDeducted) {
    for (const item of order.items) {
      if (item.productId) {
        await adjustStockForLine(item.productId, item.size, item.qty);
      }
    }
    await db.update(schema.orders).set({ status, stockDeducted: false, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  } else {
    await db.update(schema.orders).set({ status, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  }

  // Best-effort email to the customer about the new status — never lets a
  // failed/skipped send block the status change itself (sendMail swallows
  // its own errors; sendCustomerStatusUpdate no-ops for a status with no
  // customer-facing copy, e.g. an order with no email on file).
  if (order.status !== status) {
    await sendCustomerStatusUpdate(order, status);
  }

  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidateStockViews();
}

/**
 * Change the signed-in admin's own password.
 *
 * There was no way to do this at all, which mattered because the password the
 * account was seeded with had been committed to the repository. A credential
 * you cannot rotate is a credential you are stuck with.
 *
 * The current password is required: a session cookie proves the browser was
 * signed in once, not that the person at the keyboard is the owner. Stamping
 * passwordChangedAt is what ends every other session — see getAdminSession.
 */
export async function changeAdminPasswordAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const adminId = await requireAdmin();

  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  const confirm = String(formData.get("confirmPassword") || "");

  const admin = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, adminId) });
  if (!admin) return { error: "That admin account no longer exists." };

  const currentValid = await verifyPassword(current, admin.passwordHash);
  if (!currentValid) return { error: "Your current password isn't right." };

  const verdict = checkNewPassword(next, confirm, current);
  if (!verdict.ok) return { error: verdict.error };

  await db
    .update(schema.adminUsers)
    .set({ passwordHash: await hashPassword(next), passwordChangedAt: new Date() })
    .where(eq(schema.adminUsers.id, adminId));

  // The current browser's own cookie predates the change too, so it is
  // reissued — otherwise changing your password would sign you out of the
  // screen you changed it on.
  await createAdminSession(adminId);

  return { success: "Password changed. Any other device signed in as you has been signed out." };
}

export type DeleteOrdersResult = { deleted: number; refused: number; message: string };

/**
 * Delete orders that were never paid — the debris of testing, and the
 * abandoned checkouts that pile up behind them.
 *
 * Deliberately narrow. An order is only removed if it was never paid AND
 * never took stock; anything else is refused and counted, never quietly
 * skipped. A paid order is a sales record that the books, the GST return and
 * the customer all depend on, so no amount of selecting in the UI can delete
 * one here — the guard is on this side, where it cannot be clicked past.
 *
 * Order items go with it: the foreign key cascades, so the lines never
 * outlive the order they belong to.
 */
export async function deleteUnpaidOrdersAction(orderIds: string[]): Promise<DeleteOrdersResult> {
  await requireAdmin();

  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  if (ids.length === 0) return { deleted: 0, refused: 0, message: "Nothing was selected." };

  let deleted = 0;
  let refused = 0;

  for (const id of ids) {
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
    if (!order) continue;

    // The rule lives in src/lib/order-cleanup.ts so it can be read and tested
    // on its own — it is the one thing standing between this and deleting a
    // sales record.
    if (!canDeleteOrder(order)) {
      refused++;
      continue;
    }

    await db.delete(schema.orders).where(eq(schema.orders.id, id));
    deleted++;
  }

  revalidatePath("/admin/orders");

  const parts: string[] = [];
  if (deleted) parts.push(`${deleted} order${deleted === 1 ? "" : "s"} deleted.`);
  if (refused) {
    parts.push(
      `${refused} left alone because ${refused === 1 ? "it has" : "they have"} been paid or already took stock — those are sales records and are not deleted from here.`
    );
  }
  if (!parts.length) parts.push("Nothing to delete.");

  return { deleted, refused, message: parts.join(" ") };
}

export type { ConnectionCheck };

/** Admin-only: is Razorpay reachable with the keys this site is running on? */
export async function checkRazorpayAction(): Promise<ConnectionCheck> {
  await requireAdmin();
  return checkConnection();
}

export type ReconcileResult = { ok: boolean; message: string; confirmed?: boolean };

/**
 * Ask Razorpay what actually happened to this order's payment, and act on the
 * answer.
 *
 * Both of the paths that normally confirm an order are push: the browser
 * calls verify-payment, Razorpay calls the webhook. Either can fail to
 * arrive — a webhook registered in test mode never fires for a live payment,
 * and a UPI QR paid in another app can leave the browser watching a window
 * that never updates. When that happens the order sits PENDING while the
 * customer's money is gone, and the only way to find out has been to compare
 * two dashboards by hand.
 *
 * This pulls instead. If Razorpay says the money was captured, the order is
 * confirmed here and now through the same idempotent path the webhook uses —
 * so stock moves once, emails go out once, and running this twice is safe.
 */
export async function reconcileWithRazorpayAction(orderId: string): Promise<ReconcileResult> {
  await requireAdmin();

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) return { ok: false, message: "That order no longer exists." };

  if (!order.razorpayOrderId) {
    return {
      ok: false,
      message:
        "This order was never sent to Razorpay — it was placed through the WhatsApp handoff, or before payment was configured. There is nothing to check.",
    };
  }

  const lookup = await fetchOrderPayments(order.razorpayOrderId);

  if (!lookup.ok) {
    if (lookup.reason === "not-configured") {
      return { ok: false, message: "No Razorpay keys are set on the site, so we cannot ask." };
    }
    if (lookup.reason === "unauthorized") {
      // The single most useful thing this whole feature can tell you.
      return {
        ok: false,
        message:
          "Razorpay refused the keys. The keys on the site are not the ones that created this order — usually test keys against a live order, or a second account's keys.",
      };
    }
    if (lookup.reason === "not-found") {
      return {
        ok: false,
        message: `Razorpay has no record of order ${order.razorpayOrderId}. That normally means the site's keys belong to a different Razorpay account than the one this order was created in.`,
      };
    }
    return { ok: false, message: lookup.detail || "Could not reach Razorpay. Try again in a moment." };
  }

  const summary = describePayments(lookup.payments);
  const captured = capturedPayment(lookup.payments);

  if (!captured) return { ok: true, message: summary };

  // Money is with Razorpay. Whatever the order currently says, make it true.
  const result = await confirmPaidOrder({
    orderNumber: order.orderNumber,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: captured.id,
  });

  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidateStockViews();

  if (!result.ok) {
    return { ok: false, message: `${summary} We could not mark the order paid: ${result.reason}.` };
  }

  return {
    ok: true,
    confirmed: result.state === "confirmed",
    message:
      result.state === "confirmed"
        ? `${summary} The order is now marked PAID, stock has been taken, and the confirmation emails have gone out.`
        : `${summary} The order was already marked paid, so nothing needed changing.`,
  };
}

/**
 * Record what an order actually sold for.
 *
 * Validated here rather than only in the browser: the form's own checks are a
 * courtesy, and anything that reaches a server action can arrive without them.
 * The rules are in src/lib/sale-price.ts so they are the same on both sides.
 */
export async function setActualSalePriceAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") || "");
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) return { error: "That order no longer exists." };

  const result = parseActualSalePrice(formData.get("actualSalePrice") as string | null, order.total);
  if (!result.ok) return { error: result.error };

  await db
    .update(schema.orders)
    .set({ actualSalePricePaise: result.paise, updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId));

  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidatePath("/admin/orders");
  return { success: "Actual Sale Price saved." };
}

// A sale that happened over WhatsApp, a phone call, or in person — logged
// by hand so it shows up in orders/revenue/stock exactly like a website
// checkout would. Stock is reserved immediately (the goods are already
// spoken for), same as a confirmed online payment.
export async function createManualOrderAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  const source = String(formData.get("source") || "whatsapp");
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").trim();
  const customerEmail = String(formData.get("customerEmail") || "").trim();
  const addressLine1 = String(formData.get("addressLine1") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const state = String(formData.get("state") || "").trim();
  const pincode = String(formData.get("pincode") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const paymentStatus = String(formData.get("paymentStatus") || "PENDING") === "PAID" ? "PAID" : "PENDING";
  // A walk-in is handed over on the spot; anything else defaults to being
  // delivered unless told otherwise.
  const fulfilmentMethod =
    String(formData.get("fulfilmentMethod") || (source === "walk_in" ? "pickup" : "delivery")) === "pickup"
      ? "pickup"
      : "delivery";
  const paymentModeRaw = String(formData.get("paymentMode") || "").trim();
  const paymentMode = ["cash", "upi", "card"].includes(paymentModeRaw) ? paymentModeRaw : null;

  if (!customerName) return { error: "Please enter the customer's name." };
  if (!customerPhone) return { error: "Please enter the customer's phone number." };
  if (pincode && !/^\d{6}$/.test(pincode)) return { error: "Pincode should be 6 digits — or just leave it blank for now." };
  if (paymentStatus === "PAID" && !paymentMode) {
    return { error: "Please record how it was paid — cash, UPI or card." };
  }

  const productIds = formData.getAll("lineProductId").map(String);
  const sizes = formData.getAll("lineSize").map(String);
  const colors = formData.getAll("lineColor").map(String);
  const qtys = formData.getAll("lineQty").map(String);
  // What was actually charged per piece. The form pre-fills the catalogue
  // price, so this is only different when the admin changed it — a discount
  // agreed at the door, a bundle, a round-number cash sale.
  const linePrices = formData.getAll("linePrice").map(String);

  const items: CartLineInput[] = [];
  for (let i = 0; i < productIds.length; i++) {
    if (!productIds[i]) continue;

    const priced = parseUnitPriceOverride(linePrices[i]);
    if (!priced.ok) return { error: priced.error };

    items.push({
      productId: productIds[i],
      size: sizes[i] || "",
      color: colors[i] || "",
      qty: Math.max(1, parseInt(qtys[i] || "1", 10) || 1),
      unitPriceOverride: priced.price,
    });
  }
  if (items.length === 0) return { error: "Add at least one item to the order." };

  // requireAdmin() ran at the top of this action, so the person setting these
  // prices is a signed-in admin recording what they actually sold for.
  const pricing = await priceCart(items, null, { allowPriceOverride: true });
  if (!pricing.ok) return { error: pricing.error };

  const orderNumber = await nextOrderNumber();

  const [order] = await db
    .insert(schema.orders)
    .values({
      orderNumber,
      // A walk-in already left with the goods, so it goes straight to
      // collected rather than sitting in "confirmed" waiting to be packed.
      status: fulfilmentMethod === "pickup" && source === "walk_in" ? "DELIVERED" : "CONFIRMED",
      paymentStatus,
      paymentMethod: "manual",
      paymentMode,
      source,
      fulfilmentMethod,
      stockDeducted: true,
      subtotal: pricing.subtotal,
      shipping: pricing.shipping,
      discount: pricing.discount,
      total: pricing.total,
      couponCode: pricing.couponCode,
      customerName,
      customerEmail: customerEmail || "",
      customerPhone,
      addressLine1: addressLine1 || "",
      city: city || "",
      state: state || "",
      pincode: pincode || "",
      notes: notes || null,
    })
    .returning();

  await db.insert(schema.orderItems).values(
    pricing.lines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      productName: l.productName,
      sku: l.sku,
      size: l.size,
      color: l.color,
      qty: l.qty,
      landedCostAtSale: l.landedCost,
      price: l.price,
    }))
  );

  for (const line of pricing.lines) {
    await adjustStockForLine(line.productId, line.size, -line.qty);
  }

  revalidateStockViews();
  redirect(`/admin/orders/${orderNumber}`);
}

// ------------------------------------------------------------------- Coupons

export async function createCouponAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  const code = String(formData.get("code") || "").trim().toUpperCase();
  const type = String(formData.get("type") || "PERCENT");
  const value = parseInt(String(formData.get("value") || ""), 10);
  const minOrderValue = parseInt(String(formData.get("minOrderValue") || "0"), 10) || 0;

  if (!code || code.length < 3) return { error: "Please enter a coupon code." };
  if (!Number.isFinite(value) || value <= 0) return { error: "Please enter a valid value." };

  const existing = await db.query.coupons.findFirst({ where: eq(schema.coupons.code, code) });
  if (existing) return { error: "A coupon with this code already exists." };

  await db.insert(schema.coupons).values({ code, type, value, minOrderValue });
  revalidatePath("/admin/coupons");
  return { success: `Coupon ${code} created.` };
}

export async function toggleCouponActiveAction(couponId: string, active: boolean) {
  await requireAdmin();
  await db.update(schema.coupons).set({ active }).where(eq(schema.coupons.id, couponId));
  revalidatePath("/admin/coupons");
}

// ------------------------------------------------------------------- Messages

export async function markMessageReadAction(messageId: string, status: "NEW" | "READ") {
  await requireAdmin();
  await db.update(schema.contactMessages).set({ status }).where(eq(schema.contactMessages.id, messageId));
  revalidatePath("/admin/messages");
}
