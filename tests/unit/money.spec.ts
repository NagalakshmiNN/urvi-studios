// The whole-business maths, tested directly.
//
// These are the figures Nagalakshmi will use to judge whether the business is
// working, so the assertions here are deliberately concrete: the real numbers
// from her workbook, and the exact position they should produce.

import { test, expect } from "@playwright/test";
import {
  buildMoneyPicture,
  monthlySpend,
  parseAmount,
  parseSpendDate,
  gstPortionPaise,
  isExpenseCategory,
  STOCK_PURCHASE,
  type ExpenseRow,
  type SaleRow,
} from "../../src/lib/money";

const rupees = (n: number) => n * 100;

test.describe("parsing an amount", () => {
  test("accepts rupees and paise, and scales exactly", () => {
    expect(parseAmount("580", "Amount")).toEqual({ ok: true, paise: 58000 });
    expect(parseAmount("247.50", "Amount")).toEqual({ ok: true, paise: 24750 });
    // 1234.56 * 100 is 123455.99999999999 in binary floating point. The parser
    // splits on the point and scales by hand precisely so this can't happen.
    expect(parseAmount("1234.56", "Amount")).toEqual({ ok: true, paise: 123456 });
    expect(parseAmount("0.05", "Amount")).toEqual({ ok: true, paise: 5 });
  });

  test("names the field it is complaining about", () => {
    const empty = parseAmount("", "Amount");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toBe("Amount is required.");
  });

  test("refuses letters, symbols, negatives and three decimal places", () => {
    for (const bad of ["abc", "₹500", "-100", "1,000", "12.345", "1e3", "", "  "]) {
      expect(parseAmount(bad, "Amount").ok, `"${bad}" should be refused`).toBe(false);
    }
  });

  test("refuses zero — a spend of nothing is a mistyped spend", () => {
    expect(parseAmount("0", "Amount").ok).toBe(false);
    expect(parseAmount("0.00", "Amount").ok).toBe(false);
  });
});

test.describe("parsing a date", () => {
  test("accepts what a date input produces", () => {
    expect(parseSpendDate("2026-08-20", "Date")).toEqual({ ok: true, date: "2026-08-20" });
  });

  test("refuses a day that doesn't exist", () => {
    // The pattern alone would accept this; the round-trip through Date is what
    // catches it, before Postgres rejects it with something unreadable.
    expect(parseSpendDate("2026-02-31", "Date").ok).toBe(false);
    expect(parseSpendDate("2026-13-01", "Date").ok).toBe(false);
    expect(parseSpendDate("20-08-2026", "Date").ok).toBe(false);
    expect(parseSpendDate("", "Date").ok).toBe(false);
  });

  test("refuses a date years ahead, which is a mistyped year", () => {
    const result = parseSpendDate("2099-01-01", "Date");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("year");
  });
});

test.describe("expense categories", () => {
  test("only recognises categories from the list", () => {
    expect(isExpenseCategory("Packaging")).toBe(true);
    expect(isExpenseCategory(STOCK_PURCHASE)).toBe(true);
    expect(isExpenseCategory("packaging")).toBe(false);
    expect(isExpenseCategory("Vendor")).toBe(false);
  });
});

test.describe("GST portion of an inclusive amount", () => {
  test("works back out of the total, not on top of it", () => {
    // ₹580 paid at 18% means ₹491.53 of goods and ₹88.47 of tax.
    expect(gstPortionPaise(58000, 1800)).toBe(8847);
    expect(gstPortionPaise(10500, 500)).toBe(500);
  });

  test("is nothing at all where there is no rate, rather than zero", () => {
    expect(gstPortionPaise(58000, null)).toBeNull();
    expect(gstPortionPaise(58000, 0)).toBeNull();
  });
});

