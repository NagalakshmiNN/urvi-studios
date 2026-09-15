import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { toCsv, csvResponseHeaders, dateStamp } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One row per order (with its line items summarized into one cell) —
// includes the delivery address and contact details captured at checkout,
// which is the primary place customer address data lives, including for
// guest checkouts that never created an account.
export async function GET() {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const orders = await db.query.orders.findMany({
    with: { items: true },
    orderBy: (o, { desc }) => [desc(o.createdAt)],
  });

  const headers = [
    "Order Number", "Date", "Status", "Payment Status", "Payment Method", "Source",
    "Customer Name", "Email", "Phone", "Address Line 1", "City", "State", "Pincode",
    "Items", "Subtotal (₹)", "Delivery (₹)", "Discount (₹)", "Coupon Code", "Total (₹)",
    "Actual Sale Price (₹)", "Difference vs Total (₹)", "Notes",
  ];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.createdAt.toISOString(),
    o.status,
    o.paymentStatus,
    o.paymentMethod,
    o.source,
    o.customerName,
    o.customerEmail,
    o.customerPhone,
    o.addressLine1,
    o.city,
    o.state,
    o.pincode,
    o.items.map((it) => `${it.productName} (Size ${it.size}, ${it.color}) x${it.qty} @ ₹${it.price}`).join("; "),
    o.subtotal,
    o.shipping,
    o.discount,
    o.couponCode ?? "",
    o.total,
    // Left EMPTY, not zero, when no figure has been recorded. A zero would
    // sum into a month's takings as a real sale of nothing, which is worse
    // than an obvious gap. Written as a plain number with no symbol so the
    // spreadsheet treats the column as money rather than text.
    o.actualSalePricePaise != null ? (o.actualSalePricePaise / 100).toFixed(2) : "",
    o.actualSalePricePaise != null ? (o.actualSalePricePaise / 100 - o.total).toFixed(2) : "",
    o.notes ?? "",
  ]);

  return new NextResponse(toCsv(headers, rows), {
    headers: csvResponseHeaders(`Urvi_Studios_Orders_${dateStamp()}.csv`),
  });
}
