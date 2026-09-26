// The figures somebody files a return on.
//
// This is the most consequential arithmetic in the app. Every other number can
// be corrected by looking at the screen again; these get copied onto a form and
// sent to the tax department. So the tests here are less about the happy path
// than about the specific ways a financial report goes quietly wrong: a
// hundredfold unit error, a sale landing in the wrong financial year, tax added
// where it should have been extracted, and a refund still counted as revenue.

import { test, expect } from "@playwright/test";
import {
  buildFinancialReport,
  financialYearOf,
  financialYearLabel,
  monthsIn,
  garmentGstPct,
  taxInsidePaise,
  istDay,
  countsAsSale,
  type SaleOrder,
} from "@/lib/financial-report";

// ------------------------------------------------------------------ Periods

test("the financial year runs April to March, not January to December", () => {
  // The calendar year is what a naive "this year" gives and it matches nothing
  // anybody files.
  expect(financialYearOf(new Date(2026, 8, 25))).toEqual({ from: "2026-04-01", to: "2027-03-31" });
  // March still belongs to the year that began the previous April.
  expect(financialYearOf(new Date(2026, 2, 31))).toEqual({ from: "2025-04-01", to: "2026-03-31" });
  // The first day of April flips it.
  expect(financialYearOf(new Date(2026, 3, 1))).toEqual({ from: "2026-04-01", to: "2027-03-31" });
});

test("a financial year is labelled the way it is written on a return", () => {
  expect(financialYearLabel({ from: "2026-04-01", to: "2027-03-31" })).toBe("2026-27");
  // The century rollover must not produce "2099-100".
  expect(financialYearLabel({ from: "2099-04-01", to: "2100-03-31" })).toBe("2099-00");
});

test("a financial year is twelve columns, and they cross the year boundary in order", () => {
  const months = monthsIn({ from: "2026-04-01", to: "2027-03-31" });
  expect(months).toHaveLength(12);
  expect(months[0].key).toBe("2026-04");
  expect(months[8].key).toBe("2026-12");
  expect(months[9].key).toBe("2027-01");
  expect(months[11].key).toBe("2027-03");
});

test("a reversed period produces nothing rather than spinning forever", () => {
  expect(monthsIn({ from: "2027-03-31", to: "2026-04-01" })).toEqual([]);
});

// ------------------------------------------------------------------- Days

test("a late-night sale is dated by the Indian day, not the UTC one", () => {
  // 2am on 1 April in India is 20:30 on 31 March in UTC. Dating it by UTC puts
  // the sale in the previous financial year, and then the return does not tie.
  expect(istDay(new Date("2026-03-31T20:30:00Z"))).toBe("2026-04-01");
  // And the ordinary case still reads as the same day.
  expect(istDay(new Date("2026-09-25T06:00:00Z"))).toBe("2026-09-25");
});

// -------------------------------------------------------------------- GST

test("garment GST is decided per piece, at the rate in force on the day", () => {
  // From 22 September 2025: 5% up to ₹2,500 a piece, 18% above.
  expect(garmentGstPct(1_490, "2026-06-01")).toBe(5);
  expect(garmentGstPct(2_500, "2026-06-01")).toBe(5);
  expect(garmentGstPct(2_501, "2026-06-01")).toBe(18);

  // Before that date the threshold was ₹1,000 and the upper rate 12%. A return
  // for an earlier period has to be computed at the rate that applied then —
  // recomputing history at today's rate is how a filed figure stops matching.
  expect(garmentGstPct(1_490, "2025-06-01")).toBe(12);
  expect(garmentGstPct(900, "2025-06-01")).toBe(5);
});

test("tax is taken out of the price, never added to it", () => {
  // A retail price on a website includes GST: the customer pays ₹1,050, not
  // ₹1,050 plus tax. Adding instead of extracting overstates both the revenue
  // and the tax owed.
  expect(taxInsidePaise(105_000, 5)).toBe(5_000);
  expect(taxInsidePaise(118_000, 18)).toBe(18_000);
  expect(taxInsidePaise(105_000, 0)).toBe(0);
});

// ------------------------------------------------------- What counts as a sale

test("only paid, uncancelled orders are sales", () => {
  expect(countsAsSale({ paymentStatus: "PAID", status: "CONFIRMED" })).toBe(true);
  expect(countsAsSale({ paymentStatus: "PENDING", status: "PLACED" })).toBe(false);
  expect(countsAsSale({ paymentStatus: "PAID", status: "CANCELLED" })).toBe(false);
  expect(countsAsSale({ paymentStatus: "PAID", status: "RETURNED" })).toBe(false);
  // A refund sets both of these, so it removes the sale from the accounts
  // rather than leaving revenue that was handed back.
  expect(countsAsSale({ paymentStatus: "REFUNDED", status: "CANCELLED" })).toBe(false);
});

