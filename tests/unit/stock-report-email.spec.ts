// The daily stock email. Rendered from the same grid as the screen.

import { test, expect } from "@playwright/test";
import { renderStockGridEmail } from "@/lib/stock-report-email";

const SITE = "https://urvi-studios.netlify.app";

const piece = (name: string, sizes: { label: string; stock: number }[], over = {}) => ({
  id: name,
  sku: `URVI-${name.toUpperCase()}`,
  name,
  slug: name.toLowerCase(),
  isActive: true,
  images: [{ url: "/api/images/abc123", position: 0 }],
  sizes,
  ...over,
});

test("the subject carries the number that changes a morning", () => {
  const out = renderStockGridEmail([piece("Kurti", [{ label: "M", stock: 0 }, { label: "L", stock: 4 }])], { siteUrl: SITE });
  expect(out.subject).toContain("1 size out of stock");

  const fine = renderStockGridEmail([piece("Kurti", [{ label: "M", stock: 4 }])], { siteUrl: SITE });
  expect(fine.subject).toContain("nothing out of stock");
});

test("thumbnails are absolute, because an email has no page to resolve against", () => {
  const out = renderStockGridEmail([piece("Kurti", [{ label: "M", stock: 1 }])], { siteUrl: SITE });
  expect(out.html).toContain(`src="${SITE}/api/images/abc123"`);
  expect(out.html).not.toContain('src="/api/images');
});

test("a piece with no photograph gets a placeholder, not a broken image", () => {
  const out = renderStockGridEmail([piece("Kurti", [{ label: "M", stock: 1 }], { images: [] })], { siteUrl: SITE });
  expect(out.html).not.toContain("<img");
  expect(out.html).toContain("Kurti");
});

test("out-of-stock sizes are listed by name, not just coloured", () => {
  // Colour alone is no use to someone reading on a phone in sunlight, or to
  // anyone reading the plain-text version.
  const out = renderStockGridEmail(
    [piece("Blush Bloom", [{ label: "S", stock: 0 }, { label: "M", stock: 3 }])],
    { siteUrl: SITE }
  );
  expect(out.html).toContain("Blush Bloom — S");
  expect(out.text).toContain("Blush Bloom — S");
});

test("the plain-text version stands on its own", () => {
  const out = renderStockGridEmail(
    [piece("Olive Grace", [{ label: "M", stock: 0 }, { label: "L", stock: 1 }])],
    { siteUrl: SITE }
  );
  expect(out.text).toContain("OUT OF STOCK");
  expect(out.text).toContain("RUNNING LOW");
  expect(out.text).toContain("Olive Grace — L (1)");
  expect(out.text).toContain("/admin/stock/grid");
});

test("a product name with markup in it cannot inject into the email", () => {
  const out = renderStockGridEmail(
    [piece("<script>alert(1)</script>", [{ label: "M", stock: 1 }])],
    { siteUrl: SITE }
  );
  expect(out.html).not.toContain("<script>");
  expect(out.html).toContain("&lt;script&gt;");
});

test("totals in the email match the grid it was built from", () => {
  const out = renderStockGridEmail(
    [
      piece("A", [{ label: "M", stock: 2 }]),
      piece("B", [{ label: "M", stock: 3 }, { label: "L", stock: 1 }]),
    ],
    { siteUrl: SITE }
  );
  expect(out.grid.grandTotal).toBe(6);
  expect(out.text).toContain("6 garments in hand");
});

test("an empty catalogue produces a sendable email rather than an error", () => {
  const out = renderStockGridEmail([], { siteUrl: SITE });
  expect(out.subject).toContain("nothing out of stock");
  expect(out.html).toContain("0</td>");
  expect(out.text).toContain("0 pieces");
});
