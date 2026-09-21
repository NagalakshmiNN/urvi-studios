// Costing an invoice, and pricing what it bought.
//
// The numbers in "an invoice ties to the paper" are G.D. Fabrics GD707, the
// real invoice this was built against: ₹45,300 gross, ₹1,078.14 trade
// discount, 5% IGST, ₹500 of VRL freight, 85 pieces. If this test ever fails,
// the register has stopped tying to the invoice — which is the exact failure
// the workbook took three sessions to find the last time it happened.

import { test, expect } from "@playwright/test";
import {
  allocate,
  costPurchase,
  costingByProduct,
  normaliseSize,
  productKey,
  PurchaseError,
  type PurchaseLineInput,
} from "../../src/lib/purchasing";
import {
  DEFAULT_BANDS,
  bandFor,
  bandUsage,
  roundUpTo10,
  suggestPricing,
  validateBands,
  type MarkupBand,
} from "../../src/lib/markup-bands";
import { parseInvoiceBrief, parseRupees, reconcile } from "../../src/lib/invoice-brief";
import { canPreview, checkUpload, humanSize, isDocumentKind, MAX_BYTES, safeFilename } from "../../src/lib/purchase-documents";

function line(over: Partial<PurchaseLineInput> = {}): PurchaseLineInput {
  return { item: "Kurti", size: "M", qty: 1, unitPricePaise: 100_00, gstRatePct: 5, ...over };
}

test.describe("allocation", () => {
  test("always sums to the total, however it divides", () => {
    for (const total of [0, 1, 7, 500_00, 107_814, 999_999]) {
      for (const weights of [[1], [1, 1, 1], [3, 1], [5, 5, 5, 5, 5, 5, 5], [100, 1, 1]]) {
        const parts = allocate(total, weights);
        expect(parts.reduce((a, b) => a + b, 0), `${total} over ${weights}`).toBe(total);
        expect(parts.every(Number.isInteger)).toBe(true);
      }
    }
  });

  test("spreads evenly when there is nothing to weight against", () => {
    expect(allocate(300, [0, 0, 0])).toEqual([100, 100, 100]);
  });
});

test.describe("what a piece cost", () => {
  test("freight goes per piece, not per rupee", () => {
    // A courier charges for the box. Two cheap pieces and two dear ones carry
    // the same delivery cost.
    const costed = costPurchase({
      lines: [line({ item: "Cheap", qty: 2, unitPricePaise: 100_00 }), line({ item: "Dear", qty: 2, unitPricePaise: 900_00 })],
      freightPaise: 400_00,
    });
    expect(costed.lines[0].freightSharePaise).toBe(200_00);
    expect(costed.lines[1].freightSharePaise).toBe(200_00);
  });

  test("a trade discount goes by value, not per piece", () => {
    const costed = costPurchase({
      lines: [line({ item: "Cheap", qty: 1, unitPricePaise: 100_00 }), line({ item: "Dear", qty: 1, unitPricePaise: 900_00 })],
      discountPaise: 100_00,
    });
    expect(costed.lines[0].discountSharePaise).toBe(10_00);
    expect(costed.lines[1].discountSharePaise).toBe(90_00);
  });

  test("an invoice ties to the paper", () => {
    // GD707's shape: 85 pieces across 17 lines of 5, gross ₹45,300.
    const lines = Array.from({ length: 17 }, (_, i) =>
      line({ item: `Item ${i + 1}`, qty: 5, unitPricePaise: 532_94 })
    );
    const costed = costPurchase({ lines, discountPaise: 1_078_14, freightPaise: 500_00 });

    expect(costed.totalQty).toBe(85);
    expect(costed.grossPaise).toBe(45_299_90); // ₹45,299.90 — five paise off the real invoice's line mix
    expect(costed.taxablePaise).toBe(costed.grossPaise - 1_078_14);

    // 5% of taxable, allowing for per-line rounding across seventeen lines.
    expect(Math.abs(costed.gstPaise - Math.round(costed.taxablePaise * 0.05))).toBeLessThanOrEqual(17);

    // The two identities that matter: the invoice total, and what it cost to
    // get the stock here.
    expect(costed.invoiceTotalPaise).toBe(costed.taxablePaise + costed.gstPaise);
    expect(costed.landedTotalPaise).toBe(costed.invoiceTotalPaise + 500_00);

    // Nothing is lost between the lines and the totals.
    expect(costed.lines.reduce((a, l) => a + l.landedPaise, 0)).toBe(costed.landedTotalPaise);
    expect(costed.lines.reduce((a, l) => a + l.discountSharePaise, 0)).toBe(1_078_14);
    expect(costed.lines.reduce((a, l) => a + l.freightSharePaise, 0)).toBe(500_00);
  });

  test("refuses a discount larger than the invoice", () => {
    expect(() => costPurchase({ lines: [line()], discountPaise: 500_00 })).toThrow(PurchaseError);
  });

  test("refuses a line with no quantity rather than costing nothing", () => {
    expect(() => costPurchase({ lines: [line({ qty: 0 })] })).toThrow(PurchaseError);
  });
});

