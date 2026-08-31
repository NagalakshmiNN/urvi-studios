import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { toCsv, csvResponseHeaders, dateStamp } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const items = await db.query.wishlistItems.findMany({
    with: { customer: true, product: true },
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  });

  const headers = ["Customer Name", "Customer Email", "Product Name", "Product SKU", "Price (₹)", "Added On"];
  const rows = items.map((w) => [
    w.customer.name,
    w.customer.email,
    w.product.name,
    w.product.sku,
    w.product.price,
    w.createdAt.toISOString(),
  ]);

  return new NextResponse(toCsv(headers, rows), {
    headers: csvResponseHeaders(`Urvi_Studios_Wishlist_${dateStamp()}.csv`),
  });
}
