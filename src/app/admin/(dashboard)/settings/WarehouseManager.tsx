"use client";

import { useState, useTransition } from "react";

interface Warehouse {
  id: string;
  label: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface FormState {
  label: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

const emptyForm: FormState = {
  label: "",
  contactName: "",
  contactPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
};

export default function WarehouseManager({
  initialWarehouses,
  saveAction,
  deleteAction,
  setDefaultAction,
}: {
  initialWarehouses: Warehouse[];
  saveAction: (data: FormState & { id?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
  setDefaultAction: (id: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function startAdd() {
    setEditing("new");
    setForm(emptyForm);
    setError("");
  }

  function startEdit(w: Warehouse) {
    setEditing(w.id);
    setForm({
      label: w.label,
      contactName: w.contactName,
      contactPhone: w.contactPhone,
      addressLine1: w.addressLine1,
      addressLine2: w.addressLine2 || "",
      city: w.city,
      state: w.state,
      pincode: w.pincode,
    });
    setError("");
  }

  function cancel() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
  }

  function handleSave() {
    if (!form.label || !form.contactName || !form.contactPhone || !form.addressLine1 || !form.city || !form.state || !form.pincode) {
      setError("Please fill in all required fields.");
      return;
    }
    startTransition(async () => {
      const result = await saveAction({
        ...form,
        ...(editing !== "new" ? { id: editing! } : {}),
      });
      if (result.success) {
        window.location.reload();
      } else {
        setError(result.error || "Failed to save.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this warehouse address?")) return;
    startTransition(async () => {
      const result = await deleteAction(id);
      if (result.success) {
        setWarehouses((prev) => prev.filter((w) => w.id !== id));
      } else {
        setError(result.error || "Failed to delete.");
      }
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const result = await setDefaultAction(id);
      if (result.success) {
        setWarehouses((prev) =>
          prev.map((w) => ({ ...w, isDefault: w.id === id }))
        );
      }
    });
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "inherit",
  } as const;

  const labelStyle = {
    display: "block",
    fontSize: 12,
    fontWeight: 500 as const,
    color: "var(--sage, #6A7444)",
    marginBottom: 4,
  };

  return (
    <div>
      {warehouses.length === 0 && !editing && (
        <p style={{ fontSize: 13, color: "var(--sage)", margin: "0 0 16px" }}>
          No warehouse addresses saved yet. Add one to use when creating shipments.
        </p>
      )}

      {warehouses.map((w) => (
        <div
          key={w.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "12px 14px",
            background: w.isDefault ? "var(--ivory, #F7F0E4)" : "#fafafa",
            borderRadius: 8,
            marginBottom: 10,
            border: w.isDefault ? "1px solid var(--sand, #EFE4D0)" : "1px solid #eee",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 14 }}>{w.label}</strong>
              {w.isDefault && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "var(--olive, #3F4827)",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Default
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: "#666", lineHeight: 1.6 }}>
              {w.contactName} &middot; {w.contactPhone}
              <br />
              {w.addressLine1}
              {w.addressLine2 ? `, ${w.addressLine2}` : ""}
              <br />
              {w.city}, {w.state} &mdash; {w.pincode}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
            {!w.isDefault && (
              <button
                onClick={() => handleSetDefault(w.id)}
                disabled={isPending}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 5,
                  background: "#fff",
                  cursor: "pointer",
                }}
                title="Set as default"
              >
                Set default
              </button>
            )}
            <button
              onClick={() => startEdit(w)}
              disabled={isPending || editing !== null}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                border: "1px solid #ddd",
                borderRadius: 5,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(w.id)}
              disabled={isPending}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                border: "1px solid #ddd",
                borderRadius: 5,
                background: "#fff",
                cursor: "pointer",
                color: "#c33",
              }}
            >
              &times;
            </button>
          </div>
        </div>
      ))}

      {editing ? (
        <div
          style={{
            padding: "16px",
            border: "1px solid var(--sand, #EFE4D0)",
            borderRadius: 8,
            background: "var(--ivory, #F7F0E4)",
            marginTop: 8,
          }}
        >
          <h4 style={{ fontSize: 14, margin: "0 0 14px" }}>
            {editing === "new" ? "Add warehouse" : "Edit warehouse"}
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Warehouse name *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Koramangala warehouse"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Contact name *</label>
              <input
                style={inputStyle}
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone *</label>
              <input
                style={inputStyle}
                placeholder="10-digit mobile"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Address line 1 *</label>
              <input
                style={inputStyle}
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Address line 2</label>
              <input
                style={inputStyle}
                value={form.addressLine2}
                onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>City *</label>
              <input
                style={inputStyle}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>State *</label>
              <input
                style={inputStyle}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Pincode *</label>
              <input
                style={inputStyle}
                maxLength={6}
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: "#c33", fontSize: 12.5, margin: "12px 0 0" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={handleSave}
              disabled={isPending}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                borderRadius: 6,
                background: "var(--olive, #3F4827)",
                color: "#fff",
                cursor: isPending ? "wait" : "pointer",
              }}
            >
              {isPending ? "Saving…" : editing === "new" ? "Add warehouse" : "Save changes"}
            </button>
            <button
              onClick={cancel}
              disabled={isPending}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                border: "1px solid #ccc",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startAdd}
          style={{
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid var(--olive, #3F4827)",
            borderRadius: 6,
            background: "transparent",
            color: "var(--olive, #3F4827)",
            cursor: "pointer",
            marginTop: warehouses.length > 0 ? 4 : 0,
          }}
        >
          + Add warehouse
        </button>
      )}
    </div>
  );
}
