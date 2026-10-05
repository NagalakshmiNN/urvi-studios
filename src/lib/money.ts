// The whole-business picture: what went in, what came back, and what the
// business is actually worth today.
//
// Everything here is pure — it takes rows and returns numbers — so the maths
// can be tested directly without a browser or a database, which matters more
// for this file than for most: these are the figures Nagalakshmi will use to
// decide whether the business is working.
//
// How this business works: there is no separate business bank account. Every
// rupee that leaves a personal pocket — vendor payments, freight, packaging,
// courier — goes directly to the business. So "invested" equals "spent", and
// the capital_contributions table (kept for equity tracking between partners)
// is not what drives this view. Instead the total of all expenses IS the
// investment, and sales revenue is the cash the business has generated.
//
// Money paid to a vendor for stock has NOT been spent the way a courier bill
// has been spent — it has been converted into something sitting on the rail
// that can still be sold. So stock purchases are tracked as their own
// category and reported separately from running costs, and the closing
// position shows both what sales have brought back and the value of what the
// investment turned into.

import { parseActualSalePrice, formatPaise } from "@/lib/sale-price";

// ---------------------------------------------------------------- Categories

/**
 * Deliberately mirrors the workbook's Expense Register, so the two can still be
 * read side by side while she moves across — and so the one-off import of her
 * existing history maps cleanly rather than by guesswork.
 */
export const EXPENSE_CATEGORIES = [
  "Stock purchase",
  "Packaging",
  "Courier",
  "Transportation",
  "Marketing",
  "Photography",
  "Platform fees",
  "Software",
  "Website",
  "Storage",
  "Samples",
  "Returns",
  "Repairs",
  "Professional fees",
  "Bank charges",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * The one category that buys an asset rather than consuming cash. Kept as a
 * named constant because three separate places depend on treating it
 * differently, and a stray string literal in any one of them would quietly
 * turn her inventory into a loss.
 */
export const STOCK_PURCHASE: ExpenseCategory = "Stock purchase";

export const PAYMENT_MODES = ["UPI", "Cash", "Bank transfer", "Card", "Other"] as const;

/** GST rates that actually apply, in basis points. */
export const GST_RATES = [
  { bp: 0, label: "No GST" },
  { bp: 500, label: "5%" },
  { bp: 1200, label: "12%" },
  { bp: 1800, label: "18%" },
] as const;

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------- Parsing

/**
 * An amount typed into one of the money-out forms.
 *
 * Reuses the Actual Sale Price rules — digits and up to two decimals, nothing
 * else — because an amount is an amount, and having two slightly different
 * definitions of "a valid rupee figure" in one app is how they drift apart.
 * The only difference is that nothing here is capped against an order total.
 */
export function parseAmount(raw: string | null | undefined, fieldName: string): { ok: true; paise: number } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (value === "") return { ok: false, error: `${fieldName} is required.` };

  // A very large ceiling, purely so a mistyped amount can't overflow the
  // integer column. ₹10 crore is far beyond anything this business will see.
  const result = parseActualSalePrice(value, 100_000_000);
  if (!result.ok) {
    // Re-word the two messages that name the sale-price field.
    if (result.error.includes("cannot be more than")) {
      return { ok: false, error: `${fieldName} looks too large — please check it.` };
    }
    if (result.error.includes("must be more than zero")) {
      return { ok: false, error: `${fieldName} must be more than zero.` };
    }
    if (result.error.includes("is required")) {
      return { ok: false, error: `${fieldName} is required.` };
    }
    return { ok: false, error: result.error };
  }
  return { ok: true, paise: result.paise };
}

