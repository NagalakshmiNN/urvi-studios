"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseAmount, parseSpendDate, isExpenseCategory } from "@/lib/money";

export type MoneyFormState = { error?: string; success?: string } | undefined;

async function requireAdmin() {
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authorised");
  return adminId;
}

/** Every screen whose numbers change when money moves. */
function revalidateMoneyViews() {
  revalidatePath("/admin/money");
  revalidatePath("/admin/money/expenses");
  revalidatePath("/admin/money/capital");
  revalidatePath("/admin");
}

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

// ---------------------------------------------------------------- Capital

export async function recordCapitalAction(_prev: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  await requireAdmin();

  const contributor = String(formData.get("contributor") || "").trim();
  const mode = String(formData.get("mode") || "").trim();

  const date = parseSpendDate(String(formData.get("contributedOn") || ""), "Date");
  if (!date.ok) return { error: date.error };

  const amount = parseAmount(String(formData.get("amount") || ""), "Amount");
  if (!amount.ok) return { error: amount.error };

  if (!contributor) return { error: "Whose money is it? Please enter a name." };
  if (!mode) return { error: "Please choose how it was paid in." };

  await db.insert(schema.capitalContributions).values({
    contributedOn: date.date,
    contributor,
    amountPaise: amount.paise,
    mode,
    reference: optionalText(formData, "reference"),
    notes: optionalText(formData, "notes"),
  });

  revalidateMoneyViews();
  return { success: `Recorded ${contributor}'s contribution.` };
}

export async function deleteCapitalAction(_prev: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing entry." };
  await db.delete(schema.capitalContributions).where(eq(schema.capitalContributions.id, id));
  revalidateMoneyViews();
  return { success: "Entry removed." };
}

// ---------------------------------------------------------------- Expenses

export async function recordExpenseAction(_prev: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  await requireAdmin();

  const category = String(formData.get("category") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const paymentMode = String(formData.get("paymentMode") || "").trim();

  const date = parseSpendDate(String(formData.get("spentOn") || ""), "Date");
  if (!date.ok) return { error: date.error };

  const amount = parseAmount(String(formData.get("amount") || ""), "Amount");
  if (!amount.ok) return { error: amount.error };

  // Checked against the list rather than trusted: this value decides whether
  // the money counts as buying stock or as a running cost, and a typo would
  // silently move it to the wrong side of the money map.
  if (!isExpenseCategory(category)) return { error: "Please choose a category from the list." };
  if (!description) return { error: "Please say what this was for." };
  if (!paymentMode) return { error: "Please choose how it was paid." };

  const gstRaw = String(formData.get("gstRateBp") || "").trim();
  const gstRateBp = gstRaw === "" ? null : Number(gstRaw);
  if (gstRateBp != null && (!Number.isInteger(gstRateBp) || gstRateBp < 0 || gstRateBp > 10_000)) {
    return { error: "That GST rate isn't one of the options." };
  }

  await db.insert(schema.expenses).values({
    spentOn: date.date,
    category,
    description,
    payee: optionalText(formData, "payee"),
    amountPaise: amount.paise,
    gstRateBp,
    paymentMode,
    reference: optionalText(formData, "reference"),
    notes: optionalText(formData, "notes"),
  });

  revalidateMoneyViews();
  return { success: `Recorded ${description}.` };
}

export async function deleteExpenseAction(_prev: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing entry." };
  await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
  revalidateMoneyViews();
  return { success: "Entry removed." };
}
