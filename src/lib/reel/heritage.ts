// Backdrops inspired by the heritage of India, Spain and Italy: temple towers,
// carved pillars, arches, tiles, lotus ponds, hills and canals, and the swirl
// of Kathak and flamenco. Painted from code in four natural lights.

import type { Ctx } from "./backdrops";

type Canvas = HTMLCanvasElement | OffscreenCanvas;
const TAU = Math.PI * 2;

export type HeritageBase =
  | "gopuram" | "hampi" | "jharokha" | "lotus" | "kolam" | "kathak"
  | "alhambra" | "patio" | "flamenco" | "tuscany" | "amalfi" | "roman" | "venice";

export const HERITAGE_NAMES: Record<HeritageBase, string> = {
  gopuram: "Temple Gopuram, India",
  hampi: "Hampi Stone Pillars, India",
  jharokha: "Rajasthani Jharokha, India",
  lotus: "Lotus Pond, India",
  kolam: "Kolam Floor, India",
  kathak: "Kathak Twirl, India",
  alhambra: "Alhambra Arches, Spain",
  patio: "Andalusian Patio, Spain",
  flamenco: "Flamenco Red, Spain",
  tuscany: "Tuscan Hills, Italy",
  amalfi: "Amalfi Terrace, Italy",
  roman: "Roman Colonnade, Italy",
  venice: "Venetian Canal, Italy",
};

export type Tod = { name: string; sky: [string, string, string]; stone: [string, string]; sil: string; glow: string; accent: string };
export const TODS: Tod[] = [
  { name: "Golden Hour", sky: ["#e9945a", "#f6c183", "#fde9bf"], stone: ["#b86b3e", "#e6b27a"], sil: "#5a2e22", glow: "#ffe2a6", accent: "#d8a24a" },
  { name: "Rose Dusk", sky: ["#5b3a6e", "#c8607a", "#f6b08a"], stone: ["#8d4a52", "#d89a8a"], sil: "#2e1a2a", glow: "#ffc9b0", accent: "#e8b070" },
  { name: "Dawn Mist", sky: ["#9db6c9", "#e6d6c8", "#fbeedb"], stone: ["#b79a82", "#e9d8c4"], sil: "#6c5a52", glow: "#fff4e0", accent: "#c8a060" },
  { name: "Monsoon Teal", sky: ["#1f4a52", "#4f8a86", "#b8d4c4"], stone: ["#6a6a58", "#b8b49c"], sil: "#1c2c2c", glow: "#d8f2e0", accent: "#d8c070" },
];

// ------------------------------------------------------------------ kit

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
const ctxOf = (c: Canvas) => c.getContext("2d") as Ctx;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const rgb = (hex: string): number[] => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mixc = (a: number[], b: number[], t: number): number[] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: number[], a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixh = (a: string, b: string, t: number) => css(mixc(rgb(a), rgb(b), t));

function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, seed: number, oct = 4): number {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); f *= 2; a *= 0.5; }
  return s;
}
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function blurred(ctx: Ctx, px: number, draw: () => void) {
  ctx.save();
  if (px > 0 && "filter" in ctx) (ctx as CanvasRenderingContext2D).filter = `blur(${px}px)`;
  draw();
  ctx.restore();
}

/** A textured stone or plaster wall between two colours. */
function texture(ctx: Ctx, w: number, h: number, c1: number[], c2: number[], seed: number, grain = 0.2) {
  const tw = Math.ceil(w / 2), th = Math.ceil(h / 2);
  const c = makeCanvas(tw, th);
  const x = ctxOf(c);
  const img = x.createImageData(tw, th);
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    const u = i / tw, v = j / th;
    const t = clamp01(fbm(u * 4, v * 6, seed) * 1.15 + (fbm(u * 70, v * 100, seed + 3, 2) - 0.5) * grain);
    const o = (j * tw + i) * 4;
    img.data[o] = c1[0] + (c2[0] - c1[0]) * t; img.data[o + 1] = c1[1] + (c2[1] - c1[1]) * t; img.data[o + 2] = c1[2] + (c2[2] - c1[2]) * t; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(c as CanvasImageSource, 0, 0, w, h);
}

function sky(ctx: Ctx, w: number, h: number, T: Tod, bottom = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, h * bottom);
  g.addColorStop(0, T.sky[0]); g.addColorStop(0.55, T.sky[1]); g.addColorStop(1, T.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * bottom);
}
function sun(ctx: Ctx, x: number, y: number, r: number, T: Tod) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, T.glow); g.addColorStop(0.25, mixh(T.glow, T.sky[1], 0.4)); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function vignette(ctx: Ctx, w: number, h: number, a: number, col = "20,10,8") {
  const g = ctx.createRadialGradient(w / 2, h * 0.47, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function fillStone(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, T: Tod, backlit = 0.35) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, mixh(T.stone[1], T.sil, backlit)); g.addColorStop(1, mixh(T.stone[0], T.sil, backlit + 0.2));
  ctx.fillStyle = g;
}

