// The reel's choreography: which part of the dress is on screen at which
// moment. Pure arithmetic — no canvas, no DOM — so it can be tested in Node
// and so the renderer on the page has nothing clever left to decide.
//
// Vocabulary
//   pose   [x, y, zoom]
//            x, y  where the camera looks, 0-1 across the dress itself
//                  (0,0 = top-left of the dress, 1,1 = bottom-right)
//            zoom  1 = the whole dress in frame, 2 = twice as close
//   shot   one slow move from a start pose to an end pose
//   stage  the 9:16 canvas the dress is placed on; every crop is taken from
//          it, so the camera can never wander off the picture

export type Pose = [number, number, number];

export type Shot = {
  name: string;
  from: Pose;
  to: Pose;
  /** Share of the running time, relative to the other shots. */
  weight: number;
  /** Small label shown while the shot plays. Empty for none. */
  caption: string;
  enabled: boolean;
};

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const OUT_W = 1080;
export const OUT_H = 1920;
export const FPS = 30;
export const ASPECT = OUT_W / OUT_H;

export const TOTAL_SECONDS = 30;
export const CROSSFADE_SECONDS = 0.6;
export const END_CARD_SECONDS = 7;

/**
 * A sensible plan for a front-facing kurti: whole dress, neckline and yoke, a
 * detail at the centre, each sleeve, the body, the lower body, and a pull-back.
 * It is a starting point — other cuts will want the poses nudged, which is
 * what the editor on the page is for.
 */
export function defaultShots(): Shot[] {
  const s = (name: string, from: Pose, to: Pose, weight = 1, caption = ""): Shot => ({
    name, from, to, weight, caption, enabled: true,
  });
  return [
    s("Full view", [0.5, 0.5, 1.0], [0.5, 0.46, 1.2], 1.3),
    s("Neckline and yoke", [0.5, 0.25, 1.7], [0.5, 0.36, 1.7]),
    s("Centre detail", [0.5, 0.41, 2.2], [0.5, 0.36, 2.2]),
    s("Left sleeve", [0.16, 0.47, 1.7], [0.16, 0.63, 1.7]),
    s("Right sleeve", [0.8, 0.38, 1.7], [0.8, 0.54, 1.7]),
    s("Body", [0.42, 0.63, 1.7], [0.49, 0.79, 1.7]),
    s("Lower body", [0.49, 0.85, 1.7], [0.49, 0.96, 1.7]),
    s("Full view", [0.5, 0.46, 1.2], [0.5, 0.5, 1.0], 1.3),
  ];
}

/** Gentle ease: mostly steady, softly eased at both ends. */
export function ease(u: number): number {
  const x = Math.min(Math.max(u, 0), 1);
  return 0.5 * x + 0.5 * (0.5 - 0.5 * Math.cos(Math.PI * x));
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ---------------------------------------------------------------- timeline

export type Timeline = {
  /** [start, end] seconds for each segment; the last one is the end card. */
  spans: [number, number][];
  total: number;
  overlap: number;
};

/**
 * Lay the shots end to end, each overlapping the next by `overlap` seconds for
 * the crossfade, with the end card fixed at `endLen`, so everything adds up to
 * exactly `total`.
 */
export function planTimeline(
  weights: number[],
  total = TOTAL_SECONDS,
  overlap = CROSSFADE_SECONDS,
  endLen = END_CARD_SECONDS,
): Timeline {
  if (weights.length === 0) throw new Error("Turn on at least one shot.");
  const n = weights.length + 1;
  const content = total + (n - 1) * overlap - endLen;
  const wsum = weights.reduce((a, b) => a + Math.max(b, 0.05), 0);
  const durs = weights.map((w) => (content * Math.max(w, 0.05)) / wsum);
  durs.push(endLen);
  if (Math.min(...durs) < 2 * overlap + 0.2) {
    throw new Error("Too many shots for a 30-second reel. Turn some off.");
  }
  const spans: [number, number][] = [];
  let start = 0;
  for (const d of durs) {
    spans.push([start, start + d]);
    start += d - overlap;
  }
  return { spans, total, overlap };
}

export type Layer = { index: number; progress: number };

/**
 * What to draw at time t: one segment, or two while a crossfade is under way
 * (`mix` is how far the second has come in, eased).
 */
export function layersAt(tl: Timeline, t: number): { a: Layer; b?: Layer; mix: number } {
  const active: number[] = [];
  tl.spans.forEach(([s, e], i) => {
    if (t >= s && t < e) active.push(i);
  });
  if (active.length === 0) active.push(t < 0 ? 0 : tl.spans.length - 1);
  const layer = (i: number): Layer => {
    const [s, e] = tl.spans[i];
    return { index: i, progress: Math.min(Math.max((t - s) / (e - s), 0), 1) };
  };
  if (active.length === 1) return { a: layer(active[0]), mix: 0 };
  const bi = active[active.length - 1];
  const raw = Math.min(Math.max((t - tl.spans[bi][0]) / tl.overlap, 0), 1);
  return { a: layer(active[0]), b: layer(bi), mix: raw * raw * (3 - 2 * raw) };
}

// ------------------------------------------------------------------- stage

export type Stage = {
  width: number;
  height: number;
  /** The dress, in stage pixels. */
  dress: Box;
};

/**
 * Size a 9:16 stage that holds the whole dress with a little air around it,
 * and say where the dress sits on it (centred). Everything that follows is
 * measured on this stage.
 *
 * `maxHeight` caps the stage so a huge photo does not become a huge canvas.
 */
export function stageFor(dressW: number, dressH: number, maxHeight = 3000): {
  width: number; height: number; scale: number;
} {
  const fullH = Math.max(dressH * 1.06, (dressW * 1.1) / ASPECT);
  const scale = Math.min(1, maxHeight / fullH);
  return {
    width: Math.round(fullH * ASPECT * scale),
    height: Math.round(fullH * scale),
    scale,
  };
}

/** The part of the stage the camera sees for a pose. Never leaves the stage. */
export function cropRect(stage: Stage, pose: Pose, aspect = ASPECT): Rect {
  const [px, py, zoom] = pose;
  let h = stage.height / Math.max(zoom, 0.05);
  let w = h * aspect;
  if (w > stage.width) {
    w = stage.width;
    h = w / aspect;
  }
  if (h > stage.height) {
    h = stage.height;
    w = h * aspect;
  }
  const dw = stage.dress.x1 - stage.dress.x0;
  const dh = stage.dress.y1 - stage.dress.y0;
  const cx = stage.dress.x0 + px * dw;
  const cy = stage.dress.y0 + py * dh;
  const x = Math.min(Math.max(cx - w / 2, 0), stage.width - w);
  const y = Math.min(Math.max(cy - h / 2, 0), stage.height - h);
  return { x, y, w, h };
}

/**
 * Plain-language warnings for shots that are zoomed past what the photo can
 * deliver — they play, but look soft. Empty when all is well.
 */
export function softnessNotes(stage: Stage, shots: Shot[], outW = OUT_W): string[] {
  const notes: string[] = [];
  for (const sh of shots) {
    if (!sh.enabled) continue;
    const worst = Math.min(
      cropRect(stage, sh.from).w,
      cropRect(stage, sh.to).w,
    );
    if (worst < outW * 0.62) {
      notes.push(`"${sh.name}" is zoomed in further than the photo's detail, so it will look soft.`);
    }
  }
  return notes;
}
