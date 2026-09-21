// Reading an invoice that has already been read.
//
// A vendor invoice arrives as a PDF or a photograph of a piece of paper. That
// gets turned into the block of JSON this file parses — outside the app,
// deliberately. Optical character recognition on a phone photo of a Jaipur
// wholesaler's invoice is the least reliable step in the whole chain, and the
// right place for it is somewhere a person is already reading the result,
// not inside a save button.
//
// So the app's job is the part that can be done exactly: check the block,
// convert rupees to paise, and lay out precisely what will be created before
// anything is. Everything here returns its problems as a list rather than
// throwing on the first one — someone retyping a forty-line invoice should see
// all four mistakes at once, not one per attempt.

import type { PurchaseLineInput } from "@/lib/purchasing";
import { normaliseSize } from "@/lib/purchasing";

export type BriefVendor = {
  name: string;
  businessName?: string | null;
  city?: string | null;
  state?: string | null;
  gstin?: string | null;
  pan?: string | null;
  type?: string | null;
  phone?: string | null;
};

export type BriefLine = PurchaseLineInput & {
  /** Website category for a product this invoice creates. Ignored for one that exists. */
  category?: string | null;
  fabric?: string | null;
};

export type InvoiceBrief = {
  vendor: BriefVendor;
  invoice: {
    number: string;
    date: string;
    freightPaise: number;
    discountPaise: number;
    otherChargesPaise: number;
    paymentMode: string | null;
    notes: string | null;
  };
  /** What the invoice itself prints, where it was legible. Used only to check our arithmetic. */
  statedTotals: {
    grossPaise: number | null;
    taxablePaise: number | null;
    gstPaise: number | null;
    grandTotalPaise: number | null;
  };
  lines: BriefLine[];
};

export type ParseResult =
  | { ok: true; brief: InvoiceBrief; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Rupees to paise.
 *
 * Accepts what an invoice actually looks like — `1,078.14`, `₹500`, `500.00`,
 * or a plain number. Rejects anything else rather than coercing it, because
 * `Number("")` is 0 and a silently-zero freight charge is a cost that vanishes.
 */
export function parseRupees(raw: unknown, field: string, errors: string[], required = true): number | null {
  if (raw == null || raw === "") {
    if (required) errors.push(`${field}: missing.`);
    return required ? null : 0;
  }
  const text = String(raw).replace(/[₹,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    errors.push(`${field}: "${raw}" is not an amount.`);
    return null;
  }
  return Math.round(parseFloat(text) * 100);
}

function parseDate(raw: unknown, field: string, errors: string[]): string | null {
  const text = String(raw ?? "").trim();
  // ISO only. A date like 07-09-2026 is 7 September in India and 9 July in
  // America, and an invoice misfiled by two months is a quiet, expensive
  // mistake — so the ambiguous forms are refused rather than guessed.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    errors.push(`${field}: needs to be YYYY-MM-DD, not "${raw}".`);
    return null;
  }
  const d = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== text) {
    errors.push(`${field}: "${text}" is not a real date.`);
    return null;
  }
  return text;
}

function str(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s === "" ? null : s;
}