/** A pointed-or-round arch opening: x centre, springing y, half width, top y. */
function archPath(ctx: Ctx, cx: number, yBase: number, half: number, yTop: number, kind: "round" | "pointed" | "horseshoe" | "cusped") {
  ctx.beginPath();
  ctx.moveTo(cx - half, yBase);
  if (kind === "pointed") {
    ctx.quadraticCurveTo(cx - half, yTop + (yBase - yTop) * 0.45, cx, yTop);
    ctx.quadraticCurveTo(cx + half, yTop + (yBase - yTop) * 0.45, cx + half, yBase);
  } else if (kind === "horseshoe") {
    const springY = yTop + half * 1.2;
    ctx.lineTo(cx - half, springY);
    ctx.bezierCurveTo(cx - half * 1.25, springY - half * 0.9, cx - half * 0.5, yTop, cx, yTop);
    ctx.bezierCurveTo(cx + half * 0.5, yTop, cx + half * 1.25, springY - half * 0.9, cx + half, springY);
    ctx.lineTo(cx + half, yBase);
  } else if (kind === "cusped") {
    const n = 7, y0 = yTop + (yBase - yTop) * 0.35;
    ctx.lineTo(cx - half, y0);
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI + (i * Math.PI) / n, a1 = Math.PI + ((i + 1) * Math.PI) / n;
      const rr = half, ry = (y0 - yTop);
      const mx = cx + Math.cos((a0 + a1) / 2) * rr * 1.07, my = y0 + Math.sin((a0 + a1) / 2) * ry * 1.07;
      ctx.quadraticCurveTo(mx, my, cx + Math.cos(a1) * rr, y0 + Math.sin(a1) * ry);
    }
    ctx.lineTo(cx + half, yBase);
  } else {
    ctx.lineTo(cx - half, yBase - (yBase - yTop) + half);
    ctx.arc(cx, yTop + half, half, Math.PI, 0);
    ctx.lineTo(cx + half, yBase);
  }
  ctx.closePath();
}

function star8(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8 + Math.PI / 16, rr = k % 2 ? r * 0.55 : r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function palm(ctx: Ctx, x: number, baseY: number, hgt: number, col: string, lean: number) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round";
  ctx.lineWidth = hgt * 0.035;
  const tx = x + lean * hgt, ty = baseY - hgt;
  ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x + lean * hgt * 0.2, baseY - hgt * 0.5, tx, ty); ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.95 + (i * Math.PI * 0.9) / 8;
    ctx.lineWidth = hgt * 0.02;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * hgt * 0.22, ty + Math.sin(a) * hgt * 0.22 - hgt * 0.05, tx + Math.cos(a) * hgt * 0.38, ty + Math.sin(a) * hgt * 0.3 + hgt * 0.08);
    ctx.stroke();
  }
}

function cypress(ctx: Ctx, x: number, baseY: number, hgt: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, baseY - hgt / 2, hgt * 0.07, hgt / 2, 0, 0, TAU);
  ctx.fill();
}

// ------------------------------------------------------------- builders

type Build = (ctx: Ctx, w: number, h: number, T: Tod) => void;