/** A date typed as YYYY-MM-DD, which is what a native date input produces. */
export function parseSpendDate(raw: string | null | undefined, fieldName: string): { ok: true; date: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (value === "") return { ok: false, error: `${fieldName} is required.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: `${fieldName} must be a real date.` };

  // Round-tripping through Date catches 2026-02-31, which the pattern above
  // happily accepts and Postgres would reject with a much uglier message.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: `${fieldName} must be a real date.` };
  }
  // A spend dated years ahead is a typo — most often the year typed wrong.
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() + 1);
  if (parsed > limit) return { ok: false, error: `${fieldName} is too far in the future — please check the year.` };

  return { ok: true, date: value };
}

// ---------------------------------------------------------------- The picture

export type ExpenseRow = { category: string; amountPaise: number; spentOn: string };
export type CapitalRow = { amountPaise: number; contributedOn: string };
export type SoldLine = { qty: number; landedCostAtSale: number | null };
export type SaleRow = { total: number; actualSalePricePaise: number | null; paymentStatus: string; status: string; createdAt: Date; items: SoldLine[] };
export type StockRow = { stock: number; landedCost: number | null; price: number };

export type MoneyPicture = {
  /** Total spent on everything — vendors, freight, running costs. This IS the investment. */
  investedPaise: number;
  revenuePaise: number;
  stockPurchasePaise: number;
  runningCostsPaise: number;
  /** Running costs broken down, largest first, for the chart. */
  runningCostsByCategory: { category: string; paise: number }[];
  /** What the pieces still on the rail cost us. */
  stockAtCostPaise: number;
  /** What those same pieces are listed at. */
  stockAtRetailPaise: number;
  /** Sales revenue — the money customers have paid in. */
  cashPaise: number;
  /** Sales revenue plus the cost value of unsold stock. */
  netWorthPaise: number;
  /** Revenue less what those sold pieces cost us, less running costs. */
  tradingProfitPaise: number;
  /** True where some sold piece had no recorded cost, so profit flatters. */
  costIncomplete: boolean;
  /** True where some stock has no landed cost, so the stock value understates. */
  stockCostIncomplete: boolean;
};

const NOT_A_SALE = new Set(["CANCELLED", "RETURNED"]);

function countsAsSale(o: { paymentStatus: string; status: string }): boolean {
  return o.paymentStatus === "PAID" && !NOT_A_SALE.has(o.status);
}

function saleRevenuePaise(o: SaleRow): number {
  // The Actual Sale Price wins where it was recorded — it is the figure an
  // admin confirmed was settled, which may differ from the listed total after
  // a discount agreed at the door.
  if (o.actualSalePricePaise != null) return o.actualSalePricePaise;
  return Math.round(o.total * 100);
}

export function buildMoneyPicture(input: {
  capital?: CapitalRow[];
  expenses: ExpenseRow[];
  orders: SaleRow[];
  stock: StockRow[];
}): MoneyPicture {
  // "Invested" = total of all expenses. There is no separate business account,
  // so every rupee paid out IS the investment — no capital_contributions step.
  let stockPurchasePaise = 0;
  const byCategory = new Map<string, number>();
  for (const e of input.expenses) {
    if (e.category === STOCK_PURCHASE) {
      stockPurchasePaise += e.amountPaise;
      continue;
    }
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountPaise);
  }
  const runningCostsByCategory = [...byCategory.entries()]
    .map(([category, paise]) => ({ category, paise }))
    .sort((a, b) => b.paise - a.paise);
  const runningCostsPaise = runningCostsByCategory.reduce((n, c) => n + c.paise, 0);
  const investedPaise = stockPurchasePaise + runningCostsPaise;

  const sales = input.orders.filter(countsAsSale);
  const revenuePaise = sales.reduce((n, o) => n + saleRevenuePaise(o), 0);

  let soldAtCostPaise = 0;
  let costIncomplete = false;
  for (const order of sales) {
    for (const line of order.items) {
      if (line.landedCostAtSale == null) {
        // Counting an unknown cost as zero would inflate profit. Flag instead.
        costIncomplete = true;
        continue;
      }
      soldAtCostPaise += line.landedCostAtSale * line.qty * 100;
    }
  }

  let stockAtCostPaise = 0;
  let stockAtRetailPaise = 0;
  let stockCostIncomplete = false;
  for (const row of input.stock) {
    if (row.stock <= 0) continue;
    if (row.landedCost == null || row.landedCost <= 0) stockCostIncomplete = true;
    stockAtCostPaise += (row.landedCost ?? 0) * row.stock * 100;
    stockAtRetailPaise += row.price * row.stock * 100;
  }

  // invested = stock + running, so this simplifies to revenuePaise, but the
  // full form makes the accounting identity visible.
  const cashPaise = investedPaise + revenuePaise - stockPurchasePaise - runningCostsPaise;

  return {
    investedPaise,
    revenuePaise,
    stockPurchasePaise,
    runningCostsPaise,
    runningCostsByCategory,
    stockAtCostPaise,
    stockAtRetailPaise,
    cashPaise,
    netWorthPaise: cashPaise + stockAtCostPaise,
    tradingProfitPaise: revenuePaise - soldAtCostPaise - runningCostsPaise,
    costIncomplete,
    stockCostIncomplete,
  };
}

/**
 * Month-by-month money out, to sit under the revenue chart that already
 * exists. Oldest first, with no gaps — a quiet month is a zero, not a missing
 * bar, so the run reads as time passing rather than as a compressed gap.
 */
export function monthlySpend(
  expenses: ExpenseRow[],
  months = 12,
  now = new Date()
): { key: string; label: string; stockPaise: number; runningPaise: number }[] {
  const buckets = new Map<string, { stockPaise: number; runningPaise: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, { stockPaise: 0, runningPaise: 0 });
  }
  for (const e of expenses) {
    const key = e.spentOn.slice(0, 7); // the date is already YYYY-MM-DD
    const bucket = buckets.get(key);
    if (!bucket) continue; // older than the window
    if (e.category === STOCK_PURCHASE) bucket.stockPaise += e.amountPaise;
    else bucket.runningPaise += e.amountPaise;
  }
  return [...buckets.entries()].map(([key, v]) => {
    const [year, month] = key.split("-").map(Number);
    return {
      key,
      label: new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      ...v,
    };
  });
}

/** The tax portion of a GST-inclusive amount, given the rate in basis points. */
export function gstPortionPaise(amountPaise: number, gstRateBp: number | null): number | null {
  if (gstRateBp == null || gstRateBp <= 0) return null;
  const rate = gstRateBp / 10_000;
  return Math.round(amountPaise - amountPaise / (1 + rate));
}

export { formatPaise };
