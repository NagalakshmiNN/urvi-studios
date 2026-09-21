// The paperwork behind a purchase: uploading it, relabelling it, removing it
// softly, and bringing it back.
//
// The test that matters most here is the one about access. A vendor invoice
// shows what the business pays for its stock, so unlike a product photograph
// these files must never be reachable without a login — not even with the id.

import { test, expect, type Page } from "@playwright/test";
import { query, queryOne, withDb } from "../setup/db";
import { loginAsAdmin } from "../setup/fixtures";

// A one-page PDF, small enough to keep in the file and real enough to exercise
// the whole upload path.
const TINY_PDF = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA5OSA5OV0+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4K",
  "base64"
);

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function anyPurchaseId(): Promise<string> {
  const row = await queryOne<{ id: string }>("select id from purchases order by ref limit 1");
  expect(row, "the workbook's purchase history should be present").not.toBeNull();
  return row!.id;
}

async function upload(
  page: Page,
  purchaseId: string,
  file: { name: string; mimeType: string; buffer: Buffer },
  fields: { kind?: string; notes?: string } = {}
) {
  return page.request.post("/api/admin/purchase-documents", {
    multipart: {
      purchaseId,
      kind: fields.kind ?? "Invoice",
      notes: fields.notes ?? "",
      files: file,
    },
  });
}

async function cleanUp(purchaseId: string) {
  await withDb((c) => c.query("delete from purchase_documents where purchase_id = $1", [purchaseId]));
}