const gopuram: Build = (ctx, w, h, T) => {
  sky(ctx, w, h, T);
  sun(ctx, w * 0.5, h * 0.62, w * 0.9, T);
  const tower = (cx: number, baseY: number, bw: number, tiers: number, th: number, back: number) => {
    const tierH = th / (tiers + 2);
    ctx.save();
    ctx.globalAlpha = back;
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers, ww = bw * (1 - k * 0.72), y = baseY - (i + 1) * tierH;
      fillStone(ctx, cx, y, cx, y + tierH, T, 0.45);
      ctx.fillRect(cx - ww / 2, y, ww, tierH * 1.02);
      ctx.fillStyle = mixh(T.stone[1], T.accent, 0.5);
      ctx.fillRect(cx - ww / 2 - bw * 0.01, y, ww + bw * 0.02, tierH * 0.12);
      ctx.fillStyle = T.sil;
      const cells = Math.max(2, Math.round(ww / (bw * 0.1)));
      for (let c = 0; c < cells; c++) {
        const wx = cx - ww / 2 + ((c + 0.5) * ww) / cells;
        ctx.globalAlpha = back * 0.55;
        archPath(ctx, wx, y + tierH * 0.85, ww / cells * 0.2, y + tierH * 0.3, "round");
        ctx.fill();
      }
      ctx.globalAlpha = back;
    }
    // barrel roof and kalasam finials
    const topW = bw * 0.28, topY = baseY - (tiers + 1) * tierH;
    fillStone(ctx, cx, topY, cx, topY + tierH, T, 0.5);
    ctx.beginPath(); ctx.ellipse(cx, topY + tierH * 0.5, topW / 2, tierH * 0.55, 0, Math.PI, 0); ctx.lineTo(cx + topW / 2, topY + tierH); ctx.lineTo(cx - topW / 2, topY + tierH); ctx.fill();
    ctx.fillStyle = T.accent;
    for (const dx of [-0.34, 0, 0.34]) {
      ctx.beginPath(); ctx.ellipse(cx + dx * topW, topY - tierH * 0.1, tierH * 0.16, tierH * 0.3, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };
  tower(w * 0.86, h * 0.84, w * 0.5, 11, h * 0.62, 1);
  tower(w * 0.09, h * 0.84, w * 0.34, 9, h * 0.44, 0.9);
  tower(w * 0.52, h * 0.78, w * 0.2, 7, h * 0.26, 0.45);
  // palms and a dark foreground rise
  ctx.globalAlpha = 1;
  for (const [x, hh, l] of [[0.03, 0.2, 0.05], [0.24, 0.16, -0.06], [0.7, 0.14, 0.05], [0.97, 0.22, -0.05]] as [number, number, number][]) palm(ctx, w * x, h * 0.9, h * hh, T.sil, l);
  const g = ctx.createLinearGradient(0, h * 0.82, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, mixh(T.sil, "#000000", 0.35));
  ctx.fillStyle = g; ctx.fillRect(0, h * 0.82, w, h * 0.18);
  vignette(ctx, w, h, 0.4);
};

const hampi: Build = (ctx, w, h, T) => {
  texture(ctx, w, h, mixc(rgb(T.stone[0]), rgb(T.sil), 0.35), mixc(rgb(T.stone[1]), rgb(T.sil), 0.12), 201);
  // an open mandapa: bright sky behind a row of arches
  const rand = rng(207);
  ctx.save();
  archPath(ctx, w * 0.5, h * 0.62, w * 0.36, h * 0.08, "pointed");
  ctx.clip();
  sky(ctx, w, h, T, 0.62);
  sun(ctx, w * 0.5, h * 0.5, w * 0.7, T);
  ctx.restore();
  ctx.lineWidth = w * 0.014; ctx.strokeStyle = mixh(T.stone[1], T.sil, 0.2);
  archPath(ctx, w * 0.5, h * 0.62, w * 0.36, h * 0.08, "pointed"); ctx.stroke();
  // carved pillars at both sides: stacked bands, bracket capitals and bases
  const pillar = (cx: number, pw: number, top: number, bot: number, shade: number) => {
    ctx.save();
    ctx.globalAlpha = shade;
    const g = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0);
    g.addColorStop(0, mixh(T.stone[0], T.sil, 0.4)); g.addColorStop(0.45, mixh(T.stone[1], T.glow, 0.2)); g.addColorStop(1, mixh(T.stone[0], T.sil, 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(cx - pw / 2, top, pw, bot - top);
    const bands = 9;
    for (let i = 0; i < bands; i++) {
      const y = top + ((bot - top) * (i + 0.5)) / bands;
      ctx.fillStyle = `rgba(30,15,8,${0.2 + 0.1 * (i % 2)})`;
      ctx.fillRect(cx - pw / 2, y, pw, (bot - top) * 0.012);
      if (i % 2) { ctx.fillStyle = "rgba(255,230,180,0.18)"; ctx.fillRect(cx - pw * 0.38, y + (bot - top) * 0.02, pw * 0.76, (bot - top) * 0.02); }
    }
    ctx.fillStyle = mixh(T.stone[0], T.sil, 0.35);
    ctx.fillRect(cx - pw * 0.7, top, pw * 1.4, (bot - top) * 0.05);
    ctx.fillRect(cx - pw * 0.65, bot - (bot - top) * 0.07, pw * 1.3, (bot - top) * 0.07);
    ctx.restore();
  };
  pillar(w * 0.05, w * 0.16, 0, h, 1);
  pillar(w * 0.95, w * 0.16, 0, h, 1);
  pillar(w * 0.2, w * 0.07, h * 0.12, h * 0.9, 0.75);
  pillar(w * 0.8, w * 0.07, h * 0.12, h * 0.9, 0.75);
  // floor and light shafts
  const g = ctx.createLinearGradient(0, h * 0.86, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(30,14,6,0.55)");
  ctx.fillStyle = g; ctx.fillRect(0, h * 0.86, w, h * 0.14);
  for (let i = 0; i < 3; i++) {
    const x = w * (0.3 + rand() * 0.4);
    const sg = ctx.createLinearGradient(x, 0, x + w * 0.25, h);
    sg.addColorStop(0, css(rgb(T.glow), 0.22)); sg.addColorStop(1, css(rgb(T.glow), 0));
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * 0.1, 0); ctx.lineTo(x + w * 0.45, h); ctx.lineTo(x + w * 0.2, h); ctx.fill();
  }
  vignette(ctx, w, h, 0.45);
};

const jharokha: Build = (ctx, w, h, T) => {
  texture(ctx, w, h, mixc(rgb(T.stone[0]), [200, 110, 100], 0.4), mixc(rgb(T.stone[1]), [240, 170, 150], 0.4), 301);
  // the arched window, with the evening beyond it
  ctx.save();
  archPath(ctx, w * 0.5, h * 0.72, w * 0.36, h * 0.06, "cusped");
  ctx.clip();
  sky(ctx, w, h, T, 0.72);
  sun(ctx, w * 0.62, h * 0.5, w * 0.6, T);
  ctx.fillStyle = T.sil; ctx.globalAlpha = 0.5;
  for (const [x, r] of [[0.25, 0.09], [0.38, 0.06], [0.7, 0.1]] as [number, number][]) {
    ctx.beginPath(); ctx.arc(w * x, h * 0.66, w * r, Math.PI, 0); ctx.fill();
    ctx.fillRect(w * (x - r), h * 0.66, w * r * 2, h * 0.08);
  }
  ctx.restore();
  // carved frame: nested outlines
  for (let i = 0; i < 4; i++) {
    ctx.lineWidth = w * (0.012 - i * 0.002);
    ctx.strokeStyle = i % 2 ? mixh(T.stone[1], T.accent, 0.5) : mixh(T.stone[0], T.sil, 0.5);
    archPath(ctx, w * 0.5, h * 0.72, w * (0.36 + 0.03 * (i + 1)), h * (0.06 - 0.012 * (i + 1)), "cusped");
    ctx.stroke();
  }
  // lattice jaali panels under the window and a small balcony shelf
  ctx.fillStyle = mixh(T.stone[0], T.sil, 0.45); ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.strokeStyle = css(rgb(T.stone[1]), 0.5); ctx.lineWidth = 2;
  for (let gx = 0; gx < 12; gx++) for (let gy = 0; gy < 6; gy++) { star8(ctx, w * (gx + 0.5) / 12, h * (0.74 + (gy + 0.5) * 0.043), w * 0.032); ctx.stroke(); }
  ctx.fillStyle = mixh(T.stone[1], T.accent, 0.4); ctx.fillRect(0, h * 0.715, w, h * 0.012);
  vignette(ctx, w, h, 0.4);
};

const lotus: Build = (ctx, w, h, T) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mixh(T.sky[0], "#0b2b2c", 0.55)); g.addColorStop(0.5, mixh(T.sky[1], "#0f4a46", 0.45)); g.addColorStop(1, mixh(T.sky[2], "#14504a", 0.4));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const rand = rng(401);
  // ripples
  ctx.lineWidth = Math.max(1, w * 0.0015);
  for (let i = 0; i < 40; i++) {
    const x = rand() * w, y = rand() * h, r = w * (0.04 + rand() * 0.12);
    ctx.strokeStyle = css(rgb(T.glow), 0.12 + rand() * 0.1);
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.3, 0, 0, TAU); ctx.stroke();
  }
  const pad = (x: number, y: number, r: number) => {
    ctx.fillStyle = mixh("#2e7d4f", T.sil, 0.35);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.ellipse(x, y, r, r * 0.42, 0, 0.18, TAU - 0.12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.6, r * 0.25, 0, 0, TAU); ctx.stroke();
  };
  const bloom = (x: number, y: number, r: number) => {
    ctx.save(); ctx.translate(x, y);
    for (let layer = 0; layer < 2; layer++) {
      const n = 8 - layer * 2, rr = r * (1 - layer * 0.35);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + ((i - (n - 1) / 2) * 0.34) * (1 + layer * 0.3);
        ctx.save(); ctx.rotate(a + Math.PI / 2);
        const pg = ctx.createLinearGradient(0, 0, 0, -rr);
        pg.addColorStop(0, "#fff3f6"); pg.addColorStop(1, layer ? "#e87aa0" : "#f3a8c0");
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(rr * 0.45, -rr * 0.2, rr * 0.35, -rr * 0.85, 0, -rr); ctx.bezierCurveTo(-rr * 0.35, -rr * 0.85, -rr * 0.45, -rr * 0.2, 0, 0); ctx.fill();
        ctx.restore();
      }
    }
    ctx.fillStyle = "#f6d060"; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, TAU); ctx.fill();
    ctx.restore();
  };
  const spots: [number, number, number][] = [[0.08, 0.1, 0.07], [0.9, 0.08, 0.06], [0.06, 0.5, 0.06], [0.95, 0.55, 0.07], [0.1, 0.92, 0.09], [0.88, 0.94, 0.08], [0.5, 0.97, 0.06], [0.5, 0.03, 0.05]];
  blurred(ctx, 0.6, () => {
    for (const [x, y, r] of spots) pad(w * x, h * y, w * r * 1.8);
    for (const [x, y, r] of spots.filter((_, i) => i % 2 === 0)) bloom(w * x + w * 0.03, h * y - h * 0.012, w * r);
  });
  blurred(ctx, 2.2, () => { for (const [x, y, r] of spots.filter((_, i) => i % 2)) bloom(w * x, h * y - h * 0.01, w * r * 0.8); });
  vignette(ctx, w, h, 0.5, "0,12,12");
};

