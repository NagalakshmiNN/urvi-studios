// How many times a coupon may be used, and by whom.
//
// A coupon with no ceiling is a standing offer to anyone who finds the code,
// and codes do get found. The counting lives in the database; the rule about
// what the counts mean lives here, which is why it can be tested without one.

import { test, expect } from "@playwright/test";
import { withinLimits, remainingUses } from "@/lib/coupon-usage";

const noLimits = { usageLimit: null, perCustomerLimit: null };

test("a coupon with no limits never runs out", () => {
  // Every coupon created before limits existed is this one, so it has to keep
  // working exactly as it did.
  expect(withinLimits(noLimits, { total: 0, byCustomer: 0 }).ok).toBe(true);
  expect(withinLimits(noLimits, { total: 9_999, byCustomer: 9_999 }).ok).toBe(true);
});

test("the total limit is a ceiling, not a target", () => {
  const limits = { usageLimit: 3, perCustomerLimit: null };
  expect(withinLimits(limits, { total: 2, byCustomer: null }).ok).toBe(true);

  // The third use is allowed; the fourth is not. Off by one here either gives
  // away a discount that was capped or refuses one that was promised.
  const third = withinLimits(limits, { total: 3, byCustomer: null });
  expect(third.ok).toBe(false);
  expect(third.ok === false && third.error).toContain("fully used");
});

test("one per customer stops the second order, not the first", () => {
  const limits = { usageLimit: null, perCustomerLimit: 1 };
  expect(withinLimits(limits, { total: 40, byCustomer: 0 }).ok).toBe(true);

  const again = withinLimits(limits, { total: 40, byCustomer: 1 });
  expect(again.ok).toBe(false);
  // Worded so the shopper knows the code is real and they have had their turn
  // — the difference between emailing to ask and giving up on the order.
  expect(again.ok === false && again.error).toContain("one order per customer");
});

test("without an email, only the total limit can be judged", () => {
  // The cart page previews a coupon before anyone has typed an address. The
  // per-customer limit simply cannot be answered there, and guessing "not
  // used" would be a promise checkout then breaks.
  const limits = { usageLimit: 5, perCustomerLimit: 1 };
  expect(withinLimits(limits, { total: 2, byCustomer: null }).ok).toBe(true);
  expect(withinLimits(limits, { total: 5, byCustomer: null }).ok).toBe(false);
});

test("a per-customer limit above one says how many have been used", () => {
  const limits = { usageLimit: null, perCustomerLimit: 2 };
  expect(withinLimits(limits, { total: 10, byCustomer: 1 }).ok).toBe(true);

  const third = withinLimits(limits, { total: 10, byCustomer: 2 });
  expect(third.ok).toBe(false);
  expect(third.ok === false && third.error).toContain("2 times");
});

test("what's left of a coupon reads as a number, or as nothing at all", () => {
  expect(remainingUses({ usageLimit: 10, perCustomerLimit: null }, 4)).toBe(6);
  expect(remainingUses({ usageLimit: 10, perCustomerLimit: null }, 10)).toBe(0);
  // Never negative: an over-redemption (two checkouts taking the last use in
  // the same second) should read "used up", not "-1 left".
  expect(remainingUses({ usageLimit: 10, perCustomerLimit: null }, 12)).toBe(0);
  // No limit is not zero left. The admin screen shows "of unlimited".
  expect(remainingUses(noLimits, 12)).toBeNull();
});
