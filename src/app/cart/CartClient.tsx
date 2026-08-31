"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CartLine, getCart, updateQty, removeFromCart, lineKeyOf, onCartChange, formatINR } from "@/lib/cart";

const FREE_SHIP_THRESHOLD = 5999;

export default function CartClient() {
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
        <div className="summary-row"><span>Shipping</span><span>{cart.length === 0 ? "—" : freeShipping ? "Free" : "Confirmed before dispatch"}</span></div>
        <div className="summary-row total"><span>Total</span><span>{formatINR(subtotal)}</span></div>
        {cart.length > 0 ? (
          <Link href="/checkout" className="btn btn-primary btn-block" style={{ marginTop: 18 }}>Proceed to Checkout</Link>
        ) : (
          <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled>Proceed to Checkout</button>
        )}
        <p className="promo-note">Free shipping on orders above ₹5,999. Coupon codes applied at checkout.</p>
      </aside>
    </div>
  );
}