const kolam: Build = (ctx, w, h, T) => {
  texture(ctx, w, h, mixc(rgb(T.sil), [30, 18, 14], 0.5), mixc(rgb(T.stone[0]), rgb(T.sil), 0.4), 501, 0.35);
  const white = "rgba(255,250,240,0.85)";
  // dot lattice with looping lines: a classic pulli kolam
  const motif = (cx: number, cy: number, s: number) => {
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = white; ctx.fillStyle = white; ctx.lineWidth = Math.max(2, s * 0.045); ctx.lineCap = "round";
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.abs(i) + Math.abs(j) <= 3 && (i + j) % 2 === 0) { ctx.beginPath(); ctx.arc(i * s * 0.2, j * s * 0.2, s * 0.018, 0, TAU); ctx.fill(); }
    for (let k = 0; k < 8; k++) {
      ctx.save(); ctx.rotate((k * TAU) / 8);
      ctx.beginPath(); ctx.moveTo(0, -s * 0.12); ctx.bezierCurveTo(s * 0.22, -s * 0.2, s * 0.22, -s * 0.5, 0, -s * 0.62); ctx.bezierCurveTo(-s * 0.22, -s * 0.5, -s * 0.22, -s * 0.2, 0, -s * 0.12); ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.66, 0, TAU); ctx.stroke();
    ctx.restore();
  };
  blurred(ctx, 0.8, () => {
    motif(w * 0.14, h * 0.1, w * 0.34); motif(w * 0.88, h * 0.34, w * 0.28); motif(w * 0.08, h * 0.62, w * 0.3);
    motif(w * 0.86, h * 0.9, w * 0.36); motif(w * 0.5, h * 0.99, w * 0.26);
  });
  // marigold and rose petals thrown across
  const rand = rng(509);
  for (let i = 0; i < 70; i++) {
    const x = rand() * w, y = rand() * h, r = w * (0.008 + rand() * 0.012);
    ctx.fillStyle = rand() > 0.35 ? "#f09a1c" : "#d8386a"; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.6, rand() * TAU, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  vignette(ctx, w, h, 0.45);
};

const kathak: Build = (ctx, w, h, T) => {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.85, 0, w * 0.5, h * 0.7, h * 0.9);
  g.addColorStop(0, mixh(T.sky[1], "#3a0f26", 0.2)); g.addColorStop(1, mixh(T.sky[0], "#12060f", 0.7));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // the whirl of a skirt: nested crescent ribbons around a point below the frame
  const cx = w * 0.5, cy = h * 1.0;
  const cols = [T.accent, T.glow, mixh(T.sky[2], "#ffffff", 0.2), mixh(T.sky[1], "#ffffff", 0.3)];
  for (let i = 0; i < 26; i++) {
    const r = h * (0.22 + i * 0.03), a0 = Math.PI * (1.02 + (i % 5) * 0.03), sweep = Math.PI * (0.5 + 0.35 * Math.sin(i * 1.7) ** 2);
    const th = h * (0.012 + 0.014 * ((i * 7) % 5) / 4);
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + sweep);
    ctx.arc(cx, cy, r + th, a0 + sweep, a0, true);
    ctx.closePath();
    const lg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy);
    const c = cols[i % cols.length];
    lg.addColorStop(0, css(rgb(c), 0)); lg.addColorStop(0.5, css(rgb(c), 0.28 + 0.1 * (i % 3))); lg.addColorStop(1, css(rgb(c), 0));
    ctx.fillStyle = lg; ctx.fill();
  }
  // ghungroo glints
  const rand = rng(601);
  for (let i = 0; i < 50; i++) {
    const a = Math.PI * (1.05 + rand() * 0.9), r = h * (0.25 + rand() * 0.75), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, rr = w * (0.004 + rand() * 0.007);
    const bg = ctx.createRadialGradient(x, y, 0, x, y, rr * 3);
    bg.addColorStop(0, css(rgb(T.glow), 0.9)); bg.addColorStop(1, css(rgb(T.glow), 0));
    ctx.fillStyle = bg; ctx.fillRect(x - rr * 3, y - rr * 3, rr * 6, rr * 6);
  }
  vignette(ctx, w, h, 0.4, "10,0,10");
};

