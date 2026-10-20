"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CartLine, getCart, updateQty, removeFromCart, lineKeyOf, onCartChange, formatINR } from "@/lib/cart";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE } from "@/lib/shipping";
import { calculateGst } from "@/lib/gst";

const FREE_SHIP_THRESHOLD = FREE_SHIPPING_THRESHOLD;

export default function CartClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const update = () => setCart(getCart());
    update();
    setLoaded(true);
    return onCartChange(update);
  }, []);

  if (!loaded) return null;

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const freeShipping = subtotal >= FREE_SHIP_THRESHOLD;
  const shipping = freeShipping ? 0 : STANDARD_SHIPPING_FEE;
  const { totalGst, rateLabel } = calculateGst(cart.map((l) => ({ price: l.price, qty: l.qty })));

  return (
    <div className="cart-layout">
      <div>
        {cart.length === 0 ? (
          <div className="empty-state">
            <h3>Your bag is empty</h3>
            <p>Time to find something beautiful.</p>
            <Link href="/shop" className="btn btn-outline" style={{ marginTop: 16 }}>Continue Shopping</Link>
          </div>
        ) : (
          cart.map((item) => {
            const key = lineKeyOf(item);
            return (
              <div className="cart-item" key={key}>
                <img src={item.image} alt={item.name} />
                <div>
                  <div className="name">{item.name}</div>
                  <div className="meta">Size {item.size} · {item.color}</div>
                  <div className="meta" style={{ fontFamily: "monospace", fontSize: 11.5 }}>Product ID — {item.sku}</div>
                  <div className="qty-stepper" style={{ width: "fit-content" }}>
                    <button onClick={() => updateQty(key, item.qty - 1)}>–</button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateQty(key, item.qty + 1)}>+</button>
                  </div>
                  <button className="remove" onClick={() => removeFromCart(key)}>Remove</button>
                </div>
                <div className="price">{formatINR(item.price * item.qty)}</div>
              </div>
            );
          })
        )}
      </div>
      <aside className="summary-card">
        <h3>Order Summary</h3>
        <div className="summary-row"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
        {cart.length > 0 && (
          <div className="summary-row" style={{ color: "var(--sage)", fontSize: 12.5 }}>
            <span>GST ({rateLabel}, included)</span><span>{formatINR(totalGst)}</span>
          </div>
        )}
        <div className="summary-row"><span>Delivery</span><span>{cart.length === 0 ? "—" : freeShipping ? <span style={{ color: "var(--olive)", fontWeight: 600 }}>Free</span> : formatINR(shipping)}</span></div>
        <div className="summary-row total"><span>Total</span><span>{formatINR(subtotal + shipping)}</span></div>
        {cart.length > 0 ? (
          <Link href="/checkout" className="btn btn-primary btn-block" style={{ marginTop: 18 }}>Proceed to Checkout</Link>
        ) : (
          <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled>Proceed to Checkout</button>
        )}
        {!isLoggedIn && cart.length > 0 && (
          <p className="promo-note" style={{ marginTop: 10 }}>
            You can checkout as a guest, or login for faster checkout next time.
          </p>
        )}
        {!freeShipping && cart.length > 0 && (() => {
          const remaining = FREE_SHIP_THRESHOLD - subtotal;
          const pct = Math.min(100, Math.round((subtotal / FREE_SHIP_THRESHOLD) * 100));
          return (
            <div style={{ marginTop: 4 }}>
              <div style={{ background: "var(--sand)", height: 6, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: "linear-gradient(90deg, var(--olive), var(--sage))", transition: "width 0.4s" }} />
              </div>
              <p className="promo-note" style={{ marginTop: 6 }}>
                Add {formatINR(remaining)} more for free delivery
              </p>
            </div>
          );
        })()}
        {freeShipping && cart.length > 0 && (
          <p className="promo-note" style={{ marginTop: -6, color: "var(--olive)" }}>
            Your order qualifies for free delivery across India.
          </p>
        )}
        <p className="promo-note">Coupon codes applied at checkout.</p>
      </aside>
    </div>
  );
}
