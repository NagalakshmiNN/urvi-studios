"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { attemptKey, checkThrottle, clearAttempts, lockoutMessage, pruneOldAttempts, recordFailure } from "@/lib/login-throttle";
import { hashPassword, verifyPassword, createCustomerSession, clearCustomerSession, createAdminSession, clearAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export type AuthState = { error?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Where a login or registration may send someone afterwards.
 *
 * The `next` parameter came off the query string and went straight into
 * redirect(), so ?next=https://evil.example or ?next=//evil.example sent the
 * customer off-site the instant they typed their password correctly — a
 * ready-made phishing hop that borrows this site's credibility.
 *
 * Only a path on this site is allowed. A leading "//" is rejected too: the
 * browser reads it as protocol-relative and treats it as another origin.
 */
function safeNext(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return "/account";
  if (value.startsWith("//")) return "/account";
  if (value.includes("\\")) return "/account";
  return value;
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");
  const next = safeNext(formData.get("next"));

  if (!name || name.length < 2) return { error: "Please enter your full name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) });
  if (existing) return { error: "An account with this email already exists — try logging in instead." };

  const passwordHash = await hashPassword(password);
  const [customer] = await db.insert(schema.customers).values({ name, email, phone, passwordHash }).returning();

  await createCustomerSession(customer.id);
  redirect(next);
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeNext(formData.get("next"));

  const key = attemptKey("customer", email);
  const throttle = await checkThrottle(key);
  if (!throttle.allowed) return { error: lockoutMessage(throttle) };

  const customer = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) });

  // One message for both "no such account" and "wrong password". Two
  // different messages tell a stranger which email addresses are registered
  // here, which is a list worth having and not ours to give away.
  const valid = customer ? await verifyPassword(password, customer.passwordHash) : false;
  if (!customer || !valid) {
    await recordFailure(key);
    void pruneOldAttempts();
    return { error: "That email and password don't match. Please try again." };
  }

  await clearAttempts(key);
  await createCustomerSession(customer.id);
  redirect(next);
}

export async function logoutAction() {
  await clearCustomerSession();
  redirect("/");
}

// ------------------------------------------------------------------ Admin

export async function adminLoginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const key = attemptKey("admin", email);
  const throttle = await checkThrottle(key);
  if (!throttle.allowed) return { error: lockoutMessage(throttle) };

  const admin = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.email, email) });
  const valid = admin ? await verifyPassword(password, admin.passwordHash) : false;
  if (!admin || !valid) {
    await recordFailure(key);
    void pruneOldAttempts();
    return { error: "That email and password don't match. Please try again." };
  }

  await clearAttempts(key);
  await createAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
