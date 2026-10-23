import { test, expect } from "@playwright/test";
import { cspForPath } from "../../src/lib/csp";

test("only the reel maker page may run WebAssembly and play blob: video", () => {
  const reels = cspForPath("/admin/reels");
  expect(reels).toContain("'wasm-unsafe-eval'");
  expect(reels).toContain("media-src 'self' blob:");
});

test("every other page keeps the strict policy", () => {
  for (const p of ["/", "/shop", "/admin", "/admin/stock", "/admin/reelsx", "/checkout"]) {
    const csp = cspForPath(p);
    expect(csp, p).not.toContain("wasm-unsafe-eval");
    expect(csp, p).not.toContain("unsafe-eval");
    expect(csp, p).not.toContain("media-src");
  }
});
