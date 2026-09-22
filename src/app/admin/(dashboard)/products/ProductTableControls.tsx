"use client";

// Search and page size, both held in the address bar.
//
// Deliberately not component state: a URL that carries the search and the
// page can be bookmarked, reloaded and — the reason that matters here —
// returned to. Editing a product navigates away, and coming back to page 4
// of a search for "kurti" rather than the top of 200 rows is the difference
// between the screen being usable and not.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PAGE_SIZES } from "@/lib/table-paging";

export default function ProductTableControls({ total, showing }: { total: number; showing: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  // Typing shouldn't navigate on every keystroke — that re-renders the table
  // and steals focus. A short pause after the last key is enough.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      // Any change to the filter invalidates the page number: page 4 of the
      // old list is not page 4 of the new one.
      next.delete("page");
      router.replace(`/admin/products?${next.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, params, router]);

  function setPerPage(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("per", value);
    next.delete("page");
    router.replace(`/admin/products?${next.toString()}`);
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, product ID or category"
        aria-label="Search products"
        style={{
          flex: "1 1 280px",
          maxWidth: 420,
          padding: "9px 12px",
          fontSize: 14,
          border: "1px solid var(--line, #e2e0d8)",
          borderRadius: 6,
          background: "#fff",
        }}
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, color: "var(--sage)" }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{showing}</span>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Rows
          <select
            value={String(params.get("per") ?? 25)}
            onChange={(e) => setPerPage(e.target.value)}
            aria-label="Rows per page"
            style={{ padding: "6px 8px", fontSize: 13, border: "1px solid var(--line, #e2e0d8)", borderRadius: 6 }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <span className="sr-only" aria-live="polite">{total} products match</span>
    </div>
  );
}