test.describe("rolling up into products", () => {
  test("colour is part of a product's identity", () => {
    expect(productKey("Short Kurthi", "Red")).not.toBe(productKey("Short Kurthi", "Brown"));
    expect(productKey("Short Kurthi", null)).toBe("Short Kurthi");
  });

  test("one product, its sizes, and a weighted cost per piece", () => {
    const costed = costPurchase({
      lines: [
        line({ item: "Short Kurthi", colour: "Red", size: "S", qty: 2, unitPricePaise: 200_00 }),
        line({ item: "Short Kurthi", colour: "Red", size: "M", qty: 3, unitPricePaise: 300_00 }),
        line({ item: "Short Kurthi", colour: "Brown", size: "S", qty: 1, unitPricePaise: 200_00 }),
      ],
    });

    const products = costingByProduct(costed);
    expect(products.map((p) => p.key)).toEqual(["Short Kurthi — Red", "Short Kurthi — Brown"]);

    const red = products[0];
    expect(red.totalQty).toBe(5);
    expect(red.sizes).toEqual([{ label: "S", qty: 2 }, { label: "M", qty: 3 }]);
    // Weighted, not the average of ₹200 and ₹300: (2×200 + 3×300) / 5 = ₹260, plus 5% GST.
    expect(red.landedPerUnitPaise).toBe(Math.round((260_00 * 1.05 * 5) / 5));
  });

  test("sizes come out in the order the rest of the app shows them", () => {
    const costed = costPurchase({
      lines: [line({ size: "XXL" }), line({ size: "S" }), line({ size: "L" }), line({ size: "M" })],
    });
    expect(costingByProduct(costed)[0].sizes.map((s) => s.label)).toEqual(["S", "M", "L", "XXL"]);
  });

  test("reads the size labels vendors actually write", () => {
    expect(normaliseSize("2XL")).toBe("XXL");
    expect(normaliseSize(" 42 ")).toBe("L");
    expect(normaliseSize("xxxl")).toBe("3XL");
    // Unrecognised is left alone, so it looks wrong on the review screen.
    expect(normaliseSize("Free Size")).toBe("FREESIZE");
  });
});

