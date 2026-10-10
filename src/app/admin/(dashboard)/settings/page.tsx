import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getBoolSetting, setSiteSetting } from "@/lib/site-settings";
import ChangePasswordForm from "./ChangePasswordForm";
import BetaBannerToggle from "./BetaBannerToggle";
import WarehouseManager from "./WarehouseManager";

export const dynamic = "force-dynamic";

async function toggleBetaBanner(enabled: boolean) {
  "use server";
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authenticated");
  await setSiteSetting("beta_banner_enabled", String(enabled));
}

async function saveWarehouse(data: {
  id?: string;
  label: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}) {
  "use server";
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authenticated");

  if (data.id) {
    // Update existing
    await db
      .update(schema.warehouses)
      .set({
        label: data.label,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || "",
        city: data.city,
        state: data.state,
        pincode: data.pincode,
      })
      .where(eq(schema.warehouses.id, data.id));
  } else {
    // Insert new — if this is the first warehouse, make it default
    const existing = await db.query.warehouses.findMany();
    await db.insert(schema.warehouses).values({
      id: crypto.randomUUID(),
      label: data.label,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || "",
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      isDefault: existing.length === 0,
    });
  }
  return { success: true };
}

async function deleteWarehouse(id: string) {
  "use server";
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authenticated");
  await db.delete(schema.warehouses).where(eq(schema.warehouses.id, id));
  return { success: true };
}

async function setDefaultWarehouse(id: string) {
  "use server";
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authenticated");
  // Clear all defaults, then set the one
  await db.update(schema.warehouses).set({ isDefault: false });
  await db.update(schema.warehouses).set({ isDefault: true }).where(eq(schema.warehouses.id, id));
  return { success: true };
}

export default async function AdminSettingsPage() {
  const adminId = await getAdminSession();
  if (!adminId) redirect("/admin/login");

  const admin = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, adminId) });
  if (!admin) redirect("/admin/login");

  const betaBannerEnabled = await getBoolSetting("beta_banner_enabled");
  const allWarehouses = await db.query.warehouses.findMany({ orderBy: (w, { asc }) => [asc(w.label)] });

  return (
    <>
      <div className="admin-header">
        <h1>Settings</h1>
      </div>

      <div className="admin-card" style={{ padding: "22px 24px", maxWidth: 560 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>Your password</h3>
        <p style={{ fontSize: 13, color: "var(--sage)", lineHeight: 1.75, margin: "0 0 20px" }}>
          Signed in as <strong>{admin.email}</strong>.
          {admin.passwordChangedAt
            ? ` Last changed ${admin.passwordChangedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`
            : " This password has never been changed from the one the site was set up with."}
        </p>
        <ChangePasswordForm />
      </div>

      <div className="admin-card" style={{ padding: "22px 24px", maxWidth: 560, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>Beta banner</h3>
        <p style={{ fontSize: 13, color: "var(--sage)", lineHeight: 1.75, margin: "0 0 16px" }}>
          Show a small &ldquo;This site is in beta&rdquo; notice at the bottom of every page &mdash; storefront and admin.
        </p>
        <BetaBannerToggle initialEnabled={betaBannerEnabled} toggleAction={toggleBetaBanner} />
      </div>

      <div className="admin-card" style={{ padding: "22px 24px", maxWidth: 560, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>Warehouses</h3>
        <p style={{ fontSize: 13, color: "var(--sage)", lineHeight: 1.75, margin: "0 0 16px" }}>
          Saved pickup &amp; return addresses for Shadowfax shipments. The default warehouse is auto-selected when you create a shipment.
        </p>
        <WarehouseManager
          initialWarehouses={allWarehouses}
          saveAction={saveWarehouse}
          deleteAction={deleteWarehouse}
          setDefaultAction={setDefaultWarehouse}
        />
      </div>
    </>
  );
}
