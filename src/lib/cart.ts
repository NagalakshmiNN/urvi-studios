"use client";

// Client-side cart, persisted in localStorage. Mirrors the shape used by
// the checkout API so the payload can be sent straight through.

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  qty: number;
};

const CART_KEY = "urvi_cart_v2";
const CART_EVENT = "urvi-cart-changed";

function lineKey(l: Pick<CartLine, "productId" | "size" | "color">) {
  return [l.productId, l.size, l.color].join("::");
}

export function getCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCart(cart: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addToCart(item: CartLine) {
  const cart = getCart();
  const key = lineKey(item);
  const existing = cart.find((l) => lineKey(l) === key);
  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.push(item);
  }
  saveCart(cart);
}

export function updateQty(key: string, qty: number) {
  const cart = getCart().map((l) => (lineKey(l) === key ? { ...l, qty: Math.max(1, qty) } : l));
  saveCart(cart);
}

export function removeFromCart(key: string) {
  const cart = getCart().filter((l) => lineKey(l) !== key);
  saveCart(cart);
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event(CART_EVENT));
}

export function cartCount(): number {
  return getCart().reduce((sum, l) => sum + l.qty, 0);
}

export function cartSubtotal(): number {
  return getCart().reduce((sum, l) => sum + l.price * l.qty, 0);
}

export function lineKeyOf(l: CartLine) {
  return lineKey(l);
}

export function onCartChange(cb: () => void) {
  window.addEventListener(CART_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CART_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function formatINR(amount: number) {
  return "₹" + Number(amount).toLocaleString("en-IN");
}
