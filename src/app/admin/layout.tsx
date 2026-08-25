import type { Metadata, Viewport } from "next";

// Makes everything under /admin installable as a home-screen app (a PWA) —
// so Nagalakshmi and Shilpa can open live stock/orders/messages from an
// icon on their phone instead of a browser tab. Wraps both the login page
// and the (dashboard) group so the install prompt is available no matter
// which /admin page is open. No native app, no app store — this is just
// the browser recognising admin.webmanifest and offering "Add to Home
// Screen" / "Install app".
export const metadata: Metadata = {
  manifest: "/admin.webmanifest",
  icons: {
    icon: [
      { url: "/icons/admin-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/admin-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/admin-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "URVI Admin",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#3F4827",
};

export default function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
