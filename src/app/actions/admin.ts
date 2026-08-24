"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

// --------------------------------------------------------------------- Orders

export async function updateOrderStatusAction(orderId: string, status: string) {
  await requireAdmin();
  await db.update(schema.orders).set({ status, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
  revalidatePath("/admin/orders");
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
