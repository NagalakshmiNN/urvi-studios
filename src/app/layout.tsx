import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import BetaBanner from "@/components/BetaBanner";
import ErrorTracker from "@/components/ErrorTracker";
import { getBoolSetting } from "@/lib/site-settings";
import MascotWalker from "@/components/MascotWalker";
import { getMascotSettings, getMascotMessages } from "@/app/actions/mascot";

export const metadata: Metadata = {
  title: {
    default: "Urvi Studios — Confidence, Worn",
    template: "%s — Urvi Studios",
  },
  description:
    "Urvi Studios — premium Indian-western fusion fashion. Festive wear, office wear, casual wear, kurtas and more, curated by Shilpa & RamaVijaya.",
  icons: { icon: "/logo-black.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let showBeta = false;
  try {
    showBeta = await getBoolSetting("beta_banner_enabled");
  } catch {
    // Settings table may not be accessible — disable beta banner gracefully
  }
  let mascotData = { enabled: false, imageA: '/mascots/mascot-ivory.png', imageB: '/mascots/mascot-mustard.png' };
  let mascotMsgs: { id: string; message: string; animation: string }[] = [];
  try {
    mascotData = await getMascotSettings();
    mascotMsgs = mascotData.enabled ? await getMascotMessages() : [];
  } catch {
    // Mascot tables may not exist yet (migration pending) — gracefully disable
    mascotData = { enabled: false, imageA: '', imageB: '' };
  }
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
        <ErrorTracker />
        {children}
        {showBeta && <BetaBanner />}
        {mascotData.enabled && (
          <MascotWalker
            imageA={mascotData.imageA}
            imageB={mascotData.imageB}
            messages={mascotMsgs.map((m) => ({ id: m.id, message: m.message, animation: m.animation }))}
          />
        )}
      </body>
    </html>
  );
}
