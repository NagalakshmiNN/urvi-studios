import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Our Story — URVI Studios",
  description: "How Shilpa and Nagalakshmi started URVI Studios, told in their own words.",
};

// The illustrated strip, told in four panels, is now the whole story.
//
// The previous version of this page is kept intact at page.previous.tsx —
// five "Her Editions" cards, the founders' copy, the atelier section. It is
// not routed and not built, because Next only treats page.tsx as a route, so
// it costs nothing while it sits there. Restoring it is a rename.
//
// Layout: the strip runs the full height of the page on one half, the brand
// sits on the other. On a phone there are no halves, so the brand goes first
// and the strip follows at full width — a 1024×1536 illustration squeezed
// into half a phone screen would be unreadable, and every word in it matters.
export default function AboutPage() {
  return (
    <>
      <SiteHeader active="Our Story" />

      <section className="story-split">
        <div className="story-brand">
          <div className="story-brand-inner">
            <Image
              src="/brand/logo-full-black.jpg"
              alt="URVI Studios"
              width={420}
              height={420}
              className="story-logo"
              priority
            />
            <p className="story-tagline">आत्मविश्वासवस्त्रम्</p>
            <p className="story-sub">Confidence, worn.</p>
            <p className="story-line">Everyday · Office · Occasion</p>

            <p className="story-blurb">
              Two women, one shared eye for beautiful clothes — and a belief that getting dressed should feel
              effortless, expressive and entirely your own.
            </p>

            <Link href="/shop" className="btn btn-primary" style={{ marginTop: 22 }}>
              Shop the collection
            </Link>
          </div>
        </div>

        <div className="story-strip">
          {/* Unoptimised: this is a detailed illustration whose text has to stay
              legible, and Next's default recompression softens the lettering in
              the speech bubbles enough to matter. */}
          <Image
            src="/brand/our-story-strip.png"
            alt="An illustrated telling of how URVI Studios began: Shilpa and Nagalakshmi talking about how hard it is to find good traditional and office wear, deciding to curate pieces from their travels across India, and setting out to make beautiful, well-made clothing available at reasonable prices."
            width={1024}
            height={1536}
            className="story-strip-img"
            unoptimized
            priority
          />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