const alhambra: Build = (ctx, w, h, T) => {
  texture(ctx, w, h, mixc(rgb(T.stone[0]), rgb(T.sil), 0.12), mixc(rgb(T.stone[1]), [250, 240, 220], 0.35), 701);
  // carved plaster lattice across the wall
  ctx.strokeStyle = css(mixc(rgb(T.stone[0]), rgb(T.sil), 0.5), 0.16); ctx.lineWidth = Math.max(1, w * 0.002);
  const cell = w * 0.1;
  for (let gy = 0; gy * cell < h; gy++) for (let gx = 0; gx <= 10; gx++) { star8(ctx, gx * cell + (gy % 2) * cell * 0.5, gy * cell * 0.85, cell * 0.46); ctx.stroke(); }
  // tile bands
  const band = (y: number, bh: number) => {
    ctx.fillStyle = "#12475a"; ctx.fillRect(0, y, w, bh);
    const n = Math.round(w / bh);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (w / n);
      ctx.fillStyle = i % 2 ? "#f1e4c4" : "#d8a640"; star8(ctx, x, y + bh / 2, bh * 0.46); ctx.fill();
      ctx.fillStyle = "#12475a"; ctx.beginPath(); ctx.arc(x, y + bh / 2, bh * 0.12, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#d8a640"; ctx.fillRect(0, y, w, bh * 0.05); ctx.fillRect(0, y + bh * 0.95, w, bh * 0.05);
  };
  band(h * 0.84, h * 0.09); band(h * 0.02, h * 0.06);
  // horseshoe arches, columns at both sides, the courtyard beyond
  const arch = (cx: number, half: number, top: number, yBase: number, shade: number) => {
    ctx.save(); ctx.globalAlpha = shade;
    ctx.fillStyle = mixh(T.stone[1], "#ffffff", 0.25);
    archPath(ctx, cx, yBase, half * 1.22, top - half * 0.18, "horseshoe"); ctx.fill();
    ctx.save(); archPath(ctx, cx, yBase, half, top, "horseshoe"); ctx.clip();
    sky(ctx, w, h, T, 1);
    sun(ctx, cx, h * 0.55, w * 0.5, T);
    ctx.restore();
    ctx.lineWidth = w * 0.006; ctx.strokeStyle = "#a87a2a"; archPath(ctx, cx, yBase, half, top, "horseshoe"); ctx.stroke();
    ctx.restore();
  };
  arch(w * 0.04, w * 0.13, h * 0.2, h * 0.84, 1);
  arch(w * 0.96, w * 0.13, h * 0.2, h * 0.84, 1);
  const col = (cx: number) => { const g = ctx.createLinearGradient(cx - w * 0.02, 0, cx + w * 0.02, 0); g.addColorStop(0, "#c9b690"); g.addColorStop(0.5, "#f4e9d0"); g.addColorStop(1, "#b39c76"); ctx.fillStyle = g; ctx.fillRect(cx - w * 0.02, h * 0.26, w * 0.04, h * 0.58); };
  col(w * 0.2); col(w * 0.8);
  const floor = ctx.createLinearGradient(0, h * 0.93, 0, h);
  floor.addColorStop(0, "rgba(40,20,10,0)"); floor.addColorStop(1, "rgba(40,20,10,0.5)");
  ctx.fillStyle = floor; ctx.fillRect(0, h * 0.93, w, h * 0.07);
  vignette(ctx, w, h, 0.38);
};

const patio: Build = (ctx, w, h, T) => {
  texture(ctx, w, h, [236, 228, 214], [252, 249, 242], 801, 0.12);
  const sh = ctx.createLinearGradient(0, 0, w, 0);
  sh.addColorStop(0, css(rgb(T.sky[1]), 0.22)); sh.addColorStop(1, css(rgb(T.sky[1]), 0));
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
  // cobalt-and-white tile dado
  const y0 = h * 0.7, ts = w * 0.1;
  for (let gy = 0; y0 + gy * ts < h; gy++) for (let gx = 0; gx < 11; gx++) {
    const x = gx * ts, y = y0 + gy * ts, dark = (gx + gy) % 2;
    ctx.fillStyle = dark ? "#1f4f9a" : "#f5f1e8"; ctx.fillRect(x, y, ts, ts);
    ctx.strokeStyle = dark ? "#f5f1e8" : "#1f4f9a"; ctx.lineWidth = ts * 0.04;
    ctx.beginPath(); ctx.arc(x + ts / 2, y + ts / 2, ts * 0.3, 0, TAU); ctx.stroke();
    star8(ctx, x + ts / 2, y + ts / 2, ts * 0.18); ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, y0 - 4, w, 4);
  // blue shuttered window, wrought-iron rail and flowerpots
  const shutter = (x: number, y: number, ww: number, hh: number) => {
    ctx.fillStyle = "#2a5db0"; ctx.fillRect(x, y, ww, hh);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 0; i < 14; i++) ctx.fillRect(x + ww * 0.1, y + ((i + 0.5) * hh) / 14, ww * 0.8, hh * 0.018);
  };
  shutter(w * 0.03, h * 0.12, w * 0.12, h * 0.34); shutter(w * 0.17, h * 0.12, w * 0.12, h * 0.34);
  shutter(w * 0.71, h * 0.12, w * 0.12, h * 0.34); shutter(w * 0.85, h * 0.12, w * 0.12, h * 0.34);
  const pot = (x: number, y: number, r: number) => {
    ctx.fillStyle = "#b8552e"; ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.9); ctx.lineTo(x + r, y - r * 0.9); ctx.lineTo(x + r * 0.7, y + r * 0.7); ctx.lineTo(x - r * 0.7, y + r * 0.7); ctx.fill();
    ctx.fillStyle = "#2e6b3a"; ctx.beginPath(); ctx.ellipse(x, y - r * 1.1, r * 1.15, r * 0.7, 0, 0, TAU); ctx.fill();
    const rand = rng(Math.floor(x));
    for (let i = 0; i < 9; i++) { ctx.fillStyle = rand() > 0.3 ? "#d8382e" : "#f06a5a"; ctx.beginPath(); ctx.arc(x + (rand() - 0.5) * r * 1.8, y - r * (1 + rand() * 0.8), r * 0.2, 0, TAU); ctx.fill(); }
  };
  blurred(ctx, 0.5, () => { pot(w * 0.06, h * 0.68, w * 0.05); pot(w * 0.2, h * 0.68, w * 0.04); pot(w * 0.82, h * 0.68, w * 0.045); pot(w * 0.95, h * 0.68, w * 0.05); });
  vignette(ctx, w, h, 0.22, "50,30,20");
};

