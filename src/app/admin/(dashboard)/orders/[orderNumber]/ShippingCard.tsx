"use client";

import { useState, useTransition } from "react";
import { createShipmentAction, fetchTrackingAction, cancelShipmentAction } from "@/app/actions/shadowfax";
import { courierStatusLabel } from "@/lib/shadowfax";

interface WarehouseOption {
  id: string;
  label: string;
  city: string;
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
  addressLine1: string;
  city: string;
  pincode: string;
  warehouses: WarehouseOption[];
}

export default function ShippingCard({
  orderId,
  orderNumber,
  awbNumber: initialAwb,
  shadowfaxOrderId: initialSfxId,
  courierStatus: initialStatus,
  fulfilmentMethod,
  addressLine1,
  city,
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

  function handleCreate() {
    setMessage("");
    startTransition(async () => {
      const result = await createShipmentAction(
        orderId,
        pickupId || undefined,
        returnId || undefined,
      );
      if (result.success) {
        setAwb(result.awbNumber || null);
        setSfxId(result.shadowfaxOrderId || null);
        setStatus("new");
        setMessage("✓ Shipment created");
      } else {
        setMessage(result.error || "Failed to create shipment");
      }
    });
  }

  function handleRefresh() {
    setMessage("");
    startTransition(async () => {
      const result = await fetchTrackingAction(orderId);
      if (result.success) {
        setStatus(result.currentStatus || status);
        if (result.awbNumber) setAwb(result.awbNumber);
        setMessage("✓ Status refreshed");
      } else {
        setMessage(result.error || "Could not fetch tracking");
      }
    });
  }

  function handleCancel() {
    if (!confirm("Cancel this shipment with Shadowfax? This cannot be undone.")) return;
    setMessage("");
    startTransition(async () => {
      const result = await cancelShipmentAction(orderId);
      if (result.success) {
        setStatus("cancelled");
        setMessage("✓ Shipment cancelled");
      } else {
        setMessage(result.error || "Could not cancel");
      }
    });
  }

  return (
    <div className="admin-card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>📦</span> Shipping
      </h3>

      {!hasShipment ? (
        <>
          <p style={{ fontSize: 13, color: "var(--sage)", lineHeight: 1.7, marginBottom: 14 }}>
            Ship to: {addressLine1}, {city} {pincode}
          </p>

          {warehouses.length > 0 && (
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
                    {w.label} — {w.city} {w.pincode}
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
                        {w.label} — {w.city} {w.pincode}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

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
            {isPending ? "Creating shipment…" : "Create Shipment on Shadowfax"}
          </button>
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
              {isPending ? "Refreshing…" : "↻ Refresh Status"}
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
            color: message.startsWith("✓") ? "var(--olive)" : "#b43232",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
