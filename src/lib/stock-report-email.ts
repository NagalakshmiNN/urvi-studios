// The stock grid as an email.
//
// Rendered from the same buildStockGrid as the screen, so the two can never
// drift — and if they did, the email is the one nobody would think to check
// against reality.
//
// Written as a table with inline styles and no external CSS, because that is
// the only thing email clients agree on. Gmail strips <style> blocks in some
// contexts and Outlook ignores most of what it doesn't strip; anything that
// has to survive goes in a style attribute on the element itself.

import { buildStockGrid, visibleColumns, cellTone, type GridProduct, type StockGrid } from "./stock-grid";

const TONE_STYLE: Record<string, string> = {
  out: "background:#f6e2dd;color:#a03c28;font-weight:600;",
  low: "background:#f7eed8;color:#8a6a1f;font-weight:600;",
  // Promised on an unconfirmed WhatsApp order: on the shelf, not available.
  held: "background:#e6e8ef;color:#4a5570;font-weight:600;",
  ok: "",
  none: "background:#f4f2ec;color:#b8b5a8;",
};

const CELL = "border:1px solid #e2e0d8;padding:6px 4px;text-align:center;font-size:13px;";

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * An absolute URL for a thumbnail.
 *
 * Email clients have no page to resolve a relative path against, so "/api/
 * images/abc" silently shows nothing. The images route is public by design,
 * which is what makes this work at all.
 */
