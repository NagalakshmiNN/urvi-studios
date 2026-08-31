"use server";

import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { priceCart, nextOrderNumber, type CartLineInput } from "@/lib/order-pricing";

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
  const price = parseInt(String(formData.get("price") || ""), 10);
  const compareAtPriceRaw = String(formData.get("compareAtPrice") || "").trim();
  const badge = String(formData.get("badge") || "").trim();
  const stock = parseInt(String(formData.get("stock") || "0"), 10);
  const categoryId = String(formData.get("categoryId") || "");
  const imageUrls = String(formData.get("images") || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const sizeLabels = String(formData.get("sizes") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const colorPairs = String(formData.get("colors") || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!name || name.length < 3) return { error: "Please enter a product name." };
  if (!description) return { error: "Please enter a description." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Please enter a valid price." };
  if (!categoryId) return { error: "Please choose a category." };
  if (imageUrls.length === 0) return { error: "Please add at least one image URL." };
  if (sizeLabels.length === 0) return { error: "Please add at least one size." };

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
      price,
      compareAtPrice: compareAtPriceRaw ? parseInt(compareAtPriceRaw, 10) : null,
      badge: badge || null,
      stock: Number.isFinite(stock) ? stock : 0,
      categoryId,
    })
    .returning();

  await db.insert(schema.productImages).values(imageUrls.map((url, i) => ({ productId: product.id, url, position: i })));
  await db.insert(schema.productSizes).values(sizeLabels.map((label, i) => ({ productId: product.id, label, position: i })));

  if (colorPairs.length) {
    await db.insert(schema.productColors).values(
      colorPairs.map((pair, i) => {
        const [colorName, hex] = pair.split(":").map((s) => s.trim());
        return { productId: product.id, name: colorName || pair, hex: hex || "#999999", position: i };
      })
    );
  }

  revalidatePath("/admin/products");
  return { success: `"${name}" was added to the catalog.` };
}

export async function updateProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  const productId = String(formData.get("productId") || "");
  const price = parseInt(String(formData.get("price") || ""), 10);
  const stock = parseInt(String(formData.get("stock") || ""), 10);
  const compareAtPriceRaw = String(formData.get("compareAtPrice") || "").trim();
  const badge = String(formData.get("badge") || "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!productId) return { error: "Missing product." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Please enter a valid price." };
  if (!Number.isFinite(stock) || stock < 0) return { error: "Please enter a valid stock count." };

  await db
    .update(schema.products)
    .set({
      price,
      stock,
      compareAtPrice: compareAtPriceRaw ? parseInt(compareAtPriceRaw, 10) : null,
      badge: badge || null,
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(schema.products.id, productId));

  revalidatePath("/admin/products");
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
  const price = parseInt(String(formData.get("price") || ""), 10);
  const compareAtPriceRaw = String(formData.get("compareAtPrice") || "").trim();
  const badge = String(formData.get("badge") || "").trim();
  const stock = parseInt(String(formData.get("stock") || "0"), 10);
  const categoryId = String(formData.get("categoryId") || "");
  const isActive = formData.get("isActive") === "on";
  const imageUrls = String(formData.get("images") || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const sizeLabels = String(formData.get("sizes") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const colorPairs = String(formData.get("colors") || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!productId) return { error: "Missing product." };
  if (!name || name.length < 3) return { error: "Please enter a product name." };
  if (!description) return { error: "Please enter a description." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Please enter a valid price." };
  if (!Number.isFinite(stock) || stock < 0) return { error: "Please enter a valid stock count." };
  if (!categoryId) return { error: "Please choose a category." };
  if (imageUrls.length === 0) return { error: "Please add at least one image URL." };
  if (sizeLabels.length === 0) return { error: "Please add at least one size." };

  await db
    .update(schema.products)
    .set({
      name,
      description,
      fabric: fabric || "See description",
      price,
      compareAtPrice: compareAtPriceRaw ? parseInt(compareAtPriceRaw, 10) : null,
      badge: badge || null,
      stock: Number.isFinite(stock) ? stock : 0,
      categoryId,
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(schema.products.id, productId));

  await db.delete(schema.productImages).where(eq(schema.productImages.productId, productId));
  await db.insert(schema.productImages).values(imageUrls.map((url, i) => ({ productId, url, position: i })));

  await db.delete(schema.productSizes).where(eq(schema.productSizes.productId, productId));
  await db.insert(schema.productSizes).values(sizeLabels.map((label, i) => ({ productId, label, position: i })));

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
  revalidatePath("/admin/products");
  if (product) revalidatePath(`/product/${product.slug}`);
  return { success: `"${name}" was updated.` };
}

// Products already ordered can't be removed outright — order history keeps a
// row-level reference to them (order_items.product_id), so a hard delete
// would fail the database's foreign key check anyway. Untouched products
// (never ordered) delete cleanly, images/sizes/colors cascade automatically.
export async function deleteProductAction(productId: string): Promise<{ error?: string }> {
  await requireAdmin();

  const orderedBefore = await db.query.orderItems.findFirst({ where: eq(schema.orderItems.productId, productId) });
  if (orderedBefore) {
    return { error: "This product has order history, so it can't be deleted — turn off “Active” instead to hide it from the shop." };
  }

  await db.delete(schema.products).where(eq(schema.products.id, productId));
  revalidatePath("/admin/products");
  return {};
}

// --------------------------------------------------------------------- Orders

export async function updateOrderStatusAction(orderId: string, status: string) {
  await requireAdmin();
  await db.update(schema.orders).set({ status, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  revalidatePath("/admin/orders");
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

  if (!customerName) return { error: "Please enter the customer's name." };
  if (!customerPhone) return { error: "Please enter the customer's phone number." };
  if (pincode && !/^\d{6}$/.test(pincode)) return { error: "Pincode should be 6 digits — or just leave it blank for now." };

  const productIds = formData.getAll("lineProductId").map(String);
  const sizes = formData.getAll("lineSize").map(String);
  const colors = formData.getAll("lineColor").map(String);
  const qtys = formData.getAll("lineQty").map(String);

  const items: CartLineInput[] = [];
  for (let i = 0; i < productIds.length; i++) {
    if (!productIds[i]) continue;
    items.push({
      productId: productIds[i],
      size: sizes[i] || "",
      color: colors[i] || "",
      qty: Math.max(1, parseInt(qtys[i] || "1", 10) || 1),
    });
  }
  if (items.length === 0) return { error: "Add at least one item to the order." };

  const pricing = await priceCart(items);
  if (!pricing.ok) return { error: pricing.error };

  const orderNumber = await nextOrderNumber();

  const [order] = await db
    .insert(schema.orders)
    .values({
      orderNumber,
      status: "CONFIRMED",
      paymentStatus,
      paymentMethod: "manual",
      source,
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
      size: l.size,
      color: l.color,
      qty: l.qty,
      price: l.price,
    }))
  );

  for (const line of pricing.lines) {
    await db
      .update(schema.products)
      .set({ stock: sql`greatest(0, ${schema.products.stock} - ${line.qty})` })
      .where(eq(schema.products.id, line.productId));
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
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
