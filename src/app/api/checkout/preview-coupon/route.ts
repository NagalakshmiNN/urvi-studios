import { NextResponse } from "next/server";
import { priceCart, type CartLineInput } from "@/lib/order-pricing";
import { allowRequest, callerKey } from "@/lib/login-throttle";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const { items, couponCode } = body as { items: CartLineInput[]; couponCode?: string };

  // This route answers yes or no to any code offered, which makes it a clean
  // oracle: a script can work through a namespace and find every live coupon
  // in minutes. Twenty tries per caller per fifteen minutes is far more than
  // a shopper typing a code off an Instagram post ever needs, and far less
  // than a dictionary needs to be useful.
  //
  // Nothing is lost by being wrong here: a real customer who somehow hits the
  // limit can still apply the coupon at checkout, where it is validated
  // again. This route is only the preview.
  if (couponCode && !(await allowRequest(callerKey("coupon", request.headers), 20))) {
    return NextResponse.json({ ok: false, error: "Too many coupon attempts — please try again in a few minutes." });
  }

  const pricing = await priceCart(items, couponCode);

  if (!pricing.ok) return NextResponse.json({ ok: false, error: pricing.error });
  return NextResponse.json({ ok: true, discount: pricing.discount, couponCode: pricing.couponCode });
}
