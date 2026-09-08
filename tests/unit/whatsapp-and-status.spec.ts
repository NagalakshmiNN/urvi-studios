// Phone-number handling for the "message the customer on WhatsApp" links,
// and a completeness check on the customer-facing wording for order statuses.

import { test, expect } from "@playwright/test";
import { normalizeIndianPhone, whatsappLink } from "../../src/lib/whatsapp";
import { STATUS_LABELS, STATUS_CUSTOMER_LINES } from "../../src/lib/order-status-copy";

// Every status the admin dropdown offers. If someone adds a status to the
// dropdown without adding customer wording for it, the update email and the
// WhatsApp link would silently do nothing — this list is the guard.
const ADMIN_DROPDOWN_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

test.describe("Indian phone normalization", () => {
  test("adds the country code to a plain 10-digit mobile", () => {
    expect(normalizeIndianPhone("9876500001")).toBe("919876500001");
  });

  test("strips spaces, dashes and brackets before deciding", () => {
    expect(normalizeIndianPhone("98765 00001")).toBe("919876500001");
    expect(normalizeIndianPhone("98765-00001")).toBe("919876500001");
    expect(normalizeIndianPhone("(98765) 00001")).toBe("919876500001");
  });

  test("drops a leading zero", () => {
    expect(normalizeIndianPhone("09876500001")).toBe("919876500001");
  });

  test("leaves an already-prefixed number alone", () => {
    expect(normalizeIndianPhone("919876500001")).toBe("919876500001");
    expect(normalizeIndianPhone("+91 98765 00001")).toBe("919876500001");
  });
});

test.describe("WhatsApp links", () => {
  test("builds a wa.me link with the message URL-encoded", () => {
    const link = whatsappLink("9876500001", "Hi Asha, your order URVI-2026-00001 has shipped.");
    expect(link).toMatch(/^https:\/\/wa\.me\/919876500001\?text=/);
    expect(link).toContain("URVI-2026-00001");
    expect(link).not.toContain(" ");
  });
});

test.describe("customer-facing status wording", () => {
  test("every status in the admin dropdown has a label and a customer line", () => {
    for (const status of ADMIN_DROPDOWN_STATUSES) {
      expect(STATUS_LABELS[status], `missing label for ${status}`).toBeTruthy();
      expect(STATUS_CUSTOMER_LINES[status], `missing customer wording for ${status}`).toBeTruthy();
    }
  });

  test("the wording is written to the customer, not about them", () => {
    expect(STATUS_CUSTOMER_LINES.SHIPPED.toLowerCase()).toContain("your order");
    expect(STATUS_CUSTOMER_LINES.DELIVERED.toLowerCase()).toContain("delivered");
    expect(STATUS_LABELS.OUT_FOR_DELIVERY).toBe("Out for Delivery");
  });
});
