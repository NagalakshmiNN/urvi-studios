import { test, expect } from "@playwright/test";
import { displayName } from "../../src/lib/display-names";

test("Lakshmi and Nagalakshmi are shown as RamaVijaya, whatever the capitals", () => {
  expect(displayName("Lakshmi")).toBe("RamaVijaya");
  expect(displayName("  nagalakshmi ")).toBe("RamaVijaya");
});

test("other names are left exactly as they are", () => {
  expect(displayName("Shilpa")).toBe("Shilpa");
  expect(displayName("Someone Else")).toBe("Someone Else");
});
