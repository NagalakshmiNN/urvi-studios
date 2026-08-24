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
              <Image src="/brand/logo-mark.png" alt="Urvi Studios" width={44} height={35} className="brand-mark" />
              URVI<span className="brand-sub">Studios</span>
            </Link>
            <p>Premium festive, office and everyday wear with an Indian heart and a western edit. Founded by Nagalakshmi &amp; Shilpa.</p>
            <div className="social-row">
              <a href={`https://instagram.com/${SITE.instagramHandle}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
              </a>
              <a href={`https://wa.me/${SITE.whatsappNumber}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2.1-5.5A8.5 8.5 0 1 1 21 11.5Z" /></svg>
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