// ------------------------------------------------------------- The report

const PERIOD = { from: "2026-04-01", to: "2027-03-31" };

function order(over: Partial<SaleOrder> = {}): SaleOrder {
  return {
    orderNumber: "URVI-2026-00001",
    day: "2026-04-15",
    paymentStatus: "PAID",
    status: "CONFIRMED",
    totalPaise: 200_000, // ₹2,000
    actualSalePricePaise: null,
    discountPaise: 0,
    refundedPaise: 0,
    channel: "online",
    lines: [
      {
        productName: "Kurti",
        sku: "URVI-0001",
        size: "M",
        qty: 1,
        pricePaise: 200_000,
        landedCostAtSalePaise: 80_000, // ₹800
      },
    ],
    ...over,
  };
}

const empty = { orders: [], expenses: [], capital: [], purchases: [] };

test("profit is sales less what the garments cost less the running costs", () => {
  const report = buildFinancialReport({
    ...empty,
    period: PERIOD,
    orders: [order()],
    expenses: [
      { day: "2026-04-20", category: "Packaging", description: "Poly mailers", payee: null, amountPaise: 58_000, gstRateBp: 1800 },
      // Stock purchases are cost of goods, not an overhead — counting them as
      // a running cost would charge the whole invoice against one month's
      // profit while the garments are still on the rail.
      { day: "2026-04-20", category: "Stock purchase", description: "PO-00006", payee: "Vendor", amountPaise: 4_500_000, gstRateBp: 500 },
    ],
  });

  expect(report.pnl.totals.revenuePaise).toBe(200_000);
  expect(report.pnl.totals.cogsPaise).toBe(80_000);
  expect(report.pnl.totals.grossProfitPaise).toBe(120_000);
  expect(report.pnl.totals.runningPaise).toBe(58_000);
  expect(report.pnl.totals.netProfitPaise).toBe(62_000);
  // The stock invoice shows up in cash, not in the profit statement.
  expect(report.cash.totals.stockPaidPaise).toBe(4_500_000);
});

test("a sale outside the period is not in the period", () => {
  const report = buildFinancialReport({
    ...empty,
    period: PERIOD,
    // The day before the financial year opened.
    orders: [order({ day: "2026-03-31" })],
  });
  expect(report.pnl.totals.revenuePaise).toBe(0);
});

test("a confirmed sale price beats the listed total", () => {
  // An in-person sale settled at the door for less than the listed price.
  const report = buildFinancialReport({
    ...empty,
    period: PERIOD,
    orders: [order({ actualSalePricePaise: 150_000 })],
  });
  expect(report.pnl.totals.revenuePaise).toBe(150_000);
});

test("a missing cost is flagged and counted, never treated as free", () => {
  // Counting an unknown cost as zero shows the whole sale as profit. The
  // report has to say how much of itself is unreliable.
  const report = buildFinancialReport({
    ...empty,
    period: PERIOD,
    orders: [
      order({
        lines: [
          { productName: "A", sku: null, size: "M", qty: 2, pricePaise: 100_000, landedCostAtSalePaise: null },
          { productName: "B", sku: null, size: "L", qty: 1, pricePaise: 100_000, landedCostAtSalePaise: 40_000 },
        ],
      }),
    ],
  });
  expect(report.pnl.cogsIncomplete).toBe(true);
  expect(report.pnl.piecesWithoutCost).toBe(2);
  expect(report.pnl.totals.cogsPaise).toBe(40_000);
  expect(report.notes.join(" ")).toContain("no recorded cost");
});

test("an order discount reduces the taxable value in proportion, not the tax rate", () => {
  // Taxing the pre-discount price means paying tax on money nobody paid.
  const report = buildFinancialReport({
    ...empty,
    period: PERIOD,
    orders: [
      order({
        discountPaise: 42_000, // ₹420 off
        totalPaise: 158_000,
        lines: [
          { productName: "A", sku: null, size: "M", qty: 1, pricePaise: 100_000, landedCostAtSalePaise: 40_000 },
          { productName: "B", sku: null, size: "L", qty: 1, pricePaise: 100_000, landedCostAtSalePaise: 40_000 },
        ],
      }),
    ],
  });

  // ₹2,000 of goods less ₹420 = ₹1,580 charged, split evenly across two equal
  // lines, and the tax is what sits inside that.
  const charged = report.gst.sales.reduce((s, r) => s + r.inclusivePaise, 0);
  expect(charged).toBe(158_000);
  expect(report.gst.salesTaxPaise).toBe(taxInsidePaise(79_000, 5) * 2);
});

