// The forgot-password and reset-password flow: requesting a link, receiving
// the email, resetting the password, and logging in with the new one.

import { test, expect } from "@playwright/test";
import { deleteCustomerByEmail, query, queryOne, uniqueEmail } from "../setup/db";
import { registerCustomer, loginAsCustomer } from "../setup/fixtures";
import { OUTBOX_FILE } from "../setup/env";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

/** Read the mail outbox and return the lines as parsed objects. */
function readOutbox(): Array<{ to: string; subject: string; text: string; html?: string; at: string }> {
  if (!existsSync(OUTBOX_FILE)) return [];
  return readFileSync(OUTBOX_FILE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Extract the reset token from the email text body sent to `email`. */
function extractResetToken(email: string): string | null {
  const mails = readOutbox();
  const match = mails
    .filter((m) => m.to === email && m.subject.toLowerCase().includes("reset"))
    .pop();
  if (!match) return null;
  const tokenMatch = match.text.match(/token=([a-f0-9]{64})/);
  return tokenMatch ? tokenMatch[1] : null;
}

test.describe("forgot-password flow", () => {
  let email: string;
  let password: string;

  test.beforeEach(async ({ page }) => {
    const creds = await registerCustomer(page);
    email = creds.email;
    password = creds.password;
    // Sign out so we're unauthenticated
    await page.context().clearCookies();
  });

  test.afterEach(async () => {
    // Clean up: remove customer and any reset tokens
    await query("DELETE FROM password_reset_tokens WHERE customer_id IN (SELECT id FROM customers WHERE lower(email) = lower($1))", [email]);
    await deleteCustomerByEmail(email);
  });

  test("forgot-password page is accessible without login", async ({ page }) => {
    await page.goto("/account/forgot-password");
    // Should NOT redirect to login
    await expect(page).toHaveURL(/\/account\/forgot-password/);
    await expect(page.locator("h1")).toContainText(/forgot|reset/i);
    // The form should be visible
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("reset-password page is accessible without login", async ({ page }) => {
    await page.goto("/account/reset-password?token=nonexistent");
    // Should NOT redirect to login
    await expect(page).toHaveURL(/\/account\/reset-password/);
  });

  test("submitting the form shows a success message", async ({ page }) => {
    await page.goto("/account/forgot-password");
    await page.fill('input[name="email"]', email);
    await page.click('button[type="submit"]');

    // Should show the success confirmation (not an error, not the form again)
    await expect(page.locator("text=check your email")).toBeVisible({ timeout: 10000 });
  });

  test("submitting an unknown email also shows success (no enumeration)", async ({ page }) => {
    await page.goto("/account/forgot-password");
    await page.fill('input[name="email"]', "nobody-here@example.com");
    await page.click('button[type="submit"]');

    // Same success message — should not reveal whether the email exists
    await expect(page.locator("text=check your email")).toBeVisible({ timeout: 10000 });
  });

  test("a reset token is created in the database", async ({ page }) => {
    await page.goto("/account/forgot-password");
    await page.fill('input[name="email"]', email);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=check your email")).toBeVisible({ timeout: 10000 });

    // Check the database for the token
    const tokens = await query<{ token: string; expires_at: string }>(
      `SELECT prt.token, prt.expires_at
       FROM password_reset_tokens prt
       JOIN customers c ON c.id = prt.customer_id
       WHERE lower(c.email) = lower($1) AND prt.used_at IS NULL`,
      [email]
    );
    expect(tokens.length).toBeGreaterThanOrEqual(1);
    // The token should expire roughly 1 hour from now
    const expiry = new Date(tokens[0].expires_at);
    const diff = expiry.getTime() - Date.now();
    expect(diff).toBeGreaterThan(50 * 60 * 1000); // at least 50 minutes
    expect(diff).toBeLessThan(70 * 60 * 1000);    // at most 70 minutes
  });

  test("a reset email is sent to the outbox", async ({ page }) => {
    // Clear outbox so we only see this test's mail
    writeFileSync(OUTBOX_FILE, "");

    await page.goto("/account/forgot-password");
    await page.fill('input[name="email"]', email);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=check your email")).toBeVisible({ timeout: 10000 });

    const mails = readOutbox();
    const resetMail = mails.find((m) => m.to === email && m.subject.includes("Reset"));
    expect(resetMail).toBeDefined();
    expect(resetMail!.text).toContain("reset-password?token=");
  });

  test("full reset flow: request → email → new password → login", async ({ page }) => {
    // Clear outbox
    writeFileSync(OUTBOX_FILE, "");

    // Step 1: Request reset
    await page.goto("/account/forgot-password");
    await page.fill('input[name="email"]', email);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=check your email")).toBeVisible({ timeout: 10000 });

    // Step 2: Extract the token from the outbox email
    const token = extractResetToken(email);
    expect(token).toBeTruthy();

    // Step 3: Visit the reset page with the token
    await page.goto(`/account/reset-password?token=${token}`);
    await expect(page).toHaveURL(/\/account\/reset-password/);
    // The password fields should be visible (valid token)
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirm"]')).toBeVisible();

    // Step 4: Set a new password
    const newPassword = "BrandNewPass456!";
    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="confirm"]', newPassword);
    await page.click('button[type="submit"]');

    // Should show success
    await expect(page.locator("text=/password.*reset|reset.*success/i")).toBeVisible({ timeout: 10000 });

    // Step 5: Log in with the new password
    await page.context().clearCookies();
    await loginAsCustomer(page, email, newPassword);
    await expect(page).toHaveURL(/\/account$/);

    // Step 6: Old password should no longer work
    await page.context().clearCookies();
    await page.goto("/account/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    // Should stay on login with an error
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test("expired token shows an error", async ({ page }) => {
    // Insert a token that expired an hour ago
    const customer = await queryOne<{ id: string }>(
      "SELECT id FROM customers WHERE lower(email) = lower($1)",
      [email]
    );
    expect(customer).toBeTruthy();
    const expiredToken = "a".repeat(64);
    await query(
      `INSERT INTO password_reset_tokens (customer_id, token, expires_at)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
      [customer!.id, expiredToken]
    );

    await page.goto(`/account/reset-password?token=${expiredToken}`);
    await page.fill('input[name="password"]', "NewPass123!");
    await page.fill('input[name="confirm"]', "NewPass123!");
    await page.click('button[type="submit"]');

    // Should show an expiration/invalid error
    await expect(page.locator("text=/expired|already been used|request a new/i")).toBeVisible({ timeout: 10000 });
  });

  test("already-used token shows an error", async ({ page }) => {
    // Insert a token that's been used
    const customer = await queryOne<{ id: string }>(
      "SELECT id FROM customers WHERE lower(email) = lower($1)",
      [email]
    );
    expect(customer).toBeTruthy();
    const usedToken = "b".repeat(64);
    await query(
      `INSERT INTO password_reset_tokens (customer_id, token, expires_at, used_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())`,
      [customer!.id, usedToken]
    );

    await page.goto(`/account/reset-password?token=${usedToken}`);
    await page.fill('input[name="password"]', "NewPass123!");
    await page.fill('input[name="confirm"]', "NewPass123!");
    await page.click('button[type="submit"]');

    // Should show an expiration/already-used error
    await expect(page.locator("text=/expired|already been used|request a new/i")).toBeVisible({ timeout: 10000 });
  });

  test("mismatched passwords are rejected", async ({ page }) => {
    // Get a valid token via DB
    const customer = await queryOne<{ id: string }>(
      "SELECT id FROM customers WHERE lower(email) = lower($1)",
      [email]
    );
    const validToken = "c".repeat(64);
    await query(
      `INSERT INTO password_reset_tokens (customer_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [customer!.id, validToken]
    );

    await page.goto(`/account/reset-password?token=${validToken}`);
    await page.fill('input[name="password"]', "NewPass123!");
    await page.fill('input[name="confirm"]', "DifferentPass456!");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=/do not match|don't match|mismatch/i")).toBeVisible({ timeout: 10000 });
  });

  test("too-short password is rejected", async ({ page }) => {
    const customer = await queryOne<{ id: string }>(
      "SELECT id FROM customers WHERE lower(email) = lower($1)",
      [email]
    );
    const validToken = "d".repeat(64);
    await query(
      `INSERT INTO password_reset_tokens (customer_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [customer!.id, validToken]
    );

    await page.goto(`/account/reset-password?token=${validToken}`);
    await page.fill('input[name="password"]', "short");
    await page.fill('input[name="confirm"]', "short");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=/at least 8/i")).toBeVisible({ timeout: 10000 });
  });

  test("login page has a link to forgot-password", async ({ page }) => {
    await page.goto("/account/login");
    const forgotLink = page.locator('a[href*="forgot-password"]');
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();
    await expect(page).toHaveURL(/\/account\/forgot-password/);
  });
});