test.describe("markup bands", () => {
  test("rounds a price up to the next ₹10", () => {
    // The workbook's own example: ₹1,907 goes to ₹1,910, never ₹1,900.
    expect(roundUpTo10(1907)).toBe(1910);
    expect(roundUpTo10(1910)).toBe(1910);
    expect(roundUpTo10(1901)).toBe(1910);
  });

  test("a cost sitting exactly on a boundary belongs to the lower band", () => {
    const bands: MarkupBand[] = [
      { upToPaise: 500_00, targetPct: 100, minPct: 60 },
      { upToPaise: null, targetPct: 50, minPct: 30 },
    ];
    expect(bandFor(500_00, bands).targetPct).toBe(100);
    expect(bandFor(500_01, bands).targetPct).toBe(50);
  });

  test("prices from the band the cost falls in", () => {
    const bands: MarkupBand[] = [
      { upToPaise: 500_00, targetPct: 100, minPct: 60 },
      { upToPaise: null, targetPct: 50, minPct: 30 },
    ];
    expect(suggestPricing(200_00, bands)).toMatchObject({ price: 400, minPrice: 320 });
    expect(suggestPricing(2_000_00, bands)).toMatchObject({ price: 3000, minPrice: 2600 });
  });

  test("a piece with no recorded cost gets no price at all", () => {
    // Twenty-eight SKUs are in this state. A blank price is honest; ₹0 is not.
    expect(suggestPricing(0, DEFAULT_BANDS)).toBeNull();
    expect(suggestPricing(-1, DEFAULT_BANDS)).toBeNull();
  });

  test("the defaults change nobody's price on their own", () => {
    expect(DEFAULT_BANDS.every((b) => b.targetPct === 50 && b.minPct === 30)).toBe(true);
    expect(DEFAULT_BANDS[DEFAULT_BANDS.length - 1].upToPaise).toBeNull();
  });

  test("refuses a set of bands that would leave a cost unpriced", () => {
    const openInMiddle: MarkupBand[] = [
      { upToPaise: null, targetPct: 50, minPct: 30 },
      { upToPaise: null, targetPct: 50, minPct: 30 },
    ];
    expect(validateBands(openInMiddle).some((p) => p.message.includes("last band"))).toBe(true);

    const closedAtTop: MarkupBand[] = [{ upToPaise: 500_00, targetPct: 50, minPct: 30 }];
    expect(validateBands(closedAtTop).some((p) => p.message.includes("no upper limit"))).toBe(true);

    const descending: MarkupBand[] = [
      { upToPaise: 1000_00, targetPct: 50, minPct: 30 },
      { upToPaise: 500_00, targetPct: 50, minPct: 30 },
      { upToPaise: null, targetPct: 50, minPct: 30 },
    ];
    expect(validateBands(descending).some((p) => p.message.includes("above the one before"))).toBe(true);
  });

  test("refuses a floor above its own price", () => {
    const bands: MarkupBand[] = [{ upToPaise: null, targetPct: 30, minPct: 50 }];
    expect(validateBands(bands).some((p) => p.message.includes("floor would sit above"))).toBe(true);
  });

  test("valid bands pass", () => {
    expect(validateBands(DEFAULT_BANDS)).toEqual([]);
  });

  test("shows what she is already charging in each band", () => {
    const bands: MarkupBand[] = [
      { upToPaise: 500_00, targetPct: 50, minPct: 30 },
      { upToPaise: null, targetPct: 50, minPct: 30 },
    ];
    const usage = bandUsage(bands, [
      { price: 400, landedCost: 200 }, // 100% markup, under ₹500
      { price: 600, landedCost: 300 }, // 100% markup, under ₹500
      { price: 1500, landedCost: 1000 }, // 50% markup, above
      { price: 900, landedCost: null }, // no cost — counted nowhere
    ]);

    expect(usage[0].products).toBe(2);
    expect(usage[0].medianMarkupPct).toBe(100);
    // Both would drop to a 50% markup if the band were applied as it stands.
    expect(usage[0].wouldChange).toBe(2);

    expect(usage[1].products).toBe(1);
    expect(usage[1].medianMarkupPct).toBe(50);
    expect(usage[1].wouldChange).toBe(0);
  });
});

