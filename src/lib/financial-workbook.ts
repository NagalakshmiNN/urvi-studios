// The financial report as a workbook someone can hand to an accountant.
//
// Kept apart from financial-report.ts on purpose: that file works out the
// numbers and can be read and tested on its own, this one only lays them out.
// Mixing the two is how arithmetic ends up inside a cell formula where nobody
// can check it.
//
// Five sheets, in the order they get used: what happened, then the profit
// statement, then the two GST registers, then the cash movement, then the
// sales the whole thing was built from. Every sheet is real numbers in real
// number cells — no text that looks like money, because a column of text
// cannot be summed, and the first thing anybody does with this is sum a
// column.

import ExcelJS from "exceljs";
import type { FinancialReport } from "./financial-report";
import { financialYearLabel } from "./financial-report";

/** Paise to rupees as a number, for a cell that should behave like money. */
function rupees(paise: number): number {
  return Math.round(paise) / 100;
}

const MONEY = '#,##0.00;[Red]-#,##0.00';
const INK = "FF3F4827";
const SAND = "FFECE5D8";

function headerRow(sheet: ExcelJS.Worksheet, row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: INK } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAND } };
  row.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: row.number }];
}

function title(sheet: ExcelJS.Worksheet, text: string, sub?: string) {
  const t = sheet.addRow([text]);
  t.font = { bold: true, size: 14, color: { argb: INK } };
  if (sub) {
    const s = sheet.addRow([sub]);
    s.font = { size: 10, italic: true, color: { argb: "FF7D7F6A" } };
  }
  sheet.addRow([]);
}

/** A labelled row of monthly figures plus a total, as numbers. */
function monthRow(
  sheet: ExcelJS.Worksheet,
  label: string,
  values: number[],
  opts: { bold?: boolean; indent?: boolean } = {}
): ExcelJS.Row {
  const row = sheet.addRow([
    label,
    ...values.map(rupees),
    rupees(values.reduce((a, b) => a + b, 0)),
  ]);
  row.eachCell((cell, col) => {
    if (col > 1) cell.numFmt = MONEY;
  });
  if (opts.bold) row.font = { bold: true };
  if (opts.indent) row.getCell(1).alignment = { indent: 1 };
  return row;
}

