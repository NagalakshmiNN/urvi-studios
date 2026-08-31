// Single source of truth for the free-delivery threshold — client-safe (no
// database import), so both server pages and client components (cart,
// checkout, product detail) can import the same number instead of each
// restating their own copy. That restating is exactly how the site ended up
// with three different thresholds in three different places before this.
export const FREE_SHIPPING_THRESHOLD = 5000;

// Standard line used wherever the site talks about delivery cost.
export function freeShippingNote(): string {
  return `Free delivery on orders above ₹${FREE_SHIPPING_THRESHOLD.toLocaleString("en-IN")}. We deliver across India.`;
}
