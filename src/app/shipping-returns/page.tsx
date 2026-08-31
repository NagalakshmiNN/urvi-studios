import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { formatINR } from "@/lib/format";
import { FREE_SHIP_THRESHOLD } from "@/lib/order-pricing";
import { SITE } from "@/lib/site-config";

export default function ShippingReturnsPage() {
  return (
    <>
      <SiteHeader />
      <div className="page-hero container">
        <div className="eyebrow">Good to know</div>
        <h1>Shipping &amp; Returns</h1>
      </div>

      <section className="section" style={{ paddingTop: 10 }}>
        <div className="container" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="contact-card">
            <h4>Shipping &amp; Delivery</h4>
            <p style={{ fontStyle: "italic", color: "var(--olive)", marginBottom: 12 }}>
              Wherever you are in India, URVI comes to you.
            </p>
            <p>
              We deliver across India, bringing your carefully chosen pieces from our studio to your doorstep,
              wherever you are.
            </p>
            <p>
              Delivery is <strong>free on orders above {formatINR(FREE_SHIP_THRESHOLD)}</strong>. On orders below
              {" "}{formatINR(FREE_SHIP_THRESHOLD)}, delivery charges are additional — they vary based on your
              location and package, and our team will confirm the exact amount with you before dispatch.
            </p>
            <p>
              Once your order is confirmed, most pieces are carefully packed and dispatched within 2–3 business
              days. Delivery typically takes 5–8 business days from dispatch, depending on your location.
            </p>
            <p>
              Every URVI order is packed with care, because we believe the experience should begin before you
              open the box.
            </p>
            <p style={{ fontWeight: 600, color: "var(--olive)", marginTop: 12 }}>
              Order. Unbox. Wear it with confidence.
            </p>
          </div>
          <div className="contact-card">
            <h4>Exchanges &amp; Returns</h4>
            <p>
              Since every piece is sourced in small batches, we offer size exchanges within 7 days of delivery,
              subject to the piece being unworn, unwashed, and with tags intact. Reach out to us on WhatsApp with
              your order number and we&apos;ll take it from there — we handle every exchange personally.
            </p>
          </div>
          <div className="contact-card">
            <h4>Order Issues</h4>
            <p>
              If anything arrives damaged or not as described, message us within 48 hours of delivery with photos
              and we&apos;ll make it right — a replacement, exchange, or refund, whichever suits you best.
            </p>
            <a href={`https://wa.me/${SITE.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small" style={{ marginTop: 10 }}>
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
