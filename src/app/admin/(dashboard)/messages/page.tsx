import { db } from "@/db";
import MessageReadToggle from "./MessageReadToggle";

export default async function AdminMessagesPage() {
  const messages = await db.query.contactMessages.findMany({ orderBy: (m, { desc }) => [desc(m.createdAt)] });
  const newCount = messages.filter((m) => m.status === "NEW").length;

  return (
    <>
      <div className="admin-header">
        <h1>Messages{newCount > 0 ? ` (${newCount} new)` : ""}</h1>
      </div>

      <div className="admin-card">
        {messages.length === 0 && <p style={{ padding: 20, color: "var(--sage)" }}>No messages yet — anything sent through the Contact page shows up here.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--line)",
              background: m.status === "NEW" ? "rgba(169,130,56,0.06)" : "transparent",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <strong>{m.name}</strong>{" "}
                <a href={`mailto:${m.email}`} style={{ color: "var(--olive)", fontSize: 13 }}>{m.email}</a>
                <div style={{ fontSize: 12, color: "var(--sage)", marginTop: 2 }}>
                  {m.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                  {m.createdAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <MessageReadToggle messageId={m.id} status={m.status} />
            </div>
            <p style={{ marginTop: 10, fontSize: 14, whiteSpace: "pre-wrap" }}>{m.message}</p>
          </div>
        ))}
      </div>
    </>
  );
}
