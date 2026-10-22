// Painting the reel and turning it into an MP4, all inside the browser.
//
// The painter takes the dress-on-a-stage canvas and a shot plan and can draw
// any moment of the reel onto any canvas, at any size — a small one for the
// live preview, a full 1080x1920 one for the file. The encoder then walks
// through the 30 seconds one frame at a time, faster than real time, and
// hands each frame to the browser's own H.264 encoder (WebCodecs); a muxer
// wraps the result as an .mp4. Nothing is uploaded and nothing is paid for.

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import {
  FPS, TOTAL_SECONDS, cropRect, ease, layersAt, lerpPose, planTimeline,
  type Layer, type Shot, type Stage, type Timeline,
} from "./plan";

export type ReelText = {
  brand: string;
  title: string;
  tagline: string;
  contact: string;
};

export type PainterOptions = {
  /** The dress, already on its stage. */
  stageCanvas: HTMLCanvasElement | OffscreenCanvas;
  stage: Stage;
  shots: Shot[];
  text: ReelText;
  /** CSS colour of the stage background; decides light or dark text. */
  background: string;
  width: number;
  height: number;
  /** Show the brand name at the top of every shot. */
  watermark?: boolean;
  /** The brand logo (transparent PNG). Opens the reel, sits as a watermark throughout, and closes it. */
  logo?: CanvasImageSource | null;
};

/** Seconds the logo holds at the start before fading into the first shot. */
const INTRO_HOLD = 1.4;
const INTRO_FADE = 0.8;

function sizeOf(img: CanvasImageSource): { w: number; h: number } {
  const i = img as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  return { w: i.naturalWidth ?? i.width ?? 1, h: i.naturalHeight ?? i.height ?? 1 };
}

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

const OLIVE = "#3F4827";
const GOLD = "#A98238";
const IVORY = "#F7F1E8";
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Montserrat', -apple-system, 'Segoe UI', Arial, sans-serif";

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ctxOf(c: AnyCanvas): Canvas2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the reel.");
  return ctx as Canvas2D;
}

function luminance(css: string): number {
  const probe = ctxOf(makeCanvas(1, 1));
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255;
}

