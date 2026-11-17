import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getMediaStore, isBlobRef, getBlobKey } from "@/lib/media-blobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Serves a photo/video/audio uploaded through the admin product screen or
// the customer review form. Public and unauthenticated on purpose — this is
// exactly what an <img src> or <video src> on the storefront needs to load.
// The id is a random UUID, so it's effectively unguessable, and cached hard
// since the content behind a given id never changes (a re-upload gets a
// brand new id).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const asset = await db.query.productImageAssets.findFirst({
    where: eq(schema.productImageAssets.id, id),
  });
  if (!asset) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const CACHE_HEADERS = {
    "Content-Type": asset.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };

  // ---- Blob-stored media (videos, audio, large images) -----------------
  if (isBlobRef(asset.dataBase64)) {
    const store = getMediaStore();
    if (!store) {
      return NextResponse.json({ error: "Media store unavailable." }, { status: 503 });
    }

    const blobKey = getBlobKey(asset.dataBase64);
    const data = await store.get(blobKey, { type: "arrayBuffer" });
    if (!data) {
      return NextResponse.json({ error: "Media not found in store." }, { status: 404 });
    }

    const buffer = Buffer.from(data);
    return serveWithRangeSupport(request, buffer, CACHE_HEADERS);
  }

  // ---- Traditional base64-in-DB media (product photos, small images) ----
  const buffer = Buffer.from(asset.dataBase64, "base64");

  // Guard against serving very large blobs that would spike memory.
  const FIFTY_MB = 50 * 1024 * 1024;
  if (buffer.length > FIFTY_MB) {
    return NextResponse.json({ error: "Asset too large." }, { status: 413 });
  }

  return serveWithRangeSupport(request, buffer, CACHE_HEADERS);
}

/**
 * Serve a Buffer with HTTP Range request support.
 * Browsers use Range requests for <video> and <audio> playback, requesting
 * small chunks at a time, which also keeps each function response well under
 * Netlify's payload limits.
 */
function serveWithRangeSupport(
  request: Request,
  buffer: Buffer,
  baseHeaders: Record<string, string>,
) {
  const totalSize = buffer.length;
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      // Default chunk: 2 MB — keeps each partial response well within limits.
      const end = match[2]
        ? Math.min(parseInt(match[2], 10), totalSize - 1)
        : Math.min(start + 2 * 1024 * 1024 - 1, totalSize - 1);

      if (start >= totalSize || end >= totalSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }

      return new NextResponse(new Uint8Array(buffer.slice(start, end + 1)), {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  // Full response (no Range header)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...baseHeaders,
      "Content-Length": String(totalSize),
    },
  });
}
