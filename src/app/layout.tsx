import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Urvi Studios — Confidence, Worn",
    template: "%s — Urvi Studios",
  },
  description:
    "Urvi Studios — premium Indian-western fusion fashion. Festive wear, office wear, casual wear, kurtas and more, curated by Nagalakshmi & Shilpa.",
  icons: { icon: "/logo-black.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,340..600;1,9..144,400..560&family=Montserrat:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
