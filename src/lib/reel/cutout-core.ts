// Cutting a dress out of its photo: the pixel arithmetic, with no canvas, no
// DOM and no model in it, so it runs the same in the browser and under test.
//
// The picture arrives with a rough guess from a general-purpose "what is the
// foreground" network (see cutout.ts). That guess finds the dress but happily
// keeps the hanger, a bookshelf behind the neckline and the odd shelf edge.
// This file tightens it using the one thing the network does not know: the
// dress is, for the most part, one colour.
//
//   1. take the dress's dominant hue from the middle of the guess
//   2. keep only pixels of that hue, close the gaps left by prints and
//      embroidery, fill small holes (but not the neck opening)
//   3. cut thin things that touch the dress (book spines, shelf edges) with a
//      large "opening", and grow the edge back a little
//   4. find a lime-green hanger and note where it crosses the dress, so it can
//      be painted out with real fabric texture rather than blurred
//
// If the dress is not one colour the colour step loses too much and is
// abandoned; the plain guess is used and the hanger is simply cut away.

export type Bin = Uint8Array<ArrayBuffer>; // one byte per pixel, 0 or 1

// ------------------------------------------------------------ morphology

function integral(m: Bin, w: number, h: number): Int32Array {
  const W = w + 1;
  const I = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    const o = (y + 1) * W;
    const p = y * W;
    for (let x = 0; x < w; x++) {
      row += m[y * w + x];
      I[o + x + 1] = I[p + x + 1] + row;
    }
  }
  return I;
}

/**
 * Dilate or erode with a square window of radius r. Outside the picture is
 * ignored (it neither grows nor shrinks the shape), matching how a dress that
 * runs off the bottom of the photo should behave.
 */
function windowOp(m: Bin, w: number, h: number, r: number, mode: "dilate" | "erode"): Bin {
  const I = integral(m, w, h);
  const W = w + 1;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const sum = I[(y1 + 1) * W + x1 + 1] - I[y0 * W + x1 + 1] - I[(y1 + 1) * W + x0] + I[y0 * W + x0];
      out[y * w + x] = mode === "dilate" ? (sum > 0 ? 1 : 0) : sum === (x1 - x0 + 1) * (y1 - y0 + 1) ? 1 : 0;
    }
  }
  return out;
}

export const dilate = (m: Bin, w: number, h: number, r: number) => windowOp(m, w, h, r, "dilate");
export const erode = (m: Bin, w: number, h: number, r: number) => windowOp(m, w, h, r, "erode");
export const opening = (m: Bin, w: number, h: number, r: number) => dilate(erode(m, w, h, r), w, h, r);
export const closing = (m: Bin, w: number, h: number, r: number) => erode(dilate(m, w, h, r), w, h, r);

// ----------------------------------------------------- connected regions

export type Region = { area: number; x0: number; y0: number; x1: number; y1: number };

/** Label connected regions of 1s. Label 0 is "not in any region"; regions are 1..n. */
export function label(m: Bin, w: number, h: number, conn: 4 | 8): { labels: Int32Array; regions: Region[] } {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const regions: Region[] = [{ area: 0, x0: 0, y0: 0, x1: 0, y1: 0 }];
  for (let start = 0; start < w * h; start++) {
    if (!m[start] || labels[start]) continue;
    const id = regions.length;
    const reg: Region = { area: 0, x0: w, y0: h, x1: 0, y1: 0 };
    let sp = 0;
    stack[sp++] = start;
    labels[start] = id;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p - x) / w;
      reg.area++;
      if (x < reg.x0) reg.x0 = x;
      if (x > reg.x1) reg.x1 = x;
      if (y < reg.y0) reg.y0 = y;
      if (y > reg.y1) reg.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (conn === 4 && dx && dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (m[q] && !labels[q]) {
            labels[q] = id;
            stack[sp++] = q;
          }
        }
      }
    }
    regions.push(reg);
  }
  return { labels, regions };
}

function largestRegion(m: Bin, w: number, h: number): Bin | null {
  const { labels, regions } = label(m, w, h, 8);
  if (regions.length < 2) return null;
  let best = 1;
  for (let i = 2; i < regions.length; i++) if (regions[i].area > regions[best].area) best = i;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = labels[i] === best ? 1 : 0;
  return out;
}

// ------------------------------------------------------------------ colour

/** OpenCV-style HSV: hue 0-179, saturation and value 0-255. */
export function toHsv(rgba: Uint8ClampedArray | Uint8Array, n: number): { h: Uint8Array; s: Uint8Array; v: Uint8Array } {
  const H = new Uint8Array(n);
  const S = new Uint8Array(n);
  const V = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    let hue = 0;
    if (d > 0) {
      if (mx === r) hue = (30 * (g - b)) / d;
      else if (mx === g) hue = 60 + (30 * (b - r)) / d;
      else hue = 120 + (30 * (r - g)) / d;
      if (hue < 0) hue += 180;
    }
    H[i] = Math.round(hue) % 180;
    S[i] = mx === 0 ? 0 : Math.round((255 * d) / mx);
    V[i] = mx;
  }
  return { h: H, s: S, v: V };
}

