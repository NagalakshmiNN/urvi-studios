import Link from "next/link";
import type { Paging } from "@/lib/table-paging";

// Previous / next and a page count. Rendered as links rather than buttons so
// a page can be opened in a new tab, and so it works before JavaScript does.
export default function ProductPager({ paging, params }: { paging: Paging; params: URLSearchParams }) {
  if (paging.totalPages <= 1) return null;

  const href = (page: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    return `/admin/products?${next.toString()}`;
  };

  const linkStyle = { fontSize: 13, padding: "7px 12px", border: "1px solid var(--line, #e2e0d8)", borderRadius: 6 };
  const mutedStyle = { ...linkStyle, opacity: 0.4, pointerEvents: "none" as const };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "18px 0 4px" }}>
      <Link href={href(paging.page - 1)} style={paging.page <= 1 ? mutedStyle : linkStyle} aria-disabled={paging.page <= 1}>
        ← Previous
      </Link>
      <span style={{ fontSize: 13, color: "var(--sage)", fontVariantNumeric: "tabular-nums" }}>
        Page {paging.page} of {paging.totalPages}
      </span>
      <Link
        href={href(paging.page + 1)}
        style={paging.page >= paging.totalPages ? mutedStyle : linkStyle}
        aria-disabled={paging.page >= paging.totalPages}
      >
        Next →
      </Link>
    </div>
  );
}
