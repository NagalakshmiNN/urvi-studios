// What a piece actually cost, worked out from the invoice it arrived on.
//
// This is the calculation that currently lives in the costing workbook's
// PROCUREMENT REGISTER, moved here so an invoice can be entered once, in the
// admin, and every number that depends on it follows automatically.
//
// The rules are the workbook's own, deliberately, so the two agree while both
// exist:
//
//   • Freight is allocated **per piece**. A ₹500 delivery across 85 pieces is
//     ₹5.88 a piece regardless of what each piece cost — the courier charged
//     for the box, not the contents.
//   • An invoice-level discount is allocated **by value**. A 2.38% trade
//     discount comes off each line in proportion to what that line is worth.
//   • GST is charged on the discounted taxable value, at each line's own rate.
//
// Every allocation sums to its total exactly. That is not fussiness: the
// workbook ties to the printed invoice to the rupee, and an allocation that
// loses ₹0.03 to rounding is how a register stops tying and nobody notices for
// three months. `allocate` below distributes the remainder rather than leaving
// it behind.
//
// Money is in integer paise throughout, like capital and expenses elsewhere in
// the app. A vendor's unit price is ₹212.50 as often as it is ₹212, and a
// float cannot hold two decimals exactly. Rupees appear only at the edges,
// where `products.landedCost` is written.

export type PurchaseLineInput = {
  /** The product this line buys, as the invoice names it. */
  item: string;
  /** Colour, where the invoice distinguishes one. Part of a product's identity. */
  colour?: string | null;
  size: string;
  qty: number;
  /** Per piece, before discount and GST, in paise. */
  unitPricePaise: number;
  /** Whole percent: 5 or 18. */
  gstRatePct: number;
};

export type PurchaseInput = {
  lines: PurchaseLineInput[];
  /** Inbound delivery, in paise. Allocated per piece. */
  freightPaise?: number;
  /** Invoice-level discount, in paise. Allocated by line value. */
  discountPaise?: number;
  /** Anything else on the invoice — handling, packing. Allocated per piece. */
  otherChargesPaise?: number;
};

export type CostedLine = PurchaseLineInput & {
  grossPaise: number;
  discountSharePaise: number;
  taxablePaise: number;
  gstPaise: number;
  freightSharePaise: number;
  otherSharePaise: number;
  /** Everything this line cost, landed. */
  landedPaise: number;
  /** Landed cost of one piece from this line. */
  landedPerUnitPaise: number;
};

export type CostedPurchase = {
  lines: CostedLine[];
  totalQty: number;
  grossPaise: number;
  discountPaise: number;
  taxablePaise: number;
  gstPaise: number;
  freightPaise: number;
  otherChargesPaise: number;
  /** Taxable + GST. What the vendor's invoice total should read. */
  invoiceTotalPaise: number;
  /** Invoice total + freight + other. What the stock actually cost to get here. */
  landedTotalPaise: number;
};

/**
 * Split `totalPaise` across `weights` so the parts are whole paise and sum to
 * the total exactly.
 *
 * Largest-remainder: floor everything, then hand the leftover paise out to
 * whichever parts were cut hardest. With equal weights and a total that does
 * not divide evenly, the earlier lines get the extra paise — arbitrary, but
 * stable, which matters more than which line it lands on.
 */
export function allocate(totalPaise: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (totalPaise === 0) return weights.map(() => 0);

  const sum = weights.reduce((a, b) => a + b, 0);
  // Nothing to apportion against — spread evenly rather than divide by zero.
  if (sum <= 0) return allocate(totalPaise, weights.map(() => 1));

  const exact = weights.map((w) => (totalPaise * w) / sum);
  const parts = exact.map((v) => Math.floor(v));
  let left = totalPaise - parts.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (let k = 0; left > 0 && k < order.length; k++, left--) parts[order[k].i] += 1;
  // A negative remainder can only come from a negative total; take it back the
  // same way so the sum still holds.
  for (let k = 0; left < 0 && k < order.length; k++, left++) parts[order[order.length - 1 - k].i] -= 1;

  return parts;
}

export class PurchaseError extends Error {}

function check(input: PurchaseInput): void {
  if (input.lines.length === 0) throw new PurchaseError("An invoice needs at least one line.");
  input.lines.forEach((l, i) => {
    const where = `Line ${i + 1}${l.item ? ` (${l.item})` : ""}`;
    if (!l.item?.trim()) throw new PurchaseError(`${where}: no item name.`);
    if (!l.size?.trim()) throw new PurchaseError(`${where}: no size.`);
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new PurchaseError(`${where}: quantity must be a whole number above zero.`);
    if (!Number.isInteger(l.unitPricePaise) || l.unitPricePaise < 0) throw new PurchaseError(`${where}: unit price must not be negative.`);
    if (!Number.isFinite(l.gstRatePct) || l.gstRatePct < 0 || l.gstRatePct > 100) throw new PurchaseError(`${where}: GST rate must be between 0 and 100.`);
  });
  for (const [label, value] of [
    ["Freight", input.freightPaise],
    ["Discount", input.discountPaise],
    ["Other charges", input.otherChargesPaise],
  ] as const) {
    if (value != null && (!Number.isInteger(value) || value < 0)) {
      throw new PurchaseError(`${label} must be a whole number of paise, and not negative.`);
    }
  }
}

