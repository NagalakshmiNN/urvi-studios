// The Content-Security-Policy, built per request in src/proxy.ts.
//
// It used to be set from next.config.ts with a "every path except
// /admin/reels" pattern. That pattern is not honoured everywhere the site is
// hosted, so the strict rule also landed on the reel maker and blocked its
// WebAssembly cutout engine. Choosing the policy in code, by the request's own
// path, leaves nothing to a hosting platform's pattern matching.

export const cspFor = (reels: boolean) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${reels ? " 'wasm-unsafe-eval'" : ""} https://checkout.razorpay.com https://*.razorpay.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.razorpay.com https://rzp-1415-prod-dashboard-activation.s3.amazonaws.com",
  "connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://lumberjack.razorpay.com",
  "frame-src https://api.razorpay.com https://*.razorpay.com",
  ...(reels ? ["media-src 'self' blob:"] : []),
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/** The reel maker runs a neural network (WebAssembly) and plays back a blob: video. */
export const REELS_PATH = "/admin/reels";

export function cspForPath(pathname: string): string {
  return cspFor(pathname === REELS_PATH || pathname.startsWith(REELS_PATH + "/"));
}
