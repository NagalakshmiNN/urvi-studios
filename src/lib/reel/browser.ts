// The browser-only half of the reel maker: loading a photo, running the
// cutout network, and setting the dress on its stage. Everything that is
// arithmetic lives in the other files so it can be tested without a browser.

import {
  composeCutout, refineMask, type Composed, type Refined,
} from "./cutout-core";
import {
  MODEL_URL, ORT_MODULE_URL, ORT_WASM_DIR, foregroundProbability, loadSession, type OrtLike,
} from "./cutout-model";
import { stageFor, type Stage } from "./plan";

/** Long side the photo is worked at. Bigger is sharper and slower. */
export const WORK_SIZE = 2400;

export function parseColor(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 240];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Load a photo (a File the user picked, or a URL on this site) onto a canvas no larger than WORK_SIZE. */
export async function loadPhoto(src: File | string): Promise<HTMLCanvasElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const k = Math.min(1, WORK_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot open pictures.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

let logoPromise: Promise<HTMLImageElement | null> | null = null;

/** The Urvi Studios logo (transparent PNG), or null if it cannot be loaded. */
export function loadLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    logoPromise = (async () => {
      try {
        const img = new Image();
        img.src = "/brand/reel-logo.png";
        await img.decode();
        return img;
      } catch {
        return null;
      }
    })();
  }
  return logoPromise;
}

let ortPromise: Promise<OrtLike> | null = null;
let sessionPromise: Promise<Awaited<ReturnType<typeof loadSession>>> | null = null;

/** onnxruntime-web, loaded on demand from our own /ort folder (see scripts/copy-ort.mjs). */
async function loadOrt(): Promise<OrtLike> {
  if (!ortPromise) {
    ortPromise = (async () => {
      // A runtime import of a URL: the bundler must leave it alone.
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ ORT_MODULE_URL);
      const ort = (mod.default ?? mod) as OrtLike;
      ort.env.wasm.wasmPaths = ORT_WASM_DIR;
      ort.env.wasm.numThreads = 1; // no cross-origin isolation needed
      ort.env.wasm.proxy = false;
      return ort;
    })();
    ortPromise.catch(() => { ortPromise = null; });
  }
  return ortPromise;
}

async function getSession() {
  const ort = await loadOrt();
  if (!sessionPromise) {
    sessionPromise = loadSession(ort, MODEL_URL);
    sessionPromise.catch(() => { sessionPromise = null; });
  }
  return { ort, session: await sessionPromise };
}

export type Analysis = {
  w: number;
  h: number;
  /** The photo's own pixels. */
  rgba: Uint8ClampedArray;
  refined: Refined;
};

const tick = () => new Promise<void>((r) => setTimeout(r, 30));

/** Find the dress in the photo. Takes a few seconds; `status` narrates it. */
export async function analysePhoto(photo: HTMLCanvasElement, status: (s: string) => void): Promise<Analysis> {
  const w = photo.width;
  const h = photo.height;
  const rgba = photo.getContext("2d")!.getImageData(0, 0, w, h).data;
  status("Loading the cutout model (first time only)…");
  await tick();
  const { ort, session } = await getSession();
  status("Finding the dress…");
  await tick();
  const probability = await foregroundProbability(ort, session, rgba, w, h);
  status("Tidying the edges, removing the hanger…");
  await tick();
  const refined = refineMask(rgba, w, h, probability);
  return { w, h, rgba, refined };
}

/** Put the analysed dress on a plain colour, honouring any hand touch-ups. */
export function composeToCanvas(
  a: Analysis, manual: Uint8Array | null, bg: [number, number, number],
): { canvas: HTMLCanvasElement; composed: Composed } {
  const composed = composeCutout(a.rgba, a.w, a.h, a.refined, manual, bg);
  const canvas = document.createElement("canvas");
  canvas.width = a.w;
  canvas.height = a.h;
  const image = new ImageData(new Uint8ClampedArray(composed.pixels), a.w, a.h);
  canvas.getContext("2d")!.putImageData(image, 0, 0);
  return { canvas, composed };
}

/**
 * Set the dress on a 9:16 stage the colour of the background. If the photo
 * cuts the dress off at an edge (a hem out of frame, say), that edge is lined
 * up with the stage edge, so the camera never shows empty space beyond a cut.
 */
export function buildStage(
  photo: HTMLCanvasElement,
  dress: { x0: number; y0: number; x1: number; y1: number },
  backgroundCss: string,
): { canvas: HTMLCanvasElement; stage: Stage } {
  const dw = dress.x1 - dress.x0 + 1;
  const dh = dress.y1 - dress.y0 + 1;
  const sz = stageFor(dw, dh);
  const k = sz.scale;
  const canvas = document.createElement("canvas");
  canvas.width = sz.width;
  canvas.height = sz.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = backgroundCss;
  ctx.fillRect(0, 0, sz.width, sz.height);

  const touchL = dress.x0 <= 1;
  const touchR = dress.x1 >= photo.width - 2;
  const touchT = dress.y0 <= 1;
  const touchB = dress.y1 >= photo.height - 2;
  const sw = dw * k;
  const sh = dh * k;
  let left = (sz.width - sw) / 2;
  let top = (sz.height - sh) / 2;
  if (touchL && !touchR) left = 0;
  else if (touchR && !touchL) left = sz.width - sw;
  if (touchT && !touchB) top = 0;
  else if (touchB && !touchT) top = sz.height - sh;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, dress.x0 - 0.0, dress.y0, dw, dh, left, top, sw, sh);
  return {
    canvas,
    stage: { width: sz.width, height: sz.height, dress: { x0: left, y0: top, x1: left + sw, y1: top + sh } },
  };
}