test.describe("the money picture", () => {
  // Nagalakshmi's real position, as the workbook records it.
  const capital = [
    { amountPaise: rupees(20577), contributedOn: "2026-08-20" },
    { amountPaise: rupees(50000), contributedOn: "2026-08-20" },
  ];
  const expenses: ExpenseRow[] = [
    { category: STOCK_PURCHASE, amountPaise: rupees(29412), spentOn: "2026-08-20" },
    { category: STOCK_PURCHASE, amountPaise: rupees(14671), spentOn: "2026-08-26" },
    { category: STOCK_PURCHASE, amountPaise: rupees(23484), spentOn: "2026-08-31" },
    { category: STOCK_PURCHASE, amountPaise: rupees(27321), spentOn: "2026-09-07" },
    { category: "Transportation", amountPaise: rupees(587), spentOn: "2026-08-20" },
    { category: "Transportation", amountPaise: rupees(380), spentOn: "2026-08-26" },
    { category: "Transportation", amountPaise: rupees(1170), spentOn: "2026-08-31" },
    { category: "Transportation", amountPaise: rupees(250), spentOn: "2026-09-07" },
    { category: "Packaging", amountPaise: rupees(580), spentOn: "2026-06-04" },
  ];

  test("reproduces the workbook's own cash position exactly", () => {
    const p = buildMoneyPicture({ capital, expenses, orders: [], stock: [] });
    expect(p.capitalInPaise).toBe(rupees(70577));
    expect(p.stockPurchasePaise).toBe(rupees(94888));
    expect(p.runningCostsPaise).toBe(rupees(2967)); // 2,387 freight + 580 packaging
    // The figure the corrected workbook's Cash Flow sheet arrives at.
    expect(p.cashPaise).toBe(rupees(-27278));
  });

  test("counts stock bought as stock, not as a running cost", () => {
    const p = buildMoneyPicture({ capital, expenses, orders: [], stock: [] });
    // The whole point of the distinction: ₹94,888 of stock must never appear
    // in running costs, or a young retail business reads as a catastrophe.
    expect(p.runningCostsByCategory.map((c) => c.category)).not.toContain(STOCK_PURCHASE);
    expect(p.runningCostsByCategory).toEqual([
      { category: "Transportation", paise: rupees(2387) },
      { category: "Packaging", paise: rupees(580) },
    ]);
  });

  test("adds unsold stock back, so net worth is not the same as cash", () => {
    const stock = [
      { stock: 10, landedCost: 500, price: 1200 },
      { stock: 4, landedCost: 900, price: 2000 },
    ];
    const p = buildMoneyPicture({ capital, expenses, orders: [], stock });
    expect(p.stockAtCostPaise).toBe(rupees(5000 + 3600));
    expect(p.stockAtRetailPaise).toBe(rupees(12000 + 8000));
    expect(p.netWorthPaise).toBe(p.cashPaise + p.stockAtCostPaise);
    expect(p.netWorthPaise).toBeGreaterThan(p.cashPaise);
  });

  test("ignores stock that is sold out, and flags stock with no cost recorded", () => {
    const p = buildMoneyPicture({
      capital: [],
      expenses: [],
      orders: [],
      stock: [
        { stock: 0, landedCost: 900, price: 2000 }, // sold out — contributes nothing
        { stock: 3, landedCost: null, price: 1500 }, // cost unknown
      ],
    });
    expect(p.stockAtCostPaise).toBe(0);
    expect(p.stockAtRetailPaise).toBe(rupees(4500));
    expect(p.stockCostIncomplete).toBe(true);
  });

  test("a paid sale adds revenue and its cost comes off trading profit", () => {
    const orders: SaleRow[] = [
      {
        total: 2700,
        actualSalePricePaise: null,
        paymentStatus: "PAID",
        status: "DELIVERED",
        createdAt: new Date("2026-09-10"),
        items: [{ qty: 1, landedCostAtSale: 1000 }],
      },
    ];
    const p = buildMoneyPicture({ capital: [], expenses: [], orders, stock: [] });
    expect(p.revenuePaise).toBe(rupees(2700));
    expect(p.tradingProfitPaise).toBe(rupees(1700));
    expect(p.costIncomplete).toBe(false);
  });

  test("the actual sale price wins over the listed total where it was recorded", () => {
    const orders: SaleRow[] = [
      {
        total: 2700,
        actualSalePricePaise: 250000, // ₹2,500 actually settled
        paymentStatus: "PAID",
        status: "COLLECTED",
        createdAt: new Date("2026-09-10"),
        items: [{ qty: 1, landedCostAtSale: 1000 }],
      },
    ];
    const p = buildMoneyPicture({ capital: [], expenses: [], orders, stock: [] });
    expect(p.revenuePaise).toBe(rupees(2500));
  });

  test("unpaid, cancelled and returned orders are not sales", () => {
    const base = { total: 2700, actualSalePricePaise: null, createdAt: new Date("2026-09-10"), items: [] };
    const orders: SaleRow[] = [
      { ...base, paymentStatus: "PENDING", status: "PLACED" },
      { ...base, paymentStatus: "PAID", status: "CANCELLED" },
      { ...base, paymentStatus: "PAID", status: "RETURNED" },
    ];
    const p = buildMoneyPicture({ capital: [], expenses: [], orders, stock: [] });
    expect(p.revenuePaise).toBe(0);
  });

  test("a sold piece with no recorded cost is flagged, never counted as free", () => {
    const orders: SaleRow[] = [
      {
        total: 2700,
        actualSalePricePaise: null,
        paymentStatus: "PAID",
        status: "DELIVERED",
        createdAt: new Date("2026-09-10"),
        items: [{ qty: 1, landedCostAtSale: null }],
      },
    ];
    const p = buildMoneyPicture({ capital: [], expenses: [], orders, stock: [] });
    // Profit reads as the full ₹2,700 — which is why it has to say so.
    expect(p.tradingProfitPaise).toBe(rupees(2700));
    expect(p.costIncomplete).toBe(true);
  });

  test("an empty business is all zeroes, not NaN", () => {
    const p = buildMoneyPicture({ capital: [], expenses: [], orders: [], stock: [] });
    for (const value of [p.capitalInPaise, p.revenuePaise, p.cashPaise, p.netWorthPaise, p.tradingProfitPaise]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBe(0);
    }
  });
});

