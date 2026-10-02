import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ContactForm from "./ContactForm";
import { SITE } from "@/lib/site-config";

export default function ContactPage() {
  return (
    <>
      <SiteHeader active="Contact" />
      <div className="page-hero container">
        <div className="eyebrow">We&apos;d love to hear from you</div>
        <h1>Get in Touch</h1>
      </div>

      <div className="container">
        <div className="contact-grid">
          <div>
            <div className="contact-card">
              <h4>WhatsApp</h4>
              <p>Sizing questions, custom requests, order updates — message us directly.</p>
              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <a href={`https://wa.me/${SITE.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">
                  Chat with Lakshmi
                </a>
                <a href={`https://wa.me/${SITE.whatsappNumberAlt}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">
                  Chat with Shilpa
                </a>
              </div>
            </div>
            <div className="contact-card">
              <h4>Email</h4>
              <p>{SITE.contactEmail}</p>
            </div>
            <div className="contact-card">
              <h4>Instagram</h4>
              <p>
                <a href={`https://www.instagram.com/${SITE.instagramHandle}`} target="_blank" rel="noopener noreferrer">
                  @{SITE.instagramHandle}
                </a>{" "}
                — follow for new drops, styling edits and behind-the-scenes.
              </p>
            </div>
            <div className="contact-card">
              <h4>Facebook</h4>
              <p>
                <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">
                  Urvi Studios on Facebook
                </a>{" "}
                — updates, lookbooks and community.
              </p>
            </div>
            <div className="contact-card">
              <h4>YouTube</h4>
              <p>
                <a href={SITE.youtubeUrl} target="_blank" rel="noopener noreferrer">
                  Urvi Studios on YouTube
                </a>{" "}
                — styling videos, hauls and behind-the-scenes.
              </p>
            </div>
          </div>
          <div className="contact-card" style={{ margin: 0 }}>
            <h4>Send us a note</h4>
            <ContactForm />
          </div>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
