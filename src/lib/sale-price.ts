// What an order actually sold for, as opposed to what it was listed at.
//
// Kept apart from the form and the server action so the rules live in one
// place and can be tested directly, without a browser or a database.
//
// Money is held as INTEGER PAISE, never as a float. 0.1 + 0.2 is not 0.3 in
// any language with binary floating point, and a rupee figure that drifts by a
// paise per order is the kind of bug that only shows up in a year-end total
// that won't reconcile.

/** The exact words Nagalakshmi asked for when the field is left empty. */
export const REQUIRED_MESSAGE = "Actual Sale Price is required.";

// Digits, optionally a decimal point and one or two more digits. Nothing else:
// no sign, no comma, no currency symbol, no exponent. A leading "+" or "-",
// "1e3", "1.2.3" and "₹500" all fail here rather than being silently coerced
// by Number(), which would read "" as 0 and " 12 " as 12.
const MONEY = /^\d+(\.\d{1,2})?$/;

export type SalePriceResult =
  | { ok: true; paise: number }
  | { ok: false; error: string };

/**
 * Validate what an admin typed against the order it belongs to.
 *
 * `orderTotal` is in whole rupees, matching how every other amount on an order
 * is stored.
 */
export function parseActualSalePrice(raw: string | null | undefined, orderTotal: number): SalePriceResult {
  const value = (raw ?? "").trim();

  if (value === "") return { ok: false, error: REQUIRED_MESSAGE };

  if (!MONEY.test(value)) {
    return {
      ok: false,
      error: "Enter a number only — digits and up to 2 decimal places, with no letters, symbols or minus sign.",
    };
  }

  // Safe now that the shape is known: split on the point and scale by hand, so
  // the paise are exact rather than whatever 12.34 * 100 happens to produce.
  const [rupees, decimals = ""] = value.split(".");
  const paise = Number(rupees) * 100 + Number(decimals.padEnd(2, "0"));

  if (!Number.isFinite(paise)) {
    return { ok: false, error: "That number is too large to record." };
  }
  if (paise <= 0) {
    return { ok: false, error: "Actual Sale Price must be more than zero." };
  }

  const maxPaise = Math.round(orderTotal * 100);
  if (paise > maxPaise) {
    return {
      ok: false,
      error: `Actual Sale Price cannot be more than the order amount of ${formatPaise(maxPaise)}.`,
    };
  }

  return { ok: true, paise };
}

/** Paise back to a display string, e.g. 123456 → "₹1,234.56". */
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Paise back into the form field, e.g. 123456 → "1234.56". */
export function paiseToInput(paise: number): string {
  return (paise / 100).toFixed(2);
}
