"use client";

import { useState, useTransition } from "react";
import { createShipmentAction, fetchTrackingAction, cancelShipmentAction } from "@/app/actions/shadowfax";
import { courierStatusLabel } from "@/lib/shadowfax";

interface WarehouseOption {
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

interface ShippingCardProps {
  orderId: string;
  orderNumber: string;
  awbNumber: string | null;
  shadowfaxOrderId: string | null;
  courierStatus: string | null;
  fulfilmentMethod: string;
  customerName: string;
  customerPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  warehouses: WarehouseOption[];
}

function AddressBlock({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div style={{ flex: "1 1 220px", minWidth: 200 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--sage)",
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          padding: "8px 12px",
          background: "rgba(0,0,0,0.03)",
          borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}

export default function ShippingCard({
  orderId,
  orderNumber,
  awbNumber: initialAwb,
  shadowfaxOrderId: initialSfxId,
  courierStatus: initialStatus,
  fulfilmentMethod,
  customerName,
  customerPhone,
  addressLine1,
  city,
  state,
  pincode,
  warehouses,
}: ShippingCardProps) {
  const [pickupId, setPickupId] = useState(
    warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );
  const [returnId, setReturnId] = useState(""); // empty = same as pickup
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [awb, setAwb] = useState(initialAwb);
  const [sfxId, setSfxId] = useState(initialSfxId);
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  // Don't show shipping card for pickup orders
  if (fulfilmentMethod === "pickup") return null;

  const hasShipment = !!sfxId;
  const selectedWarehouse = warehouses.find((w) => w.id === pickupId);

  function handleCreate() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await createShipmentAction(
          orderId,
          pickupId || undefined,
          returnId || undefined,
        );
        if (result.success) {
          const newAwb = result.awbNumber || null;
          const newSfxId = result.shadowfaxOrderId || null;
          setAwb(newAwb);
          setSfxId(newSfxId);
          setStatus("new");
          if (newSfxId) {
            setMessage(`\u2713 Shipment created${newAwb ? ` \u2014 AWB: ${newAwb}` : ""}`);
          } else {
            // API said success but no order ID came back \u2014 flag it
            setMessage(
              "Shadowfax returned success but no order ID. " +
              "Check Shadowfax dashboard or try refreshing the page."
            );
          }
        } else {
          setMessage(result.error || "Failed to create shipment");
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Something went wrong \u2014 please try again");
      }
    });
  }

