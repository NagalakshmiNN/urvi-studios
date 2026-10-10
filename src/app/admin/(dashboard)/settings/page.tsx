import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getBoolSetting, setSiteSetting } from "@/lib/site-settings";
import ChangePasswordForm from "./ChangePasswordForm";
import BetaBannerToggle from "./BetaBannerToggle";

export const dynamic = "force-dynamic";

async function toggleBetaBanner(enabled: boolean) {
  "use server";
  const adminId = await getAdminSession();
  if (!adminId) throw new Error("Not authenticated");
  await setSiteSetting("beta_banner_enabled", String(enabled));
}

export default async function AdminSettingsPage() {
  const adminId = await getAdminSession();
  if (!adminId) redirect("/admin/login");

  const admin = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, adminId) });
  if (!admin) redirect("/admin/login");

  const betaBannerEnabled = await getBoolSetting("beta_banner_enabled");

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
    </>
  );
}
