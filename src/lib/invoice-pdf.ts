// Branded receipt / bill PDF for URVI Studios.
//
// Uses jsPDF + jspdf-autotable to produce a clean branded invoice
// entirely in JavaScript — no native dependencies, safe for Netlify
// serverless functions (read-only filesystem).
//
// Layout:
//   • URVI Studios logo centred at the top
//   • Order + customer details
//   • Items table (no GST columns — simple: #, Description, Size, Color, Qty, Price, Amount)
//   • Totals: subtotal, shipping, discount, grand total
//   • GST provision (labels only, no numbers)
//   • Footer: contact numbers, Instagram QR, address, website

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SITE } from "./site-config";
import { LOGO_DATA_URI, INSTAGRAM_QR_DATA_URI } from "./invoice-assets";

// ---------------------------------------------------------------------------
// Brand colours (from URVI_Studios_Brand_Guidelines)
// ---------------------------------------------------------------------------
const OLIVE: [number, number, number] = [63, 72, 39];   // #3F4827
const GOLD: [number, number, number] = [169, 130, 56];   // #A98238
const IVORY: [number, number, number] = [247, 240, 228];  // #F7F0E4
const EARTH: [number, number, number] = [81, 70, 47];     // #51462F

// ---------------------------------------------------------------------------
// Types (unchanged interface — API route stays as-is)
// ---------------------------------------------------------------------------

export interface InvoiceOrder {
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  subtotal: number;   // rupees
  shipping: number;   // rupees
  discount: number;   // rupees
  total: number;       // rupees
  couponCode: string | null;
  paymentMethod: string;
  paymentStatus: string;
}

export interface InvoiceItem {
  productName: string;
  sku: string | null;
  size: string;
  color: string;
  qty: number;
  price: number; // rupees per unit
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatINR(amount: number): string {
  return "₹" + Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPhone(raw: string): string {
  // "919538559595" → "+91 95385 59595"
  if (raw.startsWith("91") && raw.length === 12) {
    const num = raw.slice(2);
    return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
  }
  return raw;
}

/** Amount in Indian-English words */
function amountInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function belowHundred(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 100) return belowHundred(n);
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + belowHundred(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = convert(rupees) || "Zero";
  result += " Rupees";
  if (paise > 0) {
    result += " and " + convert(paise) + " Paise";
  }
  result += " Only";
  return result;
}

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

export function generateInvoicePdf(order: InvoiceOrder, items: InvoiceItem[]): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();   // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // =========================================================================
  // 1. LOGO — centred at the very top
  // =========================================================================
  const logoW = 40; // mm
  const logoH = 40; // square logo
  const logoX = (pageWidth - logoW) / 2;
  doc.addImage(LOGO_DATA_URI, "PNG", logoX, 8, logoW, logoH);

  let y = 52; // below logo

  // =========================================================================
  // 2. BRAND NAME + TAGLINE
  // =========================================================================
  doc.setTextColor(...OLIVE);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("URVI STUDIOS", pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...GOLD);
  doc.text("Confidence, worn.", pageWidth / 2, y, { align: "center" });
  y += 3;

  // Decorative gold line
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(margin + 40, y, pageWidth - margin - 40, y);
  y += 6;

  // "INVOICE" title
  doc.setTextColor(...EARTH);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth / 2, y, { align: "center" });
  y += 7;

  // =========================================================================
  // 3. ORDER + CUSTOMER DETAILS (two-column layout)
  // =========================================================================
  const leftX = margin;
  const rightX = pageWidth / 2 + 8;

  // -- Left column: Order info --
  doc.setFontSize(9);
  doc.setTextColor(...OLIVE);
  doc.setFont("helvetica", "bold");
  doc.text("Order Details", leftX, y);
  y += 5;

  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const orderDetails: [string, string][] = [
    ["Order No:", order.orderNumber],
    ["Date:", formatDate(order.createdAt)],
    ["Invoice No:", "INV-" + order.orderNumber],
  ];

  // Payment label
  const payLabel = order.paymentMethod === "razorpay" ? "Online (Razorpay)" :
    order.paymentMethod === "whatsapp_cod" ? "Cash on Delivery" :
    order.paymentMethod === "manual" ? "Manual" : order.paymentMethod;
  orderDetails.push(["Payment:", payLabel]);

  for (const [label, value] of orderDetails) {
    doc.setFont("helvetica", "bold");
    doc.text(label, leftX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, leftX + 24, y);
    y += 4.2;
  }

  // -- Right column: Customer info (reset y to same baseline) --
  let ry = y - (orderDetails.length * 4.2);

  doc.setFontSize(9);
  doc.setTextColor(...OLIVE);
  doc.setFont("helvetica", "bold");
  doc.text("Ship To", rightX, ry);
  ry += 5;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(order.customerName, rightX, ry);
  doc.setFont("helvetica", "normal");
  ry += 4.2;
  doc.text(order.addressLine1, rightX, ry);
  ry += 4.2;
  doc.text(`${order.city}, ${order.state} - ${order.pincode}`, rightX, ry);
  ry += 4.2;
  doc.text(`Phone: ${order.customerPhone}`, rightX, ry);
  ry += 4.2;
  if (order.customerEmail) {
    doc.text(`Email: ${order.customerEmail}`, rightX, ry);
    ry += 4.2;
  }

