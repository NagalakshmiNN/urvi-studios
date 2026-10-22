// Styled "studio set" backdrops, painted from code: a dark floral surface, draped
// satin, a painted heritage wall, marble, velvet and a sunlit linen table. Each
// is built once as a still (texture + props), then lit with slow moving light.
// Nothing here is a photograph, so nothing is licensed and nothing is uploaded.

import type { Ctx } from "./backdrops";
import { HERITAGE, drawHeritage, isHeritage } from "./heritage";

export type SceneBase = "midnight-floral" | "draped-rose" | "heritage-wall" | "marble-gold" | "emerald-velvet" | "sunlit-linen" | "marigold-garland" | "jaali-light";
/** "<base>:<palette index>" */
export type SceneId = string;

export type Pal = {
  name: string;
  dark: number[]; light: number[];
  f1: [string, string]; f2: [string, string]; f3: [string, string];
  accent: number[]; glow: string;
};
const rgbs = (c: number[]) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export const PALETTES: Pal[] = [
  { name: "Plum Night", dark: [34, 24, 44], light: [92, 66, 104], f1: ["#e8b0c8", "#b25d86"], f2: ["#fff4f8", "#e7cddb"], f3: ["#c0306a", "#6a123a"], accent: [214, 170, 92], glow: "#ffd6e6" },
  { name: "Rosewood", dark: [66, 24, 34], light: [160, 78, 86], f1: ["#f2c0a8", "#c8745c"], f2: ["#fff6ee", "#ecd2c0"], f3: ["#e6573a", "#8a1c14"], accent: [226, 178, 96], glow: "#ffd2b0" },
  { name: "Peacock Teal", dark: [8, 42, 48], light: [30, 118, 116], f1: ["#f4d28a", "#c98f3a"], f2: ["#fffaf0", "#e8dcc0"], f3: ["#f0a030", "#a45a10"], accent: [226, 182, 90], glow: "#ffe0a0" },
  { name: "Saffron Dusk", dark: [92, 40, 16], light: [226, 138, 56], f1: ["#ffe2a8", "#e09a30"], f2: ["#fffbe8", "#f1e0b0"], f3: ["#d8381c", "#781408"], accent: [255, 214, 120], glow: "#fff0b8" },
  { name: "Ivory Pearl", dark: [214, 204, 190], light: [247, 242, 233], f1: ["#f2c4cc", "#d68a98"], f2: ["#ffffff", "#ece4da"], f3: ["#e08a8a", "#a84a52"], accent: [196, 154, 80], glow: "#fffaf0" },
  { name: "Sage Garden", dark: [34, 56, 44], light: [138, 168, 132], f1: ["#f6d8c8", "#d89c84"], f2: ["#fffdf6", "#e9e6d0"], f3: ["#e87a62", "#9c3a2a"], accent: [214, 176, 98], glow: "#f4ffe0" },
  { name: "Midnight Blue", dark: [10, 18, 44], light: [44, 70, 128], f1: ["#d8e0f8", "#8a9ad0"], f2: ["#ffffff", "#dde4f4"], f3: ["#e8c060", "#a07018"], accent: [226, 190, 110], glow: "#d8e6ff" },
  { name: "Blush Pastel", dark: [238, 212, 212], light: [253, 240, 236], f1: ["#f6c8d0", "#e098a8"], f2: ["#ffffff", "#f0e4e0"], f3: ["#ec8a98", "#b8505e"], accent: [214, 170, 110], glow: "#fffaf6" },
  { name: "Mint Pastel", dark: [206, 228, 214], light: [242, 251, 244], f1: ["#f8d6d0", "#e0a098"], f2: ["#ffffff", "#e8f0e4"], f3: ["#f0907a", "#b85a48"], accent: [206, 176, 110], glow: "#ffffff" },
  { name: "Powder Blue", dark: [204, 218, 238], light: [240, 246, 253], f1: ["#f8dce0", "#e0a8b8"], f2: ["#ffffff", "#e4eaf4"], f3: ["#e8a8b8", "#b06880"], accent: [206, 176, 120], glow: "#ffffff" },
  { name: "Butter Cream", dark: [240, 228, 192], light: [253, 249, 228], f1: ["#f8d8c0", "#e0a888"], f2: ["#ffffff", "#f0e8d4"], f3: ["#f0a070", "#b86038"], accent: [214, 172, 96], glow: "#fffdf0" },
  { name: "Wine Gold", dark: [48, 10, 22], light: [128, 30, 50], f1: ["#f6cf94", "#cf9440"], f2: ["#fff4e0", "#ecd6b0"], f3: ["#f0b838", "#9c6a10"], accent: [232, 190, 100], glow: "#ffe2b0" },
];