function roundRectPath(ctx: Canvas2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Centred text with extra space between letters, drawn letter by letter so it works in every browser. */
function spacedCentered(ctx: Canvas2D, text: string, cx: number, y: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let x = cx - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prev;
}

function centered(ctx: Canvas2D, text: string, cx: number, y: number) {
  const prev = ctx.textAlign;
  ctx.textAlign = "center";
  ctx.fillText(text, cx, y);
  ctx.textAlign = prev;
}

export class ReelPainter {
  readonly timeline: Timeline;
  readonly width: number;
  readonly height: number;
  private o: PainterOptions;
  private shots: Shot[];
  private endCard: AnyCanvas;
  private mark: AnyCanvas | null;
  private captionCache = new Map<string, AnyCanvas>();
  private ink: string;

  constructor(o: PainterOptions) {
    this.o = o;
    this.width = o.width;
    this.height = o.height;
    this.shots = o.shots.filter((s) => s.enabled);
    this.timeline = planTimeline(this.shots.map((s) => s.weight), TOTAL_SECONDS);
    this.ink = luminance(o.background) < 0.45 ? IVORY : OLIVE;
    this.mark = o.watermark === false ? null : o.logo ? this.makeLogoWatermark(o.logo) : this.makeWatermark();
    this.endCard = this.makeEndCard();
  }

  // ------------------------------------------------------------ furniture

  private makeWatermark(): AnyCanvas {
    const { height: H } = this;
    const probe = ctxOf(makeCanvas(10, 10));
    const size = H * 0.0175;
    probe.font = `600 ${size}px ${SERIF}`;
    const chars = [...this.o.text.brand.toUpperCase()];
    const spacing = H * 0.004;
    const total = chars.reduce((a, c) => a + probe.measureText(c).width, 0) + spacing * (chars.length - 1);
    const w = Math.ceil(total) + 8;
    const h = Math.ceil(size * 1.8);
    const c = makeCanvas(w, h);
    const ctx = ctxOf(c);
    ctx.font = `600 ${size}px ${SERIF}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = this.ink;
    ctx.globalAlpha = 0.85;
    spacedCentered(ctx, chars.join(""), w / 2, size * 1.2, spacing);
    return c;
  }

  /** The logo as a small, slightly see-through corner mark. */
  private makeLogoWatermark(logo: CanvasImageSource): AnyCanvas {
    const { width: W } = this;
    const { w: lw, h: lh } = sizeOf(logo);
    const w = Math.round(W * 0.2);
    const h = Math.round((w * lh) / lw);
    const pad = Math.round(W * 0.012);
    const c = makeCanvas(w + pad * 2, h + pad * 2);
    const ctx = ctxOf(c);
    if (luminance(this.o.background) < 0.45) {
      // dark backgrounds: seat the logo on a soft ivory plate so it stays legible
      ctx.fillStyle = "rgba(247,241,232,0.88)";
      roundRectPath(ctx, 0, 0, c.width, c.height, W * 0.02);
      ctx.fill();
    }
    ctx.globalAlpha = 0.82;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, pad, pad, w, h);
    return c;
  }

  private makeCaption(text: string): AnyCanvas {
    const cached = this.captionCache.get(text);
    if (cached) return cached;
    const { height: H } = this;
    const size = H * 0.022;
    const probe = ctxOf(makeCanvas(10, 10));
    probe.font = `500 ${size}px ${SANS}`;
    const tw = probe.measureText(text).width;
    const pad = H * 0.013;
    const w = Math.ceil(tw + pad * 3);
    const h = Math.ceil(size + pad * 2);
    const c = makeCanvas(w, h);
    const ctx = ctxOf(c);
    ctx.fillStyle = "rgba(0,0,0,0.47)";
    roundRectPath(ctx, 0, 0, w, h, h / 2);
    ctx.fill();
    ctx.font = `500 ${size}px ${SANS}`;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.textBaseline = "middle";
    ctx.fillText(text, pad * 1.5, h / 2 + size * 0.04);
    this.captionCache.set(text, c);
    return c;
  }

  private makeEndCard(): AnyCanvas {
    const { width: W, height: H, o } = this;
    const c = makeCanvas(W, H);
    const ctx = ctxOf(c);
    ctx.fillStyle = IVORY;
    ctx.fillRect(0, 0, W, H);

    // the dress on its stage, in a soft card
    const maxW = W * 0.64;
    const logo = o.logo ?? null;
    const maxH = H * (logo ? 0.4 : 0.5);
    const sw = o.stageCanvas.width;
    const sh = o.stageCanvas.height;
    const k = Math.min(maxW / sw, maxH / sh);
    const cw = sw * k;
    const ch = sh * k;
    const px = (W - cw) / 2;
    const py = H * (logo ? 0.07 : 0.11);
    const r = W * 0.025;
    ctx.save();
    ctx.shadowColor = "rgba(60,40,30,0.32)";
    ctx.shadowBlur = W * 0.04;
    ctx.shadowOffsetY = H * 0.012;
    ctx.fillStyle = o.background;
    roundRectPath(ctx, px, py, cw, ch, r);
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, px, py, cw, ch, r);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(o.stageCanvas as CanvasImageSource, px, py, cw, ch);
    ctx.restore();

    let y = py + ch + H * 0.06;
    ctx.fillStyle = OLIVE;
    ctx.textBaseline = "alphabetic";
    if (o.text.title) {
      ctx.font = `500 ${H * 0.0245}px ${SANS}`;
      centered(ctx, o.text.title, W / 2, y);
      y += H * 0.062;
    }
    if (logo) {
      const { w: lw, h: lh } = sizeOf(logo);
      const lh2 = H * 0.27;
      const lw2 = (lh2 * lw) / lh;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(logo, (W - lw2) / 2, y - H * 0.025, lw2, lh2);
      y += lh2 + H * 0.015;
    } else {
      ctx.font = `600 ${H * 0.042}px ${SERIF}`;
      spacedCentered(ctx, o.text.brand.toUpperCase(), W / 2, y, H * 0.006);
      y += H * 0.03;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = Math.max(2, H * 0.002);
      ctx.beginPath();
      ctx.moveTo(W * 0.41, y);
      ctx.lineTo(W * 0.59, y);
      ctx.stroke();
      y += H * 0.04;
    }
    if (o.text.tagline) {
      ctx.fillStyle = "#78645A";
      ctx.font = `400 ${H * 0.02}px ${SANS}`;
      centered(ctx, o.text.tagline, W / 2, y);
      y += H * 0.04;
    }
    if (o.text.contact) {
      ctx.fillStyle = OLIVE;
      ctx.font = `500 ${H * 0.022}px ${SANS}`;
      centered(ctx, o.text.contact, W / 2, y);
    }
    return c;
  }

  // ---------------------------------------------------------------- frames

  private paintLayer(ctx: Canvas2D, layer: Layer, alpha: number) {
    const { width: W, height: H } = this;
    const [s, e] = this.timeline.spans[layer.index];
    ctx.globalAlpha = alpha;
    if (layer.index >= this.shots.length) {
      ctx.drawImage(this.endCard as CanvasImageSource, 0, 0);
      ctx.globalAlpha = 1;
      return;
    }
    const shot = this.shots[layer.index];
    const r = cropRect(this.o.stage, lerpPose(shot.from, shot.to, ease(layer.progress)), W / H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.o.stageCanvas as CanvasImageSource, r.x, r.y, r.w, r.h, 0, 0, W, H);
    if (this.mark) {
      if (this.o.logo) {
        ctx.drawImage(this.mark as CanvasImageSource, W - this.mark.width - W * 0.03, H * 0.035);
      } else {
        ctx.drawImage(this.mark as CanvasImageSource, (W - this.mark.width) / 2, H * 0.06);
      }
    }
    if (shot.caption) {
      const into = layer.progress * (e - s);
      const fade =
        Math.min(1, Math.max(0, (into - 0.5) / 0.4)) *
        Math.min(1, Math.max(0, (e - s - this.timeline.overlap - into) / 0.4));
      if (fade > 0) {
        const cap = this.makeCaption(shot.caption);
        ctx.globalAlpha = alpha * fade;
        ctx.drawImage(cap as CanvasImageSource, (W - cap.width) / 2, H * 0.78);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Draw the reel as it looks `t` seconds in. */
  drawAt(ctx: Canvas2D, t: number) {
    const { a, b, mix } = layersAt(this.timeline, t);
    ctx.globalCompositeOperation = "source-over";
    this.paintLayer(ctx, a, 1);
    if (b && mix > 0) this.paintLayer(ctx, b, mix);
    if (this.o.logo && t < INTRO_HOLD + INTRO_FADE) this.paintIntro(ctx, t);
  }

  /** The opening: the logo on ivory, then melting into the first shot. */
  private paintIntro(ctx: Canvas2D, t: number) {
    const { width: W, height: H } = this;
    const logo = this.o.logo!;
    const alpha = t <= INTRO_HOLD ? 1 : Math.max(0, 1 - (t - INTRO_HOLD) / INTRO_FADE);
    // a gentle settle: the logo drifts from 96% to 100% size while it holds
    const grow = 0.96 + 0.04 * Math.min(1, t / (INTRO_HOLD + INTRO_FADE));
    const { w: lw, h: lh } = sizeOf(logo);
    const w = W * 0.74 * grow;
    const h = (w * lh) / lw;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = IVORY;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, (W - w) / 2, (H - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }
}

// -------------------------------------------------------------------- MP4

export function canMakeVideo(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

/**
 * Render the whole reel to an MP4 (H.264, 30 fps, silent) at the painter's
 * size. Resolves with the file; `onProgress` gets 0-1; abort with the signal.
 */
export async function encodeReel(
  painter: ReelPainter,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!canMakeVideo()) {
    throw new Error("This browser cannot make video files. Use the latest Chrome or Edge on a computer.");
  }
  const { width, height } = painter;
  const total = Math.round(painter.timeline.total * FPS);

  // Try the common H.264 levels until one is accepted at this size.
  const candidates = ["avc1.640034", "avc1.64002A", "avc1.4D0034", "avc1.42003E"];
  let codec = "";
  for (const c of candidates) {
    const support = await VideoEncoder.isConfigSupported({
      codec: c, width, height, bitrate: 8_000_000, framerate: FPS,
    });
    if (support.supported) {
      codec = c;
      break;
    }
  }
  if (!codec) throw new Error("This browser cannot encode H.264 video at this size. Try Chrome or Edge.");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    fastStart: "in-memory",
  });
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({ codec, width, height, bitrate: 8_000_000, framerate: FPS });

  const canvas = makeCanvas(width, height);
  const ctx = ctxOf(canvas);

  for (let k = 0; k < total; k++) {
    if (signal?.aborted) {
      encoder.close();
      throw new DOMException("Cancelled", "AbortError");
    }
    if (failure) throw failure;
    painter.drawAt(ctx, k / FPS);
    const frame = new VideoFrame(canvas as CanvasImageSource, {
      timestamp: Math.round((k * 1_000_000) / FPS),
      duration: Math.round(1_000_000 / FPS),
    });
    encoder.encode(frame, { keyFrame: k % FPS === 0 });
    frame.close();
    // Let the encoder catch up and the page breathe.
    while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
    if (k % 6 === 0) {
      onProgress(k / total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await encoder.flush();
  if (failure) throw failure;
  muxer.finalize();
  encoder.close();
  onProgress(1);
  return new Blob([target.buffer], { type: "video/mp4" });
}
