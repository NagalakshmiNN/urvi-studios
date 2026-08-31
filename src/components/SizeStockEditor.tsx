"use client";

import { useState } from "react";

type Row = { key: number; label: string; stock: number };

let rowKeySeq = 1;

export default function SizeStockEditor({
  initialSizes,
}: {
  initialSizes?: { label: string; stock: number }[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialSizes && initialSizes.length
      ? initialSizes.map((s) => ({ key: rowKeySeq++, label: s.label, stock: s.stock }))
      : [{ key: rowKeySeq++, label: "", stock: 0 }]
  );

  function addRow() {
    setRows((r) => [...r, { key: rowKeySeq++, label: "", stock: 0 }]);
  }
  function removeRow(key: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));
  }
  function setLabel(key: number, label: string) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, label } : row)));
  }
  function setStock(key: number, stock: number) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, stock } : row)));
  }

  const total = rows.reduce((sum, r) => sum + (Number.isFinite(r.stock) ? r.stock : 0), 0);

  return (
    <div>
      {rows.map((row) => (
        <div key={row.key} className="form-row" style={{ alignItems: "flex-end", marginBottom: 6 }}>
          <div className="form-group" style={{ maxWidth: 140 }}>
            <label>Size</label>
            <input
              type="text"
              name="sizeLabel"
              value={row.label}
              placeholder="e.g. M"
              onChange={(e) => setLabel(row.key, e.target.value)}
            />
          </div>
          <div className="form-group" style={{ maxWidth: 110 }}>
            <label>Pieces on hand</label>
            <input
              type="number"
              name="sizeStock"
              min={0}
              value={row.stock}
              onChange={(e) => setStock(row.key, Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </div>
          <div className="form-group" style={{ maxWidth: 80 }}>
            <button type="button" className="link-btn danger" onClick={() => removeRow(row.key)} style={{ marginBottom: 12 }}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-small" onClick={addRow} style={{ marginTop: 4, marginBottom: 6 }}>
        + Add Size
      </button>
      <p className="field-hint">
        Total stock: <strong>{total}</strong> pieces across {rows.filter((r) => r.label.trim()).length || 0} size
        {rows.filter((r) => r.label.trim()).length === 1 ? "" : "s"} — this replaces the old single stock number, so the
        site can tell customers exactly which sizes are running low or sold out.
      </p>
    </div>
  );
}
