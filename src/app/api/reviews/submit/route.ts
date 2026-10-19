import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCustomerSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

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
    photoBase64?: string;
    photoContentType?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { productId, rating, title, reviewBody, photoBase64, photoContentType } = body;

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

  // Check for verified purchase — did they buy and receive this product?
  const deliveredOrder = await db.query.orderItems.findFirst({
    where: eq(schema.orderItems.productId, productId),
    with: {
      order: true,
    },
  });
  // A purchase is verified if there's a delivered order for this customer and product
  const verifiedPurchase = !!deliveredOrder &&
    deliveredOrder.order.customerId === customerId &&
    deliveredOrder.order.status === "DELIVERED";

  // Handle optional photo upload
  let photoUrl: string | null = null;
  if (photoBase64 && photoContentType) {
    if (!ALLOWED_IMAGE_TYPES.has(photoContentType)) {
      return NextResponse.json({ error: "Photo must be JPG, PNG or WEBP." }, { status: 400 });
    }
    const sizeBytes = Math.ceil(photoBase64.length * 0.75);
    if (sizeBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Photo must be under 5MB." }, { status: 400 });
    }
    const [asset] = await db
      .insert(schema.productImageAssets)
      .values({ contentType: photoContentType, dataBase64: photoBase64 })
      .returning({ id: schema.productImageAssets.id });
    photoUrl = `/api/images/${asset.id}`;
  }

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

  return NextResponse.json({
    ok: true,
    reviewId: review.id,
    verifiedPurchase,
  });
}
