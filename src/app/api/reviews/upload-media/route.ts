import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth";
import { getMediaStore } from "@/lib/media-blobs";
import { db, schema } from "@/db";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "video/mp4", "video/webm", "video/quicktime",
  "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav",
  "image/jpeg", "image/png", "image/webp",
]);

// 3 MB per chunk (raw bytes). After base64 encoding (~4 MB) + JSON overhead,
// each request stays well under Netlify's ~6 MB function payload limit.
const MAX_CHUNK_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB overall
const MAX_CHUNKS = 10;
// Upload sessions expire after 15 minutes
const UPLOAD_TTL_MS = 15 * 60 * 1000;

type StartBody = { action: "start"; contentType: string; totalChunks: number };
type ChunkBody = { action: "chunk"; uploadId: string; index: number; data: string };
type CompleteBody = { action: "complete"; uploadId: string };
type UploadMeta = {
  customerId: string;
  contentType: string;
  totalChunks: number;
  receivedChunks: number[];
  createdAt: number;
};

export async function POST(request: Request) {
  const customerId = await getCustomerSession();
  if (!customerId) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const store = getMediaStore();
  if (!store) {
    return NextResponse.json(
      { error: "Media uploads are not available in this environment." },
      { status: 503 },
    );
  }

  let body: StartBody | ChunkBody | CompleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "start") {
    return handleStart(store, body as StartBody, customerId);
  } else if (body.action === "chunk") {
    return handleChunk(store, body as ChunkBody, customerId);
  } else if (body.action === "complete") {
    return handleComplete(store, body as CompleteBody, customerId);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

/* ------------------------------------------------------------------ start */
async function handleStart(
  store: ReturnType<typeof getMediaStore> & {},
  body: StartBody,
  customerId: string,
) {
  if (!ALLOWED_TYPES.has(body.contentType)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }
  if (!body.totalChunks || body.totalChunks < 1 || body.totalChunks > MAX_CHUNKS) {
    return NextResponse.json(
      { error: `Upload must be between 1 and ${MAX_CHUNKS} chunks.` },
      { status: 400 },
    );
  }

  const uploadId = `upl_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const meta: UploadMeta = {
    customerId,
    contentType: body.contentType,
    totalChunks: body.totalChunks,
    receivedChunks: [],
    createdAt: Date.now(),
  };

  await store.setJSON(`upload:${uploadId}:meta`, meta);

  return NextResponse.json({ uploadId });
}

/* ------------------------------------------------------------------ chunk */
async function handleChunk(
  store: ReturnType<typeof getMediaStore> & {},
  body: ChunkBody,
  customerId: string,
) {
  const { uploadId, index, data } = body;
  if (!uploadId || index == null || !data) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const meta: UploadMeta | null = await store.get(`upload:${uploadId}:meta`, {
    type: "json",
  });
  if (!meta || meta.customerId !== customerId) {
    return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
  }

  // Check expiry
  if (Date.now() - meta.createdAt > UPLOAD_TTL_MS) {
    return NextResponse.json({ error: "Upload session expired. Please try again." }, { status: 410 });
  }

  if (index < 0 || index >= meta.totalChunks) {
    return NextResponse.json({ error: "Invalid chunk index." }, { status: 400 });
  }

  // Decode base64 → binary
  const buffer = Buffer.from(data, "base64");
  if (buffer.length > MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: "Chunk too large (max 3 MB)." }, { status: 400 });
  }

  // Store the binary chunk
  await store.set(`upload:${uploadId}:chunk:${index}`, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

  // Track which chunks have arrived
  if (!meta.receivedChunks.includes(index)) {
    meta.receivedChunks.push(index);
  }
  await store.setJSON(`upload:${uploadId}:meta`, meta);

  return NextResponse.json({
    ok: true,
    received: meta.receivedChunks.length,
    total: meta.totalChunks,
  });
}

/* --------------------------------------------------------------- complete */
async function handleComplete(
  store: ReturnType<typeof getMediaStore> & {},
  body: CompleteBody,
  customerId: string,
) {
  const { uploadId } = body;
  if (!uploadId) {
    return NextResponse.json({ error: "Missing uploadId." }, { status: 400 });
  }

  const meta: UploadMeta | null = await store.get(`upload:${uploadId}:meta`, {
    type: "json",
  });
  if (!meta || meta.customerId !== customerId) {
    return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
  }

  if (Date.now() - meta.createdAt > UPLOAD_TTL_MS) {
    return NextResponse.json({ error: "Upload session expired." }, { status: 410 });
  }

  // Check all chunks arrived
  if (meta.receivedChunks.length < meta.totalChunks) {
    return NextResponse.json(
      { error: `Missing chunks: received ${meta.receivedChunks.length}/${meta.totalChunks}.` },
      { status: 400 },
    );
  }

  // Assemble all chunks in order
  const chunks: Buffer[] = [];
  for (let i = 0; i < meta.totalChunks; i++) {
    const chunk = await store.get(`upload:${uploadId}:chunk:${i}`, {
      type: "arrayBuffer",
    });
    if (!chunk) {
      return NextResponse.json({ error: `Missing chunk ${i}.` }, { status: 400 });
    }
    chunks.push(Buffer.from(chunk));
  }

  const fullBuffer = Buffer.concat(chunks);
  if (fullBuffer.length > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "File too large (max 20 MB)." }, { status: 400 });
  }

  // Store the final assembled media in blobs
  const mediaKey = `media_${randomUUID().replace(/-/g, "")}`;
  await store.set(mediaKey, fullBuffer.buffer.slice(fullBuffer.byteOffset, fullBuffer.byteOffset + fullBuffer.byteLength), {
    metadata: { contentType: meta.contentType },
  });

  // Create a productImageAssets row with a blob: reference instead of raw base64.
  // The /api/images/[id] route knows how to serve blob-referenced assets.
  const [asset] = await db
    .insert(schema.productImageAssets)
    .values({
      contentType: meta.contentType,
      dataBase64: `blob:${mediaKey}`,
    })
    .returning({ id: schema.productImageAssets.id });

  // Best-effort cleanup of temporary chunks
  cleanup(store, uploadId, meta.totalChunks);

  return NextResponse.json({
    assetId: asset.id,
    url: `/api/images/${asset.id}`,
  });
}

/** Fire-and-forget cleanup — never blocks the response. */
function cleanup(
  store: ReturnType<typeof getMediaStore> & {},
  uploadId: string,
  totalChunks: number,
) {
  (async () => {
    try {
      await store.delete(`upload:${uploadId}:meta`);
      for (let i = 0; i < totalChunks; i++) {
        await store.delete(`upload:${uploadId}:chunk:${i}`);
      }
    } catch {
      // Non-critical — orphaned temp blobs are small and harmless.
    }
  })();
}
