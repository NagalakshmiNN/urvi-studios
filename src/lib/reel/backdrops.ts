// Moving backdrops for the reel: slow, quiet, and always behind the dress.
//
// 7 kinds of movement x 6 colour families = 42 named backdrops, plus "match the
// dress" (a family built from the dress's own colour). One is picked each day,
// automatically, walking through the list so that no two days in a row look
// alike, and skipping any that would make a pale dress disappear.

import { SCENES, drawScene, type SceneId } from "./scenes";

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type RGB = [number, number, number];

export type Family = { name: string; a: string; b: string; c: string; glow: string };
export type Kind = "drift" | "glow" | "dust" | "silk" | "arch" | "clouds" | "beams" | "scene";

export type Backdrop = {
  id: string;
  name: string;
  kind: Kind;
  family: Family;
  /** For kind "scene": which painted set. */
  scene?: SceneId;
};

// a = light end, b = deeper end, c = accent for shapes, glow = light colour
export const FAMILIES: Family[] = [
  { name: "Ivory Gold", a: "#FBF6EA", b: "#EBDDBF", c: "#D9BF86", glow: "#FFF8E1" },
  { name: "Blush Rose", a: "#FBEDEC", b: "#EDC9C8", c: "#E3A9A9", glow: "#FFF1EE" },
  { name: "Sage Mist", a: "#EEF1E6", b: "#C9D3B8", c: "#A9B890", glow: "#F7FAEF" },
  { name: "Sky Mist", a: "#EEF4F8", b: "#C6D8E6", c: "#9FBBD3", glow: "#F8FCFF" },
  { name: "Lavender", a: "#F3EFF8", b: "#D5CBE6", c: "#B8A8D6", glow: "#FAF7FF" },
  { name: "Peach Sand", a: "#FCF0E4", b: "#EDCDAE", c: "#DDAA7F", glow: "#FFF5EA" },
];

export const KINDS: { kind: Kind; name: string }[] = [
  { kind: "drift", name: "Drift" },
  { kind: "glow", name: "Glow" },
  { kind: "dust", name: "Dust" },
  { kind: "silk", name: "Silk" },
  { kind: "arch", name: "Arch" },
  { kind: "clouds", name: "Clouds" },
  { kind: "beams", name: "Beams" },
];

// Walking the list one step changes both the movement (7 kinds) and the colour
// (6 families) every time, and 7 and 6 share no factor, so all 42 pairs appear
// before anything repeats.
export const BACKDROPS: Backdrop[] = Array.from({ length: KINDS.length * FAMILIES.length }, (_, i) => {
  const k = KINDS[i % KINDS.length];
  const fi = i % FAMILIES.length;
  return { id: `${k.kind}-${fi}`, name: `${FAMILIES[fi].name} ${k.name}`, kind: k.kind, family: FAMILIES[fi] };
});