export function parseInvoiceBrief(json: string): ParseResult {
  let root: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
      return { ok: false, errors: ["That isn't an invoice block — expected a JSON object."] };
    }
    root = parsed as Record<string, unknown>;
  } catch (e) {
    return { ok: false, errors: [`That isn't valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const v = (root.vendor ?? {}) as Record<string, unknown>;
  const vendorName = str(v.name);
  if (!vendorName) errors.push("Vendor: no name.");
  const gstin = str(v.gstin);
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    warnings.push(`Vendor GSTIN "${gstin}" doesn't look like a GSTIN — check it against the invoice.`);
  }

  const inv = (root.invoice ?? {}) as Record<string, unknown>;
  const number = str(inv.number);
  if (!number) errors.push("Invoice: no number.");
  const date = parseDate(inv.date, "Invoice date", errors);
  const freightPaise = parseRupees(inv.freight, "Freight", errors, false) ?? 0;
  const discountPaise = parseRupees(inv.discount, "Discount", errors, false) ?? 0;
  const otherChargesPaise = parseRupees(inv.otherCharges, "Other charges", errors, false) ?? 0;

  const rawLines = root.lines;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    errors.push("Lines: the invoice has none.");
  }

  const lines: BriefLine[] = [];
  if (Array.isArray(rawLines)) {
    rawLines.forEach((raw, i) => {
      const l = (raw ?? {}) as Record<string, unknown>;
      const where = `Line ${i + 1}`;
      const item = str(l.item);
      const size = str(l.size);
      if (!item) errors.push(`${where}: no item name.`);
      if (!size) errors.push(`${where}: no size.`);

      const qtyRaw = l.qty;
      const qty = typeof qtyRaw === "number" ? qtyRaw : Number(String(qtyRaw ?? "").trim());
      if (!Number.isInteger(qty) || qty <= 0) errors.push(`${where}: quantity "${qtyRaw}" must be a whole number above zero.`);

      const unitPricePaise = parseRupees(l.unitPrice, `${where} unit price`, errors);

      let gstRatePct = 5;
      if (l.gstRatePct == null) {
        warnings.push(`${where}: no GST rate given — assuming 5%, which is the apparel rate under ₹2,500.`);
      } else {
        const r = Number(l.gstRatePct);
        if (!Number.isFinite(r) || r < 0 || r > 100) errors.push(`${where}: GST rate "${l.gstRatePct}" is not a percentage.`);
        else gstRatePct = r;
      }

      const normalised = size ? normaliseSize(size) : "";
      if (size && normalised !== size.trim().toUpperCase().replace(/\s+/g, "")) {
        warnings.push(`${where}: size "${size}" read as ${normalised}.`);
      }

      if (item && size && Number.isInteger(qty) && qty > 0 && unitPricePaise != null) {
        lines.push({
          item,
          colour: str(l.colour),
          size: normalised,
          qty,
          unitPricePaise,
          gstRatePct,
          category: str(l.category),
          fabric: str(l.fabric),
        });
      }
    });
  }

  const t = (root.totals ?? {}) as Record<string, unknown>;
  const statedTotals = {
    grossPaise: parseRupees(t.gross, "Stated gross", errors, false),
    taxablePaise: parseRupees(t.taxable, "Stated taxable", errors, false),
    gstPaise: parseRupees(t.gst, "Stated GST", errors, false),
    grandTotalPaise: parseRupees(t.grandTotal, "Stated grand total", errors, false),
  };

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    warnings,
    brief: {
      vendor: {
        name: vendorName!,
        businessName: str(v.businessName),
        city: str(v.city),
        state: str(v.state),
        gstin,
        pan: str(v.pan) ?? (gstin ? gstin.slice(2, 12) : null),
        type: str(v.type),
        phone: str(v.phone),
      },
      invoice: {
        number: number!,
        date: date!,
        freightPaise,
        discountPaise,
        otherChargesPaise,
        paymentMode: str(inv.paymentMode),
        notes: str(inv.notes),
      },
      statedTotals,
      lines,
    },
  };
}

export type Discrepancy = { label: string; statedPaise: number; computedPaise: number; differencePaise: number };

/**
 * Where our arithmetic and the printed invoice disagree.
 *
 * Almost always a rupee or two of the vendor's own rounding, which is worth
 * seeing and not worth blocking on — the workbook books exactly this sort of
 * difference into an "Other Charges" cell with a note. A difference of more
 * than a few rupees means something was read wrong off the paper.
 */
export function reconcile(
  stated: InvoiceBrief["statedTotals"],
  computed: { grossPaise: number; taxablePaise: number; gstPaise: number; invoiceTotalPaise: number }
): Discrepancy[] {
  const pairs: [string, number | null, number][] = [
    ["Gross", stated.grossPaise, computed.grossPaise],
    ["Taxable", stated.taxablePaise, computed.taxablePaise],
    ["GST", stated.gstPaise, computed.gstPaise],
    ["Invoice total", stated.grandTotalPaise, computed.invoiceTotalPaise],
  ];

  return pairs
    .filter((p): p is [string, number, number] => p[1] != null)
    .map(([label, statedPaise, computedPaise]) => ({
      label,
      statedPaise,
      computedPaise,
      differencePaise: computedPaise - statedPaise,
    }))
    .filter((d) => d.differencePaise !== 0);
}
