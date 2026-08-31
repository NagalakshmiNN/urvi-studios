import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { toCsv, csvResponseHeaders, dateStamp } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Saved addresses on customer accounts (the "Address Book" under My
// Account). Order delivery addresses are a separate, larger set — see the
// Orders export — since most orders come from guest checkout and never
// touch this table at all.
export async function GET() {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const addresses = await db.query.addresses.findMany({
    with: { customer: true },
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });

  const headers = ["Customer Name", "Customer Email", "Label", "Address Line 1", "City", "State", "Pincode", "Phone", "Default Address", "Saved On"];
  const rows = addresses.map((a) => [
    a.customer.name,
    a.customer.email,
    a.label,
    a.line1,
    a.city,
    a.state,
    a.pincode,
    a.phone,
    a.isDefault,
    a.createdAt.toISOString(),
  ]);

  return new NextResponse(toCsv(headers, rows), {
    headers: csvResponseHeaders(`Urvi_Studios_Saved_Addresses_${dateStamp()}.csv`),
  });
}
