import Link from "next/link";
import Image from "next/image";
import { getCustomerSession } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import HeaderClient from "./HeaderClient";

const NAV_LINKS = [
  { href: "/shop?cat=Everyday", label: "Everyday" },
  { href: "/shop?cat=Office", label: "Office" },
  { href: "/shop?cat=Occasion", label: "Occasion" },
  { href: "/shop", label: "Shop All" },
  { href: "/about", label: "Our Story" },
  { href: "/contact", label: "Contact" },
];

export default async function SiteHeader({ active }: { active?: string }) {
  const customerId = await getCustomerSession();
  let customerName: string | null = null;
  if (customerId) {
    const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, customerId) });
    customerName = customer?.name ?? null;
  }

  return (
    <header className="site-header">
      <div className="announce-bar devanagari">
        आत्मविश्वासवस्त्रम् · Confidence, worn.
      </div>
      <div className="header-inner container">
        <Link href="/" className="brand">
          <Image src="/brand/logo-mark.png" alt="Urvi Studios" width={46} height={40} className="brand-mark" priority />
          URVI<span className="brand-sub">Studios</span>
        </Link>
        <nav className="main-nav" id="main-nav">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={active === l.label ? "active" : ""}>
              {l.label}
            </Link>
          ))}
          <div className="mobile-only-account">
            {customerName ? (
              <Link href="/account">My Account</Link>
            ) : (
              <Link href="/account/login">Login</Link>
            )}
          </div>
        </nav>
        <HeaderClient customerName={customerName} />
      </div>
    </header>
  );
}
