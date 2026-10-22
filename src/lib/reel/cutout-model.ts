// The "which part of this picture is the foreground" network (U²-Net-small,
// Apache-2.0, 4.6 MB, served from /models). It runs in the visitor's own
// browser through onnxruntime-web, so cutting out a dress costs nothing and
// the photo never leaves the machine.
//
// The input and output handling here is plain arithmetic on arrays so it can
// be run and checked in Node as well as on the page.

export const MODEL_URL = "/models/u2netp.onnx";
export const ORT_MODULE_URL = "/ort/ort.wasm.min.mjs";
export const ORT_WASM_DIR = "/ort/";
const SIZE = 320;

/** The slice of onnxruntime-web this file uses. */
export type OrtLike = {
  InferenceSession: {
    create(source: string | Uint8Array, options?: Record<string, unknown>): Promise<{
      inputNames: readonly string[];
      outputNames: readonly string[];
      run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | ArrayLike<number> }>>;
    }>;
  };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
  env: { wasm: { wasmPaths?: string; numThreads?: number; proxy?: boolean } };
};

type Session = Awaited<ReturnType<OrtLike["InferenceSession"]["create"]>>;

/** Bilinear resize of an RGBA picture to SIZE x SIZE, returned as RGB floats 0-255. */
function resizeToModel(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const out = new Float32Array(SIZE * SIZE * 3);
  // Average over the source footprint of each output pixel (box filter), which
  // avoids the shimmer a plain bilinear pick gives when shrinking a lot.
  for (let y = 0; y < SIZE; y++) {
    const sy0 = Math.floor((y * h) / SIZE);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * h) / SIZE));
    for (let x = 0; x < SIZE; x++) {
      const sx0 = Math.floor((x * w) / SIZE);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * w) / SIZE));
      let r = 0, g = 0, b = 0, c = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const o = (sy * w + sx) * 4;
          r += rgba[o]; g += rgba[o + 1]; b += rgba[o + 2]; c++;
        }
      }
      const o = (y * SIZE + x) * 3;
      out[o] = r / c; out[o + 1] = g / c; out[o + 2] = b / c;
    }
  }
  return out;
}

/** Normalise the way the network was trained: scale by the brightest value, then mean/std per channel. */
export function toModelInput(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const rgb = resizeToModel(rgba, w, h);
  let max = 1e-6;
  for (let i = 0; i < rgb.length; i++) if (rgb[i] > max) max = rgb[i];
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * plane + i] = (rgb[i * 3 + c] / max - mean[c]) / std[c];
    }
  }
  return input;
}

/** Stretch the network's 320x320 answer to 0-1 and enlarge it (bilinear) to the picture's size. */
export function fromModelOutput(pred: ArrayLike<number>, w: number, h: number): Float32Array {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const v = pred[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(Math.max(((y + 0.5) * SIZE) / h - 0.5, 0), SIZE - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, SIZE - 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(Math.max(((x + 0.5) * SIZE) / w - 0.5, 0), SIZE - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, SIZE - 1);
      const tx = fx - x0;
      const a = pred[y0 * SIZE + x0] * (1 - tx) + pred[y0 * SIZE + x1] * tx;
      const b = pred[y1 * SIZE + x0] * (1 - tx) + pred[y1 * SIZE + x1] * tx;
      out[y * w + x] = ((a * (1 - ty) + b * ty) - lo) / span;
    }
  }
  return out;
}

export async function loadSession(ort: OrtLike, model: string | Uint8Array = MODEL_URL): Promise<Session> {
  return ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
}

/** Foreground probability (0-1) for every pixel of the picture. */
export async function foregroundProbability(
  ort: OrtLike, session: Session, rgba: Uint8ClampedArray | Uint8Array, w: number, h: number,
): Promise<Float32Array> {
  const input = new ort.Tensor("float32", toModelInput(rgba, w, h), [1, 3, SIZE, SIZE]);
  const result = await session.run({ [session.inputNames[0]]: input });
  const first = result[session.outputNames[0]];
  return fromModelOutput(first.data, w, h);
}
