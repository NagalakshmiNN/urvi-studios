import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";
import { checkUpload, isDocumentKind, safeFilename } from "@/lib/purchase-documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Uploading the paperwork for a purchase.
//
// A route rather than a server action because a server action's body is capped
// well below what a photographed invoice weighs, and the failure when it is
// exceeded is opaque. This path takes the file as multipart and says plainly
// what went wrong when it cannot.
//
// Several files at once: an invoice and its transport bill usually arrive
// together, and making that two trips through a phone's file picker is a way to
// ensure the second one never gets filed.
export async function POST(request: Request) {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Nothing was received." }, { status: 400 });

  const purchaseId = String(formData.get("purchaseId") || "").trim();
  if (!purchaseId) return NextResponse.json({ error: "Which purchase is this for?" }, { status: 400 });

  const purchase = await db.query.purchases.findFirst({ where: eq(schema.purchases.id, purchaseId) });
  if (!purchase) return NextResponse.json({ error: "That purchase no longer exists." }, { status: 404 });

  const kindRaw = String(formData.get("kind") || "Invoice").trim();
  const kind = isDocumentKind(kindRaw) ? kindRaw : "Other";
  const notes = String(formData.get("notes") || "").trim() || null;

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "Choose a file first." }, { status: 400 });

  // Everything is checked before anything is written, so a bad second file
  // cannot leave the first one filed on its own.
  for (const file of files) {
    const problem = checkUpload({ name: file.name, type: file.type, size: file.size });
    if (problem) return NextResponse.json({ error: problem.message }, { status: 400 });
  }

  const saved: string[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const [row] = await db
      .insert(schema.purchaseDocuments)
      .values({
        purchaseId,
        kind,
        filename: safeFilename(file.name),
        contentType: file.type.toLowerCase(),
        sizeBytes: buffer.byteLength,
        dataBase64: buffer.toString("base64"),
        notes,
      })
      .returning({ id: schema.purchaseDocuments.id });
    saved.push(row.id);
  }

  return NextResponse.json({ ids: saved, count: saved.length });
}
