import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Link from "next/link";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { formatINR } from "@/lib/format";
import { getCustomerSession } from "@/lib/auth";

export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderNumber } = await searchParams;
  const sessionCustomerId = await getCustomerSession();

  const found = orderNumber
    ? await db.query.orders.findFirst({ where: eq(schema.orders.orderNumber, orderNumber), with: { items: true } })
    : null;

  // Order numbers are sequential and guessable — URVI-2026-00001 and upward.
  // This page used to render whatever order the number named: the customer's
  // email address, the total, every line item. Anyone who could count could
  // walk the whole order book.
  //
  // So the order is only handed over to someone who owns it. Checkout signs
  // in even a guest (create-order creates the account and the session before
  // returning), so the person who just paid always passes this.
  const owned = Boolean(found && sessionCustomerId && sessionCustomerId === found.customerId);
  const order = owned ? found : null;
  // Kept for the wording below: this page is only ever reached by the owner
  // now, but the "you're signed in" line still reads as its own fact.
  const isSignedInHere = owned;

  // A card/UPI order that hasn't been marked paid yet means the browser's own
  // confirmation didn't get through and we're waiting on Razorpay's webhook.
  // That resolves within moments, but until it does this page must not claim
  // the order is confirmed — the customer has paid and deserves to be told
  // exactly where things stand, not a reassuring fiction.
  const awaitingConfirmation = Boolean(
    order && order.paymentMethod === "razorpay" && order.paymentStatus !== "PAID"
  );

  return (
    <>
      <SiteHeader />
      <div className="container" style={{ padding: "80px 0", textAlign: "center" }}>
        <div className="eyebrow">{order ? "Thank you" : "Order lookup"}</div>
        <h1 style={{ marginBottom: 10 }}>
          {!order ? "We couldn't show that order" : awaitingConfirmation ? "Payment received" : "Your order is confirmed"}
        </h1>
        {order ? (
          <>
            {awaitingConfirmation ? (
              <p className="lede" style={{ margin: "0 auto 30px" }}>
                We have your payment for order <strong>{order.orderNumber}</strong> — {formatINR(order.total)} — and
                we&apos;re finalising the confirmation now. Your confirmation email will arrive at{" "}
                {order.customerEmail} shortly. <strong>Please don&apos;t pay again.</strong> If you don&apos;t hear
                from us within the hour, message us on WhatsApp with this order number and we&apos;ll confirm it
                straight away.
              </p>
            ) : (
              <p className="lede" style={{ margin: "0 auto 30px" }}>
                Order <strong>{order.orderNumber}</strong> — {formatINR(order.total)} — is placed. We&apos;ll be in
                touch personally about it, and we&apos;ve emailed all the details to {order.customerEmail}.
              </p>
            )}
            {isSignedInHere && (
              <p className="lede" style={{ margin: "-20px auto 30px", fontSize: 13.5 }}>
                You&apos;re signed in — track this and future orders any time under{" "}
                <Link href="/account/orders">My Account</Link>.
              </p>
            )}
            <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "left" }} className="order-items-list">
              {order.items.map((item) => (
                <div className="order-item-row" key={item.id}>
                  <div>
                    <div className="name">{item.productName}</div>
                    <div className="meta">Size {item.size} · {item.color} · Qty {item.qty}</div>
                  </div>
                  <div className="price">{formatINR(item.price * item.qty)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="lede" style={{ margin: "0 auto 30px" }}>
            We couldn&apos;t show that order. If you&apos;ve just paid, check your email for the confirmation, or{" "}
            <Link href="/account/orders">sign in to see your orders</Link> — and if anything looks wrong, message us
            on WhatsApp and we&apos;ll sort it out right away.
          </p>
        )}
        <Link href="/shop" className="btn btn-primary" style={{ marginTop: 10 }}>Continue Shopping</Link>
      </div>
      <SiteFooter />
    </>
  );
}
