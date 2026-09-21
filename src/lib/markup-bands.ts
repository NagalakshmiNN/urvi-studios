// What to charge, worked out from what it cost.
//
// The workbook does this in columns Z through AC: a target markup and a
// minimum markup per SKU, applied to landed cost, then rounded up to the
// nearest ₹10. Two things change here.
//
// First, the markup is no longer typed per product. It comes from a band on
// landed cost — under ₹500, ₹500–1,000, ₹1,000–1,500, and ₹1,500 upwards —
// because that is how the decision is actually made. A ₹200 kurti and a
// ₹2,000 suit set are not priced by the same rule, and typing the same two
// numbers onto two hundred rows was only ever a way of pretending they were.
//
// Second, the bands are data, not code. They live in a table and are edited on
// the Pricing screen, because a markup is a commercial decision that will
// change with the season, the vendor and the competition — and a decision that
// needs a deploy to change is a decision nobody revisits.
//
// The minimum markup is not a second price. It is the discount floor: the
// lowest a piece may be sold for and still be worth having bought. It is what
// `minRoundUpTo` has always meant.

import { markupPercent } from "@/lib/markup";

export type MarkupBand = {
  /**
   * Top of the band — landed cost per unit, in paise, inclusive. A piece that
   * landed at exactly ₹500 is in the "up to ₹500" band. `null` means no
   * ceiling, which the last band must have so that nothing is ever unpriced.
   */
  upToPaise: number | null;
  /** Whole percent over landed cost. 50 means sell at one and a half times cost. */
  targetPct: number;
  /** Whole percent over landed cost. The discount floor. */
  minPct: number;
};

/**
 * What the bands start as.
 *
 * Deliberately the workbook's existing 50% target and 30% floor, repeated
 * across all four — so switching the app on changes no price by itself. The
 * bands only start doing work once Nagalakshmi sets them, and the Pricing
 * screen shows her what she is actually charging in each band today so the
 * numbers come from her own catalogue rather than from a guess made here.
 */
export const DEFAULT_BANDS: MarkupBand[] = [
  { upToPaise: 50_000, targetPct: 50, minPct: 30 },
  { upToPaise: 100_000, targetPct: 50, minPct: 30 },
  { upToPaise: 150_000, targetPct: 50, minPct: 30 },
  { upToPaise: null, targetPct: 50, minPct: 30 },
];

export function bandLabel(band: MarkupBand, index: number, bands: MarkupBand[]): string {
  const from = index === 0 ? 0 : (bands[index - 1].upToPaise ?? 0) / 100;
  if (band.upToPaise == null) return `₹${from.toLocaleString("en-IN")} and above`;
  return `₹${from.toLocaleString("en-IN")} – ₹${(band.upToPaise / 100).toLocaleString("en-IN")}`;
}

/** The band a landed cost falls in. Never null: the last band has no ceiling. */
export function bandFor(landedPerUnitPaise: number, bands: MarkupBand[]): MarkupBand {
  for (const band of bands) {
    if (band.upToPaise == null || landedPerUnitPaise <= band.upToPaise) return band;
  }
  // Only reachable if the bands are malformed; `validateBands` refuses to save
  // a set that ends with a ceiling, so treat it as the top band regardless.
  return bands[bands.length - 1];
}

/** Round a rupee figure up to the next ₹10. ₹1,907 becomes ₹1,910. */
export function roundUpTo10(rupees: number): number {
  return Math.ceil(rupees / 10) * 10;
}

export type SuggestedPricing = {
  /** What to sell at, in whole rupees, rounded up to ₹10. */
  price: number;
  /** The discount floor, in whole rupees, rounded up to ₹10. */
  minPrice: number;
  targetPct: number;
  minPct: number;
};

/**
 * What a piece should cost, given what it cost to land.
 *
 * Both figures round **up**: rounding a price down gives margin away, and
 * rounding a floor down lowers the point at which a discount stops being worth
 * taking. ₹0 landed cost yields no suggestion at all rather than a free
 * product — twenty-eight SKUs are in exactly that state, and a price of ₹0 is
 * worse than a blank one.
 */
