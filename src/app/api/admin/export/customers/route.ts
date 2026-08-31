import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { toCsv, csvResponseHeaders, dateStamp } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Registered customer accounts — name, email (their login), phone, join
// date, plus a couple of at-a-glance counts. Password hashes are
// deliberately never included: a hash isn't usable outside the app, and
// there's no legitimate reason for it to leave the database at all.
export async function GET() {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const customers = await db.query.customers.findMany({
    with: { addresses: true, orders: true, wishlist: true },
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });

  const headers = ["Customer ID", "Name", "Email (Login)", "Phone", "Saved Addresses", "Orders Placed", "Wishlist Items", "Account Created"];
  const rows = customers.map((c) => [
    c.id,
    c.name,
    c.email,
    c.phone ?? "",
    c.addresses.length,
    c.orders.length,
    c.wishlist.length,
    c.createdAt.toISOString(),
  ]);

  return new NextResponse(toCsv(headers, rows), {
    headers: csvResponseHeaders(`Urvi_Studios_Customer_Accounts_${dateStamp()}.csv`),
  });
}