test.describe("monthly spend", () => {
  const now = new Date(2026, 8, 16); // September 2026

  test("keeps stock and running costs apart, month by month", () => {
    const rows = monthlySpend(
      [
        { category: STOCK_PURCHASE, amountPaise: rupees(29412), spentOn: "2026-08-20" },
        { category: "Transportation", amountPaise: rupees(587), spentOn: "2026-08-20" },
        { category: STOCK_PURCHASE, amountPaise: rupees(27321), spentOn: "2026-09-07" },
      ],
      12,
      now
    );
    const aug = rows.find((r) => r.key === "2026-08")!;
    const sep = rows.find((r) => r.key === "2026-09")!;
    expect(aug.stockPaise).toBe(rupees(29412));
    expect(aug.runningPaise).toBe(rupees(587));
    expect(sep.stockPaise).toBe(rupees(27321));
    expect(sep.runningPaise).toBe(0);
  });

  test("a month with nothing spent is a zero, not a missing month", () => {
    const rows = monthlySpend([], 12, now);
    expect(rows).toHaveLength(12);
    expect(rows[rows.length - 1].key).toBe("2026-09");
    expect(rows.every((r) => r.stockPaise === 0 && r.runningPaise === 0)).toBe(true);
  });

  test("ignores anything older than the window rather than folding it into month one", () => {
    const rows = monthlySpend(
      [{ category: "Packaging", amountPaise: rupees(999), spentOn: "2020-01-01" }],
      12,
      now
    );
    expect(rows.reduce((n, r) => n + r.runningPaise, 0)).toBe(0);
  });
});
