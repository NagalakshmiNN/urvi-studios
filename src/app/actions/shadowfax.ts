"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  createShipment,
  trackShipment,
  cancelShipment,
  mapSfxStatus,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type TrackingResult,
} from "@/lib/shadowfax";

// Reuse the admin auth guard from the main admin actions.
async function requireAdmin() {
  const { getAdminSession } = await import("@/lib/auth");
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authenticated");
  return adminId;
}

// ------------------------------------------------- Create shipment action

export async function createShipmentAction(
  orderId: string,
  pickupWarehouseId?: string,
  returnWarehouseId?: string,
): Promise<CreateShipmentResult & { configured: boolean }> {
  await requireAdmin();

  // Check that Shadowfax is configured
  if (!process.env.SHADOWFAX_API_TOKEN) {
    return {
      success: false,
      configured: false,
      error: "Shadowfax API token is not configured. Add SHADOWFAX_API_TOKEN to your environment variables.",
    };
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
    with: { items: true },
  });

  if (!order) {
    return { success: false, configured: true, error: "Order not found" };
  }

  if (order.shadowfaxOrderId) {
    return {
      success: false,
      configured: true,
      error: `Shipment already created (AWB: ${order.awbNumber || "pending"})`,
    };
  }

  // Determine payment mode
  const isPrepaid =
    order.paymentMethod === "razorpay" && order.paymentStatus === "PAID";
  const paymentMode: "prepaid" | "cod" = isPrepaid ? "prepaid" : "cod";

  // Look up the selected warehouses (if any)
  const pickupWarehouse = pickupWarehouseId
    ? await db.query.warehouses.findFirst({ where: eq(schema.warehouses.id, pickupWarehouseId) })
    : await db.query.warehouses.findFirst({ where: eq(schema.warehouses.isDefault, true) });

  const returnWarehouse = returnWarehouseId
    ? await db.query.warehouses.findFirst({ where: eq(schema.warehouses.id, returnWarehouseId) })
    : undefined; // defaults to pickup in the API client

  const input: CreateShipmentInput = {
    clientOrderId: order.orderNumber,
    productValue: order.total,
    paymentMode,
    codAmount: paymentMode === "cod" ? order.total : undefined,
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      addressLine1: order.addressLine1,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    },
    items: order.items.map((item) => ({
      name: item.productName,
      sku: item.sku || "GENERIC",
      price: item.price,
      qty: item.qty,
    })),
    ...(pickupWarehouse
      ? {
          pickupAddress: {
            contactName: pickupWarehouse.contactName,
            contactPhone: pickupWarehouse.contactPhone,
            addressLine1: pickupWarehouse.addressLine1,
            addressLine2: pickupWarehouse.addressLine2 || "",
            city: pickupWarehouse.city,
            state: pickupWarehouse.state,
            pincode: pickupWarehouse.pincode,
          },
        }
      : {}),
    ...(returnWarehouse
      ? {
          returnAddress: {
            contactName: returnWarehouse.contactName,
            contactPhone: returnWarehouse.contactPhone,
            addressLine1: returnWarehouse.addressLine1,
            addressLine2: returnWarehouse.addressLine2 || "",
            city: returnWarehouse.city,
            state: returnWarehouse.state,
            pincode: returnWarehouse.pincode,
          },
        }
      : {}),
  };

  const result = await createShipment(input);

  if (result.success) {
    // Save AWB and Shadowfax order ID to the order
    await db
      .update(schema.orders)
      .set({
        awbNumber: result.awbNumber || null,
        shadowfaxOrderId: result.shadowfaxOrderId || null,
        courierStatus: "new",
        // Auto-advance to CONFIRMED if still PLACED
        ...(order.status === "PLACED" ? { status: "CONFIRMED" } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId));

    revalidatePath(`/admin/orders/${order.orderNumber}`);
  }

  return { ...result, configured: true };
}

// ---------------------------------------------------- Track shipment action

export async function fetchTrackingAction(
  orderId: string
): Promise<TrackingResult & { configured: boolean }> {
  await requireAdmin();

  if (!process.env.SHADOWFAX_API_TOKEN) {
    return {
      success: false,
      configured: false,
      error: "Shadowfax API token is not configured.",
    };
  }

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
  });

  if (!order?.shadowfaxOrderId) {
    return {
      success: false,
      configured: true,
      error: "No Shadowfax shipment exists for this order.",
    };
  }

  const result = await trackShipment(order.shadowfaxOrderId);

  if (result.success && result.currentStatus) {
    // Update the courier status (and optionally the order status)
    const info = mapSfxStatus(result.currentStatus);
    const updates: Record<string, unknown> = {
      courierStatus: result.currentStatus,
      updatedAt: new Date(),
    };
    if (result.awbNumber && !order.awbNumber) {
      updates.awbNumber = result.awbNumber;
    }
    if (info.orderStatus && info.orderStatus !== order.status) {
      updates.status = info.orderStatus;
    }
    await db
      .update(schema.orders)
      .set(updates)
      .where(eq(schema.orders.id, orderId));

    revalidatePath(`/admin/orders/${order.orderNumber}`);
  }

  return { ...result, configured: true };
}

// -------------------------------------------------- Cancel shipment action

export async function cancelShipmentAction(
  orderId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
  });

  if (!order?.shadowfaxOrderId) {
    return { success: false, error: "No Shadowfax shipment to cancel." };
  }

  const result = await cancelShipment(order.shadowfaxOrderId, reason);

  if (result.success) {
    await db
      .update(schema.orders)
      .set({ courierStatus: "cancelled", updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId));
    revalidatePath(`/admin/orders/${order.orderNumber}`);
  }

  return result;
}


// ------------------------------------------------ Warehouse actions

export async function listWarehousesAction() {
  await requireAdmin();
  return db.query.warehouses.findMany({ orderBy: (w, { asc }) => [asc(w.label)] });
}
