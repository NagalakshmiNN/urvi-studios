import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { formatINR } from "@/lib/format";
import { FREE_SHIP_THRESHOLD } from "@/lib/order-pricing";
import { SITE } from "@/lib/site-config";

export const metadata = {
  title: "Terms & Conditions — URVI Studios",
  description: "The terms you are agreeing to when you order from URVI Studios.",
};

// The other page a payment gateway will not activate an account without.
// Deliberately written as what actually happens when someone orders — prices
// include GST, stock is small-batch so a size can sell out between the bag and
// the payment, delivery is 5–8 days — rather than as boilerplate that describes
// no particular shop.
export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <div className="page-hero container">
        <div className="eyebrow">Good to know</div>
        <h1>Terms &amp; Conditions</h1>
      </div>

      <section className="section" style={{ paddingTop: 10 }}>
        <div className="container" style={{ maxWidth: 760, margin: "0 auto" }}>
          <p style={{ color: "var(--sage)", fontSize: 13.5, marginBottom: 22 }}>
            Last updated {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}. These terms
            apply to {SITE.siteUrl.replace("https://", "")}, run by {SITE.legalName}, {SITE.registeredAddress}.
            Placing an order means you accept them.
          </p>

          <div className="contact-card">
            <h4>Who we are</h4>
            <p>
              URVI Studios is a small Indian clothing label selling festive, office and everyday wear, founded and
              run by Shilpa and Nagalakshmi. We sell to customers in India.
            </p>
          </div>

          <div className="contact-card">
            <h4>Prices</h4>
            <p>
              Every price shown is in Indian Rupees and <strong>includes GST</strong>. There is no tax added at
              checkout. Delivery is free on orders above {formatINR(FREE_SHIP_THRESHOLD)}; below that a delivery
              charge applies and is confirmed with you before dispatch.
            </p>
            <p>
              We may change prices at any time, but never after you have placed an order — what you paid is what you
              paid.
            </p>
          </div>

          <div className="contact-card">
            <h4>Stock, and when an order is actually accepted</h4>
            <p>
              We buy in small batches, often only a few pieces per size. Your order is an offer to buy; it is
              accepted when we confirm it. Very occasionally a size sells out between your adding it to the bag and
              our packing it — if that happens we will tell you straight away and refund you in full, or hold the
              piece for the next batch if you would rather.
            </p>
          </div>

          <div className="contact-card">
            <h4>Colour and finish</h4>
            <p>
              Our photographs are of the actual garment, never a mock-up or a computer rendering. Even so, colour can
              look different from screen to screen, and hand-block prints and embroidery vary slightly from piece to
              piece — that variation is a feature of the craft, not a fault.
            </p>
          </div>

          <div className="contact-card">
            <h4>Payment</h4>
            <p>
              Payments are taken by Razorpay, which is regulated by the Reserve Bank of India. Your card, UPI and
              bank details are entered on their systems and never reach us — see our{" "}
              <Link href="/privacy">Privacy Policy</Link>. If a payment fails or is not completed, no order is
              created.
            </p>
          </div>

          <div className="contact-card">
            <h4>Delivery</h4>
            <p>
              We deliver across India. Orders are usually dispatched within 2–3 business days and arrive 5–8 business
              days after dispatch. Those are honest estimates, not guarantees — a courier delay or a festival week
              can move them, and we will tell you if it does.
            </p>
            <p>
              Please make sure the delivery address and phone number are right. A parcel returned because nobody
              could be reached can be sent again, with the delivery charge payable.
            </p>
          </div>

          <div className="contact-card">
            <h4>Cancellations, exchanges and refunds</h4>
            <p>
              The full terms are on our <Link href="/shipping-returns">Shipping &amp; Returns</Link> page. In short:
              cancel before dispatch and you are refunded in full; size exchanges within 7 days of delivery on
              unworn, unwashed pieces with tags intact; anything damaged or not as described, tell us within 48 hours
              with photographs and we will replace, exchange or refund it.
            </p>
          </div>

          <div className="contact-card">
            <h4>Your account</h4>
            <p>
              If you create an account, keep your password to yourself — anything ordered through it is treated as
              ordered by you. Tell us if you think someone else has access and we will help you secure it.
            </p>
          </div>

          <div className="contact-card">
            <h4>Our words and pictures</h4>
            <p>
              The photographs, text, logo and design on this site belong to URVI Studios. Please do not reuse them
              commercially without asking. Ask, and we are usually happy to say yes.
            </p>
          </div>

          <div className="contact-card">
            <h4>If something goes wrong</h4>
            <p>
              Talk to us first — <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> or WhatsApp. Almost
              everything is settled in a message or two. Where it cannot be, these terms are governed by Indian law
              and the courts of Bengaluru, Karnataka.
            </p>
            <p>
              Nothing here takes away rights you have under the Consumer Protection Act, 2019.
            </p>
          </div>

          <div className="contact-card">
            <h4>Getting in touch</h4>
            <p>
              {SITE.legalName}
              <br />
              {SITE.registeredAddress}
              {SITE.gstin && (<><br />GSTIN {SITE.gstin}</>)}
              <br />
              <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
              <br />
              <a href={`https://wa.me/${SITE.whatsappNumber}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
