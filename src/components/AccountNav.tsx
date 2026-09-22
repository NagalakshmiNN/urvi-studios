import Link from "next/link";
import LogoutButton from "./LogoutButton";

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
      <div style={{ marginTop: 10 }}>
        <LogoutButton className="account-nav-logout" />
      </div>
    </nav>
  );
}
