// Customer-facing wording for each order status — shared by the status
// update email and the admin "message customer on WhatsApp" link, so the
// two channels always say the same thing.

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
