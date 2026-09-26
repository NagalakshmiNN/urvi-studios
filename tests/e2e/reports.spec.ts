// The accountant's page and the workbook it downloads.
//
// The spreadsheet stayed in use long after everything else had moved into the
// app, for one reason: it was the only thing that could produce a GST summary
// and a profit statement. These tests are that reason being gone — and, more
// than that, they check the file is actually a file. A report route that
// returns an error page with a 200 looks fine in a browser tab and is useless
// in a folder.

import { test, expect } from "@playwright/test";
import { loginAsAdmin, adminApiContext } from "../setup/fixtures";

test.describe("Reports", () => {
  test("the page opens on the current financial year and shows the three pictures", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/reports");

    await expect(page.locator(".admin-header h1")).toHaveText("Reports");

    // April to March, not January to December — the default period is the one
    // thing on this page that is easy to get wrong and impossible to notice.
    await expect(page.getByText(/-04-01 to \d{4}-03-31/)).toBeVisible();

    for (const heading of ["Profit", "GST", "Cash"]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }

    // The caveats are part of the report, not an error state.
    await expect(page.getByRole("heading", { name: "Read this before using the figures" })).toBeVisible();
  });

  test("the shortcuts move the period without hand-typing four date fields", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/reports");

    await page.getByRole("button", { name: "Last financial year" }).click();
    await page.waitForURL(/from=\d{4}-04-01/);

    const url = new URL(page.url());
    const from = url.searchParams.get("from")!;
    const to = url.searchParams.get("to")!;
    expect(from.endsWith("-04-01")).toBe(true);
    expect(to.endsWith("-03-31")).toBe(true);
    // Exactly one year apart.
    expect(Number(to.slice(0, 4)) - Number(from.slice(0, 4))).toBe(1);
  });

  test("the month-by-month table has a row for every month, including quiet ones", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/reports");

    // Twelve months in a financial year. A quiet month is a zero row, not a
    // missing one — a gap reads as "no data" when it means "no trade".
    const rows = page.locator(".admin-card table tbody tr");
    await expect(rows).toHaveCount(12);
  });

  test("the workbook downloads as a real spreadsheet", async ({ context, page }) => {
    const api = await adminApiContext(context, page);
    const res = await api.get("/api/admin/reports/financials");

    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
    // Never cached: this one file is the whole trading history.
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["content-disposition"]).toContain("URVI_Studios_Financials_");

    // A .xlsx is a zip, and every zip starts "PK". This catches the failure
    // that matters — an error page served with a 200 and a spreadsheet
    // content type, which looks fine until somebody tries to open it.
    const body = await res.body();
    expect(body.length).toBeGreaterThan(5_000);
    expect(body.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  test("a nonsense period is refused rather than silently reporting the wrong year", async ({ context, page }) => {
    const api = await adminApiContext(context, page);

    // Reporting the wrong twelve months is the one failure here nobody would
    // notice until after it had been filed.
    const backwards = await api.get("/api/admin/reports/financials?from=2027-03-31&to=2026-04-01");
    expect(backwards.status()).toBe(400);

    const malformed = await api.get("/api/admin/reports/financials?from=April&to=March");
    expect(malformed.status()).toBe(400);

    const half = await api.get("/api/admin/reports/financials?from=2026-04-01");
    expect(half.status()).toBe(400);
  });

  test("a stranger cannot download the accounts", async ({ request }) => {
    // The most sensitive file the site can produce: every sale, every margin,
    // every vendor and their GSTIN.
    const res = await request.get("/api/admin/reports/financials");
    expect(res.status()).toBe(401);
  });
});
