// src/lib/typeset/place.ts
//
// Where on each page the text goes. The safe area matches the print
// template (8% from the outer edges and from top and bottom, 6% either side
// of the fold), so text is never trimmed or lost in the binding. Within it,
// a vision model picks the calmest open area that isn't over anyone.

import type { Box } from "./layout";

export type Side = "left" | "right";

export const SAFE = { outer: 0.08, topBottom: 0.08, gutter: 0.06 };

/** Longest line, as a fraction of the whole spread's width (about 30 letters at body size). */
export const MAX_MEASURE = 0.3;
export const MIN_MEASURE = 0.15;

export function pageArea(side: Side, W: number, H: number): Box {
  const top = H * SAFE.topBottom;
  const height = H * (1 - SAFE.topBottom * 2);
  const width = W * (0.5 - SAFE.outer - SAFE.gutter);
  const left = side === "left" ? W * SAFE.outer : W * (0.5 + SAFE.gutter);
  return { left, top, width, height };
}

/** Upper part of the page, where the illustration prompt asks for calm space. */
export function defaultBox(side: Side, W: number, H: number): Box {
  const a = pageArea(side, W, H);
  const width = Math.min(a.width, W * MAX_MEASURE);
  return { left: a.left + (a.width - width) / 2, top: a.top, width, height: a.height * 0.42 };
}

export function clampToArea(b: Box, a: Box): Box | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  if (right - left < a.width * 0.25 || bottom - top < a.height * 0.08) return null;
  return { left, top, width: right - left, height: bottom - top };
}

export function box2dToBox(b: unknown, W: number, H: number): Box | null {
  if (!Array.isArray(b) || b.length !== 4 || !b.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [y0, x0, y1, x1] = b.map((n) => Math.max(0, Math.min(1000, n)));
  if (y1 <= y0 || x1 <= x0) return null;
  return { left: (x0 / 1000) * W, top: (y0 / 1000) * H, width: ((x1 - x0) / 1000) * W, height: ((y1 - y0) / 1000) * H };
}

export function boxToBox2d(b: Box, W: number, H: number): [number, number, number, number] {
  const r = (n: number) => Math.round(n);
  return [r((b.top / H) * 1000), r((b.left / W) * 1000), r(((b.top + b.height) / H) * 1000), r(((b.left + b.width) / W) * 1000)];
}

/** What to ask the vision model, given how big each page's text block will be. */
export function placementPrompt(need: Partial<Record<Side, { w: number; h: number }>>): string {
  const lines: string[] = [];
  for (const side of ["left", "right"] as Side[]) {
    const n = need[side];
    if (!n) continue;
    lines.push(
      `- ${side.toUpperCase()} PAGE (the ${side} half): a block about ${Math.round(n.w * 100)}% of the image width by ${Math.round(n.h * 100)}% of its height.`
    );
  }
  return `This is a children's picture-book double-page spread: the left half is the left page, the right half is the right page. It has no text yet. Find where each page's text should go.

${lines.join("\n")}

Choose, for each page, the calmest open area big enough for its block:
- plain or simple background: sky, wall, floor, grass, snow, water, a flat colour
- never over a face, character, animal, hand or important object, and with a little space around them
- inside that page: at least 8% from the outer edge, 8% from the top and bottom, and 6% from the centre fold
- the top of the page is best; the bottom or a side is fine when the top is busy

Return JSON only, with boxes in 0-1000 coordinates of the WHOLE image:
{"left":{"box_2d":[ymin,xmin,ymax,xmax]},"right":{"box_2d":[ymin,xmin,ymax,xmax]}}
Leave out a page that isn't listed. A box can be larger than its block; only make it smaller when no calm area that big exists.`;
}

/** Turn the model's reply into boxes inside each page's safe area (missing or bad -> default). */
export function boxesFromReply(reply: any, sides: Side[], W: number, H: number): Record<Side, { box: Box; source: "vision" | "default" }> {
  const out = {} as Record<Side, { box: Box; source: "vision" | "default" }>;
  for (const side of sides) {
    const raw = box2dToBox(reply?.[side]?.box_2d, W, H);
    const clamped = raw ? clampToArea(raw, pageArea(side, W, H)) : null;
    out[side] = clamped ? { box: clamped, source: "vision" } : { box: defaultBox(side, W, H), source: "default" };
  }
  return out;
}