export function suggestPricing(landedPerUnitPaise: number, bands: MarkupBand[]): SuggestedPricing | null {
  if (!Number.isFinite(landedPerUnitPaise) || landedPerUnitPaise <= 0) return null;
  const band = bandFor(landedPerUnitPaise, bands);
  const landedRupees = landedPerUnitPaise / 100;
  return {
    price: roundUpTo10(landedRupees * (1 + band.targetPct / 100)),
    minPrice: roundUpTo10(landedRupees * (1 + band.minPct / 100)),
    targetPct: band.targetPct,
    minPct: band.minPct,
  };
}

export type BandProblem = { index: number; message: string };

/**
 * Whether a set of bands can be saved.
 *
 * Three things have to hold or pricing silently stops working: the ceilings
 * ascend, only the last band is open-ended, and a floor is never above its own
 * target. That last one would let a discount price a piece higher than its
 * full price, which is the sort of thing that is obvious in a sentence and
 * invisible in a table of numbers.
 */
export function validateBands(bands: MarkupBand[]): BandProblem[] {
  const problems: BandProblem[] = [];
  if (bands.length === 0) return [{ index: -1, message: "There has to be at least one band." }];

  bands.forEach((b, i) => {
    const last = i === bands.length - 1;
    if (!last && b.upToPaise == null) {
      problems.push({ index: i, message: "Only the last band may be open-ended." });
    }
    if (last && b.upToPaise != null) {
      problems.push({ index: i, message: "The last band must have no upper limit, so every cost is priced." });
    }
    if (b.upToPaise != null && b.upToPaise <= 0) {
      problems.push({ index: i, message: "The upper limit must be above zero." });
    }
    if (i > 0) {
      const prev = bands[i - 1].upToPaise;
      if (prev != null && b.upToPaise != null && b.upToPaise <= prev) {
        problems.push({ index: i, message: "Each band must end above the one before it." });
      }
    }
    for (const [name, pct] of [["Target markup", b.targetPct], ["Minimum markup", b.minPct]] as const) {
      if (!Number.isFinite(pct) || pct < 0 || pct > 1000) {
        problems.push({ index: i, message: `${name} must be between 0 and 1000 percent.` });
      }
    }
    if (b.minPct > b.targetPct) {
      problems.push({ index: i, message: "The minimum markup cannot be above the target — the floor would sit above the price." });
    }
  });

  return problems;
}

export type BandUsage = {
  band: MarkupBand;
  label: string;
  /** Products whose landed cost falls in this band. */
  products: number;
  /** The middle of what she actually charges there today, as a percentage. */
  medianMarkupPct: number | null;
  /** Products in this band whose price would move if the band were applied. */
  wouldChange: number;
};

/**
 * What each band would mean for the catalogue as it stands.
 *
 * This is the point of the Pricing screen: rather than asking for four numbers
 * out of the air, show what is already being charged in each band and how many
 * prices the band would move. A markup is easy to choose once you can see the
 * one you have been using.
 */
export function bandUsage(
  bands: MarkupBand[],
  products: { price: number; landedCost: number | null }[]
): BandUsage[] {
  return bands.map((band, i) => {
    const inBand = products.filter(
      (p) => p.landedCost != null && p.landedCost > 0 && bandFor(p.landedCost * 100, bands) === band
    );

    const markups = inBand
      .map((p) => markupPercent(p.price, p.landedCost))
      .filter((m): m is number => m != null)
      .sort((a, b) => a - b);

    const mid = markups.length === 0 ? null : markups.length % 2 === 1
      ? markups[(markups.length - 1) / 2]
      : Math.round((markups[markups.length / 2 - 1] + markups[markups.length / 2]) / 2);

    const wouldChange = inBand.filter((p) => {
      const s = suggestPricing((p.landedCost ?? 0) * 100, bands);
      return s != null && s.price !== p.price;
    }).length;

    return { band, label: bandLabel(band, i, bands), products: inBand.length, medianMarkupPct: mid, wouldChange };
  });
}