test("output tax is grouped by rate, the way a return is laid out", () => {
  const report = buildFinancialReport({
    ...empty,
    period: PERIOD,
    orders: [
      order({
        lines: [
          // ₹1,490 a piece: the lower slab.
          { productName: "Daily kurti", sku: null, size: "M", qty: 1, pricePaise: 149_000, landedCostAtSalePaise: 50_000 },
          // ₹3,200 a piece: the upper slab.
          { productName: "Bridal lehenga", sku: null, size: "L", qty: 1, pricePaise: 320_000, landedCostAtSalePaise: 150_000 },
        ],
      }),
    ],
  });

  expect(report.gst.salesByRate.map((b) => b.ratePct)).toEqual([5, 18]);
  expect(report.gst.salesByRate[0].taxPaise).toBe(taxInsidePaise(149_000, 5));
  expect(report.gst.salesByRate[1].taxPaise).toBe(taxInsidePaise(320_000, 18));
});

test("GST payable is output tax less every kind of input tax", () => {
  const report = buildFinancialReport({
    ...empty,
    period: PERIOD,
    orders: [order()],
    purchases: [
      {
        ref: "PO-00006",
        day: "2026-04-10",
        vendorName: "Vendor",
        vendorGstin: "29ABCDE1234F1Z5",
        invoiceNumber: "GD999",
        taxablePaise: 4_000_000,
        gstPaise: 200_000,
        freightPaise: 50_000,
        landedTotalPaise: 4_250_000,
        qty: 85,
      },
    ],
    expenses: [
      { day: "2026-04-20", category: "Packaging", description: "Mailers", payee: null, amountPaise: 118_000, gstRateBp: 1800 },
      // No rate recorded: no credit claimed, and the report says how many.
      { day: "2026-04-21", category: "Courier", description: "Delivery", payee: null, amountPaise: 20_000, gstRateBp: null },
    ],
  });

  const output = taxInsidePaise(200_000, 5);
  expect(report.gst.salesTaxPaise).toBe(output);
  expect(report.gst.purchaseTaxPaise).toBe(200_000);
  expect(report.gst.expenseTaxPaise).toBe(18_000);
  expect(report.gst.expensesWithoutRate).toBe(1);
  expect(report.gst.netPayablePaise).toBe(output - 200_000 - 18_000);
  // More input than output means a credit, which must read as negative rather
  // than as a large amount owed.
  expect(report.gst.netPayablePaise).toBeLessThan(0);
});

test("cash closes as a running balance, and a refund reduces what was received", () => {
  const report = buildFinancialReport({
    ...empty,
    period: PERIOD,
    capital: [{ day: "2026-04-01", contributor: "Nagalakshmi", amountPaise: 1_000_000 }],
    orders: [
      order({ day: "2026-04-15" }),
      // Refunded ₹500 of a ₹2,000 sale in May: still a sale, but ₹500 of it
      // is no longer in the bank.
      order({ orderNumber: "URVI-2026-00002", day: "2026-05-15", refundedPaise: 50_000 }),
    ],
    expenses: [{ day: "2026-05-02", category: "Courier", description: "Delivery", payee: null, amountPaise: 30_000, gstRateBp: null }],
  });

  const [apr, may] = report.cash.closingPaise;
  expect(apr).toBe(1_000_000 + 200_000);
  expect(may).toBe(apr + (200_000 - 50_000) - 30_000);
  // Revenue still counts the full sale; only the cash received is reduced.
  expect(report.pnl.totals.revenuePaise).toBe(400_000);
  expect(report.cash.totals.salesReceiptsPaise).toBe(350_000);
});

test("a period with nothing in it reports zeros, not an error", () => {
  const report = buildFinancialReport({ ...empty, period: PERIOD });
  expect(report.pnl.totals.revenuePaise).toBe(0);
  expect(report.pnl.totals.netProfitPaise).toBe(0);
  expect(report.gst.netPayablePaise).toBe(0);
  expect(report.cash.closingPaise).toHaveLength(12);
  expect(report.cash.closingPaise.every((v) => v === 0)).toBe(true);
  // The caveats are always present — they are part of the report, not a
  // warning that only appears when something is wrong.
  expect(report.notes.length).toBeGreaterThan(0);
});

test("every monthly row is as long as the month list", () => {
  // A row one short silently shifts every figure after it into the wrong
  // month, and the totals still add up — which is how it would go unnoticed.
  const report = buildFinancialReport({ ...empty, period: PERIOD, orders: [order()] });
  const n = report.pnl.months.length;
  expect(report.pnl.revenuePaise).toHaveLength(n);
  expect(report.pnl.cogsPaise).toHaveLength(n);
  expect(report.pnl.netProfitPaise).toHaveLength(n);
  expect(report.cash.closingPaise).toHaveLength(n);
  for (const row of report.pnl.runningByCategory) expect(row.paise).toHaveLength(n);
});