export function buildFinancialWorkbook(report: FinancialReport): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "URVI Studios";
  wb.created = new Date();

  const fy = financialYearLabel(report.period);
  const periodLabel = `${report.period.from} to ${report.period.to}`;
  const monthLabels = report.pnl.months.map((m) => m.label);

  // ------------------------------------------------------------- 1. Summary
  const summary = wb.addWorksheet("Summary");
  summary.columns = [{ width: 42 }, { width: 18 }, { width: 60 }];
  title(summary, `URVI Studios — financial summary ${fy}`, periodLabel);

  const lines: [string, number, string][] = [
    ["Sales (GST inclusive)", report.pnl.totals.revenuePaise, "every channel, refunds and cancellations excluded"],
    ["Cost of the garments sold", -report.pnl.totals.cogsPaise, "what those pieces cost to get onto the rail"],
    ["Gross profit", report.pnl.totals.grossProfitPaise, ""],
    ["Running costs", -report.pnl.totals.runningPaise, "packaging, courier, fees — not stock"],
    ["Net profit", report.pnl.totals.netProfitPaise, "before tax"],
  ];
  for (const [label, paise, note] of lines) {
    const row = summary.addRow([label, rupees(paise), note]);
    row.getCell(2).numFmt = MONEY;
    if (label.includes("profit")) row.font = { bold: true };
    row.getCell(3).font = { size: 10, color: { argb: "FF7D7F6A" } };
  }

  summary.addRow([]);
  const gstLines: [string, number, string][] = [
    ["GST collected on sales", report.gst.salesTaxPaise, "output tax, taken out of the selling price"],
    ["GST paid on stock", -report.gst.purchaseTaxPaise, "input credit from vendor invoices"],
    ["GST paid on running costs", -report.gst.expenseTaxPaise, "input credit where a rate was recorded"],
    [
      report.gst.netPayablePaise >= 0 ? "GST payable" : "GST credit carried forward",
      report.gst.netPayablePaise,
      "your accountant decides what is actually claimable",
    ],
  ];
  for (const [label, paise, note] of gstLines) {
    const row = summary.addRow([label, rupees(paise), note]);
    row.getCell(2).numFmt = MONEY;
    if (label.startsWith("GST payable") || label.startsWith("GST credit")) row.font = { bold: true };
    row.getCell(3).font = { size: 10, color: { argb: "FF7D7F6A" } };
  }

  summary.addRow([]);
  const cashRow = summary.addRow(["Cash movement in the period", rupees(report.cash.totals.netMovementPaise), "capital in, plus sales kept, less everything paid out"]);
  cashRow.getCell(2).numFmt = MONEY;
  cashRow.font = { bold: true };
  cashRow.getCell(3).font = { size: 10, color: { argb: "FF7D7F6A" } };

  // The caveats go in the file, not only in the conversation where it was
  // asked for. Whoever opens this in March was not in that conversation.
  summary.addRow([]);
  const notesHeader = summary.addRow(["Read this before using the figures"]);
  notesHeader.font = { bold: true, color: { argb: "FFA03C28" } };
  for (const note of report.notes) {
    const row = summary.addRow(["", "", note]);
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    row.getCell(3).font = { size: 10 };
    row.height = 28;
  }

  // ----------------------------------------------------------------- 2. P&L
  const pnl = wb.addWorksheet("Profit and Loss");
  pnl.columns = [{ width: 34 }, ...monthLabels.map(() => ({ width: 13 })), { width: 15 }];
  title(pnl, "Profit and loss, month by month", periodLabel);
  headerRow(pnl, pnl.addRow(["", ...monthLabels, "Total"]));

  monthRow(pnl, "Sales", report.pnl.revenuePaise);
  monthRow(pnl, "Cost of garments sold", report.pnl.cogsPaise);
  monthRow(pnl, "Gross profit", report.pnl.grossProfitPaise, { bold: true });
  pnl.addRow([]);
  const runningHeader = pnl.addRow(["Running costs"]);
  runningHeader.font = { bold: true };
  for (const category of report.pnl.runningByCategory) {
    monthRow(pnl, category.category, category.paise, { indent: true });
  }
  monthRow(pnl, "Total running costs", report.pnl.runningTotalPaise, { bold: true });
  pnl.addRow([]);
  monthRow(pnl, "Net profit", report.pnl.netProfitPaise, { bold: true });

  if (report.pnl.cogsIncomplete) {
    pnl.addRow([]);
    const warn = pnl.addRow([
      `${report.pnl.piecesWithoutCost} sold pieces had no recorded cost — cost of goods is understated and profit is overstated by that much.`,
    ]);
    warn.font = { italic: true, color: { argb: "FFA03C28" } };
  }

  // ---------------------------------------------------------- 3. GST sales
  const gstOut = wb.addWorksheet("GST on sales");
  gstOut.columns = [
    { header: "Date", key: "day", width: 12 },
    { header: "Order", key: "order", width: 18 },
    { header: "Product", key: "product", width: 38 },
    { header: "Product ID", key: "sku", width: 20 },
    { header: "Pieces", key: "qty", width: 8 },
    { header: "Price per piece (₹)", key: "unit", width: 17 },
    { header: "GST rate", key: "rate", width: 10 },
    { header: "Charged incl. GST (₹)", key: "incl", width: 19 },
    { header: "Taxable value (₹)", key: "taxable", width: 17 },
    { header: "GST (₹)", key: "tax", width: 13 },
  ];
  headerRow(gstOut, gstOut.getRow(1));

  for (const r of report.gst.sales) {
    const row = gstOut.addRow({
      day: r.day,
      order: r.orderNumber,
      product: r.productName,
      sku: r.sku,
      qty: r.qty,
      unit: r.unitPriceRupees,
      rate: r.ratePct / 100,
      incl: rupees(r.inclusivePaise),
      taxable: rupees(r.taxablePaise),
      tax: rupees(r.taxPaise),
    });
    row.getCell("rate").numFmt = "0%";
    for (const key of ["unit", "incl", "taxable", "tax"]) row.getCell(key).numFmt = MONEY;
  }

  gstOut.addRow([]);
  for (const band of report.gst.salesByRate) {
    const row = gstOut.addRow({
      product: `At ${band.ratePct}%`,
      taxable: rupees(band.taxablePaise),
      tax: rupees(band.taxPaise),
    });
    row.font = { bold: true };
    row.getCell("taxable").numFmt = MONEY;
    row.getCell("tax").numFmt = MONEY;
  }
  const outTotal = gstOut.addRow({
    product: "Total output tax",
    taxable: rupees(report.gst.salesTaxablePaise),
    tax: rupees(report.gst.salesTaxPaise),
  });
  outTotal.font = { bold: true };
  outTotal.getCell("taxable").numFmt = MONEY;
  outTotal.getCell("tax").numFmt = MONEY;

  // ------------------------------------------------------ 4. GST purchases
  const gstIn = wb.addWorksheet("GST on purchases");
  gstIn.columns = [
    { header: "Date", key: "day", width: 12 },
    { header: "Purchase", key: "ref", width: 12 },
    { header: "Vendor", key: "vendor", width: 30 },
    { header: "Vendor GSTIN", key: "gstin", width: 20 },
    { header: "Invoice no.", key: "invoice", width: 18 },
    { header: "Pieces", key: "qty", width: 8 },
    { header: "Taxable value (₹)", key: "taxable", width: 17 },
    { header: "GST (₹)", key: "tax", width: 13 },
    { header: "Freight (₹)", key: "freight", width: 13 },
    { header: "Landed total (₹)", key: "landed", width: 16 },
  ];
  headerRow(gstIn, gstIn.getRow(1));

  for (const p of report.gst.purchases) {
    const row = gstIn.addRow({
      day: p.day,
      ref: p.ref,
      vendor: p.vendorName,
      gstin: p.vendorGstin ?? "",
      invoice: p.invoiceNumber,
      qty: p.qty,
      taxable: rupees(p.taxablePaise),
      tax: rupees(p.gstPaise),
      freight: rupees(p.freightPaise),
      landed: rupees(p.landedTotalPaise),
    });
    for (const key of ["taxable", "tax", "freight", "landed"]) row.getCell(key).numFmt = MONEY;
  }

  const inTotal = gstIn.addRow({
    vendor: "Total input tax on stock",
    taxable: rupees(report.gst.purchaseTaxablePaise),
    tax: rupees(report.gst.purchaseTaxPaise),
  });
  inTotal.font = { bold: true };
  inTotal.getCell("taxable").numFmt = MONEY;
  inTotal.getCell("tax").numFmt = MONEY;

  const expTax = gstIn.addRow({ vendor: "Input tax inside running costs", tax: rupees(report.gst.expenseTaxPaise) });
  expTax.font = { bold: true };
  expTax.getCell("tax").numFmt = MONEY;

  // ----------------------------------------------------------- 5. Cash flow
  const cash = wb.addWorksheet("Cash flow");
  cash.columns = [{ width: 34 }, ...monthLabels.map(() => ({ width: 13 })), { width: 15 }];
  title(cash, "Cash in and out, month by month", `${periodLabel} — opens at zero, so this is movement, not a bank balance`);
  headerRow(cash, cash.addRow(["", ...monthLabels, "Total"]));

  monthRow(cash, "Capital put in", report.cash.capitalPaise);
  monthRow(cash, "Sales received (less refunds)", report.cash.salesReceiptsPaise);
  monthRow(cash, "Paid to vendors for stock", report.cash.stockPaidPaise);
  monthRow(cash, "Running costs paid", report.cash.runningPaidPaise);
  monthRow(cash, "Net movement", report.cash.netMovementPaise, { bold: true });
  // Closing is a running balance, so its "total" column would be nonsense —
  // written without one rather than with a number that means nothing.
  const closing = cash.addRow(["Cash at month end", ...report.cash.closingPaise.map(rupees)]);
  closing.font = { bold: true };
  closing.eachCell((cell, col) => {
    if (col > 1) cell.numFmt = MONEY;
  });

  // -------------------------------------------------------------- 6. Sales
  const detail = wb.addWorksheet("Sales detail");
  detail.columns = [
    { header: "Date", key: "day", width: 12 },
    { header: "Order", key: "order", width: 18 },
    { header: "Channel", key: "channel", width: 14 },
    { header: "Charged (₹)", key: "charged", width: 14 },
    { header: "Discount (₹)", key: "discount", width: 13 },
    { header: "Refunded (₹)", key: "refunded", width: 13 },
    { header: "Kept (₹)", key: "kept", width: 14 },
    { header: "Cost of garments (₹)", key: "cost", width: 19 },
    { header: "Margin (₹)", key: "margin", width: 14 },
    { header: "Pieces", key: "pieces", width: 8 },
  ];
  headerRow(detail, detail.getRow(1));

  for (const o of report.sales) {
    const charged = o.actualSalePricePaise ?? o.totalPaise;
    const known = o.lines.filter((l) => l.landedCostAtSalePaise != null && l.landedCostAtSalePaise > 0);
    const cost = known.reduce((s, l) => s + (l.landedCostAtSalePaise as number) * l.qty, 0);
    const complete = known.length === o.lines.length;
    const kept = charged - o.refundedPaise;

    const row = detail.addRow({
      day: o.day,
      order: o.orderNumber,
      channel: o.channel,
      charged: rupees(charged),
      discount: rupees(o.discountPaise),
      refunded: rupees(o.refundedPaise),
      kept: rupees(kept),
      // Left blank, not zero, where a cost is missing: a zero would sum into
      // the column as a garment that cost nothing, which is worse than a gap
      // somebody can see.
      cost: complete ? rupees(cost) : "",
      margin: complete ? rupees(kept - cost) : "",
      pieces: o.lines.reduce((s, l) => s + l.qty, 0),
    });
    for (const key of ["charged", "discount", "refunded", "kept", "cost", "margin"]) {
      row.getCell(key).numFmt = MONEY;
    }
  }

  return wb;
}

/** The filename, so the download is self-describing in a folder of downloads. */
export function financialWorkbookName(report: FinancialReport): string {
  return `URVI_Studios_Financials_${financialYearLabel(report.period)}_${report.period.from}_to_${report.period.to}.xlsx`;
}