const flamenco: Build = (ctx, w, h, T) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mixh("#2a0508", T.sil, 0.2)); g.addColorStop(0.55, mixh("#a01626", T.sky[0], 0.1)); g.addColorStop(1, mixh("#6a0c18", T.sil, 0.2));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // polka dots, the traje de flamenca
  const rand = rng(901);
  for (let i = 0; i < 90; i++) {
    const x = rand() * w, y = rand() * h, r = w * (0.012 + rand() * 0.03);
    ctx.fillStyle = `rgba(255,244,230,${0.35 + rand() * 0.45})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // layered ruffles along the bottom
  for (let l = 0; l < 4; l++) {
    const y = h * (0.78 + l * 0.055), amp = h * 0.018;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, y + Math.sin(x / (w * 0.045) + l) * amp);
    ctx.lineTo(w, h); ctx.closePath();
    const rg = ctx.createLinearGradient(0, y - amp, 0, y + h * 0.08);
    rg.addColorStop(0, l % 2 ? "#e0273c" : "#b8142a"); rg.addColorStop(1, "#5a0813");
    ctx.fillStyle = rg; ctx.fill();
  }
  // a fan opened in the upper corner, and a rose
  ctx.save(); ctx.translate(w * 0.92, h * 0.1); ctx.rotate(0.35);
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI * 0.95 + (i * Math.PI * 0.9) / 12;
    ctx.fillStyle = i % 2 ? "#17090b" : "#3a1016";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, w * 0.34, a, a + (Math.PI * 0.9) / 12 + 0.01); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = T.accent; ctx.lineWidth = 2;
  for (let i = 0; i <= 13; i++) { const a = -Math.PI * 0.95 + (i * Math.PI * 0.9) / 12; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * w * 0.34, Math.sin(a) * w * 0.34); ctx.stroke(); }
  ctx.restore();
  for (let k = 3; k >= 1; k--) {
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.translate(w * 0.08, h * 0.74); ctx.rotate((i * TAU) / 6 + k);
      ctx.fillStyle = k === 1 ? "#ff5a4a" : k === 2 ? "#d8283a" : "#a81428";
      ctx.beginPath(); ctx.ellipse(0, -w * 0.03 * k, w * 0.03 * k * 0.7, w * 0.03 * k, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  vignette(ctx, w, h, 0.5, "20,0,4");
};

const tuscany: Build = (ctx, w, h, T) => {
  sky(ctx, w, h, T, 0.7);
  sun(ctx, w * 0.3, h * 0.46, w * 0.9, T);
  const hill = (y: number, amp: number, seed: number, col: string, fadeTo: string, k: number) => {
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, y + (fbm(x / w * 2.2, seed, seed) - 0.5) * amp * 2 + Math.sin(x / w * 5 + seed) * amp * 0.5);
    ctx.lineTo(w, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, y - amp, 0, y + amp * 4);
    g.addColorStop(0, mixh(col, fadeTo, k)); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.fill();
  };
  const haze = T.sky[2];
  hill(h * 0.58, h * 0.03, 11, mixh("#8a9a64", T.sil, 0.15), haze, 0.55);
  hill(h * 0.65, h * 0.035, 17, mixh("#a89a4a", T.sil, 0.1), haze, 0.35);
  // a farmhouse and a ridge of cypresses
  ctx.fillStyle = mixh("#d9b98a", T.sil, 0.2); ctx.fillRect(w * 0.7, h * 0.625, w * 0.09, h * 0.032);
  ctx.fillStyle = mixh("#9a4a2e", T.sil, 0.2); ctx.beginPath(); ctx.moveTo(w * 0.69, h * 0.625); ctx.lineTo(w * 0.745, h * 0.605); ctx.lineTo(w * 0.8, h * 0.625); ctx.fill();
  for (let i = 0; i < 14; i++) cypress(ctx, w * (0.08 + i * 0.045 + (i % 3) * 0.01), h * 0.69, h * (0.05 + (i % 4) * 0.008), mixh("#2e4a2a", T.sil, 0.35));
  hill(h * 0.74, h * 0.04, 23, mixh("#7e8a3a", T.sil, 0.2), haze, 0.15);
  hill(h * 0.86, h * 0.04, 31, mixh("#5a7a2e", T.sil, 0.3), haze, 0);
  const rand = rng(1001);
  for (let i = 0; i < 28; i++) cypress(ctx, w * (rand() * 0.2 + (i % 2 ? 0.8 : 0)), h * (0.88 + rand() * 0.1), h * (0.07 + rand() * 0.06), mixh("#1e3a22", T.sil, 0.4));
  vignette(ctx, w, h, 0.32);
};

const amalfi: Build = (ctx, w, h, T) => {
  sky(ctx, w, h, T, 0.5);
  const sea = ctx.createLinearGradient(0, h * 0.42, 0, h * 0.8);
  sea.addColorStop(0, mixh("#1f7ea8", T.sky[2], 0.25)); sea.addColorStop(1, mixh("#0f4e78", T.sil, 0.2));
  ctx.fillStyle = sea; ctx.fillRect(0, h * 0.42, w, h * 0.38);
  sun(ctx, w * 0.65, h * 0.43, w * 0.55, T);
  const rand = rng(1101);
  ctx.strokeStyle = css(rgb(T.glow), 0.5); ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const x = w * (0.4 + rand() * 0.5), y = h * (0.44 + rand() * 0.3), l = w * (0.01 + rand() * 0.04); ctx.beginPath(); ctx.moveTo(x - l, y); ctx.lineTo(x + l, y); ctx.stroke(); }
  // cliffside houses
  const pal = ["#f2d9a0", "#e8a070", "#f4c0a0", "#f6eac8", "#d98a5a"];
  for (let i = 0; i < 9; i++) { const x = w * (i * 0.12 - 0.05), ww = w * 0.1, hh = h * (0.06 + (i % 3) * 0.02); ctx.fillStyle = pal[i % pal.length]; ctx.globalAlpha = 0.9; ctx.fillRect(x, h * 0.46 - hh * 0.2, ww, hh); ctx.fillStyle = "rgba(60,30,20,0.4)"; ctx.fillRect(x + ww * 0.3, h * 0.46 + hh * 0.2, ww * 0.18, hh * 0.35); }
  ctx.globalAlpha = 1;
  // terrace: warm stone floor and balustrade, with an arch frame at top
  const fl = ctx.createLinearGradient(0, h * 0.8, 0, h);
  fl.addColorStop(0, mixh(T.stone[1], "#ffffff", 0.3)); fl.addColorStop(1, mixh(T.stone[0], T.sil, 0.2));
  ctx.fillStyle = fl; ctx.fillRect(0, h * 0.8, w, h * 0.2);
  ctx.fillStyle = mixh(T.stone[1], "#ffffff", 0.45); ctx.fillRect(0, h * 0.78, w, h * 0.02);
  for (let i = 0; i < 13; i++) { ctx.fillStyle = mixh(T.stone[1], "#ffffff", 0.4); ctx.beginPath(); ctx.ellipse(w * (i + 0.5) / 13, h * 0.84, w * 0.014, h * 0.05, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = mixh(T.stone[0], T.sil, 0.15);
  ctx.beginPath(); ctx.rect(0, 0, w, h * 0.3); archPath(ctx, w * 0.5, h * 0.3, w * 0.5, h * 0.06, "round"); ctx.fill("evenodd");
  // lemons hanging from the top corners
  const lemons = (x0: number, dir: number) => {
    blurred(ctx, 0.5, () => {
      for (let i = 0; i < 9; i++) {
        const x = x0 + dir * w * (0.02 + rand() * 0.26), y = h * (0.02 + rand() * 0.12);
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5 + rand());
        ctx.fillStyle = "#2f6a2e"; ctx.beginPath(); ctx.ellipse(w * 0.025, -h * 0.02, w * 0.05, h * 0.012, 0.3, 0, TAU); ctx.fill();
        const g = ctx.createRadialGradient(-w * 0.004, -w * 0.004, 0, 0, 0, w * 0.04);
        g.addColorStop(0, "#fff1a0"); g.addColorStop(1, "#e8b81c");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.028, w * 0.038, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    });
  };
  lemons(0, 1); lemons(w, -1);
  vignette(ctx, w, h, 0.25);
};

const roman: Build = (ctx, w, h, T) => {
  sky(ctx, w, h, T);
  sun(ctx, w * 0.5, h * 0.55, w * 0.9, T);
  // a distant dome
  ctx.fillStyle = mixh(T.sil, T.sky[1], 0.55);
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, w * 0.14, Math.PI, 0); ctx.fill(); ctx.fillRect(w * 0.36, h * 0.62, w * 0.28, h * 0.06); ctx.fillRect(w * 0.495, h * 0.5, w * 0.01, h * 0.04);
  // travertine columns with fluting, and an architrave
  const column = (cx: number, cw: number, top: number, bot: number) => {
    const g = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    g.addColorStop(0, mixh(T.stone[0], T.sil, 0.25)); g.addColorStop(0.4, mixh(T.stone[1], "#ffffff", 0.35)); g.addColorStop(1, mixh(T.stone[0], T.sil, 0.5));
    ctx.fillStyle = g; ctx.fillRect(cx - cw / 2, top, cw, bot - top);
    ctx.strokeStyle = "rgba(60,35,20,0.22)"; ctx.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) { const x = cx - cw / 2 + (cw * i) / 8; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }
    ctx.fillStyle = mixh(T.stone[1], "#ffffff", 0.2);
    ctx.fillRect(cx - cw * 0.65, top, cw * 1.3, (bot - top) * 0.04); ctx.fillRect(cx - cw * 0.7, bot - (bot - top) * 0.04, cw * 1.4, (bot - top) * 0.04);
  };
  column(w * 0.06, w * 0.14, h * 0.1, h * 0.92); column(w * 0.94, w * 0.14, h * 0.1, h * 0.92);
  ctx.globalAlpha = 0.6; column(w * 0.24, w * 0.07, h * 0.18, h * 0.88); column(w * 0.76, w * 0.07, h * 0.18, h * 0.88); ctx.globalAlpha = 1;
  fillStone(ctx, 0, h * 0.04, w, h * 0.1, T, 0.1); ctx.fillRect(0, h * 0.03, w, h * 0.07);
  ctx.fillStyle = "rgba(60,35,20,0.25)"; ctx.fillRect(0, h * 0.1, w, h * 0.008);
  // pavement and ivy
  const fl = ctx.createLinearGradient(0, h * 0.88, 0, h);
  fl.addColorStop(0, mixh(T.stone[1], "#ffffff", 0.2)); fl.addColorStop(1, mixh(T.stone[0], T.sil, 0.4));
  ctx.fillStyle = fl; ctx.fillRect(0, h * 0.88, w, h * 0.12);
  const rand = rng(1201);
  blurred(ctx, 0.5, () => { for (let i = 0; i < 40; i++) { const x = rand() < 0.5 ? rand() * w * 0.15 : w - rand() * w * 0.15, y = h * (0.1 + rand() * 0.7), r = w * (0.012 + rand() * 0.012); ctx.fillStyle = rand() > 0.5 ? "#2f6a30" : "#4a8a3a"; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.4, rand() * TAU, 0, TAU); ctx.fill(); } });
  vignette(ctx, w, h, 0.36);
};

const venice: Build = (ctx, w, h, T) => {
  sky(ctx, w, h, T, 0.5);
  sun(ctx, w * 0.5, h * 0.3, w * 0.8, T);
  const base = h * 0.5;
  const pal = ["#e8b87a", "#e8998a", "#f2dca8", "#d9805a", "#c8a07a", "#f0c0a8"];
  const buildings: [number, number, number][] = [];
  let x = -w * 0.02;
  const rand = rng(1301);
  while (x < w) { const bw = w * (0.12 + rand() * 0.08), bh = h * (0.14 + rand() * 0.1); buildings.push([x, bw, bh]); x += bw; }
  const drawRow = (flip: boolean) => {
    buildings.forEach(([bx, bw, bh], i) => {
      const y = flip ? base : base - bh;
      ctx.fillStyle = pal[i % pal.length]; ctx.fillRect(bx, y, bw, bh);
      ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(bx, y, bw * 0.06, bh);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const wx = bx + bw * (0.17 + c * 0.28), wy = y + bh * (0.14 + r * 0.28);
        ctx.fillStyle = "#4a2a1e"; archPath(ctx, wx + bw * 0.06, wy + bh * 0.2, bw * 0.06, wy, "round"); ctx.fill();
      }
      ctx.fillStyle = mixh("#b8552e", T.sil, 0.15); ctx.fillRect(bx - 2, flip ? y + bh - 4 : y - 6, bw + 4, 6);
    });
  };
  drawRow(false);
  // the canal mirrors the row, rippled
  ctx.save();
  const water = ctx.createLinearGradient(0, base, 0, h);
  water.addColorStop(0, mixh("#2e6a7a", T.sky[1], 0.3)); water.addColorStop(1, mixh("#0e3a4a", T.sil, 0.3));
  ctx.fillStyle = water; ctx.fillRect(0, base, w, h - base);
  ctx.beginPath(); ctx.rect(0, base, w, h - base); ctx.clip();
  ctx.globalAlpha = 0.5;
  blurred(ctx, w * 0.004, () => { drawRow(true); });
  ctx.restore();
  ctx.strokeStyle = css(rgb(T.glow), 0.25); ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) { const px = rand() * w, py = base + h * 0.01 + rand() * (h - base), l = w * (0.02 + rand() * 0.06); ctx.beginPath(); ctx.moveTo(px - l, py); ctx.lineTo(px + l, py); ctx.stroke(); }
  // mooring poles
  for (const px of [0.1, 0.9]) { ctx.fillStyle = "#4a3a8a"; ctx.fillRect(w * px - 6, base + h * 0.03, 12, h * 0.4); ctx.fillStyle = "#f2e6c0"; ctx.fillRect(w * px - 6, base + h * 0.12, 12, h * 0.04); }
  vignette(ctx, w, h, 0.4, "10,18,24");
};

const BUILDERS: Record<HeritageBase, Build> = { gopuram, hampi, jharokha, lotus, kolam, kathak, alhambra, patio, flamenco, tuscany, amalfi, roman, venice };

export function isHeritage(base: string): base is HeritageBase {
  return base in BUILDERS;
}

const cache = new Map<string, Canvas>();

export function heritageStill(base: HeritageBase, todIdx: number, w: number, h: number): Canvas {
  const key = `${base}:${todIdx}:${w}x${h}`;
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(w, h);
    BUILDERS[base](ctxOf(c), w, h, TODS[todIdx] ?? TODS[0]);
    if (cache.size > 10) cache.clear();
    cache.set(key, c);
  }
  return c;
}

/** The still, with a slow drifting light and sparkles over it. */
export function drawHeritage(ctx: Ctx, w: number, h: number, t: number, base: HeritageBase, todIdx: number) {
  const T = TODS[todIdx] ?? TODS[0];
  ctx.save();
  ctx.drawImage(heritageStill(base, todIdx, w, h) as CanvasImageSource, 0, 0, w, h);
  const [r, g, b] = rgb(T.glow);
  const x = w * (0.5 + 0.3 * Math.sin((t / 16) * TAU));
  const lg = ctx.createRadialGradient(x, h * 0.4, 0, x, h * 0.45, Math.max(w, h) * 0.55);
  lg.addColorStop(0, `rgba(${r},${g},${b},0.2)`); lg.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
  const rand = rng(base.length * 131 + todIdx);
  const water = base === "lotus" || base === "venice" || base === "amalfi";
  for (let i = 0; i < (water ? 34 : 22); i++) {
    const sx = rand() * w;
    const speed = water ? 0 : 0.012 + rand() * 0.018;
    const y = water ? h * (0.5 + rand() * 0.5) : h * (1 - ((rand() + t * speed) % 1));
    const rr = (0.003 + rand() * 0.006) * h;
    const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.6 + rand()) + i));
    const sg = ctx.createRadialGradient(sx, y, 0, sx, y, rr);
    sg.addColorStop(0, `rgba(${r},${g},${b},${0.8 * tw})`); sg.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = sg; ctx.fillRect(sx - rr, y - rr, rr * 2, rr * 2);
  }
  ctx.restore();
}

export const HERITAGE: { id: string; name: string; a: string; b: string; c: string; glow: string }[] = [];
for (const base of Object.keys(HERITAGE_NAMES) as HeritageBase[]) {
  TODS.forEach((T, i) => HERITAGE.push({ id: `${base}:${i}`, name: `${HERITAGE_NAMES[base]} · ${T.name}`, a: T.sky[1], b: T.stone[0], c: T.accent, glow: T.glow }));
}
