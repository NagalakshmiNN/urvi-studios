import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCustomerSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 5;

type MediaItem = {
  kind: "photo" | "video" | "audio";
  base64: string;
  contentType: string;
  sortOrder: number;
};

export async function POST(request: Request) {
  const customerId = await getCustomerSession();
  if (!customerId) {
    return NextResponse.json({ error: "Please log in to write a review." }, { status: 401 });
  }

  const customer = await db.query.customers.findFirst({
    where: eq(schema.customers.id, customerId),
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  let body: {
    productId: string;
    rating: number;
    title?: string;
    reviewBody: string;
    media?: MediaItem[];
    // Legacy single-photo support
    photoBase64?: string;
    photoContentType?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { productId, rating, title, reviewBody } = body;

  // Validate required fields
  if (!productId || !rating || !reviewBody) {
    return NextResponse.json({ error: "Product, rating and review text are required." }, { status: 400 });
  }
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json({ error: "Rating must be 1–5." }, { status: 400 });
  }
  if (reviewBody.trim().length < 10) {
    return NextResponse.json({ error: "Please write at least 10 characters." }, { status: 400 });
  }
  if (reviewBody.length > 2000) {
    return NextResponse.json({ error: "Review text must be under 2000 characters." }, { status: 400 });
  }

  // Check product exists
  const product = await db.query.products.findFirst({
    where: eq(schema.products.id, productId),
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  // Check if customer already reviewed this product
  const existing = await db.query.reviews.findFirst({
    where: and(
      eq(schema.reviews.productId, productId),
      eq(schema.reviews.customerId, customerId),
    ),
  });
  if (existing) {
    return NextResponse.json({ error: "You have already reviewed this product." }, { status: 409 });
  }

  // Verified purchase check
  const deliveredOrder = await db.query.orderItems.findFirst({
    where: eq(schema.orderItems.productId, productId),
    with: { order: true },
  });
  const verifiedPurchase = !!deliveredOrder &&
    deliveredOrder.order.customerId === customerId &&
    deliveredOrder.order.status === "DELIVERED";

  // Build media list from either new multi-media or legacy single-photo
  const mediaItems: MediaItem[] = [];

  if (body.media && body.media.length > 0) {
    const photoCount = body.media.filter((m) => m.kind === "photo").length;
    const videoCount = body.media.filter((m) => m.kind === "video").length;
    const audioCount = body.media.filter((m) => m.kind === "audio").length;

    if (photoCount > MAX_PHOTOS) {
      return NextResponse.json({ error: `Maximum ${MAX_PHOTOS} photos allowed.` }, { status: 400 });
    }
    if (videoCount > 1) {
      return NextResponse.json({ error: "Only one video allowed." }, { status: 400 });
    }
    if (audioCount > 1) {
      return NextResponse.json({ error: "Only one audio file allowed." }, { status: 400 });
    }

    for (const m of body.media) {
      const sizeBytes = Math.ceil(m.base64.length * 0.75);

      if (m.kind === "photo") {
        if (!ALLOWED_IMAGE_TYPES.has(m.contentType)) {
          return NextResponse.json({ error: "Photos must be JPG, PNG or WEBP." }, { status: 400 });
        }
        if (sizeBytes > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: "Each photo must be under 5 MB." }, { status: 400 });
        }
      } else if (m.kind === "video") {
        if (!ALLOWED_VIDEO_TYPES.has(m.contentType)) {
          return NextResponse.json({ error: "Video must be MP4, WebM or MOV." }, { status: 400 });
        }
        if (sizeBytes > MAX_VIDEO_BYTES) {
          return NextResponse.json({ error: "Video must be under 50 MB." }, { status: 400 });
        }
      } else if (m.kind === "audio") {
        if (!ALLOWED_AUDIO_TYPES.has(m.contentType)) {
          return NextResponse.json({ error: "Audio must be MP3, M4A, WebM, OGG or WAV." }, { status: 400 });
        }
        if (sizeBytes > MAX_AUDIO_BYTES) {
          return NextResponse.json({ error: "Audio must be under 10 MB." }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: "Invalid media kind." }, { status: 400 });
      }

      mediaItems.push(m);
    }
  } else if (body.photoBase64 && body.photoContentType) {
    // Legacy single photo support
    if (!ALLOWED_IMAGE_TYPES.has(body.photoContentType)) {
      return NextResponse.json({ error: "Photo must be JPG, PNG or WEBP." }, { status: 400 });
    }
    const sizeBytes = Math.ceil(body.photoBase64.length * 0.75);
    if (sizeBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Photo must be under 5 MB." }, { status: 400 });
    }
    mediaItems.push({
      kind: "photo",
      base64: body.photoBase64,
      contentType: body.photoContentType,
      sortOrder: 0,
    });
  }

  // Upload all media assets first
  const assetRecords: { kind: string; assetId: string; sortOrder: number; url: string }[] = [];
  for (const m of mediaItems) {
    const [asset] = await db
      .insert(schema.productImageAssets)
      .values({ contentType: m.contentType, dataBase64: m.base64 })
      .returning({ id: schema.productImageAssets.id });
    assetRecords.push({
      kind: m.kind,
      assetId: asset.id,
      sortOrder: m.sortOrder,
      url: `/api/images/${asset.id}`,
    });
  }

  // First photo becomes the legacy photoUrl for backward compat
  const firstPhoto = assetRecords.find((a) => a.kind === "photo");
  const photoUrl = firstPhoto ? firstPhoto.url : null;

  // Insert the review
  const [review] = await db
    .insert(schema.reviews)
    .values({
      productId,
      customerId,
      customerName: customer.name,
      rating,
      title: title?.trim() || null,
      body: reviewBody.trim(),
      photoUrl,
      verifiedPurchase,
      status: "PENDING",
    })
    .returning({ id: schema.reviews.id });

  // Insert review media rows
  if (assetRecords.length > 0) {
    await db.insert(schema.reviewMedia).values(
      assetRecords.map((a) => ({
        reviewId: review.id,
        kind: a.kind,
        assetId: a.assetId,
        sortOrder: a.sortOrder,
      }))
    );
  }

  return NextResponse.json({
    ok: true,
    reviewId: review.id,
    verifiedPurchase,
    mediaCount: assetRecords.length,
  });
}