/** Cost an invoice: every line, and the totals it should tie to. */
export function costPurchase(input: PurchaseInput): CostedPurchase {
  check(input);

  const freightPaise = input.freightPaise ?? 0;
  const discountPaise = input.discountPaise ?? 0;
  const otherChargesPaise = input.otherChargesPaise ?? 0;

  const gross = input.lines.map((l) => l.qty * l.unitPricePaise);
  const grossPaise = gross.reduce((a, b) => a + b, 0);

  if (discountPaise > grossPaise) {
    throw new PurchaseError(
      `The discount (₹${(discountPaise / 100).toFixed(2)}) is larger than the invoice value (₹${(grossPaise / 100).toFixed(2)}).`
    );
  }

  const discountShares = allocate(discountPaise, gross);
  const qty = input.lines.map((l) => l.qty);
  const freightShares = allocate(freightPaise, qty);
  const otherShares = allocate(otherChargesPaise, qty);

  const lines: CostedLine[] = input.lines.map((l, i) => {
    const taxablePaise = gross[i] - discountShares[i];
    const gstPaise = Math.round((taxablePaise * l.gstRatePct) / 100);
    const landedPaise = taxablePaise + gstPaise + freightShares[i] + otherShares[i];
    return {
      ...l,
      grossPaise: gross[i],
      discountSharePaise: discountShares[i],
      taxablePaise,
      gstPaise,
      freightSharePaise: freightShares[i],
      otherSharePaise: otherShares[i],
      landedPaise,
      // Per piece, rounded to the paise. The sum of these times their
      // quantities can sit a paisa or two off `landedPaise`; the line total is
      // the figure that ties to the invoice, so that is the one kept whole.
      landedPerUnitPaise: Math.round(landedPaise / l.qty),
    };
  });

  const taxablePaise = lines.reduce((a, l) => a + l.taxablePaise, 0);
  const gstPaise = lines.reduce((a, l) => a + l.gstPaise, 0);

  return {
    lines,
    totalQty: qty.reduce((a, b) => a + b, 0),
    grossPaise,
    discountPaise,
    taxablePaise,
    gstPaise,
    freightPaise,
    otherChargesPaise,
    invoiceTotalPaise: taxablePaise + gstPaise,
    landedTotalPaise: taxablePaise + gstPaise + freightPaise + otherChargesPaise,
  };
}

/**
 * One product, as an invoice describes it.
 *
 * Colour is part of the identity, not an attribute: the catalogue keeps
 * "Short Kurthi - Red" and "Short Kurthi - Brown" as two products with their
 * own photographs and their own stock, which is how the workbook has always
 * grouped them and how the storefront already reads.
 */
export function productKey(item: string, colour?: string | null): string {
  const c = colour?.trim();
  return c ? `${item.trim()} — ${c}` : item.trim();
}

export type ProductCosting = {
  key: string;
  item: string;
  colour: string | null;
  /** Size label → pieces received. */
  sizes: { label: string; qty: number }[];
  totalQty: number;
  landedTotalPaise: number;
  landedPerUnitPaise: number;
};

/**
 * Roll costed lines up into the products they buy.
 *
 * Landed cost per unit is the product's whole landed cost over its whole
 * quantity, not an average of the per-line figures — a size bought two at one
 * price and three at another has one cost per piece, weighted.
 */
export function costingByProduct(costed: CostedPurchase): ProductCosting[] {
  const out = new Map<string, ProductCosting>();

  for (const line of costed.lines) {
    const key = productKey(line.item, line.colour);
    let p = out.get(key);
    if (!p) {
      p = {
        key,
        item: line.item.trim(),
        colour: line.colour?.trim() || null,
        sizes: [],
        totalQty: 0,
        landedTotalPaise: 0,
        landedPerUnitPaise: 0,
      };
      out.set(key, p);
    }
    const size = p.sizes.find((s) => s.label === line.size.trim());
    if (size) size.qty += line.qty;
    else p.sizes.push({ label: line.size.trim(), qty: line.qty });

    p.totalQty += line.qty;
    p.landedTotalPaise += line.landedPaise;
  }

  for (const p of out.values()) {
    p.landedPerUnitPaise = p.totalQty > 0 ? Math.round(p.landedTotalPaise / p.totalQty) : 0;
    p.sizes.sort((a, b) => sizeOrder(a.label) - sizeOrder(b.label) || a.label.localeCompare(b.label));
  }

  return [...out.values()];
}

/** The order sizes are shown in everywhere else in the app. */
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];

export function sizeOrder(label: string): number {
  const i = SIZE_ORDER.indexOf(normaliseSize(label));
  return i === -1 ? SIZE_ORDER.length : i;
}

/**
 * Size labels as the catalogue spells them.
 *
 * Vendors write the same size several ways — "2XL" for XXL, numeric 38–46 on
 * Bangalore invoices. An unrecognised label is left exactly as it came rather
 * than guessed at; it will show up on the review screen looking wrong, which
 * is the right outcome.
 */
export function normaliseSize(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const numeric: Record<string, string> = { "38": "S", "40": "M", "42": "L", "44": "XL", "46": "XXL", "48": "3XL" };
  if (numeric[s]) return numeric[s];
  if (s === "2XL") return "XXL";
  if (s === "XXXL") return "3XL";
  if (s === "XXXXL") return "4XL";
  return s;
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise / 100);
}
