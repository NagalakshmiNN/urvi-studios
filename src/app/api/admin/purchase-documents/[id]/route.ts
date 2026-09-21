import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";
import { canPreview } from "@/lib/purchase-documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Handing back one uploaded document.
//
// Unlike /api/images/[id], which is deliberately public so the storefront can
// load a product photo, this checks the admin session on every request. A
// vendor invoice shows what the business pays for its stock; an unguessable id
// is not a reason to serve it to anyone who has one.
//
// A soft-deleted document is treated as gone. It can be restored from the
// purchase screen, and only then does it become reachable again — otherwise
// "deleted" would mean nothing more than "hidden from the list".
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const { id } = await params;
  const doc = await db.query.purchaseDocuments.findFirst({ where: eq(schema.purchaseDocuments.id, id) });
  if (!doc || doc.deletedAt) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // `?download=1` forces a save rather than a preview — the difference between
  // reading an invoice on screen and keeping a copy for the accountant.
  const download = new URL(request.url).searchParams.get("download") === "1";
  const inline = !download && canPreview(doc.contentType);

  // The filename is already stripped of quotes and control characters on the
  // way in; encoded again here because a header is the one place a stray
  // character does real damage.
  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.filename)}`;

  return new NextResponse(Buffer.from(doc.dataBase64, "base64"), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": disposition,
      "Content-Length": String(doc.sizeBytes),
      // Never cached by a shared cache: this is behind a login, and a copy
      // sitting in one is a copy outside it.
      "Cache-Control": "private, no-store",
    },
  });
}
