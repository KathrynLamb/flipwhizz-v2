// src/lib/illustrate/geometry.ts
//
// Pure maths for the check-and-fix pipeline. No I/O, no SDKs, so it can be
// unit-tested anywhere.
//
// Gemini returns boxes as box_2d = [ymin, xmin, ymax, xmax] normalised 0-1000.

export type Box2d = [number, number, number, number];

export type PxBox = { left: number; top: number; width: number; height: number };

/** Aspect ratios the Gemini image models accept (imageConfig.aspectRatio). */
export const GEMINI_ASPECTS: { label: string; ratio: number }[] = [
  { label: "1:1", ratio: 1 },
  { label: "2:3", ratio: 2 / 3 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "5:4", ratio: 5 / 4 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "21:9", ratio: 21 / 9 },
];

export function nearestAspect(ratio: number): { label: string; ratio: number } {
  let best = GEMINI_ASPECTS[0];
  let bestErr = Infinity;
  for (const a of GEMINI_ASPECTS) {
    // Compare in log space so 2:1 vs 1:2 are symmetric.
    const err = Math.abs(Math.log(a.ratio) - Math.log(ratio));
    if (err < bestErr) {
      bestErr = err;
      best = a;
    }
  }
  return best;
}

export function isValidBox2d(b: unknown): b is Box2d {
  return (
    Array.isArray(b) &&
    b.length === 4 &&
    b.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000) &&
    b[2] > b[0] &&
    b[3] > b[1]
  );
}

/** box_2d (0-1000) -> integer pixel box, clamped to the image. */
export function box2dToPx(b: Box2d, imgW: number, imgH: number): PxBox {
  const clamp = (v: number) => Math.max(0, Math.min(1000, v));
  const y0 = clamp(b[0]);
  const x0 = clamp(b[1]);
  const y1 = clamp(b[2]);
  const x1 = clamp(b[3]);
  const left = Math.floor((x0 / 1000) * imgW);
  const top = Math.floor((y0 / 1000) * imgH);
  const right = Math.ceil((x1 / 1000) * imgW);
  const bottom = Math.ceil((y1 / 1000) * imgH);
  return {
    left,
    top,
    width: Math.max(1, Math.min(imgW, right) - left),
    height: Math.max(1, Math.min(imgH, bottom) - top),
  };
}

/** Grow a box by a fraction of its own size on every side, clamped. */
export function padBox(b: PxBox, frac: number, imgW: number, imgH: number): PxBox {
  const px = Math.round(b.width * frac);
  const py = Math.round(b.height * frac);
  const left = Math.max(0, b.left - px);
  const top = Math.max(0, b.top - py);
  const right = Math.min(imgW, b.left + b.width + px);
  const bottom = Math.min(imgH, b.top + b.height + py);
  return { left, top, width: right - left, height: bottom - top };
}

export type CropPlan = {
  crop: PxBox; // region of the art sent to the model and pasted back
  aspect: string; // aspect ratio to request from the model
  subject: PxBox; // the person's box, relative to the crop
};

/**
 * Plan the crop around a person: pad generously for context (the model needs
 * to see lighting and surroundings to blend), grow to a Gemini aspect ratio,
 * keep it inside the image, and never smaller than minSide pixels.
 */