type Canvas = HTMLCanvasElement | OffscreenCanvas;
const TAU = Math.PI * 2;

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
const ctxOf = (c: Canvas) => c.getContext("2d") as Ctx;

// ---------------------------------------------------------------- noise

function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, seed: number, oct = 5): number {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, seed + i * 17);
    f *= 2;
    a *= 0.5;
  }
  return s; // roughly 0..1
}
const mixc = (a: number[], b: number[], t: number): number[] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fill a canvas pixel by pixel from a colour function of (u, v) in 0..1. */
function paintField(w: number, h: number, fn: (u: number, v: number, x: number, y: number) => number[]): Canvas {
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x / w, y / h, x, y);
      const o = (y * w + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function blurred(ctx: Ctx, px: number, draw: () => void) {
  ctx.save();
  if (px > 0 && "filter" in ctx) (ctx as CanvasRenderingContext2D).filter = `blur(${px}px)`;
  draw();
  ctx.restore();
}

// --------------------------------------------------------------- props

function leaf(ctx: Ctx, x: number, y: number, len: number, wid: number, rot: number, c1: string, c2: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createLinearGradient(0, 0, 0, -len);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, -len * 0.3, wid * 0.8, -len * 0.75, 0, -len);
  ctx.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.3, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1, len * 0.012);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -len * 0.92);
  ctx.stroke();
  ctx.restore();
}

