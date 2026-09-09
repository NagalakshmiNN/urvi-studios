// How far a price sits above its landed cost, as a whole percentage.
//
// Shown as a small corner badge beside the Min/Max Round Up To figures on the
// Products and Stock screens, so a margin can be checked at a glance instead
// of doing the arithmetic against the Landed Cost column by hand.
//
// Returns null when there is nothing meaningful to show — no price, or no
// landed cost recorded yet (which also guards the division).
export function markupPercent(price: number | null, landedCost: number | null): number | null {
  if (price == null || landedCost == null || landedCost <= 0) return null;
  return Math.round(((price - landedCost) / landedCost) * 100);
}