// ------------------------------------------------------------------ colour

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 240];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: RGB) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function luminance(c: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/** Perceived lightness 0-1 (simple, steady across hues). */
function lightness(c: RGB): number {
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
}

/** A backdrop family built from the dress's own colour: a pale wash of it. */
export function familyFromDress(dress: RGB): Family {
  const white: RGB = [255, 252, 245];
  const dark: RGB = [60, 45, 40];
  const l = lightness(dress);
  // pale dresses get a deeper tint so they stand out; strong dresses get a gentle pale one
  const a = mix(dress, white, l > 0.75 ? 0.55 : 0.88);
  const b = mix(dress, l > 0.75 ? dark : white, l > 0.75 ? 0.28 : 0.72);
  return {
    name: "Dress match",
    a: toHex(a),
    b: toHex(b),
    c: toHex(mix(dress, white, 0.45)),
    glow: toHex(mix(a, white, 0.6)),
  };
}

export function matchBackdrop(dress: RGB, kind: Kind = "glow"): Backdrop {
  return { id: `match-${kind}`, name: "Match the dress", kind, family: familyFromDress(dress) };
}

/** Does the dress stand out against the middle of this backdrop? */
export function hasContrast(dress: RGB, b: Backdrop): boolean {
  const mid = mix(hexToRgb(b.family.a), hexToRgb(b.family.b), 0.5);
  return Math.abs(lightness(dress) - lightness(mid)) >= 0.17;
}

// -------------------------------------------------------------- the daily pick

/** Whole days since 1 Jan 1970 in the local time zone of `d`. */
export function dayNumber(d: Date): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

/**
 * Today's backdrop. Walks the list one step per day (so a different one every
 * day, and 42 days before any repeats), moving on past any that would hide a
 * pale dress.
 */
export function pickForDay(d: Date, dress: RGB | null): Backdrop {
  const list = SET_BACKDROPS;
  const n = list.length;
  const start = ((dayNumber(d) % n) + n) % n;
  if (!dress) return list[start];
  for (let i = 0; i < n; i++) {
    const b = list[(start + i) % n];
    if (hasContrast(dress, b)) return b;
  }
  return matchBackdrop(dress);
}

/** The painted studio sets: richer, darker, more like a styled photo shoot. */
export const SET_BACKDROPS: Backdrop[] = SCENES.map((s) => ({
  id: s.id, name: s.name, kind: "scene" as const, scene: s.id,
  family: { name: s.name, a: s.a, b: s.b, c: s.c, glow: s.glow },
}));

export function byId(id: string): Backdrop | null {
  return BACKDROPS.find((b) => b.id === id) ?? SET_BACKDROPS.find((b) => b.id === id) ?? null;
}

// ----------------------------------------------------------------- drawing

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Paint the backdrop for time `t` (seconds). Always fills the whole frame. */
export function drawBackdrop(ctx: Ctx, w: number, h: number, t: number, bd: Backdrop) {
  if (bd.kind === "scene" && bd.scene) {
    drawScene(ctx, w, h, t, bd.scene);
    return;
  }
  const f = bd.family;
  const seed = hashId(bd.id);
  const TAU = Math.PI * 2;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // base wash: every kind starts from a soft top-to-bottom gradient
  const sway = Math.sin((t / 12) * TAU) * 0.12;
  ctx.fillStyle = linear(ctx, w * (0.3 + sway), 0, w * (0.7 - sway), h, [[0, f.a], [1, f.b]]);
  ctx.fillRect(0, 0, w, h);

  switch (bd.kind) {
    case "drift": {
      // the colours slowly slide across the frame
      const k = (Math.sin((t / 15) * TAU) + 1) / 2;
      ctx.fillStyle = linear(ctx, 0, h * k * 0.4, w, h * (1 - 0.4 * (1 - k)), [
        [0, withAlpha(f.glow, 0.65)], [0.5, withAlpha(f.a, 0)], [1, withAlpha(f.c, 0.28)],
      ]);
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "glow": {
      // a soft light behind the dress that breathes
      const pulse = 0.9 + 0.1 * Math.sin((t / 6) * TAU);
      const cx = w * (0.5 + 0.05 * Math.sin((t / 20) * TAU));
      const cy = h * (0.42 + 0.03 * Math.cos((t / 17) * TAU));
      const r = Math.max(w, h) * 0.62 * pulse;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, withAlpha(f.glow, 0.95));
      g.addColorStop(0.5, withAlpha(f.glow, 0.35));
      g.addColorStop(1, withAlpha(f.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "dust": {
      // tiny specks of light floating upward
      const rand = rng(seed);
      for (let i = 0; i < 38; i++) {
        const sx = rand() * w;
        const speed = 0.015 + rand() * 0.03;
        const phase = rand();
        const size = (0.004 + rand() * 0.011) * h;
        const y = h * (1 - ((phase + t * speed) % 1));
        const x = sx + Math.sin(t * 0.5 + i) * w * 0.012;
        const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.6 + rand()) + i));
        const g = ctx.createRadialGradient(x, y, 0, x, y, size);
        g.addColorStop(0, withAlpha(f.glow, 0.85 * twinkle));
        g.addColorStop(1, withAlpha(f.glow, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
      }
      break;
    }
    case "silk": {
      // slow diagonal folds of sheen, like cloth in a breeze
      ctx.lineWidth = Math.max(w, h) * 0.18;
      for (let i = 0; i < 4; i++) {
        const off = ((t / 30 + i / 4) % 1) * 1.6 - 0.3;
        const x0 = w * off;
        ctx.strokeStyle = linear(ctx, x0 - w * 0.2, 0, x0 + w * 0.2, 0, [
          [0, withAlpha(f.glow, 0)], [0.5, withAlpha(f.glow, 0.32)], [1, withAlpha(f.glow, 0)],
        ]);
        ctx.beginPath();
        ctx.moveTo(x0 - h * 0.35, h);
        ctx.bezierCurveTo(x0 + w * 0.1, h * 0.66, x0 - w * 0.1, h * 0.33, x0 + h * 0.35, 0);
        ctx.stroke();
      }
      break;
    }
    case "arch": {
      // a pale arched window of light, like a boutique wall
      const aw = w * 0.82;
      const ax = (w - aw) / 2;
      const top = h * 0.08;
      const bottom = h * 1.02;
      const shimmer = 0.5 + 0.5 * Math.sin((t / 9) * TAU);
      ctx.beginPath();
      ctx.moveTo(ax, bottom);
      ctx.lineTo(ax, top + aw / 2);
      ctx.arc(w / 2, top + aw / 2, aw / 2, Math.PI, 0);
      ctx.lineTo(ax + aw, bottom);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, 0, top, 0, bottom, [
        [0, withAlpha(f.glow, 0.6 + 0.15 * shimmer)], [1, withAlpha(f.glow, 0.15)],
      ]);
      ctx.fill();
      ctx.lineWidth = w * 0.006;
      ctx.strokeStyle = withAlpha(f.c, 0.55);
      ctx.stroke();
      break;
    }
    case "clouds": {
      // big blurred colour blobs slowly trading places
      const rand = rng(seed);
      for (let i = 0; i < 4; i++) {
        const bx = rand();
        const by = rand();
        const sp = 0.02 + rand() * 0.03;
        const x = w * (0.5 + (bx - 0.5) * 0.9 + 0.12 * Math.sin(t * sp * TAU + i));
        const y = h * (0.5 + (by - 0.5) * 0.9 + 0.1 * Math.cos(t * sp * TAU + i * 2));
        const r = Math.max(w, h) * (0.32 + rand() * 0.18);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const c = i % 2 ? f.c : f.glow;
        g.addColorStop(0, withAlpha(c, i % 2 ? 0.34 : 0.7));
        g.addColorStop(1, withAlpha(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "beams": {
      // soft shafts of light sweeping slowly down from the top corner
      const sweep = Math.sin((t / 14) * TAU) * 0.08;
      for (let i = 0; i < 3; i++) {
        const ang = 0.35 + i * 0.16 + sweep;
        ctx.save();
        ctx.translate(w * 1.02, -h * 0.05);
        ctx.rotate(ang);
        const bw = w * (0.2 + i * 0.07);
        ctx.fillStyle = linear(ctx, 0, 0, 0, h * 1.5, [
          [0, withAlpha(f.glow, 0.55 - i * 0.12)], [1, withAlpha(f.glow, 0)],
        ]);
        ctx.fillRect(-bw / 2, 0, bw, h * 1.5);
        ctx.restore();
      }
      break;
    }
  }
  ctx.restore();
}