export function planCrop(
  person: PxBox,
  imgW: number,
  imgH: number,
  opts: { padFrac?: number; minSide?: number } = {}
): CropPlan {
  const padFrac = opts.padFrac ?? 0.35;
  const minSide = Math.min(opts.minSide ?? 384, imgW, imgH);

  const pad = Math.round(Math.max(person.width, person.height) * padFrac);
  let w = person.width + pad * 2;
  let h = person.height + pad * 2;
  w = Math.max(w, minSide);
  h = Math.max(h, minSide);

  const target = nearestAspect(w / h);
  // Grow (never shrink) to the target ratio.
  if (w / h < target.ratio) w = Math.round(h * target.ratio);
  else h = Math.round(w / target.ratio);

  // If it no longer fits, cap at the image, then trim the other side so the
  // crop is EXACTLY a ratio Gemini can return (otherwise the patch comes back
  // a different shape and no longer lines up). Never trim into the subject.
  w = Math.min(w, imgW);
  h = Math.min(h, imgH);
  let aspect = nearestAspect(w / h).label;
  const byCloseness = [...GEMINI_ASPECTS].sort(
    (a, b) => Math.abs(Math.log(a.ratio) - Math.log(w / h)) - Math.abs(Math.log(b.ratio) - Math.log(w / h))
  );
  for (const a of byCloseness) {
    let w2 = w;
    let h2 = h;
    if (w / h > a.ratio) w2 = Math.round(h * a.ratio);
    else h2 = Math.round(w / a.ratio);
    if (w2 >= person.width + 2 && h2 >= person.height + 2) {
      w = w2;
      h = h2;
      aspect = a.label;
      break;
    }
  }

  const cx = person.left + person.width / 2;
  const cy = person.top + person.height / 2;
  let left = Math.round(cx - w / 2);
  let top = Math.round(cy - h / 2);
  left = Math.max(0, Math.min(imgW - w, left));
  top = Math.max(0, Math.min(imgH - h, top));

  const crop = { left, top, width: w, height: h };
  const subject = {
    left: person.left - left,
    top: person.top - top,
    width: person.width,
    height: person.height,
  };
  return { crop, aspect, subject };
}

/** Intersection-over-union of two pixel boxes. */
export function iou(a: PxBox, b: PxBox): number {
  const x0 = Math.max(a.left, b.left);
  const y0 = Math.max(a.top, b.top);
  const x1 = Math.min(a.left + a.width, b.left + b.width);
  const y1 = Math.min(a.top + a.height, b.top + b.height);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/* -------------------------------------------------------------------------- */
/*                                TEXT CHECKS                                 */
/* -------------------------------------------------------------------------- */

export function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance on words (robust to line breaks and spacing). */
function wordDistance(a: string[], b: string[]): number {
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** 1 = identical, 0 = nothing in common (word-level). */
export function textSimilarity(expected: string, actual: string): number {
  const e = normaliseText(expected).split(" ").filter(Boolean);
  const a = normaliseText(actual).split(" ").filter(Boolean);
  if (e.length === 0 && a.length === 0) return 1;
  if (e.length === 0 || a.length === 0) return 0;
  return 1 - wordDistance(e, a) / Math.max(e.length, a.length);
}

export type TextBlock = { box_2d: Box2d; text: string };

export type TextVerdict = {
  ok: boolean;
  left: number; // similarity 0-1
  right: number;
  problems: string[];
};

/**
 * Compare what was lettered with what should have been. Blocks are split
 * into left/right page by their centre. Passing needs high similarity on
 * each page and no page carrying noticeably more words than expected
 * (which is how a repeated passage shows up).
 */
export function judgeLettering(
  blocks: TextBlock[],
  expectedLeft: string,
  expectedRight: string,
  threshold = 0.9
): TextVerdict {
  const sideText = (side: "left" | "right") =>
    blocks
      .filter((b) => isValidBox2d(b.box_2d))
      .filter((b) => {
        const cx = (b.box_2d[1] + b.box_2d[3]) / 2;
        return side === "left" ? cx < 500 : cx >= 500;
      })
      .sort((p, q) => p.box_2d[0] - q.box_2d[0] || p.box_2d[1] - q.box_2d[1])
      .map((b) => b.text)
      .join(" ");

  const gotLeft = sideText("left");
  const gotRight = sideText("right");
  const left = textSimilarity(expectedLeft, gotLeft);
  const right = textSimilarity(expectedRight, gotRight);
  const problems: string[] = [];

  const words = (s: string) => normaliseText(s).split(" ").filter(Boolean).length;
  const check = (side: string, exp: string, got: string, sim: number) => {
    if (!normaliseText(exp)) {
      if (words(got) > 3) problems.push(`${side} page should have no text but has some`);
      return;
    }
    if (words(got) > words(exp) * 1.3 + 3) problems.push(`${side} page text appears to be repeated`);
    if (sim < threshold) problems.push(`${side} page text does not match (similarity ${sim.toFixed(2)})`);
  };
  check("Left", expectedLeft, gotLeft, left);
  check("Right", expectedRight, gotRight, right);

  return { ok: problems.length === 0, left, right, problems };
}
