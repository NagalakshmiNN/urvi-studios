// Single source of truth for the free-delivery threshold and standard
// shipping charge — client-safe (no database import), so both server pages
// and client components (cart, checkout, product detail) can import the same
// numbers instead of each restating their own copy.

export const FREE_SHIPPING_THRESHOLD = 5000;

/** Flat delivery charge in whole rupees, applied when the subtotal is below
 *  FREE_SHIPPING_THRESHOLD and no free-shipping coupon is active. */
export const STANDARD_SHIPPING_FEE = 99;

/** The coupon code that waives shipping regardless of order value.
 *  Read from the FREE_SHIPPING_COUPON env var so Drish can change it from
 *  the Netlify dashboard without touching code. Empty / unset = no coupon. */
export function getFreeShippingCoupon(): string | null {
  const code = (process.env.FREE_SHIPPING_COUPON ?? "").trim();
  return code || null;
}

// Standard line used wherever the site talks about delivery cost.
export function freeShippingNote(): string {
  return `Free delivery on orders above ₹${FREE_SHIPPING_THRESHOLD.toLocaleString("en-IN")}. We deliver across India.`;
}
