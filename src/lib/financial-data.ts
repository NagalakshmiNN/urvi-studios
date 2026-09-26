// Reading the database into the shape the financial report wants.
//
// A separate step from both the arithmetic and the spreadsheet, so each of the
// three can be wrong in only one way. This one's whole job is unit conversion
// and date handling, which is exactly where a financial report goes quietly
// wrong.
//
// Two conversions matter. Order amounts are stored in whole RUPEES (subtotal,
// total, a line's price) while everything on the money-out side is in PAISE —
// that difference is a hundredfold error waiting to happen, so every rupee
// figure is multiplied here and nowhere else. And an order's timestamp is a
// UTC instant, while an expense's date is a plain day: a sale at 2am IST on
// 1 April is 20:30 UTC on 31 March, and putting it in the wrong financial year
// is how a return stops matching.

import { db } from "@/db";
import { istDay, type Period, type SaleOrder, type ExpenseEntry, type CapitalEntry, type PurchaseEntry } from "./financial-report";

export async function loadFinancialData(period: Period): Promise<{
  orders: SaleOrder[];
  expenses: ExpenseEntry[];
  capital: CapitalEntry[];
  purchases: PurchaseEntry[];
}> {
  const [orders, expenses, capital, purchases] = await Promise.all([
    db.query.orders.findMany({ with: { items: true } }),
    db.query.expenses.findMany(),
    db.query.capitalContributions.findMany(),
    db.query.purchases.findMany({ with: { vendor: true } }),
  ]);

  return {
    // Filtering by period happens in buildFinancialReport, not here: the rule
    // for what falls inside a period belongs with the arithmetic that uses it,
    // and this shop's whole history is a few thousand rows.
    orders: orders.map((o): SaleOrder => ({
      orderNumber: o.orderNumber,
      day: istDay(o.createdAt),
      paymentStatus: o.paymentStatus,
      status: o.status,
      totalPaise: o.total * 100,
      actualSalePricePaise: o.actualSalePricePaise,
      discountPaise: o.discount * 100,
      refundedPaise: o.refundedPaise ?? 0,
      channel: o.source,
      lines: o.items.map((i) => ({
        productName: i.productName,
        sku: i.sku,
        size: i.size,
        qty: i.qty,
        pricePaise: i.price * 100,
        landedCostAtSalePaise: i.landedCostAtSale != null ? i.landedCostAtSale * 100 : null,
      })),
    })),

    expenses: expenses.map((e): ExpenseEntry => ({
      day: e.spentOn,
      category: e.category,
      description: e.description,
      payee: e.payee,
      amountPaise: e.amountPaise,
      gstRateBp: e.gstRateBp,
    })),

    capital: capital.map((c): CapitalEntry => ({
      day: c.contributedOn,
      contributor: c.contributor,
      amountPaise: c.amountPaise,
    })),

    purchases: purchases.map((p): PurchaseEntry => ({
      ref: p.ref,
      day: p.invoiceDate,
      vendorName: p.vendor.name,
      vendorGstin: p.vendor.gstin,
      invoiceNumber: p.invoiceNumber,
      taxablePaise: p.taxablePaise,
      gstPaise: p.gstPaise,
      freightPaise: p.freightPaise,
      landedTotalPaise: p.landedTotalPaise,
      qty: p.totalQty,
    })),
  };
}
