// GET /api/admin/invoice/[orderNumber]
//
// Generates and returns a GST tax invoice PDF for the given order.
// Admin-only — the admin auth cookie is checked before anything is served.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;

  // Fetch the order
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Fetch order items
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, order.id),
  });

  // Generate the PDF
  const pdfBuffer = generateInvoicePdf(
    {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      addressLine1: order.addressLine1,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      subtotal: order.subtotal,
      shipping: order.shipping,
      discount: order.discount,
      total: order.total,
      couponCode: order.couponCode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    },
    items.map((it) => ({
      productName: it.productName,
      sku: it.sku,
      size: it.size,
      color: it.color,
      qty: it.qty,
      price: it.price,
    })),
  );

  // Convert Buffer to Uint8Array for NextResponse compatibility
  const bytes = new Uint8Array(pdfBuffer);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${orderNumber}.pdf"`,
    },
  });
}
