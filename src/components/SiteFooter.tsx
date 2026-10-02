import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site-config";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand">
              <Image src="/brand/logo-mark.png" alt="Urvi Studios" width={46} height={40} className="brand-mark" />
              URVI<span className="brand-sub">Studios</span>
            </Link>
            <p>Premium festive, office and everyday wear with an Indian heart and a western edit. Founded by Shilpa &amp; Nagalakshmi.</p>
            <div className="social-row">
              <a href={`https://instagram.com/${SITE.instagramHandle}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
              </a>
              <a href={`https://wa.me/${SITE.whatsappNumber}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2.1-5.5A8.5 8.5 0 1 1 21 11.5Z" /></svg>
              </a>
              <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" /></svg>
              </a>
              <a href={SITE.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-2C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 2C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58Z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" /></svg>
              </a>
            </div>
          </div>
          <div className="footer-col">
            <h5>Shop</h5>
            <Link href="/shop?cat=Everyday">Everyday</Link>
            <Link href="/shop?cat=Office">Office</Link>
            <Link href="/shop?cat=Occasion">Occasion</Link>
            <Link href="/shop">Shop All</Link>
          </div>
          <div className="footer-col">
            <h5>About</h5>
            <Link href="/about">Our Story</Link>
            <Link href="/contact">Contact Us</Link>
            <Link href="/shipping-returns">Shipping &amp; Returns</Link>
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </div>
          <div className="footer-col">
            <h5>Legal</h5>
            <Link href="/terms">Terms &amp; Conditions</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/shipping-returns#cancellations">Cancellations &amp; Refunds</Link>
          </div>
          <div className="footer-col">
            <h5>Account</h5>
            <Link href="/account">My Account</Link>
            <Link href="/account/orders">Track Order</Link>
            <Link href="/account/wishlist">Wishlist</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Urvi Studios. All rights reserved.</span>
          <span className="devanagari">आत्मविश्वासवस्त्रम् · Confidence, worn.</span>
        </div>
      </div>
    </footer>
  );
}
