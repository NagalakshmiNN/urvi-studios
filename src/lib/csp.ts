// The Content-Security-Policy, built per request in src/proxy.ts.
//
// It used to be set from next.config.ts with a "every path except
// /admin/reels" pattern. That pattern is not honoured everywhere the site is
// hosted, so the strict rule also landed on the reel maker and blocked its
// WebAssembly cutout engine. Choosing the policy in code, by the request's own
// path, leaves nothing to a hosting platform's pattern matching.

// Google Analytics (the gtag.js snippet in the root layout) needs its script,
// its beacon image and its reporting endpoints, and nothing broader.
const GA_SCRIPT = "https://www.googletagmanager.com";
const GA_IMG = "https://www.google-analytics.com https://www.googletagmanager.com";
const GA_CONNECT = "https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com";

export const cspFor = (reels: boolean) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${reels ? " 'wasm-unsafe-eval'" : ""} https://checkout.razorpay.com https://*.razorpay.com ${GA_SCRIPT}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: https://*.razorpay.com https://rzp-1415-prod-dashboard-activation.s3.amazonaws.com ${GA_IMG}`,
  `connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://lumberjack.razorpay.com ${GA_CONNECT}`,
  "frame-src https://api.razorpay.com https://*.razorpay.com",
  ...(reels ? ["media-src 'self' blob:"] : []),
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/**
 * A browser keeps the security policy of the first page it loaded. Moving
 * between admin pages with the menu swaps the content without reloading, so
 * the reel maker would inherit the policy of whatever admin page came first.
 * 'wasm-unsafe-eval' only lets WebAssembly be compiled (it does not allow
 * eval of text as script), and admin pages are behind the login, so every
 * admin page gets the reel maker's allowances. The public site stays strict.
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function cspForPath(pathname: string): string {
  return cspFor(isAdminPath(pathname));
}
