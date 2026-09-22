import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const adminId = await getAdminSession();
  if (!adminId) redirect("/admin/login");

  const admin = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, adminId) });
  if (!admin) redirect("/admin/login");

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
    </>
  );
}
