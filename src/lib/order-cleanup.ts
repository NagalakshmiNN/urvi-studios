// Which orders may be deleted, and which are records.
//
// Kept as a plain function rather than a condition inside the server action,
// because this is the rule that stops a bulk delete becoming a disaster and a
// rule that matters that much should be readable on its own and testable
// without a database.
//
// Two things make an order real. Money taken: the books, the GST return and
// the customer all depend on that row existing. Stock moved: deleting it
// would leave the shelf count permanently wrong with nothing to explain why.
// Everything else — a checkout someone abandoned, a payment that never
// completed, an afternoon of testing a gateway — is debris.

export type DeletableOrder = { paymentStatus: string | null; stockDeducted: boolean | null };

export function canDeleteOrder(order: DeletableOrder): boolean {
  if (order.paymentStatus === "PAID") return false;
  if (order.stockDeducted) return false;
  return true;
}

/** Why an order was left alone, for saying so rather than silently skipping it. */
export function whyNotDeletable(order: DeletableOrder): string | null {
  if (order.paymentStatus === "PAID") return "it has been paid";
  if (order.stockDeducted) return "it has already taken stock";
  return null;
}