test.describe("uploading paperwork", () => {
  test("a PDF is filed against the purchase and can be opened again", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();

    const res = await upload(page, purchaseId, { name: "GD707.pdf", mimeType: "application/pdf", buffer: TINY_PDF }, {
      kind: "Invoice",
      notes: "Scanned from the original",
    });
    expect(res.ok()).toBeTruthy();
    const { ids } = await res.json();
    expect(ids).toHaveLength(1);

    const doc = await queryOne<{ filename: string; kind: string; content_type: string; size_bytes: number; notes: string; deleted_at: string | null }>(
      "select filename, kind, content_type, size_bytes, notes, deleted_at from purchase_documents where id = $1",
      [ids[0]]
    );
    expect(doc!.filename).toBe("GD707.pdf");
    expect(doc!.kind).toBe("Invoice");
    expect(doc!.content_type).toBe("application/pdf");
    expect(doc!.size_bytes).toBe(TINY_PDF.byteLength);
    expect(doc!.notes).toBe("Scanned from the original");
    expect(doc!.deleted_at).toBeNull();

    // And the bytes come back exactly as they went in.
    const fetched = await page.request.get(`/api/admin/purchase-documents/${ids[0]}`);
    expect(fetched.ok()).toBeTruthy();
    expect(fetched.headers()["content-type"]).toContain("application/pdf");
    expect(Buffer.from(await fetched.body()).equals(TINY_PDF)).toBe(true);

    await cleanUp(purchaseId);
  });

  test("several files at once, because an invoice and its transport bill arrive together", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();

    const res = await page.request.post("/api/admin/purchase-documents", {
      multipart: {
        purchaseId,
        kind: "Transport bill",
        files: { name: "vrl.png", mimeType: "image/png", buffer: TINY_PNG },
      },
    });
    expect(res.ok()).toBeTruthy();

    const rows = await query("select id from purchase_documents where purchase_id = $1", [purchaseId]);
    expect(rows).toHaveLength(1);

    await cleanUp(purchaseId);
  });

  test("refuses a file type that isn't paperwork, and says what is allowed", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();

    const res = await page.request.post("/api/admin/purchase-documents", {
      multipart: {
        purchaseId,
        files: { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an invoice") },
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("PDF");

    expect(await query("select id from purchase_documents where purchase_id = $1", [purchaseId])).toHaveLength(0);
  });

  test("refuses a purchase that doesn't exist rather than filing an orphan", async ({ page }) => {
    await loginAsAdmin(page);
    const res = await upload(page, "00000000-0000-0000-0000-000000000000", {
      name: "x.pdf", mimeType: "application/pdf", buffer: TINY_PDF,
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("who can open an invoice", () => {
  test("nobody without a login, even holding the id", async ({ page, browser }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();
    const res = await upload(page, purchaseId, { name: "private.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
    const { ids } = await res.json();

    // A brand-new context: no admin cookie, exactly like anyone who came by
    // the link. This is the assertion that keeps buying prices off the web.
    const stranger = await browser.newContext();
    const anonymous = await stranger.request.get(`/api/admin/purchase-documents/${ids[0]}`);
    expect(anonymous.status(), "an uploaded invoice must never be readable without a login").toBe(401);

    const uploadAttempt = await stranger.request.post("/api/admin/purchase-documents", {
      multipart: { purchaseId, files: { name: "x.pdf", mimeType: "application/pdf", buffer: TINY_PDF } },
    });
    expect(uploadAttempt.status()).toBe(401);
    await stranger.close();

    await cleanUp(purchaseId);
  });

  test("is never cached by anything in between", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();
    const res = await upload(page, purchaseId, { name: "cache.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
    const { ids } = await res.json();

    const fetched = await page.request.get(`/api/admin/purchase-documents/${ids[0]}`);
    expect(fetched.headers()["cache-control"]).toContain("no-store");
    expect(fetched.headers()["cache-control"]).toContain("private");

    await cleanUp(purchaseId);
  });

  test("downloads rather than previews when asked", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();
    const res = await upload(page, purchaseId, { name: "bill.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
    const { ids } = await res.json();

    const inline = await page.request.get(`/api/admin/purchase-documents/${ids[0]}`);
    expect(inline.headers()["content-disposition"]).toContain("inline");

    const download = await page.request.get(`/api/admin/purchase-documents/${ids[0]}?download=1`);
    expect(download.headers()["content-disposition"]).toContain("attachment");
    expect(download.headers()["content-disposition"]).toContain("bill.pdf");

    await cleanUp(purchaseId);
  });
});

test.describe("removing paperwork softly", () => {
  test("a removed document stops being served but is not destroyed", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();
    const res = await upload(page, purchaseId, { name: "mistake.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
    const { ids } = await res.json();

    await page.goto(`/admin/purchases/${purchaseId}`);
    await expect(page.locator("text=mistake.pdf")).toBeVisible();

    page.once("dialog", (d) => d.accept("Filed against the wrong invoice"));
    await page.click('tr:has-text("mistake.pdf") button:has-text("Remove")');
    await expect(page.locator("text=Removed paperwork")).toBeVisible();

    // The row is still there, with the reason and the bytes.
    const doc = await queryOne<{ deleted_at: string | null; deleted_reason: string; data_base64: string }>(
      "select deleted_at, deleted_reason, data_base64 from purchase_documents where id = $1",
      [ids[0]]
    );
    expect(doc, "a soft delete must not destroy the row").not.toBeNull();
    expect(doc!.deleted_at).not.toBeNull();
    expect(doc!.deleted_reason).toBe("Filed against the wrong invoice");
    expect(doc!.data_base64.length, "the file itself is kept").toBeGreaterThan(0);

    // But it is no longer served — "deleted" has to mean more than "hidden".
    const fetched = await page.request.get(`/api/admin/purchase-documents/${ids[0]}`);
    expect(fetched.status()).toBe(404);

    await cleanUp(purchaseId);
  });

  test("and can be brought back", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();
    const res = await upload(page, purchaseId, { name: "oops.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
    const { ids } = await res.json();

    await withDb((c) => c.query("update purchase_documents set deleted_at = now() where id = $1", [ids[0]]));

    await page.goto(`/admin/purchases/${purchaseId}`);
    await page.click('button:has-text("Bring back")');
    await expect(page.locator("text=Removed paperwork")).toHaveCount(0);

    const doc = await queryOne<{ deleted_at: string | null }>(
      "select deleted_at from purchase_documents where id = $1",
      [ids[0]]
    );
    expect(doc!.deleted_at).toBeNull();

    const fetched = await page.request.get(`/api/admin/purchase-documents/${ids[0]}`);
    expect(fetched.ok(), "restoring makes it readable again").toBeTruthy();

    await cleanUp(purchaseId);
  });
});

test.describe("relabelling paperwork", () => {
  test("the name and kind can be changed, and the extension survives", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();
    const res = await upload(page, purchaseId, { name: "IMG_4821.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
    const { ids } = await res.json();

    await page.goto(`/admin/purchases/${purchaseId}`);
    await page.click('tr:has-text("IMG_4821.pdf") button:has-text("Edit")');

    await page.fill(`#name-${ids[0]}`, "G.D. Fabrics GD707");
    await page.selectOption(`#kind-${ids[0]}`, "Payment proof");
    await page.fill(`#notes-${ids[0]}`, "Paid by UPI");
    await page.click('button:has-text("Save")');

    await expect(page.locator("text=G.D. Fabrics GD707.pdf")).toBeVisible();

    const doc = await queryOne<{ filename: string; kind: string; notes: string }>(
      "select filename, kind, notes from purchase_documents where id = $1",
      [ids[0]]
    );
    // Renaming is renaming, not re-typing: ".pdf" is part of what the file is.
    expect(doc!.filename).toBe("G.D. Fabrics GD707.pdf");
    expect(doc!.kind).toBe("Payment proof");
    expect(doc!.notes).toBe("Paid by UPI");

    await cleanUp(purchaseId);
  });

  test("the purchases list shows which invoices still have no paper", async ({ page }) => {
    await loginAsAdmin(page);
    const purchaseId = await anyPurchaseId();

    await page.goto("/admin/purchases");
    await expect(page.locator("text=none yet").first()).toBeVisible();

    await upload(page, purchaseId, { name: "filed.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
    await page.reload();
    await expect(page.locator("text=1 file").first()).toBeVisible();

    await cleanUp(purchaseId);
  });
});
