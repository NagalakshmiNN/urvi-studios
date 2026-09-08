import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The stock sheet as a real workbook: one row per product per size, plus a
// short summary — what you have, what it's worth, and what's run out. An
// .xlsx rather than a CSV because this one is meant to be read and filtered,
// not just imported somewhere else.
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const products = await db.query.products.findMany({
    with: { sizes: true, category: true },
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Urvi Studios";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Stock On Hand");
  sheet.columns = [
    { header: "Product", key: "name", width: 40 },
    { header: "Product ID", key: "sku", width: 24 },
    { header: "Category", key: "category", width: 16 },
    { header: "Size", key: "size", width: 8 },
    { header: "Pieces on hand", key: "stock", width: 15 },
    { header: "Selling price (₹)", key: "price", width: 16 },
    { header: "Value at selling price (₹)", key: "value", width: 24 },
    { header: "Landed cost (₹)", key: "landedCost", width: 16 },
    { header: "Value at landed cost (₹)", key: "costValue", width: 23 },
    { header: "Live on the website?", key: "active", width: 19 },
  ];

  let totalPieces = 0;
  let totalValue = 0;
  let totalCostValue = 0;
  let soldOut = 0;
  let runningLow = 0;

  for (const p of products) {
    const sizes = [...p.sizes].sort((a, b) => a.position - b.position);
    for (const s of sizes) {
      totalPieces += s.stock;
      totalValue += s.stock * p.price;
      totalCostValue += s.stock * (p.landedCost ?? 0);
      if (s.stock === 0) soldOut++;
      else if (s.stock < 5) runningLow++;

      const row = sheet.addRow({
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        size: s.label,
        stock: s.stock,
        price: p.price,
        value: s.stock * p.price,
        landedCost: p.landedCost ?? "",
        costValue: p.landedCost != null ? s.stock * p.landedCost : "",
        active: p.isActive ? "Yes" : "Hidden",
      });

      // Sold out in red, nearly gone in amber — findable at a glance when
      // this is printed or scrolled on a phone.
      if (s.stock === 0) {
        row.getCell("stock").font = { bold: true, color: { argb: "FFA5333A" } };
      } else if (s.stock < 5) {
        row.getCell("stock").font = { bold: true, color: { argb: "FFA98238" } };
      }
    }
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFBF8F2" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F4827" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: { row: 1, column: 10 } };

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "", key: "label", width: 34 },
    { header: "", key: "value", width: 22 },
  ];
  const asOf = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const summaryRows: [string, string | number][] = [
    ["Stock on hand, as of", asOf],
    ["", ""],
    ["Total pieces", totalPieces],
    ["Product/size lines", sheet.rowCount - 1],
    ["Sizes sold out", soldOut],
    ["Sizes with fewer than 5 left", runningLow],
    ["", ""],
    ["Value at selling price (₹)", totalValue],
    ["Value at landed cost (₹)", totalCostValue],
    ["", ""],
    ["Note", "Landed-cost value only counts products that have a Landed Cost filled in."],
  ];
  for (const [label, value] of summaryRows) {
    const row = summary.addRow({ label, value });
    if (label && label !== "Note") row.getCell("label").font = { bold: true };
  }
  summary.getColumn("value").alignment = { horizontal: "left" };

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Urvi_Studios_Stock_${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
