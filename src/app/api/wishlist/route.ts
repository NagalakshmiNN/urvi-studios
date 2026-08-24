import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { getCustomerSession } from "@/lib/auth";

export async function POST(request: Request) {
  const customerId = await getCustomerSession();
  if (!customerId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { productId } = await request.json();
  if (!productId) return NextResponse.json({ error: "Missing productId." }, { status: 400 });

  const product = await db.query.products.findFirst({ where: eq(schema.products.id, productId) });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const existing = await db.query.wishlistItems.findFirst({
    where: and(eq(schema.wishlistItems.customerId, customerId), eq(schema.wishlistItems.productId, productId)),
  });
  if (!existing) {
    await db.insert(schema.wishlistItems).values({ customerId, productId });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const customerId = await getCustomerSession();
  if (!customerId) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { productId } = await request.json();
  if (!productId) return NextResponse.json({ error: "Missing productId." }, { status: 400 });

  await db
    .delete(schema.wishlistItems)
    .where(and(eq(schema.wishlistItems.customerId, customerId), eq(schema.wishlistItems.productId, productId)));
  return NextResponse.json({ ok: true });
}
