"use server";

import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { getCustomerSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type AddressState = { error?: string } | undefined;

export async function addAddressAction(_prev: AddressState, formData: FormData): Promise<AddressState> {
  const customerId = await getCustomerSession();
  if (!customerId) return { error: "Please log in." };

  const label = String(formData.get("label") || "Home").trim();
  const line1 = String(formData.get("line1") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const state = String(formData.get("state") || "").trim();
  const pincode = String(formData.get("pincode") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!line1 || !city || !state || !pincode || !phone) {
    return { error: "Please fill in every field." };
  }
  if (!/^\d{6}$/.test(pincode)) return { error: "Enter a valid 6-digit pincode." };

  const existingCount = await db.query.addresses.findMany({ where: eq(schema.addresses.customerId, customerId) });
  await db.insert(schema.addresses).values({
    customerId,
    label,
    line1,
    city,
    state,
    pincode,
    phone,
    isDefault: existingCount.length === 0,
  });

  revalidatePath("/account/addresses");
  return undefined;
}

export async function deleteAddressAction(addressId: string) {
  const customerId = await getCustomerSession();
  if (!customerId) return;
  await db.delete(schema.addresses).where(and(eq(schema.addresses.id, addressId), eq(schema.addresses.customerId, customerId)));
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressAction(addressId: string) {
  const customerId = await getCustomerSession();
  if (!customerId) return;
  await db.update(schema.addresses).set({ isDefault: false }).where(eq(schema.addresses.customerId, customerId));
  await db.update(schema.addresses).set({ isDefault: true }).where(and(eq(schema.addresses.id, addressId), eq(schema.addresses.customerId, customerId)));
  revalidatePath("/account/addresses");
}
