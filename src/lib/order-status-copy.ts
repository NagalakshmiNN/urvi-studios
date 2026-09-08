// Customer-facing wording for each order status — shared by the status
// update email and the admin "message customer on WhatsApp" link, so the
// two channels always say the same thing.
//
// An order being collected in person needs different words: nothing is
// shipped or out for delivery, it becomes ready to collect and then
// collected. Both sets live here, picked by fulfilment method.

export const STATUS_LABELS: Record<string, string> = {
  PLACED: "Order Received",
  CONFIRMED: "Order Confirmed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Return Processed",
};

export const STATUS_CUSTOMER_LINES: Record<string, string> = {
  PLACED: "We've received your order and it's being prepared.",
  CONFIRMED: "Your order is confirmed and is being packed.",
  SHIPPED: "Your order has shipped and is on its way to you.",
  OUT_FOR_DELIVERY: "Your order is out for delivery — it should reach you very soon.",
  DELIVERED: "Your order has been delivered. We hope you love it!",
  CANCELLED: "Your order has been cancelled. If this wasn't expected, reply and we'll sort it out.",
  RETURNED: "Your return has been processed.",
};

const PICKUP_STATUS_LABELS: Record<string, string> = {
  PLACED: "Order Received",
  CONFIRMED: "Ready to Collect",
  DELIVERED: "Collected",
  CANCELLED: "Cancelled",
  RETURNED: "Return Processed",
};

const PICKUP_CUSTOMER_LINES: Record<string, string> = {
  PLACED: "We've received your order and are getting it ready for you to collect.",
  CONFIRMED: "Your order is packed and ready to collect — come by whenever suits you.",
  DELIVERED: "Thanks for collecting your order. We hope you love it!",
  CANCELLED: "Your order has been cancelled. If this wasn't expected, reply and we'll sort it out.",
  RETURNED: "Your return has been processed.",
};

/**
 * The statuses that make sense for an order — a collected-in-person order
 * never gets shipped or goes out for delivery.
 */
export function statusesFor(fulfilmentMethod: string | null | undefined): string[] {
  return fulfilmentMethod === "pickup"
    ? ["PLACED", "CONFIRMED", "DELIVERED", "CANCELLED", "RETURNED"]
    : ["PLACED", "CONFIRMED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];
}

export function statusLabel(status: string, fulfilmentMethod?: string | null): string {
  if (fulfilmentMethod === "pickup" && PICKUP_STATUS_LABELS[status]) return PICKUP_STATUS_LABELS[status];
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function statusCustomerLine(status: string, fulfilmentMethod?: string | null): string | undefined {
  if (fulfilmentMethod === "pickup") return PICKUP_CUSTOMER_LINES[status];
  return STATUS_CUSTOMER_LINES[status];
}
