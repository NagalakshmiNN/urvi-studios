import { NextRequest, NextResponse } from "next/server";
import { eq, ilike } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { sanitizeDescription } from "@/lib/sanitize-description";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/bulk-update-descriptions
 *
 * Accepts a JSON body with an array of product updates:
 * { products: [{ name: string, description: string }] }
 *
 * Matches products by name (case-insensitive) and replaces their description.
 * Returns a report of what was updated and what was skipped.
 */
export async function POST(req: NextRequest) {
  const adminId = await getAdminSession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const items: { name: string; description: string }[] = body.products;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Expected { products: [...] }" }, { status: 400 });
  }

  const results: { name: string; status: string; id?: string }[] = [];

  for (const item of items) {
    if (!item.name || !item.description) {
      results.push({ name: item.name || "(empty)", status: "skipped — missing name or description" });
      continue;
    }

    // Find the product by name (case-insensitive exact match)
    const found = await db.query.products.findFirst({
      where: ilike(schema.products.name, item.name),
    });

    if (!found) {
      results.push({ name: item.name, status: "not found" });
      continue;
    }

    const cleanDesc = sanitizeDescription(item.description);

    await db
      .update(schema.products)
      .set({
        description: cleanDesc,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, found.id));

    results.push({ name: item.name, status: "updated", id: found.id });
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const skipped = results.filter((r) => r.status !== "updated").length;

  return NextResponse.json({
    summary: `${updated} updated, ${skipped} skipped/not found`,
    results,
  });
}
