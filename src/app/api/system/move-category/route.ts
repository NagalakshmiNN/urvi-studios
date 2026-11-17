// Temporary endpoint: move specific products to a different category.
// Protected by bootstrap token. DELETE THIS FILE after use.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

const BOOTSTRAP_TOKEN = "urvi-seed-2026-x7q9";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token || token !== BOOTSTRAP_TOKEN) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { productIds, targetCategorySlug } = body as {
      productIds: string[];
      targetCategorySlug: string;
    };

    if (!productIds?.length || !targetCategorySlug) {
      return NextResponse.json(
        { ok: false, error: "Need productIds[] and targetCategorySlug." },
        { status: 400 },
      );
    }

    // Find target category
    const [targetCat] = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, targetCategorySlug))
      .limit(1);

    if (!targetCat) {
      return NextResponse.json(
        { ok: false, error: `Category "${targetCategorySlug}" not found.` },
        { status: 404 },
      );
    }

    // Get current state of products before update
    const before = await db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        sku: schema.products.sku,
        categoryId: schema.products.categoryId,
      })
      .from(schema.products)
      .where(inArray(schema.products.id, productIds));

    // Update
    const result = await db
      .update(schema.products)
      .set({ categoryId: targetCat.id, updatedAt: new Date() })
      .where(inArray(schema.products.id, productIds));

    // Get after state
    const after = await db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        sku: schema.products.sku,
        categoryId: schema.products.categoryId,
      })
      .from(schema.products)
      .where(inArray(schema.products.id, productIds));

    return NextResponse.json({
      ok: true,
      targetCategory: { id: targetCat.id, slug: targetCat.slug, name: targetCat.name },
      moved: after.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
      count: after.length,
    });
  } catch (err) {
    console.error("move-category error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) },
      { status: 500 },
    );
  }
}