// ------------------------------------------------------------------ refine

export type Refined = {
  /** The dress, 1 inside. */
  final: Bin;
  /** Where a lime-green hanger crosses the dress (to be painted out). */
  hanger: Bin;
  /** Which route produced the mask, for the page to tell the user. */
  method: "colour" | "plain";
};

/**
 * Tighten the network's rough mask. `ai` is 0-1 foreground probability per
 * pixel at the same size as the picture.
 */
export function refineMask(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, ai: Float32Array): Refined {
  const n = w * h;
  const sc = Math.max(w, h) / 2000;
  const rad = (px: number) => Math.max(1, Math.round((px * sc) / 2));

  const m0 = new Uint8Array(n);
  let m0count = 0;
  for (let i = 0; i < n; i++) {
    if (ai[i] > 0.5) {
      m0[i] = 1;
      m0count++;
    }
  }
  const { h: H, s: S, v: V } = toHsv(rgba, n);

  let final: Bin | null = null;
  const core = erode(m0, w, h, rad(51));
  const hist = new Float64Array(180);
  let okCount = 0;
  for (let i = 0; i < n; i++) {
    if (core[i] && S[i] > 60 && V[i] > 50) {
      hist[H[i]]++;
      okCount++;
    }
  }

  if (okCount > 0.02 * n) {
    // dominant hue: smoothed circular histogram peak
    let h0 = 0;
    let best = -1;
    for (let k = 0; k < 180; k++) {
      let acc = 0;
      for (let d = -4; d <= 4; d++) acc += hist[(k + d + 180) % 180];
      if (acc > best) {
        best = acc;
        h0 = k;
      }
    }
    const hueDist = (hh: number) => {
      const d = Math.abs(hh - h0);
      return Math.min(d, 180 - d);
    };
    // median saturation of the dress's own pixels
    const sHist = new Uint32Array(256);
    let sCount = 0;
    for (let i = 0; i < n; i++) {
      if (core[i] && S[i] > 60 && V[i] > 50 && hueDist(H[i]) <= 10) {
        sHist[S[i]]++;
        sCount++;
      }
    }
    let acc = 0;
    let median = 0;
    for (let k = 0; k < 256; k++) {
      acc += sHist[k];
      if (acc >= sCount / 2) {
        median = k;
        break;
      }
    }
    const smin = 0.5 * median;

    const near = dilate(m0, w, h, rad(31));
    let col = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (near[i] && hueDist(H[i]) <= 12 && S[i] > smin && V[i] > 40) col[i] = 1;
    }
    col = closing(col, w, h, rad(25));

    // Small holes (prints, embroidery, a label) are part of the dress; big
    // ones (the neck opening) and anything touching the edge are not.
    const inv = new Uint8Array(n);
    for (let i = 0; i < n; i++) inv[i] = col[i] ? 0 : 1;
    const { labels, regions } = label(inv, w, h, 4);
    const fill = new Uint8Array(regions.length);
    for (let i = 1; i < regions.length; i++) {
      const r = regions[i];
      const touches = r.x0 === 0 || r.y0 === 0 || r.x1 >= w - 1 || r.y1 >= h - 1;
      fill[i] = !touches && r.area < 0.004 * n ? 1 : 0;
    }
    for (let i = 0; i < n; i++) if (labels[i] && fill[labels[i]]) col[i] = 1;

    // A large opening removes thin clutter touching the dress; grow back a bit.
    const opened = opening(col, w, h, rad(61));
    const grown = dilate(opened, w, h, rad(15));
    for (let i = 0; i < n; i++) col[i] = grown[i] && col[i] ? 1 : 0;

    const biggest = largestRegion(col, w, h);
    if (biggest) {
      let c = 0;
      for (let i = 0; i < n; i++) c += biggest[i];
      if (c >= 0.5 * m0count) final = biggest;
    }
  }

  // A lime-green hanger, wherever it is.
  let green: Bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (H[i] > 35 && H[i] < 80 && S[i] > 110 && V[i] > 130) green[i] = 1;
  }
  green = dilate(green, w, h, rad(9));

  let method: Refined["method"] = "colour";
  if (!final) {
    method = "plain";
    final = new Uint8Array(n);
    for (let i = 0; i < n; i++) final[i] = m0[i] && !green[i] ? 1 : 0;
  }

  const near = dilate(final, w, h, rad(9));
  const hanger = new Uint8Array(n);
  for (let i = 0; i < n; i++) hanger[i] = green[i] && near[i] ? 1 : 0;

  return { final, hanger, method };
}

// ------------------------------------------------------------ fabric fill

/**
 * Replace the pixels in `region` with real fabric: copy from just above or
 * below (which keeps the weave and stitching), and only where that is not
 * possible, spread the nearest known colour in. `valid` marks pixels that are
 * safe to copy from. Works in place on `rgba`.
 */
