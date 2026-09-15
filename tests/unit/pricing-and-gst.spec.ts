// The money maths, tested directly. GST is charged inside the displayed
// price (not added on top), so these assertions pin down the exact rounding
// and the two-slab apparel rate structure the checkout page shows.

import { test, expect } from "@playwright/test";
import { calculateGst, gstRateForUnitPrice } from "../../src/lib/gst";
import { FREE_SHIPPING_THRESHOLD, freeShippingNote } from "../../src/lib/shipping";
import { formatINR, generateOrderNumberSeed } from "../../src/lib/format";
import { markupPercent } from "../../src/lib/markup";
import { parseActualSalePrice, formatPaise, paiseToInput } from "../../src/lib/sale-price";

test.describe("GST", () => {
  test("uses 5% at or below ₹2,500 a piece and 18% above", () => {
    expect(gstRateForUnitPrice(999)).toBe(0.05);
    expect(gstRateForUnitPrice(2500)).toBe(0.05);
    expect(gstRateForUnitPrice(2501)).toBe(0.18);
    expect(gstRateForUnitPrice(6499)).toBe(0.18);
  });

  test("backs GST out of an inclusive price rather than adding it on", () => {
    // ₹3,200 including 18% → 3200 − 3200/1.18 = 488.14
    const { totalGst, rateLabel } = calculateGst([{ price: 3200, qty: 1 }]);
    expect(totalGst).toBe(488);
    expect(rateLabel).toBe("18%");
    // The GST is part of the price, never on top of it.
    expect(totalGst).toBeLessThan(3200);
  });

  test("multiplies by quantity", () => {
    const one = calculateGst([{ price: 3200, qty: 1 }]).totalGst;
    const three = calculateGst([{ price: 3200, qty: 3 }]).totalGst;
    expect(three).toBe(Math.round(3 * (3200 - 3200 / 1.18)));
    expect(three).toBeGreaterThan(one * 2.9);
  });

  test("labels a mixed-rate bag with both rates, low first", () => {
    const { rateLabel } = calculateGst([
      { price: 2599, qty: 1 },
      { price: 1399, qty: 1 },
    ]);
    expect(rateLabel).toBe("5%/18%");
  });

  test("shows a dash for an empty bag", () => {
    expect(calculateGst([])).toEqual({ totalGst: 0, rateLabel: "—" });
  });
});

test.describe("delivery", () => {
  test("free-delivery threshold is a single shared value of ₹5,000", () => {
    // This one number is quoted on the cart, checkout, product page, the
    // Shipping & Returns page and the WhatsApp handoff — it used to drift
    // between them, so it lives in one place now.
    expect(FREE_SHIPPING_THRESHOLD).toBe(5000);
    expect(freeShippingNote()).toContain("₹5,000");
    expect(freeShippingNote()).toContain("across India");
  });
});

test.describe("formatting", () => {
  test("formats rupees with Indian digit grouping", () => {
    expect(formatINR(5000)).toBe("₹5,000");
    expect(formatINR(120000)).toBe("₹1,20,000");
    expect(formatINR(0)).toBe("₹0");
  });

  test("order numbers are zero-padded and year-stamped", () => {
    expect(generateOrderNumberSeed(2026, 42)).toBe("URVI-2026-00042");
    expect(generateOrderNumberSeed(2026, 1)).toMatch(/^URVI-\d{4}-\d{5}$/);
  });
});

test.describe("markup badge", () => {
  test("reports how far a price sits above its landed cost", () => {
    expect(markupPercent(2000, 1200)).toBe(67);   // 66.67, rounded
    expect(markupPercent(1800, 1200)).toBe(50);
    expect(markupPercent(1200, 1200)).toBe(0);
  });

  test("goes negative when a price is below cost, which is the point of showing it", () => {
    expect(markupPercent(900, 1200)).toBe(-25);
  });

  test("shows nothing rather than a wrong or infinite figure", () => {
    expect(markupPercent(null, 1200)).toBeNull();  // no price recorded
    expect(markupPercent(2000, null)).toBeNull();  // no landed cost recorded
    expect(markupPercent(2000, 0)).toBeNull();     // would divide by zero
    expect(markupPercent(2000, -5)).toBeNull();
  });
});

test.describe("Actual Sale Price", () => {
  const TOTAL = 3010; // rupees

  test("accepts a plain amount and one with up to two decimals", () => {
    expect(parseActualSalePrice("3010", TOTAL)).toEqual({ ok: true, paise: 301000 });
    expect(parseActualSalePrice("2999.5", TOTAL)).toEqual({ ok: true, paise: 299950 });
    expect(parseActualSalePrice("2999.55", TOTAL)).toEqual({ ok: true, paise: 299955 });
    // Surrounding whitespace is a typing artefact, not a refusal.
    expect(parseActualSalePrice("  1200.40  ", TOTAL)).toEqual({ ok: true, paise: 120040 });
  });

  test("scales to paise exactly, where floating point would not", () => {
    // 1234.56 * 100 is 123455.99999999999 in binary floating point. Storing
    // that rounded the wrong way loses a paise per order.
    expect(parseActualSalePrice("1234.56", 2000)).toEqual({ ok: true, paise: 123456 });
    expect(parseActualSalePrice("0.07", 1)).toEqual({ ok: true, paise: 7 });
    expect(parseActualSalePrice("70.1", 100)).toEqual({ ok: true, paise: 7010 });
  });

  test("an empty field gives the exact required message", () => {
    for (const empty of ["", "   ", null, undefined]) {
      const r = parseActualSalePrice(empty, TOTAL);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toBe("Actual Sale Price is required.");
    }
  });

  test("refuses letters, symbols and anything that isn't a plain number", () => {
    for (const bad of ["abc", "12abc", "1,200", "₹500", "12.3.4", "1e3", "12..5", ".", "+500", " 5 0 "]) {
      expect(parseActualSalePrice(bad, TOTAL).ok).toBe(false);
    }
  });

  test("refuses negatives and zero — a sale is a positive amount", () => {
    expect(parseActualSalePrice("-100", TOTAL).ok).toBe(false);
    expect(parseActualSalePrice("-0.01", TOTAL).ok).toBe(false);
    expect(parseActualSalePrice("0", TOTAL).ok).toBe(false);
    expect(parseActualSalePrice("0.00", TOTAL).ok).toBe(false);
  });

  test("refuses more than two decimal places rather than rounding them away", () => {
    expect(parseActualSalePrice("100.456", TOTAL).ok).toBe(false);
    expect(parseActualSalePrice("100.999", TOTAL).ok).toBe(false);
  });

  test("cannot exceed the order amount, but may equal it to the paise", () => {
    expect(parseActualSalePrice("3010", TOTAL)).toEqual({ ok: true, paise: 301000 });
    expect(parseActualSalePrice("3010.00", TOTAL)).toEqual({ ok: true, paise: 301000 });
    const over = parseActualSalePrice("3010.01", TOTAL);
    expect(over.ok).toBe(false);
    expect(!over.ok && over.error).toContain("cannot be more than the order amount");
    expect(parseActualSalePrice("5000", TOTAL).ok).toBe(false);
  });

  test("formats paise back for display and for the form field", () => {
    expect(formatPaise(301000)).toBe("₹3,010.00");
    expect(formatPaise(123456)).toBe("₹1,234.56");
    expect(paiseToInput(123456)).toBe("1234.56");
    expect(paiseToInput(301000)).toBe("3010.00");
  });
});
