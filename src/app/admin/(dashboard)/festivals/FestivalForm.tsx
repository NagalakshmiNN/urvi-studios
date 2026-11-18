"use client";

import { FESTIVAL_THEMES } from "@/lib/festival-themes";

type FestivalEvent = {
  id: string;
  name: string;
  tagline: string | null;
  startsAt: Date;
  endsAt: Date;
  theme: string;
  bannerText: string | null;
  bannerSub: string | null;
  animation: string | null;
  discountType: string | null;
  discountValue: number | null;
  badgeText: string | null;
  isActive: boolean;
  showMascot: boolean;
  mascotMessage: string | null;
};

function toDatetimeLocal(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: 4,
  fontSize: 14,
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "#555",
};

const themes = Object.keys(FESTIVAL_THEMES);
const animations = ["diwali", "christmas", "sankranti", "navratri", "ugadi", "none"];

export default function FestivalForm({
  event,
  action,
}: {
  event?: FestivalEvent;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 20 }}>
      {event && <input type="hidden" name="id" value={event.id} />}

      <div>
        <label style={labelStyle}>Event Name *</label>
        <input name="name" defaultValue={event?.name ?? ""} required style={fieldStyle} placeholder="Black Friday 2026" />
      </div>

      <div>
        <label style={labelStyle}>Tagline</label>
        <input name="tagline" defaultValue={event?.tagline ?? ""} style={fieldStyle} placeholder="Up to 40% off — one weekend only" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={labelStyle}>Starts At *</label>
          <input
            name="startsAt"
            type="datetime-local"
            defaultValue={toDatetimeLocal(event?.startsAt ?? null)}
            required
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Ends At *</label>
          <input
            name="endsAt"
            type="datetime-local"
            defaultValue={toDatetimeLocal(event?.endsAt ?? null)}
            required
            style={fieldStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Banner Headline</label>
        <input
          name="bannerText"
          defaultValue={event?.bannerText ?? ""}
          style={fieldStyle}
          placeholder="Defaults to event name if empty"
        />
      </div>

      <div>
        <label style={labelStyle}>Banner Subtitle</label>
        <input name="bannerSub" defaultValue={event?.bannerSub ?? ""} style={fieldStyle} placeholder="Optional second line" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={labelStyle}>Theme</label>
          <select name="theme" defaultValue={event?.theme ?? "gold"} style={fieldStyle}>
            {themes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            {themes.map((t) => {
              const c = FESTIVAL_THEMES[t];
              return (
                <div
                  key={t}
                  title={t}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: `linear-gradient(135deg, ${c.bg}, ${c.bgEnd})`,
                    border: "1px solid #ddd",
                  }}
                />
              );
            })}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Animation</label>
          <select name="animation" defaultValue={event?.animation ?? "confetti"} style={fieldStyle}>
            {animations.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div>
          <label style={labelStyle}>Discount Type</label>
          <select name="discountType" defaultValue={event?.discountType ?? ""} style={fieldStyle}>
            <option value="">None (display only)</option>
            <option value="percentage">Percentage</option>
            <option value="flat">Flat amount (₹)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Discount Value</label>
          <input
            name="discountValue"
            type="number"
            defaultValue={event?.discountValue ?? ""}
            style={fieldStyle}
            placeholder="e.g. 20"
          />
        </div>
        <div>
          <label style={labelStyle}>Badge Text</label>
          <input name="badgeText" defaultValue={event?.badgeText ?? "SALE"} style={fieldStyle} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" name="isActive" defaultChecked={event?.isActive ?? true} />
          Active
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" name="showMascot" defaultChecked={event?.showMascot ?? false} />
          Show Mascot
        </label>
      </div>

      <div>
        <label style={labelStyle}>Mascot Message</label>
        <input name="mascotMessage" defaultValue={event?.mascotMessage ?? ""} style={fieldStyle} placeholder="What the mascot says during this event" />
      </div>

      <div>
        <button
          type="submit"
          style={{
            padding: "12px 32px",
            background: "var(--gold, #A98238)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {event ? "Update Event" : "Create Event"}
        </button>
      </div>
    </form>
  );
}