export function fillFromFabric(
  rgba: Uint8ClampedArray, w: number, h: number, region: Bin, valid: Bin, sc: number,
): void {
  const n = w * h;
  const remaining = new Uint8Array(region);
  const copy = new Uint8ClampedArray(rgba);
  for (const base of [56, 80, -56, -80, 110, -110]) {
    const dy = Math.round(base * sc);
    for (let y = 0; y < h; y++) {
      const sy = y + dy;
      if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!remaining[i]) continue;
        const j = sy * w + x;
        if (valid[j] && !region[j]) {
          rgba[i * 4] = copy[j * 4];
          rgba[i * 4 + 1] = copy[j * 4 + 1];
          rgba[i * 4 + 2] = copy[j * 4 + 2];
          remaining[i] = 0;
        }
      }
    }
  }
  // Leftovers: spread known colour inwards a few passes.
  for (let pass = 0; pass < 24; pass++) {
    let any = false;
    const done: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!remaining[i]) continue;
      const x = i % w;
      const y = (i - x) / w;
      let r = 0, g = 0, b = 0, c = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!remaining[q]) {
          r += rgba[q * 4]; g += rgba[q * 4 + 1]; b += rgba[q * 4 + 2]; c++;
        }
      }
      if (c) {
        rgba[i * 4] = r / c; rgba[i * 4 + 1] = g / c; rgba[i * 4 + 2] = b / c;
        done.push(i);
      } else {
        any = true;
      }
    }
    for (const i of done) remaining[i] = 0;
    if (!any && done.length === 0) break;
  }
}

// ----------------------------------------------------------------- compose

/** Manual touch-ups, painted by hand. 0 = leave, 1 = remove, 2 = keep, 3 = rebuild from fabric. */
export const MANUAL_NONE = 0;
export const MANUAL_REMOVE = 1;
export const MANUAL_KEEP = 2;
export const MANUAL_FILL = 3;

/** Paint a filled disc of `value` into a touch-up layer (the brush). */
export function stampDisc(layer: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, value: number): void {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) layer[y * w + x] = value;
    }
  }
}

/** Paint a round-capped line of `value` from (x0,y0) to (x1,y1). */
export function stampLine(
  layer: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, r: number, value: number,
): void {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, r / 2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stampDisc(layer, w, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, value);
  }
}

export type Composed = {
  /** RGBA, the dress on the chosen colour. */
  pixels: Uint8ClampedArray;
  /** Where the dress is, in pixels. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array<ArrayBuffer> {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(Math.max(x, 0), w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / win;
      acc += src[y * w + Math.min(x + r + 1, w - 1)] - src[y * w + Math.max(x - r, 0)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(Math.max(y, 0), h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      acc += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x];
    }
  }
  return out;
}

/**
 * Put the dress on a plain colour. Takes the refined mask, the hand-painted
 * touch-ups (may be null), and returns finished pixels. The original `rgba`
 * is not modified.
 */
export function composeCutout(
  rgba: Uint8ClampedArray, w: number, h: number, refined: Refined, manual: Uint8Array | null,
  /** Colour to set the dress on, or null to keep the background see-through (alpha). */
  bg: [number, number, number] | null,
): Composed {
  const n = w * h;
  const sc = Math.max(w, h) / 2000;
  const final = new Uint8Array(refined.final);
  const region = new Uint8Array(refined.hanger);
  if (manual) {
    for (let i = 0; i < n; i++) {
      const m = manual[i];
      if (m === MANUAL_REMOVE) final[i] = 0;
      else if (m === MANUAL_KEEP) final[i] = 1;
      else if (m === MANUAL_FILL) {
        final[i] = 1;
        region[i] = 1;
      }
    }
  }

  const pixels = new Uint8ClampedArray(rgba);
  let anyRegion = false;
  for (let i = 0; i < n; i++) if (region[i]) { anyRegion = true; break; }
  if (anyRegion) {
    const valid = new Uint8Array(n);
    for (let i = 0; i < n; i++) valid[i] = final[i] && !region[i] ? 1 : 0;
    fillFromFabric(pixels, w, h, region, valid, sc);
  }

  // Edge: shave a pixel of the old background's fringe, then soften.
  const shaved = erode(final, w, h, 1);
  let alpha: Float32Array<ArrayBuffer> = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = shaved[i];
  const r = Math.max(1, Math.round(1.5 * sc));
  alpha = boxBlur(boxBlur(alpha, w, h, r), w, h, r);

  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = alpha[i];
      const o = i * 4;
      if (bg) {
        pixels[o] = pixels[o] * a + bg[0] * (1 - a);
        pixels[o + 1] = pixels[o + 1] * a + bg[1] * (1 - a);
        pixels[o + 2] = pixels[o + 2] * a + bg[2] * (1 - a);
        pixels[o + 3] = 255;
      } else {
        pixels[o + 3] = Math.round(a * 255);
      }
      if (final[i]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) {
    x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1;
  }
  return { pixels, bbox: { x0, y0, x1, y1 } };
}