  function handleRefresh() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await fetchTrackingAction(orderId);
        if (result.success) {
          setStatus(result.currentStatus || status);
          if (result.awbNumber) setAwb(result.awbNumber);
          setMessage("\u2713 Status refreshed");
        } else {
          setMessage(result.error || "Could not fetch tracking");
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not fetch tracking");
      }
    });
  }

  function handleCancel() {
    if (!confirm("Cancel this shipment with Shadowfax? This cannot be undone.")) return;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await cancelShipmentAction(orderId);
        if (result.success) {
          setStatus("cancelled");
          setMessage("\u2713 Shipment cancelled");
        } else {
          setMessage(result.error || "Could not cancel");
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not cancel shipment");
      }
    });
  }

  // Shadowfax public tracking page (official page where you enter AWB)
  const trackingUrl = "https://www.shadowfax.in/track";

  return (
    <div className="admin-card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{"\ud83d\udce6"}</span> Shipping
      </h3>

      {!hasShipment ? (
        <>
          {/* ── No warehouses: block shipment creation ── */}
          {warehouses.length === 0 ? (
            <div
              style={{
                padding: "14px 16px",
                background: "rgba(180, 50, 50, 0.06)",
                borderRadius: 8,
                border: "1px solid rgba(180, 50, 50, 0.15)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "#b43232" }}>No warehouse address configured</strong>
              <p style={{ margin: "6px 0 0", color: "var(--sage)" }}>
                Shadowfax needs a pickup address to schedule collection.
                Go to{" "}
                <a
                  href="/admin/settings"
                  style={{ color: "var(--olive, #3F4827)", textDecoration: "underline" }}
                >
                  Settings {"\u2192"} Warehouses
                </a>{" "}
                and add at least one warehouse, then come back here to create the shipment.
              </p>
            </div>
          ) : (
            <>
              {/* ── Warehouse picker ── */}
              <div style={{ marginBottom: 14, fontSize: 13 }}>
                <label style={{ display: "block", color: "var(--sage)", fontSize: 12, marginBottom: 4 }}>
                  Pickup warehouse
                </label>
                <select
                  value={pickupId}
                  onChange={(e) => setPickupId(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, minWidth: 200 }}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label} {"\u2014"} {w.city} {w.pincode}
                    </option>
                  ))}
                </select>

                {!showReturnPicker ? (
                  <button
                    onClick={() => setShowReturnPicker(true)}
                    style={{
                      display: "block",
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--sage)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Use a different return address
                  </button>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", color: "var(--sage)", fontSize: 12, marginBottom: 4 }}>
                      Return warehouse
                    </label>
                    <select
                      value={returnId}
                      onChange={(e) => setReturnId(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, minWidth: 200 }}
                    >
                      <option value="">Same as pickup</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label} {"\u2014"} {w.city} {w.pincode}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* ── Address confirmation: pickup + shipping side by side ── */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                  marginBottom: 16,
                }}
              >
                {selectedWarehouse && (
                  <AddressBlock
                    label="Pickup from"
                    lines={[
                      selectedWarehouse.label,
                      selectedWarehouse.contactName,
                      selectedWarehouse.contactPhone,
                      selectedWarehouse.addressLine1,
                      ...(selectedWarehouse.addressLine2 ? [selectedWarehouse.addressLine2] : []),
                      `${selectedWarehouse.city}, ${selectedWarehouse.state} ${selectedWarehouse.pincode}`,
                    ]}
                  />
                )}
                <AddressBlock
                  label="Ship to"
                  lines={[
                    customerName,
                    customerPhone,
                    addressLine1,
                    `${city}, ${state} ${pincode}`,
                  ]}
                />
              </div>

              <button
                className="btn"
                onClick={handleCreate}
                disabled={isPending}
                style={{
                  background: "var(--olive, #3F4827)",
                  color: "var(--ivory, #F7F0E4)",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: isPending ? "wait" : "pointer",
                  fontSize: 13,
                }}
              >
                {isPending ? "Creating shipment\u2026" : "Create Shipment on Shadowfax"}
              </button>
            </>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px" }}>
            {awb && (
              <div>
                <span style={{ color: "var(--sage)" }}>AWB:</span>{" "}
                <code style={{ fontSize: 12.5 }}>{awb}</code>
              </div>
            )}
            <div>
              <span style={{ color: "var(--sage)" }}>Shadowfax ID:</span>{" "}
              <code style={{ fontSize: 12.5 }}>{sfxId}</code>
            </div>
          </div>

          {/* ── Tracking link ── */}
          {awb && (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: "var(--sage)" }}>Track:</span>{" "}
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--olive, #3F4827)",
                  textDecoration: "underline",
                  fontSize: 13,
                }}
              >
                Track on Shadowfax {"→"}
              </a>
              <span style={{ color: "var(--sage)", fontSize: 12, marginLeft: 6 }}>
                (enter AWB: {awb})
              </span>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <span style={{ color: "var(--sage)" }}>Status:</span>{" "}
            <span
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                background:
                  status === "delivered"
                    ? "rgba(63, 72, 39, 0.12)"
                    : status === "cancelled" || status === "lost"
                    ? "rgba(180, 50, 50, 0.1)"
                    : "rgba(169, 130, 56, 0.12)",
                color:
                  status === "delivered"
                    ? "var(--olive, #3F4827)"
                    : status === "cancelled" || status === "lost"
                    ? "#b43232"
                    : "var(--gold, #A98238)",
              }}
            >
              {courierStatusLabel(status)}
            </span>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-outline"
              onClick={handleRefresh}
              disabled={isPending}
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              {isPending ? "Refreshing\u2026" : "\u21bb Refresh Status"}
            </button>
            {status !== "delivered" && status !== "cancelled" && status !== "rto_delivered" && (
              <button
                className="btn btn-outline"
                onClick={handleCancel}
                disabled={isPending}
                style={{ padding: "6px 14px", fontSize: 12, color: "#b43232", borderColor: "#b43232" }}
              >
                Cancel Shipment
              </button>
            )}
          </div>
        </div>
      )}

      {message && (
        <p
          style={{
            marginTop: 10,
            fontSize: 12.5,
            color: message.startsWith("\u2713") ? "var(--olive)" : "#b43232",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
