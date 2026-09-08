// Checkout, end to end in the browser: the guest-or-account choice, the
// silent account a guest gets, the block that protects an existing account,
// coupons, and what the shopper is told afterwards.

import { test, expect } from "@playwright/test";
import {
  createTestProduct,
  deleteTestProduct,
  deleteOrderByNumber,
  deleteCustomerByEmail,
  getOrderByNumber,
  queryOne,
  uniqueEmail,
} from "../setup/db";
import { seedCart, fillCheckoutForm, placedOrderNumber, registerCustomer } from "../setup/fixtures";
import { outboxLength, waitForMail } from "../setup/outbox";

type Product = Awaited<ReturnType<typeof createTestProduct>>;
let product: Product;

test.beforeAll(async () => {
  product = await createTestProduct({ name: "Checkout Test Piece", price: 2400, stock: 30 });
});

test.afterAll(async () => {
  await deleteTestProduct(product.id);
});

function cartLine(qty = 1) {
  return {
    productId: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    price: product.price,
    image: "/placeholders/casual-wear.svg",
    size: "M",
    color: product.colors[0].name,
    qty,
  };
}

test("an empty bag can't reach the checkout form", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page.locator(".empty-state h3")).toHaveText("Your bag is empty");
});

test.describe("guest or account", () => {
  test("a logged-out shopper is offered both, and neither is forced", async ({ page }) => {
    await seedCart(page, [cartLine()]);
    await page.goto("/checkout");

    await expect(page.locator(".checkout-choice")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue as Guest" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Login or Create an Account" })).toHaveAttribute(
      "href",
      "/account/login?next=%2Fcheckout"
    );
    // The shipping form stays hidden until they choose.
    await expect(page.locator('input[name="address"]')).toHaveCount(0);
  });

  test("choosing guest reveals the shipping form", async ({ page }) => {
    await seedCart(page, [cartLine()]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();

    await expect(page.locator('input[name="address"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    // And it says what those details are for.
    await expect(page.locator(".promo-note", { hasText: "email and WhatsApp you updates" })).toBeVisible();
  });

  test("a logged-in shopper skips the choice and gets a prefilled form", async ({ page }) => {
    const { email } = await registerCustomer(page, { name: "Prefill Tester" });
    await seedCart(page, [cartLine()]);
    await page.goto("/checkout");

    await expect(page.locator(".checkout-choice")).toHaveCount(0);
    await expect(page.locator('input[name="email"]')).toHaveValue(email);
    await expect(page.locator('input[name="name"]')).toHaveValue("Prefill Tester");

    await deleteCustomerByEmail(email);
  });
});

test.describe("placing an order as a guest", () => {
  test("creates the order, saves an account, and signs the shopper in", async ({ page }) => {
    const email = uniqueEmail("browserguest");
    const marker = outboxLength();

    await seedCart(page, [cartLine(2)]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();

    // The summary should already show the right money.
    await expect(page.locator(".summary-row.total")).toContainText("₹4,800");

    await fillCheckoutForm(page, { email, name: "Guest Buyer" });
    await page.getByRole("button", { name: "Place Order" }).click();

    const orderNumber = await placedOrderNumber(page);

    // The confirmation explains the WhatsApp handoff and the saved account.
    await expect(page.getByRole("button", { name: "Send Order on WhatsApp" })).toBeVisible();
    await expect(page.locator(".promo-note", { hasText: "saved your details" })).toContainText(email);

    // The order is real, and tied to a real new account.
    const order = await getOrderByNumber(orderNumber);
    expect(order!.total).toBe(4800);
    expect(order!.customer_name).toBe("Guest Buyer");
    const customer = await queryOne<{ id: string }>("select id from customers where lower(email) = lower($1)", [email]);
    expect(order!.customer_id).toBe(customer!.id);

    // They really are signed in — no password ever entered.
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/account\/orders$/);
    await expect(page.locator(".order-card-num")).toHaveText(orderNumber);

    // And they were emailed a confirmation.
    const mail = await waitForMail(marker, (m) => m.to === email);
    expect(mail.subject).toContain(orderNumber);

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });

  test("won't take a guest order on an email that already has an account", async ({ page }) => {
    const { email } = await registerCustomer(page);
    await page.context().clearCookies();

    await seedCart(page, [cartLine()]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();
    await fillCheckoutForm(page, { email });
    await page.getByRole("button", { name: "Place Order" }).click();

    const notice = page.locator(".notice-box.error");
    await expect(notice).toContainText("An account already exists");
    // With a way straight to the fix, carrying the email over.
    await expect(notice.locator("a")).toHaveAttribute("href", new RegExp(`email=${encodeURIComponent(email)}`));

    await deleteCustomerByEmail(email);
  });
});

test.describe("placing an order while logged in", () => {
  test("files the order under the account and shows it in order history", async ({ page }) => {
    const { email } = await registerCustomer(page);
    await seedCart(page, [cartLine()]);
    await page.goto("/checkout");

    await fillCheckoutForm(page, { email });
    await page.getByRole("button", { name: "Place Order" }).click();
    const orderNumber = await placedOrderNumber(page);

    await page.goto("/account/orders");
    await expect(page.locator(".order-card-num")).toHaveText(orderNumber);

    // The order detail page shows the Product ID for fulfilment.
    await page.locator(".order-card").click();
    await expect(page.locator(".order-items-list")).toContainText(product.sku);
    await expect(page.locator(".summary-row.total")).toContainText("₹2,400");

    await deleteOrderByNumber(orderNumber);
    await deleteCustomerByEmail(email);
  });
});

test.describe("the checkout summary", () => {
  test("applies a coupon and drops the total", async ({ page }) => {
    await seedCart(page, [cartLine(1)]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();

    await page.fill('.coupon-row input', "WELCOME10");
    await page.locator(".coupon-row button", { hasText: "Apply" }).click();

    await expect(page.locator(".summary-card")).toContainText("applied");
    await expect(page.locator(".summary-row", { hasText: "Discount" })).toContainText("240");
    await expect(page.locator(".summary-row.total")).toContainText("₹2,160");
  });

  test("editing the bag from checkout re-does the maths", async ({ page }) => {
    await seedCart(page, [cartLine(1)]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();
    await expect(page.locator(".summary-row.total")).toContainText("₹2,400");

    await page.locator("#checkout-lines .qty-stepper button").nth(1).click(); // +
    await expect(page.locator(".summary-row.total")).toContainText("₹4,800");

    await page.locator("#checkout-lines .link-btn", { hasText: "Remove" }).click();
    await expect(page.locator(".empty-state h3")).toHaveText("Your bag is empty");
  });

  test("rejects an order for more pieces than the size has", async ({ page }) => {
    const scarce = await createTestProduct({ name: "Nearly Sold Out Piece", price: 1500, stock: 3, sizes: ["M"] });
    await seedCart(page, [
      {
        productId: scarce.id,
        sku: scarce.sku,
        slug: scarce.slug,
        name: scarce.name,
        price: scarce.price,
        image: "/placeholders/casual-wear.svg",
        size: "M",
        color: scarce.colors[0].name,
        qty: 5,
      },
    ]);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continue as Guest" }).click();
    await fillCheckoutForm(page, { email: uniqueEmail("scarce") });
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page.locator(".notice-box.error")).toContainText("left in size M");
    await deleteTestProduct(scarce.id);
  });
});
