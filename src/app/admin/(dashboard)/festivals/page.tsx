import { db, schema } from "@/db";
import Link from "next/link";
import { deleteFestivalAction } from "@/app/actions/festival";
import FestivalToggle from "./FestivalToggle";

export default async function AdminFestivalsPage() {
  const events = await db.query.festivalEvents.findMany({
    orderBy: (e, { desc }) => [desc(e.startsAt)],
  });

  const now = new Date();

  function status(e: typeof events[number]) {
    if (!e.isActive) return { label: "Disabled", color: "#999" };
    if (now < e.startsAt) return { label: "Upcoming", color: "#2196F3" };
    if (now > e.endsAt) return { label: "Ended", color: "#999" };
    return { label: "LIVE", color: "#4CAF50" };
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Festival & Sale Events</h1>
        <Link
          href="/admin/festivals/new"
          style={{
            padding: "10px 20px",
            background: "var(--gold, #A98238)",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          + New Event
        </Link>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
        Use the toggle to turn festival animations and banners on/off instantly. Only one festival should be active at a time.
      </p>

      {events.length === 0 ? (
        <p style={{ color: "#888" }}>
          No events yet. Create your first festival or sale event to show animated banners on the homepage.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
              <th style={{ padding: "10px 8px" }}>On/Off</th>
              <th style={{ padding: "10px 8px" }}>Name</th>
              <th style={{ padding: "10px 8px" }}>Theme</th>
              <th style={{ padding: "10px 8px" }}>Starts</th>
              <th style={{ padding: "10px 8px" }}>Ends</th>
              <th style={{ padding: "10px 8px" }}>Status</th>
              <th style={{ padding: "10px 8px" }}>Animation</th>
              <th style={{ padding: "10px 8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const s = status(e);
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "10px 8px" }}>
                    <FestivalToggle eventId={e.id} active={e.isActive} />
                  </td>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                    {e.name}
                    {e.tagline && <div style={{ fontWeight: 400, fontSize: 12, color: "#888" }}>{e.tagline}</div>}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 10,
                        fontSize: 12,
                        background: "#f0f0f0",
                      }}
                    >
                      {e.theme}
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px", fontSize: 13 }}>
                    {e.startsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "10px 8px", fontSize: 13 }}>
                    {e.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        background: s.color,
                      }}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px", fontSize: 13 }}>{e.animation || "none"}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        href={`/admin/festivals/${e.id}/edit`}
                        style={{ color: "var(--gold, #A98238)", textDecoration: "none", fontWeight: 600, fontSize: 13 }}
                      >
                        Edit
                      </Link>
                      <form action={deleteFestivalAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#C23B22",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: 13,
                            padding: 0,
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
