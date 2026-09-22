// The rule that stands between a bulk delete and a deleted sales record.

import { test, expect } from "@playwright/test";
import { canDeleteOrder, whyNotDeletable } from "@/lib/order-cleanup";

test("a paid order is never deletable", () => {
  expect(canDeleteOrder({ paymentStatus: "PAID", stockDeducted: false })).toBe(false);
  expect(whyNotDeletable({ paymentStatus: "PAID", stockDeducted: false })).toBe("it has been paid");
});

test("an order that already took stock is never deletable", () => {
  // Even unpaid: a manually confirmed order deducts stock, and removing the
  // row would leave the shelf count wrong with nothing to explain it.
  expect(canDeleteOrder({ paymentStatus: "PENDING", stockDeducted: true })).toBe(false);
  expect(whyNotDeletable({ paymentStatus: "PENDING", stockDeducted: true })).toBe("it has already taken stock");
});

test("an unpaid order that never moved stock is debris", () => {
  expect(canDeleteOrder({ paymentStatus: "PENDING", stockDeducted: false })).toBe(true);
  expect(whyNotDeletable({ paymentStatus: "PENDING", stockDeducted: false })).toBeNull();
});

test("missing fields are treated as unpaid, not as paid", () => {
  // A null payment status is not "PAID"; refusing here would make the tidy-up
  // silently useless on older rows.
  expect(canDeleteOrder({ paymentStatus: null, stockDeducted: null })).toBe(true);
});

test("paid wins over everything else", () => {
  expect(canDeleteOrder({ paymentStatus: "PAID", stockDeducted: true })).toBe(false);
});

test("a refunded order is still a record, not debris", () => {
  // It was paid, then refunded — the row is what the refund is evidence of.
  expect(canDeleteOrder({ paymentStatus: "PAID", stockDeducted: false })).toBe(false);
});
