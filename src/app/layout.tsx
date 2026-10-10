import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import BetaBanner from "@/components/BetaBanner";
import { getBoolSetting } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: {
    default: "Urvi Studios — Confidence, Worn",
    template: "%s — Urvi Studios",
  },
  description:
    "Urvi Studios — premium Indian-western fusion fashion. Festive wear, office wear, casual wear, kurtas and more, curated by Shilpa & Nagalakshmi.",
  icons: { icon: "/logo-black.png" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const showBeta = await getBoolSetting("beta_banner_enabled");
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Allura&family=Alex+Brush&family=Montserrat:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;600&display=swap"
          rel="stylesheet"
        />
        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-7EMXG27NVQ"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-7EMXG27NVQ');
          `}
        </Script>
      </head>
      <body>
        {children}
        {showBeta && <BetaBanner />}
      </body>
    </html>
  );
}
