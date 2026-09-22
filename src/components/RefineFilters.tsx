"use client";

// The size / colour / fabric filters, folded away until asked for.
//
// Open, they push the clothes most of a screen down — and on a shop the
// clothes are the point. Most visitors browse rather than filter, so the
// default is closed with the count of what's chosen visible on the button,
// and anyone mid-filter finds it already open.

import { useState } from "react";

export default function RefineFilters({
  children,
  activeCount,
}: {
  children: React.ReactNode;
  // Open on arrival when filters are already applied — usually a shared link
  // or the back button. Closing over someone's active filters would look like
  // the page had lost them.
  activeCount: number;
}) {
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="refine-toggle"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          padding: "6px 0",
          margin: "4px 0 0",
          cursor: "pointer",
          color: "var(--sage)",
          fontSize: 13,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <span aria-hidden="true" style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 140ms ease" }}>
          ›
        </span>
        Filter
        {activeCount > 0 && <span style={{ textTransform: "none" }}>({activeCount})</span>}
      </button>

      {open && children}
    </>
  );
}
