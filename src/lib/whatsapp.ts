// Shared helper for building "click to open a pre-filled WhatsApp chat" links
// — the same tap-to-send pattern already used for the shop's own order
// handoff numbers, reused here to let an admin message a *customer* about
// their order. This is not automatic sending: WhatsApp has no API for a
// business to push a message into a customer's chat without that business
// having a WhatsApp Business API account (still not set up — see the
// project checklist). A tap-to-send link is the honest, working substitute
// until that's in place.

// Best-effort normalize to the country-code-prefixed digits wa.me expects.
// Customers only ever type a plain 10-digit Indian mobile number into the
// checkout form, so that's the common case; a couple of other shapes
// (leading 0, already has the 91 prefix) are handled defensively.
export function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${normalizeIndianPhone(phone)}?text=${encodeURIComponent(message)}`;
}
