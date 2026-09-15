// Every screen that shows a stock number, refreshed together.
//
// Stock changes from several places — an order confirmed in the admin, a
// walk-in sale recorded by hand, a Razorpay payment landing (from the
// customer's browser or from the webhook), a product edited, an Excel import —
// and each of those used to revalidate its own idea of "the pages that
// matter". The Stock screen was added later and never made any of those
// lists, so it kept serving a cached page: an order could be marked
// Collected and the stock sheet would still show the old count.
//
// One list, called from everywhere stock moves, so a new screen only has to
// be added here once.

import { revalidatePath } from "next/cache";

export function revalidateStockViews() {
  revalidatePath("/admin/stock");
  revalidatePath("/admin/products");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  // The storefront too: a size that just sold out should stop being offered.
  revalidatePath("/shop");
}
