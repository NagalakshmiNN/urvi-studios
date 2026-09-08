// The vocabulary for how an order came in, how it gets to the customer, and
// how an in-person sale was paid. Kept in one place so the admin screens,
// the customer emails, the WhatsApp messages and the exports all say the
// same words.

export const SOURCE_LABELS: Record<string, string> = {
  online: "Website",
  walk_in: "Walk-in",
  whatsapp: "WhatsApp",
  phone: "Phone call",
  word_of_mouth: "Word of mouth",
  other: "Other",
};

/** The channels an order can be recorded against by hand, in menu order. */
export const MANUAL_SOURCES: { value: string; label: string }[] = [
  { value: "walk_in", label: "Walk-in — came here in person" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone call" },
  { value: "word_of_mouth", label: "Word of mouth" },
  { value: "other", label: "Other" },
];

export const FULFILMENT_LABELS: Record<string, string> = {
  delivery: "Delivery",
  pickup: "Collected in person",
};

export const PAYMENT_MODES: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
];

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
};

export function isPickup(order: { fulfilmentMethod?: string | null }): boolean {
  return order.fulfilmentMethod === "pickup";
}

/** Whether this order was settled in person rather than through the website. */
export function isInPerson(order: { source?: string | null }): boolean {
  return order.source === "walk_in";
}
