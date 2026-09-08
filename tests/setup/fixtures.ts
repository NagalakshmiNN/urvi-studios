// Shared test fixtures and helpers: logging in as admin or as a customer,
// seeding the browser's cart, and filling the checkout form — the handful of
// things nearly every spec needs.

import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./env";
import { uniqueEmail } from "./db";

export type CartLine = {
  productId: string;
  sku: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  qty: number;
};

export const CART_KEY = "urvi_cart_v2";

/** Put lines straight into the browser's cart before the page loads. */
export async function seedCart(page: Page, lines: CartLine[]) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
    },
    [CART_KEY, JSON.stringify(lines)] as const
  );
}

/** Log in to the admin dashboard. Leaves the page on /admin. */
export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin");
  await expect(page.locator(".admin-header h1")).toHaveText("Dashboard");
}

/** Register a brand-new customer through the real form. Returns the email. */
export async function registerCustomer(
  page: Page,
  opts: { name?: string; email?: string; phone?: string; password?: string } = {}
) {
  const email = opts.email ?? uniqueEmail();
  const password = opts.password ?? "TestShopper123!";
  await page.goto("/account/register");
  await page.fill('input[name="name"]', opts.name ?? "Test Shopper");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', opts.phone ?? "9876500123");
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/account/register"));
  return { email, password };
}

export async function loginAsCustomer(page: Page, email: string, password: string) {
  await page.goto("/account/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/account/login"));
}

export type ShippingDetails = {
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
};

/** Fill every field of the checkout shipping form. */
export async function fillCheckoutForm(page: Page, details: ShippingDetails) {
  await page.fill('input[name="name"]', details.name ?? "Test Shopper");
  await page.fill('input[name="email"]', details.email);
  await page.fill('input[name="phone"]', details.phone ?? "9876500123");
  await page.fill('input[name="address"]', details.address ?? "12 Test Lane, Indiranagar");
  await page.fill('input[name="city"]', details.city ?? "Bengaluru");
  await page.fill('input[name="state"]', details.state ?? "Karnataka");
  await page.fill('input[name="pincode"]', details.pincode ?? "560001");
  if (details.notes) await page.fill('textarea[name="notes"]', details.notes);
}

/** The order number shown on the WhatsApp/COD confirmation panel. */
export async function placedOrderNumber(page: Page): Promise<string> {
  const heading = page.locator(".empty-state h3");
  await expect(heading).toContainText("received", { timeout: 15000 });
  const text = (await heading.textContent()) ?? "";
  const match = text.match(/URVI-\d{4}-\d{5}/);
  if (!match) throw new Error(`No order number in confirmation heading: "${text}"`);
  return match[0];
}

/** An admin-authenticated API context, for hitting admin endpoints directly. */
export async function adminApiContext(context: BrowserContext, page: Page) {
  await loginAsAdmin(page);
  return context.request;
}

export const test = base;
export { expect };
