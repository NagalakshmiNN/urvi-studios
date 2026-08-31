"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { created: number; updated: number; skippedExample: number; errors: { row: number; reason: string }[] } | null;

export default function ImportForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .xlsx file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/import-products", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong reading that file.");
      } else {
        setResult(data);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="notice-box error">{error}</div>}
      {result && (
        <div className="notice-box">
          Added {result.created} product{result.created === 1 ? "" : "s"}.
          {result.updated > 0 && ` Updated ${result.updated} existing product${result.updated === 1 ? "" : "s"} (matched by Product ID).`}
          {result.skippedExample > 0 && ` Skipped the example row.`}
          {result.errors.length > 0 && ` ${result.errors.length} row(s) had a problem — see below.`}
        </div>
      )}
      {result && result.errors.length > 0 && (
        <table className="admin-table" style={{ marginBottom: 18 }}>
          <thead><tr><th>Row</th><th>Problem</th></tr></thead>
          <tbody>
            {result.errors.map((e) => (
              <tr key={e.row}><td>{e.row}</td><td>{e.reason}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="form-group">
        <label>Workbook (.xlsx)</label>
        <input ref={fileRef} type="file" accept=".xlsx" />
        <p className="field-hint">
          Use the same template you were sent — headers must include Category, Product Name, and Price at minimum.
          Leave <strong>Product ID</strong> blank to create a new product; fill it in (as exported below) to update
          an existing one instead of creating a duplicate. Photos pasted into the sheet aren&apos;t pulled in
          automatically; new products get a placeholder image until real photos are added via Edit.
        </p>
      </div>

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Importing…" : "Import Products"}
      </button>

      <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
        <label style={{ display: "block", marginBottom: 8 }}>Already have products in the catalog?</label>
        <a href="/api/admin/export-products" className="btn btn-outline btn-small">Export Current Catalog to Excel</a>
        <p className="field-hint" style={{ marginTop: 10 }}>
          Downloads every product with its Product ID already filled in — edit any row and re-upload it above to
          update that product, or add new rows below with Product ID left blank.
        </p>
      </div>
    </form>
  );
}
