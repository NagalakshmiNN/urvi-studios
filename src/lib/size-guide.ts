// The size chart shown behind "Sizing help" on every product.
//
// IMPORTANT — these are STANDARD Indian womenswear measurements, not measured
// from URVI Studios garments. They are labelled as a general guide on the page
// for exactly that reason: a customer who orders from a wrong chart gets a
// piece that doesn't fit, and the cost of that lands on the shop as a return.
//
// To replace them with real ones: lay a garment flat, measure across the bust
// and double it, do the same at the waist and the widest part of the hip, and
// put those numbers in below. Nothing else needs to change.
//
// Body measurements, in inches — what the wearer measures, not the garment.

export type SizeRow = {
  label: string;
  bust: string;
  waist: string;
  hip: string;
};

export const SIZE_CHART: SizeRow[] = [
  { label: "XS", bust: "32", waist: "26", hip: "35" },
  { label: "S", bust: "34", waist: "28", hip: "37" },
  { label: "M", bust: "36", waist: "30", hip: "39" },
  { label: "L", bust: "38", waist: "32", hip: "41" },
  { label: "XL", bust: "40", waist: "34", hip: "43" },
  { label: "XXL", bust: "42", waist: "36", hip: "45" },
  { label: "3XL", bust: "44", waist: "38", hip: "47" },
  { label: "4XL", bust: "46", waist: "40", hip: "49" },
];

/** Shown under the chart, in the shop's own voice. */
export const SIZE_GUIDE_NOTES = [
  "Measure over your usual undergarments, keeping the tape snug but not tight.",
  "Between two sizes? Take the larger one — most of our kurtis and sets are cut to skim rather than cling.",
  "Handloom and cotton pieces can shrink very slightly on the first wash. We account for this when cutting, but a cold-water first wash helps.",
  "Still unsure? Message us on WhatsApp with your measurements and we'll tell you honestly which size to take.",
];
