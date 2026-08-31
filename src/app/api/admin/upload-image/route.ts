import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB per photo — plenty for a product shot, keeps rows small

// Product photos, uploaded straight from the admin screen. Stored as base64
// text in Postgres (see schema.ts productImageAssets for why — Netlify's
// serverless functions can't write to disk) and handed back a /api/images/[id]
// URL that goes straight into the same "images" field the product forms
// already used for pasted URLs, so nothing downstream had to change.
export async function POST(request: Request) {
  const adminId = await getAdminSession();
  if (!adminId) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const files = formData?.getAll("files") ?? [];
  if (files.length === 0) return NextResponse.json({ error: "No files received." }, { status: 400 });

  const urls: string[] = [];
  for (const file of files) {
    if (!(file instanceof Blob)) continue;
    const type = file.type || "application/octet-stream";
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: `"${(file as File).name ?? "file"}" isn't a supported image type (use JPG, PNG, WEBP or GIF).` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `"${(file as File).name ?? "file"}" is larger than 8MB — please use a smaller photo.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataBase64 = buffer.toString("base64");

    const [asset] = await db
      .insert(schema.productImageAssets)
      .values({ contentType: type, dataBase64 })
      .returning({ id: schema.productImageAssets.id });

    urls.push(`/api/images/${asset.id}`);
  }

  if (urls.length === 0) return NextResponse.json({ error: "Nothing uploaded." }, { status: 400 });
  return NextResponse.json({ urls });
}
