import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { formatINR } from "@/lib/format";
import { FREE_SHIP_THRESHOLD, SHIP_COST } from "@/lib/order-pricing";
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
            <h4>Shipping</h4>
            <p>
              We ship across India. Orders above {formatINR(FREE_SHIP_THRESHOLD)} ship free; below that, shipping
              is a flat {formatINR(SHIP_COST)}. Most pieces leave our hands within 2–3 business days of being
              confirmed, and typically arrive within 5–8 business days depending on your city.
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
