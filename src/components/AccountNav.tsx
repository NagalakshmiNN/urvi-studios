import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
];

export default function AccountNav({ active }: { active: string }) {
  return (
    <nav className="account-nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={l.label === active ? "active" : ""}>
          {l.label}
        </Link>
      ))}
      <form action={logoutAction} style={{ marginTop: 10 }}>
        <button type="submit" className="account-nav-logout">Logout</button>
      </form>
    </nav>
  );
}
