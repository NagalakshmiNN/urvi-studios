/**
 * Shadowfax courier API client.
 *
 * Handles creating shipments, tracking them, and mapping Shadowfax's 35
 * status codes to the handful of order statuses the Urvi Studios admin
 * actually cares about.
 *
 * Credentials come from environment variables:
 *   SHADOWFAX_API_TOKEN  – the token from SFX 360 → API Settings
 *   SHADOWFAX_BASE_URL   – defaults to production (dale.shadowfax.in/api)
 *
 * The webhook secret (optional) lets us verify incoming status pushes:
 *   SHADOWFAX_WEBHOOK_SECRET – set this if Shadowfax's webhook config
 *                              has an authorisation header value.
 */

// ---------------------------------------------------------------- Config

const BASE_URL =
  process.env.SHADOWFAX_BASE_URL?.replace(/\/+$/, "") ||
  "https://dale.shadowfax.in/api";

function apiToken(): string {
  const t = process.env.SHADOWFAX_API_TOKEN;
  if (!t) throw new Error("SHADOWFAX_API_TOKEN is not set");
  return t;
}

function headers() {
  return {
    Authorization: `Token ${apiToken()}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------- Status mapping

/**
 * Shadowfax reports ~35 granular statuses. We map each to one of the order
 * statuses the admin already works with, plus a human-readable label.
 */
export interface CourierStatusInfo {
  /** The Shadowfax status code as-is. */
  sfxStatus: string;
  /** Human label for the customer/admin. */
  label: string;
  /** Which Urvi Studios order status this maps to, if the order status
   *  should auto-advance. Null means "don't change the order status". */
  orderStatus: string | null;
}

const STATUS_MAP: Record<string, { label: string; orderStatus: string | null }> = {
  // Pickup phase
  new:                      { label: "Order placed with courier",      orderStatus: null },
  assigned_for_pickup:      { label: "Rider assigned for pickup",      orderStatus: null },
  arrived_for_pickup:       { label: "Rider at pickup location",       orderStatus: null },
  picked:                   { label: "Picked up",                      orderStatus: "SHIPPED" },
  pickup_failed:            { label: "Pickup failed",                  orderStatus: null },
  pickup_rescheduled:       { label: "Pickup rescheduled",             orderStatus: null },

  // In transit
  in_transit:               { label: "In transit",                     orderStatus: "SHIPPED" },
  reached_destination_hub:  { label: "Reached destination hub",        orderStatus: "SHIPPED" },
  received_by_hub:          { label: "Received at hub",                orderStatus: "SHIPPED" },

  // Out for delivery
  ofd:                      { label: "Out for delivery",               orderStatus: "OUT_FOR_DELIVERY" },
  out_for_delivery:         { label: "Out for delivery",               orderStatus: "OUT_FOR_DELIVERY" },
  arrived_for_delivery:     { label: "Rider at delivery address",      orderStatus: "OUT_FOR_DELIVERY" },

  // Delivered
  delivered:                { label: "Delivered",                       orderStatus: "DELIVERED" },
  partially_delivered:      { label: "Partially delivered",             orderStatus: "DELIVERED" },

  // Failed delivery
  failed_delivery:          { label: "Delivery attempt failed",         orderStatus: null },
  delivery_delayed:         { label: "Delivery delayed",                orderStatus: null },
  undelivered:              { label: "Could not deliver",               orderStatus: null },

  // Cancellation
  cancelled:                { label: "Cancelled",                       orderStatus: null },
  cancelled_by_customer:    { label: "Cancelled by customer",           orderStatus: null },
  cancelled_by_client:      { label: "Cancelled by seller",             orderStatus: null },

  // Return to sender / origin
  rts:                      { label: "Returning to seller",             orderStatus: null },
  rto:                      { label: "Returned to origin",              orderStatus: "RETURNED" },
  rto_in_transit:           { label: "Return in transit",               orderStatus: null },
  rto_ofd:                  { label: "Return out for delivery",         orderStatus: null },
  rto_delivered:            { label: "Returned to seller",              orderStatus: "RETURNED" },
  rto_undelivered:          { label: "Return delivery failed",          orderStatus: null },

  // Other
  lost:                     { label: "Package lost",                    orderStatus: null },
  damaged:                  { label: "Package damaged",                 orderStatus: null },
  on_hold:                  { label: "On hold",                         orderStatus: null },
};

export function mapSfxStatus(sfxStatus: string): CourierStatusInfo {
  const mapped = STATUS_MAP[sfxStatus];
  if (mapped) return { sfxStatus, ...mapped };
  // Unknown status — show it as-is, don't auto-advance the order.
  return {
    sfxStatus,
    label: sfxStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    orderStatus: null,
  };
}

/** A customer-friendly one-liner for the courier status. */
export function courierStatusLabel(sfxStatus: string | null | undefined): string {
  if (!sfxStatus) return "Preparing to ship";
  return mapSfxStatus(sfxStatus).label;
}

// ---------------------------------------------------- Create a shipment

/** A warehouse / pickup-point address from the warehouses table. */
export interface WarehouseAddress {
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface CreateShipmentInput {
  /** Our order number, e.g. "US-0042". */
  clientOrderId: string;
  /** Total product value in ₹ (not paise). */
  productValue: number;
  /** "prepaid" or "cod". */
  paymentMode: "prepaid" | "cod";
  /** COD amount in ₹ if payment mode is COD. */
  codAmount?: number;
  /** Customer info. */
  customer: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  /** Items in the shipment. */
  items: {
    name: string;
    sku: string;
    price: number;
    qty: number;
  }[];
  /** Optional: weight in kg. */
  weightKg?: number;
  /** Pickup warehouse address. If omitted, Shadowfax uses your dashboard default. */
  pickupAddress?: WarehouseAddress;
  /** Return warehouse address. If omitted, same as pickupAddress (or dashboard default). */
  returnAddress?: WarehouseAddress;
}

export interface CreateShipmentResult {
  success: boolean;
  awbNumber?: string;
  shadowfaxOrderId?: string;
  error?: string;
  raw?: unknown;
}

/**
 * Create a forward shipment on Shadowfax.
 *
 * Pickup / return address priority:
 *   1. pickupAddress / returnAddress passed in the input (from the warehouses table)
 *   2. If neither is passed, Shadowfax uses the address on your dashboard.
 */
export async function createShipment(
  input: CreateShipmentInput
): Promise<CreateShipmentResult> {
  // Build pickup block from the selected warehouse, if provided.
  function warehouseToBlock(w: WarehouseAddress) {
    return {
      pickup_type: "seller" as const,
      name: w.contactName,
      contact_number: w.contactPhone.replace(/^\+91/, "").replace(/\D/g, ""),
      address_line_1: w.addressLine1,
      address_line_2: w.addressLine2 || "",
      city: w.city,
      state: w.state,
      pincode: w.pincode,
    };
  }

  const pickupBlock = input.pickupAddress
    ? warehouseToBlock(input.pickupAddress)
    : undefined;

  const returnBlock = input.returnAddress
    ? { ...warehouseToBlock(input.returnAddress), return_type: "seller" as const }
    : pickupBlock
      ? { ...pickupBlock, return_type: "seller" as const }
      : undefined;

  const body: Record<string, unknown> = {
    // Marketplace order type — the default for D2C sellers.
    order_type: "marketplace",
    customer_details: {
      name: input.customer.name,
      contact_number: input.customer.phone.replace(/^\+91/, "").replace(/\D/g, ""),
      address_line_1: input.customer.addressLine1,
      address_line_2: input.customer.addressLine2 || "",
      city: input.customer.city,
      state: input.customer.state,
      pincode: input.customer.pincode,
    },
    order_details: {
      client_order_id: input.clientOrderId,
      product_value: input.productValue,
      payment_mode: input.paymentMode,
      cod_amount: input.paymentMode === "cod" ? (input.codAmount ?? input.productValue) : 0,
      weight: input.weightKg ?? 0.5,
    },
    ...(pickupBlock ? { pickup_details: pickupBlock } : {}),
    ...(returnBlock ? { return_details: returnBlock } : {}),
    product_details: input.items.map((item) => ({
      sku_name: item.name,
      sku_id: item.sku || "GENERIC",
      price: item.price,
      quantity: item.qty,
    })),
  };

  try {
    const res = await fetch(`${BASE_URL}/v3/clients/orders/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data?.message || data?.detail || JSON.stringify(data),
        raw: data,
      };
    }

    return {
      success: true,
      awbNumber: data.awb_number || data.data?.awb_number,
      shadowfaxOrderId: String(data.order_id || data.data?.order_id || ""),
      raw: data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ----------------------------------------------------- Track a shipment

export interface TrackingEvent {
  status: string;
  label: string;
  timestamp: string;
  location?: string;
}

export interface TrackingResult {
  success: boolean;
  currentStatus?: string;
  currentLabel?: string;
  awbNumber?: string;
  timeline?: TrackingEvent[];
  error?: string;
  raw?: unknown;
}

export async function trackShipment(
  shadowfaxOrderId: string
): Promise<TrackingResult> {
  try {
    const res = await fetch(
      `${BASE_URL}/v3/clients/orders/${shadowfaxOrderId}/`,
      { method: "GET", headers: headers() }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data?.message || data?.detail || JSON.stringify(data),
        raw: data,
      };
    }

    const orderData = data.data || data;
    const status = orderData.status || orderData.order_details?.status;
    const info = mapSfxStatus(status);

    // Build timeline from tracking_details if present
    const timeline: TrackingEvent[] = (
      orderData.tracking_details || []
    ).map((t: { status?: string; timestamp?: string; location?: string }) => {
      const si = mapSfxStatus(t.status || "");
      return {
        status: t.status || "",
        label: si.label,
        timestamp: t.timestamp || "",
        location: t.location,
      };
    });

    return {
      success: true,
      currentStatus: status,
      currentLabel: info.label,
      awbNumber: orderData.awb_number,
      timeline,
      raw: data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// --------------------------------------------------- Cancel a shipment

export async function cancelShipment(
  shadowfaxOrderId: string,
  reason = "Cancelled by seller"
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${BASE_URL}/v3/clients/orders/${shadowfaxOrderId}/cancel/`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ reason }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data?.message || data?.detail || JSON.stringify(data),
      };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
