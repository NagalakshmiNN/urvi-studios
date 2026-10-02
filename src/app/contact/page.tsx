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
              <h4 className="social-heading">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
                Instagram
              </h4>
              <p>Follow for new drops, styling edits and behind-the-scenes.</p>
              <a href={`https://www.instagram.com/${SITE.instagramHandle}`} target="_blank" rel="noopener noreferrer" className="social-link">
                @{SITE.instagramHandle}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7" /><path d="M7 7h10v10" /></svg>
              </a>
            </div>
            <div className="contact-card">
              <h4 className="social-heading">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" /></svg>
                Facebook
              </h4>
              <p>Updates, lookbooks and community.</p>
              <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer" className="social-link">
                Urvi Studios on Facebook
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7" /><path d="M7 7h10v10" /></svg>
              </a>
            </div>
            <div className="contact-card">
              <h4 className="social-heading">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-2C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 2C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58Z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" /></svg>
                YouTube
              </h4>
              <p>Styling videos, hauls and behind-the-scenes.</p>
              <a href={SITE.youtubeUrl} target="_blank" rel="noopener noreferrer" className="social-link">
                Urvi Studios on YouTube
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7" /><path d="M7 7h10v10" /></svg>
              </a>
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
