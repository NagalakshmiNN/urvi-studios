"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, createCustomerSession, clearCustomerSession, createAdminSession, clearAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export type AuthState = { error?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/account");

  if (!name || name.length < 2) return { error: "Please enter your full name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) });
  if (existing) return { error: "An account with this email already exists — try logging in instead." };

  const passwordHash = await hashPassword(password);
  const [customer] = await db.insert(schema.customers).values({ name, email, phone, passwordHash }).returning();

  await createCustomerSession(customer.id);
  redirect(next || "/account");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/account");

  const customer = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) });
  if (!customer) return { error: "No account found with that email." };

  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid) return { error: "Incorrect password." };

  await createCustomerSession(customer.id);
  redirect(next || "/account");
}

export async function logoutAction() {
  await clearCustomerSession();
  redirect("/");
}

// ------------------------------------------------------------------ Admin

export async function adminLoginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const admin = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.email, email) });
  if (!admin) return { error: "No admin account found with that email." };

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) return { error: "Incorrect password." };

  await createAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
