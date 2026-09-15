"use client";

// "Sizing help" on the product page. Opens the chart in a dialog rather than
// sending anyone to another page — the whole point is to check a number and
// get straight back to choosing a size.

import { useEffect, useRef } from "react";
import { SIZE_CHART, SIZE_GUIDE_NOTES } from "@/lib/size-guide";

export default function SizeGuide({
  open,
  onClose,
  currentSize,
}: {
  open: boolean;
  onClose: () => void;
  /** Highlighted in the chart, so the size already chosen is easy to find. */
  currentSize?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Focus lands on Close, so a keyboard or screen-reader user starts inside
    // the dialog rather than behind it.
    closeRef.current?.focus();
    // The page behind must not scroll while this is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="size-guide-backdrop" onClick={onClose} role="presentation">
      <div
        className="size-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="size-guide-head">
          <h3 id="size-guide-title">Size guide</h3>
          <button ref={closeRef} type="button" className="size-guide-close" onClick={onClose} aria-label="Close size guide">
            ×
          </button>
        </div>

        <p className="size-guide-lede">
          All measurements are in inches, and describe <strong>your body</strong> — not the garment.
        </p>

        <div className="size-guide-scroll">
          <table className="size-guide-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Bust</th>
                <th>Waist</th>
                <th>Hip</th>
              </tr>
            </thead>
            <tbody>
              {SIZE_CHART.map((row) => (
                <tr
                  key={row.label}
                  className={currentSize && row.label.toLowerCase() === currentSize.toLowerCase() ? "current" : ""}
                >
                  <td className="size-guide-label">{row.label}</td>
                  <td>{row.bust}</td>
                  <td>{row.waist}</td>
                  <td>{row.hip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="size-guide-notes">
          {SIZE_GUIDE_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>

        <p className="size-guide-caveat">
          This is a general guide. Fit varies a little between styles — a structured suit set and a loose cotton
          kurti will sit differently even in the same size.
        </p>
      </div>
    </div>
  );
}
