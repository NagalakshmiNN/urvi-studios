import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { mapSfxStatus } from "@/lib/shadowfax";

/**
 * Shadowfax status-push webhook.
 *
 * Shadowfax POSTs a JSON payload every time a shipment's status changes.
 * We update the order's courier_status column and, when the new status
 * maps to a different order status (e.g. "delivered" → DELIVERED), we
 * auto-advance the order too.
 *
 * The webhook URL configured in SFX 360 should be:
 *   https://urvi-studios.netlify.app/api/webhooks/shadowfax
 *
 * If an authorisation header was set in the SFX 360 webhook config,
 * set the same value as SHADOWFAX_WEBHOOK_SECRET in env vars.
 */
export async function POST(request: NextRequest) {
  // Optional: verify the webhook secret if configured
  const secret = process.env.SHADOWFAX_WEBHOOK_SECRET;
  if (secret) {
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("x-webhook-secret") ||
      "";
    if (authHeader !== secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Shadowfax sends different payload shapes — normalise.
  // Common fields: order_id / client_order_id, status, awb_number
  const sfxOrderId = String(body.order_id || body.sfx_order_id || "");
  const clientOrderId = String(body.client_order_id || "");
  const status = String(body.status || body.current_status || "");
  const awbNumber = body.awb_number ? String(body.awb_number) : undefined;

  if (!status) {
    return NextResponse.json({ error: "No status in payload" }, { status: 400 });
  }

  // Find the order — try Shadowfax order ID first, then our order number
  let order = sfxOrderId
    ? await db.query.orders.findFirst({
        where: eq(schema.orders.shadowfaxOrderId, sfxOrderId),
      })
    : null;

  if (!order && clientOrderId) {
    order = await db.query.orders.findFirst({
      where: eq(schema.orders.orderNumber, clientOrderId),
    });
  }

  if (!order) {
    // Not an error on our side — just a shipment we don't know about.
    return NextResponse.json({ ok: true, matched: false });
  }

  // Map the Shadowfax status to our order status
  const info = mapSfxStatus(status);

  const updates: Record<string, unknown> = {
    courierStatus: status,
    updatedAt: new Date(),
  };

  if (awbNumber && !order.awbNumber) {
    updates.awbNumber = awbNumber;
  }

  // Auto-advance the order status if the mapping says to
  if (info.orderStatus && info.orderStatus !== order.status) {
    updates.status = info.orderStatus;
  }

  await db
    .update(schema.orders)
    .set(updates)
    .where(eq(schema.orders.id, order.id));

  return NextResponse.json({ ok: true, matched: true, newStatus: status });
}

// Shadowfax may send a GET to verify the endpoint is alive
export async function GET() {
  return NextResponse.json({ status: "ok", service: "shadowfax-webhook" });
}
