// The figures an accountant asks for, worked out from this database.
//
// The workbook could produce a GST summary and something resembling a profit
// statement; nothing here could, so the spreadsheet stayed in use for that one
// reason long after everything else had moved. This is that reason removed.
//
// Everything in this file is a pure function over plain rows. No database, no
// spreadsheet library, no formatting. That is deliberate: these are the numbers
// somebody files a return on, and a number that can only be checked by opening
// Excel and reading a cell is a number nobody checks.
//
// Amounts are integer paise throughout and are only divided by a hundred at
// the very edge, where they are written into a cell.

import { STOCK_PURCHASE, gstPortionPaise } from "./money";

// ------------------------------------------------------------------- Period

/** An inclusive range of whole days, as YYYY-MM-DD. */
export type Period = { from: string; to: string };

/**
 * The Indian financial year containing a date: 1 April to 31 March.
 *
 * Not the calendar year, which is what a naive "this year" would give and
 * which matches nothing anybody files.
 */
export function financialYearOf(date: Date): Period {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return { from: `${year}-04-01`, to: `${year + 1}-03-31` };
}

/** "2026-27", the way a financial year is written on a return. */
export function financialYearLabel(period: Period): string {
  const startYear = Number(period.from.slice(0, 4));
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export type MonthColumn = { key: string; label: string };

/**
 * One column per month the period touches, oldest first.
 *
 * A month with no trade is a zero column rather than a missing one. A gap in a
 * row of months reads as "we don't have that data"; a zero reads as "nothing
 * happened", and those are very different things to hand an accountant.
 */
export function monthsIn(period: Period): MonthColumn[] {
  const out: MonthColumn[] = [];
  const [fy, fm] = period.from.split("-").map(Number);
  const [ty, tm] = period.to.split("-").map(Number);
  let y = fy;
  let m = fm;
  // Guarded rather than while(true): a reversed period would otherwise spin.
  for (let i = 0; i < 240 && (y < ty || (y === ty && m <= tm)); i++) {
    out.push({
      key: `${y}-${String(m).padStart(2, "0")}`,
      label: new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    });
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function inPeriod(day: string, period: Period): boolean {
  // String comparison is safe and exact for YYYY-MM-DD, and avoids the
  // timezone question entirely — which matters, because a Date built from a
  // date-only string is midnight UTC and lands in the previous day in India.
  return day >= period.from && day <= period.to;
}

/** The YYYY-MM-DD a timestamp falls on **in India**, not in UTC. */
export function istDay(at: Date): string {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

// --------------------------------------------------------------------- GST

/**
 * How much GST is inside a garment's selling price.
 *
 * India taxes readymade garments by the price of one piece: 5% up to ₹2,500,
 * 18% above it, since 22 September 2025 (it was ₹1,000 and 5%/12% before
 * that). Kept as data rather than buried in an `if`, because rates change and
 * the change should be one edit in one place.
 *
 * `asOf` exists so a return for an earlier period is computed at the rate that
 * applied then. Recomputing history at today's rate is how a filed figure
 * stops matching the return that was filed.
 */
export const GARMENT_GST_SLABS = [
  { from: "2025-09-22", threshold: 2_500, lowPct: 5, highPct: 18 },
  { from: "2017-07-01", threshold: 1_000, lowPct: 5, highPct: 12 },
] as const;

export function garmentGstPct(unitPriceRupees: number, asOf: string): number {
  const slab = GARMENT_GST_SLABS.find((s) => asOf >= s.from) ?? GARMENT_GST_SLABS[GARMENT_GST_SLABS.length - 1];
  return unitPriceRupees <= slab.threshold ? slab.lowPct : slab.highPct;
}

/**
 * The tax inside a GST-inclusive amount.
 *
 * A retail price on a shop's website includes GST — the customer pays ₹1,490,
 * not ₹1,490 plus tax. So the tax is extracted, never added. Getting this
 * backwards overstates both revenue and the tax owed.
 */
export function taxInsidePaise(inclusivePaise: number, ratePct: number): number {
  if (ratePct <= 0) return 0;
  return Math.round(inclusivePaise - inclusivePaise / (1 + ratePct / 100));
}

// ------------------------------------------------------------- Input rows

export type SaleLine = {
  productName: string;
  sku: string | null;
  size: string;
  qty: number;
  /** Per piece, whole rupees — the figure the slab is decided on. */
  pricePaise: number;
  landedCostAtSalePaise: number | null;
};

export type SaleOrder = {
  orderNumber: string;
  /** When it was placed, as an Indian calendar day. */
  day: string;
  paymentStatus: string;
  status: string;
  /** Listed total, paise. */
  totalPaise: number;
  /** What an admin confirmed was actually settled, where they did. */
  actualSalePricePaise: number | null;
  discountPaise: number;
  refundedPaise: number;
  channel: string;
  lines: SaleLine[];
};

export type ExpenseEntry = {
  day: string;
  category: string;
  description: string;
  payee: string | null;
  amountPaise: number;
  gstRateBp: number | null;
};

export type CapitalEntry = { day: string; contributor: string; amountPaise: number };

export type PurchaseEntry = {
  ref: string;
  day: string;
  vendorName: string;
  vendorGstin: string | null;
  invoiceNumber: string;
  taxablePaise: number;
  gstPaise: number;
  freightPaise: number;
  landedTotalPaise: number;
  qty: number;
};

// ------------------------------------------------------------ What is a sale

const NOT_A_SALE = new Set(["CANCELLED", "RETURNED"]);

/**
 * Whether an order belongs in the accounts.
 *
 * Paid, and not cancelled or returned. A refunded order fails on both counts
 * by the time the refund webhook has run — its payment reads REFUNDED and its
 * status CANCELLED — so a refund removes the sale from the period rather than
 * leaving revenue that was handed back.
 */
export function countsAsSale(o: { paymentStatus: string; status: string }): boolean {
  return o.paymentStatus === "PAID" && !NOT_A_SALE.has(o.status);
}

/** What was actually taken for an order. */
export function saleValuePaise(o: SaleOrder): number {
  // A figure an admin confirmed beats the listed total: an in-person sale may
  // have been settled at a price agreed at the door.
  return o.actualSalePricePaise ?? o.totalPaise;
}

// ---------------------------------------------------------------- The report

export type PnL = {
  months: MonthColumn[];
  /** Per month, then the total. */
  revenuePaise: number[];
  cogsPaise: number[];
  grossProfitPaise: number[];
  runningByCategory: { category: string; paise: number[] }[];
  runningTotalPaise: number[];
  netProfitPaise: number[];
  totals: {
    revenuePaise: number;
    cogsPaise: number;
    grossProfitPaise: number;
    runningPaise: number;
    netProfitPaise: number;
  };
  /**
   * True where a sold piece had no recorded cost. Profit is then overstated,
   * and saying so beside the number is the difference between a report and a
   * guess.
   */
  cogsIncomplete: boolean;
  /** How many sold pieces had no cost, so the size of the gap is visible. */
  piecesWithoutCost: number;
};

export type GstSalesRow = {
  orderNumber: string;
  day: string;
  productName: string;
  sku: string;
  qty: number;
  unitPriceRupees: number;
  ratePct: number;
  inclusivePaise: number;
  taxablePaise: number;
  taxPaise: number;
};

export type GstReport = {
  sales: GstSalesRow[];
  salesTaxablePaise: number;
  salesTaxPaise: number;
  /** Output tax split by rate, which is how a return is laid out. */
  salesByRate: { ratePct: number; taxablePaise: number; taxPaise: number }[];

  purchases: PurchaseEntry[];
  purchaseTaxablePaise: number;
  purchaseTaxPaise: number;

  /** Input tax inside running costs, where a rate was recorded. */
  expenseTaxPaise: number;
  expensesWithoutRate: number;

  /** Output tax less all input tax. Negative means credit carried forward. */
  netPayablePaise: number;
};

export type CashFlow = {
  months: MonthColumn[];
  capitalPaise: number[];
  salesReceiptsPaise: number[];
  stockPaidPaise: number[];
  runningPaidPaise: number[];
  netMovementPaise: number[];
  /** Running balance, starting from zero at the beginning of the period. */
  closingPaise: number[];
  totals: {
    capitalPaise: number;
    salesReceiptsPaise: number;
    stockPaidPaise: number;
    runningPaidPaise: number;
    netMovementPaise: number;
  };
};

export type FinancialReport = {
  period: Period;
  pnl: PnL;
  gst: GstReport;
  cash: CashFlow;
  /** Sales that fell in the period, for the detail sheet. */
  sales: SaleOrder[];
  notes: string[];
};

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

export function buildFinancialReport(input: {
  period: Period;
  orders: SaleOrder[];
  expenses: ExpenseEntry[];
  capital: CapitalEntry[];
  purchases: PurchaseEntry[];
}): FinancialReport {
  const { period } = input;
  const months = monthsIn(period);
  const index = new Map(months.map((m, i) => [m.key, i]));
  const n = months.length;

  const sales = input.orders.filter((o) => countsAsSale(o) && inPeriod(o.day, period));
  const expenses = input.expenses.filter((e) => inPeriod(e.day, period));
  const capital = input.capital.filter((c) => inPeriod(c.day, period));
  const purchases = input.purchases.filter((p) => inPeriod(p.day, period));

  // ------------------------------------------------------------------ P&L
  const revenuePaise = zeros(n);
  const cogsPaise = zeros(n);
  let cogsIncomplete = false;
  let piecesWithoutCost = 0;

  for (const order of sales) {
    const i = index.get(order.day.slice(0, 7));
    if (i === undefined) continue;
    revenuePaise[i] += saleValuePaise(order);
    for (const line of order.lines) {
      if (line.landedCostAtSalePaise == null || line.landedCostAtSalePaise <= 0) {
        // Counting an unknown cost as zero would show the whole sale as
        // profit. Flagged and counted instead, so the report says how much of
        // it is unreliable.
        cogsIncomplete = true;
        piecesWithoutCost += line.qty;
        continue;
      }
      cogsPaise[i] += line.landedCostAtSalePaise * line.qty;
    }
  }

  const runningMap = new Map<string, number[]>();
  for (const e of expenses) {
    if (e.category === STOCK_PURCHASE) continue; // stock is cost of goods, not an overhead
    const i = index.get(e.day.slice(0, 7));
    if (i === undefined) continue;
    const row = runningMap.get(e.category) ?? zeros(n);
    row[i] += e.amountPaise;
    runningMap.set(e.category, row);
  }

  const runningByCategory = [...runningMap.entries()]
    .map(([category, paise]) => ({ category, paise }))
    .sort((a, b) => sum(b.paise) - sum(a.paise));

  const runningTotalPaise = zeros(n);
  for (const row of runningByCategory) {
    for (let i = 0; i < n; i++) runningTotalPaise[i] += row.paise[i];
  }

  const grossProfitPaise = revenuePaise.map((r, i) => r - cogsPaise[i]);
  const netProfitPaise = grossProfitPaise.map((g, i) => g - runningTotalPaise[i]);

  const pnl: PnL = {
    months,
    revenuePaise,
    cogsPaise,
    grossProfitPaise,
    runningByCategory,
    runningTotalPaise,
    netProfitPaise,
    totals: {
      revenuePaise: sum(revenuePaise),
      cogsPaise: sum(cogsPaise),
      grossProfitPaise: sum(grossProfitPaise),
      runningPaise: sum(runningTotalPaise),
      netProfitPaise: sum(netProfitPaise),
    },
    cogsIncomplete,
    piecesWithoutCost,
  };

  // ------------------------------------------------------------------ GST
  const gstSales: GstSalesRow[] = [];
  const byRate = new Map<number, { taxablePaise: number; taxPaise: number }>();

  for (const order of sales) {
    // A discount applies to the order, not to a line, so each line's share of
    // the taxable value is reduced in proportion. Taxing the pre-discount
    // price would mean paying tax on money nobody paid.
    const linesTotal = order.lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
    for (const line of order.lines) {
      const gross = line.pricePaise * line.qty;
      const share = linesTotal > 0 ? gross / linesTotal : 0;
      const inclusive = Math.round(gross - order.discountPaise * share);
      const unitPriceRupees = Math.round(line.pricePaise / 100);
      const ratePct = garmentGstPct(unitPriceRupees, order.day);
      const taxPaise = taxInsidePaise(inclusive, ratePct);
      const taxablePaise = inclusive - taxPaise;

      gstSales.push({
        orderNumber: order.orderNumber,
        day: order.day,
        productName: line.productName,
        sku: line.sku ?? "",
        qty: line.qty,
        unitPriceRupees,
        ratePct,
        inclusivePaise: inclusive,
        taxablePaise,
        taxPaise,
      });

      const bucket = byRate.get(ratePct) ?? { taxablePaise: 0, taxPaise: 0 };
      bucket.taxablePaise += taxablePaise;
      bucket.taxPaise += taxPaise;
      byRate.set(ratePct, bucket);
    }
  }

  let expenseTaxPaise = 0;
  let expensesWithoutRate = 0;
  for (const e of expenses) {
    if (e.category === STOCK_PURCHASE) continue; // its GST is on the purchase invoice
    const portion = gstPortionPaise(e.amountPaise, e.gstRateBp);
    if (portion == null) {
      expensesWithoutRate += 1;
      continue;
    }
    expenseTaxPaise += portion;
  }

  const salesTaxPaise = gstSales.reduce((s, r) => s + r.taxPaise, 0);
  const purchaseTaxPaise = purchases.reduce((s, p) => s + p.gstPaise, 0);

  const gst: GstReport = {
    sales: gstSales,
    salesTaxablePaise: gstSales.reduce((s, r) => s + r.taxablePaise, 0),
    salesTaxPaise,
    salesByRate: [...byRate.entries()]
      .map(([ratePct, v]) => ({ ratePct, ...v }))
      .sort((a, b) => a.ratePct - b.ratePct),
    purchases,
    purchaseTaxablePaise: purchases.reduce((s, p) => s + p.taxablePaise, 0),
    purchaseTaxPaise,
    expenseTaxPaise,
    expensesWithoutRate,
    netPayablePaise: salesTaxPaise - purchaseTaxPaise - expenseTaxPaise,
  };

  // ------------------------------------------------------------ Cash flow
  const capitalPaise = zeros(n);
  const salesReceiptsPaise = zeros(n);
  const stockPaidPaise = zeros(n);
  const runningPaidPaise = zeros(n);

  for (const c of capital) {
    const i = index.get(c.day.slice(0, 7));
    if (i !== undefined) capitalPaise[i] += c.amountPaise;
  }
  for (const o of sales) {
    const i = index.get(o.day.slice(0, 7));
    // Money actually kept: a refund handed part of it back, and a cash-flow
    // statement that ignores refunds shows money the bank does not have.
    if (i !== undefined) salesReceiptsPaise[i] += saleValuePaise(o) - o.refundedPaise;
  }
  for (const e of expenses) {
    const i = index.get(e.day.slice(0, 7));
    if (i === undefined) continue;
    if (e.category === STOCK_PURCHASE) stockPaidPaise[i] += e.amountPaise;
    else runningPaidPaise[i] += e.amountPaise;
  }

  const netMovementPaise = capitalPaise.map(
    (c, i) => c + salesReceiptsPaise[i] - stockPaidPaise[i] - runningPaidPaise[i]
  );
  const closingPaise: number[] = [];
  let running = 0;
  for (const move of netMovementPaise) {
    running += move;
    closingPaise.push(running);
  }

  const cash: CashFlow = {
    months,
    capitalPaise,
    salesReceiptsPaise,
    stockPaidPaise,
    runningPaidPaise,
    netMovementPaise,
    closingPaise,
    totals: {
      capitalPaise: sum(capitalPaise),
      salesReceiptsPaise: sum(salesReceiptsPaise),
      stockPaidPaise: sum(stockPaidPaise),
      runningPaidPaise: sum(runningPaidPaise),
      netMovementPaise: sum(netMovementPaise),
    },
  };

  // --------------------------------------------------------------- Caveats
  //
  // Written into the workbook itself rather than said once in a chat. Whoever
  // opens this file in March will not have been in the conversation.
  const notes: string[] = [];
  notes.push(
    "Selling prices are treated as GST-inclusive: the tax is taken out of the price, not added to it."
  );
  notes.push(
    "Garment GST is decided per piece — 5% up to ₹2,500, 18% above, the rates in force from 22 September 2025. " +
      "Sales before that date use the older ₹1,000 threshold at 5% / 12%."
  );
  if (pnl.cogsIncomplete) {
    notes.push(
      `${piecesWithoutCost} sold piece${piecesWithoutCost === 1 ? "" : "s"} had no recorded cost, so cost of goods ` +
        "is understated and profit is overstated by that much. Fill in the landed cost on those products."
    );
  }
  if (gst.expensesWithoutRate > 0) {
    notes.push(
      `${gst.expensesWithoutRate} running cost${gst.expensesWithoutRate === 1 ? " has" : "s have"} no GST rate ` +
        "recorded, so no input credit is claimed on them here."
    );
  }
  notes.push(
    "Cash flow opens at zero on the first day of the period — it shows movement within the period, not a bank balance."
  );
  notes.push("This is a working paper for your accountant, not a filed return.");

  return { period, pnl, gst, cash, sales, notes };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
