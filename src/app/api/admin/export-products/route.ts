import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OLIVE = "3F4827";
const GOLD = "A98238";
const IDCOL = "EDEFE4";

// The current catalog, in the exact same column layout the "Add Products"
// import expects — Product ID (the product's SKU) filled in for every row.
// Re-uploading this sheet unchanged is a no-op update; editing a row and
// re-uploading updates that product in place, matched by its Product ID.
// Add new rows below with the Product ID left blank to create new products,
// same as the blank template.
export async function GET() {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const products = await db.query.products.findMany({
    with: { sizes: true, colors: true, category: true },
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Add Products");
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const headers = [
    "Product ID", "Category", "Product Name", "Description", "Material / Fabric",
    "Perfect For / Where to Wear", "Best Weather", "Ease / Styling", "Style",
    "Price (₹)", "Compare-at Price (₹)", "Stock (pieces)", "Sizes Available", "Colors Available",
    "Badge (optional)", "Photos",
  ];
  const widths = [22, 16, 26, 32, 24, 24, 18, 26, 20, 12, 16, 12, 18, 20, 16, 24];

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colNumber === 1 ? `FF${GOLD}` : `FF${OLIVE}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  headers.forEach((_, i) => (ws.getColumn(i + 1).width = widths[i]));

  for (const p of products) {
    const row = ws.addRow([
      p.sku,
      p.category?.name ?? "",
      p.name,
      p.description,
      p.fabric,
      p.perfectFor ?? "",
      p.bestWeather ?? "",
      p.stylingTips ?? "",
      p.styleNotes ?? "",
      p.price,
      p.compareAtPrice ?? "",
      p.stock,
      p.sizes.map((s) => s.label).join(", "),
      p.colors.map((c) => `${c.name}:${c.hex}`).join(", "),
      p.badge ?? "",
      "",
    ]);
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${IDCOL}` } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Urvi_Studios_Current_Catalog.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
