import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Serves a photo uploaded through the admin product screen. Public and
// unauthenticated on purpose — this is exactly what an <img src> on the
// storefront needs to load. The id is a random UUID, so it's effectively
// unguessable, and cached hard since the content behind a given id never
// changes (a re-upload gets a brand new id).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const asset = await db.query.productImageAssets.findFirst({ where: eq(schema.productImageAssets.id, id) });
  if (!asset) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const buffer = Buffer.from(asset.dataBase64, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