  y = Math.max(y, ry) + 4;

  // Thin olive divider
  doc.setDrawColor(...OLIVE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // =========================================================================
  // 4. ITEMS TABLE — clean, no GST columns
  // =========================================================================
  const tableHead = [["#", "Description", "Size", "Color", "Qty", "Unit Price", "Amount"]];

  const tableBody = items.map((item, idx) => [
    String(idx + 1),
    item.productName,
    item.size || "-",
    item.color || "-",
    String(item.qty),
    formatINR(item.price),
    formatINR(roundTwo(item.price * item.qty)),
  ]);

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: OLIVE,
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: "center",
      valign: "middle",
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [250, 247, 240], // very light ivory
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 48 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "center", cellWidth: 12 },
      5: { halign: "right", cellWidth: 24 },
      6: { halign: "right", cellWidth: 24 },
    },
    margin: { left: margin, right: margin },
    styles: { overflow: "linebreak", cellPadding: 2.5 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY ?? y + 40;

  // =========================================================================
  // 5. TOTALS SECTION (right-aligned)
  // =========================================================================
  y += 5;

  const summaryLabelX = pageWidth - margin - 70;
  const summaryValX = pageWidth - margin;

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", summaryLabelX, y);
  doc.text(formatINR(order.subtotal), summaryValX, y, { align: "right" });
  y += 5;

  // Shipping
  if (order.shipping > 0) {
    doc.text("Shipping:", summaryLabelX, y);
    doc.text(formatINR(order.shipping), summaryValX, y, { align: "right" });
    y += 5;
  }

  // Discount
  if (order.discount > 0) {
    doc.text("Discount" + (order.couponCode ? ` (${order.couponCode})` : "") + ":", summaryLabelX, y);
    doc.text("−" + formatINR(order.discount), summaryValX, y, { align: "right" });
    y += 5;
  }

  // Gold line above total
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(summaryLabelX, y, summaryValX, y);
  y += 5;

  // Grand total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...OLIVE);
  doc.text("Total:", summaryLabelX, y);
  doc.text(formatINR(order.total), summaryValX, y, { align: "right" });
  y += 2;
  doc.setLineWidth(0.5);
  doc.line(summaryLabelX, y, summaryValX, y);

  // =========================================================================
  // 6. AMOUNT IN WORDS
  // =========================================================================
  y += 7;
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.text("Amount in Words:", margin, y);
  doc.setFont("helvetica", "italic");
  y += 4;
  const words = amountInWords(order.total);
  const wordLines = doc.splitTextToSize(words, contentWidth);
  doc.text(wordLines, margin, y);
  y += wordLines.length * 3.5 + 4;

  // =========================================================================
  // 7. GST PROVISION (labels only — no numbers)
  // =========================================================================
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text("GST Details (to be updated)", margin, y);
  y += 4.5;
  doc.text("GSTIN: ______________________", margin, y);
  doc.text("HSN Code: __________", margin + 70, y);
  y += 4.5;
  doc.text("CGST: __________    SGST: __________    IGST: __________", margin, y);
  y += 6;

  // =========================================================================
  // 8. FOOTER — Contact, Instagram QR, Address
  // =========================================================================

  // Check if we need a new page for the footer
  if (y > pageHeight - 55) {
    doc.addPage();
    y = 20;
  }

  // Gold divider before footer
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // --- LEFT SIDE: Contact details ---
  doc.setFontSize(8.5);
  doc.setTextColor(...OLIVE);
  doc.setFont("helvetica", "bold");
  doc.text("Contact Us", margin, y);
  y += 4.5;

  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text(`Lakshmi:  ${formatPhone(SITE.whatsappNumber)}`, margin, y);
  y += 3.8;
  doc.text(`Shilpa:     ${formatPhone(SITE.whatsappNumberAlt)}`, margin, y);
  y += 3.8;
  doc.text(`Email:      ${SITE.contactEmail}`, margin, y);
  y += 3.8;
  doc.text(`Web:        ${SITE.siteUrl}`, margin, y);

  const contactBlockTop = y - 3 * 3.8 - 4.5;

  // --- RIGHT SIDE: Instagram QR ---
  const qrW = 22;
  const qrX = pageWidth - margin - qrW;
  const qrY = contactBlockTop;
  doc.addImage(INSTAGRAM_QR_DATA_URI, "PNG", qrX, qrY, qrW, qrW);

  // Instagram handle below QR
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.text("@" + SITE.instagramHandle, qrX + qrW / 2, qrY + qrW + 3, { align: "center" });

  y += 8;

  // --- Address line ---
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text(SITE.legalName + "  |  " + SITE.registeredAddress, pageWidth / 2, y, { align: "center" });
  y += 5;

  // --- Fine print ---
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.text("This is a computer-generated invoice and does not require a physical signature.", pageWidth / 2, y, { align: "center" });

  // Return as Buffer
  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}
