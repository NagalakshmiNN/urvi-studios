// What the admin screen will say about a payment.
//
// describePayments is the sentence a person reads when they are trying to
// work out whether a customer's money has left their account. Getting it
// wrong in the reassuring direction — saying no money moved when it did — is
// the failure that matters, so the cases are pinned down here.

import { test, expect } from "@playwright/test";
import { capturedPayment, describePayments, type RazorpayPayment } from "@/lib/razorpay-api";

function payment(over: Partial<RazorpayPayment> = {}): RazorpayPayment {
  return {
    id: "pay_TEST",
    status: "captured",
    amount: 2100,
    currency: "INR",
    method: "upi",
    email: null,
    contact: null,
    createdAt: 1_700_000_000,
    errorDescription: null,
    errorReason: null,
    ...over,
  };
}

test("no attempts at all says plainly that no money moved", () => {
  const text = describePayments([]);
  expect(text).toContain("no payment attempt");
  expect(text).toContain("no money has moved");
});

test("a captured payment names the amount, the method and the id", () => {
  const text = describePayments([payment({ id: "pay_ABC", amount: 2100, method: "upi" })]);
  expect(text).toContain("₹21.00");
  expect(text).toContain("upi");
  expect(text).toContain("pay_ABC");
  expect(text).toContain("money is with Razorpay");
});

test("authorised but not captured is not described as taken", () => {
  const text = describePayments([payment({ status: "authorized", id: "pay_AUTH" })]);
  expect(text).toContain("authorised but not captured");
  expect(text).toContain("held, not taken");
  // The dangerous wording would be to call this money we have.
  expect(text).not.toContain("money is with Razorpay");
});

test("a failed payment carries the reason Razorpay gave", () => {
  const text = describePayments([
    payment({ status: "failed", errorDescription: "Your bank declined the transaction" }),
  ]);
  expect(text).toContain("Your bank declined the transaction");
  expect(text).toContain("No money was taken");
});

test("a failed payment with no description still says something useful", () => {
  const text = describePayments([payment({ status: "failed", errorDescription: null, errorReason: null })]);
  expect(text).toContain("no reason given");
  expect(text).toContain("No money was taken");
});

test("a capture among several failed attempts is the one that counts", () => {
  // The real shape of a customer who tried three times: two declines, then
  // a success. Reporting "the payment failed" here would be a disaster.
  const payments = [
    payment({ status: "failed", id: "pay_1", errorDescription: "Insufficient funds" }),
    payment({ status: "failed", id: "pay_2", errorDescription: "Incorrect OTP" }),
    payment({ status: "captured", id: "pay_3", amount: 2100 }),
  ];
  expect(capturedPayment(payments)?.id).toBe("pay_3");
  expect(describePayments(payments)).toContain("pay_3");
  expect(describePayments(payments)).toContain("money is with Razorpay");
});

test("attempts that went nowhere are counted, not mistaken for success", () => {
  const text = describePayments([payment({ status: "created" }), payment({ status: "created" })]);
  expect(text).toContain("2 payment attempts");
  expect(text).toContain("No money has been taken");
  expect(capturedPayment([payment({ status: "created" })])).toBeNull();
});

test("paise are rendered as rupees, not as a raw integer", () => {
  // 144167 paise is ₹1,441.67 — showing "₹144167" would be alarming nonsense.
  expect(describePayments([payment({ amount: 144167 })])).toContain("₹1441.67");
});
