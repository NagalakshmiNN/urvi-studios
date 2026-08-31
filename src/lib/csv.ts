// Minimal CSV building for the admin data-export downloads. Deliberately not
// a dependency — this is small enough to own outright, and every value here
// is customer-entered text (names, addresses, notes) that can legitimately
// contain commas, quotes, or newlines, so it has to be escaped properly
// rather than joined with a naive `.join(",")`.

type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))];
  // Leading BOM so Excel (still the most likely place these get opened)
  // detects UTF-8 correctly instead of mangling ₹ and non-ASCII names.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvResponseHeaders(filename: string) {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}

export function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
