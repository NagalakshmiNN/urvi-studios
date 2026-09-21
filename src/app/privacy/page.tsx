import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { SITE } from "@/lib/site-config";

export const metadata = {
  title: "Privacy Policy — URVI Studios",
  description: "What URVI Studios collects, why, who it is shared with, and how to have it removed.",
};

// One of the two pages a payment gateway will not activate an account without,
// and one of the two this site did not have. Written to describe what the shop
// actually does rather than to sound like a policy: the site collects a name,
// an address and a phone number because a parcel cannot be delivered without
// them, and says so.
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <div className="page-hero container">
        <div className="eyebrow">Good to know</div>
        <h1>Privacy Policy</h1>
      </div>

      <section className="section" style={{ paddingTop: 10 }}>
        <div className="container" style={{ maxWidth: 760, margin: "0 auto" }}>
          <p style={{ color: "var(--sage)", fontSize: 13.5, marginBottom: 22 }}>
            Last updated {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}. This policy
            covers {SITE.siteUrl.replace("https://", "")}, run by {SITE.legalName}, {SITE.registeredAddress}.
          </p>

          <div className="contact-card">
            <h4>What we collect, and why</h4>
            <p>
              We ask for as little as an order needs. When you buy something we collect your name, email address,
              phone number and delivery address — a parcel cannot reach you without them, and we need a way to tell
              you where it is. If you create an account, we keep those details so you do not have to type them again.
            </p>
            <p>
              We also keep a record of what you ordered and what you paid, because that is what an order <em>is</em>,
              and because we are required to keep sales records.
            </p>
          </div>

          <div className="contact-card">
            <h4>What we never see</h4>
            <p>
              <strong>Your card and UPI details never reach us.</strong> Payments are handled entirely by Razorpay,
              a payment provider regulated by the Reserve Bank of India. Your card number, CVV, UPI PIN and bank
              credentials are entered on their systems, not ours. We are told only whether a payment succeeded and a
              reference number for it.
            </p>
          </div>

          <div className="contact-card">
            <h4>Who else sees your details</h4>
            <p>Only the people who have to, and only the part they need:</p>
            <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
              <li><strong>Razorpay</strong> — to take the payment.</li>
              <li><strong>Our delivery partners</strong> — your name, address and phone number, so the parcel arrives.</li>
              <li><strong>Our email provider</strong> — to send your order confirmation and updates.</li>
            </ul>
            <p>
              We do not sell your details. We do not share them for anyone else&apos;s advertising. We do not pass
              them to anyone who is not directly helping to get your order to you.
            </p>
          </div>

          <div className="contact-card">
            <h4>Cookies</h4>
            <p>
              We use cookies for the things a shop cannot work without: keeping your bag between pages, and keeping
              you signed in. We do not use them to follow you around other websites.
            </p>
          </div>

          <div className="contact-card">
            <h4>How long we keep it</h4>
            <p>
              Order records are kept for as long as tax and accounting rules require. Account details are kept until
              you ask us to remove them. If you close your account, we delete what we are not legally obliged to keep.
            </p>
          </div>

          <div className="contact-card">
            <h4>Your choices</h4>
            <p>
              You can ask us what we hold about you, ask us to correct it, or ask us to delete it. Write to{" "}
              <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> or message us on WhatsApp and we will
              answer — we are two people, so it will be one of us replying, not a form.
            </p>
            <p>
              Where we have to keep something — a record of a sale, for instance — we will tell you what and why
              rather than simply refusing.
            </p>
          </div>

          <div className="contact-card">
            <h4>Keeping it safe</h4>
            <p>
              The site runs over an encrypted connection, and the admin side of it is behind a password only the two
              of us hold. No system is perfect; if anything ever went wrong in a way that affected your details, we
              would tell you rather than hope you did not notice.
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
              <a href={`https://wa.me/${SITE.whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
