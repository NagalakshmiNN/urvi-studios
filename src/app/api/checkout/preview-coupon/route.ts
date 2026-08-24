import { NextResponse } from "next/server";
import { priceCart, type CartLineInput } from "@/lib/order-pricing";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const { items, couponCode } = body as { items: CartLineInput[]; couponCode?: string };
  const pricing = await priceCart(items, couponCode);

  if (!pricing.ok) return NextResponse.json({ ok: false, error: pricing.error });
  return NextResponse.json({ ok: true, discount: pricing.discount, couponCode: pricing.couponCode });
}