test.describe("reading the invoice block", () => {
  // Built from an object rather than patched as text: a string replace that
  // silently matches nothing gives a test that passes for the wrong reason.
  type Patch = { vendor?: object; invoice?: object; line?: object };
  function briefJson({ vendor, invoice, line: lineOver }: Patch = {}): string {
    return JSON.stringify({
      vendor: { name: "G.D. Fabrics", city: "Jaipur", state: "Rajasthan", gstin: "08ABXPA3166H1ZF", type: "Manufacturer", ...vendor },
      invoice: { number: "GD707", date: "2026-09-07", freight: "₹500", discount: "1,078.14", paymentMode: "UPI", ...invoice },
      totals: { gross: 45300, taxable: 44221.86, gst: 2211.09, grandTotal: 46432.95 },
      lines: [
        { item: "Short Kurthi", colour: "Red", size: "42", qty: 1, unitPrice: "532.94", gstRatePct: 5, category: "Casual Wear", ...lineOver },
      ],
    });
  }

  test("reads rupees the way an invoice writes them", () => {
    const r = parseInvoiceBrief(briefJson());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.brief.invoice.freightPaise).toBe(500_00);
    expect(r.brief.invoice.discountPaise).toBe(1_078_14);
    expect(r.brief.lines[0].unitPricePaise).toBe(532_94);
    expect(r.brief.lines[0].size).toBe("L");
    // PAN falls out of the GSTIN, as it did in the workbook.
    expect(r.brief.vendor.pan).toBe("ABXPA3166H");
  });

  test("refuses an ambiguous date rather than guessing the month", () => {
    const r = parseInvoiceBrief(briefJson({ invoice: { date: "07-09-2026" } }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes("YYYY-MM-DD"))).toBe(true);
  });

  test("an empty amount is an error, not a zero", () => {
    const r = parseInvoiceBrief(briefJson({ line: { unitPrice: "" } }));
    expect(r.ok).toBe(false);
  });

  test("reports every problem at once", () => {
    const bad = JSON.stringify({
      vendor: {},
      invoice: { number: "", date: "nope" },
      lines: [{ item: "", size: "", qty: 0, unitPrice: "abc" }],
    });
    const r = parseInvoiceBrief(bad);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.length).toBeGreaterThanOrEqual(6);
  });

  test("warns about a GSTIN that doesn't look like one", () => {
    const r = parseInvoiceBrief(briefJson({ vendor: { gstin: "NOT-A-GSTIN" } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.some((w) => w.includes("GSTIN"))).toBe(true);
  });

  test("flags only the totals that actually disagree", () => {
    const stated = { grossPaise: 100_00, taxablePaise: 90_00, gstPaise: 4_50, grandTotalPaise: 94_50 };
    const clean = reconcile(stated, { grossPaise: 100_00, taxablePaise: 90_00, gstPaise: 4_50, invoiceTotalPaise: 94_50 });
    expect(clean).toEqual([]);

    const off = reconcile(stated, { grossPaise: 100_00, taxablePaise: 90_00, gstPaise: 4_51, invoiceTotalPaise: 94_51 });
    expect(off.map((d) => d.label)).toEqual(["GST", "Invoice total"]);
    expect(off[0].differencePaise).toBe(1);
  });

  test("a missing total is simply not checked", () => {
    expect(reconcile({ grossPaise: null, taxablePaise: null, gstPaise: null, grandTotalPaise: null }, {
      grossPaise: 1, taxablePaise: 1, gstPaise: 1, invoiceTotalPaise: 1,
    })).toEqual([]);
  });

  test("parseRupees rejects what isn't money", () => {
    const errors: string[] = [];
    expect(parseRupees("12.345", "x", errors)).toBeNull();
    expect(parseRupees("abc", "x", errors)).toBeNull();
    expect(errors.length).toBe(2);
  });
});

test.describe("what may be filed against a purchase", () => {
  const ok = { name: "GD707.pdf", type: "application/pdf", size: 400_000 };

  test("accepts what a vendor's paperwork actually arrives as", () => {
    for (const type of ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(checkUpload({ ...ok, type }), type).toBeNull();
    }
  });

  test("refuses anything else, and names what is allowed", () => {
    const problem = checkUpload({ ...ok, name: "notes.txt", type: "text/plain" });
    expect(problem?.message).toContain("notes.txt");
    expect(problem?.message).toContain("PDF");
  });

  test("refuses an empty file, which is a failed scan rather than a document", () => {
    expect(checkUpload({ ...ok, size: 0 })?.message).toContain("empty");
  });

  test("refuses one over the limit, and says what to do about it", () => {
    const problem = checkUpload({ ...ok, size: MAX_BYTES + 1 });
    expect(problem?.message).toContain("10.0 MB");
    expect(problem?.message).toContain("lower resolution");
  });

  test("HEIC is accepted but not previewed — iPhones make it, browsers can't show it", () => {
    expect(checkUpload({ ...ok, type: "image/heic" })).toBeNull();
    expect(canPreview("image/heic")).toBe(false);
    expect(canPreview("application/pdf")).toBe(true);
  });

  test("a filename cannot carry a path or break a header", () => {
    expect(safeFilename("../../etc/passwd")).toBe(".. .. etc passwd");
    expect(safeFilename('bad"name.pdf')).toBe("badname.pdf");
    expect(safeFilename("line\nbreak.pdf")).toBe("linebreak.pdf");
    expect(safeFilename("   ")).toBe("document");
    expect(safeFilename(null)).toBe("document");
  });

  test("sizes read the way a person would say them", () => {
    expect(humanSize(900)).toBe("900 B");
    expect(humanSize(2048)).toBe("2 KB");
    expect(humanSize(3_500_000)).toBe("3.3 MB");
  });

  test("only the listed kinds of document", () => {
    expect(isDocumentKind("Invoice")).toBe(true);
    expect(isDocumentKind("Transport bill")).toBe(true);
    expect(isDocumentKind("Something else")).toBe(false);
  });
});
