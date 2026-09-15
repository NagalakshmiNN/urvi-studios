// Month-by-month revenue and profit, across EVERY channel.
//
// A sale is a sale whether it came through the website, over WhatsApp, on the
// phone, or from someone standing at the door — so nothing here filters on
// `source`. The channel split is reported alongside, so the mix is visible
// without the totals ever being partial.
//
// Only orders that were actually paid for count. An order sitting unpaid is
// not revenue, and a cancelled one certainly isn't.

export type OrderForStats = {
  createdAt: Date;
  paymentStatus: string;
  status: string;
  total: number;
  actualSalePricePaise: number | null;
  source: string;
  items: { qty: number; price: number; landedCostAtSale: number | null }[];
};

export type MonthStats = {
  /** "2026-09" — sortable, and what the label is derived from. */
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: number;
  /** Whether every sold piece that month had a recorded cost. */
  costComplete: boolean;
};

/** A cancelled or returned order never counted as a sale. */
const NOT_A_SALE = new Set(["CANCELLED", "RETURNED"]);

/**
 * What an order actually brought in.
 *
 * The Actual Sale Price wins when it has been recorded — it is the figure the
 * admin confirmed was settled, and it may differ from the order total after a
 * discount agreed at the door. Otherwise the order total stands.
 */
export function orderRevenue(order: Pick<OrderForStats, "total" | "actualSalePricePaise">): number {
  if (order.actualSalePricePaise != null) return order.actualSalePricePaise / 100;
  return order.total;
}

export function countsAsSale(order: Pick<OrderForStats, "paymentStatus" | "status">): boolean {
  return order.paymentStatus === "PAID" && !NOT_A_SALE.has(order.status);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

/**
 * One row per month, oldest first, with no gaps — a month in which nothing
 * sold still appears, as a zero. Leaving it out would compress the gap and
 * make a quiet month look like it never happened.
 */
export function monthlyPerformance(orders: OrderForStats[], months = 12, now = new Date()): MonthStats[] {
  const sales = orders.filter(countsAsSale);

  const byMonth = new Map<string, { revenue: number; cost: number; orders: number; costComplete: boolean }>();

  // Seed every month in the window, so the run is continuous.
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    byMonth.set(monthKey(d), { revenue: 0, cost: 0, orders: 0, costComplete: true });
  }

  for (const order of sales) {
    const key = monthKey(new Date(order.createdAt));
    const bucket = byMonth.get(key);
    if (!bucket) continue; // older than the window

    bucket.revenue += orderRevenue(order);
    bucket.orders += 1;
    for (const item of order.items) {
      if (item.landedCostAtSale == null) {
        // Cost unknown for this line. Counting it as zero would inflate the
        // month's profit, so the month is flagged instead of quietly lying.
        bucket.costComplete = false;
        continue;
      }
      bucket.cost += item.landedCostAtSale * item.qty;
    }
  }

  return [...byMonth.entries()].map(([key, v]) => ({
    key,
    label: monthLabel(key),
    revenue: Math.round(v.revenue),
    cost: Math.round(v.cost),
    profit: Math.round(v.revenue - v.cost),
    orders: v.orders,
    costComplete: v.costComplete,
  }));
}

/** Sales by channel, so the mix behind the totals is visible. */
export function revenueByChannel(orders: OrderForStats[]): { source: string; revenue: number; orders: number }[] {
  const bySource = new Map<string, { revenue: number; orders: number }>();
  for (const order of orders.filter(countsAsSale)) {
    const entry = bySource.get(order.source) ?? { revenue: 0, orders: 0 };
    entry.revenue += orderRevenue(order);
    entry.orders += 1;
    bySource.set(order.source, entry);
  }
  return [...bySource.entries()]
    .map(([source, v]) => ({ source, revenue: Math.round(v.revenue), orders: v.orders }))
    .sort((a, b) => b.revenue - a.revenue);
}
