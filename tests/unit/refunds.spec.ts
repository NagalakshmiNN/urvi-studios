// Whether a refund undoes the sale.
//
// The distinction is the whole of the behaviour: a full refund cancels the
// order and puts the stock back, a partial one records the amount and leaves
// the sale standing. Getting it backwards either mints a garment that was
// never returned or keeps selling one that was.

import { test, expect } from "@playwright/test";
import { isFullRefund } from "@/lib/refund-order";

test("a refund of the whole order total is a full refund", () => {
  // Order totals are whole rupees; Razorpay speaks paise. Comparing them in
  // the wrong unit makes an ₹1,800 order look refunded by ₹18.
  expect(isFullRefund(180_000, 1_800)).toBe(true);
});

test("a refund of part of the order is not", () => {
  expect(isFullRefund(20_000, 1_800)).toBe(false);
  // One rupee short is still short. Nothing gets cancelled on a rounding.
  expect(isFullRefund(179_900, 1_800)).toBe(false);
});

test("more than the total still counts as full", () => {
  // Razorpay can refund a little over the captured amount in odd cases, and
  // an order refunded for more than it cost is certainly refunded.
  expect(isFullRefund(180_100, 1_800)).toBe(true);
});

test("a zero refund is not a refund", () => {
  expect(isFullRefund(0, 1_800)).toBe(false);
  // A free order is the one case where zero is everything — it should not be
  // treated as an un-refunded sale forever.
  expect(isFullRefund(0, 0)).toBe(true);
});