function absolute(url: string | null, siteUrl: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function renderStockGridEmail(
  products: GridProduct[],
  opts: { siteUrl: string; when?: Date }
): { subject: string; text: string; html: string; grid: StockGrid } {
  const grid = buildStockGrid(products);
  const columns = visibleColumns(grid);
  const when = opts.when ?? new Date();

  const dateLabel = when.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const outPairs: string[] = [];
  const lowPairs: string[] = [];
  const heldPairs: string[] = [];
  for (const row of grid.rows) {
    for (const c of columns) {
      const tone = cellTone(row.cells[c], 2, row.heldCells[c]);
      if (tone === "out") outPairs.push(`${row.name} — ${c}`);
      if (tone === "low") lowPairs.push(`${row.name} — ${c} (${row.cells[c]})`);
      if (tone === "held") heldPairs.push(`${row.name} — ${c} (${row.heldCells[c]} promised)`);
    }
  }

  // The subject carries the only number that changes a morning: what is gone.
  const subject =
    outPairs.length > 0
      ? `Stock — ${outPairs.length} size${outPairs.length === 1 ? "" : "s"} out of stock`
      : `Stock — nothing out of stock`;

  // ------------------------------------------------------------- plain text
  const textLines = [
    `URVI STUDIOS — stock as of ${dateLabel}`,
    "",
    `${grid.rows.length} pieces · ${grid.grandTotal} garments in hand`,
    `${outPairs.length} sizes out · ${lowPairs.length} running low`,
    "",
  ];
  if (outPairs.length) {
    textLines.push("OUT OF STOCK", ...outPairs.map((s) => `  ${s}`), "");
  }
  if (lowPairs.length) {
    textLines.push("RUNNING LOW", ...lowPairs.map((s) => `  ${s}`), "");
  }
  if (heldPairs.length) {
    textLines.push(
      "SPOKEN FOR (on the shelf, already promised on an unconfirmed WhatsApp order)",
      ...heldPairs.map((s) => `  ${s}`),
      ""
    );
  }
  textLines.push("Full grid: " + `${opts.siteUrl.replace(/\/$/, "")}/admin/stock/grid`);

  // ------------------------------------------------------------------ html
  const head = columns.map((c) => `<th style="${CELL}background:#ece5d8;">${c}</th>`).join("");

  const body = grid.rows
    .map((row) => {
      const img = absolute(row.imageUrl, opts.siteUrl);
      const thumb = img
        ? `<img src="${escape(img)}" width="34" height="42" alt="" style="display:block;border-radius:2px;object-fit:cover;">`
        : `<div style="width:34px;height:42px;background:#ece5d8;border-radius:2px;"></div>`;

      const cells = columns
        .map((c) => {
          const v = row.cells[c];
          const held = row.heldCells[c];
          const mark = held > 0 ? `<div style="font-size:10px;font-weight:500;">${held} held</div>` : "";
          return `<td style="${CELL}${TONE_STYLE[cellTone(v, 2, held)]}">${v === null ? "" : v}${mark}</td>`;
        })
        .join("");

      const other = row.other.length
        ? `<div style="font-size:11px;color:#7d7f6a;">${escape(row.other.map((o) => `${o.label} ${o.stock}`).join(" · "))}</div>`
        : "";

      return `<tr>
  <td style="${CELL}text-align:left;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:8px;">${thumb}</td>
      <td style="font-size:13px;line-height:1.35;">
        ${escape(row.name)}${row.isActive ? "" : ' <span style="color:#7d7f6a;font-size:11px;">· not live</span>'}
        <div style="font-family:monospace;font-size:11px;color:#7d7f6a;">${escape(row.code)}</div>
        ${other}
      </td>
    </tr></table>
  </td>
  ${cells}
  <td style="${CELL}font-weight:600;">${row.total}</td>
</tr>`;
    })
    .join("\n");

  const foot = columns.map((c) => `<td style="${CELL}background:#ece5d8;font-weight:600;">${grid.columnTotals[c]}</td>`).join("");

  const html = `<div style="font-family:Georgia,'Times New Roman',serif;background:#f7f0e4;padding:22px;">
  <div style="max-width:960px;margin:0 auto;background:#fff;padding:24px;border:1px solid #e2e0d8;">
    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7d7f6a;">URVI Studios</div>
    <h1 style="font-size:22px;margin:6px 0 2px;color:#3f4827;">Stock this morning</h1>
    <div style="font-size:13px;color:#7d7f6a;margin-bottom:18px;">${escape(dateLabel)}</div>

    <div style="font-size:14px;line-height:1.8;margin-bottom:18px;">
      <strong>${grid.rows.length}</strong> pieces · <strong>${grid.grandTotal}</strong> garments in hand<br>
      <span style="color:#a03c28;font-weight:600;">${outPairs.length} size${outPairs.length === 1 ? "" : "s"} out of stock</span>
      · ${lowPairs.length} running low${
        grid.heldGrandTotal > 0
          ? ` · <span style="color:#4a5570;">${grid.heldGrandTotal} held for WhatsApp orders</span>`
          : ""
      }
    </div>

    ${
      outPairs.length
        ? `<div style="background:#f6e2dd;border-left:3px solid #a03c28;padding:12px 14px;margin-bottom:18px;font-size:13px;line-height:1.8;">
      <strong style="color:#a03c28;">Out of stock</strong><br>${outPairs.map(escape).join("<br>")}
    </div>`
        : ""
    }

    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead><tr>
        <th style="${CELL}background:#ece5d8;text-align:left;">Piece</th>
        ${head}
        <th style="${CELL}background:#ece5d8;">Total</th>
      </tr></thead>
      <tbody>
${body}
      </tbody>
      <tfoot><tr>
        <td style="${CELL}background:#ece5d8;text-align:left;font-weight:600;">All pieces</td>
        ${foot}
        <td style="${CELL}background:#ece5d8;font-weight:600;">${grid.grandTotal}</td>
      </tr></tfoot>
    </table>

    <p style="font-size:12px;color:#7d7f6a;line-height:1.8;margin-top:16px;">
      A shaded empty cell means the piece isn't made in that size. A red zero means it is, and it's gone.<br>
      A blue cell is on the shelf but already promised on a WhatsApp order nobody has confirmed — count it as sold until you know otherwise.<br>
      <a href="${escape(opts.siteUrl.replace(/\/$/, ""))}/admin/stock/grid" style="color:#3f4827;">Open the live grid</a>
    </p>
  </div>
</div>`;

  return { subject, text: textLines.join("\n"), html, grid };
}
