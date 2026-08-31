import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { toCsv, csvResponseHeaders, dateStamp } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const reviews = await db.query.reviews.findMany({
    with: { product: true },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  const headers = ["Product Name", "Reviewer Name", "Rating", "Title", "Review", "Verified Purchase", "Status", "Posted On"];
  const rows = reviews.map((r) => [
    r.product.name,
    r.customerName,
    r.rating,
    r.title ?? "",
    r.body,
    r.verifiedPurchase,
    r.status,
    r.createdAt.toISOString(),
  ]);

  return new NextResponse(toCsv(headers, rows), {
    headers: csvResponseHeaders(`Urvi_Studios_Reviews_${dateStamp()}.csv`),
  });
}
