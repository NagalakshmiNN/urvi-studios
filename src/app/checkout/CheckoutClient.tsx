"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { CartLine, getCart, clearCart, updateQty, removeFromCart, lineKeyOf, formatINR } from "@/lib/cart";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { calculateGst } from "@/lib/gst";

const FREE_SHIP_THRESHOLD = FREE_SHIPPING_THRESHOLD;

type Prefill = { name: string; email: string; phone: string } | null;

export default function CheckoutClient({ prefill, razorpayConfigured }: { prefill: Prefill; razorpayConfigured: boolean }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsappHandoff, setWhatsappHandoff] = useState<{ urls: { name: string; url: string }[]; orderNumber: string } | null>(null);

  useEffect(() => {
    setCart(getCart());
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (cart.length === 0 && !whatsappHandoff) {
    return (
      <div className="empty-state" style={{ padding: "80px 20px" }}>
        <h3>Your bag is empty</h3>
        <p>Add something you love before checking out.</p>
        <a href="/shop" className="btn btn-outline" style={{ marginTop: 16 }}>Continue Shopping</a>
      </div>
    );
  }

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const freeShipping = subtotal >= FREE_SHIP_THRESHOLD;
  const total = Math.max(0, subtotal - discount);
  const { totalGst, rateLabel } = calculateGst(cart.map((l) => ({ price: l.price, qty: l.qty })));

  // Cart edits happen on the same localStorage cart the Cart page uses —
  // update it there (so the two pages never disagree) and mirror the
  // change into local state so this page's totals recompute immediately.
  // An already-applied coupon is cleared, since editing the cart can change
  // whether it still qualifies — re-apply it to confirm against the new total.
  function changeQty(key: string, qty: number) {
    const newQty = Math.max(1, qty);
    updateQty(key, newQty);
    setCart((prev) => prev.map((l) => (lineKeyOf(l) === key ? { ...l, qty: newQty } : l)));
    setDiscount(0);
    setCouponMsg(null);
  }
  function removeLine(key: string) {
    removeFromCart(key);
    setCart((prev) => prev.filter((l) => lineKeyOf(l) !== key));
    setDiscount(0);
    setCouponMsg(null);
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponMsg(null);
    const res = await fetch("/api/checkout/preview-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map((l) => ({ productId: l.productId, size: l.size, color: l.color, qty: l.qty })), couponCode }),
    });
    const data = await res.json();
    if (data.ok) {
      setDiscount(data.discount);
      setCouponMsg({ text: `"${data.couponCode}" applied — you saved ${formatINR(data.discount)}.`, ok: true });
    } else {
      setDiscount(0);
      setCouponMsg({ text: data.error || "That code didn't work.", ok: false });
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    const customer = {
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      phone: String(fd.get("phone") || ""),
      address: String(fd.get("address") || ""),
      city: String(fd.get("city") || ""),
      state: String(fd.get("state") || ""),
      pincode: String(fd.get("pincode") || ""),
      notes: String(fd.get("notes") || ""),
    };

    try {
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.productId, size: l.size, color: l.color, qty: l.qty })),
          customer,
          couponCode: discount > 0 ? couponCode : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }

      if (!data.configured) {
        clearCart();
        setWhatsappHandoff({ urls: data.whatsappUrls, orderNumber: data.orderNumber });
        setBusy(false);
        return;
      }

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: "INR",
        name: "Urvi Studios",
        description: `Order ${data.orderNumber}`,
        order_id: data.order_id,
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
        theme: { color: "#3F4827" },
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          const verifyRes = await fetch("/api/checkout/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, orderNumber: data.orderNumber }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.verified) {
            clearCart();
            router.push(`/order-success?order=${encodeURIComponent(data.orderNumber)}`);
          } else {
            setError("Payment verification failed. Please contact us before trying again.");
            setBusy(false);
          }
        },
        modal: {
          ondismiss: function () {
            setBusy(false);
          },
        },
      };
      // @ts-expect-error — Razorpay Checkout is loaded globally via the script tag below
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      setError("Something went wrong. Please try again or reach us on WhatsApp.");
      setBusy(false);
    }
  }

  if (whatsappHandoff) {
    return (
      <div className="empty-state" style={{ padding: "60px 20px" }}>
        <h3>Order {whatsappHandoff.orderNumber} received</h3>
        <p>Online payment is being finalised for Urvi Studios. Send your order to whichever of us is easiest to reach — we&apos;ll confirm and share a payment link personally.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginTop: 18, width: "100%", maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
          {whatsappHandoff.urls.map((w) => (
            <a key={w.name} href={w.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block">
              Send to {w.name} on WhatsApp
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {razorpayConfigured && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />}
      <form className="checkout-layout" onSubmit={submit}>
        <div>
          <h3 style={{ marginBottom: 16 }}>Shipping Details</h3>
          <div className="form-group">
            <label>Full name</label>
            <input type="text" name="name" required defaultValue={prefill?.name} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" name="email" required defaultValue={prefill?.email} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" name="phone" required defaultValue={prefill?.phone} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input type="text" name="address" required placeholder="House no, street, area" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input type="text" name="city" required />
            </div>
            <div className="form-group">
              <label>State</label>
              <input type="text" name="state" required />
            </div>
            <div className="form-group">
              <label>Pincode</label>
              <input type="text" name="pincode" required maxLength={6} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea name="notes" rows={3} />
          </div>
        </div>

        <aside className="summary-card">
          <h3>Order Summary</h3>
          <div id="checkout-lines">
            {cart.map((item) => {
              const key = lineKeyOf(item);
              return (
                <div className="mini-line" key={key}>
                  <img src={item.image} alt={item.name} />
                  <div style={{ flex: 1 }}>
                    <div>{item.name}</div>
                    <div style={{ color: "var(--sage)", fontSize: 11.5 }}>Size {item.size} · {item.color}</div>
                    <div style={{ color: "var(--sage)", fontSize: 11, fontFamily: "monospace" }}>ID — {item.sku}</div>
                    <div className="qty-stepper" style={{ width: "fit-content", marginTop: 6, transform: "scale(0.85)", transformOrigin: "left center" }}>
                      <button type="button" onClick={() => changeQty(key, item.qty - 1)}>–</button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => changeQty(key, item.qty + 1)}>+</button>
                    </div>
                    <button type="button" className="link-btn danger" style={{ fontSize: 10.5, marginTop: 6 }} onClick={() => removeLine(key)}>Remove</button>
                  </div>
                  <div style={{ fontWeight: 600 }}>{formatINR(item.price * item.qty)}</div>
                </div>
              );
            })}
          </div>
          <a href="/shop" className="link-btn" style={{ display: "inline-block", marginBottom: 16 }}>+ Add more items</a>

          <div className="coupon-row">
            <input type="text" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
            <button type="button" className="btn btn-outline" onClick={applyCoupon}>Apply</button>
          </div>
          {couponMsg && (
            <p style={{ fontSize: 12, color: couponMsg.ok ? "var(--olive)" : "#a5333a", marginTop: -8, marginBottom: 12 }}>{couponMsg.text}</p>
          )}

          <div className="summary-row"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
          <div className="summary-row" style={{ color: "var(--sage)", fontSize: 12.5 }}>
            <span>GST ({rateLabel}, included)</span><span>{formatINR(totalGst)}</span>
          </div>
          <div className="summary-row"><span>Delivery</span><span>{freeShipping ? "Free" : "Additional"}</span></div>
          {discount > 0 && <div className="summary-row"><span>Discount</span><span>−{formatINR(discount)}</span></div>}
          <div className="summary-row total"><span>Total</span><span>{formatINR(total)}</span></div>
          {!freeShipping && (
            <p className="promo-note" style={{ marginTop: -6 }}>
              Delivery charges are additional on this order — they depend on your pincode and package, so our
              team will confirm the amount with you before dispatch. Free delivery on orders above ₹5,000.
            </p>
          )}
          <p className="promo-note" style={{ marginTop: freeShipping ? -6 : 0 }}>We deliver across India.</p>

          {error && <div className="notice-box error" style={{ marginTop: 14 }}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={busy}>
            {busy ? "Processing…" : "Place Order"}
          </button>
          <p className="promo-note">Your payment is processed securely by Razorpay. We never see or store your card details.</p>
        </aside>
      </form>
    </>
  );
}
