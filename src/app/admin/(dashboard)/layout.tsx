import Link from "next/link";
import Image from "next/image";
import { getAdminSession, clearAdminSession } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/messages", label: "Messages" },
];

async function adminLogout() {
  "use server";
  await clearAdminSession();
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminId = await getAdminSession();
  // Login page has its own layout (no sidebar); proxy.ts already redirects
  // unauthenticated visits to /admin/login before this ever renders, but the
  // guard stays here too so this layout is safe if ever reached directly.
  if (!adminId) redirect("/admin/login");

  const admin = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, adminId) });

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
          <Image src="/brand/logo-mark.png" alt="" width={32} height={26} style={{ height: 28, width: "auto" }} />
          URVI <span style={{ opacity: 0.6, fontSize: 13 }}>Admin</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>
        <form action={adminLogout} style={{ marginTop: 24 }}>
          <button type="submit" style={{ background: "none", border: "none", color: "rgba(247,240,228,0.6)", fontSize: 12.5, cursor: "pointer", padding: "10px 12px" }}>
            Logout {admin ? `(${admin.name})` : ""}
          </button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
