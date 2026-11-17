"use client";

import { useState, useTransition, useRef } from "react";
import {
  toggleMascotEnabled,
  uploadMascotImage,
  bulkUpdateMascotMessages,
  deleteMascotMessage,
} from "@/app/actions/mascot";

type MascotMsg = {
  id: string;
  message: string;
  animation: string;
  sortOrder: number;
  isActive: boolean;
};

type Props = {
  initialSettings: { enabled: boolean; imageA: string; imageB: string };
  initialMessages: MascotMsg[];
};

const ANIMATIONS = ["wave", "dance", "jump", "twirl", "sit", "namaste"];

export default function MascotAdmin({ initialSettings, initialMessages }: Props) {
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [imageA, setImageA] = useState(initialSettings.imageA);
  const [imageB, setImageB] = useState(initialSettings.imageB);
  const [messages, setMessages] = useState<MascotMsg[]>(initialMessages);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState("");
  const fileRefA = useRef<HTMLInputElement>(null);
  const fileRefB = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Toggle
  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await toggleMascotEnabled(next);
      showToast(next ? "Mascots enabled" : "Mascots disabled");
    });
  }

  // Image upload
  async function handleImageUpload(slot: "a" | "b", file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slot", slot);
    startTransition(async () => {
      const path = await uploadMascotImage(fd);
      if (slot === "a") setImageA(path);
      else setImageB(path);
      showToast(`Mascot ${slot === "a" ? "A" : "B"} image updated`);
    });
  }

  // Message editing
  function updateMsg(idx: number, field: keyof MascotMsg, value: string | number | boolean) {
    setMessages((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  function addMessage() {
    const maxSort = messages.reduce((m, x) => Math.max(m, x.sortOrder), 0);
    setMessages((prev) => [
      ...prev,
      { id: "", message: "", animation: "wave", sortOrder: maxSort + 1, isActive: true },
    ]);
  }

  function removeMessage(idx: number) {
    const msg = messages[idx];
    if (msg.id && !confirm("Delete this message permanently?")) return;
    if (msg.id) {
      startTransition(async () => {
        await deleteMascotMessage(msg.id);
        setMessages((prev) => prev.filter((_, i) => i !== idx));
        showToast("Message deleted");
      });
    } else {
      setMessages((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  function saveMessages() {
    startTransition(async () => {
      await bulkUpdateMascotMessages(
        messages.map((m) => ({
          id: m.id || undefined,
          message: m.message,
          animation: m.animation,
          sortOrder: m.sortOrder,
          isActive: m.isActive,
        }))
      );
      showToast("Messages saved!");
    });
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
  };

  const btnStyle: React.CSSProperties = {
    padding: "10px 20px",
    background: "var(--gold, #A98238)",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: "#3F4827",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 8,
            zIndex: 9999,
            fontSize: 14,
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
          }}
        >
          {toast}
        </div>
      )}

      {/* Enable / Disable */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Mascots On/Off</h2>
            <p style={{ margin: 0, color: "#888", fontSize: 13 }}>
              Toggle walking mascots on the public site
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={isPending}
            style={{
              ...btnStyle,
              background: enabled ? "#4CAF50" : "#999",
              minWidth: 100,
            }}
          >
            {enabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Images */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Mascot Images</h2>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {[
            { label: "Mascot A (Ivory)", src: imageA, slot: "a" as const, ref: fileRefA },
            { label: "Mascot B (Mustard)", src: imageB, slot: "b" as const, ref: fileRefB },
          ].map(({ label, src, slot, ref }) => (
            <div key={slot} style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>{label}</p>
              <div
                style={{
                  width: 120,
                  height: 180,
                  background: "#f5f5f0",
                  borderRadius: 8,
                  border: "2px dashed #ccc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={label} style={{ maxHeight: "100%", maxWidth: "100%" }} />
              </div>
              <input
                type="file"
                accept="image/png,image/webp"
                ref={ref}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(slot, f);
                }}
              />
              <button
                onClick={() => ref.current?.click()}
                disabled={isPending}
                style={{ ...btnStyle, fontSize: 12, padding: "6px 14px" }}
              >
                Change Image
              </button>
            </div>
          ))}
        </div>
        <p style={{ margin: "16px 0 0", color: "#888", fontSize: 12 }}>
          Use transparent PNG images (200×300px recommended). The mascots will walk across the bottom of the screen.
        </p>
      </div>

      {/* Messages */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Speech Bubble Messages</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addMessage} style={{ ...btnStyle, fontSize: 12, padding: "6px 14px" }}>
              + Add
            </button>
            <button
              onClick={saveMessages}
              disabled={isPending}
              style={{ ...btnStyle, fontSize: 12, padding: "6px 14px", background: "#4CAF50" }}
            >
              {isPending ? "Saving…" : "Save All"}
            </button>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
              <th style={{ padding: "8px 6px", width: 40 }}>#</th>
              <th style={{ padding: "8px 6px" }}>Message</th>
              <th style={{ padding: "8px 6px", width: 120 }}>Animation</th>
              <th style={{ padding: "8px 6px", width: 60 }}>Active</th>
              <th style={{ padding: "8px 6px", width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg, i) => (
              <tr key={msg.id || `new-${i}`} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "8px 6px", color: "#aaa" }}>
                  <input
                    type="number"
                    value={msg.sortOrder}
                    onChange={(e) => updateMsg(i, "sortOrder", parseInt(e.target.value) || 0)}
                    style={{ width: 40, border: "1px solid #ddd", borderRadius: 3, padding: "2px 4px", textAlign: "center" }}
                  />
                </td>
                <td style={{ padding: "8px 6px" }}>
                  <input
                    type="text"
                    value={msg.message}
                    onChange={(e) => updateMsg(i, "message", e.target.value)}
                    style={{ width: "100%", border: "1px solid #ddd", borderRadius: 3, padding: "6px 8px" }}
                    placeholder="Enter message…"
                  />
                </td>
                <td style={{ padding: "8px 6px" }}>
                  <select
                    value={msg.animation}
                    onChange={(e) => updateMsg(i, "animation", e.target.value)}
                    style={{ width: "100%", border: "1px solid #ddd", borderRadius: 3, padding: "6px 4px" }}
                  >
                    {ANIMATIONS.map((a) => (
                      <option key={a} value={a}>
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={msg.isActive}
                    onChange={(e) => updateMsg(i, "isActive", e.target.checked)}
                  />
                </td>
                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                  <button
                    onClick={() => removeMessage(i)}
                    style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", fontSize: 16 }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {messages.length === 0 && (
          <p style={{ textAlign: "center", color: "#aaa", padding: 24 }}>
            No messages yet. Click &quot;+ Add&quot; to create speech bubble messages.
          </p>
        )}
      </div>
    </div>
  );
}