function bloom(ctx: Ctx, x: number, y: number, r: number, rot: number, rings: number, inner: string, outer: string, edge?: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let k = rings; k >= 1; k--) {
    const n = 5 + k;
    const rr = r * (0.35 + 0.65 * (k / rings));
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate((i * TAU) / n + k * 0.6);
      const g = ctx.createRadialGradient(0, -rr * 0.5, 0, 0, -rr * 0.5, rr * 0.7);
      g.addColorStop(0, inner);
      g.addColorStop(1, outer);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -rr * 0.55, rr * 0.36, rr * 0.55, 0, 0, TAU);
      ctx.fill();
      if (edge) {
        ctx.strokeStyle = edge;
        ctx.lineWidth = Math.max(1, r * 0.02);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.fillStyle = "rgba(255,225,150,0.75)";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.07, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function vignette(ctx: Ctx, w: number, h: number, strength: number, rgb = "0,0,0") {
  const g = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.25, w / 2, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(1, `rgba(${rgb},${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------- the stills

type Still = { canvas: Canvas };

function buildMidnightFloral(w: number, h: number, p: Pal): Still {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const base = paintField(tw, th, (u, v) => {
    const n = fbm(u * 5, v * 8, 3);
    const grain = fbm(u * 40, v * 60, 9, 2);
    const t = clamp01(n * 1.15 + (grain - 0.5) * 0.18);
    return mixc(p.dark, p.light, t);
  });
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(base, 0, 0, w, h);
  const rand = rng(11);
  // scattered dried-blossom print, denser toward the edges
  for (let i = 0; i < 70; i++) {
    const x = rand() * w, y = rand() * h;
    const edge = Math.max(Math.abs(x / w - 0.5), Math.abs(y / h - 0.5)) * 2;
    if (rand() > 0.25 + edge * 0.9) continue;
    const r = w * (0.022 + rand() * 0.035);
    blurred(ctx, 1.4, () => {
      ctx.globalAlpha = 0.28 + rand() * 0.22;
      bloom(ctx, x, y, r, rand() * TAU, 2, p.f1[0], p.f1[1]);
    });
  }
  ctx.globalAlpha = 1;
  // corner bouquets, softly out of focus
  const bouquet = (cx: number, cy: number, flip: number) => {
    blurred(ctx, 2.2, () => {
      for (let i = 0; i < 6; i++) leaf(ctx, cx + flip * rand() * w * 0.12, cy + rand() * h * 0.05, w * (0.18 + rand() * 0.1), w * 0.07, -1.9 * flip + rand() * 0.9 - 0.45 + (flip > 0 ? 0 : 3.1), "#173d27", "#3f8a4f");
      bloom(ctx, cx, cy, w * 0.14, 0.3, 4, p.f3[0], p.f3[1], "rgba(40,0,0,0.3)");
      bloom(ctx, cx + flip * w * 0.14, cy + h * 0.045, w * 0.12, 1.1, 4, p.f2[0], p.f2[1], "rgba(120,90,70,0.25)");
      bloom(ctx, cx + flip * w * 0.02, cy + h * 0.09, w * 0.1, 2.0, 4, p.f2[0], p.f2[1], "rgba(120,90,70,0.25)");
      bloom(ctx, cx + flip * w * 0.2, cy - h * 0.02, w * 0.085, 0.7, 3, p.f1[0], p.f1[1]);
    });
  };
  bouquet(w * 0.04, h * 0.045, 1);
  bouquet(w * 0.97, h * 0.97, -1);
  vignette(ctx, w, h, 0.55);
  return { canvas: c };
}

function buildDrapedRose(w: number, h: number, p: Pal): Still {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const cloth = paintField(tw, th, (u, v) => {
    // diagonal folds, warped so they ripple
    const warp = fbm(u * 3, v * 4, 21) * 2.2;
    const phase = (u * 0.8 + v * 0.45) * 17 + warp * 4;
    const folds = 0.5 + 0.5 * Math.sin(phase);
    const slow = fbm(u * 2, v * 2.4, 5);
    const shade = clamp01(folds * 0.7 + slow * 0.5 - 0.15);
    const spec = Math.pow(clamp01(folds), 9) * 0.5;
    const col = mixc(p.dark, p.light, shade);
    return [Math.min(255, col[0] + spec * 90), Math.min(255, col[1] + spec * 80), Math.min(255, col[2] + spec * 80)];
  });
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cloth, 0, 0, w, h);
  // the set is lit from the lower middle; the top falls into darkness
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(14,8,12,0.95)");
  g.addColorStop(0.22, "rgba(14,8,12,0.55)");
  g.addColorStop(0.5, "rgba(14,8,12,0)");
  g.addColorStop(1, "rgba(14,8,12,0.25)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  vignette(ctx, w, h, 0.4, "20,8,14");
  return { canvas: c };
}

function buildHeritageWall(w: number, h: number, p: Pal): Still {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const wall = paintField(tw, th, (u, v) => {
    const n = fbm(u * 4, v * 6, 31);
    const fine = fbm(u * 60, v * 90, 33, 3);
    const stain = fbm(u * 2, v * 3, 35);
    const t = clamp01(n * 1.1 + (fine - 0.5) * 0.25 - stain * 0.2);
    return mixc(mixc(p.dark, [150, 150, 126], 0.7), mixc(p.light, [190, 184, 156], 0.7), t);
  });
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(wall, 0, 0, w, h);
  const rand = rng(41);
  const wob = (v: number) => v + (rand() - 0.5) * w * 0.006;
  // painted temple architecture, in terracotta and ink, along the lower left
  const ink = "rgba(92,48,32,0.85)";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const stroke = (pts: number[][], width: number, close = false) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(wob(x), wob(y)) : ctx.moveTo(wob(x), wob(y))));
    if (close) ctx.closePath();
    ctx.lineWidth = width;
    ctx.strokeStyle = ink;
    ctx.stroke();
  };
  const wash = (x: number, y: number, ww: number, hh: number) => {
    const g = ctx.createLinearGradient(x, y, x, y + hh);
    g.addColorStop(0, "rgba(196,112,70,0.78)");
    g.addColorStop(1, "rgba(150,76,46,0.82)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, ww, hh);
  };
  blurred(ctx, 0.8, () => {
    // tower
    wash(-w * 0.02, h * 0.56, w * 0.34, h * 0.45);
    stroke([[0, h * 0.56], [w * 0.32, h * 0.56]], w * 0.01);
    for (let i = 0; i < 6; i++) stroke([[0, h * (0.6 + i * 0.07)], [w * 0.32, h * (0.6 + i * 0.07)]], w * 0.006);
    wash(w * 0.02, h * 0.5, w * 0.26, h * 0.06);
    stroke([[w * 0.02, h * 0.5], [w * 0.28, h * 0.5]], w * 0.008);
    // dome and finial
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.5);
    ctx.bezierCurveTo(w * 0.06, h * 0.4, w * 0.24, h * 0.4, w * 0.24, h * 0.5);
    ctx.closePath();
    ctx.fillStyle = "rgba(176,92,56,0.85)";
    ctx.fill();
    ctx.lineWidth = w * 0.008;
    ctx.strokeStyle = ink;
    ctx.stroke();
    stroke([[w * 0.15, h * 0.425], [w * 0.15, h * 0.395]], w * 0.007);
    // lower arcade
    for (let i = 0; i < 3; i++) {
      const ax = w * (0.04 + i * 0.1);
      ctx.beginPath();
      ctx.moveTo(ax, h * 0.92);
      ctx.lineTo(ax, h * 0.84);
      ctx.arc(ax + w * 0.04, h * 0.84, w * 0.04, Math.PI, 0);
      ctx.lineTo(ax + w * 0.08, h * 0.92);
      ctx.fillStyle = "rgba(112,56,36,0.8)";
      ctx.fill();
      ctx.stroke();
    }
    // a second, fainter building on the right edge
    ctx.globalAlpha = 0.5;
    wash(w * 0.9, h * 0.7, w * 0.16, h * 0.32);
    stroke([[w * 0.9, h * 0.7], [w * 1.02, h * 0.7]], w * 0.007);
    ctx.globalAlpha = 1;
  });
  // painted wash fades into the wall
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, "rgba(170,166,140,0)");
  fade.addColorStop(0.45, "rgba(170,166,140,0.35)");
  fade.addColorStop(1, "rgba(170,166,140,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, h * 0.35, w, h * 0.65);
  vignette(ctx, w, h, 0.38, "40,30,20");
  return { canvas: c };
}

function buildMarbleGold(w: number, h: number, p: Pal): Still {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const m = paintField(tw, th, (u, v) => {
    const wv = fbm(u * 3 + fbm(u * 4, v * 4, 61) * 1.4, v * 4 + fbm(u * 5, v * 3, 63) * 1.4, 65);
    // veins are the thin bands where a warped field crosses a threshold
    const vein = Math.exp(-Math.pow((wv - 0.52) * 24, 2));
    const vein2 = Math.exp(-Math.pow((wv - 0.36) * 40, 2)) * 0.6;
    const cloud = fbm(u * 6, v * 8, 67);
    let col = mixc([246, 244, 240], [220, 218, 216], clamp01(cloud * 1.2 - 0.2));
    col = mixc(col, mixc(p.dark, [120, 118, 122], 0.45), clamp01(vein * 0.65 + vein2 * 0.3));
    const gold = Math.exp(-Math.pow((wv - 0.585) * 60, 2)) * 0.9;
    col = mixc(col, p.accent, clamp01(gold));
    return col;
  });
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(m, 0, 0, w, h);
  vignette(ctx, w, h, 0.22, "70,60,50");
  return { canvas: c };
}

function buildEmeraldVelvet(w: number, h: number, p: Pal): Still {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const vel = paintField(tw, th, (u, v) => {
    const folds = 0.5 + 0.5 * Math.sin((u * 0.6 - v * 0.9) * 9 + fbm(u * 3, v * 3, 71) * 5);
    const n = fbm(u * 3, v * 4, 73);
    const fine = fbm(u * 120, v * 180, 75, 2);
    const t = clamp01(folds * 0.55 + n * 0.45 + (fine - 0.5) * 0.12);
    return mixc(p.dark, p.light, t);
  });
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(vel, 0, 0, w, h);
  vignette(ctx, w, h, 0.62, "0,10,8");
  return { canvas: c };
}

function buildSunlitLinen(w: number, h: number, p: Pal): Still {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const lin = paintField(tw, th, (u, v, x, y) => {
    const weave = (Math.sin(x * 1.9) * Math.sin(y * 1.9)) * 7 + (fbm(u * 80, v * 120, 81, 2) - 0.5) * 14;
    const n = fbm(u * 3, v * 4, 83);
    const col = mixc(mixc(p.dark, [226, 210, 184], 0.45), mixc(p.light, [244, 232, 210], 0.6), n);
    return [col[0] + weave, col[1] + weave, col[2] + weave];
  });
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(lin, 0, 0, w, h);
  const rand = rng(91);
  // scattered rose petals with a soft shadow, gathered at the bottom left
  for (let i = 0; i < 26; i++) {
    const x = w * (0.02 + Math.pow(rand(), 1.6) * 0.5);
    const y = h * (0.7 + rand() * 0.28);
    const r = w * (0.025 + rand() * 0.03);
    const rot = rand() * TAU;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    blurred(ctx, 2.5, () => {
      ctx.fillStyle = "rgba(80,40,30,0.22)";
      ctx.beginPath();
      ctx.ellipse(r * 0.15, r * 0.2, r * 0.8, r * 1.05, 0, 0, TAU);
      ctx.fill();
    });
    const g = ctx.createRadialGradient(0, -r * 0.2, 0, 0, 0, r * 1.1);
    g.addColorStop(0, p.f1[0]);
    g.addColorStop(1, p.f1[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.75, r, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 5; i++) leaf(ctx, w * (0.06 + rand() * 0.3), h * (0.88 + rand() * 0.1), w * 0.12, w * 0.04, rand() * TAU, "#456b3a", "#7fa467");
  return { canvas: c };
}

function buildMarigoldGarland(w: number, h: number, p: Pal): Still {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const wall = paintField(tw, th, (u, v) => {
    const n = fbm(u * 5, v * 7, 101);
    const fine = fbm(u * 70, v * 100, 103, 2);
    return mixc(p.dark, mixc(p.dark, p.light, 0.8), clamp01(n * 1.1 + (fine - 0.5) * 0.2));
  });
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(wall, 0, 0, w, h);
  const rand = rng(111);
  // strands of marigold hanging from the top edge, the nearest ones larger and sharper
  const strands = [0.06, 0.2, 0.34, 0.62, 0.78, 0.93];
  strands.forEach((sx, si) => {
    const len = h * (0.1 + rand() * 0.22);
    const near = si % 2 === 0;
    const r = w * (near ? 0.034 : 0.024);
    blurred(ctx, near ? 0.6 : 2.4, () => {
      for (let y = -r; y < len; y += r * 1.25) {
        const x = sx * w + Math.sin(y / (h * 0.05) + si) * w * 0.012;
        ctx.save();
        ctx.translate(x, y);
        leaf(ctx, 0, 0, r * 1.8, r * 0.6, 0.9 + rand(), "#1c4a2a", "#4a9a54");
        leaf(ctx, 0, 0, r * 1.8, r * 0.6, -0.9 - rand(), "#1c4a2a", "#4a9a54");
        ctx.restore();
        bloom(ctx, x, y, r, rand() * TAU, 3, p.f3[0], p.f3[1]);
      }
    });
  });
  // a floating string of petals along the floor of the frame
  for (let i = 0; i < 40; i++) {
    const x = rand() * w, y = h * (0.78 + rand() * 0.2), r = w * (0.008 + rand() * 0.012);
    ctx.fillStyle = rand() > 0.4 ? p.f3[0] : p.f1[0];
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.5, rand() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  vignette(ctx, w, h, 0.5);
  return { canvas: c };
}

function buildJaaliLight(w: number, h: number, p: Pal): Still {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const wall = paintField(tw, th, (u, v) => {
    const n = fbm(u * 4, v * 6, 121);
    const fine = fbm(u * 70, v * 100, 123, 2);
    return mixc(mixc(p.dark, [60, 50, 46], 0.4), mixc(p.light, [120, 100, 86], 0.5), clamp01(n * 1.2 + (fine - 0.5) * 0.2));
  });
  const c = makeCanvas(w, h);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(wall, 0, 0, w, h);
  // sunlight through a carved lattice: a skewed grid of eight-point star cut-outs
  ctx.save();
  ctx.translate(w * 0.5, h * 0.2);
  ctx.rotate(-0.28);
  ctx.transform(1, 0, -0.35, 1, 0, 0);
  const cell = w * 0.17;
  blurred(ctx, w * 0.0035, () => {
    for (let gy = -3; gy <= 6; gy++) {
      for (let gx = -4; gx <= 4; gx++) {
        const cx = gx * cell, cy = gy * cell;
        const fall = clamp01(1 - gy / 6.5) * 0.85 + 0.15;
        ctx.fillStyle = `rgba(${p.accent[0] | 0},${p.accent[1] | 0},${(p.accent[2] + 60) | 0},${0.42 * fall})`;
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = (k * Math.PI) / 8, rr = k % 2 ? cell * 0.19 : cell * 0.4;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + cell / 2, cy + cell / 2, cell * 0.14, 0, TAU);
        ctx.fill();
      }
    }
  });
  ctx.restore();
  vignette(ctx, w, h, 0.5);
  return { canvas: c };
}

// ------------------------------------------------------------------ drawing

const cache = new Map<string, Still>();

export function splitId(id: SceneId): { base: SceneBase; pal: Pal } {
  const [b, i] = id.split(":");
  return { base: b as SceneBase, pal: PALETTES[Number(i) || 0] ?? PALETTES[0] };
}

function still(id: SceneId, w: number, h: number): Still {
  const key = `${id}:${w}x${h}`;
  let s = cache.get(key);
  if (!s) {
    const { base, pal } = splitId(id);
    const build = { "midnight-floral": buildMidnightFloral, "draped-rose": buildDrapedRose, "heritage-wall": buildHeritageWall, "marble-gold": buildMarbleGold, "emerald-velvet": buildEmeraldVelvet, "sunlit-linen": buildSunlitLinen, "marigold-garland": buildMarigoldGarland, "jaali-light": buildJaaliLight }[base];
    s = build(w, h, pal);
    if (cache.size > 12) cache.clear();
    cache.set(key, s);
  }
  return s;
}

/** Light and life over the still: moving glows, sparkles, swaying leaf shadows. */
export function drawScene(ctx: Ctx, w: number, h: number, t: number, id: SceneId) {
  {
    const [hb, hi] = id.split(":");
    if (isHeritage(hb)) {
      drawHeritage(ctx, w, h, t, hb, Number(hi) || 0);
      return;
    }
  }
  ctx.save();
  ctx.drawImage(still(id, w, h).canvas as CanvasImageSource, 0, 0, w, h);
  const { base, pal } = splitId(id);
  const rand = rng(base.length * 77);
  const sway = Math.sin((t / 14) * TAU);
  const gl = pal.glow;
  const glow = (a: number) => { const n = parseInt(gl.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  switch (base) {
    case "midnight-floral": {
      const g = ctx.createRadialGradient(w * (0.5 + sway * 0.05), h * 0.42, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.55);
      g.addColorStop(0, glow(0.28));
      g.addColorStop(1, glow(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      sparkles(ctx, w, h, t, rand, `${parseInt(gl.slice(1, 3), 16)},${parseInt(gl.slice(3, 5), 16)},${parseInt(gl.slice(5, 7), 16)}`, 26);
      break;
    }
    case "draped-rose": {
      const x = w * (0.5 + 0.35 * Math.sin((t / 18) * TAU));
      const g = ctx.createRadialGradient(x, h * 0.62, 0, x, h * 0.62, Math.max(w, h) * 0.5);
      g.addColorStop(0, glow(0.22));
      g.addColorStop(1, glow(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "heritage-wall": {
      // a slow band of window light crossing the wall
      ctx.save();
      ctx.translate(w * (0.55 + 0.25 * sway), 0);
      ctx.rotate(0.38);
      const g = ctx.createLinearGradient(-w * 0.25, 0, w * 0.25, 0);
      g.addColorStop(0, glow(0));
      g.addColorStop(0.5, glow(0.24));
      g.addColorStop(1, glow(0));
      ctx.fillStyle = g;
      ctx.fillRect(-w * 0.3, -h * 0.2, w * 0.6, h * 1.6);
      ctx.restore();
      break;
    }
    case "marble-gold": {
      const x = w * (0.2 + 0.6 * ((t / 24) % 1));
      const g = ctx.createLinearGradient(x - w * 0.3, 0, x + w * 0.3, h);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,252,240,0.28)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "emerald-velvet": {
      // string-light bokeh drifting at the top, twinkling gold
      for (let i = 0; i < 22; i++) {
        const x = (rand() * 1.1 - 0.05) * w + Math.sin(t * 0.3 + i) * w * 0.01;
        const y = h * (0.02 + rand() * 0.3);
        const r = w * (0.012 + rand() * 0.03);
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + rand()) + i * 2));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, glow(0.85 * tw));
        g.addColorStop(0.6, glow(0.3 * tw));
        g.addColorStop(1, glow(0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      break;
    }
    case "marigold-garland": {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.6, 0, w * 0.5, h * 0.6, Math.max(w, h) * 0.55);
      g.addColorStop(0, glow(0.22));
      g.addColorStop(1, glow(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      sparkles(ctx, w, h, t, rand, `${parseInt(gl.slice(1, 3), 16)},${parseInt(gl.slice(3, 5), 16)},${parseInt(gl.slice(5, 7), 16)}`, 18);
      break;
    }
    case "jaali-light": {
      const g = ctx.createLinearGradient(0, h * (0.1 + 0.05 * sway), w * 0.4, h * 0.9);
      g.addColorStop(0, glow(0.18));
      g.addColorStop(1, glow(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "sunlit-linen": {
      // palm-leaf shadows swaying in a warm window light
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "rgb(70,45,25)";
      if ("filter" in ctx) (ctx as CanvasRenderingContext2D).filter = `blur(${Math.max(2, w * 0.006)}px)`;
      for (let i = 0; i < 7; i++) {
        ctx.save();
        ctx.translate(w * 1.05, -h * 0.02);
        ctx.rotate(2.1 + i * 0.14 + Math.sin(t * 0.55 + i) * 0.045);
        leafShape(ctx, w * 0.62, w * 0.075);
        ctx.restore();
      }
      ctx.restore();
      const g = ctx.createLinearGradient(w, 0, 0, h);
      g.addColorStop(0, "rgba(255,225,160,0.3)");
      g.addColorStop(0.6, "rgba(255,225,160,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
  ctx.restore();
}

function leafShape(ctx: Ctx, len: number, wid: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, len * 0.25, wid * 1.2, len * 0.7, 0, len);
  ctx.bezierCurveTo(-wid * 1.2, len * 0.7, -wid, len * 0.25, 0, 0);
  ctx.fill();
}

function sparkles(ctx: Ctx, w: number, h: number, t: number, rand: () => number, rgb: string, n: number) {
  for (let i = 0; i < n; i++) {
    const sx = rand() * w;
    const speed = 0.012 + rand() * 0.02;
    const y = h * (1 - ((rand() + t * speed) % 1));
    const r = (0.003 + rand() * 0.007) * h;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.6 + rand()) + i));
    const g = ctx.createRadialGradient(sx, y, 0, sx, y, r);
    g.addColorStop(0, `rgba(${rgb},${0.8 * tw})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(sx - r, y - r, r * 2, r * 2);
  }
}

export const BASE_NAMES: Record<SceneBase, string> = {
  "midnight-floral": "Floral Night",
  "draped-rose": "Draped Satin",
  "heritage-wall": "Heritage Wall",
  "marble-gold": "Marble and Gold",
  "emerald-velvet": "Velvet and Lights",
  "sunlit-linen": "Linen and Petals",
  "marigold-garland": "Marigold Garland",
  "jaali-light": "Jaali Window Light",
};

export const SCENES: { id: SceneId; name: string; a: string; b: string; c: string; glow: string }[] = [];
for (const base of Object.keys(BASE_NAMES) as SceneBase[]) {
  PALETTES.forEach((p, i) => {
    SCENES.push({ id: `${base}:${i}`, name: `${BASE_NAMES[base]} · ${p.name}`, a: rgbs(mixc(p.light, p.dark, 0.25)), b: rgbs(p.dark), c: rgbs(p.accent), glow: p.glow });
  });
}

// the India, Spain and Italy collection
SCENES.push(...HERITAGE);
